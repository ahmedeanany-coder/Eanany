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
    try {
      const { data, language } = req.body;
      
      const prompt = language === 'ar' 
        ? `أنت مستشار مالي شخصي ذكي. قم بتحليل بيانات المصروفات التالية لهذا الشهر وقدم نصيحة واحدة مختصرة جداً (جملة واحدة أو جملتين) ومفيدة لتحسين الوضع المالي أو توفير المال.
           البيانات: ${JSON.stringify(data)}
           اجعل الرد باللغة العربية بلهجة ودودة ومحفزة.`
        : `You are a smart personal financial advisor. Analyze the following expense data for this month and provide one very brief (1-2 sentences) actionable insight to improve financial health or save money.
           Data: ${JSON.stringify(data)}
           Keep it friendly and motivating.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      res.json({ insight: response.text });
    } catch (error) {
      console.error("AI Insight Error:", error);
      res.status(500).json({ error: "Failed to generate insight" });
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
