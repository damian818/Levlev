import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Transaction, 
  RecurringRule, 
  DisplayCurrency, 
  IdentifiedRecurringItem, 
  InflationPoint, 
  RecurringOccurrence,
  AccountItem,
  CategoryItem
} from '../types';
import { 
  formatCurrency, 
  formatCurrencyCompact, 
  convertCurrency, 
  detectRecurringItems, 
  detectInstallmentPlans, 
  computeFutureRecurringProjections,
  getEffectiveRecurringItems
} from '../utils/financeUtils';
import { RecurringTrendModal } from './RecurringTrendModal';
import { RecurringCategoryTrendModal } from './RecurringCategoryTrendModal';
import { RecurringRuleModal } from './RecurringRuleModal';
import { 
  Repeat, 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  TrendingUp, 
  Sparkles, 
  ChevronRight, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  BarChart2, 
  Ban, 
  RotateCcw, 
  LineChart, 
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area } from 'recharts';
import { EmptyState } from './EmptyState';

interface RecurringTabProps {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  onSaveRecurringRule?: (rule: RecurringRule) => void;
  onDeleteRecurringRule?: (ruleId: string) => void;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  accountsList?: AccountItem[];
  categoriesList?: CategoryItem[];
  nonRecurringKeys?: string[];
  onUpdateNonRecurringKeys?: (keys: string[]) => void;
}

