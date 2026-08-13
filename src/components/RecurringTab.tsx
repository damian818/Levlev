import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, RecurringRule, DisplayCurrency, IdentifiedRecurringItem, InflationPoint, RecurringOccurrence } from '../types';
import { formatCurrency, formatCurrencyCompact, convertCurrency, detectRecurringItems, detectInstallmentPlans, computeFutureRecurringProjections } from '../utils/financeUtils';
import { RecurringTrendModal } from './RecurringTrendModal';
import { RecurringCategoryTrendModal } from './RecurringCategoryTrendModal';
import { Repeat, Calendar, Clock, Search, Filter, TrendingUp, Sparkles, ChevronRight, Layers, ArrowUpRight, ArrowDownRight, ShieldAlert, BarChart2, Ban, RotateCcw, LineChart } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area } from 'recharts';

interface RecurringTabProps {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
}

export function RecurringTab({ transactions, recurringRules, displayCurrency, usdArsRate, historyData }: RecurringTabProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME' | 'INSTALLMENT' | 'NON_RECURRING'>('ALL');
  const [selectedItem, setSelectedItem] = useState<IdentifiedRecurringItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showCompletedInstallments, setShowCompletedInstallments] = useState(false);
  const [installmentsSort, setInstallmentsSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showProjection, setShowProjection] = useState(true);

  const handleInstallmentsSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (installmentsSort && installmentsSort.key === key && installmentsSort.direction === 'asc') {
      direction = 'desc';
    }
    setInstallmentsSort({ key, direction });
  };

  // Non-recurring exclusions state
  const [nonRecurringKeys, setNonRecurringKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('levlev_non_recurring_keys');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleMarkNonRecurring = (item: IdentifiedRecurringItem) => {
    const key = item.title.toLowerCase().trim();
    setNonRecurringKeys(prev => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem('levlev_non_recurring_keys', JSON.stringify(next));
      return next;
    });
  };

  const handleRestoreRecurring = (keyToRestore: string) => {
    setNonRecurringKeys(prev => {
      const next = prev.filter(k => k !== keyToRestore);
      localStorage.setItem('levlev_non_recurring_keys', JSON.stringify(next));
      return next;
    });
  };

  // Auto-detect strict recurring items (6+ occurrences, no installments, consolidated across accounts)
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

  // Find installment transactions (e.g. description or ID containing "3/6")
  const installmentTx = useMemo(() => {
    return transactions.filter(t => t.installments || (t.description && t.description.includes('/')));
  }, [transactions]);

  // Monthly commitments sum
  const totalMonthlyExpense = useMemo(() => {
    return regularRecurring
      .filter(i => i.type === 'EXPENSE')
      .reduce((sum, item) => {
        const latestMonth = item.monthlyTrend[item.monthlyTrend.length - 1]?.month;
        if (!latestMonth) return sum;
        const latestMonthAmount = item.history
          .filter(h => h.month === latestMonth)
          .reduce((s, h) => s + convertCurrency(h.amount, h.currency, displayCurrency, usdArsRate, h.date, transactions), 0);
        return sum + latestMonthAmount;
      }, 0);
  }, [regularRecurring, displayCurrency, usdArsRate, transactions]);

  const totalMonthlyIncome = useMemo(() => {
    return regularRecurring
      .filter(i => i.type === 'INCOME')
      .reduce((sum, item) => {
        const latestMonth = item.monthlyTrend[item.monthlyTrend.length - 1]?.month;
        if (!latestMonth) return sum;
        const latestMonthAmount = item.history
          .filter(h => h.month === latestMonth)
          .reduce((s, h) => s + convertCurrency(h.amount, h.currency, displayCurrency, usdArsRate, h.date, transactions), 0);
        return sum + latestMonthAmount;
      }, 0);
  }, [regularRecurring, displayCurrency, usdArsRate, transactions]);

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
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Repeat className="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{t('recurring.title')}</span>
                <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold rounded-full">
                  {regularRecurring.length} {t('recurring.identified')}
                </span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                {t('recurring.sub_salary_cuotas')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto bg-[#121620] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg transition-colors font-semibold"
            >
              <BarChart2 className="w-4 h-4" />
              <span>{t('recurring.category_trends')}</span>
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-800" />
            <div className="flex justify-between items-center sm:block">
              <span className="text-slate-400 sm:block text-[9px] sm:text-[10px] font-medium mr-2">{t('recurring.monthly_commitments')}</span>
              <span className="text-rose-400 font-bold">
                {formatCurrencyCompact(totalMonthlyExpense, displayCurrency)}
              </span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-slate-800" />
            <div className="flex justify-between items-center sm:block">
              <span className="text-slate-400 sm:block text-[9px] sm:text-[10px] font-medium mr-2">{t('recurring.avg_income')}</span>
              <span className="text-emerald-400 font-bold">
                {formatCurrencyCompact(totalMonthlyIncome, displayCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-slate-800/80">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`${t('common.search')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {(['ALL', 'EXPENSE', 'INCOME', 'INSTALLMENT', 'NON_RECURRING'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTypeFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${
                  typeFilter === mode
                    ? 'bg-slate-200 text-slate-900 shadow-xs'
                    : 'bg-[#121620] text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {mode === 'ALL' && t('common.all')}
                {mode === 'EXPENSE' && t('recurring.expenses')}
                {mode === 'INCOME' && t('common.income')}
                {mode === 'INSTALLMENT' && t('recurring.cuotas')}
                {mode === 'NON_RECURRING' && (
                  <>
                    <Ban className="w-3 h-3 text-rose-400" />
                    <span>{t('recurring.excluded')} ({excludedRecurringItems.length})</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Future Projection Section */}
      <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{t('recurring.projection_title')}</h3>
              <p className="text-xs text-slate-400">
                {t('recurring.projection_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowProjection(!showProjection)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700"
          >
            {showProjection ? t('recurring.hide_projection') : t('recurring.show_projection')}
          </button>
        </div>

        {showProjection && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={computeFutureRecurringProjections(transactions, displayCurrency, usdArsRate, 12)} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
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
                          <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-slate-200">{label}</p>
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
                  <Bar dataKey="expense" name={t('recurring.proj_expense')} fill="#fb7185" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="income" name={t('recurring.proj_income')} fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
                  <Area type="monotone" dataKey="net" name={t('recurring.net_forecast')} fill="#38bdf8" stroke="#38bdf8" fillOpacity={0.1} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#121620] border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.avg_bill')}</p>
                <p className="text-sm font-bold text-slate-200 mt-1">{formatCurrency(totalMonthlyExpense, displayCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#121620] border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.avg_income')}</p>
                <p className="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(totalMonthlyIncome, displayCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#121620] border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.active_plans')}</p>
                <p className="text-sm font-bold text-amber-400 mt-1">{activeInstallmentPlans.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#121620] border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{t('recurring.commitment_12m')}</p>
                <p className="text-sm font-bold text-slate-200 mt-1">{formatCurrency(totalMonthlyExpense * 12, displayCurrency)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid of Clickable Recurring Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between px-1">
          <span>{typeFilter === 'NON_RECURRING' ? t('recurring.excluded_non_recurring') : t('recurring.recurring_items')} ({filteredItems.length})</span>
          <span className="text-[11px] text-emerald-400 font-normal">{t('recurring.click_details')}</span>
        </h4>

        {filteredItems.length === 0 ? (
          <div className="bg-[#161b22] p-8 rounded-xl border border-slate-800 text-center space-y-2">
            <Repeat className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              {typeFilter === 'NON_RECURRING' ? t('recurring.no_excluded') : t('recurring.no_matches')}
            </p>
            <p className="text-xs text-slate-500">
              {typeFilter === 'NON_RECURRING' ? t('recurring.exclude_instructions') : t('recurring.clear_search')}
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
                  className="p-4 rounded-xl border border-slate-800/90 bg-[#121620] space-y-3 hover:bg-slate-800/50 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-xs hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                          isIncome 
                            ? 'bg-emerald-950/80 border-emerald-800/50 text-emerald-300' 
                            : 'bg-rose-950/80 border-rose-800/50 text-rose-300'
                        }`}>
                          {isIncome ? t('common.income') : t('common.expense')}
                        </span>
                        {item.isInstallment && (
                          <span className="px-1.5 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 text-[10px] font-semibold rounded font-mono">
                            {item.installmentInfo || t('recurring.cuotas')}
                          </span>
                        )}
                        {isExcluded && (
                          <span className="px-1.5 py-0.5 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[9px] font-bold rounded">
                            {t('recurring.non_recurring')}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center font-medium">
                        <Calendar className="w-3 h-3 mr-1 text-slate-500" /> ~Day {item.dayOfMonth}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                        <span className="truncate pr-2">{item.title}</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.category} • <span className="text-slate-300 font-medium">{item.account}</span>
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-slate-400 text-[11px]">{t('recurring.latest_charge')}:</span>
                        <span className="font-bold text-slate-100">
                          {formatCurrency(latestConverted, displayCurrency)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>{t('recurring.native')}: {formatCurrency(item.latestAmount, item.currency as DisplayCurrency)}</span>
                        <span className="text-emerald-400 font-sans font-semibold flex items-center gap-0.5 group-hover:underline">
                          <TrendingUp className="w-3 h-3" />
                          <span>{t('recurring.view_trend')} ({item.distinctMonthsCount} mos)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="pt-2 border-t border-slate-800/50 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    {isExcluded ? (
                      <button
                        onClick={() => handleRestoreRecurring(item.title.toLowerCase().trim())}
                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title={t('recurring.restore')}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('recurring.restore')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkNonRecurring(item)}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title={t('recurring.mark_non_recurring')}
                      >
                        <Ban className="w-3 h-3" />
                        <span>{t('recurring.mark_non_recurring')}</span>
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
      <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{t('recurring.plans_title')}</h3>
              <p className="text-xs text-slate-400">
                {t('recurring.plans_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCompletedInstallments(!showCompletedInstallments)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700"
          >
            {showCompletedInstallments ? t('recurring.hide_completed') : t('recurring.show_completed')}
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#121620]">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead className="bg-[#161b22] text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('title')}>
                  {t('recurring.merchant_item')} {installmentsSort?.key === 'title' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('category')}>
                  {t('common.category')} {installmentsSort?.key === 'category' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('account')}>
                  {t('recurring.card_account')} {installmentsSort?.key === 'account' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('installmentCurrent')}>
                  {t('recurring.current_installment')} {installmentsSort?.key === 'installmentCurrent' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('period')}>
                  {t('recurring.period_start_end')} {installmentsSort?.key === 'period' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-right cursor-pointer hover:text-slate-200" onClick={() => handleInstallmentsSort('amount')}>
                  {t('recurring.latest_amount')} ({displayCurrency}) {installmentsSort?.key === 'amount' && (installmentsSort.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedActiveInstallmentPlans.length === 0 && (!showCompletedInstallments || sortedCompletedInstallmentPlans.length === 0) ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">{t('recurring.no_plans')}</td>
                </tr>
              ) : (
                <>
                  {sortedActiveInstallmentPlans.map((plan) => {
                    const converted = convertCurrency(plan.latestAmount, plan.currency, displayCurrency, usdArsRate);
                    return (
                      <tr
                        key={plan.id}
                        onClick={() => handleCardClick(plan)}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                          {plan.title}
                        </td>
                        <td className="p-3 text-slate-400">{plan.category}</td>
                        <td className="p-3 text-slate-300 font-medium">{plan.account}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 font-mono font-bold rounded text-[10px]">
                            {getCurrentInstallmentDisplay(plan)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {plan.installmentStartDate || ''} to {plan.installmentEndDate || ''}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-100 font-mono">
                          {formatCurrency(converted, displayCurrency)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 group-hover:underline">
                            <span>{t('recurring.trend')}</span>
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
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group opacity-60"
                      >
                        <td className="p-3 font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                          {plan.title} <span className="ml-1 text-[10px] text-emerald-400 font-normal px-1.5 py-0.5 bg-emerald-950 rounded">{t('recurring.completed')}</span>
                        </td>
                        <td className="p-3 text-slate-400">{plan.category}</td>
                        <td className="p-3 text-slate-300 font-medium">{plan.account}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold rounded text-[10px]">
                            {getCurrentInstallmentDisplay(plan)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {plan.installmentStartDate || ''} to {plan.installmentEndDate || ''}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-100 font-mono">
                          {formatCurrency(converted, displayCurrency)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-400 group-hover:underline">
                            <span>{t('recurring.trend')}</span>
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

