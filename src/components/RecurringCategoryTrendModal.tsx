import React, { useState } from 'react';
import { IdentifiedRecurringItem, DisplayCurrency, InflationPoint } from '../types';
import { convertCurrency, formatCurrency, getHistoricalFxRate } from '../utils/financeUtils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList, BarChart } from 'recharts';
import { TrendingUp, X, Filter, Layers, BarChart2 } from 'lucide-react';

interface RecurringCategoryTrendModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringItems: IdentifiedRecurringItem[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  historyData?: InflationPoint[];
}

export function RecurringCategoryTrendModal({
  isOpen,
  onClose,
  recurringItems,
  displayCurrency,
  usdArsRate,
  historyData,
}: RecurringCategoryTrendModalProps) {
  if (!isOpen) return null;

  // Extract all categories (EXPENSES only for spending trend)
  const categoriesSet = new Set<string>();
  recurringItems.forEach(item => {
    if (item.type === 'EXPENSE' && item.category) {
      categoriesSet.add(item.category);
    }
  });

  const allCategories = Array.from(categoriesSet).sort();
  const [selectedCategory, setSelectedCategory] = useState<string>(allCategories[0] || 'Hogar');

  // Build monthly trend
  const monthlyMap: Record<string, number> = {};
  const multiCategoryMonthlyMap: Record<string, Record<string, number>> = {};
  const monthsSet = new Set<string>();

  recurringItems.forEach(item => {
    if (item.type !== 'EXPENSE') return;

    item.monthlyTrend.forEach(t => {
        monthsSet.add(t.month);
        const converted = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.month, [], historyData);
        
        // Single category trend
        if (item.category === selectedCategory) {
            monthlyMap[t.month] = (monthlyMap[t.month] || 0) + converted;
        }

        // Multi category trend
        if (!multiCategoryMonthlyMap[t.month]) {
            multiCategoryMonthlyMap[t.month] = {};
        }
        multiCategoryMonthlyMap[t.month][item.category] = (multiCategoryMonthlyMap[t.month][item.category] || 0) + converted;
    });
  });

  const sortedMonths = Array.from(monthsSet).sort();

  const chartData = sortedMonths.map(m => ({
    month: m,
    amount: monthlyMap[m] || 0,
    fxRate: getHistoricalFxRate(m, usdArsRate, undefined, historyData),
  }));

  const topCategories = allCategories.slice(0, 6);

  const stackedChartData = sortedMonths.map(m => {
    const row: any = { month: m };
    topCategories.forEach(cat => {
      row[cat] = multiCategoryMonthlyMap[m]?.[cat] || 0;
    });
    return row;
  });

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Recurring Trend View by Category</h3>
              <p className="text-xs text-slate-400">Analyze how your recurring spending evolves across months for specific categories.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-[#121620] p-3 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>Select Category:</span>
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#161b22] border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Chart 1: Selected Category Trend */}
        <div className="bg-[#121620] border border-slate-800 p-5 rounded-2xl space-y-3">
          <h4 className="text-sm font-bold text-slate-200">
            Monthly Trend for <span className="text-emerald-400">{selectedCategory}</span>
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
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
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40}>
                  <LabelList
                    dataKey="amount"
                    position="top"
                    content={(props: any) => {
                      const { x, y, value, index } = props;
                      if (chartData.length > 8 && index % 2 !== 0) return null;
                      return (
                        <text x={x} y={y} dy={-10} fill="#94a3b8" fontSize={10} textAnchor="middle">
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
                  dot={{ r: 4, fill: '#10b981', stroke: '#0a0b0d', strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                {chartData.length > 0 && (
                  <text
                    x="50%"
                    y={20}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={12}
                    fontWeight="bold"
                  >
                    Avg: {formatCurrency(chartData.reduce((acc, curr) => acc + curr.amount, 0) / chartData.length, displayCurrency)}
                  </text>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Top Categories Stacked Comparison */}
        <div className="bg-[#121620] border border-slate-800 p-5 rounded-2xl space-y-3">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Top Categories Stacked Comparison Over Time</span>
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => formatCurrency(val, displayCurrency)} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const fxRate = getHistoricalFxRate(String(label), usdArsRate, undefined, historyData);
                      return (
                        <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
                          <p className="font-bold text-slate-200">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                              <span>{entry.name}:</span>
                              <span className="font-bold">{formatCurrency(entry.value, displayCurrency)}</span>
                            </p>
                          ))}
                          <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
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

      </div>
    </div>
  );
}
