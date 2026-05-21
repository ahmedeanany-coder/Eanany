import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// AI Generation Helper with Error Handling and Retry for 503 / Transient Failures
async function generateAIContent(prompt: string, modelName: string = "gemini-3.5-flash") {
  let retries = 3;
  let delay = 1000;
  
  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      return response.text;
    } catch (error: any) {
      const errStr = (error.message || "").toLowerCase();
      const isTransient = errStr.includes("503") || 
                        errStr.includes("unavailable") || 
                        errStr.includes("high demand") || 
                        errStr.includes("overloaded") || 
                        errStr.includes("temporarily");
      
      retries--;
      if (isTransient && retries > 0) {
        console.warn(`Gemini API returned transient failure (503). Retrying in ${delay}ms... (Remaining retries: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }
      
      if (errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("quota exceeded")) {
        throw new Error("AI_QUOTA_EXCEEDED");
      }
      if (isTransient) {
        throw new Error("AI_TEMPORARILY_UNAVAILABLE");
      }
      throw error;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // AI Insight Endpoint
  app.post("/api/ai/insight", async (req, res) => {
    const { language = 'en' } = req.body;
    try {
      const { data } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is missing from environment");
        return res.status(500).json({ error: "AI configuration missing" });
      }

      const prompt = language === 'ar' 
        ? `أنت مستشار مالي خبير. قم بتحليل البيانات التالية (المصاريف، الدخل، المدخرات) لهذا الشهر وقدم نصيحة واحدة استراتيجية ومختصرة جداً.
           البيانات: ${JSON.stringify(data)}
           إذا كانت المصاريف عالية، ركز على التقليل. إذا كان هناك فائض، ركز على الادخار أو الذهب.
           اجعل الرد باللغة العربية بلهجة احترافية وودودة.`
        : `You are an expert financial advisor. Analyze this month's data (expenses, income, savings) and provide one brief strategic advice.
           Data: ${JSON.stringify(data)}
           If expenses are high, focus on cutting. If there is surplus, focus on savings or gold.
           Keep it professional and friendly.`;

      const responseText = await generateAIContent(prompt);
      if (!responseText) {
        throw new Error("Empty response from Gemini");
      }

      res.json({ insight: responseText });
    } catch (error: any) {
      const isQuota = error.message && error.message.includes("AI_QUOTA_EXCEEDED");
      const isUnavailable = error.message && error.message.includes("AI_TEMPORARILY_UNAVAILABLE");
      if (isQuota) {
        return res.status(429).json({ 
          error: language === 'ar' 
            ? "لقد نفذت حصة الذكاء الاصطناعي لليوم. يرجى المحاولة غداً." 
            : "AI quota exceeded for today. Please try again tomorrow." 
        });
      }
      if (isUnavailable) {
        console.warn("AI Insight Error: Gemini is temporarily unavailable due to high demand (503).");
        return res.status(503).json({
          error: language === 'ar'
            ? "الخدمة غير متوفرة حالياً بسبب الضغط العالي. سنعتمد على التحليل المحلي المؤقت."
            : "The AI service is temporarily unavailable due to high demand."
        });
      }
      console.error("AI Insight Error:", error);
      res.status(500).json({ error: "Failed to generate insight" });
    }
  });

  // Smart Expense Parser
  app.post("/api/ai/parse-expense", async (req, res) => {
    try {
      const { text, language } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "AI configuration missing" });
      }

      const prompt = `Convert this text into a JSON object for an expense. 
      Text: "${text}"
      Categories available: home, food, transport, utilities, health, shopping, entertainment, other.
      Output format: { "description": string, "amount": number, "category": string, "isInstallment": boolean, "installmentsCount": number | null }
      
      Examples:
      "أفطرت ب ٥٠ جنيه" -> { "description": "فطار", "amount": 50, "category": "food", "isInstallment": false }
      "bought clothes for 1000" -> { "description": "clothes", "amount": 1000, "category": "shopping", "isInstallment": false }
      "قسط التلاجة ٥٠٠ جنيه على ١٠ شهور" -> { "description": "ثلاجة", "amount": 500, "category": "home", "isInstallment": true, "installmentsCount": 10 }
      
      Respond with MINIMAL JSON ONLY. No markdown tags.`;

      const responseText = await generateAIContent(prompt);
      if (!responseText) throw new Error("Empty response");

      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      const isQuota = error.message && error.message.includes("AI_QUOTA_EXCEEDED");
      const isUnavailable = error.message && error.message.includes("AI_TEMPORARILY_UNAVAILABLE");
      if (isQuota) {
        return res.status(429).json({ error: "AI_QUOTA_EXCEEDED" });
      }
      if (isUnavailable) {
        console.warn("AI Parse Error: Gemini service temporarily unavailable (503).");
        return res.status(503).json({ error: "AI_TEMPORARILY_UNAVAILABLE" });
      }
      console.error("AI Parse Error:", error);
      res.status(500).json({ error: "Failed to parse expense" });
    }
  });

  // Generic AI Chat Endpoint
  app.post("/api/ai/chat", async (req, res) => {
    const { language = 'en' } = req.body;
    try {
      const { message, context } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "AI configuration missing" });
      }

      const prompt = `You are an expert financial advisor. 
      Ahmed is asking: "${message}"
      Context about Ahmed's wealth: ${JSON.stringify(context)}
      Language: Respond strictly in ${language === 'ar' ? 'Arabic' : 'English'}.
      Provide specific, smart, and encouraging advice for the Egyptian market.`;

      const responseText = await generateAIContent(prompt);
      res.json({ response: responseText });
    } catch (error: any) {
      const isQuota = error.message && error.message.includes("AI_QUOTA_EXCEEDED");
      const isUnavailable = error.message && error.message.includes("AI_TEMPORARILY_UNAVAILABLE");
      if (isQuota) {
        return res.status(429).json({ 
          error: language === 'ar' 
            ? "عذراً، انتهت حصة الذكاء الاصطناعي. جرب غداً." 
            : "AI quota exceeded. Try again tomorrow." 
        });
      }
      if (isUnavailable) {
        console.warn("AI Chat Error: Gemini service temporarily unavailable due to high demand (503).");
        return res.status(503).json({ 
          error: language === 'ar' 
            ? "الذكاء الاصطناعي مشغول حالياً بسبب الضغط العالي. جرب المحاولة لاحقاً." 
            : "AI is temporarily unavailable due to high demand. Please try again soon." 
        });
      }
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: "Failed to chat with AI" });
    }
  });

let goldPriceCache: { data: any, timestamp: number } | null = null;
const GOLD_PRICE_TTL = 1000 * 60 * 60 * 2; // 2 hours server-side cache

// Gold Price Endpoint
app.get("/api/gold-price", async (req, res) => {
  const now = Date.now();
  const forceRefresh = req.query.refresh === 'true';

  if (!forceRefresh && goldPriceCache && (now - goldPriceCache.timestamp) < GOLD_PRICE_TTL) {
    return res.json(goldPriceCache.data);
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI configuration missing" });
    }

    let response;
    let retries = 3;
    let delay = 1000;
    while (retries > 0) {
      try {
        // Using search grounding for real-time gold prices with stable gemini-3.5-flash
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Current Date: ${new Date().toISOString()}. 
          Search the web for the LATEST Retail SELLING prices of 1 gram of 21k and 24k Gold in Egypt (EGP).
          Sources: iSagha, Egypt Gold Price.
          Return ONLY a JSON object: {"21k": number, "24k": number}. No markdown tags, no extra text.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        break;
      } catch (error: any) {
        const errStr = (error.message || "").toLowerCase();
        const isQuota = errStr.includes("429") || 
                        errStr.includes("resource_exhausted") || 
                        errStr.includes("quota exceeded") || 
                        errStr.includes("limit");
        if (isQuota) {
          throw new Error("QUOTA_EXCEEDED");
        }

        const isTransient = errStr.includes("503") || 
                          errStr.includes("unavailable") || 
                          errStr.includes("high demand") || 
                          errStr.includes("overloaded") || 
                          errStr.includes("temporarily");
        retries--;
        if (isTransient && retries > 0) {
          console.warn(`Gold Price Gemini fetch returned 503. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw error;
      }
    }

    const responseText = response?.text || "";
    const jsonMatch = responseText.match(/\{.*\}/s);
    let prices = { "21k": 6912, "24k": 7900 };
    
    if (jsonMatch) {
       try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed["21k"]) prices["21k"] = parseInt(parsed["21k"].toString().replace(/,/g, ''));
          if (parsed["24k"]) prices["24k"] = parseInt(parsed["24k"].toString().replace(/,/g, ''));
       } catch (e) {
          // Fallback parsing if JSON is slightly malformed
          const digits = responseText.replace(/,/g, '').match(/\d+/g);
          if (digits && digits.length >= 2) {
              prices["21k"] = parseInt(digits[0]);
              prices["24k"] = parseInt(digits[1]);
          }
       }
    }
    
    // Validate if the prices derived are reasonable for 2026
    if (prices["21k"] < 2000) prices["21k"] = 6912;
    if (prices["24k"] < 2000) prices["24k"] = 7900;

    console.log(`Gold Price AI Update: 21k=${prices["21k"]}, 24k=${prices["24k"]}`);
    
    const sources = response?.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web?.uri).filter(Boolean) || [];

    const result = { 
      price: prices["24k"], 
      prices,
      timestamp: new Date().toISOString(),
      sources 
    };

    // Update cache
    goldPriceCache = { data: result, timestamp: now };
    res.json(result);

  } catch (error: any) {
    const errStr = (error.message || "").toLowerCase();
    const isQuota = error.message === "QUOTA_EXCEEDED" || 
                    errStr.includes("429") || 
                    errStr.includes("resource_exhausted") || 
                    errStr.includes("quota exceeded") || 
                    errStr.includes("limit");
    
    if (isQuota) {
      console.warn("Gold Price Fetch: AI Quota Exceeded (429/RESOURCE_EXHAUSTED). Returning stale cache or fallback.");
    } else {
      console.error("Gold Price AI Error:", error.message || error);
    }

    // If we have a stale cache, return it instead of fallback
    if (goldPriceCache) {
      return res.json(goldPriceCache.data);
    }

    res.json({ 
      price: 7900, 
      prices: { "21k": 6912, "24k": 7900 },
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
});




  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
