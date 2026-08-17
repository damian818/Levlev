import express from "express";
import compression from "compression";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Default fallback FX rates if external API is unreachable or times out
const FALLBACK_FX_RATES = {
  bolsa: { buy: 1390, sell: 1410, name: "Bolsa (MEP)", updated: new Date().toISOString() },
  blue: { buy: 1470, sell: 1490, name: "Blue", updated: new Date().toISOString() },
  oficial: { buy: 1040, sell: 1080, name: "Oficial", updated: new Date().toISOString() },
  tarjeta: { buy: 1680, sell: 1720, name: "Tarjeta", updated: new Date().toISOString() },
  ccl: { buy: 1420, sell: 1445, name: "Contado con Liqui", updated: new Date().toISOString() },
};

const FALLBACK_GLOBAL_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  BRL: 5.45,
  MXN: 18.20,
  CLP: 930.0,
  COP: 3950.0,
  CAD: 1.36,
  JPY: 154.5,
  USDT: 1.0,
  ARS: 1410.0,
};

const FALLBACK_INFLATION_HISTORY = [
  { month: '2024-09', inflationIndex: 100, usdArsRate: 1250 },
  { month: '2024-10', inflationIndex: 103.5, usdArsRate: 1280 },
  { month: '2024-11', inflationIndex: 106.2, usdArsRate: 1310 },
  { month: '2024-12', inflationIndex: 109.0, usdArsRate: 1350 },
  { month: '2025-01', inflationIndex: 112.2, usdArsRate: 1380 },
  { month: '2025-02', inflationIndex: 115.0, usdArsRate: 1400 },
  { month: '2025-03', inflationIndex: 117.8, usdArsRate: 1430 },
  { month: '2025-04', inflationIndex: 120.5, usdArsRate: 1460 },
  { month: '2025-05', inflationIndex: 123.1, usdArsRate: 1490 },
  { month: '2025-06', inflationIndex: 125.8, usdArsRate: 1520 },
  { month: '2025-07', inflationIndex: 128.5, usdArsRate: 1550 },
  { month: '2025-08', inflationIndex: 131.2, usdArsRate: 1580 },
  { month: '2025-09', inflationIndex: 134.0, usdArsRate: 1610 },
  { month: '2025-10', inflationIndex: 136.8, usdArsRate: 1640 },
  { month: '2025-11', inflationIndex: 139.7, usdArsRate: 1670 },
  { month: '2025-12', inflationIndex: 142.6, usdArsRate: 1700 },
  { month: '2026-01', inflationIndex: 145.8, usdArsRate: 1450 },
  { month: '2026-02', inflationIndex: 149.0, usdArsRate: 1400 },
  { month: '2026-03', inflationIndex: 152.2, usdArsRate: 1380 },
  { month: '2026-04', inflationIndex: 155.5, usdArsRate: 1448.5 },
  { month: '2026-05', inflationIndex: 158.8, usdArsRate: 1410 },
  { month: '2026-06', inflationIndex: 162.2, usdArsRate: 1480 },
  { month: '2026-07', inflationIndex: 165.6, usdArsRate: 1485 },
  { month: '2026-08', inflationIndex: 169.1, usdArsRate: 1496 },
];

// Simple in-memory cache for external API calls
const cache = {
  fxRates: { data: null as any, timestamp: 0 },
  inflationHistory: { data: null as any, timestamp: 0 }
};
const CACHE_TTL = 3600000; // 1 hour

