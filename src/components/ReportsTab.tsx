import React, { useState, useMemo } from 'react';
import { Transaction, DisplayCurrency } from '../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact } from '../utils/financeUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, Calendar, Download, TrendingUp, TrendingDown, DollarSign, 
  Layers, Filter, PieChart as PieChartIcon, Award, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';

interface ReportsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

export function ReportsTab({
  transactions,
  displayCurrency,
  usdArsRate,
}: ReportsTabProps) {
  // Time range state
  const [timeRange, setTimeRange] = useState<'6M' | '12M' | 'ALL'>('12M');
  const [chartMode, setChartMode] = useState<'NATIVE_CURRENCY' | 'CONVERTED'>('NATIVE_CURRENCY');
  const [barStyle, setBarStyle] = useState<'STACKED' | 'GROUPED'>('STACKED');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Colors for charts
  const COLORS = {
    incomeARS: '#10b981', // Emerald 500
    incomeUSD: '#06b6d4', // Cyan 500
    expenseARS: '#f43f5e', // Rose 500
    expenseUSD: '#f59e0b', // Amber 500
    incomeTotal: '#34d399', // Emerald 400
    expenseTotal: '#fb7185', // Rose 400
    netPositive: '#10b981',
    netNegative: '#ef4444',
  };

  const CATEGORY_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', 
    '#14b8a6', '#06b6d4', '#6366f1', '#a855f7', '#d946ef'
  ];

  // Get unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Aggregate monthly data
  const monthlyReportData = useMemo(() => {
    const monthlyMap: Record<string, {
      month: string;
      incomeARS: number;
      incomeUSD: number;
      expenseARS: number;
      expenseUSD: number;
      incomeConverted: number;
      expenseConverted: number;
      netConverted: number;
      txCount: number;
    }> = {};

    transactions.forEach(tx => {
      if (tx.type === 'TRANSFER') return; // Exclude internal transfers from income/expense metrics
      if (selectedCategoryFilter !== 'ALL' && tx.category !== selectedCategoryFilter) return;

      const monthKey = tx.date ? tx.date.substring(0, 7) : 'Unknown';
      if (monthKey === 'Unknown') return;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          incomeARS: 0,
          incomeUSD: 0,
          expenseARS: 0,
          expenseUSD: 0,
          incomeConverted: 0,
          expenseConverted: 0,
          netConverted: 0,
          txCount: 0,
        };
      }

      const item = monthlyMap[monthKey];
      item.txCount++;

      const isUsd = tx.currency?.toUpperCase().includes('USD');
      const amt = tx.amount || 0;
      const converted = convertCurrency(amt, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);

      if (tx.type === 'INCOME') {
        if (isUsd) item.incomeUSD += amt;
        else item.incomeARS += amt;
        item.incomeConverted += converted;
      } else if (tx.type === 'EXPENSE') {
        if (isUsd) item.expenseUSD += amt;
        else item.expenseARS += amt;
        item.expenseConverted += converted;
      }
    });

    let allMonths = Object.keys(monthlyMap).sort();

    // Filter by time range
    if (timeRange === '6M') {
      allMonths = allMonths.slice(-6);
    } else if (timeRange === '12M') {
      allMonths = allMonths.slice(-12);
    }

    return allMonths.map(m => {
      const data = monthlyMap[m];
      data.netConverted = data.incomeConverted - data.expenseConverted;
      return data;
    });
  }, [transactions, timeRange, selectedCategoryFilter, displayCurrency, usdArsRate]);

  // Total summary metrics over selected time range
  const summaryMetrics = useMemo(() => {
    let totalIncomeARS = 0;
    let totalIncomeUSD = 0;
    let totalExpenseARS = 0;
    let totalExpenseUSD = 0;
    let totalIncomeConverted = 0;
    let totalExpenseConverted = 0;

    monthlyReportData.forEach(m => {
      totalIncomeARS += m.incomeARS;
      totalIncomeUSD += m.incomeUSD;
      totalExpenseARS += m.expenseARS;
      totalExpenseUSD += m.expenseUSD;
      totalIncomeConverted += m.incomeConverted;
      totalExpenseConverted += m.expenseConverted;
    });

    const netSavingsConverted = totalIncomeConverted - totalExpenseConverted;
    const savingsRate = totalIncomeConverted > 0 ? (netSavingsConverted / totalIncomeConverted) * 100 : 0;

    // Find peak months
    let highestIncomeMonth = monthlyReportData[0];
    let highestExpenseMonth = monthlyReportData[0];

    monthlyReportData.forEach(m => {
      if (!highestIncomeMonth || m.incomeConverted > highestIncomeMonth.incomeConverted) {
        highestIncomeMonth = m;
      }
      if (!highestExpenseMonth || m.expenseConverted > highestExpenseMonth.expenseConverted) {
        highestExpenseMonth = m;
      }
    });

    return {
      totalIncomeARS,
      totalIncomeUSD,
      totalExpenseARS,
      totalExpenseUSD,
      totalIncomeConverted,
      totalExpenseConverted,
      netSavingsConverted,
      savingsRate,
      highestIncomeMonth,
      highestExpenseMonth,
      avgMonthlyExpense: monthlyReportData.length > 0 ? totalExpenseConverted / monthlyReportData.length : 0,
      avgMonthlyIncome: monthlyReportData.length > 0 ? totalIncomeConverted / monthlyReportData.length : 0,
    };
  }, [monthlyReportData]);

  // Category breakdown for pie chart
  const categoryBreakdownData = useMemo(() => {
    const map: Record<string, number> = {};
    const visibleMonths = new Set(monthlyReportData.map(m => m.month));

    transactions.forEach(tx => {
      if (tx.type !== 'EXPENSE') return;
      const monthKey = tx.date ? tx.date.substring(0, 7) : '';
      if (!visibleMonths.has(monthKey)) return;

      const cat = tx.category || 'Uncategorized';
      const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
      map[cat] = (map[cat] || 0) + converted;
    });

    return Object.keys(map)
      .map(cat => ({ name: cat, value: Math.round(map[cat]) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, monthlyReportData, displayCurrency, usdArsRate]);

  // PDF Report Exporter
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const nowStr = new Date().toLocaleDateString();

    // Header
    doc.setFillColor(15, 19, 26);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Finlev - Executive Financial Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on ${nowStr} | Currency Mode: ${displayCurrency} (USD/ARS: $${usdArsRate})`, 14, 28);

    // Summary Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text('Key Performance Summary', 14, 48);

    doc.setFontSize(10);
    doc.text(`Selected Period Range: ${timeRange === '6M' ? 'Last 6 Months' : timeRange === '12M' ? 'Last 12 Months' : 'All History'}`, 14, 56);
    doc.text(`Total Income: ${formatCurrency(summaryMetrics.totalIncomeConverted, displayCurrency)} (ARS: $${summaryMetrics.totalIncomeARS.toLocaleString()} | USD: $${summaryMetrics.totalIncomeUSD.toLocaleString()})`, 14, 63);
    doc.text(`Total Expenses: ${formatCurrency(summaryMetrics.totalExpenseConverted, displayCurrency)} (ARS: $${summaryMetrics.totalExpenseARS.toLocaleString()} | USD: $${summaryMetrics.totalExpenseUSD.toLocaleString()})`, 14, 70);
    doc.text(`Net Cash Flow: ${formatCurrency(summaryMetrics.netSavingsConverted, displayCurrency)}`, 14, 77);
    doc.text(`Average Savings Rate: ${summaryMetrics.savingsRate.toFixed(1)}%`, 14, 84);

    // Table Header
    doc.setFontSize(12);
    doc.text('Monthly Breakdown', 14, 98);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 102, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Month', 18, 107);
    doc.text('Income (ARS)', 55, 107);
    doc.text('Income (USD)', 90, 107);
    doc.text('Expense (ARS)', 125, 107);
    doc.text('Expense (USD)', 160, 107);

    let y = 116;
    doc.setTextColor(15, 23, 42);
    monthlyReportData.forEach(m => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(m.month, 18, y);
      doc.text(`$${Math.round(m.incomeARS).toLocaleString()}`, 55, y);
      doc.text(`$${Math.round(m.incomeUSD).toLocaleString()}`, 90, y);
      doc.text(`$${Math.round(m.expenseARS).toLocaleString()}`, 125, y);
      doc.text(`$${Math.round(m.expenseUSD).toLocaleString()}`, 160, y);
      y += 7;
    });

    doc.save(`Finlev_Financial_Report_${displayCurrency}_${timeRange}.pdf`);
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#161b22] border border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2">
          <p className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex justify-between items-center gap-4">
            <span>Period: {label}</span>
          </p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex justify-between items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                  {entry.name}:
                </span>
                <span className="font-mono font-bold text-slate-100">
                  {chartMode === 'NATIVE_CURRENCY'
                    ? entry.name.includes('USD') 
                      ? `$${entry.value.toLocaleString()} USD` 
                      : `$${entry.value.toLocaleString()} ARS`
                    : formatCurrency(entry.value, displayCurrency)
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Financial Performance Reports</h1>
              <p className="text-xs text-slate-400">
                Monthly income vs expense breakdown color-coded by currency (ARS vs USD)
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Time Range Selector */}
          <div className="bg-[#0f131a] p-1 border border-slate-800 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setTimeRange('6M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '6M' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setTimeRange('12M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '12M' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              12 Months
            </button>
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === 'ALL' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0f131a] border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
          >
            <option value="ALL">All Categories</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ml-auto md:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income Card */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Period Income</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            {formatCurrency(summaryMetrics.totalIncomeConverted, displayCurrency)}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono pt-1">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              ARS: ${Math.round(summaryMetrics.totalIncomeARS).toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              USD: ${Math.round(summaryMetrics.totalIncomeUSD).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Period Expenses</span>
            <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-rose-400">
            {formatCurrency(summaryMetrics.totalExpenseConverted, displayCurrency)}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono pt-1">
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
              ARS: ${Math.round(summaryMetrics.totalExpenseARS).toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              USD: ${Math.round(summaryMetrics.totalExpenseUSD).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Net Savings & Savings Rate */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Net Cash Flow</span>
            <span className={`p-1.5 rounded-lg ${summaryMetrics.netSavingsConverted >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-2xl font-extrabold ${summaryMetrics.netSavingsConverted >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(summaryMetrics.netSavingsConverted, displayCurrency)}
          </div>
          <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
            <span>Savings Rate:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${summaryMetrics.savingsRate >= 20 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
              {summaryMetrics.savingsRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Monthly Average */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Monthly Run-Rate</span>
            <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {formatCurrency(summaryMetrics.avgMonthlyExpense, displayCurrency)}
            <span className="text-xs font-normal text-slate-400"> / mo</span>
          </div>
          <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
            <span>Avg Income:</span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(summaryMetrics.avgMonthlyIncome, displayCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Bar Chart Section */}
      <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Monthly Expenses vs Income</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Color-Coded by Currency
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare income and spending per month separated by ARS and USD
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Mode Toggle */}
            <div className="bg-[#0f131a] p-1 border border-slate-800 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setChartMode('NATIVE_CURRENCY')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  chartMode === 'NATIVE_CURRENCY' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Native Breakdown (ARS/USD)
              </button>
              <button
                onClick={() => setChartMode('CONVERTED')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  chartMode === 'CONVERTED' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Total Converted ({displayCurrency})
              </button>
            </div>

            {/* Stacked vs Grouped Toggle (Only in Native Currency Mode) */}
            {chartMode === 'NATIVE_CURRENCY' && (
              <div className="bg-[#0f131a] p-1 border border-slate-800 rounded-xl flex items-center text-xs">
                <button
                  onClick={() => setBarStyle('STACKED')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    barStyle === 'STACKED' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Stacked Bars"
                >
                  Stacked
                </button>
                <button
                  onClick={() => setBarStyle('GROUPED')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    barStyle === 'GROUPED' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Grouped Bars"
                >
                  Grouped
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Currency Legend Badges */}
        {chartMode === 'NATIVE_CURRENCY' && (
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs bg-[#0f131a] p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.incomeARS }}></span>
              <span className="text-slate-300 font-medium">Income ARS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.incomeUSD }}></span>
              <span className="text-slate-300 font-medium">Income USD</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.expenseARS }}></span>
              <span className="text-slate-300 font-medium">Expense ARS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.expenseUSD }}></span>
              <span className="text-slate-300 font-medium">Expense USD</span>
            </div>
          </div>
        )}

        {/* Recharts Bar Chart Container */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'NATIVE_CURRENCY' ? (
              <BarChart
                data={monthlyReportData}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Income ARS */}
                <Bar 
                  dataKey="incomeARS" 
                  name="Income ARS" 
                  fill={COLORS.incomeARS} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Income USD */}
                <Bar 
                  dataKey="incomeUSD" 
                  name="Income USD" 
                  fill={COLORS.incomeUSD} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Expense ARS */}
                <Bar 
                  dataKey="expenseARS" 
                  name="Expense ARS" 
                  fill={COLORS.expenseARS} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Expense USD */}
                <Bar 
                  dataKey="expenseUSD" 
                  name="Expense USD" 
                  fill={COLORS.expenseUSD} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            ) : (
              <BarChart
                data={monthlyReportData}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                
                <Bar 
                  dataKey="incomeConverted" 
                  name={`Total Income (${displayCurrency})`} 
                  fill={COLORS.incomeTotal} 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="expenseConverted" 
                  name={`Total Expense (${displayCurrency})`} 
                  fill={COLORS.expenseTotal} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Row: Category Expenses Breakdown & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Share Donut Chart */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-purple-400" />
            <span>Category Spending Distribution</span>
          </h2>

          {categoryBreakdownData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
              No expense data available for selected criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(Number(value), displayCurrency), 'Spent']} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-xs">
                {categoryBreakdownData.slice(0, 8).map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center p-2 rounded-lg bg-[#0f131a] border border-slate-800/60">
                    <div className="flex items-center gap-2 truncate">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                      ></span>
                      <span className="font-medium text-slate-200 truncate">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-100 font-mono ml-2">
                      {formatCurrency(cat.value, displayCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Net Cash Flow Trend Chart */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Net Monthly Cash Flow Trend</span>
          </h2>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyReportData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip 
                  formatter={(val: any) => [formatCurrency(Number(val), displayCurrency), 'Net Savings']} 
                />
                <Area type="monotone" dataKey="netConverted" name="Net Flow" stroke="#10b981" fillOpacity={1} fill="url(#colorNet)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
