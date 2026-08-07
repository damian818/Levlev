import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, DisplayCurrency, TransactionFilter } from '../types';
import { formatCurrency, formatCurrencyCompact, convertCurrency, getCurrentMonthKey, getDefaultSelectedMonth } from '../utils/financeUtils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon, Calendar, ExternalLink } from 'lucide-react';

interface MonthlyCategoryDonutProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  selectedMonth?: string;
  onNavigateToTransactionsWithFilter: (filter: TransactionFilter) => void;
}

const CATEGORY_COLORS = [
  '#34d399', // Emerald
  '#60a5fa', // Blue
  '#f59e0b', // Amber
  '#a78bfa', // Purple
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#fb7185', // Pink
  '#818cf8', // Indigo
  '#2dd4bf', // Teal
  '#c084fc', // Violet
];

export function MonthlyCategoryDonut({
  transactions,
  displayCurrency,
  usdArsRate,
  selectedMonth: propMonth,
  onNavigateToTransactionsWithFilter,
}: MonthlyCategoryDonutProps) {
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Extract all unique expense months
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type === 'EXPENSE' && tx.date) {
        monthSet.add(tx.date.substring(0, 7));
      }
    });
    monthSet.add(currentMonthKey);
    return Array.from(monthSet).sort().reverse();
  }, [transactions, currentMonthKey]);

  // Selected month state (defaults to current/default month or prop)
  const [localMonth, setLocalMonth] = useState<string>(() => propMonth || getDefaultSelectedMonth(transactions));

  // Sync with prop if it changes
  useEffect(() => {
    if (propMonth) setLocalMonth(propMonth);
  }, [propMonth]);

  // Calculate category spending for the selected month
  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type !== 'EXPENSE') return;
      const txMonth = tx.date ? tx.date.substring(0, 7) : '';

      if (localMonth === 'ALL' || txMonth === localMonth) {
        const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
        const cat = tx.category || 'General';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + converted;
        totalExpense += converted;
      }
    });

    const items = Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalExpense > 0 ? (value / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return { items, totalExpense };
  }, [transactions, localMonth, displayCurrency, usdArsRate]);

  const monthLabel = localMonth === 'ALL' ? 'All Time' : localMonth;

  return (
    <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 sm:p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">Monthly Spending by Category</h3>
            <p className="text-[10px] sm:text-xs text-slate-400">Interactive category breakdown.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-[#121620] px-3 py-1.5 rounded-lg border border-slate-800 text-xs w-full sm:w-auto justify-center">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Month:</span>
          <select
            value={localMonth}
            onChange={(e) => setLocalMonth(e.target.value)}
            className="bg-transparent border-none py-0 text-xs text-slate-200 font-semibold focus:outline-none"
          >
            <option value="ALL">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Visualization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Recharts Donut Chart */}
        <div className="md:col-span-6 h-48 sm:h-64 relative flex items-center justify-center">
          {categoryData.items.length === 0 ? (
            <div className="text-center text-[10px] sm:text-xs text-slate-500">No expense records found.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.items}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry) =>
                      onNavigateToTransactionsWithFilter({
                        category: entry.name,
                        month: localMonth !== 'ALL' ? localMonth : undefined,
                      })
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    {categoryData.items.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        stroke="#161b22"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0, displayCurrency), 'Spent']}
                    contentStyle={{
                      backgroundColor: '#161b22',
                      color: '#f0f6fc',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Hole Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-slate-400 uppercase tracking-tighter sm:tracking-wider font-semibold">Total</span>
                <span className="text-xs sm:text-sm font-bold text-slate-100">
                  {formatCurrencyCompact(categoryData.totalExpense, displayCurrency)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Category Legend & Percentage List */}
        <div className="md:col-span-6 space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto pr-1">
          {categoryData.items.slice(0, 10).map((item, index) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div
                key={item.name}
                onClick={() =>
                  onNavigateToTransactionsWithFilter({
                    category: item.name,
                    month: localMonth !== 'ALL' ? localMonth : undefined,
                  })
                }
                className="p-2 rounded-lg bg-[#121620] hover:bg-slate-800/80 border border-slate-800 transition-all cursor-pointer flex items-center justify-between text-[10px] sm:text-xs group"
              >
                <div className="flex items-center space-x-2 truncate pr-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-slate-400 text-[9px] sm:text-[10px] font-mono">{item.percentage.toFixed(0)}%</span>
                  <span className="font-semibold text-slate-100">
                    {formatCurrencyCompact(item.value, displayCurrency)}
                  </span>
                </div>
              </div>
            );
          })}

          {categoryData.items.length > 7 && (
            <div className="text-[10px] text-slate-500 text-center pt-1">
              + {categoryData.items.length - 7} more smaller categories
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
