/**
 * Links between related movements (a purchase and its reintegros, propinas or
 * other related movements). Usually they share the title but sit on another
 * account and/or have another type, though not always.
 *
 * Rules:
 * - Title only SUGGESTS a candidate. Nothing is linked automatically, and no
 *   role is assigned automatically: the user picks the role of every movement.
 * - Linking never edits account, type, amount or date of any movement.
 * - Each movement carries linkId (group), linkRole and linkAt (ms timestamp of
 *   the last change). Persisted in user_settings.txLinks (no schema migration)
 *   and merged per movement by latest linkAt, so an old device cannot silently
 *   overwrite links or unlinks made elsewhere.
 * - Merging two existing groups needs explicit confirmation by the caller.
 * - A group with fewer than 2 live members is not a group.
 */
import { normalizeTitle } from './duplicateDetection.ts';

export type LinkRole = 'COMPRA' | 'REINTEGRO' | 'PROPINA' | 'OTRO';
export const LINK_ROLES: LinkRole[] = ['COMPRA', 'REINTEGRO', 'PROPINA', 'OTRO'];

export interface LinkableTx {
  id: string;
  title: string;
  date: string;
  account: string;
  amount: number;
  currency: string;
  type: string;
  linkId?: string | null;
  linkRole?: LinkRole;
  linkAt?: number;
}

export interface LinkSuggestion<T extends LinkableTx = LinkableTx> {
  tx: T;
  /** Why it is a candidate (hint only, never applied by itself). */
  hint: 'account' | 'type' | 'both';
  daysApart: number;
  inOtherGroup: boolean;
}

export const LINK_WINDOW_DAYS = 45;
const LINKABLE = new Set(['EXPENSE', 'INCOME']);

function dayNumber(date: string): number {
  const [y, m, d] = (date || '').substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Candidates: same title, other movement of type expense/income, within window. */
export function suggestLinks<T extends LinkableTx>(base: T, all: T[], windowDays: number = LINK_WINDOW_DAYS): LinkSuggestion<T>[] {
  if (!LINKABLE.has(base.type)) return [];
  const title = normalizeTitle(base.title);
  if (!title) return [];
  const baseDay = dayNumber(base.date);
  const out: LinkSuggestion<T>[] = [];
  for (const t of all) {
    if (t.id === base.id || !LINKABLE.has(t.type)) continue;
    if (base.linkId && t.linkId === base.linkId) continue;
    if (normalizeTitle(t.title) !== title) continue;
    const diffAcct = t.account !== base.account;
    const diffType = t.type !== base.type;
    if (!diffAcct && !diffType) continue; // same type + same account = duplicate, not a link
    const daysApart = Math.abs(dayNumber(t.date) - baseDay);
    if (!Number.isFinite(daysApart) || daysApart > windowDays) continue;
    const hint = diffType && diffAcct ? 'both' : diffType ? 'type' : 'account';
    out.push({ tx: t, hint, daysApart, inOtherGroup: !!t.linkId && t.linkId !== base.linkId });
  }
  out.sort((a, b) => a.daysApart - b.daysApart);
  return out;
}

/** Live groups: linkId -> members, only groups with 2+ members. */
export function liveGroups<T extends LinkableTx>(all: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of all) if (t.linkId) (m.get(t.linkId) || m.set(t.linkId, []).get(t.linkId)!).push(t);
  for (const [k, v] of m) if (v.length < 2) m.delete(k);
  return m;
}

export function getLinkedGroup<T extends LinkableTx>(tx: T, all: T[]): T[] {
  return (tx.linkId && liveGroups(all).get(tx.linkId)) || [tx];
}

export interface LinkPatch { linkId: string | null; linkRole?: LinkRole; linkAt: number }

export interface LinkRequest {
  baseId: string;
  baseRole: LinkRole;
  picks: { id: string; role: LinkRole }[];
  /** required (true) when any pick belongs to a different existing group */
  confirmMerge?: boolean;
}

/**
 * Builds per-movement patches. Throws if a merge is needed and not confirmed.
 * Members of a merged group keep their roles and only change group id.
 */
