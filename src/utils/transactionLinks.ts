/**
 * Links between related movements: a purchase and its reintegros (refunds,
 * cashback) or propinas (tips). Related movements usually share the title but
 * sit on a different account and/or have a different type.
 *
 * Rules:
 * - The title only SUGGESTS a link. Nothing is ever linked automatically.
 * - Linking never edits account, type, amount or date of any movement.
 * - A link is a shared `linkId`. It is stored in user_settings.txLinkIds
 *   (same pattern as txPlanIds), so no schema migration is needed.
 */
import { normalizeTitle } from './duplicateDetection.ts';

export interface LinkableTx {
  id: string;
  title: string;
  date: string;
  account: string;
  amount: number;
  currency: string;
  type: string;
  linkId?: string;
}

export type LinkKind = 'REINTEGRO' | 'PROPINA' | 'RELATED';

export interface LinkSuggestion<T extends LinkableTx = LinkableTx> {
  tx: T;
  kind: LinkKind;
  daysApart: number;
  /** true when the candidate is already in another link group */
  inOtherGroup: boolean;
}

export const LINK_WINDOW_DAYS = 45;
const LINKABLE = new Set(['EXPENSE', 'INCOME']);

function dayNumber(date: string): number {
  const [y, m, d] = (date || '').substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Classifies how `other` relates to `base`, or null when it cannot be a link:
 * - INCOME against an EXPENSE (either way round) -> REINTEGRO
 * - same type on a different account -> PROPINA (tip paid apart, e.g. cash)
 * - same type, same account -> not suggested (that is a duplicate, not a link)
 */
export function classifyLink(base: LinkableTx, other: LinkableTx): LinkKind | null {
  if (base.type !== other.type) return 'REINTEGRO';
  if (base.account !== other.account) return base.type === 'EXPENSE' ? 'PROPINA' : 'RELATED';
  return null;
}

export function suggestLinks<T extends LinkableTx>(
  base: T,
  all: T[],
  windowDays: number = LINK_WINDOW_DAYS,
): LinkSuggestion<T>[] {
  if (!LINKABLE.has(base.type)) return [];
  const title = normalizeTitle(base.title);
  if (!title) return [];
  const baseDay = dayNumber(base.date);
  const out: LinkSuggestion<T>[] = [];
  for (const t of all) {
    if (t.id === base.id || !LINKABLE.has(t.type)) continue;
    if (base.linkId && t.linkId === base.linkId) continue; // already together
    if (normalizeTitle(t.title) !== title) continue;
    const kind = classifyLink(base, t);
    if (!kind) continue;
    const daysApart = Math.abs(dayNumber(t.date) - baseDay);
    if (!Number.isFinite(daysApart) || daysApart > windowDays) continue;
    out.push({ tx: t, kind, daysApart, inOtherGroup: !!t.linkId && t.linkId !== base.linkId });
  }
  // reintegros first, then closest in time
  out.sort((a, b) => (a.kind === 'REINTEGRO' ? 0 : 1) - (b.kind === 'REINTEGRO' ? 0 : 1) || a.daysApart - b.daysApart);
  return out;
}

/** Returns id -> linkId map updates that put `ids` in one group (merging groups they already belong to). */
export function buildLinkUpdates(all: LinkableTx[], ids: string[], newId: () => string): Record<string, string> {
  const picked = all.filter(t => ids.includes(t.id));
  if (picked.length < 2) return {};
  const existing = picked.map(t => t.linkId).filter((x): x is string => !!x);
  const target = existing[0] || newId();
  const groupsToMerge = new Set([...existing, target]);
  const updates: Record<string, string> = {};
  for (const t of all) {
    if (ids.includes(t.id) || (t.linkId && groupsToMerge.has(t.linkId))) updates[t.id] = target;
  }
  return updates;
}

export function getLinkedGroup<T extends LinkableTx>(tx: T, all: T[]): T[] {
  if (!tx.linkId) return [tx];
  return all.filter(t => t.linkId === tx.linkId);
}

export interface LinkGroupSummary {
  currency: string | null; // null when currencies are mixed (no net computed)
  gross: number;
  reintegros: number;
  extras: number;
  net: number | null;
}

/**
 * Net cost of a linked purchase. Base = the first EXPENSE by date; later
 * EXPENSEs on other accounts are extras (tips); INCOMEs are reintegros.
 */
export function summarizeGroup(group: LinkableTx[]): LinkGroupSummary {
  const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
  const currencies = new Set(sorted.map(t => t.currency));
  const first = sorted.find(t => t.type === 'EXPENSE');
  const gross = first ? first.amount : 0;
  const extras = sorted.filter(t => t.type === 'EXPENSE' && t !== first).reduce((s, t) => s + t.amount, 0);
  const reintegros = sorted.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const single = currencies.size === 1;
  return {
    currency: single ? [...currencies][0] : null,
    gross, reintegros, extras,
    net: single ? gross + extras - reintegros : null,
  };
}
