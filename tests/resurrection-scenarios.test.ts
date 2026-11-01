/**
 * Resurrection scenarios for cross-device deletion sync.
 *
 * LOGIC-LEVEL tests: the mock server emulates PostgREST upsert semantics
 * (full-document replace of user_settings.settings, upsert by id on
 * transactions). They prove the client-side invariant of the patched flow;
 * they do NOT prove real SQL/RLS/concurrent behavior. True races between the
 * settings read and write remain possible (see "known limitation" test) and
 * are the reason for supabase/migrations/20261101_proposed_deletion_invariant.sql.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unionTombstones, filterActiveTransactions } from '../src/services/tombstones.ts';

const OWNER = 'owneruuid';
const NF = 'tx-netflix';
const NF_FULL = `${OWNER}_${NF}`;

function makeSession(tombstones: string[] = [], txs: string[] = [NF_FULL, `${OWNER}_tx-otro`]) {
  return {
    localTombstones: new Set(tombstones),
    data: {
      transactions: txs.map((id) => ({ id })),
      settings: { deletedTxIds: [...tombstones] } as Record<string, any>,
    },
  };
}

function makeServer() {
  return {
    transactions: new Map<string, any>(),
    settings: {} as Record<string, any>,
  };
}

/** Ported orchestration of the PATCHED saveAllUserDataToSupabase (tombstone path). */
function patchedSaveAll(session: any, server: any) {
  // 0. read cloud tombstones first (new step)
  const remoteTombstones: string[] = Array.isArray(server.settings.deletedTxIds)
    ? server.settings.deletedTxIds
    : [];
  remoteTombstones.forEach((id) => session.localTombstones.add(id)); // mergeDeletedTxIds
  const tombstoneUnion = unionTombstones(
    session.data.settings.deletedTxIds,
    session.localTombstones,
    remoteTombstones
  );
  // 1. upsert only non-tombstoned transactions
  for (const t of filterActiveTransactions(session.data.transactions, tombstoneUnion)) {
    server.transactions.set(t.id, t);
  }
  // 5. settings written with the union
  server.settings = { ...session.data.settings, deletedTxIds: [...tombstoneUnion].slice(-1000) };
  // 6. purge tombstoned rows
  for (const id of tombstoneUnion) server.transactions.delete(id);
}

/** Ported deleteTransactionFromSupabase (unchanged path). */
function deleteTx(session: any, server: any, id: string) {
  session.localTombstones.add(id);
  session.localTombstones.add(id.includes('_') ? id.split('_').slice(1).join('_') : id);
  server.transactions.delete(id);
  server.transactions.delete(id.includes('_') ? id.split('_').slice(1).join('_') : id);
  const remote = Array.isArray(server.settings.deletedTxIds) ? server.settings.deletedTxIds : [];
  const merged = unionTombstones(remote, session.localTombstones, [id]);
  server.settings = { ...server.settings, deletedTxIds: [...merged].slice(-1000) };
}

function freshState() {
  const server = makeServer();
  server.transactions.set(NF_FULL, { id: NF_FULL, title: 'Netflix' });
  server.transactions.set(`${OWNER}_tx-otro`, { id: `${OWNER}_tx-otro` });
  const A = makeSession();
  const B = makeSession();
  return { server, A, B };
}

test('E1 fixed: stale session saving after another device deleted neither re-creates the row nor wipes the tombstone', () => {
  const { server, A, B } = freshState();
  deleteTx(A, server, NF_FULL); // A deletes with cloud tombstone write
  assert.ok(!server.transactions.has(NF_FULL));
  assert.ok(server.settings.deletedTxIds.includes(NF_FULL));
  patchedSaveAll(B, server); // B loaded before the delete, saves anyway
  assert.ok(!server.transactions.has(NF_FULL), 'row must stay deleted');
  assert.ok(server.settings.deletedTxIds.includes(NF_FULL), 'cloud tombstone must survive');
});

test('E3 fixed: replay of an offline-queued SAVE_ALL snapshot taken before the delete is harmless', () => {
  const { server, A, B } = freshState();
  const queuedSnapshot = JSON.parse(JSON.stringify(B.data)); // queued while offline, still has Netflix
  deleteTx(A, server, NF_FULL);
  const staleB = { localTombstones: B.localTombstones, data: queuedSnapshot };
  patchedSaveAll(staleB, server);
  assert.ok(!server.transactions.has(NF_FULL));
  assert.ok(server.settings.deletedTxIds.includes(NF_FULL));
});

test('E2: stale session that fetches first was already safe (regression guard)', () => {
  const { server, A, B } = freshState();
  deleteTx(A, server, NF_FULL);
  (server.settings.deletedTxIds as string[]).forEach((id) => B.localTombstones.add(id)); // fetch merge
  patchedSaveAll(B, server);
  assert.ok(!server.transactions.has(NF_FULL));
  assert.ok(server.settings.deletedTxIds.includes(NF_FULL));
});

test('known limitation: a write raced between the cloud read and the settings upsert can still be lost (needs server-side enforcement)', () => {
  const { server, A, B } = freshState();
  // B reads cloud tombstones (empty) ...
  const readSnapshot = JSON.parse(JSON.stringify(server.settings));
  // ... A deletes (row gone, cloud tombstone written) ...
  deleteTx(A, server, NF_FULL);
  // ... then B's in-flight save lands using its pre-read state:
  // read-merge-write on the client is not atomic. This test documents the gap.
  const staleUnion = unionTombstones(readSnapshot.deletedTxIds, B.localTombstones, B.data.settings.deletedTxIds);
  server.settings = { ...B.data.settings, deletedTxIds: [...staleUnion].slice(-1000) };
  for (const t of filterActiveTransactions(B.data.transactions, staleUnion)) server.transactions.set(t.id, t);
  assert.ok(server.transactions.has(NF_FULL), 'resurrection still possible under a true race');
  assert.ok(!(server.settings.deletedTxIds || []).includes(NF_FULL), 'tombstone lost under a true race');
});
