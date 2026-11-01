import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestLinks, planLink, planUnlink, liveGroups, summarizeGroup, toStoredLinks, mergeStoredLinks, applyStoredLink } from '../src/utils/transactionLinks.ts';

const tx = (o: any) => ({ id: 'x', title: 'Punny', date: '2026-10-29', account: 'Visa BBVA', amount: 135900, currency: 'ARS', type: 'EXPENSE', ...o });
const P = tx({ id: 'p' });
const R = tx({ id: 'r', type: 'INCOME', account: 'BBVA', amount: 27180, date: '2026-10-30' });
const T = tx({ id: 't', account: 'Efectivo', amount: 10000 });
const T2 = tx({ id: 't2', type: 'INCOME', account: 'Efectivo', amount: 5000 }); // income on another account: role is the user's call
let n = 0; const nid = () => `g${++n}`;

test('candidates by title only; no role is assigned', () => {
  const s = suggestLinks(P, [P, R, T]);
  assert.equal(s.length, 2);
  assert.ok(s.every(x => !('kind' in x) && !('role' in x)));
});
test('same type + same account is a duplicate, never a candidate; transfers excluded', () => {
  assert.equal(suggestLinks(P, [P, tx({ id: 'd' }), tx({ id: 'tr', type: 'TRANSFER', account: 'A' })]).length, 0);
});
test('different title / outside window excluded', () => {
  assert.equal(suggestLinks(P, [tx({ id: 'o', title: 'Ki Tob', type: 'INCOME' }), tx({ id: 'q', type: 'INCOME', date: '2026-01-01' })]).length, 0);
});
test('planLink uses explicit roles and does not touch account/type/amount', () => {
  const all = [P, R, T];
  const before = JSON.stringify(all);
  const pa = planLink(all, { baseId: 'p', baseRole: 'COMPRA', picks: [{ id: 'r', role: 'REINTEGRO' }, { id: 't', role: 'OTRO' }] }, 100, nid);
  assert.equal(pa.r.linkRole, 'REINTEGRO'); assert.equal(pa.t.linkRole, 'OTRO');
  assert.equal(new Set(Object.values(pa).map(x => x.linkId)).size, 1);
  assert.equal(JSON.stringify(all), before);
});
test('merging another existing group requires explicit confirmation', () => {
  const all = [P, { ...R, linkId: 'gX', linkRole: 'REINTEGRO' }, { ...T, linkId: 'gX', linkRole: 'PROPINA' }];
  assert.throws(() => planLink(all, { baseId: 'p', baseRole: 'COMPRA', picks: [{ id: 'r', role: 'REINTEGRO' }] }, 1, nid), /MERGE_NOT_CONFIRMED/);
  const ok = planLink(all, { baseId: 'p', baseRole: 'COMPRA', picks: [{ id: 'r', role: 'REINTEGRO' }], confirmMerge: true }, 1, nid);
  assert.equal(ok.t.linkRole, 'PROPINA'); // member of merged group keeps role, joins group
  assert.equal(ok.t.linkId, ok.p.linkId);
});
test('unlink from a 2-member group dissolves it (no orphan); 3+ keeps the rest', () => {
  const two = [{ ...P, linkId: 'g', linkRole: 'COMPRA' }, { ...R, linkId: 'g', linkRole: 'REINTEGRO' }];
  const u = planUnlink(two, 'r', 5);
  assert.equal(u.p.linkId, null); assert.equal(u.r.linkId, null);
  const three = [...two, { ...T, linkId: 'g', linkRole: 'PROPINA' }];
  const u3 = planUnlink(three, 'r', 5);
  assert.deepEqual(Object.keys(u3), ['r']);
  assert.equal(liveGroups([{ ...P, linkId: 'solo' }]).size, 0);
});
test('net = compra + propina - reintegro; OTRO excluded; mixed currency or no compra = no net', () => {
  const g = [{ ...P, linkRole: 'COMPRA' }, { ...R, linkRole: 'REINTEGRO' }, { ...T, linkRole: 'PROPINA' }, { ...T2, linkRole: 'OTRO' }];
  assert.equal(summarizeGroup(g as any).net, 135900 + 10000 - 27180);
  assert.equal(summarizeGroup([{ ...P, linkRole: 'COMPRA' }, { ...R, currency: 'USD', linkRole: 'REINTEGRO' }] as any).net, null);
  assert.equal(summarizeGroup([{ ...R, linkRole: 'REINTEGRO' }] as any).net, null);
});
test('stale device cannot overwrite newer link or unlink (latest linkAt wins; absent key keeps remote)', () => {
  const remote = { p: { g: 'g', r: 'COMPRA' as const, at: 200 }, r: { g: null, at: 300 } };
  const stale = toStoredLinks([{ ...P, linkId: 'old', linkRole: 'OTRO', linkAt: 100 }, { ...R, linkId: 'old', linkRole: 'REINTEGRO', linkAt: 100 }] as any);
  const m = mergeStoredLinks(stale, remote);
  assert.equal(m.p.g, 'g'); assert.equal(m.r.g, null);
  const empty = mergeStoredLinks({}, remote); // stale device that knows nothing keeps remote
  assert.equal(empty.p.g, 'g');
  const newer = mergeStoredLinks({ p: { g: null, at: 400 } }, remote);
  assert.equal(newer.p.g, null);
});
test('deleted movements are dropped; load applies stored link', () => {
  const m = mergeStoredLinks({ a: { g: 'g', at: 1 } }, { b: { g: 'g', at: 1 } }, id => id === 'b');
  assert.deepEqual(Object.keys(m), ['a']);
  assert.deepEqual(applyStoredLink('uid_a', { a: { g: 'g', r: 'COMPRA', at: 1 } }, 'a'), { linkId: 'g', linkRole: 'COMPRA', linkAt: 1 });
});