// API Routes
app.get(["/api/fx-rates", "/fx-rates"], async (req, res) => {
  try {
    // Return cached data if fresh
    const now = Date.now();
    if (cache.fxRates.data && (now - cache.fxRates.timestamp < CACHE_TTL)) {
      return res.json(cache.fxRates.data);
    }

    const [dolarRes, globalRes] = await Promise.allSettled([
      fetchWithTimeout("https://dolarapi.com/v1/dolares", {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }, 8000),
      fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }, 8000)
    ]);

    const ratesMap: Record<string, { buy: number; sell: number; name: string; updated: string }> = {};
    if (dolarRes.status === 'fulfilled' && dolarRes.value.ok) {
      const data = await dolarRes.value.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          ratesMap[item.casa] = {
            buy: item.compra,
            sell: item.venta,
            name: item.nombre,
            updated: item.fechaActualizacion,
          };
        });
      }
    }

    let globalRates: Record<string, number> = { ...FALLBACK_GLOBAL_RATES };
    if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
      const globalData = await globalRes.value.json();
      if (globalData && globalData.rates) {
        globalRates = { ...globalData.rates, USDT: 1.0 };
      }
    }

    const mepRate = ratesMap['bolsa']?.sell || ratesMap['blue']?.sell || 1410;
    if (mepRate) {
      globalRates['ARS'] = mepRate;
    }

    const responseData = {
      rates: Object.keys(ratesMap).length > 0 ? ratesMap : FALLBACK_FX_RATES,
      globalRates,
      fetchedAt: new Date().toISOString()
    };

    // Update cache
    cache.fxRates = { data: responseData, timestamp: Date.now() };

    res.json(responseData);
  } catch (error: any) {
    console.warn("Using fallback FX rates due to upstream timeout/error:", error?.message || error);
    res.json({
      rates: FALLBACK_FX_RATES,
      globalRates: FALLBACK_GLOBAL_RATES,
      fallback: true,
      error: error?.message || "Using cached fallback exchange rates",
      fetchedAt: new Date().toISOString()
    });
  }
});

// Universal Currency Pair Converter API Endpoint
app.get(["/api/fx-convert", "/fx-convert", "/api/fx-pair", "/fx-pair"], async (req, res) => {
  try {
    const from = ((req.query.from as string) || 'USD').toUpperCase();
    const to = ((req.query.to as string) || 'EUR').toUpperCase();
    const amount = parseFloat(req.query.amount as string) || 1;

    let baseRates: Record<string, number> = { ...FALLBACK_GLOBAL_RATES };

    try {
      const globalRes = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${from}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }, 8000);

      if (globalRes.ok) {
        const data = await globalRes.json();
        if (data && data.rates) {
          baseRates = data.rates;
        }
      }
    } catch (e) {
      console.warn(`Could not fetch live base ${from}, using fallback cross rate calculation`);
    }

    if (from === 'ARS' || to === 'ARS') {
      try {
        const dolarRes = await fetchWithTimeout("https://dolarapi.com/v1/dolares/bolsa", {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        }, 8000);
        if (dolarRes.ok) {
          const mep = await dolarRes.json();
          if (mep && mep.venta) {
            if (from === 'USD' && to === 'ARS') baseRates['ARS'] = mep.venta;
            else if (from === 'ARS' && to === 'USD') baseRates['USD'] = 1 / mep.venta;
          }
        }
      } catch (e) {
        // ignore fallback
      }
    }

    let rate = 1;
    if (from === to) {
      rate = 1;
    } else if (baseRates[to]) {
      rate = baseRates[to];
    } else {
      const fromInUsd = baseRates[from] ? (1 / baseRates[from]) : (from === 'ARS' ? 1/1410 : 1);
      const toInUsd = baseRates[to] ? (1 / baseRates[to]) : (to === 'ARS' ? 1/1410 : 1);
      rate = fromInUsd / toInUsd;
    }

    const convertedAmount = Math.round(amount * rate * 100) / 100;

    res.json({
      from,
      to,
      amount,
      rate,
      convertedAmount,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to convert currency pair" });
  }
});

