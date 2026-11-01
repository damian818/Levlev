/**
 * Runs the REAL saveAllUserDataWithClient (the production orchestration, not a
 * port) against a mock Supabase client. Proves the client-side invariant of the
 * patched flow. Still logic-level: no real SQL/RLS/concurrency — true races are
 * covered by docs/proposals/deletion-invariant-server-side.proposal.sql.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage shim must exist before the module under test is exercised.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const { saveAllUserDataWithClient } = await import('../src/services/supabaseSync.ts');

const OWNER = '5dc632bf-bbc6-491c-8ee9-2ab94e51a495';
const NF = 'tx-1793347278905-zt6garw';
const NF_FULL = `${OWNER}_${NF}`;
const OTHER = `${OWNER}_tx-otro`;

type Server = { transactions: Map<string, any>; settings: Record<string, any> };

function makeMockClient(server: Server, opts: { failSettingsRead?: boolean } = {}) {
  const calls: Array<{ table: string; op: string; rows?: any; ids?: string[] }> = [];
  const builderFor = (table: string): any => {
    const b: any = {
      select: (_cols?: string) => b,
      eq: (_c: string, _v: any) => b,
      maybeSingle: async () => {
        if (opts.failSettingsRead) return { data: null, error: { message: 'simulated read failure' } };
        return { data: table === 'user_settings' ? { settings: server.settings } : null, error: null };
      },
      upsert: async (rows: any) => {
        calls.push({ table, op: 'upsert', rows });
        const list = Array.isArray(rows) ? rows : [rows];
        if (table === 'transactions') list.forEach((r) => server.transactions.set(r.id, r));
        if (table === 'user_settings') server.settings = rows.settings;
        return { error: null };
      },
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          calls.push({ table, op: 'deleteIn', ids });
          if (table === 'transactions') ids.forEach((id) => server.transactions.delete(id));
          return { error: null };
        },
        eq: async () => ({ error: null }),
      }),
    };
    return b;
  };
  return { from: builderFor, calls } as any;
}

function staleSessionData(): any {
  // A session whose state predates the delete: still holds Netflix locally,
  // knows nothing about the tombstone.
  return {
    transactions: [
      { id: NF_FULL, title: 'Netflix', amount: 19999, date: '2026-10-30', account: 'Main' },
      { id: OTHER, title: 'Otro', amount: 100, date: '2026-10-30', account: 'Main' },
    ],
    settings: {},
  };
}

beforeEach(() => store.clear());

test('R1 real saveAll: stale session saving after another device deleted re-creates nothing and keeps the cloud tombstone', async () => {
  const server: Server = {
    transactions: new Map([[OTHER, { id: OTHER }]]), // Netflix row already deleted on the server
    settings: { deletedTxIds: [NF_FULL] },             // cloud tombstone written by the deleter
  };
  const mock = makeMockClient(server);

  const ok = await saveAllUserDataWithClient(mock, OWNER, staleSessionData(), { skipEnqueue: true });
  assert.equal(ok, true);

  const upsertedTxIds = mock.calls
    .filter((c: any) => c.table === 'transactions' && c.op === 'upsert')
    .flatMap((c: any) => c.rows.map((r: any) => r.id));
  assert.ok(!upsertedTxIds.some((id: string) => id.includes('1793347278905')), `Netflix must not be re-upserted, got: ${upsertedTxIds}`);
  assert.ok(!server.transactions.has(NF_FULL), 'row must stay deleted');
  assert.ok(!server.transactions.has(NF), 'row must stay deleted (clean form)');
  assert.ok(
    (server.settings.deletedTxIds || []).some((id: string) => id.includes('1793347278905')),
    'cloud tombstone must survive the stale save'
  );
});

test('R2 real saveAll: normal save still uploads transactions and settings', async () => {
  const server: Server = { transactions: new Map(), settings: {} };
  const mock = makeMockClient(server);
  const ok = await saveAllUserDataWithClient(mock, OWNER, staleSessionData(), { skipEnqueue: true });
  assert.equal(ok, true);
  assert.ok(server.transactions.has(NF_FULL), 'no tombstone anywhere -> Netflix syncs normally');
  assert.ok(server.transactions.has(OTHER));
  assert.ok(Array.isArray(server.settings.deletedTxIds));
});

test('R3 real saveAll: failed cloud read skips the settings write instead of overwriting it blindly', async () => {
  const server: Server = {
    transactions: new Map([[OTHER, { id: OTHER }]]),
    settings: { deletedTxIds: [NF_FULL], otherKey: 'keep-me' },
  };
  const mock = makeMockClient(server, { failSettingsRead: true });
  const ok = await saveAllUserDataWithClient(mock, OWNER, staleSessionData(), { skipEnqueue: true });
  assert.equal(ok, true);
  assert.deepEqual(server.settings, { deletedTxIds: [NF_FULL], otherKey: 'keep-me' }, 'settings document must remain untouched');
});

test('R4 real saveAll: purge runs against the union (cloud tombstones included)', async () => {
  const server: Server = {
    transactions: new Map([[OTHER, { id: OTHER }], ['tx-huerfana', { id: 'tx-huerfana' }]]),
    settings: { deletedTxIds: ['tx-huerfana'] }, // tombstoned in cloud, still present as a row
  };
  const mock = makeMockClient(server);
  const ok = await saveAllUserDataWithClient(mock, OWNER, staleSessionData(), { skipEnqueue: true });
  assert.equal(ok, true);
  assert.ok(!server.transactions.has('tx-huerfana'), 'cloud-tombstoned orphan row must be purged');
});
