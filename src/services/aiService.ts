import { GoogleGenAI } from "@google/genai";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "UNAVAILABLE") {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

const globalCache: Record<string, { data: any, timestamp: number }> = {};

function getCached(key: string, ttl: number) {
  const cached = globalCache[key];
  const now = Date.now();
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.data;
  }
  
  // Also check localStorage for persistence across sessions
  const local = localStorage.getItem(`ai_cache_${key}`);
  const localTime = localStorage.getItem(`ai_cache_${key}_time`);
  if (local && localTime && (now - parseInt(localTime)) < ttl) {
    return JSON.parse(local);
  }
  
  return null;
}

function setCached(key: string, data: any) {
  const now = Date.now();
  globalCache[key] = { data, timestamp: now };
  localStorage.setItem(`ai_cache_${key}`, JSON.stringify(data));
  localStorage.setItem(`ai_cache_${key}_time`, now.toString());
}

const inFlight: Record<string, Promise<any>> = {};

async function callAIWithCache(key: string, ttl: number, action: () => Promise<any>) {
  const cached = getCached(key, ttl);
  if (cached) return cached;

  if (inFlight[key]) return inFlight[key];

  const promise = action().then(result => {
    if (result) setCached(key, result);
    delete inFlight[key];
    return result;
  }).catch(err => {
    delete inFlight[key];
    throw err;
  });

  inFlight[key] = promise;
  return promise;
}