app.get(["/api/inflation-fx-history", "/inflation-fx-history"], async (req, res) => {
  try {
    // Return cached data if fresh (ignoring startDate for simplicity or adding it to cache key)
    const now = Date.now();
    if (cache.inflationHistory.data && (now - cache.inflationHistory.timestamp < CACHE_TTL)) {
      return res.json(cache.inflationHistory.data);
    }

    const [inflResSettled, fxResSettled] = await Promise.allSettled([
      fetchWithTimeout("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }, 10000),
      fetchWithTimeout("https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa", {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }, 10000)
    ]);

    if (inflResSettled.status === 'rejected' || fxResSettled.status === 'rejected') {
      const inflErr = inflResSettled.status === 'rejected' ? inflResSettled.reason : null;
      const fxErr = fxResSettled.status === 'rejected' ? fxResSettled.reason : null;
      throw new Error(`Connection error: ${inflErr?.message || fxErr?.message || 'Unknown network error'}`);
    }

    const inflRes = inflResSettled.value;
    const fxRes = fxResSettled.value;

    if (!inflRes.ok || !fxRes.ok) {
      throw new Error(`API returned error status: Inflation=${inflRes.status}, FX=${fxRes.status}`);
    }

    const inflData: { fecha: string; valor: number }[] = await inflRes.json();
    const fxData: { fecha: string; compra: number; venta: number }[] = await fxRes.json();

    const monthlyFx: Record<string, number> = {};
    if (Array.isArray(fxData)) {
      fxData.forEach(item => {
        const month = item.fecha.substring(0, 7);
        monthlyFx[month] = item.venta || item.compra;
      });
    }

    const startDate = (req.query.startDate as string) || '2024-01-01';

    const recentInfl = Array.isArray(inflData) ? inflData.filter(item => item.fecha >= startDate) : [];
    let cumulativeIndex = 100;
    const historyPoints = recentInfl.map((item, idx) => {
      const month = item.fecha.substring(0, 7);
      if (idx > 0) {
        cumulativeIndex = cumulativeIndex * (1 + item.valor / 100);
      }
      let rate = monthlyFx[month] || null;
      
      // Manual Overrides for simulation months (2026)
      if (month === '2026-01') rate = 1450;
      if (month === '2026-02') rate = 1400;
      if (month === '2026-03') rate = 1380;
      if (month === '2026-04') rate = 1448.5;
      if (month === '2026-05') rate = 1410;
      if (month === '2026-06') rate = 1480;
      if (month === '2026-07') rate = 1485;
      if (month === '2026-08') rate = 1496;

      return {
        month,
        monthlyInflation: item.valor,
        inflationIndex: Math.round(cumulativeIndex * 10) / 10,
        usdArsRate: rate,
      };
    }).filter(pt => pt.usdArsRate !== null || pt.month >= '2024-09');

    const responseData = {
      points: historyPoints,
      source: "ArgentinaDatos API (INDEC CPI & MEP FX Rate)",
      fetchedAt: new Date().toISOString()
    };

    // Update cache
    cache.inflationHistory = { data: responseData, timestamp: Date.now() };

    res.json(responseData);
  } catch (error: any) {
    console.warn("Error fetching inflation/FX history, returning fallback historical data:", error?.message || error);
    res.json({
      points: FALLBACK_INFLATION_HISTORY,
      fallback: true,
      error: error?.message || "Using static historical inflation fallback data",
      fetchedAt: new Date().toISOString()
    });
  }
});

app.post(["/api/ai-insights", "/ai-insights"], async (req, res) => {
  try {
    const { summaryData, customPrompt, language } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    
    let prompt = customPrompt || `You are an expert financial advisor analyzing a user's multi-currency (ARS & USD), multi-account personal finance data. 
Here is the financial summary for the period:
- Total Income: ${summaryData?.totalIncome}
- Total Expenses: ${summaryData?.totalExpenses}
- Savings Rate: ${summaryData?.savingsRate}%
- Top Expense Categories: ${JSON.stringify(summaryData?.topCategories)}
- Top Accounts: ${JSON.stringify(summaryData?.topAccounts)}
- Inflation vs FX Context: Argentina peso depreciation and inflation impact.

Provide 3 actionable financial recommendations, 2 key spending risks or anomalies, and a brief overall financial health score (0-100) with a 2-sentence summary. Format your response in clean markdown.`;

    // Inject data if a custom prompt is used
    if (customPrompt) {
      prompt = `You are an expert financial advisor analyzing a user's multi-currency personal finance data. Here is the financial summary for the period:
- Total Income: ${summaryData?.totalIncome}
- Total Expenses: ${summaryData?.totalExpenses}
- Savings Rate: ${summaryData?.savingsRate}%
- Top Expense Categories: ${JSON.stringify(summaryData?.topCategories)}
- Top Accounts: ${JSON.stringify(summaryData?.topAccounts)}

Task: ${customPrompt}
Format your response in clean markdown.`;
    }

    if (language) {
      prompt += `\n\nCRITICAL INSTRUCTION: You MUST provide your entire response in the following language code: ${language}. Do not use English unless the language code is 'en'.`;
    }

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
    });
    
    let fullOutput = "";
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const textContent = step.content?.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          fullOutput += textContent.text;
        }
      }
    }
    
    res.json({ insights: fullOutput });
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    if (error?.message?.includes('resource_exhausted') || error?.status === 429) {
      return res.status(429).json({ error: "AI quota temporarily exceeded. Please try again shortly." });
    }
    res.status(500).json({ error: error.message || "Failed to generate AI insights" });
  }
});

