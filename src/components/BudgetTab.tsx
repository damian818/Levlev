import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, BudgetGoal, DisplayCurrency, InflationPoint, TransactionFilter } from '../types';
import { 
  analyzeSpending, 
  formatCurrency, 
  convertCurrency, 
  deriveBudgetsFromTransactions, 
  deriveSmartBudgets, 
  getLatestMonth, 
  getCurrentMonthKey, 
  getDefaultSelectedMonth,
  predictCategoryBudgetVelocity
} from '../utils/financeUtils';
import { 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  ExternalLink, 
  Tag, 
  Layers, 
  TrendingDown, 
  TrendingUp, 
  Wallet2, 
  Flame,
  Trash2,
  X
} from 'lucide-react';
import { CategoryTransactionsModal } from './CategoryTransactionsModal';
import { CircularBudgetGauge } from './CircularBudgetGauge';
import { BudgetOptimizationSuggestions } from './BudgetOptimizationSuggestions';

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
  const [draftLimits, setDraftLimits] = useState<Record<string, string>>({});
  const [inspectingCategory, setInspectingCategory] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState<string>('');

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

  // Sync budgetList when budgets prop changes or if empty, BUT only when not actively editing
  useEffect(() => {
    if (isEditing) return; // Prevent overwriting user's active inputs while editing
    if (budgets && budgets.length > 0) {
      setBudgetList(budgets);
    } else if (transactions.length > 0 && budgetList.length === 0) {
      const derived = deriveBudgetsFromTransactions(transactions, []);
      setBudgetList(derived);
      onUpdateBudgets(derived);
    }
  }, [budgets, transactions, isEditing]);

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

  // Available categories not yet in budget list
  const unbudgetedCategories = useMemo(() => {
    const budgetedSet = new Set(budgetList.map(b => b.category.toLowerCase()));
    const allCatSet = new Set<string>();
    transactions.forEach(t => {
      if (t.type === 'EXPENSE' && t.category) {
        allCatSet.add(t.category);
      }
    });
    return Array.from(allCatSet).filter(c => !budgetedSet.has(c.toLowerCase())).sort();
  }, [budgetList, transactions]);

  // Calculate overall totals based on active or draft values
  const totalBudgeted = useMemo(() => {
    return budgetList.reduce((sum, b) => {
      if (isEditing && draftLimits[b.category] !== undefined) {
        return sum + (parseFloat(draftLimits[b.category]) || 0);
      }
      return sum + convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
    }, 0);
  }, [budgetList, isEditing, draftLimits, displayCurrency, usdArsRate]);

  const totalSpentAcrossBudgets = useMemo(() => {
    return budgetList.reduce((sum, b) => {
      const spent = spending.topCategories.find(c => c.category === b.category)?.amount || 0;
      return sum + spent;
    }, 0);
  }, [budgetList, spending]);

  const totalRemaining = Math.max(totalBudgeted - totalSpentAcrossBudgets, 0);
  const overallPercentage = totalBudgeted > 0 ? (totalSpentAcrossBudgets / totalBudgeted) * 100 : 0;
  const isOverallOver = overallPercentage > 100;

  // Initialize draft values when entering edit mode
  const handleStartEdit = () => {
    const drafts: Record<string, string> = {};
    budgetList.forEach(b => {
      const limitConverted = convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
      drafts[b.category] = String(Math.round(limitConverted));
    });
    setDraftLimits(drafts);
    setIsEditing(true);
  };

  const handleDraftChange = (category: string, valueStr: string) => {
    setDraftLimits(prev => ({
      ...prev,
      [category]: valueStr,
    }));
  };

  const handleSave = () => {
    const updatedList: BudgetGoal[] = budgetList.map(b => {
      const rawDraft = draftLimits[b.category];
      const numVal = rawDraft !== undefined 
        ? (parseFloat(rawDraft) || 0) 
        : convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
      const limitARS = convertCurrency(numVal, displayCurrency, 'ARS', usdArsRate);
      return {
        ...b,
        monthlyLimitARS: limitARS,
      };
    });
    setBudgetList(updatedList);
    onUpdateBudgets(updatedList);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setBudgetList(budgets);
    setDraftLimits({});
    setIsEditing(false);
  };

  const handleDeleteGoal = (category: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBudgetList(prev => prev.filter(b => b.category !== category));
    setDraftLimits(prev => {
      const copy = { ...prev };
      delete copy[category];
      return copy;
    });
  };

  const handleAddCategoryGoal = () => {
    if (!addingCategory) return;
    const exists = budgetList.find(b => b.category.toLowerCase() === addingCategory.toLowerCase());
    if (!exists) {
      const newGoal: BudgetGoal = {
        category: addingCategory,
        monthlyLimitARS: convertCurrency(100, displayCurrency, 'ARS', usdArsRate),
      };
      setBudgetList(prev => [...prev, newGoal]);
      setDraftLimits(prev => ({
        ...prev,
        [addingCategory]: '100',
      }));
    }
    setAddingCategory('');
  };

  const handleAutoGenerate = () => {
    const derived = deriveBudgetsFromTransactions(transactions, []);
    setBudgetList(derived);
    const drafts: Record<string, string> = {};
    derived.forEach(b => {
      const limitConverted = convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
      drafts[b.category] = String(Math.round(limitConverted));
    });
    setDraftLimits(drafts);
    setIsEditing(true);
  };

  const handleSmartSuggest = () => {
    const derived = deriveSmartBudgets(transactions, budgetList, currentMonthKey, usdArsRate);
    setBudgetList(derived);
    const drafts: Record<string, string> = {};
    derived.forEach(b => {
      const limitConverted = convertCurrency(b.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
      drafts[b.category] = String(Math.round(limitConverted));
    });
    setDraftLimits(drafts);
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
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-amber-500/50 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                  Smart Suggest
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 bg-[#161d2b] hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('budget.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 border border-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer"
                >
                  {t('budget.save')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleStartEdit}
                  className="flex-1 sm:flex-none px-3.5 py-1.5 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 bg-[#161d2b] hover:bg-slate-800 transition-colors cursor-pointer"
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

          <div className="p-4 bg-[#111622] border border-slate-800/90 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('budget.status')}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${isOverallOver ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {isOverallOver ? t('budget.exceeded') : t('budget.on_track')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                {formatCurrency(totalRemaining, displayCurrency)} {t('budget.capacity_remaining')}
              </span>
            </div>

            <div className="shrink-0">
              <CircularBudgetGauge
                percentage={overallPercentage}
                size={52}
                strokeWidth={5}
                isOver={isOverallOver}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI 30-Day Spending Optimization Suggestions (With Hide & Dismiss capabilities) */}
      {transactions.length > 0 && (
        <BudgetOptimizationSuggestions
          transactions={transactions}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
        />
      )}

      {/* Add New Category Budget Goal in Edit Mode */}
      {isEditing && unbudgetedCategories.length > 0 && (
        <div className="p-3.5 bg-[#161d2b] border border-slate-700/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">{t('budget.add_category_budget')}</span>
          </div>

          <div className="flex items-center space-x-2 flex-1 max-w-sm">
            <select
              value={addingCategory}
              onChange={(e) => setAddingCategory(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[#111622] border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">{t('budget.select_category')}...</option>
              {unbudgetedCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              onClick={handleAddCategoryGoal}
              disabled={!addingCategory}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t('common.add') || 'Add'}
            </button>
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
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition-colors inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>{t('budget.generate')} (Basic)</span>
            </button>
            <button
              onClick={handleSmartSuggest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center space-x-2 shadow-sm cursor-pointer"
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
            
            // In edit mode, compute percentage using draft value
            const draftVal = draftLimits[budget.category];
            const activeLimitDisplay = isEditing && draftVal !== undefined
              ? (parseFloat(draftVal) || 0)
              : convertCurrency(budget.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);

            const percentage = activeLimitDisplay > 0 ? (categorySpent / activeLimitDisplay) * 100 : 0;
            const isOver = percentage > 100;
            const remainingCapacity = Math.max(activeLimitDisplay - categorySpent, 0);
            const txCount = categoryTransactionCounts[budget.category] || 0;

            // Velocity prediction helper calculation
            const velocityPred = predictCategoryBudgetVelocity(
              budget.category,
              activeLimitDisplay,
              transactions,
              displayCurrency,
              usdArsRate,
              selectedMonth
            );

            const showVelocityWarning = velocityPred.willExceed && !isOver && selectedMonth === currentMonthKey;

            return (
              <div 
                key={idx} 
                onClick={() => {
                  if (!isEditing) {
                    setInspectingCategory(budget.category);
                  }
                }}
                className={`p-5 rounded-2xl border transition-all duration-200 space-y-3.5 relative group bg-[#111622] border-slate-800/90 shadow-sm ${!isEditing ? 'hover:border-slate-700 hover:bg-[#141b2a] cursor-pointer' : ''}`}
                title={!isEditing ? (t('budget.click_to_inspect') || 'Click to view category transaction details') : undefined}
              >
                {/* Header Row: Category, Badges, Circular Gauge, Delete in Edit Mode */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start space-x-3">
                    {/* Circular Progress Gauge */}
                    <div className="shrink-0 mt-0.5">
                      <CircularBudgetGauge
                        percentage={percentage}
                        size={46}
                        strokeWidth={4.5}
                        isOver={isOver}
                      />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                          {budget.category}
                        </h4>
                        
                        {/* Subtle Pace Warning Icon */}
                        {showVelocityWarning && !isEditing && (
                          <div 
                            className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold cursor-help"
                            title={t('budget.velocity_warning', {
                              overrun: formatCurrency(velocityPred.projectedOverrun, displayCurrency),
                              percent: Math.round(velocityPred.projectedPercentage),
                              rate: formatCurrency(velocityPred.dailyVelocity, displayCurrency)
                            })}
                          >
                            <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                            <span>Pace Risk</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{txCount} {t('budget.tx_count_label', { count: txCount })}</span>
                        <span>•</span>
                        <span>{percentage.toFixed(0)}% {t('budget.capacity_utilized')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {isOver ? (
                      <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[10px] font-bold rounded-lg">{t('budget.over')}</span>
                    ) : showVelocityWarning ? (
                      <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 text-[10px] font-bold rounded-lg">{t('budget.warning')}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold rounded-lg">{t('budget.on_track')}</span>
                    )}

                    {/* Delete goal button in edit mode */}
                    {isEditing ? (
                      <button
                        onClick={(e) => handleDeleteGoal(budget.category, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-slate-700/60 hover:border-rose-800/50 transition-colors cursor-pointer ml-1"
                        title={t('budget.delete_budget_goal')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : onNavigateToTransactionsWithFilter ? (
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
                    ) : null}
                  </div>
                </div>

                {/* Spending Numbers */}
                <div className="flex justify-between items-baseline text-xs pt-1">
                  <span className="text-slate-400">
                    {t('budget.spent')}: <strong className="text-slate-100 font-mono">{formatCurrency(categorySpent, displayCurrency)}</strong>
                  </span>
                  {isEditing ? (
                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-400 font-medium">{t('budget.limit') || 'Limit'} ({displayCurrency}):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftLimits[budget.category] ?? ''}
                        onChange={(e) => handleDraftChange(budget.category, e.target.value)}
                        placeholder="0"
                        className="w-24 px-2 py-1 bg-[#161d2b] border border-slate-700 text-slate-100 rounded-lg text-xs text-right font-bold focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      {t('budget.limit') || 'Limit'}: <strong className="text-slate-100 font-mono">{formatCurrency(activeLimitDisplay, displayCurrency)}</strong>
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-rose-500' : showVelocityWarning ? 'bg-amber-500' : percentage > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Velocity Warning Banner (Subtle and informative) */}
                {showVelocityWarning && !isEditing && (
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200 flex items-start space-x-2">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">
                        {t('budget.velocity_forecast')}:
                      </span>{' '}
                      <span>
                        {t('budget.velocity_warning', {
                          overrun: formatCurrency(velocityPred.projectedOverrun, displayCurrency),
                          percent: Math.round(velocityPred.projectedPercentage),
                          rate: formatCurrency(velocityPred.dailyVelocity, displayCurrency)
                        })}
                      </span>
                      {velocityPred.exceedsByDay && (
                        <span className="block text-[10px] text-amber-400 font-medium mt-0.5">
                          {t('budget.velocity_breach_day', { day: velocityPred.exceedsByDay })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Row: Remaining capacity & Inspect link */}
                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
                  <span>
                    {t('budget.remaining')}: <strong className={`font-mono ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(remainingCapacity, displayCurrency)}</strong>
                  </span>

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
                    <span>{percentage.toFixed(1)}% {t('budget.capacity_utilized')}</span>
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
