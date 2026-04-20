import { GoogleGenAI, Type } from "@google/genai";
import type { Loan, Transaction, DashboardStats } from "../types";

const getApiKey = () => {
  // 1. Try Vite env first (Standard for this platform + Vercel)
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. Try Node/Polyfill process next
  try {
    if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }
  return "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function analyzePortfolio(loans: Loan[], transactions: Transaction[], stats: DashboardStats): Promise<string> {
  const prompt = `
    Analyze this loan portfolio and provide a concise, professional summary for a manager.
    Focus on:
    1. Overall health (Active accounts vs Total).
    2. Interest yield performance.
    3. Risk assessment (Overdue accounts and pending interest).
    4. Actionable recommendations.

    Portfolio Data:
    - Total Capital Out: ₹${stats.totalCapitalOut.toLocaleString('en-IN')}
    - Total Interest Earned: ₹${stats.totalInterestEarned.toLocaleString('en-IN')}
    - Overdue Count: ${stats.overdueCount}
    - Total Pending Interest: ₹${stats.totalPendingInterest.toLocaleString('en-IN')}
    - Active Loans: ${loans.filter(l => l.status === 'active').length}
    - Recent Loans: ${JSON.stringify(loans.slice(0, 5).map(l => ({ name: l.name, principal: l.initialPrincipal, rate: l.interestRate })))}

    Format the response in professional markdown. Use headers for each point. Keep it under 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
      }
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "The AI analyst is currently unavailable. Please check your configuration.";
  }
}

export async function analyzeLoan(loan: Loan, transactions: Transaction[]): Promise<{ score: number, insight: string }> {
  const prompt = `
    Analyze the "Repayment Consistency" for this specific loan entity.
    Entity: ${loan.name}
    Rate: ${loan.interestRate}% (${loan.paymentFrequency})
    Total Transactions: ${transactions.length}
    Payment History: ${JSON.stringify(transactions.slice(-10).map(t => ({ type: t.type, amount: t.amount, date: t.date })))}

    Tasks:
    1. Calculate a "Repayment Consistency Score" from 0-100 based on transaction regularity and principal reduction.
    2. Provide a 1-2 sentence peak insight about their repayment behavior.

    Return ONLY a JSON object with:
    { "score": number, "insight": string }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            insight: { type: Type.STRING }
          },
          required: ["score", "insight"]
        }
      }
    });

    const body = JSON.parse(response.text || '{"score":0, "insight": "No data available."}');
    return {
      score: Math.min(100, Math.max(0, body.score || 0)),
      insight: body.insight || "No specific patterns detected for this asset."
    };
  } catch (error) {
    console.error("AI Loan Detail Error:", error);
    return {
      score: 0,
      insight: "Intelligence engine temporarily disconnected for this specific entity."
    };
  }
}

export async function askAI(query: string, context: { loans: Loan[], transactions: Transaction[] }): Promise<string> {
  const prompt = `
    You are an expert financial analyst assistant. 
    Context:
    - Loans: ${JSON.stringify(context.loans.map(l => ({ id: l.id, name: l.name, principal: l.initialPrincipal, bal: l.currentPrincipal, status: l.status })))}
    - Total Transaction Count: ${context.transactions.length}

    User Question: ${query}

    Answer concisely and professionally. If the user asks for specific calculations, explain the logic (Declining Balance).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "I am having trouble connecting to the intelligence engine. Please try again later.";
  }
}
