import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import type { DuplicateMatch } from '../utils/duplicateDetection';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  matches: DuplicateMatch[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Non-blocking warning shown when a new expense/income looks like one that
 * was already logged. The user decides: it never prevents the save.
 */
export function DuplicateWarningModal({ isOpen, matches, onConfirm, onCancel }: DuplicateWarningModalProps) {
  const { t } = useTranslation();
  if (!isOpen || matches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">{t('transactions.duplicate_warning_title')}</h3>
          <p className="text-sm text-slate-400">{t('transactions.duplicate_warning_desc')}</p>
        </div>

        <ul className="space-y-2">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-200">{m.title}</p>
                <p className="text-xs text-slate-500">
                  {m.date}{m.account ? ` • ${m.account}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-200">
                {m.currency} {m.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            {t('transactions.duplicate_warning_go_back')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-slate-950 transition-colors text-sm font-semibold"
          >
            {t('transactions.duplicate_warning_save_anyway')}
          </button>
        </div>
      </div>
    </div>
  );
}
