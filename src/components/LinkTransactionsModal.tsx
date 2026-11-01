import React, { useState } from 'react';
import { Link2, X, Unlink } from 'lucide-react';
import { Transaction } from '../types';
import { suggestLinks, getLinkedGroup, summarizeGroup } from '../utils/transactionLinks';

interface Props {
  base: Transaction | null;
  transactions: Transaction[];
  onClose: () => void;
  /** assigns `linkId` to every id in `ids` (undefined = remove the link) */
  onApply: (ids: string[], linkId: string | undefined) => void;
}

const KIND_LABEL = { REINTEGRO: 'Reintegro', PROPINA: 'Propina / extra', RELATED: 'Relacionado' } as const;
const fmt = (n: number, c: string) => `${c === 'USD' ? 'US$' : '$'}${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function LinkTransactionsModal({ base, transactions, onClose, onApply }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  if (!base) return null;
  const suggestions = suggestLinks(base, transactions);
  const group = getLinkedGroup(base, transactions);
  const summary = group.length > 1 ? summarizeGroup(group) : null;
  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const apply = () => {
    const ids = [base.id, ...picked];
    const groups = new Set([base.linkId, ...transactions.filter(t => picked.has(t.id)).map(t => t.linkId)].filter(Boolean) as string[]);
    const target = base.linkId || [...groups][0] || `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const merged = transactions.filter(t => t.linkId && groups.has(t.linkId)).map(t => t.id);
    onApply([...new Set([...ids, ...merged])], target);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 text-slate-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2"><Link2 className="w-4 h-4" /> Vincular movimientos</h3>
            <p className="text-xs text-slate-400 mt-1">{base.title} · {fmt(base.amount, base.currency)} · {base.account} · {base.date}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {summary && (
          <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <p className="font-semibold">Ya vinculados ({group.length})</p>
            {group.map(t => (
              <p key={t.id} className="text-slate-400">{t.date} · {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount, t.currency)} · {t.account}</p>
            ))}
            {summary.net !== null && summary.currency && (
              <p className="pt-1 text-emerald-400">Costo neto: {fmt(summary.net, summary.currency)}</p>
            )}
            <button onClick={() => { onApply([base.id], undefined); onClose(); }} className="mt-1 flex items-center gap-1 text-rose-400 hover:text-rose-300">
              <Unlink className="w-3 h-3" /> Desvincular este movimiento
            </button>
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <p className="text-xs text-slate-400">Sugeridos por mismo título. Cuenta, tipo, monto y fecha no se modifican.</p>
          {suggestions.length === 0 && <p className="text-xs text-slate-500">No hay candidatos con el mismo título en los últimos 45 días.</p>}
          {suggestions.map(s => (
            <label key={s.tx.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-800 hover:bg-slate-900 cursor-pointer text-xs">
              <input type="checkbox" checked={picked.has(s.tx.id)} onChange={() => toggle(s.tx.id)} />
              <span className="flex-1">
                <span className="font-semibold">{KIND_LABEL[s.kind]}</span> · {s.tx.date} · {s.tx.type === 'INCOME' ? '+' : '-'}{fmt(s.tx.amount, s.tx.currency)} · {s.tx.account}
                {s.inOtherGroup && <span className="text-amber-400"> · ya está en otro vínculo (se unirán)</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700">Cancelar</button>
          <button disabled={picked.size === 0} onClick={apply} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white disabled:opacity-40">Vincular{picked.size ? ` (${picked.size})` : ''}</button>
        </div>
      </div>
    </div>
  );
}
