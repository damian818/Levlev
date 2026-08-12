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
  currentUserId?: string;
  showSharedData?: boolean;
}

export function ReportsTab({
  transactions,
  displayCurrency,
  usdArsRate,
  currentUserId,
  showSharedData = true,
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
    sharedIncomeARS: '#8b5cf6', // Violet 500
    sharedIncomeUSD: '#a855f7', // Purple 500
    expenseARS: '#f43f5e', // Rose 500
    expenseUSD: '#f59e0b', // Amber 500
    sharedExpenseARS: '#f97316', // Orange 500
    sharedExpenseUSD: '#fbbf24', // Amber 400
    incomeTotal: '#34d399', // Emerald 400
    expenseTotal: '#fb7185', // Rose 400
    sharedIncomeTotal: '#a78bfa', // Violet 400
    sharedExpenseTotal: '#fb923c', // Orange 400
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

  // Aggregate monthly data (including future scheduled periods)
  const monthlyReportData = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const currentMonthKey = todayStr.substring(0, 7);

    const monthlyMap: Record<string, {
      month: string;
      isFuture: boolean;
      incomeARS: number;
      incomeUSD: number;
      expenseARS: number;
      expenseUSD: number;
      sharedIncomeARS: number;
      sharedIncomeUSD: number;
      sharedExpenseARS: number;
      sharedExpenseUSD: number;
      scheduledIncomeARS: number;
      scheduledIncomeUSD: number;
      scheduledExpenseARS: number;
      scheduledExpenseUSD: number;
      // Converted values per currency slice (normalized to displayCurrency)
      incomeARS_Converted: number;
      incomeUSD_Converted: number;
      expenseARS_Converted: number;
      expenseUSD_Converted: number;
      sharedIncomeARS_Converted: number;
      sharedIncomeUSD_Converted: number;
      sharedExpenseARS_Converted: number;
      sharedExpenseUSD_Converted: number;
      scheduledIncomeARS_Converted: number;
      scheduledIncomeUSD_Converted: number;
      scheduledExpenseARS_Converted: number;
      scheduledExpenseUSD_Converted: number;
      incomeConverted: number;
      expenseConverted: number;
      scheduledIncomeConverted: number;
      scheduledExpenseConverted: number;
      sharedIncomeConverted: number;
      sharedExpenseConverted: number;
      netConverted: number;
      txCount: number;
    }> = {};

    // Helper to ensure month exists
    const ensureMonth = (m: string) => {
      if (!monthlyMap[m]) {
        monthlyMap[m] = {
          month: m,
          isFuture: m > currentMonthKey,
          incomeARS: 0,
          incomeUSD: 0,
          expenseARS: 0,
          expenseUSD: 0,
          sharedIncomeARS: 0,
          sharedIncomeUSD: 0,
          sharedExpenseARS: 0,
          sharedExpenseUSD: 0,
          scheduledIncomeARS: 0,
          scheduledIncomeUSD: 0,
          scheduledExpenseARS: 0,
          scheduledExpenseUSD: 0,
          incomeARS_Converted: 0,
          incomeUSD_Converted: 0,
          expenseARS_Converted: 0,
          expenseUSD_Converted: 0,
          sharedIncomeARS_Converted: 0,
          sharedIncomeUSD_Converted: 0,
          sharedExpenseARS_Converted: 0,
          sharedExpenseUSD_Converted: 0,
          scheduledIncomeARS_Converted: 0,
          scheduledIncomeUSD_Converted: 0,
          scheduledExpenseARS_Converted: 0,
          scheduledExpenseUSD_Converted: 0,
          incomeConverted: 0,
          expenseConverted: 0,
          scheduledIncomeConverted: 0,
          scheduledExpenseConverted: 0,
          sharedIncomeConverted: 0,
          sharedExpenseConverted: 0,
          netConverted: 0,
          txCount: 0,
        };
      }
      return monthlyMap[m];
    };

    transactions.forEach(tx => {
      if (tx.type === 'TRANSFER') return; // Exclude internal transfers from income/expense metrics
      if (selectedCategoryFilter !== 'ALL' && tx.category !== selectedCategoryFilter) return;

      const isShared = tx.ownerId && currentUserId && tx.ownerId !== currentUserId;
      if (isShared && !showSharedData) return;

      const monthKey = tx.date ? tx.date.substring(0, 7) : 'Unknown';
      if (monthKey === 'Unknown') return;

      const item = ensureMonth(monthKey);
      item.txCount++;

      const isUsd = tx.currency?.toUpperCase().includes('USD');
      const amt = tx.amount || 0;
      const converted = convertCurrency(amt, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
      const isTxFuture = Boolean(tx.date && tx.date.substring(0, 10) > todayStr);

      if (tx.type === 'INCOME') {
        if (isTxFuture) {
          if (isUsd) {
            item.scheduledIncomeUSD += amt;
            item.scheduledIncomeUSD_Converted += converted;
          } else {
            item.scheduledIncomeARS += amt;
            item.scheduledIncomeARS_Converted += converted;
          }
          item.scheduledIncomeConverted += converted;
        } else if (isShared) {
          if (isUsd) {
            item.sharedIncomeUSD += amt;
            item.sharedIncomeUSD_Converted += converted;
          } else {
            item.sharedIncomeARS += amt;
            item.sharedIncomeARS_Converted += converted;
          }
          item.sharedIncomeConverted += converted;
        } else {
          if (isUsd) {
            item.incomeUSD += amt;
            item.incomeUSD_Converted += converted;
          } else {
            item.incomeARS += amt;
            item.incomeARS_Converted += converted;
          }
          item.incomeConverted += converted;
        }
      } else if (tx.type === 'EXPENSE') {
        if (isTxFuture) {
          if (isUsd) {
            item.scheduledExpenseUSD += amt;
            item.scheduledExpenseUSD_Converted += converted;
          } else {
            item.scheduledExpenseARS += amt;
            item.scheduledExpenseARS_Converted += converted;
          }
          item.scheduledExpenseConverted += converted;
        } else if (isShared) {
          if (isUsd) {
            item.sharedExpenseUSD += amt;
            item.sharedExpenseUSD_Converted += converted;
          } else {
            item.sharedExpenseARS += amt;
            item.sharedExpenseARS_Converted += converted;
          }
          item.sharedExpenseConverted += converted;
        } else {
          if (isUsd) {
            item.expenseUSD += amt;
            item.expenseUSD_Converted += converted;
          } else {
            item.expenseARS += amt;
            item.expenseARS_Converted += converted;
          }
          item.expenseConverted += converted;
        }
      }
    });

    // Ensure future 3 months exist for forecasting visibility
    const currDt = new Date();
    for (let i = 1; i <= 3; i++) {
      const futureDt = new Date(currDt.getFullYear(), currDt.getMonth() + i, 1);
      const fKey = futureDt.toISOString().substring(0, 7);
      ensureMonth(fKey);
    }

    let allMonths = Object.keys(monthlyMap).sort();

    // Filter by time range
    if (timeRange === '6M') {
      // For 6M/12M, we strictly show the current month and the specified number of months into the past.
      // We filter out any months beyond the current one.
      const pastAndCurrent = allMonths.filter(m => m <= currentMonthKey);
      allMonths = pastAndCurrent.slice(-6);
    } else if (timeRange === '12M') {
      const pastAndCurrent = allMonths.filter(m => m <= currentMonthKey);
      allMonths = pastAndCurrent.slice(-12);
    }

    return allMonths.map(m => {
      const data = monthlyMap[m];
      data.netConverted = (data.incomeConverted + data.scheduledIncomeConverted) - (data.expenseConverted + data.scheduledExpenseConverted);
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
      totalIncomeARS += m.incomeARS + m.scheduledIncomeARS + m.sharedIncomeARS;
      totalIncomeUSD += m.incomeUSD + m.scheduledIncomeUSD + m.sharedIncomeUSD;
      totalExpenseARS += m.expenseARS + m.scheduledExpenseARS + m.sharedExpenseARS;
      totalExpenseUSD += m.expenseUSD + m.scheduledExpenseUSD + m.sharedExpenseUSD;
      totalIncomeConverted += m.incomeConverted + m.scheduledIncomeConverted + m.sharedIncomeConverted;
      totalExpenseConverted += m.expenseConverted + m.scheduledExpenseConverted + m.sharedExpenseConverted;
    });

    const netSavingsConverted = totalIncomeConverted - totalExpenseConverted;
    const savingsRate = totalIncomeConverted > 0 ? (netSavingsConverted / totalIncomeConverted) * 100 : 0;

    // Find peak months
    let highestIncomeMonth = monthlyReportData[0];
    let highestExpenseMonth = monthlyReportData[0];

    monthlyReportData.forEach(m => {
      const mIncome = m.incomeConverted + m.scheduledIncomeConverted + m.sharedIncomeConverted;
      const hIncome = highestIncomeMonth ? highestIncomeMonth.incomeConverted + highestIncomeMonth.scheduledIncomeConverted + highestIncomeMonth.sharedIncomeConverted : 0;
      if (!highestIncomeMonth || mIncome > hIncome) {
        highestIncomeMonth = m;
      }
      
      const mExpense = m.expenseConverted + m.scheduledExpenseConverted + m.sharedExpenseConverted;
      const hExpense = highestExpenseMonth ? highestExpenseMonth.expenseConverted + highestExpenseMonth.scheduledExpenseConverted + highestExpenseMonth.sharedExpenseConverted : 0;
      if (!highestExpenseMonth || mExpense > hExpense) {
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
    const nowStr = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

    // Page 1 Header Banner
    doc.setFillColor(15, 19, 26);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('LevLev', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Personal Finance & Inflation Executive Report', 14, 26);
    doc.text(`Generated: ${nowStr} | Mode: ${displayCurrency} (USD/ARS: $${usdArsRate})`, 14, 32);

    // Section 1: Key Performance Indicators Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 42, 182, 38, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Executive Summary Indicators', 18, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    // Left Column
    doc.text(`Total Period Income:`, 18, 58);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`${formatCurrency(summaryMetrics.totalIncomeConverted, displayCurrency)}`, 62, 58);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Period Expense:`, 18, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(244, 63, 94);
    doc.text(`${formatCurrency(summaryMetrics.totalExpenseConverted, displayCurrency)}`, 62, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Net Cash Flow:`, 18, 72);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(summaryMetrics.netSavingsConverted >= 0 ? 16 : 239, summaryMetrics.netSavingsConverted >= 0 ? 185 : 68, summaryMetrics.netSavingsConverted >= 0 ? 129 : 68);
    doc.text(`${formatCurrency(summaryMetrics.netSavingsConverted, displayCurrency)}`, 62, 72);

    // Right Column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Savings Rate:`, 110, 58);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${summaryMetrics.savingsRate.toFixed(1)}%`, 150, 58);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Avg Monthly Expense:`, 110, 65);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formatCurrency(summaryMetrics.avgMonthlyExpense, displayCurrency)}`, 150, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Selected Period Range:`, 110, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(`${timeRange === '6M' ? 'Last 6 Months' : timeRange === '12M' ? 'Last 12 Months' : 'All History'}`, 150, 72);

    // Section 2: Top Expense Categories
    let currentY = 88;
    if (categoryBreakdownData.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Expense Category Breakdown', 14, currentY);
      currentY += 5;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(14, currentY, 182, 7, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Category', 18, currentY + 5);
      doc.text(`Amount (${displayCurrency})`, 110, currentY + 5);
      doc.text('% Share', 165, currentY + 5);
      currentY += 8;

      const totalCatExp = categoryBreakdownData.reduce((acc, c) => acc + c.value, 0);
      categoryBreakdownData.slice(0, 6).forEach((cat, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, currentY - 1, 182, 6, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(cat.name, 18, currentY + 3);
        doc.text(formatCurrency(cat.value, displayCurrency), 110, currentY + 3);
        const pct = totalCatExp > 0 ? ((cat.value / totalCatExp) * 100).toFixed(1) : '0';
        doc.text(`${pct}%`, 165, currentY + 3);
        currentY += 6;
      });
      currentY += 6;
    }

    // Section 3: Monthly Breakdown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Monthly Historical & Scheduled Performance Breakdown', 14, currentY);
    currentY += 5;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Month', 18, currentY + 5);
    doc.text('Status', 42, currentY + 5);
    doc.text('Income (ARS)', 68, currentY + 5);
    doc.text('Income (USD)', 100, currentY + 5);
    doc.text('Expense (ARS)', 132, currentY + 5);
    doc.text('Expense (USD)', 164, currentY + 5);
    currentY += 9;

    let pageNum = 1;
    doc.setFont('helvetica', 'normal');

    monthlyReportData.forEach((m, idx) => {
      if (currentY > 270) {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`LevLev Executive Financial Report • Page ${pageNum}`, 14, 288);
        doc.addPage();
        pageNum++;
        currentY = 20;

        // Repeat header
        doc.setFillColor(15, 23, 42);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('Month', 18, currentY + 5);
        doc.text('Status', 42, currentY + 5);
        doc.text('Income (ARS)', 68, currentY + 5);
        doc.text('Income (USD)', 100, currentY + 5);
        doc.text('Expense (ARS)', 132, currentY + 5);
        doc.text('Expense (USD)', 164, currentY + 5);
        currentY += 9;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY - 1, 182, 6, 'F');
      }

      doc.setTextColor(51, 65, 85);
      doc.text(m.month, 18, currentY + 3);

      if (m.isFuture) {
        doc.setTextColor(217, 119, 6);
        doc.text('Scheduled', 42, currentY + 3);
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('Actual', 42, currentY + 3);
      }

      doc.setTextColor(51, 65, 85);
      doc.text(`$${Math.round(m.incomeARS + m.scheduledIncomeARS).toLocaleString()}`, 68, currentY + 3);
      doc.text(`$${Math.round(m.incomeUSD + m.scheduledIncomeUSD).toLocaleString()}`, 100, currentY + 3);
      doc.text(`$${Math.round(m.expenseARS + m.scheduledExpenseARS).toLocaleString()}`, 132, currentY + 3);
      doc.text(`$${Math.round(m.expenseUSD + m.scheduledExpenseUSD).toLocaleString()}`, 164, currentY + 3);

      currentY += 6;
    });

    // Page number footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`LevLev Executive Financial Report • Page ${pageNum}`, 14, 288);

    doc.save(`LevLev_Financial_Report_${displayCurrency}_${timeRange}.pdf`);
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const getNativeInfo = (entry: any) => {
        const key = entry.dataKey as string;
        const p = entry.payload;
        if (!p || !key) return null;

        if (key.includes('scheduledIncomeARS')) return { amt: p.scheduledIncomeARS, curr: 'ARS' };
        if (key.includes('scheduledIncomeUSD')) return { amt: p.scheduledIncomeUSD, curr: 'USD' };
        if (key.includes('incomeARS')) return { amt: p.incomeARS, curr: 'ARS' };
        if (key.includes('incomeUSD')) return { amt: p.incomeUSD, curr: 'USD' };
        if (key.includes('sharedIncomeARS')) return { amt: p.sharedIncomeARS, curr: 'ARS' };
        if (key.includes('sharedIncomeUSD')) return { amt: p.sharedIncomeUSD, curr: 'USD' };

        if (key.includes('scheduledExpenseARS')) return { amt: p.scheduledExpenseARS, curr: 'ARS' };
        if (key.includes('scheduledExpenseUSD')) return { amt: p.scheduledExpenseUSD, curr: 'USD' };
        if (key.includes('expenseARS')) return { amt: p.expenseARS, curr: 'ARS' };
        if (key.includes('expenseUSD')) return { amt: p.expenseUSD, curr: 'USD' };
        if (key.includes('sharedExpenseARS')) return { amt: p.sharedExpenseARS, curr: 'ARS' };
        if (key.includes('sharedExpenseUSD')) return { amt: p.sharedExpenseUSD, curr: 'USD' };

        return null;
      };

      return (
        <div className="bg-[#161b22] border border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[240px]">
          <div className="border-b border-slate-700/80 pb-1 flex justify-between items-center gap-4">
            <span className="font-bold text-slate-200">Period: {label}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              $1 USD = ${usdArsRate} ARS
            </span>
          </div>
          <div className="space-y-1.5">
            {payload.filter((e: any) => e.value > 0).map((entry: any, index: number) => {
              const native = getNativeInfo(entry);
              return (
                <div key={`item-${index}`} className="flex justify-between items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                    {entry.name}:
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-100 block">
                      {formatCurrency(entry.value, displayCurrency)}
                    </span>
                    {native && native.amt > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal block">
                        ({native.curr === 'USD' ? `$${native.amt.toLocaleString()} USD` : `$${Math.round(native.amt).toLocaleString()} ARS`})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
              Compare actual vs future scheduled income and expenses per month
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
        {chartMode === 'CONVERTED' ? (
          <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] bg-[#0f131a] p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeTotal }}></span>
              <span className="text-slate-300 font-medium">Owned Income ({displayCurrency})</span>
            </div>
            {showSharedData && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedIncomeTotal }}></span>
                <span className="text-purple-400 font-bold">Shared Income ({displayCurrency})</span>
              </div>
            )}
            <div className="w-px h-3 bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseTotal }}></span>
              <span className="text-slate-300 font-medium">Owned Expense ({displayCurrency})</span>
            </div>
            {showSharedData && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedExpenseTotal }}></span>
                <span className="text-amber-500 font-bold">Shared Expense ({displayCurrency})</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] bg-[#0f131a] p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeARS }}></span>
                <span className="text-slate-300 font-medium">Income ARS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeUSD }}></span>
                <span className="text-slate-300 font-medium">Income USD</span>
              </div>
              {showSharedData && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedIncomeARS }}></span>
                    <span className="text-purple-400 font-bold">Shared Income ARS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedIncomeUSD }}></span>
                    <span className="text-purple-400 font-bold">Shared Income USD</span>
                  </div>
                </>
              )}
            </div>
            <div className="w-px h-3 bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseARS }}></span>
                <span className="text-slate-300 font-medium">Expense ARS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseUSD }}></span>
                <span className="text-slate-300 font-medium">Expense USD</span>
              </div>
              {showSharedData && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedExpenseARS }}></span>
                    <span className="text-amber-500 font-bold">Shared Expense ARS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.sharedExpenseUSD }}></span>
                    <span className="text-amber-500 font-bold">Shared Expense USD</span>
                  </div>
                </>
              )}
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
                  tickFormatter={(val) => formatCurrencyCompact(val, displayCurrency)}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Scheduled Income ARS */}
                <Bar 
                  dataKey="scheduledIncomeARS_Converted" 
                  name="Scheduled Income ARS" 
                  fill={COLORS.incomeARS}
                  fillOpacity={0.4}
                  stroke={COLORS.incomeARS}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Scheduled Income USD */}
                <Bar 
                  dataKey="scheduledIncomeUSD_Converted" 
                  name="Scheduled Income USD" 
                  fill={COLORS.incomeUSD} 
                  fillOpacity={0.4}
                  stroke={COLORS.incomeUSD}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Income ARS */}
                <Bar 
                  dataKey="incomeARS_Converted" 
                  name="Income ARS" 
                  fill={COLORS.incomeARS} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Shared Income ARS */}
                <Bar 
                  dataKey="sharedIncomeARS_Converted" 
                  name="Shared Income ARS" 
                  fill={COLORS.sharedIncomeARS} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Income USD */}
                <Bar 
                  dataKey="incomeUSD_Converted" 
                  name="Income USD" 
                  fill={COLORS.incomeUSD} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Shared Income USD */}
                <Bar 
                  dataKey="sharedIncomeUSD_Converted" 
                  name="Shared Income USD" 
                  fill={COLORS.sharedIncomeUSD} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Scheduled Expense ARS */}
                <Bar 
                  dataKey="scheduledExpenseARS_Converted" 
                  name="Scheduled Expense ARS" 
                  fill={COLORS.expenseARS} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseARS}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Scheduled Expense USD */}
                <Bar 
                  dataKey="scheduledExpenseUSD_Converted" 
                  name="Scheduled Expense USD" 
                  fill={COLORS.expenseUSD} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseUSD}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Expense ARS */}
                <Bar 
                  dataKey="expenseARS_Converted" 
                  name="Expense ARS" 
                  fill={COLORS.expenseARS} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Shared Expense ARS */}
                <Bar 
                  dataKey="sharedExpenseARS_Converted" 
                  name="Shared Expense ARS" 
                  fill={COLORS.sharedExpenseARS} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Expense USD */}
                <Bar 
                  dataKey="expenseUSD_Converted" 
                  name="Expense USD" 
                  fill={COLORS.expenseUSD} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Shared Expense USD */}
                <Bar 
                  dataKey="sharedExpenseUSD_Converted" 
                  name="Shared Expense USD" 
                  fill={COLORS.sharedExpenseUSD} 
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
                  tickFormatter={(val) => formatCurrencyCompact(val, displayCurrency)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                
                <Bar 
                  dataKey="scheduledIncomeConverted" 
                  name={`Scheduled Income (${displayCurrency})`} 
                  fill={COLORS.incomeTotal} 
                  fillOpacity={0.4}
                  stroke={COLORS.incomeTotal}
                  strokeDasharray="4 4"
                  stackId="income"
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="incomeConverted" 
                  name={`Actual Income (${displayCurrency})`} 
                  fill={COLORS.incomeTotal} 
                  stackId="income"
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="sharedIncomeConverted" 
                  name={`Shared Income (${displayCurrency})`} 
                  fill={COLORS.sharedIncomeTotal} 
                  stackId="income"
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="scheduledExpenseConverted" 
                  name={`Scheduled Expense (${displayCurrency})`} 
                  fill={COLORS.expenseTotal} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseTotal}
                  strokeDasharray="4 4"
                  stackId="expense"
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="expenseConverted" 
                  name={`Actual Expense (${displayCurrency})`} 
                  fill={COLORS.expenseTotal} 
                  stackId="expense"
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="sharedExpenseConverted" 
                  name={`Shared Expense (${displayCurrency})`} 
                  fill={COLORS.sharedExpenseTotal} 
                  stackId="expense"
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
