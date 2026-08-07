import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, DisplayCurrency, TransactionFilter, InflationPoint } from '../types';
import { formatCurrency, convertCurrency, getHistoricalFxRate, getCurrentMonthKey } from '../utils/financeUtils';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCcw, Plus, Trash2, X } from 'lucide-react';

interface TransactionsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  onDeleteTransaction: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenDeleteModal?: () => void;
  activeFilter?: TransactionFilter;
  onClearFilter?: () => void;
}

export function TransactionsTab({
  transactions,
  displayCurrency,
  usdArsRate,
  historyData,
  onDeleteTransaction,
  onOpenAddModal,
  onOpenDeleteModal,
  activeFilter,
  onClearFilter,
}: TransactionsTabProps) {
  const [searchTerm, setSearchTerm] = useState(activeFilter?.search || '');
  const [selectedType, setSelectedType] = useState<string>(activeFilter?.type || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>(activeFilter?.category || 'ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>(activeFilter?.account || 'ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // React to activeFilter changes
  useEffect(() => {
    if (activeFilter) {
      if (activeFilter.search !== undefined) setSearchTerm(activeFilter.search);
      if (activeFilter.type !== undefined) setSelectedType(activeFilter.type);
      if (activeFilter.category !== undefined) setSelectedCategory(activeFilter.category);
      if (activeFilter.account !== undefined) setSelectedAccount(activeFilter.account);
      if (activeFilter.month !== undefined) setSelectedMonth(activeFilter.month);
      setCurrentPage(1);
    }
  }, [activeFilter]);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.date) set.add(t.date.substring(0, 7)); });
    set.add(currentMonthKey);
    return Array.from(set).sort().reverse();
  }, [transactions, currentMonthKey]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [transactions]);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.account) set.add(t.account); });
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      // Exclude standard transfers from the main list as requested, but keep CC_PAYMENT
      if (t.type === 'TRANSFER') return false;

      const matchSearch = !searchTerm || 
                          (t.title && t.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.account && t.account.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.toAccount && t.toAccount.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = selectedType === 'ALL' || t.type === selectedType;
      const matchCat = selectedCategory === 'ALL' || t.category === selectedCategory;
      const matchAcc = selectedAccount === 'ALL' || t.account === selectedAccount || t.toAccount === selectedAccount;
      const txMonth = t.date ? t.date.substring(0, 7) : '';
      const matchMonth = selectedMonth === 'ALL' || txMonth === selectedMonth;
      return matchSearch && matchType && matchCat && matchAcc && matchMonth;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, selectedType, selectedCategory, selectedAccount, selectedMonth]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isFiltered = searchTerm || selectedType !== 'ALL' || selectedCategory !== 'ALL' || selectedAccount !== 'ALL' || selectedMonth !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    setSelectedCategory('ALL');
    setSelectedAccount('ALL');
    setSelectedMonth('ALL');
    if (onClearFilter) onClearFilter();
  };

  return (
    <div className="space-y-4">
      {/* Active Filter Pill Bar */}
      {isFiltered && (
        <div className="bg-[#121620] px-4 py-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Drill-down Filter:</span>
            {selectedType !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">Type: {selectedType}</span>}
            {selectedCategory !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">Category: {selectedCategory}</span>}
            {selectedAccount !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">Account: {selectedAccount}</span>}
            {selectedMonth !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">Month: {selectedMonth}</span>}
            {searchTerm && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">Search: "{searchTerm}"</span>}
          </div>
          <button
            onClick={handleResetFilters}
            className="text-slate-400 hover:text-slate-200 flex items-center space-x-1 underline text-[11px]"
          >
            <X className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 font-medium"
          >
            <option value="ALL">All Months</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m} {m === currentMonthKey ? '(Current)' : ''}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">All Types</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="CC_PAYMENT">Credit Card Payment</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">All Accounts</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors ml-auto shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add Transaction</span>
          </button>

          {onOpenDeleteModal && (
            <button
              onClick={onOpenDeleteModal}
              title="Delete existing transactions"
              className="inline-flex items-center px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
              <span>Delete Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#161b22] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#121620] border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-3">Date</th>
                <th className="p-3">Title / Merchant</th>
                <th className="p-3">Category</th>
                <th className="p-3">Account</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Original Amount</th>
                <th className="p-3 text-right">Converted ({displayCurrency})</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => {
                  const converted = convertCurrency(tx.amount, tx.currency as DisplayCurrency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
                  const effectiveRate = getHistoricalFxRate(tx.date, usdArsRate, transactions, historyData);
                  const isCrossCurrency = (tx.currency?.toUpperCase().includes('USD') && displayCurrency === 'ARS') || (!tx.currency?.toUpperCase().includes('USD') && displayCurrency === 'USD');

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3 font-medium text-slate-200">
                        <div>{tx.title}</div>
                        {tx.description && <div className="text-[10px] text-slate-500">{tx.description}</div>}
                      </td>
                      <td className="p-3 text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-md text-slate-300 font-medium">
                          {tx.category || 'General'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {tx.account}
                        {tx.toAccount && <span className="text-slate-500 text-[10px] block">→ {tx.toAccount}</span>}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          tx.type === 'INCOME' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' :
                          tx.type === 'EXPENSE' ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' :
                          tx.type === 'CC_PAYMENT' ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50' :
                          'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                        }`}>
                          {tx.type === 'CC_PAYMENT' ? 'CC PAYMENT' : tx.type}
                        </span>
                        {tx.installments && (
                          <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                            {tx.installments}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-200">
                        {tx.currency} {tx.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-100">
                        <div>{formatCurrency(converted, displayCurrency)}</div>
                        {isCrossCurrency && (
                          <div className="text-[10px] text-slate-400 font-normal font-mono" title="Historical exchange rate applied for this transaction's date">
                            @ {effectiveRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ARS/USD
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-950/50 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-[#121620]">
            <div>
              Showing <span className="font-semibold text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-semibold text-slate-200">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of{' '}
              <span className="font-semibold text-slate-200">{filtered.length}</span> transactions
            </div>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1 bg-[#161b22] border border-slate-700 text-slate-200 rounded-md font-medium disabled:opacity-50 hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="px-3 py-1 bg-[#161b22] border border-slate-700 text-slate-200 rounded-md font-medium disabled:opacity-50 hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
