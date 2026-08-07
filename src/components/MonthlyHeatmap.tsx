import React, { useState } from 'react';
import { Transaction, DisplayCurrency } from '../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact } from '../utils/financeUtils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MonthlyHeatmapProps {
  transactions: Transaction[];
  selectedMonth: string; // e.g. "2026-08" or "ALL"
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

export function MonthlyHeatmap({
  transactions,
  selectedMonth,
  displayCurrency,
  usdArsRate,
}: MonthlyHeatmapProps) {
  const activeMonth = selectedMonth === 'ALL' ? new Date().toISOString().substring(0, 7) : selectedMonth;
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '8', 10) - 1; // 0-indexed

  const [selectedDayTxs, setSelectedDayTxs] = useState<{ day: number; txs: Transaction[]; total: number } | null>(null);

  // Compute daily expenses for the active month
  const dailyMap: Record<number, { total: number; txs: Transaction[] }> = {};
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...

  transactions.forEach(tx => {
    if (!tx.date || !tx.date.startsWith(activeMonth)) return;
    if (tx.type !== 'EXPENSE') return;

    const dayNum = parseInt(tx.date.substring(8, 10), 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > daysInMonth) return;

    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    if (!dailyMap[dayNum]) {
      dailyMap[dayNum] = { total: 0, txs: [] };
    }
    dailyMap[dayNum].total += converted;
    dailyMap[dayNum].txs.push(tx);
  });

  // Find max daily spend for color scaling
  let maxDaily = 1;
  Object.values(dailyMap).forEach(d => {
    if (d.total > maxDaily) maxDaily = d.total;
  });

  const getIntensityColor = (total: number) => {
    if (total === 0) return 'bg-[#121620] text-slate-500 border-slate-800/60';
    const ratio = total / maxDaily;
    if (ratio > 0.75) return 'bg-rose-950/80 text-rose-200 border-rose-800/60 shadow-xs shadow-rose-900/50';
    if (ratio > 0.4) return 'bg-amber-950/70 text-amber-200 border-amber-800/50';
    if (ratio > 0.15) return 'bg-emerald-950/60 text-emerald-200 border-emerald-800/40';
    return 'bg-[#1a2234] text-slate-300 border-slate-700/60';
  };

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const weekDaysFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[#161b22] border border-slate-800/80 rounded-2xl p-3 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 sm:p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 h-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-100">Daily Spending Intensity ({activeMonth})</h3>
        </div>
        <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
          Peak: {formatCurrencyCompact(maxDaily, displayCurrency)}
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
        {weekDays.map((d, i) => (
          <div key={i} className="text-[9px] sm:text-[10px] font-semibold text-slate-500 py-1 uppercase tracking-tighter sm:tracking-normal">
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{weekDaysFull[i]}</span>
          </div>
        ))}

        {/* Blank padding for first day offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 sm:h-14 lg:h-16 bg-transparent rounded-lg" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dayData = dailyMap[dayNum];
          const total = dayData ? dayData.total : 0;
          const styleClass = getIntensityColor(total);

          return (
            <div
              key={`day-${dayNum}`}
              onClick={() => dayData && setSelectedDayTxs({ day: dayNum, txs: dayData.txs, total: dayData.total })}
              className={`h-10 sm:h-14 lg:h-16 rounded-lg sm:rounded-xl border p-1 sm:p-1.5 flex flex-col justify-between transition-all ${styleClass} ${
                dayData ? 'cursor-pointer hover:bg-opacity-80 active:scale-95' : 'cursor-default'
              }`}
            >
              <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold">
                <span>{dayNum}</span>
                {total > 0 && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <div className="text-[8px] sm:text-[10px] font-mono truncate tracking-tighter leading-none">
                {total > 0 ? formatCurrencyCompact(total, displayCurrency) : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#121620] border border-slate-800" />
          <span className="text-[9px] text-slate-500">None</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-950/60 border border-emerald-800/40" />
          <span className="text-[9px] text-slate-500">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-950/70 border border-amber-800/50" />
          <span className="text-[9px] text-slate-500">Med</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-950/80 border border-rose-800/60" />
          <span className="text-[9px] text-slate-500">High</span>
        </div>
      </div>

      {/* Day details modal / popover */}
      {selectedDayTxs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Transactions on {activeMonth}-{String(selectedDayTxs.day).padStart(2, '0')}
                </h4>
                <p className="text-xs text-slate-400">
                  Total Spent: <strong className="text-rose-400">{formatCurrency(selectedDayTxs.total, displayCurrency)}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTxs(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {selectedDayTxs.txs.map(tx => {
                const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
                return (
                  <div key={tx.id} className="flex items-center justify-between bg-[#121620] p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{tx.title || tx.category || 'Expense'}</p>
                      <p className="text-[10px] text-slate-400">{tx.category} • {tx.account}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-rose-400">-{formatCurrency(converted, displayCurrency)}</p>
                      {tx.currency !== displayCurrency && (
                        <p className="text-[9px] text-slate-500 font-mono">{tx.currency} {tx.amount.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
