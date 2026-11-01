import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestLinks, buildLinkUpdates, summarizeGroup, classifyLink } from '../src/utils/transactionLinks.ts';

const tx = (o: any) => ({ id: 'x', title: 'Punny', date: '2026-10-29', account: 'Visa BBVA', amount: 135900, currency: 'ARS', type: 'EXPENSE', ...o });
const purchase = tx({ id: 'p' });
const refund = tx({ id: 'r', type: 'INCOME', account: 'BBVA', amount: 27180, date: '2026-10-30' });
const tip = tx({ id: 't', account: 'Efectivo', amount: 10000 });

test('income with same title is suggested as reintegro, account and type untouched', () => {
  const s = suggestLinks(purchase, [purchase, refund]);
  assert.equal(s.length, 1);
  assert.equal(s[0].kind, 'REINTEGRO');
  assert.equal(refund.account, 'BBVA');
});
test('same-type different-account is a propina suggestion', () => {
  assert.equal(suggestLinks(purchase, [purchase, tip])[0].kind, 'PROPINA');
});
test('same type + same account is a duplicate, not a link', () => {
  assert.equal(classifyLink(purchase, tx({ id: 'd' })), null);
  assert.equal(suggestLinks(purchase, [purchase, tx({ id: 'd' })]).length, 0);
});
test('different title or outside window is not suggested', () => {
  assert.equal(suggestLinks(purchase, [tx({ id: 'o', title: 'Ki Tob', type: 'INCOME' })]).length, 0);
  assert.equal(suggestLinks(purchase, [tx({ id: 'o', type: 'INCOME', date: '2026-01-01' })]).length, 0);
});
test('transfers are never linked', () => {
  assert.equal(suggestLinks(purchase, [tx({ id: 'tr', type: 'TRANSFER' })]).length, 0);
});
test('buildLinkUpdates groups and merges existing groups', () => {
  const all = [purchase, refund, { ...tip, linkId: 'g1' }, { ...tx({ id: 'z', account: 'Otra' }), linkId: 'g1' }];
  const u = buildLinkUpdates(all, ['p', 't'], () => 'new');
  assert.deepEqual(u, { p: 'g1', t: 'g1', z: 'g1' });
  assert.deepEqual(buildLinkUpdates(all, ['p'], () => 'n'), {});
});
test('net: purchase + tip - reintegro; mixed currency has no net', () => {
  const s = summarizeGroup([purchase, refund, tip]);
  assert.equal(s.net, 135900 + 10000 - 27180);
  assert.equal(summarizeGroup([purchase, { ...refund, currency: 'USD' }]).net, null);
});
