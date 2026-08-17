import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, BudgetGoal, InflationPoint, TransactionFilter } from '../types';
import { convertCurrency, formatCurrency, getTodayString } from '../utils/financeUtils';
import { X, Search, ExternalLink, Calendar, ArrowUpRight, ArrowDownRight, Layers, Tag, CreditCard, Landmark, Wallet, AlertTriangle, CheckCircle2, ChevronRight, ArrowUpDown, Clock } from 'lucide-react';

interface CategoryTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  initialMonth?: string;
  transactions: Transaction[];
  budgetGoal?: BudgetGoal;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  onNavigateToTransactionsWithFilter?: (filter: TransactionFilter) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export function CategoryTransactionsModal({
  isOpen,
  onClose,
  category,
  initialMonth = 'ALL',
  transactions,
  budgetGoal,
  displayCurrency,
  usdArsRate,
  historyData,
  onNavigateToTransactionsWithFilter,
  onEditTransaction,
}: CategoryTransactionsModalProps) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sync selectedMonth if initialMonth prop updates
  React.useEffect(() => {
    setSelectedMonth(initialMonth);
  }, [initialMonth]);

  // Extract available months from all transactions in this category
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      if (t.category === category && t.date) {
        months.add(t.date.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [transactions, category]);

  // Filter transactions for this category
  const categoryTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.category !== category) return false;
      if (t.type !== 'EXPENSE') return false;
      if (selectedMonth !== 'ALL' && (!t.date || !t.date.startsWith(selectedMonth))) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const titleMatch = (t.title || '').toLowerCase().includes(query);
        const descMatch = (t.description || '').toLowerCase().includes(query);
        const accMatch = (t.account || '').toLowerCase().includes(query);
        const notesMatch = (t.notes || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !accMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [transactions, category, selectedMonth, searchTerm]);

  // Calculate summary metrics
  const totalSpent = useMemo(() => {
    return categoryTransactions.reduce((sum, tx) => {
      const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
      return sum + converted;
    }, 0);
  }, [categoryTransactions, displayCurrency, usdArsRate, transactions, historyData]);

  const avgSpent = categoryTransactions.length > 0 ? totalSpent / categoryTransactions.length : 0;
  
  const largestTransaction = useMemo(() => {
    if (categoryTransactions.length === 0) return null;
    let max = 0;
    let maxTx: Transaction | null = null;
    categoryTransactions.forEach(tx => {
      const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
      if (converted > max) {
        max = converted;
        maxTx = tx;
      }
    });
    return maxTx ? { tx: maxTx, amount: max } : null;
  }, [categoryTransactions, displayCurrency, usdArsRate, transactions, historyData]);

  // Sorted list
  const sortedTransactions = useMemo(() => {
    return [...categoryTransactions].sort((a, b) => {
      if (sortField === 'date') {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortOrder === 'desc' ? diff : -diff;
      }
      if (sortField === 'amount') {
        const amtA = convertCurrency(a.amount, a.currency, displayCurrency, usdArsRate, a.date, transactions, historyData);
        const amtB = convertCurrency(b.amount, b.currency, displayCurrency, usdArsRate, b.date, transactions, historyData);
        return sortOrder === 'desc' ? amtB - amtA : amtA - amtB;
      }
      if (sortField === 'title') {
        const comp = (a.title || '').localeCompare(b.title || '');
        return sortOrder === 'asc' ? comp : -comp;
      }
      return 0;
    });
  }, [categoryTransactions, sortField, sortOrder, displayCurrency, usdArsRate, transactions, historyData]);

  if (!isOpen) return null;

  const budgetLimitConverted = budgetGoal
    ? convertCurrency(budgetGoal.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate)
    : 0;

  const percentage = budgetLimitConverted > 0 ? (totalSpent / budgetLimitConverted) * 100 : 0;
  const isOverBudget = percentage > 100;
  const remainingBudget = Math.max(budgetLimitConverted - totalSpent, 0);

  const handleOpenInTransactionsTab = () => {
    if (onNavigateToTransactionsWithFilter) {
      onNavigateToTransactionsWithFilter({
        category,
        month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
        type: 'EXPENSE',
      });
      onClose();
    }
  };

  const handleSortToggle = (field: 'date' | 'amount' | 'title') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[#111622] border border-slate-800/90 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#141b29]/90">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl shadow-inner">
              <Tag className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  {category}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300">
                  {categoryTransactions.length} {t('budget.tx_count_label', { count: categoryTransactions.length })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('budget.category_transactions_sub', { category }) || `Itemized transaction details and spending history for ${category}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {onNavigateToTransactionsWithFilter && (
              <button
                onClick={handleOpenInTransactionsTab}
                className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title={t('budget.open_in_transactions') || 'Open in Transactions Tab'}
              >
                <span>{t('budget.open_in_transactions') || 'Open in Transactions Tab'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Metric Summary Bar */}
        <div className="p-4 sm:p-6 space-y-4 border-b border-slate-800/80 bg-[#0e1420]">
          {/* Controls: Month Selector & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 bg-[#161d2b] px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-medium">{t('common.month')}:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none py-0 text-xs text-slate-100 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#161d2b] text-slate-100">{t('budget.all_time') || 'All Time'}</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#161d2b] text-slate-100">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('budget.search_transactions') || 'Search category transactions...'}
                className="w-full pl-8 pr-3 py-1.5 bg-[#161d2b] border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1: Total Spent */}
            <div className="p-3 bg-[#141b29] border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('budget.total_spent') || 'Total Spent'}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-100 mt-1 block font-mono">
                {formatCurrency(totalSpent, displayCurrency)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {selectedMonth === 'ALL' ? t('budget.all_time') : selectedMonth}
              </span>
            </div>

            {/* KPI 2: Budget Target */}
            <div className={`p-3 border rounded-xl ${isOverBudget ? 'bg-rose-950/20 border-rose-800/40' : 'bg-[#141b29] border-slate-800'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('budget.limit') || 'Budget Limit'}
                </span>
                {budgetLimitConverted > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isOverBudget ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {percentage.toFixed(0)}%
                  </span>
                )}
              </div>
              <span className={`text-base sm:text-lg font-black mt-1 block font-mono ${isOverBudget ? 'text-rose-400' : 'text-slate-100'}`}>
                {budgetLimitConverted > 0 ? formatCurrency(budgetLimitConverted, displayCurrency) : '—'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {budgetLimitConverted > 0 
                  ? (isOverBudget ? `${formatCurrency(totalSpent - budgetLimitConverted, displayCurrency)} over` : `${formatCurrency(remainingBudget, displayCurrency)} left`)
                  : 'No limit set'}
              </span>
            </div>

            {/* KPI 3: Average Transaction */}
            <div className="p-3 bg-[#141b29] border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('budget.avg_transaction') || 'Avg. Transaction'}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-100 mt-1 block font-mono">
                {formatCurrency(avgSpent, displayCurrency)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Across {categoryTransactions.length} txs
              </span>
            </div>

            {/* KPI 4: Largest Expense */}
            <div className="p-3 bg-[#141b29] border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('budget.largest_expense') || 'Largest Expense'}
              </span>
              <span className="text-base sm:text-lg font-black text-rose-400 mt-1 block font-mono">
                {largestTransaction ? formatCurrency(largestTransaction.amount, displayCurrency) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {largestTransaction ? largestTransaction.tx.title : '—'}
              </span>
            </div>
          </div>

          {/* Budget Progress Bar */}
          {budgetLimitConverted > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-semibold">
                  {isOverBudget ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {isOverBudget ? t('budget.over') : t('budget.on_track')}
                </span>
                <span>{percentage.toFixed(1)}% {t('budget.used')}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverBudget ? 'bg-rose-500' : percentage > 85 ? 'bg-amber-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Transactions Table / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => handleSortToggle('date')}
                className={`flex items-center space-x-1 font-bold hover:text-slate-200 transition-colors ${sortField === 'date' ? 'text-emerald-400' : ''}`}
              >
                <span>{t('common.date')}</span>
                <ArrowUpDown className="w-3 h-3" />
              </button>
              <button 
                onClick={() => handleSortToggle('title')}
                className={`flex items-center space-x-1 font-bold hover:text-slate-200 transition-colors ${sortField === 'title' ? 'text-emerald-400' : ''}`}
              >
                <span>{t('transactions.title') || 'Title / Merchant'}</span>
                <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>

            <button 
              onClick={() => handleSortToggle('amount')}
              className={`flex items-center space-x-1 font-bold hover:text-slate-200 transition-colors ${sortField === 'amount' ? 'text-emerald-400' : ''}`}
            >
              <span>{t('common.amount')}</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          {sortedTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="p-3 bg-slate-800/50 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center text-slate-500">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">
                {searchTerm 
                  ? t('transactions.no_matches') || 'No transactions matching search' 
                  : (selectedMonth === 'ALL' ? t('budget.no_transactions_for_category') : t('budget.no_transactions_for_month', { month: selectedMonth, category })) || 'No transactions recorded for this period.'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm ? 'Try clearing your search term.' : 'Transactions assigned to this category will automatically populate here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTransactions.map((tx) => {
                const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
                const isDifferentCurrency = tx.currency !== displayCurrency;
                const isInstallment = Boolean(tx.installments || tx.totalInstallments);

                return (
                  <div
                    key={tx.id}
                    onClick={() => onEditTransaction && onEditTransaction(tx)}
                    className="p-3 rounded-xl bg-[#141b29] hover:bg-[#192233] border border-slate-800/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs group cursor-pointer hover:border-slate-700"
                  >
                    {/* Left: Info */}
                    <div className="flex items-start sm:items-center space-x-3 truncate">
                      <div className="p-2 rounded-xl bg-[#1c2436] border border-slate-700/60 text-slate-300 shrink-0 mt-0.5 sm:mt-0">
                        {tx.account?.toLowerCase().includes('card') || tx.account?.toLowerCase().includes('visa') || tx.account?.toLowerCase().includes('master') ? (
                          <CreditCard className="w-4 h-4 text-amber-400" />
                        ) : tx.account?.toLowerCase().includes('bank') || tx.account?.toLowerCase().includes('bbva') || tx.account?.toLowerCase().includes('galicia') || tx.account?.toLowerCase().includes('santander') ? (
                          <Landmark className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Wallet className="w-4 h-4 text-blue-400" />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <p className="font-bold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                            {tx.title || tx.description || 'Expense'}
                          </p>
                          {isInstallment && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold shrink-0">
                              {tx.installments || (tx.installmentNumber ? `${tx.installmentNumber}/${tx.totalInstallments}` : 'Cuota')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="text-slate-300 font-medium">{tx.account || 'Account'}</span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500 italic truncate max-w-[120px]">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="text-left sm:text-right shrink-0 flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end">
                      <span className="text-sm font-black font-mono text-rose-400">
                        -{formatCurrency(converted, displayCurrency)}
                      </span>
                      {isDifferentCurrency && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ({formatCurrency(tx.amount, tx.currency as DisplayCurrency)})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#141b29] flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-slate-400">
            {sortedTransactions.length} of {categoryTransactions.length} transactions shown
          </span>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#161d2b] hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-all w-full sm:w-auto"
            >
              {t('common.close')}
            </button>
            {onNavigateToTransactionsWithFilter && (
              <button
                onClick={handleOpenInTransactionsTab}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5 w-full sm:w-auto"
              >
                <span>{t('budget.open_in_transactions') || 'Open in Transactions Tab'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
