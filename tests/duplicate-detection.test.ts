/**
 * Possible-duplicate detection: the warning that fires when a newly saved
 * expense/income looks like an already-logged one (case that motivated it:
 * a Bereshit matricula installment got logged twice in the same month).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDuplicateCandidates,
  isDuplicateCheckable,
  normalizeTitle,
  DUPLICATE_WINDOW_DAYS,
} from '../src/utils/duplicateDetection.ts';

const BERESHIT = {
  id: 'tx-real',
  title: 'Bereshit Matricula',
  amount: 227286,
  currency: 'ARS',
  type: 'EXPENSE',
  date: '2026-10-28',
  account: 'Visa BBVA',
  category: 'Educación',
};

const dup = { ...BERESHIT, id: undefined, date: '2026-10-15' }; // logged again, days earlier

test('flags same title + amount + currency within the window', () => {
  const matches = findDuplicateCandidates([BERESHIT], dup as any);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'tx-real');
});

test('title matching is case/space-insensitive', () => {
  assert.equal(normalizeTitle('  Bereshit   Matricula '), 'bereshit matricula');
  const matches = findDuplicateCandidates([BERESHIT], { ...dup, title: 'BERESHIT MATRICULA' } as any);
  assert.equal(matches.length, 1);
});

test('no match when the amount differs', () => {
  const matches = findDuplicateCandidates([BERESHIT], { ...dup, amount: 227287 } as any);
  assert.equal(matches.length, 0);
});

test('no match when the currency differs', () => {
  const matches = findDuplicateCandidates([BERESHIT], { ...dup, currency: 'USD' } as any);
  assert.equal(matches.length, 0);
});

test('no match when the type differs (expense vs income)', () => {
  const matches = findDuplicateCandidates([BERESHIT], { ...dup, type: 'INCOME' } as any);
  assert.equal(matches.length, 0);
});

test('no match outside the day window (monthly identical fee)', () => {
  const afipSept = { ...BERESHIT, title: 'AFIP Monotributo', amount: 349312.72, date: '2026-09-22' };
  const afipOct = { ...afipSept, id: undefined, date: '2026-10-22' }; // 30 days later
  const matches = findDuplicateCandidates([afipSept], afipOct as any);
  assert.equal(matches.length, 0);
  assert.ok(30 > DUPLICATE_WINDOW_DAYS); // documents why the fee case is out
});

test('installments are excluded on both sides (cuotas repeat by design)', () => {
  const cuota1 = { ...BERESHIT, id: 'c1', title: 'Skechers', amount: 36666.33, date: '2026-10-16', installmentNumber: 1, totalInstallments: 3, installments: '1/3', planId: 'plan_1' };
  const cuota2sameMonth = { ...cuota1, id: undefined, date: '2026-10-20', installmentNumber: undefined, totalInstallments: undefined, installments: undefined, planId: undefined };
  // candidate is a single tx that happens to equal a cuota's amount: cuota side stays out
  assert.equal(findDuplicateCandidates([cuota1], cuota2sameMonth as any).length, 0);
  // and a cuota candidate is never checked
  assert.equal(isDuplicateCheckable(cuota1 as any), false);
});

test('transfers and CC payments are never checked', () => {
  assert.equal(isDuplicateCheckable({ type: 'TRANSFER' } as any), false);
  assert.equal(isDuplicateCheckable({ type: 'CC_PAYMENT' } as any), false);
});

test('a transaction never matches itself when editing', () => {
  const matches = findDuplicateCandidates([BERESHIT], BERESHIT as any, 'tx-real');
  assert.equal(matches.length, 0);
});

test('empty/invalid candidates produce no matches', () => {
  assert.equal(findDuplicateCandidates([BERESHIT], { ...dup, title: '  ' } as any).length, 0);
  assert.equal(findDuplicateCandidates([BERESHIT], { ...dup, amount: 0 } as any).length, 0);
  assert.equal(findDuplicateCandidates([BERESHIT], { ...dup, date: '' } as any).length, 0);
  assert.equal(findDuplicateCandidates([BERESHIT], { ...dup, type: undefined } as any).length, 0);
});

test('matches sort most-recent first and cap at 5', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({
    ...BERESHIT,
    id: `tx-${i}`,
    date: `2026-10-${String(10 + i).padStart(2, '0')}`,
  }));
  const matches = findDuplicateCandidates(many, { ...dup, date: '2026-10-25' } as any);
  assert.equal(matches.length, 5);
  assert.equal(matches[0].date, '2026-10-16');
});
