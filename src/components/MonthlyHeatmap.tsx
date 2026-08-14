import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, RecurringRule, PendingRecurringItem } from '../types';
import { 
  convertCurrency, 
  formatCurrency, 
  formatCurrencyCompact, 
  getPendingRecurringForMonth 
} from '../utils/financeUtils';
import { 
  Calendar as CalendarIcon, 
  X, 
  Zap, 
  ArrowDownRight, 
  ArrowUpRight, 
  Repeat, 
  CheckCircle2, 
  PlusCircle, 
  Layers,
  Sparkles
} from 'lucide-react';

interface MonthlyHeatmapProps {
  transactions: Transaction[];
  selectedMonth: string; // e.g. "2026-08" or "ALL"
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  recurringRules?: RecurringRule[];
  nonRecurringKeys?: string[];
  onAddTransaction?: (tx: Transaction) => void;
}

export function MonthlyHeatmap({
  transactions,
  selectedMonth,
  displayCurrency,
  usdArsRate,
  recurringRules = [],
  nonRecurringKeys = [],
  onAddTransaction,
}: MonthlyHeatmapProps) {
  const { t } = useTranslation();
  const activeMonth = selectedMonth === 'ALL' ? new Date().toISOString().substring(0, 7) : selectedMonth;
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '8', 10) - 1; // 0-indexed

  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    day: number;
    txs: Transaction[];
    totalActualSpent: number;
    totalActualIncome: number;
    pendingRecurringForDay: PendingRecurringItem[];
    totalPendingExpense: number;
    totalPendingIncome: number;
  } | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...

  // Compute actual daily transactions for the active month
  const dailyMap: Record<number, { totalSpent: number; totalIncome: number; txs: Transaction[] }> = {};

  transactions.forEach(tx => {
    if (!tx.date || !tx.date.startsWith(activeMonth)) return;
    if (tx.type === 'TRANSFER') return;

    const dayNum = parseInt(tx.date.substring(8, 10), 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > daysInMonth) return;

    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    if (!dailyMap[dayNum]) {
      dailyMap[dayNum] = { totalSpent: 0, totalIncome: 0, txs: [] };
    }
    
    if (tx.type === 'EXPENSE') {
      dailyMap[dayNum].totalSpent += converted;
    } else if (tx.type === 'INCOME') {
      dailyMap[dayNum].totalIncome += converted;
    }
    dailyMap[dayNum].txs.push(tx);
  });

  // Calculate comprehensive pending recurring items for the active month (auto-detected, manual rules, and cuotas)
  const monthPendingResult = getPendingRecurringForMonth(
    activeMonth,
    transactions,
    recurringRules,
    nonRecurringKeys,
    displayCurrency,
    usdArsRate
  );

  const dailyPendingMap = monthPendingResult.dailyPendingMap;

  // Find max daily spend for color scaling
  let maxDaily = 1;
  Object.values(dailyMap).forEach(d => {
    if (d.totalSpent > maxDaily) maxDaily = d.totalSpent;
  });

  const getIntensityColor = (totalSpent: number, pendingCount: number) => {
    if (totalSpent === 0) {
      return pendingCount > 0 
        ? 'bg-amber-950/20 dark:bg-amber-950/30 text-slate-800 dark:text-slate-200 border-amber-500/40 hover:border-amber-500/80' 
        : 'bg-slate-50 dark:bg-[#121620] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/60';
    }
    const ratio = totalSpent / maxDaily;
    if (ratio > 0.75) return 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-400 dark:border-rose-800/60 shadow-xs shadow-rose-900/50';
    if (ratio > 0.4) return 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-800/50';
    if (ratio > 0.15) return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-400 dark:border-emerald-800/40';
    return 'bg-slate-100 dark:bg-[#1a2234] text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700/60';
  };

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const weekDaysFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleQuickLogPending = (item: PendingRecurringItem, day: number) => {
    if (!onAddTransaction) return;
    const dateStr = `${activeMonth}-${String(day).padStart(2, '0')}`;
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: item.title,
      amount: item.amount,
      currency: item.currency,
      type: item.type,
      category: item.category || 'General',
      account: item.account || 'BBVA',
      date: dateStr,
      description: item.isInstallment ? `Cuota: ${item.installmentInfo || ''}` : 'Logged from Recurring Estimate',
    };
    onAddTransaction(newTx);
    setSelectedDayDetails(null);
  };

  return (
    <div id="monthly-heatmap-calendar" className="bg-white dark:bg-[#11141c] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-emerald-500/10 rounded-xl text-indigo-600 dark:text-emerald-400 border border-indigo-100 dark:border-emerald-500/20">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{t('overview.calendar_title') || 'Daily Spending & Estimated Recurring'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-medium">
                {activeMonth}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('overview.calendar_subtitle') || 'Includes actual logged transactions + all estimated pending recurring bills & incomes.'}
            </p>
          </div>
        </div>
        
        {/* Header KPI summary */}
        <div className="flex items-center gap-3 self-start sm:self-auto text-xs font-mono">
          {monthPendingResult.pendingExpense > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <Repeat className="w-3.5 h-3.5" />
              <span>Pending Bills: <strong>-{formatCurrencyCompact(monthPendingResult.pendingExpense, displayCurrency)}</strong></span>
            </div>
          )}
          {monthPendingResult.pendingIncome > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pending Inflow: <strong>+{formatCurrencyCompact(monthPendingResult.pendingIncome, displayCurrency)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 xs:gap-1.5 sm:gap-2 text-center">
        {weekDays.map((d, i) => (
          <div key={i} className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 py-1 sm:py-1.5 uppercase tracking-wider bg-slate-100 dark:bg-[#121620] rounded-md">
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{weekDaysFull[i]}</span>
          </div>
        ))}

        {/* Blank padding for first day offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[52px] xs:min-h-[60px] sm:min-h-[80px] lg:min-h-[92px] bg-transparent rounded-lg" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dayData = dailyMap[dayNum];
          const totalSpent = dayData ? dayData.totalSpent : 0;
          const totalIncome = dayData ? dayData.totalIncome : 0;
          const pendingForDay = dailyPendingMap[dayNum] || [];
          const hasPending = pendingForDay.length > 0;
          const styleClass = getIntensityColor(totalSpent, pendingForDay.length);

          const isInteractive = totalSpent > 0 || totalIncome > 0 || hasPending;

          const pendingExpenses = pendingForDay.filter(p => p.type === 'EXPENSE');
          const pendingIncomes = pendingForDay.filter(p => p.type === 'INCOME');
          const dayPendingExpTotal = pendingExpenses.reduce((s, p) => s + p.convertedAmount, 0);
          const dayPendingIncTotal = pendingIncomes.reduce((s, p) => s + p.convertedAmount, 0);

          return (
            <div
              key={`day-${dayNum}`}
              id={`calendar-day-${dayNum}`}
              onClick={() => {
                if (isInteractive) {
                  setSelectedDayDetails({
                    day: dayNum,
                    txs: dayData ? dayData.txs : [],
                    totalActualSpent: totalSpent,
                    totalActualIncome: totalIncome,
                    pendingRecurringForDay: pendingForDay,
                    totalPendingExpense: dayPendingExpTotal,
                    totalPendingIncome: dayPendingIncTotal,
                  });
                }
              }}
              title={`Day ${dayNum}: ${totalSpent > 0 ? `Spent ${formatCurrency(totalSpent, displayCurrency)}` : 'No logged expenses'}${
                hasPending ? ` • ${pendingForDay.length} estimated pending recurring item(s)` : ''
              }`}
              className={`min-h-[52px] xs:min-h-[60px] sm:min-h-[80px] lg:min-h-[92px] rounded-lg sm:rounded-xl border p-1 sm:p-2 flex flex-col justify-between transition-all ${styleClass} ${
                isInteractive ? 'cursor-pointer hover:scale-[1.02] active:scale-95 hover:z-10 shadow-sm' : 'cursor-default opacity-80'
              }`}
            >
              <div className="flex justify-between items-center gap-0.5">
                <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 bg-black/5 dark:bg-black/40 px-1 sm:px-1.5 py-0.5 rounded shrink-0">
                  {dayNum}
                </span>
                <div className="flex items-center gap-1">
                  {hasPending && (
                    <span 
                      className="px-1 py-0.5 text-[8px] xs:text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded flex items-center gap-0.5 shrink-0"
                      title={`${pendingForDay.length} pending estimated recurring item(s)`}
                    >
                      <Repeat className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                      <span>{pendingForDay.length}</span>
                    </span>
                  )}
                  {totalSpent > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0" />}
                  {totalIncome > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shrink-0" />}
                </div>
              </div>

              {/* Day values & badges */}
              <div className="space-y-0.5 text-left mt-0.5 overflow-hidden">
                {totalSpent > 0 ? (
                  <div className="text-[8px] xs:text-[9px] sm:text-xs font-mono font-extrabold text-rose-600 dark:text-rose-300 truncate leading-snug">
                    -{formatCurrencyCompact(totalSpent, displayCurrency)}
                  </div>
                ) : null}

                {totalIncome > 0 && totalSpent === 0 ? (
                  <div className="text-[8px] xs:text-[9px] sm:text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-300 truncate leading-snug">
                    +{formatCurrencyCompact(totalIncome, displayCurrency)}
                  </div>
                ) : null}

                {/* Estimated pending recurring line */}
                {hasPending && (
                  <div className="text-[8px] xs:text-[9px] font-mono text-amber-700 dark:text-amber-300 font-semibold truncate leading-none flex items-center gap-0.5">
                    <span className="text-amber-500 text-[9px]">⚡</span>
                    <span className="truncate">
                      {dayPendingIncTotal > 0 && `+${formatCurrencyCompact(dayPendingIncTotal, displayCurrency)} `}
                      {dayPendingExpTotal > 0 && `-${formatCurrencyCompact(dayPendingExpTotal, displayCurrency)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-slate-100 dark:bg-[#121620] border border-slate-300 dark:border-slate-800" />
            <span>None</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800/40" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-amber-100 dark:bg-amber-950/70 border border-amber-400 dark:border-amber-800/50" />
            <span>Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-rose-100 dark:bg-rose-950/80 border border-rose-400 dark:border-rose-800/60" />
            <span>High</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-[10px] sm:text-xs">
          <Repeat className="w-3 h-3 shrink-0" />
          <span>⚡ Badge indicates estimated pending recurring bills & income</span>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayDetails && (
        <div id="day-details-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-[#11141c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Day {selectedDayDetails.day} ({activeMonth})</span>
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {selectedDayDetails.totalActualSpent > 0 && (
                    <span>Actual Spent: <strong className="text-rose-600 dark:text-rose-400">-{formatCurrency(selectedDayDetails.totalActualSpent, displayCurrency)}</strong></span>
                  )}
                  {selectedDayDetails.totalActualIncome > 0 && (
                    <span>Actual Inflow: <strong className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(selectedDayDetails.totalActualIncome, displayCurrency)}</strong></span>
                  )}
                </div>
              </div>
              <button
                id="close-day-details-btn"
                onClick={() => setSelectedDayDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Estimated Pending Recurring Section */}
            {selectedDayDetails.pendingRecurringForDay.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Estimated Pending Recurring ({selectedDayDetails.pendingRecurringForDay.length})</span>
                  </h5>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Not yet logged</span>
                </div>

                <div className="space-y-2">
                  {selectedDayDetails.pendingRecurringForDay.map(item => {
                    const isIncome = item.type === 'INCOME';
                    return (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-500/30 gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                              {item.title}
                            </span>
                            {item.isManualRule && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Manual Rule
                              </span>
                            )}
                            {item.isInstallment && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {item.installmentInfo || 'Cuotas'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.category} • {item.account}
                          </p>
                        </div>

                        <div className="text-right font-mono shrink-0 flex items-center gap-2">
                          <div>
                            <p className={`text-xs font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(item.convertedAmount, displayCurrency)}
                            </p>
                            {item.currency !== displayCurrency && (
                              <p className="text-[9px] text-slate-400">
                                {formatCurrency(item.amount, item.currency as DisplayCurrency)}
                              </p>
                            )}
                          </div>

                          {/* Quick Log button */}
                          {onAddTransaction && (
                            <button
                              type="button"
                              onClick={() => handleQuickLogPending(item, selectedDayDetails.day)}
                              title="Log as actual transaction"
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition-colors shadow-xs"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Logged Transactions Section */}
            <div className="space-y-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Actual Logged Transactions ({selectedDayDetails.txs.length})</span>
              </h5>
              
              {selectedDayDetails.txs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 bg-slate-50 dark:bg-[#121620] rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  No actual transactions logged for this day.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedDayDetails.txs.map(tx => {
                    const isIncome = tx.type === 'INCOME';
                    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
                    return (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between bg-slate-50 dark:bg-[#121620] p-3 rounded-xl border border-slate-200 dark:border-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {tx.title || tx.category || 'Transaction'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {tx.category} • {tx.account}
                          </p>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <p className={`text-xs font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(converted, displayCurrency)}
                          </p>
                          {tx.currency !== displayCurrency && (
                            <p className="text-[9px] text-slate-400">{formatCurrency(tx.amount, tx.currency as DisplayCurrency)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Day Total Summary Box */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs font-medium">
              <span className="text-slate-600 dark:text-slate-300">
                Combined Estimated Impact for Day {selectedDayDetails.day}:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {(() => {
                  const net = (selectedDayDetails.totalActualIncome + selectedDayDetails.totalPendingIncome) - 
                              (selectedDayDetails.totalActualSpent + selectedDayDetails.totalPendingExpense);
                  return (
                    <span className={net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {net >= 0 ? '+' : ''}{formatCurrency(net, displayCurrency)}
                    </span>
                  );
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MonthlyHeatmap;
