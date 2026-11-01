import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandIdVariants,
  unionTombstones,
  isTombstoned,
  filterActiveTransactions,
} from '../src/services/tombstones.ts';

const OWNER = 'owneruuid';

test('expandIdVariants covers raw, clean and owner-prefixed forms', () => {
  assert.deepEqual(
    expandIdVariants(`${OWNER}_tx-1`, OWNER).sort(),
    [`${OWNER}_tx-1`, 'tx-1'].sort()
  );
  assert.deepEqual(
    expandIdVariants('tx-1', OWNER).sort(),
    ['tx-1', `${OWNER}_tx-1`].sort()
  );
  assert.deepEqual(expandIdVariants('', OWNER), []);
});

test('unionTombstones merges lists and stores both id forms', () => {
  const u = unionTombstones([`${OWNER}_tx-1`], new Set(['tx-2']), undefined);
  assert.ok(u.has(`${OWNER}_tx-1`));
  assert.ok(u.has('tx-1'));
  assert.ok(u.has('tx-2'));
  // unprefixed entries are not owner-expanded here; matching still works
  // because isTombstoned expands the candidate id in both directions.
  assert.ok(!u.has(`${OWNER}_tx-2`));
  assert.ok(isTombstoned(`${OWNER}_tx-2`, u));
});

test('isTombstoned matches either id form', () => {
  const u = unionTombstones([`${OWNER}_tx-1`]);
  assert.ok(isTombstoned('tx-1', u));
  assert.ok(isTombstoned(`${OWNER}_tx-1`, u));
  assert.ok(!isTombstoned('tx-3', u));
  assert.ok(!isTombstoned(undefined, u));
});

test('filterActiveTransactions drops tombstoned and id-less entries', () => {
  const u = unionTombstones(['tx-del']);
  const out = filterActiveTransactions(
    [{ id: 'tx-keep' }, { id: 'tx-del' }, { id: `${OWNER}_tx-del` }, { title: 'no id' } as any],
    u
  );
  assert.deepEqual(out.map((t) => t.id), ['tx-keep']);
});
