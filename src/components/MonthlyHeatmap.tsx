import React, { useState } from 'react';
import { Transaction, DisplayCurrency, RecurringRule } from '../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact } from '../utils/financeUtils';
import { Calendar as CalendarIcon, X, Zap, ArrowDownRight, ArrowUpRight, Repeat } from 'lucide-react';
interface MonthlyHeatmapProps {
  transactions: Transaction[];
  selectedMonth: string; // e.g. "2026-08" or "ALL"
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  recurringRules?: RecurringRule[];
}

export function MonthlyHeatmap({
  transactions,
  selectedMonth,
  displayCurrency,
  usdArsRate,
  recurringRules = [],
}: MonthlyHeatmapProps) {
  const activeMonth = selectedMonth === 'ALL' ? new Date().toISOString().substring(0, 7) : selectedMonth;
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '8', 10) - 1; // 0-indexed

  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    day: number;
    txs: Transaction[];
    totalActualSpent: number;
    recurringRulesForDay: RecurringRule[];
  } | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...

  // Compute actual daily expenses for the active month
  const dailyMap: Record<number, { totalSpent: number; txs: Transaction[] }> = {};

  transactions.forEach(tx => {
    if (!tx.date || !tx.date.startsWith(activeMonth)) return;
    if (tx.type !== 'EXPENSE') return;

    const dayNum = parseInt(tx.date.substring(8, 10), 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > daysInMonth) return;

    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    if (!dailyMap[dayNum]) {
      dailyMap[dayNum] = { totalSpent: 0, txs: [] };
    }
    dailyMap[dayNum].totalSpent += converted;
    dailyMap[dayNum].txs.push(tx);
  });

  // Map expected recurring rules by day of month
  const dailyRecurringMap: Record<number, RecurringRule[]> = {};
  const activeRulesList = recurringRules || [];

  activeRulesList.forEach(rule => {
    const day = rule.dayOfMonth || 15;
    if (day >= 1 && day <= daysInMonth) {
      if (!dailyRecurringMap[day]) {
        dailyRecurringMap[day] = [];
      }
      dailyRecurringMap[day].push(rule);
    }
  });

  // Find max daily spend for color scaling
  let maxDaily = 1;
  Object.values(dailyMap).forEach(d => {
    if (d.totalSpent > maxDaily) maxDaily = d.totalSpent;
  });

  const getIntensityColor = (total: number, hasRecurring: boolean) => {
    if (total === 0) {
      return hasRecurring 
        ? 'bg-[#131b2e] text-slate-300 border-amber-500/30 hover:border-amber-500/60' 
        : 'bg-[#121620] text-slate-500 border-slate-800/60';
    }
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
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">Daily Spending & Scheduled Bills ({activeMonth})</h3>
            <p className="text-[11px] text-slate-400">Includes actual daily expenses + expected recurring bills/income.</p>
          </div>
        </div>
        <span className="text-[10px] sm:text-xs text-slate-400 font-mono self-start sm:self-auto">
          Peak Spent: <strong className="text-slate-200">{formatCurrencyCompact(maxDaily, displayCurrency)}</strong>
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
          <div key={`empty-${i}`} className="h-12 sm:h-16 lg:h-20 bg-transparent rounded-lg" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dayData = dailyMap[dayNum];
          const totalSpent = dayData ? dayData.totalSpent : 0;
          const recurringForDay = dailyRecurringMap[dayNum] || [];
          const hasRecurring = recurringForDay.length > 0;
          const styleClass = getIntensityColor(totalSpent, hasRecurring);

          const isInteractive = totalSpent > 0 || hasRecurring;

          return (
            <div
              key={`day-${dayNum}`}
              onClick={() => {
                if (isInteractive) {
                  setSelectedDayDetails({
                    day: dayNum,
                    txs: dayData ? dayData.txs : [],
                    totalActualSpent: totalSpent,
                    recurringRulesForDay: recurringForDay,
                  });
                }
              }}
              title={`Day ${dayNum}: ${totalSpent > 0 ? formatCurrency(totalSpent, displayCurrency) : 'No logged expenses'}${
                hasRecurring ? ` • ${recurringForDay.length} expected recurring rule(s)` : ''
              }`}
              className={`h-12 sm:h-16 lg:h-20 rounded-lg sm:rounded-xl border p-1 sm:p-1.5 flex flex-col justify-between transition-all ${styleClass} ${
                isInteractive ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : 'cursor-default opacity-80'
              }`}
            >
              <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold">
                <span>{dayNum}</span>
                <div className="flex items-center gap-0.5">
                  {hasRecurring && (
                    <span 
                      className="px-1 py-0.2 text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded flex items-center gap-0.5"
                      title={`${recurringForDay.length} scheduled recurring item(s)`}
                    >
                      <Repeat className="w-2.5 h-2.5 shrink-0" />
                      <span className="hidden sm:inline">{recurringForDay.length}</span>
                    </span>
                  )}
                  {totalSpent > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                </div>
              </div>

              <div className="space-y-0.5 text-left">
                {totalSpent > 0 ? (
                  <div className="text-[9px] sm:text-[10px] font-mono font-bold text-rose-300 truncate leading-tight">
                    -{formatCurrencyCompact(totalSpent, displayCurrency)}
                  </div>
                ) : (
                  <div className="text-[8px] text-slate-600 font-mono">–</div>
                )}

                {hasRecurring && totalSpent === 0 && (
                  <div className="text-[8px] font-mono text-amber-300/90 truncate leading-none">
                    {recurringForDay.map(r => r.type === 'INCOME' ? `+${formatCurrencyCompact(r.amount, r.currency as DisplayCurrency)}` : `-${formatCurrencyCompact(r.amount, r.currency as DisplayCurrency)}`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60 text-[10px] text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-[#121620] border border-slate-800" />
            <span>None</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-emerald-950/60 border border-emerald-800/40" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-amber-950/70 border border-amber-800/50" />
            <span>Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-rose-950/80 border border-rose-800/60" />
            <span>High</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-amber-400 font-medium">
          <Repeat className="w-3 h-3" />
          <span>Badge indicates scheduled recurring rule due date</span>
        </div>
      </div>

      {/* Day details modal / popover */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Day {selectedDayDetails.day} ({activeMonth})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actual Expenses: <strong className="text-rose-400">{formatCurrency(selectedDayDetails.totalActualSpent, displayCurrency)}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedDayDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expected Recurring Rules Section */}
            {selectedDayDetails.recurringRulesForDay.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Expected Recurring Rules on Day {selectedDayDetails.day}</span>
                </h5>
                <div className="space-y-2">
                  {selectedDayDetails.recurringRulesForDay.map(rule => {
                    const ruleConverted = convertCurrency(rule.amount, rule.currency, displayCurrency, usdArsRate);
                    return (
                      <div key={rule.id} className="flex items-center justify-between bg-amber-950/20 p-3 rounded-xl border border-amber-500/30">
                        <div>
                          <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span>{rule.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                              {rule.type}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400">{rule.category} • {rule.account}</p>
                        </div>
                        <div className="text-right font-mono font-bold text-xs">
                          <p className={rule.type === 'INCOME' ? 'text-emerald-400' : 'text-amber-300'}>
                            {rule.type === 'INCOME' ? '+' : '-'}{formatCurrency(ruleConverted, displayCurrency)}
                          </p>
                          <p className="text-[9px] text-slate-500">{formatCurrency(rule.amount, rule.currency as DisplayCurrency)} native</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Logged Transactions Section */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Logged Transactions ({selectedDayDetails.txs.length})
              </h5>
              {selectedDayDetails.txs.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-[#121620] rounded-xl border border-slate-800">
                  No actual transactions logged for this day yet.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedDayDetails.txs.map(tx => {
                    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
                    return (
                      <div key={tx.id} className="flex items-center justify-between bg-[#121620] p-3 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{tx.title || tx.category || 'Expense'}</p>
                          <p className="text-[10px] text-slate-400">{tx.category} • {tx.account}</p>
                        </div>
                        <div className="text-right font-mono">
                          <p className="text-xs font-bold text-rose-400">-{formatCurrency(converted, displayCurrency)}</p>
                          {tx.currency !== displayCurrency && (
                            <p className="text-[9px] text-slate-500">{formatCurrency(tx.amount, tx.currency as DisplayCurrency)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
