import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, TransactionFilter, InflationPoint, CategoryItem, AccountItem } from '../types';
import { formatCurrency, convertCurrency, getHistoricalFxRate, getCurrentMonthKey, getTodayString, normalizeCleanTitle, isInstallmentTx, detectRecurringItems } from '../utils/financeUtils';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCcw, Plus, Trash2, X, Clock, ArrowRight, ArrowRightLeft, ArrowUpDown, ChevronUp, ChevronDown, Repeat, CheckSquare, Square, Edit, MoreHorizontal, Layers, Wallet2 } from 'lucide-react';

interface TransactionsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  onDeleteTransaction: (id: string | string[]) => void;
  onUpdateTransaction: (id: string | string[], updates: Partial<Transaction>) => void;
  categoriesList: CategoryItem[];
  accountsList: AccountItem[];
  onOpenAddModal: () => void;
  onOpenDeleteModal?: () => void;
  activeFilter?: TransactionFilter;
  onClearFilter?: () => void;
  currentUserId?: string;
  showSharedData?: boolean;
}

type SortField = 'date' | 'title' | 'category' | 'account' | 'type' | 'amount' | 'converted';
type SortOrder = 'asc' | 'desc';

export function TransactionsTab({
  transactions,
  displayCurrency,
  usdArsRate,
  historyData,
  onDeleteTransaction,
  onUpdateTransaction,
  categoriesList,
  accountsList,
  onOpenAddModal,
  onOpenDeleteModal,
  activeFilter,
  onClearFilter,
  currentUserId,
  showSharedData = true,
}: TransactionsTabProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState(activeFilter?.search || '');
  const [selectedType, setSelectedType] = useState<string>(activeFilter?.type || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>(activeFilter?.category || 'ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>(activeFilter?.account || 'ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [recurringFilter, setRecurringFilter] = useState<'ALL' | 'ONE_TIME' | 'RECURRING'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Bulk Edit Mode state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionTarget, setBulkActionTarget] = useState<'CATEGORY' | 'ACCOUNT' | 'DELETE' | null>(null);

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    setSelectedIds(new Set());
  };

  const handleSelectTx = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllOnPage = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} selected transactions?`)) {
      onDeleteTransaction(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBulkMode(false);
    }
  };

  const handleBulkUpdateCategory = (category: string) => {
    if (selectedIds.size === 0) return;
    onUpdateTransaction(Array.from(selectedIds), { category });
    setSelectedIds(new Set());
    setBulkActionTarget(null);
    setIsBulkMode(false);
  };

  const handleBulkUpdateAccount = (account: string) => {
    if (selectedIds.size === 0) return;
    onUpdateTransaction(Array.from(selectedIds), { account });
    setSelectedIds(new Set());
    setBulkActionTarget(null);
    setIsBulkMode(false);
  };

  // Installment deletion options modal
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);

  const handleDeleteClick = (tx: Transaction) => {
    if (tx.installments || tx.totalInstallments || isInstallmentTx(tx)) {
      setInstallmentTxToDelete(tx);
    } else {
      onDeleteTransaction(tx.id);
    }
  };

  const handleDeleteOnlySingleCuota = () => {
    if (installmentTxToDelete) {
      onDeleteTransaction(installmentTxToDelete.id);
      setInstallmentTxToDelete(null);
    }
  };

  const handleDeleteAllCuotasInGroup = () => {
    if (installmentTxToDelete) {
      const targetTitle = (installmentTxToDelete.title || '').toLowerCase().trim();
      const targetAccount = (installmentTxToDelete.account || '').toLowerCase().trim();
      const matching = transactions.filter(t => {
        const matchTitle = (t.title || '').toLowerCase().trim() === targetTitle;
        const matchAccount = (t.account || '').toLowerCase().trim() === targetAccount;
        const isInst = Boolean(t.installments || t.totalInstallments || isInstallmentTx(t));
        return matchTitle && matchAccount && isInst;
      });
      const idsToDelete = matching.map(t => t.id);
      onDeleteTransaction(idsToDelete.length > 0 ? idsToDelete : [installmentTxToDelete.id]);
      setInstallmentTxToDelete(null);
    }
  };

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'title' || field === 'category' || field === 'account' || field === 'type' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

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

  // Set of recurring transaction IDs
  const recurringTxSet = useMemo(() => {
    const set = new Set<string>();

    const detected = detectRecurringItems(transactions, displayCurrency, usdArsRate);
    detected.forEach(item => {
      item.history.forEach(occ => {
        set.add(occ.id);
      });
    });

    const recurringKeywords = [
      'netflix', 'spotify', 'disney', 'youtube', 'gym', 'gimnasio', 'alquiler', 'rent',
      'expensas', 'edenor', 'edesur', 'metrogas', 'aysa', 'telecom', 'personal', 'fibertel',
      'cablevision', 'suscripcion', 'subscription', 'seguro', 'insurance', 'icloud', 'google',
      'chatgpt', 'aws', 'sueldo', 'salary', 'interes', 'monotributo', 'patente', 'cuota', 'servicios', 'osde'
    ];

    const titleMonthMap = new Map<string, Set<string>>();
    transactions.forEach(t => {
      const clean = normalizeCleanTitle(t.title || t.category || '').toLowerCase();
      const month = t.date ? t.date.substring(0, 7) : '';
      if (clean && month) {
        if (!titleMonthMap.has(clean)) titleMonthMap.set(clean, new Set());
        titleMonthMap.get(clean)!.add(month);
      }
    });

    transactions.forEach(t => {
      if (isInstallmentTx(t)) {
        set.add(t.id);
        return;
      }
      const clean = normalizeCleanTitle(t.title || t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const category = (t.category || '').toLowerCase();

      if (recurringKeywords.some(kw => clean.includes(kw) || desc.includes(kw) || category.includes(kw))) {
        set.add(t.id);
        return;
      }

      if (clean && titleMonthMap.get(clean) && titleMonthMap.get(clean)!.size >= 2) {
        set.add(t.id);
      }
    });

    return set;
  }, [transactions, displayCurrency, usdArsRate]);

  const filtered = useMemo(() => {
    const list = transactions.filter(t => {
      const isShared = t.ownerId && currentUserId && t.ownerId !== currentUserId;
      if (isShared && !showSharedData) return false;

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
      const matchRecurring = recurringFilter === 'ALL' || 
                             (recurringFilter === 'RECURRING' && recurringTxSet.has(t.id)) || 
                             (recurringFilter === 'ONE_TIME' && !recurringTxSet.has(t.id));

      return matchSearch && matchType && matchCat && matchAcc && matchMonth && matchRecurring;
    });

    return list.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'date') {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      } else if (sortField === 'title') {
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
      } else if (sortField === 'category') {
        valA = (a.category || '').toLowerCase();
        valB = (b.category || '').toLowerCase();
      } else if (sortField === 'account') {
        valA = (a.account || '').toLowerCase();
        valB = (b.account || '').toLowerCase();
      } else if (sortField === 'type') {
        valA = (a.type || '').toLowerCase();
        valB = (b.type || '').toLowerCase();
      } else if (sortField === 'amount') {
        valA = Number(a.amount || 0);
        valB = Number(b.amount || 0);
      } else if (sortField === 'converted') {
        valA = convertCurrency(a.amount, a.currency as DisplayCurrency, displayCurrency, usdArsRate, a.date, transactions, historyData);
        valB = convertCurrency(b.amount, b.currency as DisplayCurrency, displayCurrency, usdArsRate, b.date, transactions, historyData);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, searchTerm, selectedType, selectedCategory, selectedAccount, selectedMonth, recurringFilter, recurringTxSet, sortField, sortOrder, displayCurrency, usdArsRate, historyData]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isFiltered = searchTerm || selectedType !== 'ALL' || selectedCategory !== 'ALL' || selectedAccount !== 'ALL' || selectedMonth !== 'ALL' || recurringFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    setSelectedCategory('ALL');
    setSelectedAccount('ALL');
    setSelectedMonth('ALL');
    setRecurringFilter('ALL');
    if (onClearFilter) onClearFilter();
  };

  return (
    <div className="space-y-4">
      {/* Active Filter Pill Bar */}
      {isFiltered && (
        <div className="bg-[#121620] px-4 py-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-300 flex-wrap gap-y-1">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('common.filter')}:</span>
            {recurringFilter !== 'ALL' && (
              <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 rounded font-semibold text-purple-300 flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {recurringFilter === 'RECURRING' ? 'Recurring / Fixed Costs' : 'One-time Transactions'}
              </span>
            )}
            {selectedType !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">{t('common.type')}: {selectedType}</span>}
            {selectedCategory !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">{t('common.category')}: {selectedCategory}</span>}
            {selectedAccount !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">{t('common.account')}: {selectedAccount}</span>}
            {selectedMonth !== 'ALL' && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">{t('common.month')}: {selectedMonth}</span>}
            {searchTerm && <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-semibold text-emerald-400">{t('common.search')}: "{searchTerm}"</span>}
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
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('transactions.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
            />
          </div>

          {/* Toggle buttons for All, One-time, Recurring */}
          <div className="flex items-center bg-[#0f131a] p-1 rounded-lg border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => { setRecurringFilter('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                recurringFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('common.all')}
            </button>
            <button
              type="button"
              onClick={() => { setRecurringFilter('ONE_TIME'); setCurrentPage(1); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                recurringFilter === 'ONE_TIME'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show only single one-time transactions"
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => { setRecurringFilter('RECURRING'); setCurrentPage(1); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                recurringFilter === 'RECURRING'
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show only recurring bills, subscriptions, installments, and fixed costs"
            >
              <Repeat className="w-3 h-3 text-purple-400" />
              <span>Recurring</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 font-medium"
          >
            <option value="ALL">All Months</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m} {m === currentMonthKey ? `(${t('common.today')})` : ''}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">{t('transactions.filter_type')}</option>
            <option value="EXPENSE">{t('common.expense')}</option>
            <option value="INCOME">{t('common.income')}</option>
            <option value="TRANSFER">{t('common.transfer')}</option>
            <option value="CC_PAYMENT">{t('common.credit_card')}</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">{t('transactions.filter_category')}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">{t('transactions.filter_account')}</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors ml-auto shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>{t('overview.quick_add')}</span>
          </button>

          <button
            onClick={toggleBulkMode}
            className={`inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors border shadow-xs ${
              isBulkMode 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
            <span>{isBulkMode ? 'Exit Bulk Edit' : 'Bulk Edit'}</span>
          </button>

          {onOpenDeleteModal && (
            <button
              onClick={onOpenDeleteModal}
              title={t('transactions.delete_title')}
              className="inline-flex items-center px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
              <span>{t('common.delete')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar - Shows when items are selected */}
      {isBulkMode && selectedIds.size > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1.5">
              <CheckSquare className="w-3 h-3" />
              {selectedIds.size} Selected
            </div>
            <p className="text-xs text-emerald-200 font-medium hidden sm:block">Perform batch actions on selected records</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkActionTarget('CATEGORY')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Change Category
            </button>
            <button
              onClick={() => setBulkActionTarget('ACCOUNT')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 transition-all"
            >
              <Wallet2 className="w-3.5 h-3.5 text-emerald-400" />
              Change Account
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[11px] font-bold border border-rose-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Delete All
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-[#161b22] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#121620] border-b border-slate-800 text-slate-400 uppercase font-semibold">
                {isBulkMode && (
                  <th className="p-3 w-10 text-center">
                    <button 
                      onClick={() => handleSelectAllOnPage(paginated.map(t => t.id))}
                      className="p-1 rounded hover:bg-slate-800 transition-colors"
                    >
                      {paginated.every(t => selectedIds.has(t.id)) && paginated.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </th>
                )}
                <th 
                  onClick={() => handleSort('date')}
                  className="p-3 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('title')}
                  className="p-3 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Title / Merchant</span>
                    {sortField === 'title' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('category')}
                  className="p-3 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    {sortField === 'category' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('account')}
                  className="p-3 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Account</span>
                    {sortField === 'account' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('type')}
                  className="p-3 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    {sortField === 'type' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('amount')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Original Amount</span>
                    {sortField === 'amount' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('converted')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Converted ({displayCurrency})</span>
                    {sortField === 'converted' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={isBulkMode ? 9 : 8} className="p-8 text-center text-slate-500">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => {
                  const todayStr = getTodayString();
                  const txDateStr = tx.date ? tx.date.substring(0, 10) : '';
                  const isFuture = Boolean(txDateStr && txDateStr > todayStr);

                  const converted = convertCurrency(tx.amount, tx.currency as DisplayCurrency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
                  const effectiveRate = getHistoricalFxRate(tx.date, usdArsRate, transactions, historyData);
                  const isCrossCurrency = (tx.currency?.toUpperCase().includes('USD') && displayCurrency === 'ARS') || (!tx.currency?.toUpperCase().includes('USD') && displayCurrency === 'USD');

                  const isSelected = selectedIds.has(tx.id);

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-500/10' : ''} ${isFuture ? 'bg-amber-950/15 border-l-2 border-l-amber-500/70' : ''}`}
                      onClick={() => isBulkMode ? handleSelectTx(tx.id) : null}
                    >
                      {isBulkMode && (
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleSelectTx(tx.id)}
                            className="p-1 rounded hover:bg-slate-800 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-700" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                          <span>{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                          {isFuture && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold inline-flex items-center w-fit" title="Future date - transaction is pending and excluded from current live balances">
                              <Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                              Pending/Future
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-200">
                        <div className="flex items-center space-x-1.5">
                          <span>{tx.title}</span>
                          {tx.ownerId && currentUserId && tx.ownerId !== currentUserId && (
                            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-bold" title="Shared by another workspace member">Shared</span>
                          )}
                        </div>
                        {tx.description && <div className="text-[10px] text-slate-500">{tx.description}</div>}
                      </td>
                      <td className="p-3 text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-md text-slate-300 font-medium">
                          {tx.category || 'General'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT' ? (
                          <div className="flex flex-col text-xs space-y-0.5">
                            <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-blue-950/50 border border-blue-800/50 rounded-md w-fit">
                              <span className="font-semibold text-slate-200">{tx.account}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="font-semibold text-blue-300">{tx.toAccount || <span className="italic text-rose-400">Unspecified</span>}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              From: <span className="text-slate-300">{tx.account}</span> → To: <span className="text-blue-300">{tx.toAccount || 'Unspecified'}</span>
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span>{tx.account}</span>
                            {tx.toAccount && <span className="text-slate-500 text-[10px] block">→ {tx.toAccount}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.type === 'INCOME' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' :
                            tx.type === 'EXPENSE' ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' :
                            tx.type === 'CC_PAYMENT' ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50' :
                            'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                          }`}>
                            {tx.type === 'TRANSFER' && <ArrowRightLeft className="w-2.5 h-2.5 mr-1 text-blue-300 shrink-0" />}
                            {tx.type === 'CC_PAYMENT' ? 'CC PAYMENT' : tx.type}
                          </span>
                          {tx.installments && (
                            <span 
                              className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 cursor-help"
                              title={tx.installmentStartDate && tx.installmentEndDate ? `Cycle: ${tx.installmentStartDate} to ${tx.installmentEndDate}` : undefined}
                            >
                              {tx.installments}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-200">
                        {formatCurrency(tx.amount, tx.currency as DisplayCurrency)}
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
                          onClick={() => handleDeleteClick(tx)}
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

      {/* Installment Deletion Options Modal */}
      {installmentTxToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                onClick={() => setInstallmentTxToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-100">Delete Installment Purchase?</h3>
              <p className="text-xs text-slate-400">
                "<span className="text-slate-200 font-semibold">{installmentTxToDelete.title}</span>" on account{' '}
                <span className="text-slate-200 font-semibold">{installmentTxToDelete.account}</span> is part of an installment plan.
              </p>
            </div>

            <div className="p-3.5 bg-[#0d1017] rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Selected Cuota:</span>
                <span className="font-mono font-bold text-amber-300">{installmentTxToDelete.installments || '1'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="font-mono font-bold text-slate-200">{formatCurrency(installmentTxToDelete.amount, installmentTxToDelete.currency as DisplayCurrency)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={handleDeleteAllCuotasInGroup}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ALL Installments in this Series</span>
              </button>

              <button
                onClick={handleDeleteOnlySingleCuota}
                className="w-full py-2.5 px-4 bg-[#21262d] hover:bg-[#30363d] border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors text-center"
              >
                Delete ONLY this single Cuota ({installmentTxToDelete.installments || '1'})
              </button>

              <button
                onClick={() => setInstallmentTxToDelete(null)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors text-center mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Category Modal */}
      {bulkActionTarget === 'CATEGORY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Move to Category
              </h3>
              <button onClick={() => setBulkActionTarget(null)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400">Select a target category for {selectedIds.size} items:</p>
            
            <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {categoriesList.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleBulkUpdateCategory(cat.name)}
                  className="w-full text-left px-4 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 text-slate-200 text-xs font-medium transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>{cat.name}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setBulkActionTarget(null)}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk Account Modal */}
      {bulkActionTarget === 'ACCOUNT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wallet2 className="w-5 h-5 text-emerald-400" />
                Change Account
              </h3>
              <button onClick={() => setBulkActionTarget(null)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400">Select target account for {selectedIds.size} items:</p>
            
            <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {accountsList.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleBulkUpdateAccount(acc.name)}
                  className="w-full text-left px-4 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-slate-200 text-xs font-medium transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet2 className="w-4 h-4 text-emerald-400" />
                    <span>{acc.name}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setBulkActionTarget(null)}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
