/**
 * Pure, dependency-free helpers for cross-device deletion sync ("tombstones").
 *
 * Extracted so the deletion invariant can be unit-tested without a Supabase
 * client. All functions are side-effect free.
 */

/** Expand an id into every stored variant: raw, un-prefixed, and owner-prefixed. */
export function expandIdVariants(id: string, userId?: string): string[] {
  if (!id) return [];
  const clean = id.includes('_') ? id.split('_').slice(1).join('_') : id;
  const out = [id, clean];
  if (userId) {
    if (!id.startsWith(userId)) out.push(`${userId}_${id}`);
    if (!clean.startsWith(userId)) out.push(`${userId}_${clean}`);
  }
  return Array.from(new Set(out));
}

/** Union of tombstone lists; every entry is stored in both prefixed and clean form. */
export function unionTombstones(
  ...lists: Array<readonly string[] | Set<string> | undefined | null>
): Set<string> {
  const out = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) {
      if (!id) continue;
      out.add(id);
      out.add(id.includes('_') ? id.split('_').slice(1).join('_') : id);
    }
  }
  return out;
}

/** True when the id (in any variant) is tombstoned. */
export function isTombstoned(id: string | undefined | null, tombstones: Set<string>): boolean {
  if (!id) return false;
  if (tombstones.has(id)) return true;
  const clean = id.includes('_') ? id.split('_').slice(1).join('_') : id;
  return tombstones.has(clean);
}

/** Transactions that are not tombstoned under the given union. */
export function filterActiveTransactions<T extends { id?: string | null }>(
  transactions: readonly T[] | undefined | null,
  tombstones: Set<string>
): T[] {
  return (transactions || []).filter((t) => t && t.id != null && !isTombstoned(t.id, tombstones));
}
