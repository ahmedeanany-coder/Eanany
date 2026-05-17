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

// AI Generation Helper with Error Handling
async function generateAIContent(prompt: string, modelName: string = "gemini-3-flash-preview") {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    const errStr = (error.message || "").toLowerCase();
    if (errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("quota exceeded")) {
      throw new Error("AI_QUOTA_EXCEEDED");
    }
    throw error;
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
      if (isQuota) {
        return res.status(429).json({ 
          error: language === 'ar' 
            ? "لقد نفذت حصة الذكاء الاصطناعي لليوم. يرجى المحاولة غداً." 
            : "AI quota exceeded for today. Please try again tomorrow." 
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
      if (isQuota) {
        return res.status(429).json({ error: "AI_QUOTA_EXCEEDED" });
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
      if (isQuota) {
        return res.status(429).json({ 
          error: language === 'ar' 
            ? "عذراً، انتهت حصة الذكاء الاصطناعي. جرب غداً." 
            : "AI quota exceeded. Try again tomorrow." 
        });
      }
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: "Failed to chat with AI" });
    }
  });

  // Gold Price Endpoint
  app.get("/api/gold-price", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "AI configuration missing" });
      }

      const prompt = `Current Date: ${new Date().toISOString()}. Return ONLY the current market price of 1 gram of 24k Gold in Egypt in EGP as a number. No text.`;
      const responseText = await generateAIContent(prompt);
      const price = parseInt(responseText?.replace(/,/g, '').match(/\d+/)?.[0] || "4100");
      res.json({ price });
    } catch (error: any) {
      const isQuota = error.message && error.message.includes("AI_QUOTA_EXCEEDED");
      if (isQuota) {
        console.warn("Gold Price AI Quota exceeded, using fallback.");
      } else {
        console.error("Gold Price AI Error:", error);
      }
      res.json({ price: 4100 });
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
