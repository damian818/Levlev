import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, RecurringRule, PendingRecurringItem } from '../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact, getPendingRecurringForMonth } from '../utils/financeUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, Calendar, Download, TrendingUp, TrendingDown, DollarSign, 
  Layers, Filter, PieChart as PieChartIcon, Award, ArrowUpRight, ArrowDownRight, RefreshCw,
  FileText, Plus, Sparkles, Clock, CheckCircle2, AlertCircle, Repeat
} from 'lucide-react';
import jsPDF from 'jspdf';
import { EmptyState } from './EmptyState';

interface ReportsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  localCurrency?: DisplayCurrency;
  enabledCurrencies?: string[];
  usdArsRate: number;
  recurringRules?: RecurringRule[];
  nonRecurringKeys?: string[];
  currentUserId?: string;
  showSharedData?: boolean;
}

export const ReportsTab = React.memo(function ReportsTab({
  transactions,
  displayCurrency,
  localCurrency = 'EUR',
  enabledCurrencies = ['USD', 'ARS', 'EUR', 'BRL', 'USDT', 'CLP', 'UYU', 'GBP'],
  usdArsRate,
  recurringRules = [],
  nonRecurringKeys = [],
  currentUserId,
  showSharedData = true,
}: ReportsTabProps) {
  const { t } = useTranslation();
  const localCurr = (localCurrency || 'EUR').toUpperCase();
  const foreignCurr = (displayCurrency !== localCurr ? displayCurrency : ('USD' !== localCurr ? 'USD' : 'ARS')).toUpperCase();
  // Time range state
  const [timeRange, setTimeRange] = useState<'6M' | '12M' | 'ALL'>('12M');
  const [chartMode, setChartMode] = useState<'NATIVE_CURRENCY' | 'CONVERTED'>('NATIVE_CURRENCY');
  const [barStyle, setBarStyle] = useState<'STACKED' | 'GROUPED'>('STACKED');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [includePendingRecurring, setIncludePendingRecurring] = useState<boolean>(true);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
            </div>
            {t('reports.title') || 'Financial Reports & Projections'}
          </h2>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
          <EmptyState
            icon={FileText}
            title={t('reports.no_data_title', { defaultValue: 'No Financial Reports Available' })}
            description={t('reports.no_data_desc', { defaultValue: 'We need some transactions to generate your financial insights. Start by adding your first income or expense.' })}
          />
        </div>
      </div>
    );
  }

  // Colors for charts
  const COLORS = {
    incomeARS: '#10b981', // Emerald 500
    incomeUSD: '#06b6d4', // Cyan 500
    sharedIncomeARS: '#8b5cf6', // Violet 500
    sharedIncomeUSD: '#a855f7', // Purple 500
    estimatedIncomeARS: '#34d399', // Emerald 400
    estimatedIncomeUSD: '#22d3ee', // Cyan 400
    
    expenseARS: '#f43f5e', // Rose 500
    expenseUSD: '#f59e0b', // Amber 500
    sharedExpenseARS: '#f97316', // Orange 500
    sharedExpenseUSD: '#fbbf24', // Amber 400
    estimatedExpenseARS: '#fb7185', // Rose 400
    estimatedExpenseUSD: '#fcd34d', // Amber 300
    
    incomeTotal: '#34d399', // Emerald 400
    expenseTotal: '#fb7185', // Rose 400
    sharedIncomeTotal: '#a78bfa', // Violet 400
    sharedExpenseTotal: '#fb923c', // Orange 400
    estimatedIncomeTotal: '#10b981',
    estimatedExpenseTotal: '#f43f5e',
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
    recurringRules.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [transactions, recurringRules]);

  // Aggregate monthly data (including actuals, scheduled, and estimated pending recurring)
  const monthlyReportData = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const currentMonthKey = todayStr.substring(0, 7);

    const monthlyMap: Record<string, {
      month: string;
      isFuture: boolean;
      isCurrent: boolean;
      incomeLocal: number;
      incomeForeign: number;
      expenseLocal: number;
      expenseForeign: number;
      sharedIncomeLocal: number;
      sharedIncomeForeign: number;
      sharedExpenseLocal: number;
      sharedExpenseForeign: number;
      scheduledIncomeLocal: number;
      scheduledIncomeForeign: number;
      scheduledExpenseLocal: number;
      scheduledExpenseForeign: number;
      // Estimated pending recurring
      estimatedPendingIncomeLocal: number;
      estimatedPendingIncomeForeign: number;
      estimatedPendingExpenseLocal: number;
      estimatedPendingExpenseForeign: number;
      estimatedPendingIncomeConverted: number;
      estimatedPendingExpenseConverted: number;
      pendingRecurringItems: PendingRecurringItem[];
      // Converted values per currency slice (normalized to displayCurrency)
      incomeLocal_Converted: number;
      incomeForeign_Converted: number;
      expenseLocal_Converted: number;
      expenseForeign_Converted: number;
      sharedIncomeLocal_Converted: number;
      sharedIncomeForeign_Converted: number;
      sharedExpenseLocal_Converted: number;
      sharedExpenseForeign_Converted: number;
      scheduledIncomeLocal_Converted: number;
      scheduledIncomeForeign_Converted: number;
      scheduledExpenseLocal_Converted: number;
      scheduledExpenseForeign_Converted: number;
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
          isCurrent: m === currentMonthKey,
          incomeLocal: 0,
          incomeForeign: 0,
          expenseLocal: 0,
          expenseForeign: 0,
          sharedIncomeLocal: 0,
          sharedIncomeForeign: 0,
          sharedExpenseLocal: 0,
          sharedExpenseForeign: 0,
          scheduledIncomeLocal: 0,
          scheduledIncomeForeign: 0,
          scheduledExpenseLocal: 0,
          scheduledExpenseForeign: 0,
          estimatedPendingIncomeLocal: 0,
          estimatedPendingIncomeForeign: 0,
          estimatedPendingExpenseLocal: 0,
          estimatedPendingExpenseForeign: 0,
          estimatedPendingIncomeConverted: 0,
          estimatedPendingExpenseConverted: 0,
          pendingRecurringItems: [],
          incomeLocal_Converted: 0,
          incomeForeign_Converted: 0,
          expenseLocal_Converted: 0,
          expenseForeign_Converted: 0,
          sharedIncomeLocal_Converted: 0,
          sharedIncomeForeign_Converted: 0,
          sharedExpenseLocal_Converted: 0,
          sharedExpenseForeign_Converted: 0,
          scheduledIncomeLocal_Converted: 0,
          scheduledIncomeForeign_Converted: 0,
          scheduledExpenseLocal_Converted: 0,
          scheduledExpenseForeign_Converted: 0,
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

      const txCurr = (tx.currency || localCurr).toUpperCase();
      const isLocal = txCurr === localCurr || txCurr.includes(localCurr);
      const amt = tx.amount || 0;
      const converted = convertCurrency(amt, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
      const isTxFuture = Boolean(tx.date && tx.date.substring(0, 10) > todayStr);

      if (tx.type === 'INCOME') {
        if (isTxFuture) {
          if (isLocal) {
            item.scheduledIncomeLocal += amt;
            item.scheduledIncomeLocal_Converted += converted;
          } else {
            item.scheduledIncomeForeign += amt;
            item.scheduledIncomeForeign_Converted += converted;
          }
          item.scheduledIncomeConverted += converted;
        } else if (isShared) {
          if (isLocal) {
            item.sharedIncomeLocal += amt;
            item.sharedIncomeLocal_Converted += converted;
          } else {
            item.sharedIncomeForeign += amt;
            item.sharedIncomeForeign_Converted += converted;
          }
          item.sharedIncomeConverted += converted;
        } else {
          if (isLocal) {
            item.incomeLocal += amt;
            item.incomeLocal_Converted += converted;
          } else {
            item.incomeForeign += amt;
            item.incomeForeign_Converted += converted;
          }
          item.incomeConverted += converted;
        }
      } else if (tx.type === 'EXPENSE') {
        if (isTxFuture) {
          if (isLocal) {
            item.scheduledExpenseLocal += amt;
            item.scheduledExpenseLocal_Converted += converted;
          } else {
            item.scheduledExpenseForeign += amt;
            item.scheduledExpenseForeign_Converted += converted;
          }
          item.scheduledExpenseConverted += converted;
        } else if (isShared) {
          if (isLocal) {
            item.sharedExpenseLocal += amt;
            item.sharedExpenseLocal_Converted += converted;
          } else {
            item.sharedExpenseForeign += amt;
            item.sharedExpenseForeign_Converted += converted;
          }
          item.sharedExpenseConverted += converted;
        } else {
          if (isLocal) {
            item.expenseLocal += amt;
            item.expenseLocal_Converted += converted;
          } else {
            item.expenseForeign += amt;
            item.expenseForeign_Converted += converted;
          }
          item.expenseConverted += converted;
        }
      }
    });

    // Ensure current month and future 3 months exist for forecasting visibility
    ensureMonth(currentMonthKey);
    const currDt = new Date();
    for (let i = 1; i <= 3; i++) {
      const futureDt = new Date(currDt.getFullYear(), currDt.getMonth() + i, 1);
      const fKey = futureDt.toISOString().substring(0, 7);
      ensureMonth(fKey);
    }

    // Calculate Estimated Pending Recurring Items for each month (current & future)
    Object.keys(monthlyMap).forEach(mKey => {
      const item = monthlyMap[mKey];
      // Run pending recurring detector
      const pendingData = getPendingRecurringForMonth(
        mKey,
        transactions,
        recurringRules,
        nonRecurringKeys,
        displayCurrency,
        usdArsRate
      );

      // Filter by selected category if applicable
      const filteredPendingExpenses = selectedCategoryFilter === 'ALL'
        ? pendingData.pendingExpenses
        : pendingData.pendingExpenses.filter(p => p.category === selectedCategoryFilter);

      const filteredPendingIncomes = selectedCategoryFilter === 'ALL'
        ? pendingData.pendingIncomes
        : pendingData.pendingIncomes.filter(p => p.category === selectedCategoryFilter);

      const totalPendingExpConv = filteredPendingExpenses.reduce((s, p) => s + p.convertedAmount, 0);
      const totalPendingIncConv = filteredPendingIncomes.reduce((s, p) => s + p.convertedAmount, 0);

      item.estimatedPendingExpenseConverted = totalPendingExpConv;
      item.estimatedPendingIncomeConverted = totalPendingIncConv;
      item.estimatedPendingExpenseLocal = filteredPendingExpenses.filter(p => {
        const c = (p.currency || localCurr).toUpperCase();
        return c === localCurr || c.includes(localCurr);
      }).reduce((s, p) => s + p.amount, 0);
      item.estimatedPendingExpenseForeign = filteredPendingExpenses.filter(p => {
        const c = (p.currency || localCurr).toUpperCase();
        return !(c === localCurr || c.includes(localCurr));
      }).reduce((s, p) => s + p.amount, 0);
      item.estimatedPendingIncomeLocal = filteredPendingIncomes.filter(p => {
        const c = (p.currency || localCurr).toUpperCase();
        return c === localCurr || c.includes(localCurr);
      }).reduce((s, p) => s + p.amount, 0);
      item.estimatedPendingIncomeForeign = filteredPendingIncomes.filter(p => {
        const c = (p.currency || localCurr).toUpperCase();
        return !(c === localCurr || c.includes(localCurr));
      }).reduce((s, p) => s + p.amount, 0);
      item.pendingRecurringItems = [...filteredPendingIncomes, ...filteredPendingExpenses];
    });

    let allMonths = Object.keys(monthlyMap).sort();

    // Filter by time range
    if (timeRange === '6M') {
      const pastAndCurrent = allMonths.filter(m => m <= currentMonthKey);
      allMonths = pastAndCurrent.slice(-6);
    } else if (timeRange === '12M') {
      const pastAndCurrent = allMonths.filter(m => m <= currentMonthKey);
      allMonths = pastAndCurrent.slice(-12);
    }

    return allMonths.map(m => {
      const data = monthlyMap[m];
      const effIncome = data.incomeConverted + data.scheduledIncomeConverted + data.sharedIncomeConverted + 
        (includePendingRecurring ? data.estimatedPendingIncomeConverted : 0);
      const effExpense = data.expenseConverted + data.scheduledExpenseConverted + data.sharedExpenseConverted + 
        (includePendingRecurring ? data.estimatedPendingExpenseConverted : 0);
      
      data.netConverted = effIncome - effExpense;
      return data;
    });
  }, [transactions, recurringRules, nonRecurringKeys, timeRange, selectedCategoryFilter, displayCurrency, localCurrency, usdArsRate, currentUserId, showSharedData, includePendingRecurring]);

  // Total summary metrics over selected time range
  const summaryMetrics = useMemo(() => {
    let totalIncomeLocal = 0;
    let totalIncomeForeign = 0;
    let totalExpenseLocal = 0;
    let totalExpenseForeign = 0;
    let totalIncomeConverted = 0;
    let totalExpenseConverted = 0;
    let totalEstimatedPendingIncomeConverted = 0;
    let totalEstimatedPendingExpenseConverted = 0;

    monthlyReportData.forEach(m => {
      const incPending = includePendingRecurring ? m.estimatedPendingIncomeConverted : 0;
      const expPending = includePendingRecurring ? m.estimatedPendingExpenseConverted : 0;

      totalEstimatedPendingIncomeConverted += m.estimatedPendingIncomeConverted;
      totalEstimatedPendingExpenseConverted += m.estimatedPendingExpenseConverted;

      totalIncomeLocal += m.incomeLocal + m.scheduledIncomeLocal + m.sharedIncomeLocal + (includePendingRecurring ? m.estimatedPendingIncomeLocal : 0);
      totalIncomeForeign += m.incomeForeign + m.scheduledIncomeForeign + m.sharedIncomeForeign + (includePendingRecurring ? m.estimatedPendingIncomeForeign : 0);
      totalExpenseLocal += m.expenseLocal + m.scheduledExpenseLocal + m.sharedExpenseLocal + (includePendingRecurring ? m.estimatedPendingExpenseLocal : 0);
      totalExpenseForeign += m.expenseForeign + m.scheduledExpenseForeign + m.sharedExpenseForeign + (includePendingRecurring ? m.estimatedPendingExpenseForeign : 0);
      totalIncomeConverted += m.incomeConverted + m.scheduledIncomeConverted + m.sharedIncomeConverted + incPending;
      totalExpenseConverted += m.expenseConverted + m.scheduledExpenseConverted + m.sharedExpenseConverted + expPending;
    });

    // Compute dynamic currency distribution across transactions in active period
    const visibleMonths = new Set(monthlyReportData.map(m => m.month));
    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type === 'TRANSFER') return;
      const mKey = tx.date ? tx.date.substring(0, 7) : '';
      if (!visibleMonths.has(mKey)) return;
      if (selectedCategoryFilter !== 'ALL' && tx.category !== selectedCategoryFilter) return;

      const isShared = tx.ownerId && currentUserId && tx.ownerId !== currentUserId;
      if (isShared && !showSharedData) return;

      const curr = (tx.currency || 'ARS').toUpperCase();
      const amt = tx.amount || 0;

      if (tx.type === 'INCOME') {
        incomeByCurrency[curr] = (incomeByCurrency[curr] || 0) + amt;
      } else if (tx.type === 'EXPENSE') {
        expenseByCurrency[curr] = (expenseByCurrency[curr] || 0) + amt;
      }
    });

    if (includePendingRecurring) {
      monthlyReportData.forEach(m => {
        m.pendingRecurringItems.forEach(p => {
          const curr = (p.currency || 'ARS').toUpperCase();
          if (p.type === 'INCOME') {
            incomeByCurrency[curr] = (incomeByCurrency[curr] || 0) + p.amount;
          } else {
            expenseByCurrency[curr] = (expenseByCurrency[curr] || 0) + p.amount;
          }
        });
      });
    }

    const netSavingsConverted = totalIncomeConverted - totalExpenseConverted;
    const savingsRate = totalIncomeConverted > 0 ? (netSavingsConverted / totalIncomeConverted) * 100 : 0;

    // Find peak months
    let highestIncomeMonth = monthlyReportData[0];
    let highestExpenseMonth = monthlyReportData[0];

    monthlyReportData.forEach(m => {
      const mIncome = m.incomeConverted + m.scheduledIncomeConverted + m.sharedIncomeConverted + (includePendingRecurring ? m.estimatedPendingIncomeConverted : 0);
      const hIncome = highestIncomeMonth ? highestIncomeMonth.incomeConverted + highestIncomeMonth.scheduledIncomeConverted + highestIncomeMonth.sharedIncomeConverted + (includePendingRecurring ? highestIncomeMonth.estimatedPendingIncomeConverted : 0) : 0;
      if (!highestIncomeMonth || mIncome > hIncome) {
        highestIncomeMonth = m;
      }
      
      const mExpense = m.expenseConverted + m.scheduledExpenseConverted + m.sharedExpenseConverted + (includePendingRecurring ? m.estimatedPendingExpenseConverted : 0);
      const hExpense = highestExpenseMonth ? highestExpenseMonth.expenseConverted + highestExpenseMonth.scheduledExpenseConverted + highestExpenseMonth.sharedExpenseConverted + (includePendingRecurring ? highestExpenseMonth.estimatedPendingExpenseConverted : 0) : 0;
      if (!highestExpenseMonth || mExpense > hExpense) {
        highestExpenseMonth = m;
      }
    });

    return {
      totalIncomeLocal,
      totalIncomeForeign,
      totalExpenseLocal,
      totalExpenseForeign,
      incomeByCurrency,
      expenseByCurrency,
      totalIncomeConverted,
      totalExpenseConverted,
      totalEstimatedPendingIncomeConverted,
      totalEstimatedPendingExpenseConverted,
      netSavingsConverted,
      savingsRate,
      highestIncomeMonth,
      highestExpenseMonth,
      avgMonthlyExpense: monthlyReportData.length > 0 ? totalExpenseConverted / monthlyReportData.length : 0,
      avgMonthlyIncome: monthlyReportData.length > 0 ? totalIncomeConverted / monthlyReportData.length : 0,
    };
  }, [monthlyReportData, includePendingRecurring]);

  // Category breakdown for pie chart (including pending recurring if active)
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

    if (includePendingRecurring) {
      monthlyReportData.forEach(m => {
        m.pendingRecurringItems
          .filter(p => p.type === 'EXPENSE')
          .forEach(p => {
            const cat = p.category || 'Uncategorized';
            map[cat] = (map[cat] || 0) + p.convertedAmount;
          });
      });
    }

    return Object.keys(map)
      .map(cat => ({ name: cat, value: Math.round(map[cat]) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, monthlyReportData, displayCurrency, usdArsRate, includePendingRecurring]);

  // Current month active pending items list for quick inspect
  const currentMonthData = useMemo(() => {
    const todayMonth = new Date().toISOString().substring(0, 7);
    return monthlyReportData.find(m => m.month === todayMonth) || monthlyReportData[monthlyReportData.length - 1];
  }, [monthlyReportData]);

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
    doc.text(`Generated: ${nowStr} | Mode: ${displayCurrency} (USD/ARS: $${usdArsRate}) ${includePendingRecurring ? '• Includes Estimated Recurring' : ''}`, 14, 32);

    // Section 1: Key Performance Indicators Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, 182, 38, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Summary', 18, 50);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Income: ${formatCurrency(summaryMetrics.totalIncomeConverted, displayCurrency)}`, 18, 58);
    doc.text(`Total Expenses: ${formatCurrency(summaryMetrics.totalExpenseConverted, displayCurrency)}`, 18, 65);
    doc.text(`Net Savings: ${formatCurrency(summaryMetrics.netSavingsConverted, displayCurrency)} (${summaryMetrics.savingsRate.toFixed(1)}%)`, 18, 72);

    doc.text(`Monthly Run Rate: ${formatCurrency(summaryMetrics.avgMonthlyExpense, displayCurrency)}/mo`, 110, 58);
    doc.text(`Estimated Pending Recurring: ${formatCurrency(summaryMetrics.totalEstimatedPendingExpenseConverted, displayCurrency)}`, 110, 65);
    doc.text(`Active Timeframe: ${timeRange}`, 110, 72);

    // Section 2: Monthly Breakdown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Monthly Financial Trajectory', 14, 90);

    let currentY = 96;
    doc.setFillColor(15, 23, 42);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Month', 18, currentY + 5);
    doc.text('Status', 42, currentY + 5);
    doc.text('Income', 70, currentY + 5);
    doc.text('Expenses', 110, currentY + 5);
    doc.text('Net Cashflow', 150, currentY + 5);

    currentY += 9;

    monthlyReportData.forEach((m, idx) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;

        // Repeat header
        doc.setFillColor(15, 23, 42);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('Month', 18, currentY + 5);
        doc.text('Status', 42, currentY + 5);
        doc.text('Income', 70, currentY + 5);
        doc.text('Expenses', 110, currentY + 5);
        doc.text('Net Cashflow', 150, currentY + 5);
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
        doc.text('Forecast', 42, currentY + 3);
      } else if (m.isCurrent) {
        doc.setTextColor(59, 130, 246);
        doc.text('Current', 42, currentY + 3);
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('Actual', 42, currentY + 3);
      }

      const totalInc = m.incomeConverted + m.scheduledIncomeConverted + m.sharedIncomeConverted + (includePendingRecurring ? m.estimatedPendingIncomeConverted : 0);
      const totalExp = m.expenseConverted + m.scheduledExpenseConverted + m.sharedExpenseConverted + (includePendingRecurring ? m.estimatedPendingExpenseConverted : 0);

      doc.setTextColor(51, 65, 85);
      doc.text(formatCurrency(totalInc, displayCurrency), 70, currentY + 3);
      doc.text(formatCurrency(totalExp, displayCurrency), 110, currentY + 3);
      doc.text(formatCurrency(totalInc - totalExp, displayCurrency), 150, currentY + 3);

      currentY += 6;
    });

    doc.save(`LevLev_Financial_Report_${displayCurrency}_${timeRange}.pdf`);
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const targetMonthData = monthlyReportData.find(m => m.month === label);

      return (
        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[260px]">
          <div className="border-b border-slate-200 dark:border-slate-700/80 pb-1 flex justify-between items-center gap-4">
            <span className="font-bold text-slate-900 dark:text-slate-200">{t('reports.period') || 'Period'}: {label}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              $1 USD = ${usdArsRate} ARS
            </span>
          </div>

          <div className="space-y-1.5">
            {payload.filter((e: any) => e.value > 0).map((entry: any, index: number) => {
              return (
                <div key={`item-${index}`} className="flex justify-between items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                    {entry.name}:
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      {formatCurrency(entry.value, displayCurrency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {targetMonthData && targetMonthData.pendingRecurringItems.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Estimated Pending Recurring ({targetMonthData.pendingRecurringItems.length} items)</span>
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                {targetMonthData.pendingRecurringItems.slice(0, 4).map((p, pIdx) => (
                  <div key={pIdx} className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="truncate pr-2">~Day {p.dayOfMonth} {p.title}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                      {p.type === 'INCOME' ? '+' : '-'}{formatCurrency(p.convertedAmount, displayCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('reports.title') || 'Reports & Cashflow Trends'}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('reports.subtitle') || 'Comprehensive historical reports, multi-currency breakdowns, and pending recurring cashflow forecasts.'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Include Estimated Pending Recurring Toggle */}
          <button
            id="toggle-pending-recurring-reports-btn"
            onClick={() => setIncludePendingRecurring(!includePendingRecurring)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs ${
              includePendingRecurring
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="Toggle estimated pending recurring expenses and income"
          >
            <Sparkles className={`w-3.5 h-3.5 ${includePendingRecurring ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
            <span>{includePendingRecurring ? 'Pending Recurring: ON' : 'Pending Recurring: OFF'}</span>
          </button>

          {/* Time Range Selector */}
          <div className="bg-slate-100 dark:bg-[#0f131a] p-1 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setTimeRange('6M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '6M' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('reports.time_6m') || '6M'}
            </button>
            <button
              onClick={() => setTimeRange('12M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '12M' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('reports.time_12m') || '12M'}
            </button>
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('reports.time_all') || 'All'}
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f131a] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-xl focus:outline-hidden font-medium"
          >
            <option value="ALL">{t('reports.all_categories') || 'All Categories'}</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ml-auto md:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('reports.export_report') || 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income Card */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{t('reports.total_income') || 'Total Income'}</span>
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(summaryMetrics.totalIncomeConverted, displayCurrency)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1">
            {Object.keys(summaryMetrics.incomeByCurrency).length > 0 ? (
              Object.entries(summaryMetrics.incomeByCurrency).map(([curr, amt]) => (
                <span key={curr} className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                  {curr}: {formatCurrencyCompact(amt, curr as DisplayCurrency)}
                </span>
              ))
            ) : (
              <>
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                  {localCurr}: ${Math.round(summaryMetrics.totalIncomeLocal).toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20">
                  {foreignCurr}: ${Math.round(summaryMetrics.totalIncomeForeign).toLocaleString()}
                </span>
              </>
            )}
          </div>
          {includePendingRecurring && summaryMetrics.totalEstimatedPendingIncomeConverted > 0 && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 pt-1">
              <Sparkles className="w-3 h-3" />
              <span>Incl. {formatCurrency(summaryMetrics.totalEstimatedPendingIncomeConverted, displayCurrency)} estimated</span>
            </div>
          )}
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{t('reports.total_expenses') || 'Total Expenses'}</span>
            <span className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {formatCurrency(summaryMetrics.totalExpenseConverted, displayCurrency)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1">
            {Object.keys(summaryMetrics.expenseByCurrency).length > 0 ? (
              Object.entries(summaryMetrics.expenseByCurrency).map(([curr, amt]) => (
                <span key={curr} className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
                  {curr}: {formatCurrencyCompact(amt, curr as DisplayCurrency)}
                </span>
              ))
            ) : (
              <>
                <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
                  {localCurr}: ${Math.round(summaryMetrics.totalExpenseLocal).toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                  {foreignCurr}: ${Math.round(summaryMetrics.totalExpenseForeign).toLocaleString()}
                </span>
              </>
            )}
          </div>
          {includePendingRecurring && summaryMetrics.totalEstimatedPendingExpenseConverted > 0 && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 pt-1">
              <Sparkles className="w-3 h-3" />
              <span>Incl. {formatCurrency(summaryMetrics.totalEstimatedPendingExpenseConverted, displayCurrency)} estimated</span>
            </div>
          )}
        </div>

        {/* Net Savings & Savings Rate */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{t('reports.net_cash_flow') || 'Net Cash Flow'}</span>
            <span className={`p-1.5 rounded-lg ${summaryMetrics.netSavingsConverted >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-2xl font-extrabold font-mono ${summaryMetrics.netSavingsConverted >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(summaryMetrics.netSavingsConverted, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between">
            <span>{t('reports.savings_rate') || 'Savings Rate'}:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] font-mono ${summaryMetrics.savingsRate >= 20 ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20'}`}>
              {summaryMetrics.savingsRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Monthly Average */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{t('reports.monthly_run_rate') || 'Monthly Run Rate'}</span>
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {formatCurrency(summaryMetrics.avgMonthlyExpense, displayCurrency)}
            <span className="text-xs font-normal text-slate-400"> / mo</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between">
            <span>{t('reports.avg_income') || 'Avg Income'}:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(summaryMetrics.avgMonthlyIncome, displayCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Bar Chart Section */}
      <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{t('reports.chart_title') || 'Monthly Cashflow & Income vs Expenses'}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                {t('reports.color_coded') || 'Detailed'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {includePendingRecurring 
                ? 'Displaying actual transactions, scheduled bills, and estimated pending recurring items.'
                : 'Displaying realized and scheduled transactions only.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Mode Toggle */}
            <div className="bg-slate-100 dark:bg-[#0f131a] p-1 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setChartMode('NATIVE_CURRENCY')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  chartMode === 'NATIVE_CURRENCY' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t('reports.native_breakdown') || 'Native Breakdown'}
              </button>
              <button
                onClick={() => setChartMode('CONVERTED')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  chartMode === 'CONVERTED' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t('reports.total_converted') || 'Total Converted'} ({displayCurrency})
              </button>
            </div>

            {/* Stacked vs Grouped Toggle (Only in Native Currency Mode) */}
            {chartMode === 'NATIVE_CURRENCY' && (
              <div className="bg-slate-100 dark:bg-[#0f131a] p-1 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center text-xs">
                <button
                  onClick={() => setBarStyle('STACKED')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    barStyle === 'STACKED' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title={t('reports.stacked') || 'Stacked'}
                >
                  {t('reports.stacked') || 'Stacked'}
                </button>
                <button
                  onClick={() => setBarStyle('GROUPED')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    barStyle === 'GROUPED' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title={t('reports.grouped') || 'Grouped'}
                >
                  {t('reports.grouped') || 'Grouped'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Currency Legend Badges */}
        {chartMode === 'CONVERTED' ? (
          <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] bg-slate-50 dark:bg-[#0f131a] p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeTotal }}></span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{t('reports.owned_income') || 'Realized Income'}</span>
            </div>
            {includePendingRecurring && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm border border-emerald-500 bg-emerald-500/40"></span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Estimated Recurring Income</span>
              </div>
            )}
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseTotal }}></span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{t('reports.owned_expense') || 'Realized Expenses'}</span>
            </div>
            {includePendingRecurring && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm border border-rose-500 bg-rose-500/40"></span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">Estimated Recurring Bills</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] bg-slate-50 dark:bg-[#0f131a] p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeARS }}></span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Income ({localCurr})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.incomeUSD }}></span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Income ({foreignCurr})</span>
              </div>
            </div>
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseARS }}></span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Expense ({localCurr})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenseUSD }}></span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Expense ({foreignCurr})</span>
              </div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: '#88888840' }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#88888840' }}
                  tickFormatter={(val) => formatCurrencyCompact(val, displayCurrency)}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Scheduled Income Local */}
                <Bar 
                  dataKey="scheduledIncomeLocal_Converted" 
                  name={`Scheduled Income (${localCurr})`} 
                  fill={COLORS.incomeARS}
                  fillOpacity={0.4}
                  stroke={COLORS.incomeARS}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Scheduled Income Foreign */}
                <Bar 
                  dataKey="scheduledIncomeForeign_Converted" 
                  name={`Scheduled Income (${foreignCurr})`} 
                  fill={COLORS.incomeUSD} 
                  fillOpacity={0.4}
                  stroke={COLORS.incomeUSD}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Income Local */}
                <Bar 
                  dataKey="incomeLocal_Converted" 
                  name={`Income (${localCurr})`} 
                  fill={COLORS.incomeARS} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Shared Income Local */}
                <Bar 
                  dataKey="sharedIncomeLocal_Converted" 
                  name={`Shared Income (${localCurr})`} 
                  fill={COLORS.sharedIncomeARS} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Income Foreign */}
                <Bar 
                  dataKey="incomeForeign_Converted" 
                  name={`Income (${foreignCurr})`} 
                  fill={COLORS.incomeUSD} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Shared Income Foreign */}
                <Bar 
                  dataKey="sharedIncomeForeign_Converted" 
                  name={`Shared Income (${foreignCurr})`} 
                  fill={COLORS.sharedIncomeUSD} 
                  stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Estimated Pending Income */}
                {includePendingRecurring && (
                  <Bar 
                    dataKey="estimatedPendingIncomeConverted" 
                    name="Estimated Recurring Income" 
                    fill={COLORS.estimatedIncomeTotal} 
                    fillOpacity={0.45}
                    stroke={COLORS.estimatedIncomeTotal}
                    strokeDasharray="3 3"
                    stackId={barStyle === 'STACKED' ? 'income' : undefined} 
                    radius={[4, 4, 0, 0]} 
                  />
                )}
                {/* Scheduled Expense Local */}
                <Bar 
                  dataKey="scheduledExpenseLocal_Converted" 
                  name={`Scheduled Expense (${localCurr})`} 
                  fill={COLORS.expenseARS} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseARS}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Scheduled Expense Foreign */}
                <Bar 
                  dataKey="scheduledExpenseForeign_Converted" 
                  name={`Scheduled Expense (${foreignCurr})`} 
                  fill={COLORS.expenseUSD} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseUSD}
                  strokeDasharray="4 4"
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Expense Local */}
                <Bar 
                  dataKey="expenseLocal_Converted" 
                  name={`Expense (${localCurr})`} 
                  fill={COLORS.expenseARS} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Shared Expense Local */}
                <Bar 
                  dataKey="sharedExpenseLocal_Converted" 
                  name={`Shared Expense (${localCurr})`} 
                  fill={COLORS.sharedExpenseARS} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={barStyle === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
                {/* Expense Foreign */}
                <Bar 
                  dataKey="expenseForeign_Converted" 
                  name={`Expense (${foreignCurr})`} 
                  fill={COLORS.expenseUSD} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Shared Expense Foreign */}
                <Bar 
                  dataKey="sharedExpenseForeign_Converted" 
                  name={`Shared Expense (${foreignCurr})`} 
                  fill={COLORS.sharedExpenseUSD} 
                  stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                  radius={[4, 4, 0, 0]} 
                />
                {/* Estimated Pending Expenses */}
                {includePendingRecurring && (
                  <Bar 
                    dataKey="estimatedPendingExpenseConverted" 
                    name="Estimated Recurring Bills" 
                    fill={COLORS.estimatedExpenseTotal} 
                    fillOpacity={0.45}
                    stroke={COLORS.estimatedExpenseTotal}
                    strokeDasharray="3 3"
                    stackId={barStyle === 'STACKED' ? 'expense' : undefined} 
                    radius={[4, 4, 0, 0]} 
                  />
                )}
              </BarChart>
            ) : (
              <BarChart
                data={monthlyReportData}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: '#88888840' }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: '#88888840' }}
                  tickFormatter={(val) => formatCurrencyCompact(val, displayCurrency)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                
                <Bar 
                  dataKey="incomeConverted" 
                  name={`${t('reports.actual') || 'Actual'} ${t('reports.income') || 'Income'} (${displayCurrency})`} 
                  fill={COLORS.incomeTotal} 
                  stackId="income"
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="scheduledIncomeConverted" 
                  name={`${t('reports.scheduled') || 'Scheduled'} ${t('reports.income') || 'Income'} (${displayCurrency})`} 
                  fill={COLORS.incomeTotal} 
                  fillOpacity={0.4}
                  stroke={COLORS.incomeTotal}
                  strokeDasharray="4 4"
                  stackId="income"
                  radius={[0, 0, 0, 0]} 
                />
                {includePendingRecurring && (
                  <Bar 
                    dataKey="estimatedPendingIncomeConverted" 
                    name={`Estimated Recurring Income (${displayCurrency})`} 
                    fill={COLORS.estimatedIncomeTotal} 
                    fillOpacity={0.45}
                    stroke={COLORS.estimatedIncomeTotal}
                    strokeDasharray="3 3"
                    stackId="income"
                    radius={[4, 4, 0, 0]} 
                  />
                )}

                <Bar 
                  dataKey="expenseConverted" 
                  name={`${t('reports.actual') || 'Actual'} ${t('reports.expense') || 'Expense'} (${displayCurrency})`} 
                  fill={COLORS.expenseTotal} 
                  stackId="expense"
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="scheduledExpenseConverted" 
                  name={`${t('reports.scheduled') || 'Scheduled'} ${t('reports.expense') || 'Expense'} (${displayCurrency})`} 
                  fill={COLORS.expenseTotal} 
                  fillOpacity={0.4}
                  stroke={COLORS.expenseTotal}
                  strokeDasharray="4 4"
                  stackId="expense"
                  radius={[0, 0, 0, 0]} 
                />
                {includePendingRecurring && (
                  <Bar 
                    dataKey="estimatedPendingExpenseConverted" 
                    name={`Estimated Recurring Bills (${displayCurrency})`} 
                    fill={COLORS.estimatedExpenseTotal} 
                    fillOpacity={0.45}
                    stroke={COLORS.estimatedExpenseTotal}
                    strokeDasharray="3 3"
                    stackId="expense"
                    radius={[4, 4, 0, 0]} 
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Estimated Recurring Cashflows Breakdown Section */}
      {includePendingRecurring && currentMonthData && currentMonthData.pendingRecurringItems.length > 0 && (
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Estimated Pending Recurring Cashflows ({currentMonthData.month})</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold font-mono">
                    {currentMonthData.pendingRecurringItems.length} items
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recurring expenses and incomes expected to occur before end-of-month that are not yet logged.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Pending Bills: <strong className="text-rose-600 dark:text-rose-400 font-mono">-{formatCurrency(currentMonthData.estimatedPendingExpenseConverted, displayCurrency)}</strong></span>
              <span className="text-slate-500 dark:text-slate-400">Pending Income: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">+{formatCurrency(currentMonthData.estimatedPendingIncomeConverted, displayCurrency)}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {currentMonthData.pendingRecurringItems.map((item) => {
              const isIncome = item.type === 'INCOME';
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0f131a] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        isIncome 
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}>
                        {isIncome ? 'INCOME' : 'EXPENSE'}
                      </span>
                      {item.isManualRule && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                          Rule
                        </span>
                      )}
                      {item.isInstallment && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono">
                          {item.installmentInfo || 'Cuotas'}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        ~Day {item.dayOfMonth}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate mt-1">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {item.category} • {item.account}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono font-bold text-xs block ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(item.convertedAmount, displayCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatCurrency(item.amount, item.currency as DisplayCurrency)} {item.currency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Secondary Row: Category Expenses Breakdown & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Share Donut Chart */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-indigo-500" />
            <span>{t('reports.category_performance') || 'Category Breakdown'}</span>
          </h2>

          {categoryBreakdownData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
              {t('reports.no_category_data') || 'No expense data for selected range.'}
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
                      formatter={(value: any) => [formatCurrency(Number(value), displayCurrency), t('reports.expense') || 'Expense']} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-xs">
                {categoryBreakdownData.slice(0, 8).map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-[#0f131a] border border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center gap-2 truncate">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                      ></span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono ml-2">
                      {formatCurrency(cat.value, displayCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Net Cash Flow Trend Chart */}
        <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>{t('reports.savings_trend') || 'Net Cashflow Trajectory'}</span>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip 
                  formatter={(val: any) => [formatCurrency(Number(val), displayCurrency), t('reports.net_cash_flow') || 'Net Cash Flow']} 
                />
                <Area type="monotone" dataKey="netConverted" name={t('reports.net_flow') || 'Net Cash Flow'} stroke="#10b981" fillOpacity={1} fill="url(#colorNet)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
});
export default ReportsTab;