async function callAIWithRetry(params: any, retries = 3) {
  const modelsToTry = [
    "gemini-flash-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
  ];

  for (let i = 0; i <= retries; i++) {
    const currentModel = i === 0 ? (params.model || modelsToTry[0]) : (modelsToTry[i % modelsToTry.length]);
    
    try {
      const ai = getAI();
      const modelParams = { 
        ...params,
        model: currentModel,
      };
      return await ai.models.generateContent(modelParams);
    } catch (error: any) {
      const errStr = (error.message || "").toLowerCase();
      console.warn(`AI Call Attempt ${i + 1} failed for ${currentModel}:`, errStr);

      if (errStr.includes('api key not valid') || errStr === 'missing_api_key') {
        throw error;
      }

      const isQuotaError = errStr.includes('429') || errStr.includes('resource_exhausted') || errStr.includes('quota');
      const isToolError = errStr.includes('tool') || errStr.includes('googlesearch');

      if (i < retries) {
        // If it's a tool error, strip tools for the next attempt
        if (isToolError && params.config?.tools) {
          console.warn("Stripping tools from AI request due to potential tool failure");
          const { tools, ...configWithoutTools } = params.config;
          params.config = configWithoutTools;
        }

        const delay = isQuotaError ? 3000 * (i + 1) : 1000 * (i + 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

function getLocalAdvice(data: any, language: 'ar' | 'en') {
  const profile = data.profile || {};
  const entries = data.entries || [];
  const latest = entries[0] || {};
  
  const savings = latest.savings || 0;
  const target = profile.savingsTarget || 0;
  const percentage = target > 0 ? (savings / target) * 100 : 0;
  
  const expensesTotal = latest.expensesTotal || 0;
  const salary = latest.salary || 0;
  const expenseRatio = salary > 0 ? (expensesTotal / salary) * 100 : 0;

  if (language === 'ar') {
    let advice = `### نصيحة مالية سريعة (تحليل محلي)\n\n`;
    advice += `* **حالة التوفير:** لقد حققت ${percentage.toFixed(1)}% من هدفك الشهري.\n`;
    
    if (expenseRatio > 70) {
      advice += `* **تحذير المصاريف:** مصاريفك تمثل ${expenseRatio.toFixed(1)}% من دخلك. هذا عالي جداً! حاول تقليل بنود الرفاهية.\n`;
    } else if (expenseRatio > 40) {
      advice += `* **تنبيه:** مصاريفك متوسطة (${expenseRatio.toFixed(1)}%). هناك مساحة لزيادة الادخار إذا قللت المصاريف المتغيرة.\n`;
    }

    if (percentage < 50) {
      advice += `* **نصيحة الخطة:** أنت بعيد عن هدفك. هل فكرت في زيادة ساعات أوبر هذا الأسبوع؟\n`;
    } else {
      advice += `* **تشجيع:** أنت في طريقك الصحيح! استمر في الالتزام بخطتك.\n`;
    }
    
    advice += `\n*نصيحة اليوم:* اشترِ الذهب في أوقات التراجع البسيطة (Dips). الاستمرار في الادخار أهم من البحث عن أرخص سعر.`;
    return advice;
  } else {
    let advice = `### Quick Financial Tip (Local Analysis)\n\n`;
    advice += `* **Savings Status:** You've achieved ${percentage.toFixed(1)}% of your monthly target.\n`;
    
    if (expenseRatio > 70) {
      advice += `* **Expense Alert:** Your expenses are ${expenseRatio.toFixed(1)}% of your income. This is very high! Try cutting luxury items.\n`;
    }
    
    if (percentage < 50) {
      advice += `* **Plan Tip:** You are below target. Consider increasing Uber hours this week.\n`;
    } else {
      advice += `* **Encouragement:** Great job! Stay consistent.\n`;
    }
    advice += `\n*Tip:* Buy gold during minor dips. Consistency beats timing.`;
    return advice;
  }
}

export async function getFinancialAdvice(data: any, language: 'ar' | 'en') {
  const cacheKey = `advice_${language}_${data.profile.savingsTarget}_${new Date().getDate()}`;
  return callAIWithCache(cacheKey, 1000 * 60 * 60 * 4, async () => {
    try {
      const response = await callAIWithRetry({
        contents: `Current Month Data: ${JSON.stringify(data.entries[0])}\nOverall Profile: ${JSON.stringify(data.profile)}`,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: `You are a highly capable AI financial coach, helpful and natural like Google Gemini.
          LANGUAGE: Respond STRICTLY and COMPLETELY in ${language === 'ar' ? 'Arabic (اللغة العربية)' : 'English'}.
          If language is Arabic, DO NOT use English letters or words.
          
          Role: Intelligent financial mentor for Ahmed (أحمد), an Egyptian user building wealth through gold and savings.
          Goal: Analyze his data to provide deep insights on spending habits and savings progress.
          
          Analysis Sections to Provide:
          1. **Daily Financial Tip**: A quick, actionable tip.
          2. **Spending Deep Dive**: Analyze the 'expenses' list if provided in the data. Highlight the top category (Food, Transport, etc.) and suggest ways to save specifically in the Egyptian context (e.g. using public transport vs Uber, cooking at home).
          3. **Uber & Income Check**: Analyze Uber income vs Net Salary.
          4. **Savings Trajectory**: Is he on track for his 2028 goal?
          
          Style: Professional, encouraging, and highly analytical. Use Markdown headings and bullet points.`,
        }
      });
      return response?.text || getLocalAdvice(data, language);
    } catch (error: any) {
      console.warn("AI Service failed after retries, falling back to local advice.");
      return getLocalAdvice(data, language);
    }
  });
}

export async function askFinancialAI(question: string, context: any, language: 'ar' | 'en') {
  try {
    const response = await callAIWithRetry({
      contents: question,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are a helpful AI financial expert, smart and natural like Google Gemini.
        LANGUAGE: Respond STRICTLY and COMPLETELY in ${language === 'ar' ? 'Arabic (اللغة العربية)' : 'English'}.
        
        Persona: Intelligent financial mentor focused on helping Ahmed (أحمد) build his wealth in the Egyptian context (gold market, inflation, EGP).
        Context: ${JSON.stringify(context)}
        
        Guidelines:
        1. If Ahmed asks to "analyze his expenses" or "track his spending", use the 'expenses' data in the context to provide a category breakdown.
        2. Give specific advice on reducing costs in Egypt (e.g. mention specific grocery chains, transport options, or inflation-hedging techniques).
        3. Be encouraging but honest about financial leaks.
        4. Use Google Search for the latest gold prices (عيار 21, 24) and dollar rates in Egypt.`,
      }
    });

    return response?.text || (language === 'ar' ? "عذراً، أواجه صعوبة في الاتصال حالياً. حاول مجدداً لاحقاً." : "Sorry, I'm having trouble connecting right now. Please try again later.");
  } catch (error: any) {
    console.error("Ask AI Error:", error);
    return language === 'ar' ? "عذراً، لم أستطع الرد الآن نتيجة ضغط على الشبكة. يرجى المحاولة بعد قليل." : "Sorry, I couldn't respond due to high traffic. Please try again in a bit.";
  }
}

export async function getGoldPrice() {
  const cacheKey = 'gold_price_egp';
  return callAIWithCache(cacheKey, 1000 * 60 * 30, async () => {
    try {
      const prompt = `
        Current Date: ${new Date().toISOString()}
        Task: Provide the current market price of 1 gram of 24k Gold in Egypt in EGP.
        Requirements: 
        1. Search for the latest SAGHA price in Egypt.
        2. Return ONLY the numerical value.
        3. No text, no currency symbols, just the number (e.g., 4100).
      `;

      const response = await callAIWithRetry({
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response?.text || "";
      const cleanedText = text.replace(/,/g, '').match(/\d+/);
      if (cleanedText) {
        const price = parseInt(cleanedText[0]);
        if (price > 2000 && price < 15000) {
          return price;
        }
      }
      return 4100;
    } catch (error: any) {
      return 4100;
    }
  });
}
