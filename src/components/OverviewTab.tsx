import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, ViewTab, TransactionFilter, InflationPoint, RecurringRule, AccountCustomBalance } from '../types';
import { analyzeSpending, formatCurrency, computeAccountBalances, computePredictiveTrend, calculateProjectedBalance, getLatestMonth, getCurrentMonthKey, getDefaultSelectedMonth, computeFutureRecurringProjections, getPendingRecurringForMonth } from '../utils/financeUtils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight, Award, ExternalLink, ChevronRight, Layers, Sparkles, Sliders, Calendar, Zap, FileDown, LineChart as ChartIcon, Upload, Sparkle } from 'lucide-react';
import { MonthlyCategoryDonut } from './MonthlyCategoryDonut';
import { EmptyState } from './EmptyState';
import { generateMonthlyPdfReport } from '../utils/pdfReport';
import { MonthlyHeatmap } from './MonthlyHeatmap';
import { CategoryTrendModal } from './CategoryTrendModal';
import { DismissibleBanner } from './DismissibleBanner';

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
}

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f43f5e', '#38bdf8', '#818cf8', '#fb7185'];

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
  userTimezone = 'America/Argentina/Buenos_Aires',
}: OverviewTabProps) {
  const { t } = useTranslation();
  const [velocityMultiplier, setVelocityMultiplier] = useState<number>(1.0);
  const [showCategoryTrend, setShowCategoryTrend] = useState<boolean>(false);
  const [showForecasts, setShowForecasts] = useState<boolean>(false);

  // Filter transactions based on shared data preference
  const filteredTransactions = useMemo(() => {
    if (showSharedData) return transactions;
    return transactions.filter(t => {
      const isShared = t.ownerId && currentUserId && t.ownerId !== currentUserId;
      return !isShared;
    });
  }, [transactions, showSharedData, currentUserId]);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            {t('overview.title')}
          </h2>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
          <EmptyState
            icon={Sparkle}
            title={t('overview.welcome_title', { defaultValue: 'Welcome to LevLev!' })}
            description={t('overview.welcome_desc', { defaultValue: 'Start tracking your personal finances by adding your first account and transaction. We\'ll help you visualize your spending and savings.' })}
            action={onOpenImportModal ? {
              label: t('overview.get_started', { defaultValue: 'Import Data' }),
              onClick: onOpenImportModal
            } : undefined}
          />
        </div>
      </div>
    );
  }

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
  }, [availableMonths]);

  const spending = useMemo(() => analyzeSpending(filteredTransactions, displayCurrency, usdArsRate, selectedMonth), [filteredTransactions, displayCurrency, usdArsRate, selectedMonth]);

  const accounts = useMemo(() => computeAccountBalances(filteredTransactions, usdArsRate, customBalances), [filteredTransactions, usdArsRate, customBalances]);
  const { trendData, metrics } = useMemo(() => computePredictiveTrend(filteredTransactions, displayCurrency, usdArsRate, recurringRules, customBalances, historyData, nonRecurringKeys), [filteredTransactions, displayCurrency, usdArsRate, recurringRules, customBalances, historyData, nonRecurringKeys]);
  
  const projectedBalanceResult = useMemo(() => calculateProjectedBalance(filteredTransactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate, customBalances, 6, historyData), [filteredTransactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate, customBalances, historyData]);

  // Apply forecasts if enabled
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const isFutureMonth = selectedMonth > currentMonthKey;
  
  const displayedSpending = useMemo(() => {
    if (!showForecasts) return spending;
    
    // For future or current month, add pending recurring items
    // If it's a future month, we use the average/latest recurring items as the "forecast"
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
      // Calculate pending recurring items for the current month
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
  }, [spending, showForecasts, selectedMonth, currentMonthKey, filteredTransactions, displayCurrency, usdArsRate, metrics, recurringRules, nonRecurringKeys]);

  // Filter trend data based on date filters
  const filteredTrendData = useMemo(() => {
    return trendData.filter(pt => {
      // Extract month key (YYYY-MM) from pt.month string (handles "(Today)", "(EOM Est.)", "(Fcst)")
      const mKey = pt.month.substring(0, 7);
      
      // If it's a forecast point for a future month (relative to selected chartEndMonth), hide it
      if (mKey > chartEndMonth) {
        return false;
      }
      
      return mKey >= chartStartMonth;
    });
  }, [trendData, chartStartMonth, chartEndMonth]);

  // Apply velocity multiplier adjustment if modified by user
  const adjustedMetrics = {
    ...metrics,
    projectedRemainingVariableExpense: metrics.projectedRemainingVariableExpense * velocityMultiplier,
    projectedEOMExpense: metrics.currentDayOfMonth > 0 
      ? (metrics.projectedEOMExpense - metrics.projectedRemainingVariableExpense) + (metrics.projectedRemainingVariableExpense * velocityMultiplier)
      : metrics.projectedEOMExpense,
  };
  adjustedMetrics.projectedEOMNet = adjustedMetrics.projectedEOMIncome - adjustedMetrics.projectedEOMExpense;
  adjustedMetrics.projectedEOMBalance = metrics.currentLiquidBalance + (adjustedMetrics.pendingRecurringIncome - adjustedMetrics.pendingRecurringExpense - adjustedMetrics.projectedRemainingVariableExpense);

  // Adjust current month EOM point in trend data if velocity multiplier changed
  const adjustedTrendData = filteredTrendData.map(pt => {
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

  const totalAssetsDisplay = displayCurrency === 'USD' 
    ? accounts.reduce((acc, curr) => acc + curr.balanceUSD, 0)
    : accounts.reduce((acc, curr) => acc + curr.balanceARS, 0);

  const pieData = displayedSpending.topCategories.slice(0, 6).map(c => ({
    name: c.category,
    value: c.amount
  }));

  // Risk detection
  const topCategoryShare = displayedSpending.topCategories.length > 0 && displayedSpending.totalExpenses > 0
    ? (displayedSpending.topCategories[0].amount / displayedSpending.totalExpenses) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Month Filter Selector Bar */}
      <div className="bg-[#11141c] px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl border border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 sm:p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
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

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setShowForecasts(!showForecasts)}
            className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all border shadow-sm flex-1 sm:flex-none ${
              showForecasts 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${showForecasts ? 'animate-pulse' : ''}`} />
            <span>{showForecasts ? t('overview.forecast_on') : t('overview.show_forecasts')}</span>
          </button>

          <div className="flex items-center space-x-2 bg-[#121620] px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs flex-1 sm:flex-none">
            <span className="text-slate-400 font-medium hidden sm:inline">{t('overview.select_month')}</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none py-0 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-0 w-full sm:w-auto"
            >
              <option value="ALL">{t('common.all')}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m} {m === currentMonthKey ? `(${t('common.today')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] sm:text-xs font-semibold px-2.5 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer flex-1 sm:flex-none"
              title={t('common.import_csv')}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{t('nav.import')}</span>
            </button>
          )}

          <button
            onClick={() =>
              generateMonthlyPdfReport({
                selectedMonth,
                transactions: filteredTransactions,
                displayCurrency,
                usdArsRate,
              })
            }
            className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer flex-1 sm:flex-none"
            title={t('reports.export_pdf_report')}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{t('common.export_pdf')}</span>
          </button>
        </div>
      </div>
      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Income Card */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            type: 'INCOME', 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#11141c] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-emerald-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                {t('overview.monthly_income')}
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                {(displayedSpending as any).isForecast && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-bold rounded border border-amber-500/20 animate-pulse">FCST</span>
                )}
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(displayedSpending.totalIncome, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 rounded-lg group-hover:bg-emerald-900/60 transition-colors">
              <ArrowUpRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-emerald-400 font-medium">
            <span>{t('common.income')}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">{t('overview.view_all')} →</span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            type: 'EXPENSE', 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#11141c] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-rose-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                {t('overview.monthly_expenses')}
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-rose-400 transition-colors" />
                {(displayedSpending as any).isForecast && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-bold rounded border border-amber-500/20 animate-pulse">FCST</span>
                )}
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(displayedSpending.totalExpenses, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-rose-950/60 border border-rose-800/50 text-rose-400 rounded-lg group-hover:bg-rose-900/60 transition-colors">
              <ArrowDownRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-rose-400 font-medium">
            <span>{t('common.expense')}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">{t('overview.view_all')} →</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#11141c] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                {t('overview.net_savings')}
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-slate-300 transition-colors" />
                {(displayedSpending as any).isForecast && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-bold rounded border border-amber-500/20 animate-pulse">FCST</span>
                )}
              </p>
              <h3 className={`text-xl sm:text-2xl font-bold mt-1 ${displayedSpending.netSavings >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                {formatCurrency(displayedSpending.netSavings, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg group-hover:bg-slate-700 transition-colors">
              <Wallet className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
            <span>{t('nav.rate')} <strong className="text-slate-200">{displayedSpending.savingsRate.toFixed(1)}%</strong></span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">{t('overview.view_all')} →</span>
          </div>
        </div>

        {/* Liquid Assets Card */}
        <div 
          onClick={() => onNavigateTab('accounts')}
          className="bg-[#11141c] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-amber-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                {t('overview.total_net_worth')}
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalAssetsDisplay, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-amber-950/60 border border-amber-800/50 text-amber-400 rounded-lg group-hover:bg-amber-900/60 transition-colors">
              <Award className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
            <span>{accounts.length} {t('nav.accounts')}</span>
            <span className="text-[9px] sm:text-[10px] text-amber-400/80 group-hover:text-amber-300 transition-colors">{t('common.edit')} →</span>
          </div>
        </div>
      </div>

      {/* Risk & Insights Alert Banner */}
      <DismissibleBanner id="risk_alert" variant="info">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div 
            onClick={() => displayedSpending.topCategories[0] && onNavigateToTransactionsWithFilter({ category: displayedSpending.topCategories[0].category })}
            className="flex items-center space-x-3 cursor-pointer group w-full md:w-auto"
          >
            <div className="p-2 bg-slate-800 border border-slate-700 text-amber-400 rounded-lg group-hover:bg-slate-700 transition-colors shrink-0">
              <ShieldAlert className="w-4 h-4 sm:w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors flex items-center">
                {t('overview.concentration_risk')}
                <ExternalLink className="w-3 h-3 ml-1.5 opacity-60 group-hover:opacity-100" />
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                {t('overview.top_category_accounts_for', { 
                  category: displayedSpending.topCategories[0]?.category || 'N/A', 
                  percentage: topCategoryShare.toFixed(1) 
                })}
              </p>
            </div>
          </div>

          <div 
            onClick={() => onNavigateTab('inflation')}
            className="text-[10px] sm:text-xs text-slate-300 bg-[#1a212d] hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer transition-colors flex items-center space-x-1 w-full md:w-auto justify-center md:justify-start"
          >
            <span>{t('nav.rate')} <strong className="text-slate-100">${usdArsRate.toLocaleString()} ARS</strong></span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </DismissibleBanner>

      {/* NEW: End-of-Month Predictive Forecasting Intelligence Card */}
      <DismissibleBanner id="eom_forecast" variant="info" className="!p-0 overflow-hidden">
        <div className="bg-[#11141c] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{t('overview.eom_forecast_title')}</span>
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold">
                    {t('overview.live_velocity_model')}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {t('overview.prorates_desc', { days: metrics.currentDayOfMonth })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-[#121620] px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">{t('overview.spending_pace')}</span>
              <select
                value={velocityMultiplier}
                onChange={(e) => setVelocityMultiplier(Number(e.target.value))}
                className="bg-[#161b22] border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-400 font-semibold focus:outline-none"
              >
                <option value={0.8}>0.8x (-20%)</option>
                <option value={1.0}>1.0x (100%)</option>
                <option value={1.2}>1.2x (+20%)</option>
                <option value={1.5}>1.5x (+50%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-[#121620] p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center">
                <Zap className="w-3.5 h-3.5 text-amber-400 mr-1 shrink-0" />
                <span>{t('overview.current_daily_velocity')}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-100 truncate">
                {formatCurrency(metrics.dailyExpenseVelocity, displayCurrency)}<span className="text-[10px] sm:text-[11px] font-normal text-slate-500">/day</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
                {formatCurrency(adjustedMetrics.projectedRemainingVariableExpense, displayCurrency)}
              </div>
            </div>

            <div className="bg-[#121620] p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 mr-1 shrink-0" />
                <span>{t('overview.pending_recurring_inflow')}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-emerald-400 truncate">
                +{formatCurrency(metrics.pendingRecurringIncome, displayCurrency)}
              </div>
            </div>

            <div className="bg-[#121620] p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 mr-1 shrink-0" />
                <span>{t('overview.pending_recurring_bills')}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-rose-400 truncate">
                -{formatCurrency(metrics.pendingRecurringExpense, displayCurrency)}
              </div>
            </div>

            <div className="bg-[#121620] p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-between">
                <span>{t('overview.predicted_eom_assets')}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <div className="text-sm sm:text-base font-bold text-amber-400 truncate">
                {formatCurrency(adjustedMetrics.projectedEOMBalance, displayCurrency)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold truncate">
                {t('overview.net_eom_delta')}: {adjustedMetrics.projectedEOMNet >= 0 ? '+' : ''}{formatCurrency(adjustedMetrics.projectedEOMNet, displayCurrency)}
              </div>
            </div>
          </div>
        </div>
      </DismissibleBanner>


      {/* Main Charts & Visualization Section */}
      <div className="space-y-6">
        {/* Cash Flow Trends with Predictive Line */}
        <div className="bg-[#11141c] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>{t('overview.cash_flow_trend_title')}</span>
                </h3>
                {projectedBalanceResult.upcomingRecurringItems.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium" title={t('overview.projected_balance_desc')}>
                    <Sparkles className="w-3 h-3" />
                    <span>{projectedBalanceResult.upcomingRecurringItems.length} {t('nav.recurring_short', { defaultValue: 'Recurring' })}</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                {t('overview.projected_balance_desc')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2 bg-[#121620] px-2 py-1 rounded-lg border border-slate-800 text-[10px]">
                <span className="text-slate-500 font-medium hidden xs:inline">Range:</span>
                <select
                  value={chartStartMonth}
                  onChange={(e) => setChartStartMonth(e.target.value)}
                  className="bg-transparent border-none text-slate-100 focus:outline-none cursor-pointer p-0"
                >
                  {[...availableMonths].sort().map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={chartEndMonth}
                  onChange={(e) => setChartEndMonth(e.target.value)}
                  className="bg-transparent border-none text-slate-100 focus:outline-none cursor-pointer p-0"
                >
                   {[...availableMonths].sort().reverse().map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={adjustedTrendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" stroke="#8b949e" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
                <YAxis yAxisId="left" stroke="#8b949e" fontSize={9} hide={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={9} domain={['auto', 'auto']} hide={true} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                              <span>{entry.name}:</span>
                              <span className="font-bold">{formatCurrency(entry.value, displayCurrency)}</span>
                            </p>
                          ))}
                          {data.actualBalance !== undefined && data.actualBalance !== null && (
                            <p className="flex justify-between gap-4 text-slate-400 text-[11px]">
                              <span>{t('overview.actual_balance', { defaultValue: 'Actual Balance' })}:</span>
                              <span className="font-semibold text-slate-300">{formatCurrency(data.actualBalance, displayCurrency)}</span>
                            </p>
                          )}
                          {(data.pendingRecurringIncome > 0 || data.pendingRecurringExpense > 0) && (
                            <div className="pt-1 mt-1 border-t border-slate-800 space-y-0.5 text-[10px]">
                              {data.pendingRecurringIncome > 0 && (
                                <p className="flex justify-between text-emerald-400">
                                  <span>+ {t('overview.pending_recurring_inflow', { defaultValue: 'Pending Inflow' })}:</span>
                                  <span>{formatCurrency(data.pendingRecurringIncome, displayCurrency)}</span>
                                </p>
                              )}
                              {data.pendingRecurringExpense > 0 && (
                                <p className="flex justify-between text-rose-400">
                                  <span>- {t('overview.pending_recurring_bills', { defaultValue: 'Pending Bills' })}:</span>
                                  <span>{formatCurrency(data.pendingRecurringExpense, displayCurrency)}</span>
                                </p>
                              )}
                            </div>
                          )}
                          {data.fxRate && (
                            <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                              FX Rate: 1 USD = {data.fxRate.toLocaleString()} ARS
                            </div>
                          )}
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
                    if (month) {
                      const mKey = String(month).substring(0, 7);
                      onNavigateToTransactionsWithFilter({ type: 'INCOME', month: mKey });
                    } else {
                      onNavigateToTransactionsWithFilter({ type: 'INCOME' });
                    }
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
                    if (month) {
                      const mKey = String(month).substring(0, 7);
                      onNavigateToTransactionsWithFilter({ type: 'EXPENSE', month: mKey });
                    } else {
                      onNavigateToTransactionsWithFilter({ type: 'EXPENSE' });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="projectedBalance" 
                  name={t('overview.projected_balance', { defaultValue: 'Projected Balance' })} 
                  stroke="#f59e0b" 
                  strokeWidth={2.5} 
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#f59e0b', stroke: '#161b22', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                  onClick={(data: any) => {
                    const month = data?.month || data?.payload?.month;
                    if (month) {
                      const mKey = String(month).substring(0, 7);
                      onNavigateToTransactionsWithFilter({ month: mKey });
                    }
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Breakdown of Spending by Category Donut Chart Component */}
        <MonthlyCategoryDonut
          transactions={filteredTransactions}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
          selectedMonth={selectedMonth}
          onNavigateToTransactionsWithFilter={onNavigateToTransactionsWithFilter}
          showForecasts={showForecasts}
        />
      </div>

      {/* Biggest Expenses (Top Merchants Table) - Clickable Rows */}
      <div className="bg-[#11141c] p-5 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>{t('overview.biggest_expenses')}</span>
              {!showSharedData && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">OWNED DATA ONLY</span>
              )}
            </h3>
            <p className="text-xs text-slate-400">{t('overview.biggest_expenses_desc')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase">
                <th className="pb-3 font-medium">{t('overview.merchant_title')}</th>
                <th className="pb-3 font-medium text-right">{t('overview.total_spent')}</th>
                <th className="pb-3 font-medium text-right">{t('overview.share_of_expenses')}</th>
                <th className="pb-3 font-medium text-center">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedSpending.topMerchants.slice(0, 6).map((m, idx) => {
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
                    <td className="py-3 font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{m.merchant}</span>
                        {m.category && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                            {m.category}
                          </span>
                        )}
                        <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-100">{formatCurrency(m.amount, displayCurrency)}</td>
                    <td className="py-3 text-right text-slate-400">
                      <div className="flex items-center justify-end space-x-2">
                        <span>{percentage.toFixed(1)}%</span>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-slate-500 group-hover:text-slate-300">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700">{t('common.filter')} →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Spending & Scheduled Bills Dashlet */}
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

