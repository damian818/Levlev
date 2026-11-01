import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, X, Unlink, AlertTriangle } from 'lucide-react';
import { Transaction } from '../types';
import { suggestLinks, getLinkedGroup, summarizeGroup, liveGroups, planLink, planUnlink, LinkRole, LinkPatch, LINK_ROLES, LINK_WINDOW_DAYS } from '../utils/transactionLinks';

interface Props {
  base: Transaction | null;
  transactions: Transaction[];
  onClose: () => void;
  /** per-movement patches; the caller applies each one */
  onApply: (patches: Record<string, LinkPatch>) => void;
}

export function LinkTransactionsModal({ base, transactions, onClose, onApply }: Props) {
  const { t, i18n } = useTranslation();
  const [roles, setRoles] = useState<Record<string, LinkRole | ''>>({});
  const [baseRole, setBaseRole] = useState<LinkRole | ''>('');
  const [mergeOk, setMergeOk] = useState(false);
  if (!base) return null;

  const locale = i18n.language.startsWith('es') ? 'es-AR' : 'en-US';
  const fmt = (n: number, c: string) => `${c === 'USD' ? 'US$' : '$'}${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  const roleName = (r?: LinkRole) => (r ? t(`txlinks.role_${r}`) : t('txlinks.no_role'));
  const line = (x: Transaction) => `${x.date} · ${x.type === 'INCOME' ? t('txlinks.kind_income') : t('txlinks.kind_expense')} ${fmt(x.amount, x.currency)} · ${x.account}`;
  const hintText = (h: 'account' | 'type' | 'both') => t(`txlinks.hint_${h}`);

  const suggestions = suggestLinks(base, transactions);
  const group = getLinkedGroup(base, transactions);
  const summary = group.length > 1 ? summarizeGroup(group) : null;
  const groups = liveGroups(transactions);
  const effBaseRole: LinkRole | '' = baseRole || (group.length > 1 ? (base.linkRole || '') : (base.type === 'EXPENSE' ? 'COMPRA' : ''));
  const picks = suggestions.filter(s => roles[s.tx.id]);
  const mergeGroups = [...new Set(picks.filter(s => s.tx.linkId && s.tx.linkId !== base.linkId && groups.has(s.tx.linkId)).map(s => s.tx.linkId as string))];
  const canApply = picks.length > 0 && !!effBaseRole && (mergeGroups.length === 0 || mergeOk);
  const roleOptions = LINK_ROLES.map(r => <option key={r} value={r}>{t(`txlinks.role_${r}`)}</option>);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70" role="dialog" aria-label={t('txlinks.title')}>
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 space-y-4 text-slate-200">
        <div className="flex justify-between items-start">
          <h3 className="text-sm font-bold flex items-center gap-2"><Link2 className="w-4 h-4" /> {t('txlinks.title')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label={t('txlinks.close')}><X className="w-4 h-4" /></button>
        </div>

        <div className="border border-emerald-600/40 bg-emerald-950/10 rounded-xl p-3 space-y-2 text-xs">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold">{t('txlinks.selected')}</p>
          <p className="font-semibold break-words">{base.title}</p>
          <p className="text-slate-400">{line(base)}</p>
          <label className="flex items-center justify-between gap-2">
            <span>{t('txlinks.selected_role')}</span>
            <select value={effBaseRole} onChange={e => setBaseRole(e.target.value as LinkRole | '')} className="bg-slate-900 border border-slate-700 rounded px-2 py-1">
              <option value="">{t('txlinks.choose_role')}</option>
              {roleOptions}
            </select>
          </label>
        </div>

        {summary && (
          <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <p className="font-semibold">{t('txlinks.already_linked', { count: group.length })}</p>
            {group.map(x => (
              <p key={x.id} className={x.id === base.id ? 'text-slate-200' : 'text-slate-400'}>{roleName(x.linkRole)} · {line(x)}</p>
            ))}
            {summary.net !== null && summary.currency && (
              <p className="pt-1 text-emerald-400">{t('txlinks.net', { amount: fmt(summary.net, summary.currency) })}</p>
            )}
            <button onClick={() => { onApply(planUnlink(transactions, base.id, Date.now())); onClose(); }} className="mt-1 flex items-center gap-1 text-rose-400 hover:text-rose-300">
              <Unlink className="w-3 h-3" /> {group.length <= 2 ? t('txlinks.unlink_dissolves') : t('txlinks.unlink')}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-slate-400">{t('txlinks.intro', { days: LINK_WINDOW_DAYS })}</p>
          {suggestions.length === 0 && <p className="text-xs text-slate-500">{t('txlinks.none')}</p>}
          {suggestions.map(s => (
            <div key={s.tx.id} className="p-2 rounded-lg border border-slate-800 text-xs space-y-1">
              <p>{line(s.tx)} <span className="text-slate-500">({hintText(s.hint)})</span></p>
              {s.inOtherGroup && <p className="text-amber-400">{t('txlinks.in_other_group')}</p>}
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">{t('txlinks.role_label')}</span>
                <select value={roles[s.tx.id] || ''} onChange={e => setRoles({ ...roles, [s.tx.id]: e.target.value as LinkRole | '' })} className="bg-slate-900 border border-slate-700 rounded px-2 py-1">
                  <option value="">{t('txlinks.dont_link')}</option>
                  {roleOptions}
                </select>
              </label>
            </div>
          ))}
        </div>

        {mergeGroups.length > 0 && (
          <div className="text-xs border border-amber-500/50 bg-amber-950/20 rounded-xl p-3 space-y-2">
            <p className="flex items-center gap-1 font-semibold text-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> {t('txlinks.merge_title')}</p>
            {mergeGroups.map(g => (
              <div key={g} className="text-slate-300 space-y-0.5">
                {(groups.get(g) || []).map(x => <p key={x.id}>{x.title} · {roleName(x.linkRole)} · {line(x)}</p>)}
              </div>
            ))}
            <label className="flex items-center gap-2"><input type="checkbox" checked={mergeOk} onChange={e => setMergeOk(e.target.checked)} /> {t('txlinks.merge_confirm')}</label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700">{t('txlinks.cancel')}</button>
          <button disabled={!canApply} onClick={apply} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white disabled:opacity-40">{picks.length ? t('txlinks.link_count', { count: picks.length }) : t('txlinks.link')}</button>
        </div>
      </div>
    </div>
  );
}
