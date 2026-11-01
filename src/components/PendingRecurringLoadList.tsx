import React, { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Transaction, RecurringRule, DisplayCurrency, PendingRecurringItem } from '../types';
import { getPendingRecurringForMonth, getCurrentMonthKey, formatCurrency, convertCurrency } from '../utils/financeUtils';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const localeOf = (lang: string) => (lang.startsWith('es') ? 'es-AR' : 'en-US');
/** Date shown in words (weekday, day, month, year) in the app language. */
export function readableDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}
export function formatMoney(amount: number, currency: string, lang: string): string {
  const n = new Intl.NumberFormat(localeOf(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${currency} ${n}`;
}

/** Confirmation step shared by every "Cargar ahora" entry point. Nothing is created before Confirm. */
export function LoadNowConfirm({ item, onConfirm, onCancel, convert, displayCurrency }: {
  item: PendingRecurringItem; onConfirm: (amount: number, date: string) => void; onCancel: () => void;
  /** converts an amount in the item's currency to the display currency (optional) */
  convert?: (amount: number, date: string) => number; displayCurrency?: string;
}) {
  const { t, i18n } = useTranslation();
  const [amount, setAmount] = useState(String(Math.round(item.amount * 100) / 100));
  const [date, setDate] = useState(todayIso());
  const num = parseFloat(amount);
  const valid = num > 0 && !!date;
  const kind = item.type === 'INCOME' ? t('loadnow.kind_income') : t('loadnow.kind_expense');
  const showConverted = !!convert && !!displayCurrency && displayCurrency !== item.currency && valid;
  return (
    <div className="basis-full mt-2 p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 space-y-2">
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        {t('loadnow.summary', { kind, title: item.title, category: item.category, account: item.account })}
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
          {t('loadnow.amount_label', { currency: item.currency })}
          <input type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="w-32 text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100" />
        </label>
        <label className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
          {t('loadnow.date_label')}
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100" />
        </label>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('loadnow.currency_note', { currency: item.currency })}</p>
      {showConverted && <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('loadnow.converted_note', { amount: formatMoney(convert!(num, date), displayCurrency!, i18n.language), currency: displayCurrency })}</p>}
      {date && <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{t('loadnow.date_readable', { date: readableDate(date, i18n.language) })}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={!valid} onClick={() => onConfirm(num, date)} className="px-2 py-1 text-xs font-bold rounded bg-emerald-600 text-white disabled:opacity-40">{t('loadnow.confirm')}</button>
        <button type="button" onClick={onCancel} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">{t('loadnow.cancel')}</button>
      </div>
    </div>
  );
}

export function buildTxFromPending(item: PendingRecurringItem, amount: number, date: string): Transaction {
  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: item.title, amount, currency: item.currency, type: item.type,
    category: item.category || 'General', account: item.account || 'BBVA', date,
    description: item.isInstallment ? i18n.t('loadnow.desc_installment', { info: item.installmentInfo || '' }) : i18n.t('loadnow.desc_logged'),
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
  const { t, i18n } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const items = useMemo(
    () => getPendingRecurringForMonth(getCurrentMonthKey(), transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate).pendingItems,
    [transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate],
  );
  if (!onAddTransaction || items.length === 0) return null;
  const conv = (item: PendingRecurringItem) => (amount: number, date: string) => convertCurrency(amount, item.currency, displayCurrency, usdArsRate, date, transactions);
  return (
    <div className="bg-white dark:bg-[#161b22] p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 space-y-2">
      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('loadnow.pending_title', { count: items.length })}</h4>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('loadnow.pending_hint')}</p>
      {items.map(item => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-500/30">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{item.title}{item.isExpired ? ` · ${t('loadnow.overdue')}` : ''}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.category} • {item.account} • {t('loadnow.day', { day: item.originalDayOfMonth || item.dayOfMonth })}</p>
          </div>
          <div className="text-right font-mono">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.type === 'INCOME' ? '+' : '-'}{formatMoney(item.amount, item.currency, i18n.language)}</p>
            {item.currency !== displayCurrency && <p className="text-[10px] text-slate-500">≈ {formatCurrency(item.convertedAmount, displayCurrency)} {displayCurrency}</p>}
          </div>
          <button type="button" onClick={() => setOpenId(item.id)} className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:text-emerald-600">
            <PlusCircle className="w-4 h-4" /> {t('loadnow.button')}
          </button>
          {openId === item.id && (
            <LoadNowConfirm item={item} convert={conv(item)} displayCurrency={displayCurrency} onCancel={() => setOpenId(null)} onConfirm={(amount, date) => { onAddTransaction(buildTxFromPending(item, amount, date)); setOpenId(null); }} />
          )}
        </div>
      ))}
    </div>
  );
}
