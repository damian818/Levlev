import React, { useState } from 'react';
import { Transaction, DisplayCurrency } from '../types';
import { analyzeSpending, formatCurrency } from '../utils/financeUtils';
import { Sparkles, Bot, Loader2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AiAdvisorTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

export function AiAdvisorTab({ transactions, displayCurrency, usdArsRate }: AiAdvisorTabProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryData = {
        totalIncome: formatCurrency(spending.totalIncome, displayCurrency),
        totalExpenses: formatCurrency(spending.totalExpenses, displayCurrency),
        savingsRate: spending.savingsRate.toFixed(1),
        topCategories: spending.topCategories.slice(0, 5),
        topAccounts: spending.topMerchants.slice(0, 5),
      };

      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryData }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch AI insights');
      }

      setInsights(data.insights);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-amber-950/80 border border-amber-800/50 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">AI Financial Health & Risk Advisor</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          Leverage Google Gemini to analyze your multi-currency income, spending anomalies, savings potential, and macroeconomic risks.
        </p>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="inline-flex items-center px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-300" />
              <span>Analyzing financial portfolio...</span>
            </>
          ) : (
            <>
              <Bot className="w-4 h-4 mr-2 text-amber-400" />
              <span>Generate AI Financial Audit</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {insights && (
        <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Bot className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-bold text-slate-100">Gemini Advisory Report</h4>
          </div>
          <div className="markdown-body text-xs text-slate-300 leading-relaxed space-y-3">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
