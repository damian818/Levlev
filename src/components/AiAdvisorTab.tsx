import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate);

  const fetchInsights = async (customPrompt?: string) => {
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
        body: JSON.stringify({ summaryData, customPrompt, language: i18n.language }),
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

  const prompts = [
    {
      id: 'general',
      title: t('ai.prompts.general.title', { defaultValue: 'General Health Analysis' }),
      description: t('ai.prompts.general.desc', { defaultValue: 'Analyze my overall spending and savings habits for this period.' }),
      promptText: 'Provide a general financial health analysis focusing on savings rate, income vs expenses, and general habits.',
    },
    {
      id: 'anomalies',
      title: t('ai.prompts.anomalies.title', { defaultValue: 'Spot Anomalies' }),
      description: t('ai.prompts.anomalies.desc', { defaultValue: 'Detect any unusual spending patterns or out-of-ordinary expenses.' }),
      promptText: 'Analyze my spending data to spot any anomalies or unusually high expenses compared to typical patterns.',
    },
    {
      id: 'savings',
      title: t('ai.prompts.savings.title', { defaultValue: 'Savings Optimization' }),
      description: t('ai.prompts.savings.desc', { defaultValue: 'Get actionable tips on how to improve my savings rate based on my top expenses.' }),
      promptText: 'Provide actionable tips on how I can optimize my top spending categories to increase my savings rate.',
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800 shadow-sm text-center space-y-6">
        <div className="space-y-3">
          <div className="w-12 h-12 bg-amber-950/80 border border-amber-800/50 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">{t('ai.title') || 'AI Advisor'}</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {t('ai.subtitle') || 'Select a prompt to generate insights based on your financial data.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => fetchInsights(p.promptText)}
              disabled={loading}
              className="flex flex-col items-start p-4 bg-[#0f131a] hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-colors disabled:opacity-50 text-left"
            >
              <h4 className="text-sm font-semibold text-amber-400 mb-1">{p.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{p.description}</p>
              <div className="mt-auto flex items-center text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 mr-1.5" /> Ask AI
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
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
            <h4 className="text-sm font-bold text-slate-100">{t('ai.report_title')}</h4>
          </div>
          <div className="markdown-body text-xs text-slate-300 leading-relaxed space-y-3">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
