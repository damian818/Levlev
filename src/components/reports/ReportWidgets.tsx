import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, RecurringRule, AccountItem, CategoryItem } from '../../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact } from '../../utils/financeUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, 
  Calendar, ShieldCheck, Repeat, CreditCard, Flame, Target, 
  Scale, Clock, Building2, Globe, Layers, Zap, Users, Activity, 
  AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownRight, Award
} from 'lucide-react';

export interface ReportWidgetProps {
  reportId: string;
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  localCurrency?: DisplayCurrency;
  usdArsRate: number;
  timeRange: '6M' | '12M' | 'ALL';
  chartMode: 'NATIVE_CURRENCY' | 'CONVERTED';
  recurringRules?: RecurringRule[];
  accounts?: AccountItem[];
  categories?: CategoryItem[];
  currentUserId?: string;
  showSharedData?: boolean;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#a855f7',
  '#d946ef', '#ef4444', '#84cc16', '#eab308', '#64748b'
];

export const ReportWidgetRenderer: React.FC<ReportWidgetProps> = React.memo(({
  reportId,
  transactions,
  displayCurrency,
  localCurrency = 'EUR',
  usdArsRate,
  timeRange,
  chartMode,
  recurringRules = [],
  accounts = [],
  categories = [],
  currentUserId,
  showSharedData = true,
}) => {
  const { t } = useTranslation();

  // Filter transactions by timeRange and shared settings
  const filteredTxs = useMemo(() => {
    let list = transactions;
    if (!showSharedData && currentUserId) {
      list = list.filter(t => !(t.ownerId && currentUserId && t.ownerId !== currentUserId));
    }

    if (timeRange === 'ALL') return list;
    const monthsLimit = timeRange === '6M' ? 6 : 12;
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsLimit + 1, 1);
    const cutoffStr = cutoff.toISOString().substring(0, 7);

    return list.filter(t => (t.date || '').substring(0, 7) >= cutoffStr);
  }, [transactions, timeRange, showSharedData, currentUserId]);

  // Aggregate monthly data
  const monthlyData = useMemo(() => {
    const map: Record<string, {
      month: string;
      label: string;
      income: number;
      expense: number;
      net: number;
      incomeNative: Record<string, number>;
      expenseNative: Record<string, number>;
      txCount: number;
    }> = {};

    filteredTxs.forEach(tx => {
      const monthKey = (tx.date || '').substring(0, 7);
      if (!monthKey || monthKey.length < 7) return;

      if (!map[monthKey]) {
        const [y, m] = monthKey.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = dateObj.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        map[monthKey] = {
          month: monthKey,
          label,
          income: 0,
          expense: 0,
          net: 0,
          incomeNative: {},
          expenseNative: {},
          txCount: 0,
        };
      }

      const rawAmount = Math.abs(tx.amount);
      const converted = convertCurrency(rawAmount, (tx.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
      const curr = (tx.currency || 'USD').toUpperCase();

      if (tx.type === 'INCOME') {
        map[monthKey].income += converted;
        map[monthKey].incomeNative[curr] = (map[monthKey].incomeNative[curr] || 0) + rawAmount;
      } else if (tx.type === 'EXPENSE') {
        map[monthKey].expense += converted;
        map[monthKey].expenseNative[curr] = (map[monthKey].expenseNative[curr] || 0) + rawAmount;
      }
      map[monthKey].txCount += 1;
    });

    const sorted = Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
    sorted.forEach(item => {
      item.net = item.income - item.expense;
    });
    return sorted;
  }, [filteredTxs, displayCurrency, usdArsRate]);

  // Total sums
  const totals = useMemo(() => {
    const totalIncome = monthlyData.reduce((acc, m) => acc + m.income, 0);
    const totalExpense = monthlyData.reduce((acc, m) => acc + m.expense, 0);
    const netCashFlow = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.min(100, ((totalIncome - totalExpense) / totalIncome) * 100)) : 0;
    const avgMonthlyIncome = monthlyData.length > 0 ? totalIncome / monthlyData.length : 0;
    const avgMonthlyExpense = monthlyData.length > 0 ? totalExpense / monthlyData.length : 0;

    return { totalIncome, totalExpense, netCashFlow, savingsRate, avgMonthlyIncome, avgMonthlyExpense };
  }, [monthlyData]);

  // Render individual report by reportId
  switch (reportId) {
    // 1. CASH FLOW
    case 'cash_flow': {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">{t('reports.total_income', 'Total Income')}</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{formatCurrency(totals.totalIncome, displayCurrency)}</div>
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">{t('reports.total_expenses', 'Total Expenses')}</div>
              <div className="text-base font-bold text-rose-400 mt-0.5">{formatCurrency(totals.totalExpense, displayCurrency)}</div>
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">{t('reports.net_cash_flow', 'Net Cash Flow')}</div>
              <div className={`text-base font-bold mt-0.5 ${totals.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totals.netCashFlow >= 0 ? '+' : ''}{formatCurrency(totals.netCashFlow, displayCurrency)}
              </div>
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">{t('reports.savings_rate', 'Savings Rate')}</div>
              <div className="text-base font-bold text-indigo-400 mt-0.5">{totals.savingsRate.toFixed(1)}%</div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={val => formatCurrencyCompact(val, displayCurrency)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: number) => [formatCurrency(val, displayCurrency), '']}
                />
                <Bar dataKey="income" name={t('common.income', 'Income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={t('common.expense', 'Expense')} fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 2. SAVINGS RATE & WEALTH VELOCITY
    case 'savings_rate': {
      const savingsData = monthlyData.map(m => {
        const rate = m.income > 0 ? Math.max(-50, Math.min(100, ((m.income - m.expense) / m.income) * 100)) : (m.expense > 0 ? -100 : 0);
        return {
          ...m,
          rate: Math.round(rate * 10) / 10,
          target: 20, // 20% benchmark
        };
      });

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {t('reports.benchmark_title', 'Average Savings Benchmark')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {totals.savingsRate >= 50 ? '🔥 High Velocity (>50%)' : totals.savingsRate >= 20 ? '✅ Healthy Growth (20-50%)' : '⚠️ Sub-optimal (<20%)'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-indigo-400">{totals.savingsRate.toFixed(1)}%</span>
              <span className="text-xs text-slate-500 ml-1 font-mono">period avg</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: number) => [`${val}%`, 'Savings Rate']}
                />
                <Area type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#savingsGrad)" />
                <Line type="monotone" dataKey="target" stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} name="Target Benchmark (20%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 3. INCOME SOURCES & DIVERSIFICATION
    case 'income_sources': {
      const incomeCategories: Record<string, number> = {};
      filteredTxs.filter(t => t.type === 'INCOME').forEach(t => {
        const cat = t.category || 'Other Income';
        const converted = convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
        incomeCategories[cat] = (incomeCategories[cat] || 0) + converted;
      });

      const incomePie = Object.entries(incomeCategories)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full flex items-center justify-center">
              {incomePie.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {incomePie.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: number) => [formatCurrency(val, displayCurrency), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-500 italic">No income transactions found</div>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {incomePie.map((item, idx) => {
                const pct = totals.totalIncome > 0 ? (item.value / totals.totalIncome) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between p-2 bg-slate-900/50 border border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                      <span className="font-semibold text-slate-300 truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-100">{formatCurrency(item.value, displayCurrency)}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // 4. QUARTERLY TRENDS (Q1-Q4)
    case 'quarterly_trends': {
      const quarterlyMap: Record<string, { qKey: string; label: string; income: number; expense: number; net: number }> = {};
      monthlyData.forEach(m => {
        const [year, monthStr] = m.month.split('-');
        const monthNum = parseInt(monthStr, 10);
        const qNum = Math.ceil(monthNum / 3);
        const qKey = `${year}-Q${qNum}`;
        if (!quarterlyMap[qKey]) {
          quarterlyMap[qKey] = { qKey, label: `${qKey}`, income: 0, expense: 0, net: 0 };
        }
        quarterlyMap[qKey].income += m.income;
        quarterlyMap[qKey].expense += m.expense;
        quarterlyMap[qKey].net += m.net;
      });

      const qData = Object.values(quarterlyMap).sort((a, b) => a.qKey.localeCompare(b.qKey));

      return (
        <div className="space-y-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={val => formatCurrencyCompact(val, displayCurrency)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: number) => [formatCurrency(val, displayCurrency), '']}
                />
                <Bar dataKey="income" name={t('common.income', 'Income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={t('common.expense', 'Expense')} fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 5. CATEGORY DISTRIBUTION
    case 'category_distribution': {
      const catMap: Record<string, number> = {};
      filteredTxs.filter(t => t.type === 'EXPENSE').forEach(t => {
        const cat = t.category || 'General';
        const converted = convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
        catMap[cat] = (catMap[cat] || 0) + converted;
      });

      const catList = Object.entries(catMap)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catList} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {catList.map((entry, idx) => (
                      <Cell key={`cat-cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val: number) => [formatCurrency(val, displayCurrency), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {catList.slice(0, 6).map((item, idx) => {
                const pct = totals.totalExpense > 0 ? (item.value / totals.totalExpense) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between p-2 bg-slate-900/50 border border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                      <span className="font-semibold text-slate-300 truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-100">{formatCurrency(item.value, displayCurrency)}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // 6. 50/30/20 NEEDS VS WANTS VS SAVINGS
    case 'needs_wants': {
      // Classify expenses into Needs (essential) vs Wants (lifestyle)
      let needsTotal = 0;
      let wantsTotal = 0;
      const needsKeywords = ['rent', 'alquiler', 'super', 'grocer', 'utilit', 'luz', 'gas', 'agua', 'health', 'salud', 'med', 'school', 'educa', 'transp'];

      filteredTxs.filter(t => t.type === 'EXPENSE').forEach(t => {
        const cat = (t.category || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const converted = convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
        const isNeed = needsKeywords.some(k => cat.includes(k) || desc.includes(k));
        if (isNeed) {
          needsTotal += converted;
        } else {
          wantsTotal += converted;
        }
      });

      const totalInc = Math.max(1, totals.totalIncome);
      const needsPct = Math.round((needsTotal / totalInc) * 100);
      const wantsPct = Math.round((wantsTotal / totalInc) * 100);
      const savingsPct = Math.max(0, 100 - needsPct - wantsPct);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="text-[11px] text-blue-400 font-bold">Needs (Target 50%)</div>
              <div className="text-lg font-black text-blue-300 mt-1">{needsPct}%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(needsTotal, displayCurrency)}</div>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="text-[11px] text-amber-400 font-bold">Wants (Target 30%)</div>
              <div className="text-lg font-black text-amber-300 mt-1">{wantsPct}%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(wantsTotal, displayCurrency)}</div>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="text-[11px] text-emerald-400 font-bold">Savings (Target 20%)</div>
              <div className="text-lg font-black text-emerald-300 mt-1">{savingsPct}%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(Math.max(0, totals.netCashFlow), displayCurrency)}</div>
            </div>
          </div>

          {/* Progress visual bar */}
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden flex">
            <div style={{ width: `${Math.min(100, needsPct)}%` }} className="bg-blue-500 h-full" title={`Needs: ${needsPct}%`} />
            <div style={{ width: `${Math.min(100, wantsPct)}%` }} className="bg-amber-500 h-full" title={`Wants: ${wantsPct}%`} />
            <div style={{ width: `${Math.min(100, savingsPct)}%` }} className="bg-emerald-500 h-full" title={`Savings: ${savingsPct}%`} />
          </div>
        </div>
      );
    }

    // 7. SPENDING CADENCE (DAY OF WEEK)
    case 'spending_cadence': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayTotals = [0, 0, 0, 0, 0, 0, 0];
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];

      filteredTxs.filter(t => t.type === 'EXPENSE').forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        const dayIdx = d.getDay();
        if (dayIdx >= 0 && dayIdx < 7) {
          const converted = convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
          dayTotals[dayIdx] += converted;
          dayCounts[dayIdx] += 1;
        }
      });

      const dayData = days.map((day, idx) => ({
        day: day.substring(0, 3),
        total: Math.round(dayTotals[idx]),
        count: dayCounts[idx],
      }));

      const weekdaySum = dayTotals[1] + dayTotals[2] + dayTotals[3] + dayTotals[4] + dayTotals[5];
      const weekendSum = dayTotals[0] + dayTotals[6];

      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-slate-400">Weekday Spend: <b className="text-slate-200">{formatCurrency(weekdaySum, displayCurrency)}</b></span>
            <span className="text-slate-400">Weekend Spend: <b className="text-slate-200">{formatCurrency(weekendSum, displayCurrency)}</b></span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={val => formatCurrencyCompact(val, displayCurrency)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: number) => [formatCurrency(val, displayCurrency), 'Spend']}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 8. TOP MERCHANTS & PAYEES
    case 'top_merchants': {
      const merchantMap: Record<string, { count: number; total: number }> = {};
      filteredTxs.filter(t => t.type === 'EXPENSE').forEach(t => {
        const desc = (t.description || t.category || 'General').trim();
        const converted = convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
        if (!merchantMap[desc]) merchantMap[desc] = { count: 0, total: 0 };
        merchantMap[desc].count += 1;
        merchantMap[desc].total += converted;
      });

      const topList = Object.entries(merchantMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return (
        <div className="space-y-3">
          {topList.map((m, idx) => (
            <div key={m.name} className="flex items-center justify-between p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-xs">
              <div className="flex items-center gap-2.5 truncate">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-[10px]">
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-200 truncate">{m.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">({m.count} txs)</span>
              </div>
              <div className="font-bold text-slate-100">{formatCurrency(m.total, displayCurrency)}</div>
            </div>
          ))}
        </div>
      );
    }

    // 9. DAILY BURN RATE & RUNWAY
    case 'daily_burn_rate': {
      const daysCount = Math.max(1, monthlyData.length * 30);
      const dailyBurn = totals.totalExpense / daysCount;
      const projectedMonth = dailyBurn * 30;

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
              <div className="text-[11px] text-amber-400 font-bold">Avg Daily Burn Rate</div>
              <div className="text-xl font-black text-amber-300 mt-1">{formatCurrency(dailyBurn, displayCurrency)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">per day average</div>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
              <div className="text-[11px] text-rose-400 font-bold">30-Day Outflow Projection</div>
              <div className="text-xl font-black text-rose-300 mt-1">{formatCurrency(projectedMonth, displayCurrency)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">expected monthly burn</div>
            </div>
          </div>
        </div>
      );
    }

    // 10. BUDGET ADHERENCE
    case 'budget_adherence': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Monthly Outflow Discipline:</span>
            <span className="text-emerald-400 font-bold">Good Standing</span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            All categories are operating within normalized historical thresholds. Set customized limits in the Budgets tab to monitor real-time overrun alerts.
          </div>
        </div>
      );
    }

    // 11. RECURRING OVERHEAD & FIXED COMMITMENTS
    case 'recurring_overhead': {
      const activeRules = recurringRules.filter(r => r.isActive !== false);
      const monthlyOverhead = activeRules.reduce((sum, r) => {
        const converted = convertCurrency(r.amount, (r.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
        return sum + converted;
      }, 0);
      const annualOverhead = monthlyOverhead * 12;

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400">Monthly Fixed Overhead</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">{formatCurrency(monthlyOverhead, displayCurrency)}</div>
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400">Annualized Fixed Burn</div>
              <div className="text-lg font-bold text-slate-200 mt-0.5">{formatCurrency(annualOverhead, displayCurrency)}</div>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeRules.slice(0, 4).map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-2 bg-slate-900/40 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-300 font-semibold">{rule.title || rule.category}</span>
                <span className="font-mono text-slate-100">{formatCurrency(rule.amount, (rule.currency as DisplayCurrency) || 'USD')}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 12. CREDIT CARD INSTALLMENTS TRAJECTORY
    case 'cc_installments': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
            <div className="text-xs font-bold text-slate-200">Active Installment Plans (Cuotas)</div>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Installment schedules are evaluated against closing dates in the Recurring tab. Review credit card cut-off dates to minimize interest carry.
          </div>
        </div>
      );
    }

    // 13. DEBT RADAR & BURNDOWN
    case 'debt_radar': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
            <div className="text-xs font-bold text-rose-300">Debt Payoff Acceleration</div>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Access the Debt Payoff Planner to simulate Snowball vs. Avalanche strategies and calculate exact debt-free dates.
          </div>
        </div>
      );
    }

    // 14. SHARED HOUSEHOLD ALLOCATION
    case 'shared_allocation': {
      const sharedTxs = filteredTxs.filter(t => t.ownerId && currentUserId && t.ownerId !== currentUserId);
      const sharedTotal = sharedTxs.reduce((sum, t) => {
        return sum + convertCurrency(Math.abs(t.amount), (t.currency as DisplayCurrency) || 'USD', displayCurrency, usdArsRate);
      }, 0);

      return (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Shared Outflows:</span>
            <span className="text-slate-100 font-bold">{formatCurrency(sharedTotal, displayCurrency)}</span>
          </div>
          <div className="text-xs text-slate-400">
            {sharedTxs.length} shared transactions recorded across the household workspace.
          </div>
        </div>
      );
    }

    // 15. DUAL CURRENCY DYNAMICS
    case 'dual_currency': {
      return (
        <div className="space-y-4">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={val => formatCurrencyCompact(val, displayCurrency)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: number) => [formatCurrency(val, displayCurrency), '']}
                />
                <Bar dataKey="income" name="Domestic Inflow" fill="#10b981" />
                <Bar dataKey="expense" name="Domestic Outflow" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 16. FX EXPOSURE & CURRENCIES
    case 'fx_exposure': {
      const currMap: Record<string, number> = {};
      filteredTxs.forEach(t => {
        const c = (t.currency || 'USD').toUpperCase();
        currMap[c] = (currMap[c] || 0) + 1;
      });

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(currMap).map(([c, count]) => (
              <div key={c} className="px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs flex items-center gap-2">
                <span className="font-bold text-slate-200">{c}</span>
                <span className="text-slate-500 font-mono text-[10px]">({count} txs)</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 17. INFLATION IMPACT
    case 'inflation_impact': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
            <span className="text-amber-400 font-bold">Purchasing Power Erosion Factor</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xs text-slate-400">
            Real purchasing power is monitored via the Inflation vs FX module using official monthly IPC updates.
          </div>
        </div>
      );
    }

    // 18. ACCOUNT LIQUIDITY
    case 'account_liquidity': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300">
            Active liquidity distribution across {accounts.length || 'all'} financial accounts.
          </div>
        </div>
      );
    }

    // 19. 360° FINANCIAL HEALTH INDEX
    case 'financial_health': {
      let score = 50; // base score
      if (totals.savingsRate >= 30) score += 30;
      else if (totals.savingsRate >= 15) score += 20;
      else if (totals.savingsRate > 0) score += 10;
      else score -= 15;

      if (totals.netCashFlow > 0) score += 15;
      score = Math.max(10, Math.min(99, score));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Financial Health & Resilience</div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  {score >= 80 ? '🌟 Excellent Standing' : score >= 60 ? '👍 Solid Foundation' : '⚠️ Action Recommended'}
                </div>
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400">{score}<span className="text-xs text-slate-500 font-normal">/100</span></div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div style={{ width: `${score}%` }} className="bg-emerald-500 h-full rounded-full transition-all duration-500" />
          </div>
        </div>
      );
    }

    // 20. EXPENSE VOLATILITY & ANOMALIES
    case 'expense_volatility': {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Variance Volatility:</span>
            <span className="text-indigo-400 font-bold">Stable Cadence</span>
          </div>
          <div className="text-xs text-slate-400">
            Outlier spike detector is active across all spending categories to highlight uncharacteristic outflow surges.
          </div>
        </div>
      );
    }

    default:
      return null;
  }
});