app.post(["/api/ai-parse-tx", "/ai-parse-tx"], async (req, res) => {
  try {
    const { text, accounts, categories } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const systemInstruction = `You are a financial transaction parser. Extract the transaction details from the provided text (e.g. an SMS or copy-pasted message).
Available Accounts: ${accounts.join(', ')}
Available Categories: ${categories.join(', ')}

Return ONLY a JSON object with the following fields:
- title (string): A short description or title of the transaction.
- amount (number): The parsed amount as a positive number.
- type (string): "EXPENSE", "INCOME", or "TRANSFER". Default to EXPENSE unless it's clearly income/deposit or transfer.
- account (string): The closest matching account name from the available accounts.
- category (string): The closest matching category name from the available categories.
- currency (string): "ARS" or "USD". Default to ARS.
- date (string): "YYYY-MM-DD" if mentioned, otherwise omit.

Do NOT include markdown formatting or backticks in the response. Return raw JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: text }] }
      ],
      config: {
        systemInstruction: {
          role: "system",
          parts: [{ text: systemInstruction }],
        },
        temperature: 0.2,
      }
    });

    const outputText = response.text?.trim() || "{}";
    const cleanedText = outputText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    
    try {
      const parsedData = JSON.parse(cleanedText);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Error parsing AI response as JSON:", parseError);
      res.status(500).json({ error: "Failed to parse AI response as JSON", rawResponse: outputText });
    }

  } catch (error: any) {
    console.error("AI parse API Error:", error);
    res.status(500).json({ error: "Failed to process AI request", details: error.message });
  }
});

app.post(["/api/ai-chat", "/ai-chat"], async (req, res) => {
  try {
    const { messages, financialContext, language } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let systemInstruction = `You are an expert AI financial assistant integrated into a multi-currency personal finance tracker (handling ARS and USD in Argentina). 
Here is the user's current financial context:
- Summary: ${JSON.stringify(financialContext?.summary || {})}
- Monthly Trends: ${JSON.stringify(financialContext?.monthlyTrend || [])}
- Top Categories: ${JSON.stringify(financialContext?.topCategories || [])}
- Recent Transactions: ${JSON.stringify(financialContext?.recentTransactions || [])}

Answer the user's questions clearly, accurately, and concisely. Use the provided context to give personalized advice.`;

    if (language) {
      systemInstruction += `\n\nCRITICAL INSTRUCTION: You MUST provide your entire response in the following language code: ${language}. Do not use English unless the language code is 'en'.`;
    }

    const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
    
    // Construct history for the interaction
    const historyText = (messages || []).slice(0, -1).map((m: any) => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const prompt = historyText 
      ? `History:\n${historyText}\n\nUser: ${lastMessage}`
      : lastMessage;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
      system_instruction: systemInstruction,
    });

    let fullOutput = "";
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const textContent = step.content?.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          fullOutput += textContent.text;
        }
      }
    }
    
    res.json({ reply: fullOutput });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    if (error?.message?.includes('resource_exhausted') || error?.status === 429) {
      return res.status(429).json({ error: "AI quota temporarily exceeded. Please try again shortly." });
    }
    res.status(500).json({ error: error.message || "Failed to generate AI response" });
  }
});

app.get(["/api/health", "/health"], (req, res) => {
  res.json({ status: "ok" });
});

export default app;

