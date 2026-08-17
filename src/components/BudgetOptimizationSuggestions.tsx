import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency } from '../types';
import { getTopSpendingCategoriesLast30Days, formatCurrency, RecentSpendingCategory } from '../utils/financeUtils';
import { Sparkles, RefreshCw, TrendingDown, CheckCircle2, ArrowRight, Lightbulb, ShieldAlert, Zap } from 'lucide-react';

interface BudgetOptimizationSuggestionsProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

interface SuggestionItem {
  category: string;
  suggestion: string;
  actionItem: string;
  potentialSavings: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface OptimizationResponse {
  suggestions: SuggestionItem[];
  overallTakeaway?: string;
  isFallback?: boolean;
}

export function BudgetOptimizationSuggestions({
  transactions,
  displayCurrency,
  usdArsRate,
}: BudgetOptimizationSuggestionsProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<OptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState<boolean>(false);

  // Derive top 5 spending categories in the last 30 days
  const recent30Days = React.useMemo(() => {
    return getTopSpendingCategoriesLast30Days(transactions, displayCurrency, usdArsRate, 5);
  }, [transactions, displayCurrency, usdArsRate]);

  const fetchSuggestions = async () => {
    if (recent30Days.categories.length === 0) return;
    setLoading(true);
    setError(null);
    setHasRequested(true);

    try {
      const response = await fetch('/api/ai-budget-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topCategories: recent30Days.categories,
          totalSpent30Days: recent30Days.totalSpent30Days,
          displayCurrency,
          language: i18n.language || 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const result: OptimizationResponse = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error fetching AI budget optimization:', err);
      // Fallback heuristics if request failed
      const fallback: OptimizationResponse = {
        suggestions: recent30Days.categories.map((c) => ({
          category: c.category,
          suggestion: `Top 30-day spend of ${formatCurrency(c.totalSpent, displayCurrency)} (${c.percentageOfTotal.toFixed(1)}% of total). Identify discretionary charges from ${c.topMerchants.map((m) => m.merchant).slice(0, 2).join(', ') || 'merchants'}.`,
          actionItem: `Target a 10% reduction in ${c.category} through bulk planning and subscription audit.`,
          potentialSavings: '10-15%',
          impact: c.percentageOfTotal > 30 ? 'HIGH' : c.percentageOfTotal > 15 ? 'MEDIUM' : 'LOW',
        })),
        overallTakeaway: 'Focusing on your top 2 spending categories yields the greatest budget flexibility.',
        isFallback: true,
      };
      setData(fallback);
    } finally {
      setLoading(false);
    }
  };

  if (recent30Days.categories.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#111622] rounded-2xl border border-slate-800/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-start sm:items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                {t('budget.ai_suggestions_title')}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-bold text-purple-300">
                Gemini 3.7
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {t('budget.ai_suggestions_subtitle')} ({formatCurrency(recent30Days.totalSpent30Days, displayCurrency)} {t('budget.last_30_days_total')})
            </p>
          </div>
        </div>

        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2 bg-purple-600/90 hover:bg-purple-600 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>
            {loading
              ? t('budget.analyzing_spending')
              : hasRequested
              ? t('budget.refresh_ai_suggestions')
              : t('budget.generate_ai_suggestions')}
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-5 space-y-4">
        {!hasRequested && !data ? (
          <div className="py-6 px-4 text-center rounded-xl bg-[#161d2b]/50 border border-slate-800/60 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 rounded-full bg-purple-500/10 text-purple-400">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                Analyze your top {recent30Days.categories.length} spending categories
              </h4>
              <p className="text-[11px] text-slate-400">
                Let Gemini examine your last 30 days of transactions (
                {recent30Days.categories.map((c) => c.category).join(', ')}) to generate tailored, actionable cost optimization strategies.
              </p>
            </div>
            <button
              onClick={fetchSuggestions}
              className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm inline-flex items-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('budget.generate_ai_suggestions')}</span>
            </button>
          </div>
        ) : loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="relative">
              <div className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
              <Sparkles className="w-4 h-4 text-purple-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-xs text-slate-300 font-medium">{t('budget.analyzing_spending')}</p>
            <p className="text-[10px] text-slate-500">Evaluating velocity, category distributions, and merchant spending</p>
          </div>
        ) : data?.suggestions && data.suggestions.length > 0 ? (
          <div className="space-y-3">
            {data.overallTakeaway && (
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-200 text-xs flex items-start space-x-2.5">
                <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-purple-300 mr-1">Summary Takeaway:</span>
                  <span>{data.overallTakeaway}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data.suggestions.map((item, idx) => {
                const categoryMeta = recent30Days.categories.find(
                  (c) => c.category.toLowerCase() === item.category.toLowerCase()
                );

                const impactColor =
                  item.impact === 'HIGH'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : item.impact === 'MEDIUM'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#161d2b] border border-slate-700/70 hover:border-slate-600 transition-colors flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-slate-100 block">
                            {item.category}
                          </span>
                          {categoryMeta && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatCurrency(categoryMeta.totalSpent, displayCurrency)} ({categoryMeta.percentageOfTotal.toFixed(1)}% of 30d spend)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {item.potentialSavings && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800/60 text-[10px] font-bold text-emerald-300">
                              {item.potentialSavings} {t('budget.potential_savings')}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase ${impactColor}`}>
                            {item.impact}
                          </span>
                        </div>
                      </div>

                      {/* Suggestion Text */}
                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {item.suggestion}
                      </p>
                    </div>

                    {/* Action Step */}
                    {item.actionItem && (
                      <div className="pt-2 border-t border-slate-700/60 flex items-start space-x-2 text-[11px] text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-200 font-semibold mr-1">{t('budget.action_plan')}:</strong>
                          <span className="text-slate-300">{item.actionItem}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
