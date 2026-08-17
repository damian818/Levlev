import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, ViewTab, TransactionFilter, InflationPoint, RecurringRule, AccountCustomBalance } from '../types';
import { analyzeSpending, formatCurrency, computeAccountBalances, computePredictiveTrend, calculateProjectedBalance, getCurrentMonthKey, getDefaultSelectedMonth, computeFutureRecurringProjections, getPendingRecurringForMonth, detectFinancialAnomalies, detectRecurringItems, detectRecurringThresholdAlerts } from '../utils/financeUtils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight, Award, ExternalLink, ChevronRight, Sparkles, Sliders, Calendar, Zap, FileDown, Upload, Sparkle, ShoppingBag, Coffee, Car, Film, ChevronDown, ChevronUp } from 'lucide-react';
import { MonthlyCategoryDonut } from './MonthlyCategoryDonut';
import { EmptyState } from './EmptyState';
import { generateMonthlyPdfReport } from '../utils/pdfReport';
import { MonthlyHeatmap } from './MonthlyHeatmap';
import { CategoryTrendModal } from './CategoryTrendModal';

interface OverviewTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  recurringRules?: RecurringRule[];
  nonRecurringKeys?: string[];
  customBalances?: Record<string, AccountCustomBalance>;
  onNavigateTab: (tab: ViewTab) => void;
  onNavigateToTransactionsWithFilter: (filter: TransactionFilter) => void;
  onOpenImportModal?: () => void;
  onAddTransaction?: (tx: Transaction | Transaction[]) => void;
  currentUserId?: string;
  showSharedData?: boolean;
  userTimezone?: string;
  recurringThresholds?: Record<string, number>;
  globalRecurringThreshold?: number;
}

