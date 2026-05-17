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
  const latestEntry = data.entries[0] || {};
  const dataSeed = `${latestEntry.expensesTotal || 0}-${latestEntry.savings || 0}-${latestEntry.month || ''}`;
  const cacheKey = `advice_${language}_v3_${dataSeed}`;
  
  return callAIWithCache(cacheKey, 1000 * 60 * 60, async () => {
    try {
      const response = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: {
            profile: data.profile,
            latestEntry,
            summary: "Financial coach for Ahmed. Analyze expenses and savings."
          }, 
          language 
        }),
      });
      
      if (response.status === 429) {
        return getLocalAdvice(data, language);
      }
      
      const result = await response.json();
      return result.insight || getLocalAdvice(data, language);
    } catch (error: any) {
      if (!error?.message?.includes('429')) {
        console.error("Advice Proxy Error:", error);
      }
      return getLocalAdvice(data, language);
    }
  });
}

export async function askFinancialAI(question: string, context: any, language: 'ar' | 'en') {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, context, language }),
    });
    
    if (response.status === 429) {
      return language === 'ar' 
        ? "لقد استهلكت جميع المحاولات المتاحة للذكاء الاصطناعي اليوم. جرب مرة أخرى غداً." 
        : "You've exceeded your AI quota for today. Please try again tomorrow.";
    }

    const result = await response.json();
    return result.response || (language === 'ar' ? "عذراً، أواجه صعوبة في الاتصال حالياً." : "Sorry, I'm having trouble connecting right now.");
  } catch (error: any) {
    if (!error?.message?.includes('429')) {
      console.error("Ask AI Proxy Error:", error);
    }
    return language === 'ar' ? "عذراً، لم أستطع الرد الآن." : "Sorry, I couldn't respond right now.";
  }
}

export async function getGoldPrice() {
  const cacheKey = 'gold_price_egp_v2';
  return callAIWithCache(cacheKey, 1000 * 60 * 30, async () => {
    try {
      const response = await fetch('/api/gold-price');
      if (response.status === 429) return 4100;
      const result = await response.json();
      return result.price || 4100;
    } catch (error: any) {
      if (!error?.message?.includes('429')) {
        console.error("Gold Price Proxy Error:", error);
      }
      return 4100;
    }
  });
}