export function planLink(all: LinkableTx[], req: LinkRequest, now: number, newId: () => string): Record<string, LinkPatch> {
  const base = all.find(t => t.id === req.baseId);
  if (!base) return {};
  const pickIds = new Set(req.picks.map(p => p.id));
  const groups = liveGroups(all);
  const otherGroupIds = new Set(
    all.filter(t => pickIds.has(t.id) && t.linkId && t.linkId !== base.linkId && groups.has(t.linkId)).map(t => t.linkId as string),
  );
  if (otherGroupIds.size > 0 && !req.confirmMerge) throw new Error('MERGE_NOT_CONFIRMED');
  const target = (base.linkId && groups.has(base.linkId) ? base.linkId : null) || newId();
  const patches: Record<string, LinkPatch> = {};
  patches[base.id] = { linkId: target, linkRole: req.baseRole, linkAt: now };
  for (const p of req.picks) patches[p.id] = { linkId: target, linkRole: p.role, linkAt: now };
  for (const gid of otherGroupIds) {
    for (const m of groups.get(gid) || []) {
      if (!patches[m.id]) patches[m.id] = { linkId: target, linkRole: m.linkRole || 'OTRO', linkAt: now };
    }
  }
  return patches;
}

/** Removes one movement from its group; a group left with <2 members is dissolved entirely. */
export function planUnlink(all: LinkableTx[], id: string, now: number): Record<string, LinkPatch> {
  const t = all.find(x => x.id === id);
  if (!t || !t.linkId) return {};
  const rest = all.filter(x => x.linkId === t.linkId && x.id !== id);
  const patches: Record<string, LinkPatch> = { [id]: { linkId: null, linkAt: now } };
  if (rest.length < 2) for (const r of rest) patches[r.id] = { linkId: null, linkAt: now };
  return patches;
}

export interface LinkGroupSummary {
  currency: string | null;
  compra: number;
  reintegros: number;
  propinas: number;
  otros: number;
  net: number | null;
}

/** Net = compra + propinas - reintegros ('OTRO' is listed, never counted). Null when currencies are mixed or there is no compra. */
export function summarizeGroup(group: LinkableTx[]): LinkGroupSummary {
  const sum = (r: LinkRole) => group.filter(t => t.linkRole === r).reduce((s, t) => s + t.amount, 0);
  const currencies = new Set(group.map(t => t.currency));
  const compra = sum('COMPRA'), reintegros = sum('REINTEGRO'), propinas = sum('PROPINA'), otros = sum('OTRO');
  const ok = currencies.size === 1 && group.some(t => t.linkRole === 'COMPRA');
  return { currency: currencies.size === 1 ? [...currencies][0] : null, compra, reintegros, propinas, otros, net: ok ? compra + propinas - reintegros : null };
}

// ---- persistence (user_settings.txLinks) ----
export interface StoredLink { g: string | null; r?: LinkRole; at: number }
export type StoredLinkMap = Record<string, StoredLink>;

const cleanKey = (id: string) => (id.includes('_') ? id.split('_').slice(1).join('_') : id);

export function toStoredLinks(txs: LinkableTx[]): StoredLinkMap {
  const out: StoredLinkMap = {};
  for (const t of txs) if (t.linkAt) out[cleanKey(t.id)] = { g: t.linkId || null, ...(t.linkRole ? { r: t.linkRole } : {}), at: t.linkAt };
  return out;
}

/** Per movement, the entry with the latest `at` wins (ties: local). Absent key never means "unlinked". */
export function mergeStoredLinks(local: StoredLinkMap | undefined, remote: StoredLinkMap | undefined, isDeleted: (id: string) => boolean = () => false): StoredLinkMap {
  const out: StoredLinkMap = {};
  for (const src of [remote || {}, local || {}]) {
    for (const [id, e] of Object.entries(src)) {
      if (isDeleted(id) || !e || typeof e.at !== 'number') continue;
      if (!out[id] || e.at >= out[id].at) out[id] = e;
    }
  }
  return out;
}

export function applyStoredLink(id: string, stored: StoredLinkMap | undefined, cleanId?: string): Pick<LinkableTx, 'linkId' | 'linkRole' | 'linkAt'> {
  const e = stored && (stored[id] || (cleanId ? stored[cleanId] : undefined));
  return e ? { linkId: e.g, linkRole: e.r, linkAt: e.at } : {};
}