export const OverviewTab = React.memo(function OverviewTab({
  transactions,
  displayCurrency,
  usdArsRate,
  historyData,
  recurringRules = [],
  nonRecurringKeys = [],
  customBalances,
  onNavigateTab,
  onNavigateToTransactionsWithFilter,
  onOpenImportModal,
  onAddTransaction,
  currentUserId,
  showSharedData = true,
  recurringThresholds = {},
  globalRecurringThreshold = 15,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const [velocityMultiplier, setVelocityMultiplier] = useState<number>(1.0);
  const [showCategoryTrend, setShowCategoryTrend] = useState<boolean>(false);
  const [showForecasts, setShowForecasts] = useState<boolean>(false);
  const [usdTimeframe, setUsdTimeframe] = useState<'3M' | '6M' | '1Y' | 'ALL'>('6M');
  const [showAdvancedForecasting, setShowAdvancedForecasting] = useState<boolean>(false);

  // Filter transactions based on shared data preference
  const filteredTransactions = useMemo(() => {
    if (showSharedData) return transactions;
    return transactions.filter(t => {
      const isShared = t.ownerId && currentUserId && t.ownerId !== currentUserId;
      return !isShared;
    });
  }, [transactions, showSharedData, currentUserId]);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    filteredTransactions.forEach(t => {
      if (t.date) set.add(t.date.substring(0, 7));
    });
    set.add(currentMonthKey);
    
    // Add next month for forecast selection
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
    set.add(`${nextY}-${nextM}`);
    
    return Array.from(set).sort().reverse();
  }, [filteredTransactions, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultSelectedMonth(filteredTransactions));
  const [chartStartMonth, setChartStartMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const sorted = [...availableMonths].sort();
    const found = sorted.find(m => m >= target);
    return found || (sorted.length > 0 ? sorted[0] : target);
  });
  const [chartEndMonth, setChartEndMonth] = useState<string>(currentMonthKey);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth) && selectedMonth !== 'ALL') {
      setSelectedMonth(getDefaultSelectedMonth(filteredTransactions));
    }
  }, [availableMonths, selectedMonth, filteredTransactions]);

  const effectiveNonRecurringKeys = useMemo(() => {
    if (nonRecurringKeys && nonRecurringKeys.length > 0) return nonRecurringKeys;
    try {
      const raw = localStorage.getItem('levlev_non_recurring_keys') || localStorage.getItem('finance_app_non_recurring_keys');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [nonRecurringKeys]);

  const effectiveRecurringRules = useMemo(() => {
    if (recurringRules && recurringRules.length > 0) return recurringRules;
    try {
      const raw = localStorage.getItem('finance_app_recurring_rules');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [recurringRules]);

  const spending = useMemo(() => analyzeSpending(filteredTransactions, displayCurrency, usdArsRate, selectedMonth), [filteredTransactions, displayCurrency, usdArsRate, selectedMonth]);

  const accounts = useMemo(() => computeAccountBalances(filteredTransactions, usdArsRate, customBalances), [filteredTransactions, usdArsRate, customBalances]);
  const { trendData, metrics } = useMemo(() => computePredictiveTrend(filteredTransactions, displayCurrency, usdArsRate, effectiveRecurringRules, customBalances, historyData, effectiveNonRecurringKeys), [filteredTransactions, displayCurrency, usdArsRate, effectiveRecurringRules, customBalances, historyData, effectiveNonRecurringKeys]);
  
  const projectedBalanceResult = useMemo(() => calculateProjectedBalance(filteredTransactions, effectiveRecurringRules, effectiveNonRecurringKeys, displayCurrency, usdArsRate, customBalances, 6, historyData), [filteredTransactions, effectiveRecurringRules, effectiveNonRecurringKeys, displayCurrency, usdArsRate, customBalances, historyData]);

  const isCurrentMonth = selectedMonth === currentMonthKey;
  const isFutureMonth = selectedMonth > currentMonthKey;
  
  const displayedSpending = useMemo(() => {
    if (!showForecasts) return spending;
    
    if (isFutureMonth) {
      const projections = computeFutureRecurringProjections(filteredTransactions, displayCurrency, usdArsRate, 24, recurringRules, nonRecurringKeys);
      const targetProj = projections.find(p => p.month === selectedMonth);
      if (targetProj) {
        return {
          ...spending,
          totalIncome: targetProj.income,
          totalExpenses: targetProj.expense,
          netSavings: targetProj.net,
          savingsRate: targetProj.income > 0 ? (targetProj.net / targetProj.income) * 100 : 0,
          isForecast: true
        };
      }
    } else if (isCurrentMonth) {
      const pendingMonthData = getPendingRecurringForMonth(selectedMonth, filteredTransactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
      const effPendingIncome = pendingMonthData.totalPendingIncome;
      const effPendingExpense = pendingMonthData.totalPendingExpense;

      return {
        ...spending,
        totalIncome: spending.totalIncome + effPendingIncome,
        totalExpenses: spending.totalExpenses + effPendingExpense,
        netSavings: (spending.totalIncome + effPendingIncome) - (spending.totalExpenses + effPendingExpense),
        savingsRate: (spending.totalIncome + effPendingIncome) > 0 
          ? (((spending.totalIncome + effPendingIncome) - (spending.totalExpenses + effPendingExpense)) / (spending.totalIncome + effPendingIncome)) * 100 
          : 0,
        isForecast: true
      };
    }
    
    return spending;
  }, [spending, showForecasts, selectedMonth, currentMonthKey, filteredTransactions, displayCurrency, usdArsRate, recurringRules, nonRecurringKeys, isFutureMonth, isCurrentMonth]);

  // Filter trend data based on date filters
  const filteredTrendData = useMemo(() => {
    return trendData.filter(pt => {
      const mKey = pt.month.substring(0, 7);
      if (mKey > chartEndMonth) return false;
      return mKey >= chartStartMonth;
    });
  }, [trendData, chartStartMonth, chartEndMonth]);

  // Velocity adjustments
  const adjustedMetrics = useMemo(() => {
    const adj = {
      ...metrics,
      projectedRemainingVariableExpense: metrics.projectedRemainingVariableExpense * velocityMultiplier,
      projectedEOMExpense: metrics.currentDayOfMonth > 0 
        ? (metrics.projectedEOMExpense - metrics.projectedRemainingVariableExpense) + (metrics.projectedRemainingVariableExpense * velocityMultiplier)
        : metrics.projectedEOMExpense,
    };
    adj.projectedEOMNet = adj.projectedEOMIncome - adj.projectedEOMExpense;
    adj.projectedEOMBalance = metrics.currentLiquidBalance + (adj.pendingRecurringIncome - adj.pendingRecurringExpense - adj.projectedRemainingVariableExpense);
    return adj;
  }, [metrics, velocityMultiplier]);

  const adjustedTrendData = useMemo(() => {
    return filteredTrendData.map(pt => {
      if (pt.month.includes('EOM Est.')) {
        return {
          ...pt,
          forecastBalance: Math.round(adjustedMetrics.projectedEOMBalance),
          projectedExpense: Math.round(adjustedMetrics.projectedEOMExpense),
          projectedNet: Math.round(adjustedMetrics.projectedEOMNet),
        };
      }
      return pt;
    });
  }, [filteredTrendData, adjustedMetrics]);

  const totalAssetsDisplay = displayCurrency === 'USD' 
    ? accounts.reduce((acc, curr) => acc + curr.balanceUSD, 0)
    : accounts.reduce((acc, curr) => acc + curr.balanceARS, 0);

  const totalUSDAssets = accounts.reduce((acc, curr) => acc + curr.balanceUSD, 0);
  const totalARSAssets = accounts.reduce((acc, curr) => acc + curr.balanceARS, 0);

  // DYNAMIC USD BALANCE TRAJECTORY WITH TIMEFRAME SELECTOR
  const usdBalanceTrend = useMemo(() => {
    let monthLimit = 6;
    if (usdTimeframe === '3M') monthLimit = 3;
    else if (usdTimeframe === '6M') monthLimit = 6;
    else if (usdTimeframe === '1Y') monthLimit = 12;
    else if (usdTimeframe === 'ALL') monthLimit = 999;

    const allHistoricalMonths = [...availableMonths]
      .filter(m => m !== 'ALL' && m <= currentMonthKey)
      .sort();

    const selectedMonths = monthLimit >= allHistoricalMonths.length 
      ? allHistoricalMonths 
      : allHistoricalMonths.slice(-monthLimit);

    if (selectedMonths.length === 0) return [];

    // Calculate monthly net USD changes
    const monthlyNetUSD = new Map<string, number>();
    selectedMonths.forEach(m => monthlyNetUSD.set(m, 0));

    filteredTransactions.forEach(t => {
      if (!t.date) return;
      const m = t.date.substring(0, 7);
      if (!monthlyNetUSD.has(m)) return;
      
      const isExpense = t.type === 'EXPENSE';
      const isIncome = t.type === 'INCOME';
      if (!isExpense && !isIncome) return;

      const rate = usdArsRate > 0 ? usdArsRate : 1000;
      const amountUSD = t.currency === 'USD' ? t.amount : t.amount / rate;
      const current = monthlyNetUSD.get(m) || 0;
      monthlyNetUSD.set(m, current + (isIncome ? amountUSD : -amountUSD));
    });

    // Walk backwards from current totalUSDAssets
    const balances: { month: string; balance: number; netChange: number }[] = [];
    let currentBalance = totalUSDAssets;

    for (let i = selectedMonths.length - 1; i >= 0; i--) {
      const m = selectedMonths[i];
      const net = monthlyNetUSD.get(m) || 0;
      balances.unshift({
        month: m,
        balance: Math.max(0, Math.round(currentBalance)),
        netChange: Math.round(net)
      });
      currentBalance = currentBalance - net;
    }

    return balances;
  }, [availableMonths, currentMonthKey, totalUSDAssets, usdTimeframe, filteredTransactions, usdArsRate]);

  // RECENT TRANSACTIONS (Strictly past and today's transactions only - no future items)
  const recentTransactions = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    return [...filteredTransactions]
      .filter(tx => tx.date && tx.date <= today)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [filteredTransactions]);

  const getMerchantIcon = (description: string, category?: string) => {
    const desc = (description || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    if (desc.includes('uber') || desc.includes('cabify') || cat.includes('transport')) return <Car className="w-4 h-4 text-emerald-400" />;
    if (desc.includes('amazon') || cat.includes('shopping')) return <ShoppingBag className="w-4 h-4 text-blue-400" />;
    if (desc.includes('starbucks') || desc.includes('cafe') || cat.includes('dining')) return <Coffee className="w-4 h-4 text-amber-400" />;
    if (desc.includes('netflix') || desc.includes('spotify') || cat.includes('entertainment')) return <Film className="w-4 h-4 text-purple-400" />;
    return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
  };

  const incomeTxCount = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'INCOME' && (selectedMonth === 'ALL' || (t.date && t.date.startsWith(selectedMonth)))).length;
  }, [filteredTransactions, selectedMonth]);

  const expenseTxCount = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'EXPENSE' && (selectedMonth === 'ALL' || (t.date && t.date.startsWith(selectedMonth)))).length;
  }, [filteredTransactions, selectedMonth]);

  const topCategoryShare = displayedSpending.topCategories.length > 0 && displayedSpending.totalExpenses > 0
    ? (displayedSpending.topCategories[0].amount / displayedSpending.totalExpenses) * 100
    : 0;

  const anomalies = useMemo(() => {
    if (selectedMonth === 'ALL') return [];
    return detectFinancialAnomalies(filteredTransactions, displayCurrency, usdArsRate, selectedMonth);
  }, [filteredTransactions, displayCurrency, usdArsRate, selectedMonth]);

  const recurringAlerts = useMemo(() => {
    const rawItems = detectRecurringItems(filteredTransactions, displayCurrency, usdArsRate);
    const activeItems = rawItems.filter(item => !effectiveNonRecurringKeys.includes(item.title.toLowerCase().trim()));
    return detectRecurringThresholdAlerts(activeItems, recurringThresholds, globalRecurringThreshold);
  }, [filteredTransactions, displayCurrency, usdArsRate, effectiveNonRecurringKeys, recurringThresholds, globalRecurringThreshold]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            {t('overview.total_net_worth')}
          </h2>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
          <EmptyState
            icon={Sparkle}
            title={t('overview.no_transactions')}
            description={t('overview.billing_period_desc')}
            action={onOpenImportModal ? {
              label: t('nav.import'),
              onClick: onOpenImportModal
            } : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      {/* 1. TOP BILLING PERIOD & ACTIONS BAR */}
      <div className="bg-[#11141c] px-4 py-3 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              <span>{t('overview.billing_period')}</span>
              <span className="text-emerald-400 font-mono">{selectedMonth === 'ALL' ? t('common.all') : selectedMonth}</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400">{t('overview.billing_period_desc')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Month Dropdown */}
          <div className="flex items-center space-x-2 bg-[#121620] px-3 py-1.5 rounded-xl border border-slate-800 text-xs flex-1 sm:flex-none">
            <span className="text-slate-400 font-medium hidden md:inline">{t('overview.select_month')}</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none py-0 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-0 w-full sm:w-auto cursor-pointer"
            >
              <option value="ALL" className="bg-[#121620] text-slate-100">{t('common.all')}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-[#121620] text-slate-100">
                  {m} {m === currentMonthKey ? `(${t('common.today')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Forecast Toggle Button */}
          <button
            onClick={() => setShowForecasts(!showForecasts)}
            className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs flex-1 sm:flex-none cursor-pointer ${
              showForecasts 
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                : 'bg-[#121620] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${showForecasts ? 'animate-pulse' : ''}`} />
            <span>{showForecasts ? t('overview.forecast_on') : t('overview.show_forecasts')}</span>
          </button>

          {/* Import CSV */}
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="flex items-center justify-center space-x-1.5 bg-[#121620] hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex-1 sm:flex-none"
              title={t('common.import_csv')}
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('nav.import')}</span>
            </button>
          )}

          {/* Export PDF */}
          <button
            onClick={() =>
              generateMonthlyPdfReport({
                selectedMonth,
                transactions: filteredTransactions,
                displayCurrency,
                usdArsRate,
              })
            }
            className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex-1 sm:flex-none"
            title={t('reports.export_pdf_report')}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{t('common.export_pdf')}</span>
          </button>
        </div>
      </div>

      {/* 2. LEAN UNIFIED CORE FINANCIAL SNAPSHOT (4 Primary Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Net Worth */}
        <div 
          onClick={() => onNavigateTab('accounts')}
          className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 hover:border-emerald-500/50 hover:bg-[#141b2a] transition-all cursor-pointer shadow-sm group relative"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                {t('overview.net_worth')}
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight pt-1">
                {formatCurrency(totalAssetsDisplay, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
              <Award className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-slate-400 font-mono">
              ${formatCurrency(totalUSDAssets, 'USD')} • {formatCurrency(totalARSAssets, 'ARS')}
            </span>
            <span className="text-emerald-400/90 font-semibold group-hover:underline">
              {t('overview.liquid_accounts', { count: accounts.length })} →
            </span>
          </div>
        </div>

        {/* Metric 2: Monthly Income */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            type: 'INCOME', 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 hover:border-emerald-500/50 hover:bg-[#141b2a] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                {t('overview.monthly_income')}
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                {(displayedSpending as any).isForecast && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500/15 text-amber-400 text-[8px] font-bold rounded border border-amber-500/30 animate-pulse">FCST</span>
                )}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight pt-1">
                {formatCurrency(displayedSpending.totalIncome, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
              <ArrowUpRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              +{incomeTxCount} {t('common.income')}
            </span>
            <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
              {t('overview.view_all')} →
            </span>
          </div>
        </div>

        {/* Metric 3: Monthly Expenses */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            type: 'EXPENSE', 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 hover:border-rose-500/50 hover:bg-[#141b2a] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 group-hover:text-rose-400 transition-colors">
                {t('overview.monthly_expenses')}
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                {(displayedSpending as any).isForecast && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500/15 text-amber-400 text-[8px] font-bold rounded border border-amber-500/30 animate-pulse">FCST</span>
                )}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight pt-1">
                {formatCurrency(displayedSpending.totalExpenses, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl group-hover:bg-rose-500/20 transition-colors">
              <ArrowDownRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              -{expenseTxCount} {t('common.expense')}
            </span>
            <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
              {t('overview.view_all')} →
            </span>
          </div>
        </div>

        {/* Metric 4: Net Savings & Savings Rate */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 hover:border-slate-700 hover:bg-[#141b2a] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 group-hover:text-slate-200 transition-colors">
                {t('overview.net_savings')}
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <h3 className={`text-xl sm:text-2xl font-black tracking-tight pt-1 ${displayedSpending.netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {displayedSpending.netSavings >= 0 ? '+' : ''}{formatCurrency(displayedSpending.netSavings, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl group-hover:bg-slate-700 transition-colors">
              <Wallet className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-slate-400 font-medium">
              {t('nav.rate')}: <strong className="text-slate-100">{displayedSpending.savingsRate.toFixed(1)}%</strong>
            </span>
            <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
              {t('overview.view_all')} →
            </span>
          </div>
        </div>
      </div>

      {/* 3. SMART SIGNALS & ALERTS BANNER (Compact & Actionable) */}
      {(anomalies.length > 0 && selectedMonth !== 'ALL') || recurringAlerts.length > 0 || (topCategoryShare > 40 && displayedSpending.totalExpenses > 0) ? (
        <div className="bg-[#111622] border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('overview.quick_insights')}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {anomalies.length > 0 && (
                <button
                  onClick={() => onNavigateToTransactionsWithFilter({ category: anomalies[0].category, month: selectedMonth !== 'ALL' ? selectedMonth : undefined })}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                >
                  {t('overview.anomalies_detected')} ({anomalies.length})
                </button>
              )}
              {recurringAlerts.length > 0 && (
                <button
                  onClick={() => onNavigateTab('recurring')}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
                >
                  {t('overview.recurring_deviation')} ({recurringAlerts.length})
                </button>
              )}
            </div>
          </div>
          
          <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            {anomalies.length > 0 ? (
              <p className="text-[11px] text-slate-400">
                {t('overview.anomaly_desc', { category: anomalies[0].category, percent: anomalies[0].percentageIncrease.toFixed(0) })}
              </p>
            ) : recurringAlerts.length > 0 ? (
              <p className="text-[11px] text-slate-400">
                {t('overview.deviation_desc', { 
                  title: recurringAlerts[0].title, 
                  percent: recurringAlerts[0].deviationPercent.toFixed(0),
                  latest: formatCurrency(recurringAlerts[0].latestAmount, displayCurrency),
                  avg: formatCurrency(recurringAlerts[0].priorAvgAmount, displayCurrency)
                })}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                {t('overview.top_category_accounts_for', { 
                  category: displayedSpending.topCategories[0]?.category || 'N/A', 
                  percentage: topCategoryShare.toFixed(1) 
                })}
              </p>
            )}
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold self-end sm:self-auto cursor-pointer"
            >
              {t('overview.view_all_transactions')}
            </button>
          </div>
        </div>
      ) : null}

      {/* 4. PRIMARY ANALYTICS: USD BALANCE TRAJECTORY + RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left (7 cols): USD Liquid Balance Trend with Working Timeframe Buttons */}
        <div className="lg:col-span-7 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{t('overview.usd_balance_trend')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                    ${totalUSDAssets.toLocaleString()} USD
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('overview.usd_balance_desc')}</p>
            </div>

            {/* WORKING TIMEFRAME SELECTOR BUTTONS */}
            <div className="flex items-center bg-[#161d2b] p-0.5 rounded-xl border border-slate-700/80 shrink-0">
              {(['3M', '6M', '1Y', 'ALL'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setUsdTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    usdTimeframe === tf
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={t(`overview.timeframe_${tf.toLowerCase()}_long` as any)}
                >
                  {t(`overview.timeframe_${tf.toLowerCase()}` as any)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usdBalanceTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="usdBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2433" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val) || 0, 'USD'), t('overview.net_worth')]}
                  contentStyle={{
                    backgroundColor: '#161d2b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#usdBalanceGrad)" 
                  activeDot={{ r: 5, fill: '#10b981', stroke: '#0e1622', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right (5 cols): Recent Transactions (Strictly past and today's transactions only) */}
        <div className="lg:col-span-5 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-100">{t('overview.recent_transactions')}</h3>
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
              >
                {t('overview.view_all_transactions')}
              </button>
            </div>

            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const isExpense = tx.type === 'EXPENSE';
                return (
                  <div
                    key={tx.id}
                    onClick={() => onNavigateToTransactionsWithFilter({ search: tx.description || tx.title })}
                    className="p-2.5 rounded-xl bg-[#141b29] hover:bg-[#192233] border border-slate-800/80 transition-all flex items-center justify-between text-xs cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-8 h-8 rounded-full bg-[#1c2436] border border-slate-700/60 flex items-center justify-center shrink-0">
                        {getMerchantIcon(tx.description || tx.title || '', tx.category)}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                          {tx.description || tx.title || tx.category || 'Transaction'}
                        </p>
                        <p className="text-[10px] text-slate-400">{tx.date} • {tx.account || 'Account'}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono font-bold">
                      <span className={isExpense ? 'text-rose-400' : 'text-emerald-400'}>
                        {isExpense ? '-' : '+'}{formatCurrency(tx.amount, tx.currency as DisplayCurrency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-center">
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
            >
              {t('overview.showing_x_of_y', { count: recentTransactions.length, total: filteredTransactions.length })}
            </button>
          </div>
        </div>
      </div>

      {/* 5. CASH FLOW & CATEGORY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left (7 cols): Monthly Cash Flow Trends (Income vs Expense) */}
        <div className="lg:col-span-7 bg-[#11141c] p-5 rounded-2xl border border-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{t('overview.cash_flow_trend_title')}</span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t('overview.cash_flow_trend_desc')}</p>
            </div>
            
            <div className="flex items-center space-x-1.5 bg-[#121620] px-2 py-1 rounded-lg border border-slate-800 text-[10px]">
              <span className="text-slate-500 font-medium">{t('overview.range')}</span>
              <select
                value={chartStartMonth}
                onChange={(e) => setChartStartMonth(e.target.value)}
                className="bg-transparent border-none text-slate-100 focus:outline-none cursor-pointer p-0"
              >
                {[...availableMonths].sort().map(m => (
                  <option key={m} value={m} className="bg-[#161b22] text-slate-100">{m}</option>
                ))}
              </select>
              <span className="text-slate-500">→</span>
              <select
                value={chartEndMonth}
                onChange={(e) => setChartEndMonth(e.target.value)}
                className="bg-transparent border-none text-slate-100 focus:outline-none cursor-pointer p-0"
              >
                {[...availableMonths].sort().reverse().map(m => (
                  <option key={m} value={m} className="bg-[#161b22] text-slate-100">{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={adjustedTrendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" stroke="#8b949e" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
                <YAxis yAxisId="left" stroke="#8b949e" fontSize={9} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
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
                <Legend formatter={(value) => t(`common.${value.toLowerCase()}`, { defaultValue: value })} />
                <Bar 
                  yAxisId="left"
                  dataKey="income" 
                  name={t('common.income')} 
                  fill="#34d399" 
                  radius={[4, 4, 0, 0]} 
                  onClick={(data: any) => {
                    const month = data?.month || data?.payload?.month;
                    if (month) onNavigateToTransactionsWithFilter({ type: 'INCOME', month: String(month).substring(0, 7) });
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="expense" 
                  name={t('common.expense')} 
                  fill="#fb7185" 
                  radius={[4, 4, 0, 0]} 
                  onClick={(data: any) => {
                    const month = data?.month || data?.payload?.month;
                    if (month) onNavigateToTransactionsWithFilter({ type: 'EXPENSE', month: String(month).substring(0, 7) });
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right (5 cols): Monthly Spending Donut Breakdown */}
        <div className="lg:col-span-5 bg-[#11141c] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <MonthlyCategoryDonut
            transactions={filteredTransactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            selectedMonth={selectedMonth}
            onNavigateToTransactionsWithFilter={onNavigateToTransactionsWithFilter}
            showForecasts={showForecasts}
          />
        </div>
      </div>

      {/* 6. BIGGEST EXPENSES (TOP MERCHANTS TABLE) */}
      <div className="bg-[#11141c] p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{t('overview.biggest_expenses')}</span>
              {!showSharedData && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{t('overview.all_owned_data')}</span>
              )}
            </h3>
            <p className="text-xs text-slate-400">{t('overview.biggest_expenses_desc')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase">
                <th className="pb-2.5 font-medium">{t('overview.merchant_title')}</th>
                <th className="pb-2.5 font-medium text-right">{t('overview.total_spent')}</th>
                <th className="pb-2.5 font-medium text-right">{t('overview.share_of_expenses')}</th>
                <th className="pb-2.5 font-medium text-center">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedSpending.topMerchants.slice(0, 5).map((m, idx) => {
                const percentage = displayedSpending.totalExpenses > 0 ? (m.amount / displayedSpending.totalExpenses) * 100 : 0;
                return (
                  <tr 
                    key={idx} 
                    onClick={() => onNavigateToTransactionsWithFilter({ 
                      search: m.merchant, 
                      month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
                    })}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{m.merchant}</span>
                        {m.category && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                            {m.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-100 font-mono">{formatCurrency(m.amount, displayCurrency)}</td>
                    <td className="py-2.5 text-right text-slate-400">
                      <div className="flex items-center justify-end space-x-2">
                        <span className="font-mono">{percentage.toFixed(1)}%</span>
                        <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-slate-500 group-hover:text-slate-300">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700">{t('overview.filter_action')}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. OPTIONAL COLLAPSIBLE ADVANCED FORECASTING & DAILY CALENDAR */}
      <div className="bg-[#11141c] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAdvancedForecasting(prev => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-200">{t('overview.eom_forecast_title')} & {t('overview.calendar_title')}</h4>
              <p className="text-[10px] sm:text-xs text-slate-400">{t('overview.calendar_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs font-semibold">{showAdvancedForecasting ? t('common.hide') : t('common.show')}</span>
            {showAdvancedForecasting ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvancedForecasting && (
          <div className="p-5 border-t border-slate-800 space-y-6">
            {/* End-of-Month Predictive Forecasting Mini Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-300">{t('overview.live_velocity_model')}</span>
                <div className="flex items-center space-x-2 bg-[#121620] px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                  <Sliders className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400">{t('overview.spending_pace')}</span>
                  <select
                    value={velocityMultiplier}
                    onChange={(e) => setVelocityMultiplier(Number(e.target.value))}
                    className="bg-[#161b22] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-400 font-semibold focus:outline-none"
                  >
                    <option value={0.8}>0.8x (-20%)</option>
                    <option value={1.0}>1.0x (100%)</option>
                    <option value={1.2}>1.2x (+20%)</option>
                    <option value={1.5}>1.5x (+50%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-[#121620] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center">
                    <Zap className="w-3 h-3 text-amber-400 mr-1 shrink-0" />
                    <span>{t('overview.current_daily_velocity')}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-100 font-mono">
                    {formatCurrency(metrics.dailyExpenseVelocity, displayCurrency)}<span className="text-[10px] font-normal text-slate-500">/day</span>
                  </div>
                </div>

                <div className="bg-[#121620] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400 mr-1 shrink-0" />
                    <span>{t('overview.pending_recurring_inflow')}</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    +{formatCurrency(metrics.pendingRecurringIncome, displayCurrency)}
                  </div>
                </div>

                <div className="bg-[#121620] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center">
                    <ArrowDownRight className="w-3 h-3 text-rose-400 mr-1 shrink-0" />
                    <span>{t('overview.pending_recurring_bills')}</span>
                  </div>
                  <div className="text-sm font-bold text-rose-400 font-mono">
                    -{formatCurrency(metrics.pendingRecurringExpense, displayCurrency)}
                  </div>
                </div>

                <div className="bg-[#121620] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{t('overview.predicted_eom_assets')}</span>
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  </div>
                  <div className="text-sm font-bold text-amber-400 font-mono">
                    {formatCurrency(adjustedMetrics.projectedEOMBalance, displayCurrency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Calendar Heatmap */}
            <div>
              <MonthlyHeatmap
                transactions={filteredTransactions}
                selectedMonth={selectedMonth}
                displayCurrency={displayCurrency}
                usdArsRate={usdArsRate}
                recurringRules={recurringRules}
                nonRecurringKeys={nonRecurringKeys}
                onAddTransaction={onAddTransaction}
              />
            </div>
          </div>
        )}
      </div>

      <CategoryTrendModal
        isOpen={showCategoryTrend}
        onClose={() => setShowCategoryTrend(false)}
        transactions={filteredTransactions}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
        historyData={historyData}
      />
    </div>
  );
});
