import React, { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Transaction, RecurringRule, DisplayCurrency, PendingRecurringItem } from '../types';
import { getPendingRecurringForMonth, getCurrentMonthKey, formatCurrency } from '../utils/financeUtils';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Confirmation step shared by every "Cargar ahora" entry point. Nothing is created before Confirmar. */
export function LoadNowConfirm({ item, onConfirm, onCancel }: { item: PendingRecurringItem; onConfirm: (amount: number, date: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(item.amount));
  const [date, setDate] = useState(todayIso());
  const valid = parseFloat(amount) > 0 && !!date;
  return (
    <div className="basis-full mt-2 p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 space-y-2">
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        Se va a crear: {item.type === 'INCOME' ? 'ingreso' : 'gasto'} "{item.title}" · {item.category} · {item.account} ({item.currency}). Confirmá monto y fecha.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <input aria-label="Monto" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="w-28 text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
        <input aria-label="Fecha" type="date" value={date} onChange={e => setDate(e.target.value)} className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
        <button type="button" disabled={!valid} onClick={() => onConfirm(parseFloat(amount), date)} className="px-2 py-1 text-xs font-bold rounded bg-emerald-600 text-white disabled:opacity-40">Confirmar</button>
        <button type="button" onClick={onCancel} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700">Cancelar</button>
      </div>
    </div>
  );
}

export function buildTxFromPending(item: PendingRecurringItem, amount: number, date: string): Transaction {
  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: item.title, amount, currency: item.currency, type: item.type,
    category: item.category || 'General', account: item.account || 'BBVA', date,
    description: item.isInstallment ? `Cuota: ${item.installmentInfo || ''}` : 'Logged from Recurring Estimate',
    sublabel: '',
  } as Transaction;
}

interface Props {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  nonRecurringKeys?: string[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  onAddTransaction?: (tx: Transaction) => void;
}

/** Pending recurring items of the current month, each with "Cargar ahora" (confirmation required). */
export function PendingRecurringLoadList({ transactions, recurringRules, nonRecurringKeys = [], displayCurrency, usdArsRate, onAddTransaction }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = useMemo(
    () => getPendingRecurringForMonth(getCurrentMonthKey(), transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate).pendingItems,
    [transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate],
  );
  if (!onAddTransaction || items.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#161b22] p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 space-y-2">
      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pendientes este mes ({items.length})</h4>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Estimados que todavía no cargaste. No se crea nada hasta que confirmes.</p>
      {items.map(item => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-500/30">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{item.title}{item.isExpired ? ' · vencido' : ''}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.category} • {item.account} • día {item.originalDayOfMonth || item.dayOfMonth}</p>
          </div>
          <span className="text-xs font-mono font-bold">{item.type === 'INCOME' ? '+' : '-'}{formatCurrency(item.convertedAmount, displayCurrency)}</span>
          <button type="button" onClick={() => setOpenId(item.id)} className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold flex items-center gap-1 hover:text-emerald-600">
            <PlusCircle className="w-4 h-4" /> Cargar ahora
          </button>
          {openId === item.id && (
            <LoadNowConfirm item={item} onCancel={() => setOpenId(null)} onConfirm={(amount, date) => { onAddTransaction(buildTxFromPending(item, amount, date)); setOpenId(null); }} />
          )}
        </div>
      ))}
    </div>
  );
}
