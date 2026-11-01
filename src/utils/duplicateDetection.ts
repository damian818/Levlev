/**
 * Possible-duplicate detection for newly saved transactions.
 *
 * Pure, dependency-free helpers so the rule can be unit-tested without React
 * or Supabase. The goal is a warning, not a block: legitimate repeats exist
 * (two equal purchases in the same month), so callers show the matches and
 * let the user confirm.
 *
 * Scope decisions (see tests):
 * - Only EXPENSE / INCOME. Transfers and credit-card payments are excluded:
 *   moving the same amount between own accounts is common and intentional.
 * - Installment (cuota) transactions are excluded on BOTH sides: plans
 *   legitimately repeat title+amount every month by design.
 * - Match window is +/-WINDOW_DAYS calendar days, which keeps monthly
 *   identical charges (e.g. a fixed monthly fee) out of the warning while
 *   catching a same-purchase logged twice within days.
 */

export const DUPLICATE_WINDOW_DAYS = 15;

export interface DuplicateCandidateInput {
  id?: string | null;
  title?: string | null;
  amount?: number | null;
  currency?: string | null;
  type?: string | null;
  date?: string | null; // YYYY-MM-DD
  account?: string | null;
  category?: string | null;
  installments?: string | number | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  planId?: string | null;
  installmentPlanId?: string | null;
}

export interface DuplicateMatch {
  id: string;
  title: string;
  date: string;
  account: string;
  amount: number;
  currency: string;
}

const CHECKABLE_TYPES = new Set(['EXPENSE', 'INCOME']);

export function normalizeTitle(title: string | null | undefined): string {
  return (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isInstallmentTx(t: DuplicateCandidateInput): boolean {
  if (t.planId || t.installmentPlanId) return true;
  if ((t.totalInstallments ?? 0) > 1) return true;
  if ((t.installmentNumber ?? 0) > 1) return true;
  if (typeof t.installments === 'string' && t.installments.includes('/')) return true;
  if (typeof t.installments === 'number' && t.installments > 1) return true;
  return false;
}

/** True when this kind of transaction should be checked / matched at all. */
export function isDuplicateCheckable(t: DuplicateCandidateInput): boolean {
  if (!t.type || !CHECKABLE_TYPES.has(t.type)) return false;
  if (isInstallmentTx(t)) return false;
  return true;
}

function daysBetween(dateA: string, dateB: string): number | null {
  const a = Date.parse(dateA);
  const b = Date.parse(dateB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.abs(a - b) / 86_400_000;
}

/**
 * Existing transactions that look like the same purchase as `candidate`.
 * `excludeId` skips the transaction being edited (a tx never matches itself).
 */
export function findDuplicateCandidates(
  existing: readonly DuplicateCandidateInput[],
  candidate: DuplicateCandidateInput,
  excludeId?: string | null
): DuplicateMatch[] {
  if (!isDuplicateCheckable(candidate)) return [];
  const title = normalizeTitle(candidate.title);
  if (!title) return [];
  const amount = candidate.amount;
  if (amount == null || !(amount > 0)) return [];
  if (!candidate.date) return [];

  const matches: DuplicateMatch[] = [];
  for (const t of existing) {
    if (!t || !t.id) continue;
    if (excludeId && (t.id === excludeId)) continue;
    if (!isDuplicateCheckable(t)) continue;
    if (t.type !== candidate.type) continue;
    if (normalizeTitle(t.title) !== title) continue;
    if ((t.currency || 'ARS') !== (candidate.currency || 'ARS')) continue;
    if (t.amount == null || Math.abs(t.amount - amount) >= 0.005) continue;
    if (!t.date) continue;
    const gap = daysBetween(t.date, candidate.date);
    if (gap === null || gap > DUPLICATE_WINDOW_DAYS) continue;
    matches.push({
      id: t.id,
      title: t.title || title,
      date: t.date,
      account: t.account || '',
      amount: t.amount,
      currency: t.currency || 'ARS',
    });
  }
  // Most recent first so the likeliest same purchase shows on top.
  return matches.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 5);
}