export function RecurringTab({ 
  transactions, 
  recurringRules = [], 
  onSaveRecurringRule,
  onDeleteRecurringRule,
  displayCurrency, 
  usdArsRate, 
  historyData,
  accountsList = [],
  categoriesList = [],
  nonRecurringKeys: controlledNonRecurringKeys,
  onUpdateNonRecurringKeys
}: RecurringTabProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MANUAL' | 'EXPENSE' | 'INCOME' | 'INSTALLMENT' | 'NON_RECURRING'>('ALL');
  const [selectedItem, setSelectedItem] = useState<IdentifiedRecurringItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showCompletedInstallments, setShowCompletedInstallments] = useState(false);
  const [installmentsSort, setInstallmentsSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showProjection, setShowProjection] = useState(true);

  // Manual Rule modal state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Non-recurring exclusions state
  const [internalNonRecurringKeys, setInternalNonRecurringKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('levlev_non_recurring_keys');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const nonRecurringKeys = controlledNonRecurringKeys || internalNonRecurringKeys;

  const handleMarkNonRecurring = (item: IdentifiedRecurringItem) => {
    const key = item.title.toLowerCase().trim();
    if (nonRecurringKeys.includes(key)) return;
    const next = [...nonRecurringKeys, key];
    if (onUpdateNonRecurringKeys) {
      onUpdateNonRecurringKeys(next);
    } else {
      setInternalNonRecurringKeys(next);
      localStorage.setItem('levlev_non_recurring_keys', JSON.stringify(next));
    }
  };

  const handleRestoreRecurring = (keyToRestore: string) => {
    const next = nonRecurringKeys.filter(k => k !== keyToRestore);
    if (onUpdateNonRecurringKeys) {
      onUpdateNonRecurringKeys(next);
    } else {
      setInternalNonRecurringKeys(next);
      localStorage.setItem('levlev_non_recurring_keys', JSON.stringify(next));
    }
  };

  const handleOpenAddRule = () => {
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: RecurringRule) => {
    setEditingRule(rule);
    setIsRuleModalOpen(true);
  };

  const handleToggleRuleActive = (rule: RecurringRule) => {
    if (!onSaveRecurringRule) return;
    const updated: RecurringRule = {
      ...rule,
      isActive: rule.isActive === false ? true : false,
      updatedAt: new Date().toISOString(),
    };
    onSaveRecurringRule(updated);
  };

  const handleInstallmentsSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (installmentsSort && installmentsSort.key === key && installmentsSort.direction === 'asc') {
      direction = 'desc';
    }
    setInstallmentsSort({ key, direction });
  };

  // Auto-detect strict recurring items (consolidated across accounts)
  const regularRecurring = useMemo(() => {
    const rawItems = detectRecurringItems(transactions, displayCurrency, usdArsRate);
    
    const consolidatedMap = new Map<string, IdentifiedRecurringItem[]>();
    
    rawItems.forEach(item => {
      const nameKey = item.cleanTitle.toLowerCase().trim();
      if (!consolidatedMap.has(nameKey)) {
        consolidatedMap.set(nameKey, []);
      }
      consolidatedMap.get(nameKey)!.push(item);
    });
    
    const result: IdentifiedRecurringItem[] = [];
    
    consolidatedMap.forEach((items, nameKey) => {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        const hasIncome = items.some(i => i.type === 'INCOME');
        const hasExpense = items.some(i => i.type === 'EXPENSE');

        if (!hasIncome || !hasExpense) {
          result.push(...items);
          return;
        }

        let allHistory: (RecurringOccurrence & { originalType: 'INCOME' | 'EXPENSE' })[] = [];
        items.forEach(it => {
          allHistory = allHistory.concat(it.history.map(h => ({ ...h, originalType: it.type })));
        });
        
        allHistory.sort((a, b) => a.date.localeCompare(b.date));
        
        const monthMap = new Map<string, { amountDisplay: number, count: number, maxAccount: string, incomeAmountDisplay: number, expenseAmountDisplay: number }>();
        const accountCounts = new Map<string, number>();
        
        allHistory.forEach(h => {
           const amt = convertCurrency(h.amount, h.currency as DisplayCurrency, displayCurrency, usdArsRate, h.date, transactions);
           const m = h.month;
           if (!monthMap.has(m)) monthMap.set(m, { amountDisplay: 0, count: 0, maxAccount: h.account, incomeAmountDisplay: 0, expenseAmountDisplay: 0 });
           
           const data = monthMap.get(m)!;
           if (h.originalType === 'INCOME') {
              data.amountDisplay -= amt; 
              data.incomeAmountDisplay += amt;
           } else {
              data.amountDisplay += amt;
              data.expenseAmountDisplay += amt;
           }
           data.count++;
           
           accountCounts.set(h.account, (accountCounts.get(h.account) || 0) + 1);
        });
        
        const totalNetDisplay = Array.from(monthMap.values()).reduce((sum, data) => sum + data.amountDisplay, 0);
        const finalType = totalNetDisplay > 0 ? 'EXPENSE' : 'INCOME';
        
        let maxAccCount = 0;
        let mainAcc = items[0].account;
        accountCounts.forEach((c, a) => {
          if (c > maxAccCount) {
             maxAccCount = c;
             mainAcc = a;
          }
        });
        
        const monthlyTrend = Array.from(monthMap.entries()).map(([month, data]) => ({
          month,
          amount: Math.abs(data.amountDisplay),
          amountDisplay: Math.abs(data.amountDisplay),
          incomeAmountDisplay: data.incomeAmountDisplay,
          expenseAmountDisplay: data.expenseAmountDisplay,
          currency: displayCurrency,
          account: data.maxAccount
        })).sort((a, b) => a.month.localeCompare(b.month));
        
        const distinctMonthsCount = monthMap.size;
        const latestMonthData = monthlyTrend[monthlyTrend.length - 1];
        const avgAmount = monthlyTrend.reduce((s, m) => s + m.amountDisplay, 0) / (monthlyTrend.length || 1);
        
        result.push({
          id: items[0].id + '-consolidated',
          title: items[0].title,
          cleanTitle: items[0].cleanTitle,
          category: items[0].category,
          type: finalType,
          account: mainAcc,
          currency: displayCurrency,
          latestAmount: latestMonthData ? latestMonthData.amountDisplay : 0,
          avgAmount: avgAmount,
          minAmount: Math.min(...monthlyTrend.map(m => m.amountDisplay)),
          maxAmount: Math.max(...monthlyTrend.map(m => m.amountDisplay)),
          dayOfMonth: items[0].dayOfMonth,
          occurrencesCount: allHistory.length,
          distinctMonthsCount,
          isInstallment: false,
          history: allHistory.map(h => ({
             ...h,
             amount: convertCurrency(h.amount, h.currency as DisplayCurrency, displayCurrency, usdArsRate, h.date, transactions),
             currency: displayCurrency
          })),
          monthlyTrend
        });
      }
    });

    return result.sort((a, b) => {
      const bConv = convertCurrency(b.latestAmount, b.currency as DisplayCurrency, displayCurrency, usdArsRate);
      const aConv = convertCurrency(a.latestAmount, a.currency as DisplayCurrency, displayCurrency, usdArsRate);
      return bConv - aConv || a.title.localeCompare(b.title);
    });
  }, [transactions, displayCurrency, usdArsRate]);

  // Separate credit card installment plans (cuotas)
  const { activeInstallmentPlans, completedInstallmentPlans, installmentPlans } = useMemo(() => {
    const plans = detectInstallmentPlans(transactions, displayCurrency, usdArsRate);
    const currentMonth = new Date().toISOString().substring(0, 7);
    const active = plans.filter(p => {
       if (!p.installmentEndDate) return p.installmentCurrent === undefined || p.installmentTotal === undefined || p.installmentCurrent < p.installmentTotal;
       return p.installmentEndDate >= currentMonth;
    });
    const completed = plans.filter(p => {
       if (!p.installmentEndDate) return p.installmentCurrent !== undefined && p.installmentTotal !== undefined && p.installmentCurrent >= p.installmentTotal;
       return p.installmentEndDate < currentMonth;
    });
    return { activeInstallmentPlans: active, completedInstallmentPlans: completed, installmentPlans: plans };
  }, [transactions, displayCurrency, usdArsRate]);

  // Active (non-excluded) regular recurring items
  const activeRegularRecurring = useMemo(() => {
    return regularRecurring.filter(item => !nonRecurringKeys.includes(item.title.toLowerCase().trim()));
  }, [regularRecurring, nonRecurringKeys]);

  // Excluded (marked non-recurring) items
  const excludedRecurringItems = useMemo(() => {
    return regularRecurring.filter(item => nonRecurringKeys.includes(item.title.toLowerCase().trim()));
  }, [regularRecurring, nonRecurringKeys]);

  // Filter items based on search and type filter
  const filteredItems = useMemo(() => {
    if (typeFilter === 'NON_RECURRING') {
      return excludedRecurringItems.filter(item => {
        return searchTerm === '' || 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.account.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    const listToFilter = typeFilter === 'INSTALLMENT' 
      ? installmentPlans 
      : typeFilter === 'ALL' 
        ? activeRegularRecurring 
        : activeRegularRecurring.filter(item => item.type === typeFilter);

    return listToFilter
      .filter(item => {
        const matchSearch = searchTerm === '' || 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.account.toLowerCase().includes(searchTerm.toLowerCase());

        return matchSearch;
      })
      .sort((a, b) => {
        const bConv = convertCurrency(b.latestAmount, b.currency, displayCurrency, usdArsRate);
        const aConv = convertCurrency(a.latestAmount, a.currency, displayCurrency, usdArsRate);
        return bConv - aConv;
      });
  }, [activeRegularRecurring, excludedRecurringItems, installmentPlans, searchTerm, typeFilter, displayCurrency, usdArsRate]);

  const handleCardClick = (item: IdentifiedRecurringItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Monthly commitments sum
  const totalMonthlyExpense = useMemo(() => {
    let sum = 0;
    // From manual rules
    recurringRules.forEach(r => {
      if (r.isActive !== false && r.type === 'EXPENSE') {
        sum += convertCurrency(r.amount, r.currency, displayCurrency, usdArsRate);
      }
    });
    // From regular recurring not duplicated by manual rule
    regularRecurring
      .filter(i => i.type === 'EXPENSE' && !nonRecurringKeys.includes(i.title.toLowerCase().trim()))
      .forEach(item => {
        const hasManual = recurringRules.some(r => r.title.toLowerCase() === item.title.toLowerCase());
        if (!hasManual) {
          const latestMonth = item.monthlyTrend[item.monthlyTrend.length - 1]?.month;
          if (latestMonth) {
            const latestMonthAmount = item.history
              .filter(h => h.month === latestMonth)
              .reduce((s, h) => s + convertCurrency(h.amount, h.currency, displayCurrency, usdArsRate, h.date, transactions), 0);
            sum += latestMonthAmount;
          }
        }
      });
    return sum;
  }, [regularRecurring, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate, transactions]);

  const totalMonthlyIncome = useMemo(() => {
    let sum = 0;
    recurringRules.forEach(r => {
      if (r.isActive !== false && r.type === 'INCOME') {
        sum += convertCurrency(r.amount, r.currency, displayCurrency, usdArsRate);
      }
    });
    regularRecurring
      .filter(i => i.type === 'INCOME' && !nonRecurringKeys.includes(i.title.toLowerCase().trim()))
      .forEach(item => {
        const hasManual = recurringRules.some(r => r.title.toLowerCase() === item.title.toLowerCase());
        if (!hasManual) {
          const latestMonth = item.monthlyTrend[item.monthlyTrend.length - 1]?.month;
          if (latestMonth) {
            const latestMonthAmount = item.history
              .filter(h => h.month === latestMonth)
              .reduce((s, h) => s + convertCurrency(h.amount, h.currency, displayCurrency, usdArsRate, h.date, transactions), 0);
            sum += latestMonthAmount;
          }
        }
      });
    return sum;
  }, [regularRecurring, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate, transactions]);

  const { sortedActiveInstallmentPlans, sortedCompletedInstallmentPlans } = useMemo(() => {
    const sortFn = (a: IdentifiedRecurringItem, b: IdentifiedRecurringItem) => {
      if (!installmentsSort) return 0;
      const { key, direction } = installmentsSort;
      let aVal: any = a[key as keyof IdentifiedRecurringItem];
      let bVal: any = b[key as keyof IdentifiedRecurringItem];

      if (key === 'amount') {
        aVal = convertCurrency(a.latestAmount, a.currency, displayCurrency, usdArsRate);
        bVal = convertCurrency(b.latestAmount, b.currency, displayCurrency, usdArsRate);
      } else if (key === 'period') {
        aVal = a.installmentEndDate || '';
        bVal = b.installmentEndDate || '';
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    };

    return {
      sortedActiveInstallmentPlans: [...activeInstallmentPlans].sort(sortFn),
      sortedCompletedInstallmentPlans: [...completedInstallmentPlans].sort(sortFn),
    };
  }, [activeInstallmentPlans, completedInstallmentPlans, installmentsSort, displayCurrency, usdArsRate]);

  const getCurrentInstallmentDisplay = (plan: IdentifiedRecurringItem) => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const tx = plan.history.find(h => h.month === currentMonth);
    if (tx && tx.installments) return tx.installments;
    return plan.installmentInfo || 'Cuotas';
  };

  return (
    <div id="recurring-tab-container" className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white dark:bg-[#161b22] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{t('recurring.title') || 'Recurring Cashflow & Subscriptions'}</span>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                  {regularRecurring.length + recurringRules.length} {t('recurring.identified') || 'rules & active items'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('recurring.sub_salary_cuotas') || 'Automatic pattern detection + customizable manual recurring rules for salary, rent & bills.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {/* New Manual Rule Button */}
            <button
              id="add-manual-recurring-btn"
              onClick={handleOpenAddRule}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs hover:shadow-md transition-all font-semibold text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('recurring.new_rule') || 'Add Recurring Item'}</span>
            </button>

            <button
              id="open-recurring-categories-btn"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors font-semibold text-xs"
            >
              <BarChart2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('recurring.category_trends') || 'Category Trends'}</span>
            </button>

            <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-50 dark:bg-[#121620] p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-medium">{t('recurring.monthly_commitments') || 'Bills / Mo'}</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                  {formatCurrencyCompact(totalMonthlyExpense, displayCurrency)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-medium">{t('recurring.avg_income') || 'Income / Mo'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {formatCurrencyCompact(totalMonthlyIncome, displayCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="recurring-search-input"
              placeholder={`${t('common.search') || 'Search recurring'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#0f131a] border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {(['ALL', 'MANUAL', 'EXPENSE', 'INCOME', 'INSTALLMENT', 'NON_RECURRING'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTypeFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${
                  typeFilter === mode
                    ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#121620] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'ALL' && (t('common.all') || 'All')}
                {mode === 'MANUAL' && `Manual Rules (${recurringRules.length})`}
                {mode === 'EXPENSE' && (t('recurring.expenses') || 'Expenses')}
                {mode === 'INCOME' && (t('common.income') || 'Income')}
                {mode === 'INSTALLMENT' && (t('recurring.cuotas') || 'Cuotas')}
                {mode === 'NON_RECURRING' && (
                  <>
                    <Ban className="w-3 h-3 text-rose-500" />
                    <span>{t('recurring.excluded') || 'Excluded'} ({excludedRecurringItems.length})</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Recurring Rules Section (Editable & Synced) */}
      {(typeFilter === 'ALL' || typeFilter === 'MANUAL') && (
        <div id="manual-recurring-rules-section" className="bg-white dark:bg-[#161b22] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Manual Recurring Setup & Incomes</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold font-mono">
                    {recurringRules.length} rules
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fixed income/expenses (e.g. monthly salary, rent). Changes adjust all future occurrences across Calendar, Overview, & Reports automatically.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenAddRule}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('recurring.new_rule') || 'Add Rule'}</span>
            </button>
          </div>

          {recurringRules.length === 0 ? (
            <div className="p-6 bg-slate-50 dark:bg-[#121620] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
              <Repeat className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No manual recurring rules configured yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Add your salary, rent, regular subscriptions or insurance to project expected future cashflows effortlessly.
              </p>
              <button
                onClick={handleOpenAddRule}
                className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Recurring Rule</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recurringRules.map((rule) => {
                const isIncome = rule.type === 'INCOME';
                const converted = convertCurrency(rule.amount, rule.currency, displayCurrency, usdArsRate);
                const isActive = rule.isActive !== false;

                return (
                  <div
                    key={rule.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      isActive 
                        ? 'bg-slate-50/70 dark:bg-[#121620] border-slate-200 dark:border-slate-800 hover:border-indigo-400/50 shadow-2xs'
                        : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-65'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isIncome
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}>
                            {isIncome ? 'INCOME' : 'EXPENSE'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Day {rule.dayOfMonth || 1}
                          </span>
                          {!isActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold">
                              PAUSED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRule(rule)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Setup (Adjust all future occurrences)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteRecurringRule && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete rule "${rule.title}"?`)) {
                                  onDeleteRecurringRule(rule.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {rule.title}
                        </h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {rule.category} • {rule.account}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-baseline justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(rule.amount, rule.currency as DisplayCurrency)} {rule.currency}
                        </span>
                        <span className={`text-xs font-mono font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(converted, displayCurrency)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px] border-t border-slate-200/50 dark:border-slate-800/50">
                      <button
                        type="button"
                        onClick={() => handleToggleRuleActive(rule)}
                        className={`font-semibold hover:underline flex items-center gap-1 ${
                          isActive ? 'text-slate-500 dark:text-slate-400' : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isActive ? 'Pause Estimates' : 'Enable Estimates'}
                      </button>
                      <span className="text-slate-400 italic">
                        {rule.frequency || 'Monthly'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Future Projection Section */}
      <div className="bg-white dark:bg-[#161b22] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('recurring.projection_title') || '12-Month Recurring Projections'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('recurring.projection_desc') || 'Dynamic forecast incorporating active manual rules, recurring commitments, and expiring installment plans.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowProjection(!showProjection)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
          >
            {showProjection ? (t('recurring.hide_projection') || 'Hide Projection') : (t('recurring.show_projection') || 'Show Projection')}
          </button>
        </div>

        {showProjection && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={computeFutureRecurringProjections(transactions, displayCurrency, usdArsRate, 12, recurringRules, nonRecurringKeys)} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#8b949e" 
                    fontSize={10} 
                    tickFormatter={(val) => {
                      const [y, m] = val.split('-');
                      const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return `${monthsNames[parseInt(m)-1]} ${y.substring(2)}`;
                    }}
                  />
                  <YAxis stroke="#8b949e" fontSize={10} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-slate-900 dark:text-slate-200">{label}</p>
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                                <span>{entry.name}:</span>
                                <span className="font-bold">{formatCurrency(entry.value, displayCurrency)}</span>
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar dataKey="expense" name={t('recurring.proj_expense') || 'Projected Expenses'} fill="#fb7185" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="income" name={t('recurring.proj_income') || 'Projected Income'} fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
                  <Area type="monotone" dataKey="net" name={t('recurring.net_forecast') || 'Net Cashflow'} fill="#38bdf8" stroke="#38bdf8" fillOpacity={0.1} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.avg_bill') || 'Recurring Bills / Mo'}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-200 mt-1 font-mono">{formatCurrency(totalMonthlyExpense, displayCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.avg_income') || 'Recurring Income / Mo'}</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{formatCurrency(totalMonthlyIncome, displayCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.active_plans') || 'Active Cuota Plans'}</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">{activeInstallmentPlans.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.commitment_12m') || '12M Projected Bills'}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-200 mt-1 font-mono">{formatCurrency(totalMonthlyExpense * 12, displayCurrency)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid of Auto-Detected Recurring Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between px-1">
          <span>{typeFilter === 'NON_RECURRING' ? (t('recurring.excluded_non_recurring') || 'Excluded Items') : (t('recurring.recurring_items') || 'Detected Recurring Subscriptions & Bills')} ({filteredItems.length})</span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">{t('recurring.click_details') || 'Click any card to analyze trend history'}</span>
        </h4>

        {filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-[#161b22] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Repeat className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {typeFilter === 'NON_RECURRING' ? (t('recurring.no_excluded') || 'No items excluded') : (t('recurring.no_matches') || 'No items match filter')}
            </p>
            <p className="text-xs text-slate-500">
              {typeFilter === 'NON_RECURRING' ? (t('recurring.exclude_instructions') || 'Mark auto-detected items as non-recurring to exclude them from calculations.') : (t('recurring.clear_search') || 'Try adjusting your search criteria.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const latestDate = item.history.length > 0 ? item.history[item.history.length - 1].date : undefined;
              const latestConverted = convertCurrency(item.latestAmount, item.currency, displayCurrency, usdArsRate, latestDate, transactions);
              const isIncome = item.type === 'INCOME';
              const isExcluded = nonRecurringKeys.includes(item.title.toLowerCase().trim());

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#121620] space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-xs hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                          isIncome 
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300'
                        }`}>
                          {isIncome ? (t('common.income') || 'Income') : (t('common.expense') || 'Expense')}
                        </span>
                        {item.isInstallment && (
                          <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-[10px] font-semibold rounded font-mono">
                            {item.installmentInfo || (t('recurring.cuotas') || 'Cuotas')}
                          </span>
                        )}
                        {isExcluded && (
                          <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-[9px] font-bold rounded">
                            {t('recurring.non_recurring') || 'Non-recurring'}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center font-medium">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400" /> ~Day {item.dayOfMonth}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                        <span className="truncate pr-2">{item.title}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.category} • <span className="text-slate-700 dark:text-slate-300 font-medium">{item.account}</span>
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">{t('recurring.latest_charge') || 'Latest Charge'}:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(latestConverted, displayCurrency)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{t('recurring.native') || 'Native'}: {formatCurrency(item.latestAmount, item.currency as DisplayCurrency)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-0.5 group-hover:underline">
                          <TrendingUp className="w-3 h-3" />
                          <span>{t('recurring.view_trend') || 'Trend'} ({item.distinctMonthsCount} mos)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    {isExcluded ? (
                      <button
                        onClick={() => handleRestoreRecurring(item.title.toLowerCase().trim())}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title={t('recurring.restore') || 'Restore recurring'}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('recurring.restore') || 'Include in Forecasts'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkNonRecurring(item)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title={t('recurring.mark_non_recurring') || 'Mark non-recurring'}
                      >
                        <Ban className="w-3 h-3" />
                        <span>{t('recurring.mark_non_recurring') || 'Exclude from Forecasts'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Credit Card Installments Detailed Section */}
      <div className="bg-white dark:bg-[#161b22] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('recurring.plans_title') || 'Credit Card Cuotas Plans'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('recurring.plans_desc') || 'Automatic detection of multi-month installment schedules and payoff months.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCompletedInstallments(!showCompletedInstallments)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
          >
            {showCompletedInstallments ? (t('recurring.hide_completed') || 'Hide Completed') : (t('recurring.show_completed') || 'Show Completed')}
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#121620]">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead className="bg-slate-100 dark:bg-[#161b22] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('title')}>
                  {t('recurring.merchant_item') || 'Item / Merchant'} {installmentsSort?.key === 'title' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('category')}>
                  {t('common.category') || 'Category'} {installmentsSort?.key === 'category' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('account')}>
                  {t('recurring.card_account') || 'Account'} {installmentsSort?.key === 'account' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('installmentCurrent')}>
                  {t('recurring.current_installment') || 'Cuota Status'} {installmentsSort?.key === 'installmentCurrent' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('period')}>
                  {t('recurring.period_start_end') || 'Period'} {installmentsSort?.key === 'period' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200" onClick={() => handleInstallmentsSort('amount')}>
                  {t('recurring.latest_amount') || 'Amount'} ({displayCurrency}) {installmentsSort?.key === 'amount' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center">{t('common.action') || 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {sortedActiveInstallmentPlans.length === 0 && (!showCompletedInstallments || sortedCompletedInstallmentPlans.length === 0) ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">{t('recurring.no_plans') || 'No installment plans detected.'}</td>
                </tr>
              ) : (
                <>
                  {sortedActiveInstallmentPlans.map((plan) => {
                    const converted = convertCurrency(plan.latestAmount, plan.currency, displayCurrency, usdArsRate);
                    return (
                      <tr
                        key={plan.id}
                        onClick={() => handleCardClick(plan)}
                        className="hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {plan.title}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{plan.category}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{plan.account}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 font-mono font-bold rounded text-[10px]">
                            {getCurrentInstallmentDisplay(plan)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {plan.installmentStartDate || ''} to {plan.installmentEndDate || ''}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(converted, displayCurrency)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                            <span>{t('recurring.trend') || 'Trend'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {showCompletedInstallments && sortedCompletedInstallmentPlans.map((plan) => {
                    const converted = convertCurrency(plan.latestAmount, plan.currency, displayCurrency, usdArsRate);
                    return (
                      <tr
                        key={plan.id}
                        onClick={() => handleCardClick(plan)}
                        className="hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group opacity-60"
                      >
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {plan.title} <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-normal px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 rounded">{t('recurring.completed') || 'Completed'}</span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{plan.category}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{plan.account}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold rounded text-[10px]">
                            {getCurrentInstallmentDisplay(plan)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {plan.installmentStartDate || ''} to {plan.installmentEndDate || ''}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(converted, displayCurrency)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover:underline">
                            <span>{t('recurring.trend') || 'Trend'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Recurring Rule Creation/Edit Modal */}
      <RecurringRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSaveRule={(rule) => {
          if (onSaveRecurringRule) {
            onSaveRecurringRule(rule);
          }
        }}
        onDeleteRule={(ruleId) => {
          if (onDeleteRecurringRule) {
            onDeleteRecurringRule(ruleId);
          }
        }}
        editingRule={editingRule}
        accountsList={accountsList}
        categoriesList={categoriesList}
      />

      {/* Modal for Trend History */}
      <RecurringTrendModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
        transactions={transactions}
        historyData={historyData}
        onMarkNonRecurring={handleMarkNonRecurring}
      />
      
      <RecurringCategoryTrendModal
        recurringItems={regularRecurring}
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
        historyData={historyData}
      />
    </div>
  );
}
export default RecurringTab;
