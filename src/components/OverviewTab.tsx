import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, DisplayCurrency, ViewTab, TransactionFilter, InflationPoint } from '../types';
import { analyzeSpending, formatCurrency, computeAccountBalances, computePredictiveTrend, getLatestMonth, getCurrentMonthKey, getDefaultSelectedMonth } from '../utils/financeUtils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight, Award, ExternalLink, ChevronRight, Layers, Sparkles, Sliders, Calendar, Zap, FileDown, LineChart as ChartIcon } from 'lucide-react';
import { MonthlyCategoryDonut } from './MonthlyCategoryDonut';
import { generateMonthlyPdfReport } from '../utils/pdfReport';
import { MonthlyHeatmap } from './MonthlyHeatmap';
import { CategoryTrendModal } from './CategoryTrendModal';

interface OverviewTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  onNavigateTab: (tab: ViewTab) => void;
  onNavigateToTransactionsWithFilter: (filter: TransactionFilter) => void;
}

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f43f5e', '#38bdf8', '#818cf8', '#fb7185'];

export function OverviewTab({
  transactions,
  displayCurrency,
  usdArsRate,
  historyData,
  onNavigateTab,
  onNavigateToTransactionsWithFilter,
}: OverviewTabProps) {
  const [velocityMultiplier, setVelocityMultiplier] = useState<number>(1.0);
  const [showCategoryTrend, setShowCategoryTrend] = useState<boolean>(false);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
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
  }, [transactions, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultSelectedMonth(transactions));
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
      setSelectedMonth(getDefaultSelectedMonth(transactions));
    }
  }, [availableMonths]);

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate, selectedMonth);
  const accounts = computeAccountBalances(transactions, usdArsRate);
  const { trendData, metrics } = computePredictiveTrend(transactions, displayCurrency, usdArsRate, undefined, undefined, historyData);

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
    ? accounts.reduce((acc, curr) => acc + (curr.balanceUSD > 0 ? curr.balanceUSD : 0), 0)
    : accounts.reduce((acc, curr) => acc + (curr.balanceARS > 0 ? curr.balanceARS : 0), 0);

  const pieData = spending.topCategories.slice(0, 6).map(c => ({
    name: c.category,
    value: c.amount
  }));

  // Risk detection
  const topCategoryShare = spending.topCategories.length > 0 && spending.totalExpenses > 0
    ? (spending.topCategories[0].amount / spending.totalExpenses) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Month Filter Selector Bar */}
      <div className="bg-[#161b22] px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl border border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 sm:p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Overview Billing Period:</span>
              <span className="text-emerald-400 font-mono">{selectedMonth === 'ALL' ? 'All Time' : selectedMonth}</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400">KPI totals and category summaries filtered for this period.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center space-x-2 bg-[#121620] px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs flex-1 sm:flex-none">
            <span className="text-slate-400 font-medium hidden sm:inline">Select Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none py-0 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-0 w-full sm:w-auto"
            >
              <option value="ALL">All Available Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m} {m === currentMonthKey ? '(Current Month)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() =>
              generateMonthlyPdfReport({
                selectedMonth,
                transactions,
                displayCurrency,
                usdArsRate,
              })
            }
            className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer flex-1 sm:flex-none"
            title="Download PDF Summary Report"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">PDF Report</span>
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
          className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-emerald-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                Total Income
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(spending.totalIncome, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 rounded-lg group-hover:bg-emerald-900/60 transition-colors">
              <ArrowUpRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-emerald-400 font-medium">
            <span>Inflows</span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">View details →</span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            type: 'EXPENSE', 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-rose-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                Total Expenses
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(spending.totalExpenses, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-rose-950/60 border border-rose-800/50 text-rose-400 rounded-lg group-hover:bg-rose-900/60 transition-colors">
              <ArrowDownRight className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-rose-400 font-medium">
            <span>Outflows</span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">View details →</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div 
          onClick={() => onNavigateToTransactionsWithFilter({ 
            month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
          })}
          className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                Net Savings
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </p>
              <h3 className={`text-xl sm:text-2xl font-bold mt-1 ${spending.netSavings >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                {formatCurrency(spending.netSavings, displayCurrency)}
              </h3>
            </div>
            <div className="p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg group-hover:bg-slate-700 transition-colors">
              <Wallet className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
            <span>Rate: <strong className="text-slate-200">{spending.savingsRate.toFixed(1)}%</strong></span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">View details →</span>
          </div>
        </div>

        {/* Liquid Assets Card */}
        <div 
          onClick={() => onNavigateTab('accounts')}
          className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-amber-500/50 hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center">
                Liquid Assets
                <ChevronRight className="w-3 h-3 ml-1 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{formatCurrency(totalAssetsDisplay, displayCurrency)}</h3>
            </div>
            <div className="p-2 bg-amber-950/60 border border-amber-800/50 text-amber-400 rounded-lg group-hover:bg-amber-900/60 transition-colors">
              <Award className="w-4 h-4 sm:w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
            <span>{accounts.length} Accounts</span>
            <span className="text-[9px] sm:text-[10px] text-amber-400/80 group-hover:text-amber-300 transition-colors">Manage →</span>
          </div>
        </div>
      </div>

      {/* Risk & Insights Alert Banner */}
      <div className="bg-[#121620] text-slate-200 p-3 sm:p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
        <div 
          onClick={() => spending.topCategories[0] && onNavigateToTransactionsWithFilter({ category: spending.topCategories[0].category })}
          className="flex items-center space-x-3 cursor-pointer group w-full md:w-auto"
        >
          <div className="p-2 bg-slate-800 border border-slate-700 text-amber-400 rounded-lg group-hover:bg-slate-700 transition-colors shrink-0">
            <ShieldAlert className="w-4 h-4 sm:w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors flex items-center">
              Spending Concentration Risk
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-60 group-hover:opacity-100" />
            </h4>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              Top category (<strong className="text-slate-200">{spending.topCategories[0]?.category || 'N/A'}</strong>) accounts for {topCategoryShare.toFixed(1)}%.
            </p>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('inflation')}
          className="text-[10px] sm:text-xs text-slate-300 bg-[#1a212d] hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer transition-colors flex items-center space-x-1 w-full md:w-auto justify-center md:justify-start"
        >
          <span>Rate: <strong className="text-slate-100">${usdArsRate.toLocaleString()} ARS</strong></span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* NEW: End-of-Month Predictive Forecasting Intelligence Card */}
      <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>End-of-Month Predictive Liquid Balance Forecast</span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold">
                  Live Velocity Model
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Prorates current daily run-rate ({metrics.currentDayOfMonth} days elapsed) + pending recurring salaries & bills.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#121620] px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Spending Pace:</span>
            <select
              value={velocityMultiplier}
              onChange={(e) => setVelocityMultiplier(Number(e.target.value))}
              className="bg-[#161b22] border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-400 font-semibold focus:outline-none"
            >
              <option value={0.8}>0.8x (-20% Frugal)</option>
              <option value={1.0}>1.0x (Current Pace)</option>
              <option value={1.2}>1.2x (+20% Higher)</option>
              <option value={1.5}>1.5x (+50% High Burn)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center">
              <Zap className="w-3.5 h-3.5 text-amber-400 mr-1" />
              <span>Current Daily Velocity</span>
            </div>
            <div className="text-base font-bold text-slate-100">
              {formatCurrency(metrics.dailyExpenseVelocity, displayCurrency)}<span className="text-[11px] font-normal text-slate-500">/day</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Prorated variable remaining: {formatCurrency(adjustedMetrics.projectedRemainingVariableExpense, displayCurrency)}
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 mr-1" />
              <span>Pending Recurring Inflow</span>
            </div>
            <div className="text-base font-bold text-emerald-400">
              +{formatCurrency(metrics.pendingRecurringIncome, displayCurrency)}
            </div>
            <div className="text-[10px] text-slate-500">
              Includes expected salary on 15th
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 mr-1" />
              <span>Pending Recurring Bills</span>
            </div>
            <div className="text-base font-bold text-rose-400">
              -{formatCurrency(metrics.pendingRecurringExpense, displayCurrency)}
            </div>
            <div className="text-[10px] text-slate-500">
              OSDE, Expensas, Cissab & utilities
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Predicted EOM Assets</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base font-bold text-amber-400">
              {formatCurrency(adjustedMetrics.projectedEOMBalance, displayCurrency)}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold">
              Net EOM Delta: {adjustedMetrics.projectedEOMNet >= 0 ? '+' : ''}{formatCurrency(adjustedMetrics.projectedEOMNet, displayCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Visualization Section */}
      <div className="space-y-6">
        {/* Cash Flow Trends with Predictive Line */}
        <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Monthly Cash Flow & Predictive Balance Line</span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Overlaying end-of-month liquid balance trajectory.
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
                        <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
                          <p className="font-bold text-slate-200">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                              <span>{entry.name}:</span>
                              <span className="font-bold">{formatCurrency(entry.value, displayCurrency)}</span>
                            </p>
                          ))}
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
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="income" 
                  name="Income" 
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
                  name="Expense" 
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
                  dataKey="forecastBalance" 
                  name="Predictive EOM Balance" 
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
          transactions={transactions}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
          selectedMonth={selectedMonth}
          onNavigateToTransactionsWithFilter={onNavigateToTransactionsWithFilter}
        />
      </div>

      {/* Biggest Expenses (Top Merchants Table) - Clickable Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Biggest Expenses (Top Merchants)</h3>
              <p className="text-xs text-slate-400">Click any merchant row to filter its individual transactions.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-3 font-medium">Merchant / Title</th>
                  <th className="pb-3 font-medium text-right">Total Spent</th>
                  <th className="pb-3 font-medium text-right">% of Total Expenses</th>
                  <th className="pb-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {spending.topMerchants.slice(0, 6).map((m, idx) => {
                  const percentage = spending.totalExpenses > 0 ? (m.amount / spending.totalExpenses) * 100 : 0;
                  return (
                    <tr 
                      key={idx} 
                      onClick={() => onNavigateToTransactionsWithFilter({ 
                        search: m.merchant, 
                        month: selectedMonth !== 'ALL' ? selectedMonth : undefined 
                      })}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 font-medium text-slate-200 group-hover:text-emerald-400 transition-colors flex items-center">
                        <span>{m.merchant}</span>
                        <ExternalLink className="w-3 h-3 ml-1.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                        <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700">Filter →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <MonthlyHeatmap
            transactions={transactions}
            selectedMonth={selectedMonth}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
          />
        </div>
      </div>

      <CategoryTrendModal
        isOpen={showCategoryTrend}
        onClose={() => setShowCategoryTrend(false)}
        transactions={transactions}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
        historyData={historyData}
      />
    </div>
  );
}

