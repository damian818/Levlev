import React, { useState } from 'react';
import { IdentifiedRecurringItem, DisplayCurrency, Transaction, InflationPoint } from '../types';
import { formatCurrency, convertCurrency, getHistoricalFxRate } from '../utils/financeUtils';
import { X, Calendar, TrendingUp, TrendingDown, DollarSign, Repeat, ArrowUpRight, ArrowDownRight, Clock, Award, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList, BarChart } from 'recharts';

interface RecurringTrendModalProps {
  item: IdentifiedRecurringItem | null;
  isOpen: boolean;
  onClose: () => void;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  transactions: Transaction[];
  historyData?: InflationPoint[];
}

export function RecurringTrendModal({
  item,
  isOpen,
  onClose,
  displayCurrency,
  usdArsRate,
  transactions,
  historyData,
}: RecurringTrendModalProps) {
  if (!isOpen || !item) return null;

  const [useOriginalCurrency, setUseOriginalCurrency] = useState(false);

  // Compute metrics
  const isIncome = item.type === 'INCOME';
  const totalAmountNative = item.history.reduce((acc, h) => acc + h.amount, 0);

  // Prepare chart data
  const chartData = item.monthlyTrend.map(pt => {
    const historicalFx = getHistoricalFxRate(pt.month, usdArsRate, transactions, historyData);
    return {
      month: pt.month,
      amountNative: pt.amount,
      amountDisplay: pt.amountDisplay,
      currency: pt.currency,
      fxRate: historicalFx,
    };
  });

  const latestPt = chartData[chartData.length - 1];
  const firstPt = chartData[0];
  const percentChange = firstPt && latestPt && firstPt.amountNative > 0
    ? ((latestPt.amountNative - firstPt.amountNative) / firstPt.amountNative) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl border ${
              isIncome 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100">{item.title}</h3>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                  isIncome 
                    ? 'bg-emerald-950/80 border-emerald-800/50 text-emerald-300' 
                    : 'bg-rose-950/80 border-rose-800/50 text-rose-300'
                }`}>
                  {item.type}
                </span>
                {item.isInstallment && (
                  <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 text-[10px] font-bold rounded flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Cuotas ({item.installmentInfo || 'Plan'})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Category: <strong className="text-slate-300">{item.category}</strong></span>
                <span>•</span>
                <span>Account: <strong className="text-slate-300">{item.account}</strong></span>
                <span>•</span>
                <span>Day ~{item.dayOfMonth} of month</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Latest Amount</span>
            <div className="text-sm font-bold text-slate-100">
              {formatCurrency(
                convertCurrency(item.latestAmount, item.currency as DisplayCurrency, displayCurrency, usdArsRate, item.history[item.history.length-1]?.date, transactions, historyData),
                displayCurrency
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {item.currency} {item.latestAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Monthly Average</span>
            <div className="text-sm font-bold text-slate-100">
              {formatCurrency(
                convertCurrency(item.avgAmount, item.currency as DisplayCurrency, displayCurrency, usdArsRate, item.history[item.history.length-1]?.date, transactions, historyData),
                displayCurrency
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {item.currency} {Math.round(item.avgAmount).toLocaleString()}
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Total Lifetime</span>
            <div className="text-sm font-bold text-slate-100">
              {formatCurrency(
                convertCurrency(totalAmountNative, item.currency as DisplayCurrency, displayCurrency, usdArsRate, item.history[item.history.length-1]?.date, transactions, historyData),
                displayCurrency
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {item.distinctMonthsCount} active months
            </div>
          </div>

          <div className="bg-[#121620] p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Trend Shift</span>
            <div className={`text-sm font-bold flex items-center space-x-1 ${
              percentChange === 0 ? 'text-slate-400' : percentChange > 0 ? (isIncome ? 'text-emerald-400' : 'text-rose-400') : (isIncome ? 'text-rose-400' : 'text-emerald-400')
            }`}>
              {percentChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : percentChange < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
              <span>{Math.abs(percentChange).toFixed(1)}%</span>
            </div>
            <div className="text-[10px] text-slate-500">
              {percentChange > 0 ? 'Increase over time' : percentChange < 0 ? 'Decrease over time' : 'Stable amount'}
            </div>
          </div>
        </div>

        {/* Trend History Chart */}
        <div className="bg-[#121620] p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Historical Monthly Trend</span>
              </h4>
              <p className="text-[11px] text-slate-400">Monthly evolution across recorded transaction history.</p>
            </div>

            <button
              onClick={() => setUseOriginalCurrency(!useOriginalCurrency)}
              className="px-2.5 py-1 bg-[#161b22] hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
            >
              Showing in: <strong className="text-emerald-400">{useOriginalCurrency ? item.currency : displayCurrency}</strong>
            </button>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const val = useOriginalCurrency ? data.amountNative : data.amountDisplay;
                      const curr = useOriginalCurrency ? data.currency : displayCurrency;
                      return (
                        <div className="bg-[#0f131a] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <p className="font-bold text-slate-200">{label}</p>
                          <p className={`font-semibold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.title}: {formatCurrency(val, curr)}
                          </p>
                          {data.currency !== displayCurrency && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Conversion Rate: 1 {data.currency} = {data.fxRate.toLocaleString()} {displayCurrency}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={useOriginalCurrency ? "amountNative" : "amountDisplay"}
                  fill={isIncome ? "#10b981" : "#f43f5e"}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  <LabelList
                    dataKey={useOriginalCurrency ? "amountNative" : "amountDisplay"}
                    position="top"
                    content={(props: any) => {
                      const { x, y, value, index } = props;
                      if (chartData.length > 10 && index % 2 !== 0) return null;
                      return (
                        <text x={x} y={y} dy={-10} fill="#94a3b8" fontSize={9} textAnchor="middle">
                          {formatCurrency(Number(value) || 0, (useOriginalCurrency ? item.currency : displayCurrency) as DisplayCurrency)}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Line
                  type="monotone"
                  dataKey={useOriginalCurrency ? "amountNative" : "amountDisplay"}
                  stroke="#e2e8f0"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#e2e8f0', stroke: '#0a0b0d', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                {chartData.length > 0 && (
                  <text
                    x="50%"
                    y={20}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={11}
                    fontWeight="bold"
                  >
                    Average: {formatCurrency(
                      useOriginalCurrency ? item.avgAmount : convertCurrency(item.avgAmount, item.currency as DisplayCurrency, displayCurrency, usdArsRate, undefined, undefined, historyData),
                      (useOriginalCurrency ? item.currency : displayCurrency) as DisplayCurrency
                    )}
                  </text>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occurrences Log Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-200 flex items-center justify-between">
            <span>Recorded Occurrences ({item.history.length})</span>
            <span className="text-slate-400 font-normal">Chronological History</span>
          </h4>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#121620] max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161b22] text-slate-400 sticky top-0 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Account</th>
                  <th className="p-2.5">Notes / Cuota</th>
                  <th className="p-2.5 text-right">Original Amt</th>
                  <th className="p-2.5 text-right">Converted ({displayCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {item.history.map((h) => {
                  const converted = convertCurrency(h.amount, h.currency as DisplayCurrency, displayCurrency, usdArsRate, h.date, transactions, historyData);
                  return (
                    <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 font-mono text-slate-400">{h.date ? h.date.substring(0, 10) : 'N/A'}</td>
                      <td className="p-2.5 text-slate-300">{h.account}</td>
                      <td className="p-2.5">
                        {h.installments ? (
                          <span className="px-1.5 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 font-mono text-[10px] rounded">
                            {h.installments}
                          </span>
                        ) : (
                          <span className="text-slate-500">{h.description || '-'}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-400">
                        {h.currency} {h.amount.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-100 font-mono">
                        {formatCurrency(converted, displayCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
