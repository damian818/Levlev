import React, { useState } from 'react';
import { Link2, X, Unlink, AlertTriangle } from 'lucide-react';
import { Transaction } from '../types';
import { suggestLinks, getLinkedGroup, summarizeGroup, liveGroups, planLink, planUnlink, LinkRole, LinkPatch } from '../utils/transactionLinks';

interface Props {
  base: Transaction | null;
  transactions: Transaction[];
  onClose: () => void;
  /** per-movement patches; the caller applies each one */
  onApply: (patches: Record<string, LinkPatch>) => void;
}

const ROLE_LABEL: Record<LinkRole, string> = { COMPRA: 'Compra', REINTEGRO: 'Reintegro', PROPINA: 'Propina', OTRO: 'Otro' };
const fmt = (n: number, c: string) => `${c === 'USD' ? 'US$' : '$'}${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const line = (t: Transaction) => `${t.date} · ${t.type === 'INCOME' ? 'ingreso' : 'gasto'} ${fmt(t.amount, t.currency)} · ${t.account}`;

export function LinkTransactionsModal({ base, transactions, onClose, onApply }: Props) {
  const [roles, setRoles] = useState<Record<string, LinkRole | ''>>({});
  const [baseRole, setBaseRole] = useState<LinkRole | ''>('');
  const [mergeOk, setMergeOk] = useState(false);
  if (!base) return null;

  const suggestions = suggestLinks(base, transactions);
  const group = getLinkedGroup(base, transactions);
  const summary = group.length > 1 ? summarizeGroup(group) : null;
  const groups = liveGroups(transactions);
  const effBaseRole: LinkRole | '' = baseRole || (group.length > 1 ? (base.linkRole || '') : (base.type === 'EXPENSE' ? 'COMPRA' : ''));
  const picks = suggestions.filter(s => roles[s.tx.id]);
  const mergeGroups = [...new Set(picks.filter(s => s.tx.linkId && s.tx.linkId !== base.linkId && groups.has(s.tx.linkId)).map(s => s.tx.linkId as string))];
  const canApply = picks.length > 0 && !!effBaseRole && (mergeGroups.length === 0 || mergeOk);

  const apply = () => {
    const patches = planLink(transactions, {
      baseId: base.id,
      baseRole: effBaseRole as LinkRole,
      picks: picks.map(s => ({ id: s.tx.id, role: roles[s.tx.id] as LinkRole })),
      confirmMerge: mergeOk,
    }, Date.now(), () => `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    onApply(patches);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 space-y-4 text-slate-200">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h3 className="text-sm font-bold flex items-center gap-2"><Link2 className="w-4 h-4" /> Vincular movimientos</h3>
            <p className="text-xs text-slate-400 mt-1 break-words">{base.title} · {line(base)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>

        {summary && (
          <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <p className="font-semibold">Ya vinculados ({group.length})</p>
            {group.map(t => (
              <p key={t.id} className="text-slate-400">{t.linkRole ? ROLE_LABEL[t.linkRole] : 'Sin rol'} · {line(t)}</p>
            ))}
            {summary.net !== null && summary.currency && (
              <p className="pt-1 text-emerald-400">Costo neto: {fmt(summary.net, summary.currency)} (compra + propinas − reintegros)</p>
            )}
            <button onClick={() => { onApply(planUnlink(transactions, base.id, Date.now())); onClose(); }} className="mt-1 flex items-center gap-1 text-rose-400 hover:text-rose-300">
              <Unlink className="w-3 h-3" /> Desvincular este movimiento{group.length <= 2 ? ' (el vínculo se deshace)' : ''}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-slate-400">Candidatos con el mismo título (últimos 45 días). Elegí vos el rol de cada uno; cuenta, tipo, monto y fecha no se modifican.</p>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span>Este movimiento es:</span>
            <select value={effBaseRole} onChange={e => setBaseRole(e.target.value as LinkRole | '')} className="bg-slate-900 border border-slate-700 rounded px-2 py-1">
              <option value="">Elegir…</option>
              {(Object.keys(ROLE_LABEL) as LinkRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          {suggestions.length === 0 && <p className="text-xs text-slate-500">No hay candidatos con el mismo título.</p>}
          {suggestions.map(s => (
            <div key={s.tx.id} className="p-2 rounded-lg border border-slate-800 text-xs space-y-1">
              <p>{line(s.tx)} <span className="text-slate-500">({s.hint})</span></p>
              {s.inOtherGroup && <p className="text-amber-400">Ya está en otro vínculo.</p>}
              <select value={roles[s.tx.id] || ''} onChange={e => setRoles({ ...roles, [s.tx.id]: e.target.value as LinkRole | '' })} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-full">
                <option value="">No vincular</option>
                {(Object.keys(ROLE_LABEL) as LinkRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          ))}
        </div>

        {mergeGroups.length > 0 && (
          <div className="text-xs border border-amber-500/50 bg-amber-950/20 rounded-xl p-3 space-y-2">
            <p className="flex items-center gap-1 font-semibold text-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> Se van a unir vínculos existentes</p>
            {mergeGroups.map(g => (
              <div key={g} className="text-slate-300 space-y-0.5">
                {(groups.get(g) || []).map(t => <p key={t.id}>{t.title} · {t.linkRole ? ROLE_LABEL[t.linkRole] : 'Sin rol'} · {line(t)}</p>)}
              </div>
            ))}
            <label className="flex items-center gap-2"><input type="checkbox" checked={mergeOk} onChange={e => setMergeOk(e.target.checked)} /> Confirmo que estos movimientos también pasan a este vínculo</label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700">Cancelar</button>
          <button disabled={!canApply} onClick={apply} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white disabled:opacity-40">Vincular{picks.length ? ` (${picks.length})` : ''}</button>
        </div>
      </div>
    </div>
  );
}
