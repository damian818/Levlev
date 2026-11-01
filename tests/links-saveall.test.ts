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


const A = `${OWNER}_tx-a`, B = `${OWNER}_tx-b`, C = `${OWNER}_tx-c`;
const mk = (id: string, extra: any = {}) => ({ id, title: 'Punny', amount: 100, date: '2026-10-30', account: 'Main', type: 'EXPENSE', currency: 'ARS', ...extra });

beforeEach(() => store.clear());

test('L1 links made on device A survive a save from a stale device B that never saw them', async () => {
  const server: Server = { transactions: new Map(), settings: {} };
  const mock = makeMockClient(server);
  await saveAllUserDataWithClient(mock, OWNER, { transactions: [mk(A, { linkId: 'g', linkRole: 'COMPRA', linkAt: 200 }), mk(B, { linkId: 'g', linkRole: 'REINTEGRO', linkAt: 200 }), mk(C)], settings: {} }, { skipEnqueue: true });
  assert.equal(server.settings.txLinks['tx-a'].g, 'g');
  // stale device: same movements, no link info at all
  await saveAllUserDataWithClient(mock, OWNER, { transactions: [mk(A), mk(B), mk(C)], settings: {} }, { skipEnqueue: true });
  assert.equal(server.settings.txLinks['tx-a'].g, 'g');
  assert.equal(server.settings.txLinks['tx-b'].r, 'REINTEGRO');
});

test('L2 stale device with an OLDER link state cannot overwrite a newer unlink', async () => {
  const server: Server = { transactions: new Map(), settings: { txLinks: { 'tx-a': { g: null, at: 500 }, 'tx-b': { g: null, at: 500 } } } };
  const mock = makeMockClient(server);
  await saveAllUserDataWithClient(mock, OWNER, { transactions: [mk(A, { linkId: 'g', linkRole: 'COMPRA', linkAt: 100 }), mk(B, { linkId: 'g', linkRole: 'REINTEGRO', linkAt: 100 })], settings: {} }, { skipEnqueue: true });
  assert.equal(server.settings.txLinks['tx-a'].g, null);
  assert.equal(server.settings.txLinks['tx-b'].g, null);
});

test('L3 a newer local link change wins; deleted movements drop out; tombstones untouched', async () => {
  const server: Server = { transactions: new Map(), settings: { deletedTxIds: [C], txLinks: { 'tx-a': { g: 'old', r: 'OTRO', at: 100 }, 'tx-c': { g: 'old', at: 100 } } } };
  const mock = makeMockClient(server);
  await saveAllUserDataWithClient(mock, OWNER, { transactions: [mk(A, { linkId: 'new', linkRole: 'COMPRA', linkAt: 900 }), mk(B, { linkId: 'new', linkRole: 'PROPINA', linkAt: 900 })], settings: {} }, { skipEnqueue: true });
  assert.equal(server.settings.txLinks['tx-a'].g, 'new');
  assert.equal(server.settings.txLinks['tx-c'], undefined);
  assert.ok(server.settings.deletedTxIds.includes(C));
});

test('L4 settings unreadable this round: no settings upload, so links are never blindly overwritten', async () => {
  const server: Server = { transactions: new Map(), settings: { txLinks: { 'tx-a': { g: 'g', at: 1 } } } };
  const mock = makeMockClient(server, { failSettingsRead: true });
  await saveAllUserDataWithClient(mock, OWNER, { transactions: [mk(A)], settings: {} }, { skipEnqueue: true });
  assert.equal(server.settings.txLinks['tx-a'].g, 'g');
});
