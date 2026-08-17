import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, BudgetGoal, DisplayCurrency, InflationPoint, TransactionFilter } from '../types';
import { analyzeSpending, formatCurrency, convertCurrency, deriveBudgetsFromTransactions, deriveSmartBudgets, getLatestMonth, getCurrentMonthKey, getDefaultSelectedMonth } from '../utils/financeUtils';
import { Target, AlertTriangle, CheckCircle2, Plus, Calendar, RefreshCw, Sparkles, ChevronRight, ExternalLink, Tag, Layers, TrendingDown, Wallet2 } from 'lucide-react';
import { CategoryTransactionsModal } from './CategoryTransactionsModal';

interface BudgetTabProps {
  transactions: Transaction[];
  budgets: BudgetGoal[];
  onUpdateBudgets: (newBudgets: BudgetGoal[]) => void;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  onNavigateToTransactionsWithFilter?: (filter: TransactionFilter) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export function BudgetTab({
  transactions,
  budgets,
  onUpdateBudgets,
  displayCurrency,
  usdArsRate,
  historyData,
  onNavigateToTransactionsWithFilter,
  onEditTransaction,
}: BudgetTabProps) {
  const { t } = useTranslation();
  const [budgetList, setBudgetList] = useState<BudgetGoal[]>(budgets);
  const [isEditing, setIsEditing] = useState(false);
  const [inspectingCategory, setInspectingCategory] = useState<string | null>(null);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date) monthSet.add(tx.date.substring(0, 7));
    });
    monthSet.add(currentMonthKey);
    return Array.from(monthSet).sort().reverse();
  }, [transactions, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultSelectedMonth(transactions));

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth) && selectedMonth !== 'ALL') {
      setSelectedMonth(getDefaultSelectedMonth(transactions));
    }
  }, [availableMonths]);

  // Sync budgetList when budgets prop changes or if empty
  useEffect(() => {
    if (budgets && budgets.length > 0) {
      setBudgetList(budgets);
    } else if (transactions.length > 0) {
      const derived = deriveBudgetsFromTransactions(transactions, []);
      setBudgetList(derived);
      onUpdateBudgets(derived);
    }
  }, [budgets, transactions]);

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate, selectedMonth);

  // Map transaction counts per category for the selected month
  const categoryTransactionCounts = useMemo(() => {
    const countMap: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.type !== 'EXPENSE') return;
      if (selectedMonth !== 'ALL' && (!tx.date || !tx.date.startsWith(selectedMonth))) return;
      if (tx.category) {
        countMap[tx.category] = (countMap[tx.category] || 0) + 1;
      }
    });
    return countMap;
  }, [transactions, selectedMonth]);

  // Calculate overall totals
  const totalBudgeted = useMemo(() => {
    return budgetList.reduce((sum, b) => {
      return sum + convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
    }, 0);
  }, [budgetList, displayCurrency, usdArsRate]);

  const totalSpentAcrossBudgets = useMemo(() => {
    return budgetList.reduce((sum, b) => {
      const spent = spending.topCategories.find(c => c.category === b.category)?.amount || 0;
      return sum + spent;
    }, 0);
  }, [budgetList, spending]);

  const totalRemaining = Math.max(totalBudgeted - totalSpentAcrossBudgets, 0);
  const overallPercentage = totalBudgeted > 0 ? (totalSpentAcrossBudgets / totalBudgeted) * 100 : 0;
  const isOverallOver = overallPercentage > 100;

  const handleLimitChange = (category: string, newLimitDisplay: number) => {
    // Convert the display currency input back to ARS for storage
    const limitARS = convertCurrency(newLimitDisplay, displayCurrency, 'ARS', usdArsRate);
    setBudgetList(prev => prev.map(b => b.category === category ? { ...b, monthlyLimitARS: limitARS } : b));
  };

  const handleSave = () => {
    onUpdateBudgets(budgetList);
    setIsEditing(false);
  };

  const handleAutoGenerate = () => {
    const derived = deriveBudgetsFromTransactions(transactions, []);
    setBudgetList(derived);
    onUpdateBudgets(derived);
  };

  const handleSmartSuggest = () => {
    const derived = deriveSmartBudgets(transactions, budgetList, currentMonthKey, usdArsRate);
    setBudgetList(derived);
    onUpdateBudgets(derived); // Auto-save when suggesting
    setIsEditing(true);
  };

  const activeInspectingGoal = inspectingCategory 
    ? budgetList.find(b => b.category === inspectingCategory)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <span>{t('budget.monthly_goals')}</span>
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t('budget.control_spending')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Month Selector */}
          <div className="flex items-center space-x-2 bg-[#161d2b] px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs flex-1 sm:flex-none justify-center sm:justify-start">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none py-0 text-xs text-slate-100 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#161d2b] text-slate-100">{t('budget.all_time')}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-[#161d2b] text-slate-100">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 sm:flex-none">
            {isEditing ? (
              <div className="flex space-x-2">
                <button
                  onClick={handleSmartSuggest}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-amber-500/50 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                  Smart Suggest
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 bg-[#161d2b] hover:bg-slate-800 transition-colors"
                >
                  {t('budget.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 border border-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  {t('budget.save')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 sm:flex-none px-3.5 py-1.5 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 bg-[#161d2b] hover:bg-slate-800 transition-colors"
                >
                  {t('budget.configure')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Budget Summary KPIs */}
      {budgetList.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#111622] border border-slate-800/90 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('budget.total_budgeted')}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-100 mt-1 block font-mono">
              {formatCurrency(totalBudgeted, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Across {budgetList.length} categories
            </span>
          </div>

          <div className="p-4 bg-[#111622] border border-slate-800/90 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('budget.spent')} ({selectedMonth === 'ALL' ? t('budget.all_time') : selectedMonth})
            </span>
            <span className="text-lg sm:text-xl font-black text-rose-400 mt-1 block font-mono">
              {formatCurrency(totalSpentAcrossBudgets, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {overallPercentage.toFixed(1)}% {t('budget.used')}
            </span>
          </div>

          <div className="p-4 bg-[#111622] border border-slate-800/90 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('budget.remaining')}
            </span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 mt-1 block font-mono">
              {formatCurrency(totalRemaining, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isOverallOver ? t('budget.over') : t('budget.on_track')}
            </span>
          </div>

          <div className="p-4 bg-[#111622] border border-slate-800/90 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('budget.status')}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverallOver ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {isOverallOver ? t('budget.exceeded') : t('budget.on_track')}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverallOver ? 'bg-rose-500' : overallPercentage > 85 ? 'bg-amber-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(overallPercentage, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block">
              {overallPercentage.toFixed(1)}% of total allocated budget
            </span>
          </div>
        </div>
      )}

      {budgetList.length === 0 ? (
        <div className="bg-[#111622] p-8 rounded-2xl border border-slate-800 text-center space-y-4">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-slate-100">{t('budget.no_goals_title')}</h4>
            <p className="text-xs text-slate-400">
              {t('budget.no_goals_desc')}
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={handleAutoGenerate}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition-colors inline-flex items-center space-x-2"
            >
              <span>{t('budget.generate')} (Basic)</span>
            </button>
            <button
              onClick={handleSmartSuggest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center space-x-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Smart Suggest Targets</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetList.map((budget, idx) => {
            const categorySpent = spending.topCategories.find(c => c.category === budget.category)?.amount || 0;
            const limitConverted = convertCurrency(budget.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
            const percentage = limitConverted > 0 ? (categorySpent / limitConverted) * 100 : 0;
            const isOver = percentage > 100;
            const txCount = categoryTransactionCounts[budget.category] || 0;

            return (
              <div 
                key={idx} 
                onClick={() => {
                  if (!isEditing) {
                    setInspectingCategory(budget.category);
                  }
                }}
                className={`p-5 rounded-2xl border transition-all duration-200 space-y-3 relative group bg-[#111622] border-slate-800/90 shadow-sm ${!isEditing ? 'hover:border-slate-700 hover:bg-[#141b2a] cursor-pointer' : ''}`}
                title={!isEditing ? (t('budget.click_to_inspect') || 'Click to view category transaction details') : undefined}
              >
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl border ${isOver ? 'bg-rose-950/80 border-rose-800/50 text-rose-400' : 'bg-[#182133] border-slate-700/80 text-emerald-400'}`}>
                      {isOver ? <AlertTriangle className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {budget.category}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {txCount} {t('budget.tx_count_label', { count: txCount })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isOver ? (
                      <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[10px] font-bold rounded-lg">{t('budget.over')}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold rounded-lg">{t('budget.on_track')}</span>
                    )}

                    {onNavigateToTransactionsWithFilter && !isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToTransactionsWithFilter({
                            category: budget.category,
                            month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
                            type: 'EXPENSE',
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors"
                        title={t('budget.open_in_transactions') || 'Open in Transactions Tab'}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Spending Numbers */}
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400">
                    {t('budget.spent')} ({selectedMonth === 'ALL' ? t('budget.all_time') : selectedMonth}): <strong className="text-slate-100 font-mono">{formatCurrency(categorySpent, displayCurrency)}</strong>
                  </span>
                  {isEditing ? (
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-400">{t('budget.limit') || 'Limit'} ({displayCurrency}):</span>
                      <input
                        type="number"
                        value={Math.round(limitConverted)}
                        onChange={(e) => handleLimitChange(budget.category, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-[#161d2b] border border-slate-700 text-slate-100 rounded-lg text-xs text-right font-semibold focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      {t('budget.limit') || 'Limit'}: <strong className="text-slate-100 font-mono">{formatCurrency(limitConverted, displayCurrency)}</strong>
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-rose-500' : percentage > 85 ? 'bg-amber-500' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Bottom Row with remaining & quick view transactions link */}
                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                  <span>{percentage.toFixed(1)}% {t('budget.used')}</span>

                  {!isEditing ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingCategory(budget.category);
                      }}
                      className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      <span>{t('budget.inspect_details') || 'Inspect Transactions'}</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : (
                    <span>{t('budget.remaining')}: {formatCurrency(Math.max(limitConverted - categorySpent, 0), displayCurrency)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Transactions Modal */}
      {inspectingCategory && (
        <CategoryTransactionsModal
          isOpen={Boolean(inspectingCategory)}
          onClose={() => setInspectingCategory(null)}
          category={inspectingCategory}
          initialMonth={selectedMonth}
          transactions={transactions}
          budgetGoal={activeInspectingGoal}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
          historyData={historyData}
          onNavigateToTransactionsWithFilter={onNavigateToTransactionsWithFilter}
          onEditTransaction={onEditTransaction}
        />
      )}
    </div>
  );
}

