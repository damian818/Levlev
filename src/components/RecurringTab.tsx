import React, { useState, useMemo } from 'react';
import { Transaction, RecurringRule, DisplayCurrency, IdentifiedRecurringItem, InflationPoint, RecurringOccurrence } from '../types';
import { formatCurrency, formatCurrencyCompact, convertCurrency, detectRecurringItems, detectInstallmentPlans } from '../utils/financeUtils';
import { RecurringTrendModal } from './RecurringTrendModal';
import { RecurringCategoryTrendModal } from './RecurringCategoryTrendModal';
import { Repeat, Calendar, Clock, Search, Filter, TrendingUp, Sparkles, ChevronRight, Layers, ArrowUpRight, ArrowDownRight, ShieldAlert, BarChart2, Ban, RotateCcw } from 'lucide-react';

interface RecurringTabProps {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
}

export function RecurringTab({ transactions, recurringRules, displayCurrency, usdArsRate, historyData }: RecurringTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME' | 'INSTALLMENT' | 'NON_RECURRING'>('ALL');
  const [selectedItem, setSelectedItem] = useState<IdentifiedRecurringItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

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
  const installmentPlans = useMemo(() => {
    return detectInstallmentPlans(transactions, displayCurrency, usdArsRate);
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
                <span>Recurring & Income History</span>
                <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold rounded-full">
                  {regularRecurring.length} Identified
                </span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                Subscriptions, salaries, and installments.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto bg-[#121620] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg transition-colors font-semibold"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Category Trends</span>
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-800" />
            <div className="flex justify-between items-center sm:block">
              <span className="text-slate-400 sm:block text-[9px] sm:text-[10px] font-medium mr-2">Monthly Commitments</span>
              <span className="text-rose-400 font-bold">
                {formatCurrencyCompact(totalMonthlyExpense, displayCurrency)}
              </span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-slate-800" />
            <div className="flex justify-between items-center sm:block">
              <span className="text-slate-400 sm:block text-[9px] sm:text-[10px] font-medium mr-2">Monthly Income</span>
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
              placeholder="Search..."
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
                {mode === 'ALL' && 'All'}
                {mode === 'EXPENSE' && 'Expenses'}
                {mode === 'INCOME' && 'Income'}
                {mode === 'INSTALLMENT' && 'Cuotas'}
                {mode === 'NON_RECURRING' && (
                  <>
                    <Ban className="w-3 h-3 text-rose-400" />
                    <span>Excluded ({excludedRecurringItems.length})</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid of Clickable Recurring Cards */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between px-1">
          <span>{typeFilter === 'NON_RECURRING' ? 'Excluded Non-Recurring Expenses' : 'Recurring Items'} ({filteredItems.length})</span>
          <span className="text-[11px] text-emerald-400 font-normal">Click card to view details</span>
        </h4>

        {filteredItems.length === 0 ? (
          <div className="bg-[#161b22] p-8 rounded-xl border border-slate-800 text-center space-y-2">
            <Repeat className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              {typeFilter === 'NON_RECURRING' ? 'No items marked as non-recurring' : 'No recurring items matching search filters'}
            </p>
            <p className="text-xs text-slate-500">
              {typeFilter === 'NON_RECURRING' ? 'To exclude an automatically identified recurring expense, click "Mark Non-Recurring".' : 'Try clearing your search term or selecting All.'}
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
                          {item.type}
                        </span>
                        {item.isInstallment && (
                          <span className="px-1.5 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 text-[10px] font-semibold rounded font-mono">
                            {item.installmentInfo || 'Cuotas'}
                          </span>
                        )}
                        {isExcluded && (
                          <span className="px-1.5 py-0.5 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[9px] font-bold rounded">
                            Non-recurring
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
                        <span className="text-slate-400 text-[11px]">Latest Charge:</span>
                        <span className="font-bold text-slate-100">
                          {formatCurrency(latestConverted, displayCurrency)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>Native: {formatCurrency(item.latestAmount, item.currency as DisplayCurrency)}</span>
                        <span className="text-emerald-400 font-sans font-semibold flex items-center gap-0.5 group-hover:underline">
                          <TrendingUp className="w-3 h-3" />
                          <span>View Trend ({item.distinctMonthsCount} mos)</span>
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
                        title="Restore to recurring list"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore Recurring</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkNonRecurring(item)}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title="Exclude this item from recurring list"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Mark Non-Recurring</span>
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
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Active Credit Card Installment Plans (Cuotas)</h3>
            <p className="text-xs text-slate-400">
              Purchases split across multiple monthly card billing cycles. Click any row to view full payment history.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#121620]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161b22] text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Merchant / Item</th>
                <th className="p-3">Category</th>
                <th className="p-3">Card Account</th>
                <th className="p-3">Current Installment</th>
                <th className="p-3 text-right">Latest Amount ({displayCurrency})</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {installmentPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">No active credit card installment plans detected.</td>
                </tr>
              ) : (
                installmentPlans.map((plan) => {
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
                          {plan.installmentInfo || 'Cuotas'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-100 font-mono">
                        {formatCurrency(converted, displayCurrency)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 group-hover:underline">
                          <span>Trend</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })
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

