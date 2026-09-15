import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IdentifiedRecurringItem, DisplayCurrency, InflationPoint, Transaction, CategoryItem } from '../types';
import { convertCurrency, formatCurrency, getHistoricalFxRate } from '../utils/financeUtils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList, BarChart } from 'recharts';
import { TrendingUp, X, Filter, Layers, BarChart2, Calendar, Search, ArrowUpRight, ArrowDownRight, Tag } from 'lucide-react';

export interface RecurringCategoryTrendModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringItems?: IdentifiedRecurringItem[];
  transactions?: Transaction[];
  categoriesList?: CategoryItem[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
  initialCategory?: string;
  defaultScope?: 'all' | 'recurring';
}

export function RecurringCategoryTrendModal({
  isOpen,
  onClose,
  recurringItems = [],
  transactions = [],
  categoriesList = [],
  displayCurrency,
  usdArsRate,
  historyData,
  initialCategory,
  defaultScope = 'all',
}: RecurringCategoryTrendModalProps) {
  const { t } = useTranslation();

  const [viewScope, setViewScope] = useState<'all' | 'recurring'>(defaultScope);
  const [timeSpan, setTimeSpan] = useState<'12M' | '6M' | 'ALL'>('12M');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Extract ALL unique expense categories from transactions, categoriesList, and recurringItems
  const categorySummaryMap = useMemo(() => {
    const map = new Map<string, { totalSpent: number; txCount: number; recurringCount: number }>();

    // From transactions
    transactions.forEach(tx => {
      if (tx.type !== 'EXPENSE' || !tx.category) return;
      const cat = tx.category.trim();
      if (!cat) return;
      const existing = map.get(cat) || { totalSpent: 0, txCount: 0, recurringCount: 0 };
      const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions, historyData);
      existing.totalSpent += converted;
      existing.txCount += 1;
      map.set(cat, existing);
    });

    // From recurring items
    recurringItems.forEach(item => {
      if (item.type !== 'EXPENSE' || !item.category) return;
      const cat = item.category.trim();
      const existing = map.get(cat) || { totalSpent: 0, txCount: 0, recurringCount: 0 };
      existing.recurringCount += 1;
      map.set(cat, existing);
    });

    // From categoriesList
    categoriesList.forEach(catItem => {
      const cat = catItem.name?.trim();
      if (!cat) return;
      if (!map.has(cat)) {
        map.set(cat, { totalSpent: 0, txCount: 0, recurringCount: 0 });
      }
    });

    return map;
  }, [transactions, recurringItems, categoriesList, displayCurrency, usdArsRate, historyData]);

  // Sorted list of all categories: highest spenders first, then alphabetically
  const allCategories = useMemo(() => {
    const list = Array.from(categorySummaryMap.keys());
    return list.sort((a, b) => {
      const spentA = categorySummaryMap.get(a)?.totalSpent || 0;
      const spentB = categorySummaryMap.get(b)?.totalSpent || 0;
      if (spentB !== spentA) return spentB - spentA;
      return a.localeCompare(b);
    });
  }, [categorySummaryMap]);

  // Determine initial selected category
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (initialCategory && categorySummaryMap.has(initialCategory)) return initialCategory;
    return allCategories[0] || 'Hogar';
  });

  // Keep selectedCategory synced if initialCategory changes when modal opens
  React.useEffect(() => {
    if (initialCategory && categorySummaryMap.has(initialCategory)) {
      setSelectedCategory(initialCategory);
    } else if (!categorySummaryMap.has(selectedCategory) && allCategories.length > 0) {
      setSelectedCategory(allCategories[0]);
    }
  }, [initialCategory, isOpen, allCategories, categorySummaryMap]);

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return allCategories;
    const q = searchTerm.toLowerCase();
    return allCategories.filter(c => c.toLowerCase().includes(q));
  }, [allCategories, searchTerm]);

  // 2. Build monthly spending trend for the selected category and top categories
  const { chartData, topCategories, stackedChartData, categoryStats } = useMemo(() => {
    const monthlyMap: Record<string, { amount: number; count: number }> = {};
    const multiCategoryMonthlyMap: Record<string, Record<string, number>> = {};
    const monthsSet = new Set<string>();

    if (viewScope === 'recurring' && recurringItems.length > 0) {
      // Recurring-only logic
      recurringItems.forEach(item => {
        if (item.type !== 'EXPENSE') return;

        item.monthlyTrend.forEach(t => {
          monthsSet.add(t.month);
          const converted = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.month, [], historyData);

          if (item.category === selectedCategory) {
            if (!monthlyMap[t.month]) monthlyMap[t.month] = { amount: 0, count: 0 };
            monthlyMap[t.month].amount += converted;
            monthlyMap[t.month].count += 1;
          }

          if (!multiCategoryMonthlyMap[t.month]) multiCategoryMonthlyMap[t.month] = {};
          multiCategoryMonthlyMap[t.month][item.category] = (multiCategoryMonthlyMap[t.month][item.category] || 0) + converted;
        });
      });
    } else {
      // All expense transactions logic
      transactions.forEach(tx => {
        if (tx.type !== 'EXPENSE' || !tx.category || !tx.date) return;
        const month = tx.date.substring(0, 7);
        monthsSet.add(month);

        const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions, historyData);

        if (tx.category === selectedCategory) {
          if (!monthlyMap[month]) monthlyMap[month] = { amount: 0, count: 0 };
          monthlyMap[month].amount += converted;
          monthlyMap[month].count += 1;
        }

        if (!multiCategoryMonthlyMap[month]) multiCategoryMonthlyMap[month] = {};
        multiCategoryMonthlyMap[month][tx.category] = (multiCategoryMonthlyMap[month][tx.category] || 0) + converted;
      });
    }

    let sortedMonths = Array.from(monthsSet).sort();

    // Apply timeSpan filter
    if (timeSpan === '6M' && sortedMonths.length > 6) {
      sortedMonths = sortedMonths.slice(-6);
    } else if (timeSpan === '12M' && sortedMonths.length > 12) {
      sortedMonths = sortedMonths.slice(-12);
    }

    const data = sortedMonths.map(m => {
      const catData = monthlyMap[m] || { amount: 0, count: 0 };
      return {
        month: m,
        amount: Math.round(catData.amount),
        count: catData.count,
        fxRate: getHistoricalFxRate(m, usdArsRate, undefined, historyData),
      };
    });

    // Top categories for stacked chart (top 6 categories by total spend in these months)
    const categoryTotals: Record<string, number> = {};
    sortedMonths.forEach(m => {
      const monthData = multiCategoryMonthlyMap[m] || {};
      Object.entries(monthData).forEach(([cat, val]) => {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
      });
    });

    const topCats = Object.keys(categoryTotals)
      .sort((a, b) => categoryTotals[b] - categoryTotals[a])
      .slice(0, 6);

    const stacked = sortedMonths.map(m => {
      const row: any = { month: m };
      topCats.forEach(cat => {
        row[cat] = Math.round(multiCategoryMonthlyMap[m]?.[cat] || 0);
      });
      return row;
    });

    // Key statistics for selected category
    const amounts = data.map(d => d.amount);
    const nonZeroAmounts = amounts.filter(a => a > 0);
    const totalSpent = amounts.reduce((sum, a) => sum + a, 0);
    const avgMonthly = nonZeroAmounts.length > 0 ? totalSpent / nonZeroAmounts.length : 0;
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const peakMonth = data.find(d => d.amount === maxAmount)?.month || '-';
    const totalTxCount = data.reduce((sum, d) => sum + d.count, 0);

    return {
      chartData: data,
      topCategories: topCats,
      stackedChartData: stacked,
      categoryStats: {
        totalSpent,
        avgMonthly,
        maxAmount,
        peakMonth,
        totalTxCount,
      },
    };
  }, [viewScope, recurringItems, transactions, selectedCategory, timeSpan, displayCurrency, usdArsRate, historyData]);

  if (!isOpen) return null;

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  const hasRecurring = (categorySummaryMap.get(selectedCategory)?.recurringCount || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{t('budget.category_trends') || 'Tendencia por Categoría'}</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {allCategories.length} {t('budget.all_categories') || 'categorías'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visualiza y analiza la evolución del gasto mensual para cualquier categoría de tu presupuesto.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar: Category Picker, Scope Switcher, Time Window */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#111622] p-3 rounded-xl border border-slate-800">
          
          {/* Category Dropdown & Quick Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Categoría:</span>
            </div>

            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#161d2b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {allCategories.map(cat => {
                  const summary = categorySummaryMap.get(cat);
                  const hasSpend = summary && summary.totalSpent > 0;
                  return (
                    <option key={cat} value={cat} className="bg-[#161d2b] text-slate-100">
                      {cat} {hasSpend ? `(${formatCurrency(summary.totalSpent, displayCurrency)})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Scope Selector: All Spending vs Recurring Only */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#0d111a] p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  viewScope === 'all'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('budget.all_spending') || 'Todos los Gastos'}
              </button>
              <button
                type="button"
                onClick={() => setViewScope('recurring')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  viewScope === 'recurring'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={!hasRecurring ? 'Esta categoría no tiene gastos recurrentes detectados' : undefined}
              >
                {t('budget.recurring_only') || 'Solo Recurrentes'}
              </button>
            </div>

            {/* Time Span: 6M / 12M / ALL */}
            <div className="flex items-center bg-[#0d111a] p-0.5 rounded-lg border border-slate-800 text-xs">
              {(['6M', '12M', 'ALL'] as const).map(span => (
                <button
                  key={span}
                  type="button"
                  onClick={() => setTimeSpan(span)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    timeSpan === span
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {span}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Category KPIs Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#111622] border border-slate-800/90 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total ({timeSpan})
            </span>
            <span className="text-base font-black text-slate-100 mt-0.5 block font-mono">
              {formatCurrency(categoryStats.totalSpent, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {categoryStats.totalTxCount} transacciones
            </span>
          </div>

          <div className="p-3 bg-[#111622] border border-slate-800/90 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('budget.monthly_avg') || 'Promedio Mensual'}
            </span>
            <span className="text-base font-black text-emerald-400 mt-0.5 block font-mono">
              {formatCurrency(categoryStats.avgMonthly, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Por mes con actividad
            </span>
          </div>

          <div className="p-3 bg-[#111622] border border-slate-800/90 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Mes Pico / Máximo
            </span>
            <span className="text-base font-black text-amber-400 mt-0.5 block font-mono">
              {formatCurrency(categoryStats.maxAmount, displayCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
              {categoryStats.peakMonth}
            </span>
          </div>

          <div className="p-3 bg-[#111622] border border-slate-800/90 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Alcance
            </span>
            <span className="text-base font-black text-blue-400 mt-0.5 block">
              {viewScope === 'all' ? 'Todos los Gastos' : 'Solo Recurrentes'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {viewScope === 'recurring' && !hasRecurring ? '0 recurrentes en categoría' : `${chartData.length} meses registrados`}
            </span>
          </div>
        </div>

        {/* Chart 1: Selected Category Trend */}
        <div className="bg-[#121620] border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span>
                Evolución de <span className="text-emerald-400">{selectedCategory}</span> ({timeSpan})
              </span>
            </h4>
            {categoryStats.avgMonthly > 0 && (
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700">
                Promedio: {formatCurrency(categoryStats.avgMonthly, displayCurrency)}/mes
              </span>
            )}
          </div>

          {chartData.length === 0 || chartData.every(d => d.amount === 0) ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
              <Calendar className="w-8 h-8 text-slate-600" />
              <p>No se registraron gastos para <strong className="text-slate-400">{selectedCategory}</strong> en el período seleccionado.</p>
              {viewScope === 'recurring' && (
                <button
                  onClick={() => setViewScope('all')}
                  className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold hover:bg-emerald-500/30 transition-colors cursor-pointer mt-1"
                >
                  Ver todos los gastos de {selectedCategory}
                </button>
              )}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => formatCurrency(val, displayCurrency)} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-slate-200">{label}</p>
                            <p className="flex justify-between gap-4 text-emerald-400">
                              <span>{selectedCategory}:</span>
                              <span className="font-bold">{formatCurrency(data.amount, displayCurrency)}</span>
                            </p>
                            {data.count > 0 && (
                              <p className="flex justify-between gap-4 text-slate-400 text-[11px]">
                                <span>Transacciones:</span>
                                <span>{data.count}</span>
                              </p>
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
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={36}>
                    <LabelList
                      dataKey="amount"
                      position="top"
                      content={(props: any) => {
                        const { x, y, value, index } = props;
                        if (!value || (chartData.length > 8 && index % 2 !== 0)) return null;
                        return (
                          <text x={x} y={y} dy={-8} fill="#94a3b8" fontSize={10} textAnchor="middle">
                            {formatCurrency(Number(value) || 0, displayCurrency)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#10b981', stroke: '#0a0b0d', strokeWidth: 1 }}
                    activeDot={{ r: 5.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Top Categories Stacked Comparison */}
        {stackedChartData.length > 0 && topCategories.length > 0 && (
          <div className="bg-[#121620] border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Comparativa de Principales Categorías en el Tiempo</span>
              </h4>
              <span className="text-xs text-slate-400">Top {topCategories.length} categorías</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => formatCurrency(val, displayCurrency)} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const fxRate = getHistoricalFxRate(String(label), usdArsRate, undefined, historyData);
                        const totalInMonth = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
                        return (
                          <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 max-w-xs">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                              <span className="font-bold text-slate-200">{label}</span>
                              <span className="font-mono text-slate-300 font-semibold">{formatCurrency(totalInMonth, displayCurrency)}</span>
                            </div>
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                                <span>{entry.name}:</span>
                                <span className="font-bold font-mono">{formatCurrency(entry.value, displayCurrency)}</span>
                              </p>
                            ))}
                            <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                              FX Rate: 1 USD = {fxRate.toLocaleString()} ARS
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {topCategories.map((cat, idx) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={colors[idx % colors.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export const CategoryTrendModal = RecurringCategoryTrendModal;

