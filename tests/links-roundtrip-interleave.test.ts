/**
 * Isolated round trip + interleaving for txLinks, using the REAL saveAllUserDataWithClient and the REAL
 * fetchUserDataWithClient against an in-memory fake cloud (one shared "server", several device clients).
 * No Supabase, no production data.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const { saveAllUserDataWithClient, fetchUserDataWithClient } = await import('../src/services/supabaseSync.ts');

const OWNER = '5dc632bf-bbc6-491c-8ee9-2ab94e51a495';
const A = `${OWNER}_tx-a`, B = `${OWNER}_tx-b`, C = `${OWNER}_tx-c`, D = `${OWNER}_tx-d`;
const mk = (id: string, extra: any = {}) => ({ id, title: 'Punny', amount: 100, date: '2026-10-30', account: 'Main', type: 'EXPENSE', currency: 'ARS', category: 'Restaurant', ...extra });

class Cloud {
  transactions = new Map<string, any>();
  settings: any = {};
  mergeTrigger = false; // models docs/proposals/tx-links-merge-trigger.proposal.sql
  /** hooks to interleave two devices deterministically */
  hooks: { afterFirstSettingsRead?: () => Promise<void>; afterFreshRead?: () => Promise<void> } = {};
  client(name: string, opts: { hookFirstRead?: boolean; hookFreshRead?: boolean } = {}) {
    let settingsReads = 0;
    const cloud = this;
    const builder = (table: string): any => {
      let rows: any[] | null = null;
      let single = false;
      const b: any = {
        select: (_c?: string) => { if (table === 'transactions') rows = [...cloud.transactions.values()]; return b; },
        eq: () => b, order: () => b, limit: () => b,
        range: (from: number, to: number) => { rows = (rows || []).slice(from, to + 1); return b; },
        maybeSingle: async () => {
          if (table !== 'user_settings') return { data: null, error: null };
          settingsReads++;
          const snapshot = JSON.parse(JSON.stringify(cloud.settings));
          if (settingsReads === 1 && opts.hookFirstRead) await cloud.hooks.afterFirstSettingsRead?.();
          if (settingsReads === 2 && opts.hookFreshRead) await cloud.hooks.afterFreshRead?.();
          return { data: { settings: snapshot }, error: null };
        },
        upsert: async (r: any) => {
          const list = Array.isArray(r) ? r : [r];
          if (table === 'transactions') list.forEach(x => cloud.transactions.set(x.id, x));
          if (table === 'user_settings') {
            const next = JSON.parse(JSON.stringify(r.settings));
            if (cloud.mergeTrigger) { // BEFORE UPDATE trigger: per-key last-writer-wins on txLinks, even if the writer omitted them
              const cur = cloud.settings.txLinks || {}; const inc = next.txLinks || {};
              const out: any = { ...cur };
              for (const [k, v] of Object.entries<any>(inc)) if (!out[k] || v.at >= out[k].at) out[k] = v;
              if (Object.keys(out).length) next.txLinks = out;
            }
            cloud.settings = next;
          }
          return { error: null };
        },
        delete: () => ({ in: async () => ({ error: null }), eq: async () => ({ error: null }) }),
        then: (res: any) => {
          const data = table === 'transactions' ? rows : table === 'user_settings' ? null : [];
          return Promise.resolve({ data, error: null, count: table === 'transactions' ? cloud.transactions.size : null }).then(res);
        },
      };
      return b;
    };
    return {
      from: builder,
      auth: { getSession: async () => ({ data: { session: { user: { id: OWNER } } } }) },
    } as any;
  }
}
const save = (c: any, txs: any[], settings: any = {}) => saveAllUserDataWithClient(c, OWNER, { transactions: txs, settings } as any, { skipEnqueue: true });
beforeEach(() => store.clear());

test('RT1 round trip: save links on device A, fetch on device B returns linkId/role/linkAt and other fields untouched', async () => {
  const cloud = new Cloud();
  await save(cloud.client('A'), [mk(A, { linkId: 'g1', linkRole: 'COMPRA', linkAt: 10 }), mk(B, { type: 'INCOME', account: 'BBVA', linkId: 'g1', linkRole: 'REINTEGRO', linkAt: 10 }), mk(C)]);
  const got: any = await fetchUserDataWithClient(cloud.client('B'));
  const byId = Object.fromEntries(got.transactions.map((t: any) => [t.id.replace(`${OWNER}_`, ''), t]));
  assert.equal(byId['tx-a'].linkId, 'g1'); assert.equal(byId['tx-a'].linkRole, 'COMPRA'); assert.equal(byId['tx-a'].linkAt, 10);
  assert.equal(byId['tx-b'].linkRole, 'REINTEGRO'); assert.equal(byId['tx-b'].type, 'INCOME'); assert.equal(byId['tx-b'].account, 'BBVA');
  assert.equal(byId['tx-c'].linkId, undefined);
});

test('RT2 unlink round trip: explicit unlink (g:null) survives and loads as unlinked', async () => {
  const cloud = new Cloud();
  const dev = cloud.client('A');
  await save(dev, [mk(A, { linkId: 'g1', linkRole: 'COMPRA', linkAt: 10 }), mk(B, { linkId: 'g1', linkRole: 'REINTEGRO', linkAt: 10 })]);
  await save(dev, [mk(A, { linkId: null, linkAt: 20 }), mk(B, { linkId: null, linkAt: 20 })]);
  const got: any = await fetchUserDataWithClient(cloud.client('B'));
  assert.ok(got.transactions.every((t: any) => !t.linkId));
});

test('RT3 other settings keys are not dropped by a save that carries links', async () => {
  const cloud = new Cloud();
  cloud.settings = { nonRecurringKeys: ['netflix'], localCurrency: 'ARS' };
  await save(cloud.client('A'), [mk(A, { linkId: 'g', linkRole: 'COMPRA', linkAt: 1 }), mk(B, { linkId: 'g', linkRole: 'OTRO', linkAt: 1 })], { nonRecurringKeys: ['netflix'], localCurrency: 'ARS' });
  assert.deepEqual(cloud.settings.nonRecurringKeys, ['netflix']);
  assert.equal(cloud.settings.localCurrency, 'ARS');
});

test('IL1 interleave A: B saves links while A paused AFTER its first read but BEFORE the fresh read -> B links survive (fresh read before write)', async () => {
  const cloud = new Cloud();
  const devA = cloud.client('A', { hookFirstRead: true });
  const devB = cloud.client('B');
  cloud.hooks.afterFirstSettingsRead = async () => {
    cloud.hooks.afterFirstSettingsRead = undefined;
    await save(devB, [mk(C, { linkId: 'gB', linkRole: 'COMPRA', linkAt: 50 }), mk(D, { linkId: 'gB', linkRole: 'PROPINA', linkAt: 50 })]);
  };
  await save(devA, [mk(A, { linkId: 'gA', linkRole: 'COMPRA', linkAt: 40 }), mk(B, { linkId: 'gA', linkRole: 'REINTEGRO', linkAt: 40 })]);
  assert.equal(cloud.settings.txLinks['tx-a'].g, 'gA');
  assert.equal(cloud.settings.txLinks['tx-c'].g, 'gB');
  assert.equal(cloud.settings.txLinks['tx-d'].r, 'PROPINA');
});

test('IL2 KNOWN LIMIT: B writes inside the fresh-read -> write gap of A. Without server atomicity B links are dropped from the cloud until B saves again (and B heals them on its next save)', async () => {
  const cloud = new Cloud();
  const devA = cloud.client('A', { hookFreshRead: true });
  const devB = cloud.client('B');
  const bTxs = [mk(C, { linkId: 'gB', linkRole: 'COMPRA', linkAt: 50 }), mk(D, { linkId: 'gB', linkRole: 'PROPINA', linkAt: 50 })];
  cloud.hooks.afterFreshRead = async () => { cloud.hooks.afterFreshRead = undefined; await save(devB, bTxs); };
  await save(devA, [mk(A, { linkId: 'gA', linkRole: 'COMPRA', linkAt: 40 }), mk(B, { linkId: 'gA', linkRole: 'REINTEGRO', linkAt: 40 })]);
  // A's write replaced the document it had not seen: B's links are missing (the documented residual race).
  // The post-write reconcile reads fresh state, but B's entries were already overwritten, so it cannot recover them.
  assert.equal(cloud.settings.txLinks['tx-a'].g, 'gA');
  assert.equal(cloud.settings.txLinks['tx-c'], undefined, 'residual race is real: this must stay visible in the suite');
  // Heal path: B's next save re-sends its own links (device state is the source) and A's survive.
  await save(devB, bTxs);
  assert.equal(cloud.settings.txLinks['tx-c'].g, 'gB');
  assert.equal(cloud.settings.txLinks['tx-a'].g, 'gA');
});

test('IL3 with the server merge trigger installed (proposal, not applied) the same interleaving loses nothing', async () => {
  const cloud = new Cloud(); cloud.mergeTrigger = true;
  const devA = cloud.client('A', { hookFreshRead: true });
  const devB = cloud.client('B');
  const bTxs = [mk(C, { linkId: 'gB', linkRole: 'COMPRA', linkAt: 50 }), mk(D, { linkId: 'gB', linkRole: 'PROPINA', linkAt: 50 })];
  cloud.hooks.afterFreshRead = async () => { cloud.hooks.afterFreshRead = undefined; await save(devB, bTxs); };
  await save(devA, [mk(A, { linkId: 'gA', linkRole: 'COMPRA', linkAt: 40 }), mk(B, { linkId: 'gA', linkRole: 'REINTEGRO', linkAt: 40 })]);
  assert.equal(cloud.settings.txLinks['tx-a'].g, 'gA');
  assert.equal(cloud.settings.txLinks['tx-c'].g, 'gB');
});

test('IL4 pre-existing (not introduced by links): a stale device replaces the whole settings document, so OTHER keys it does not know are overwritten', async () => {
  const cloud = new Cloud();
  cloud.settings = { nonRecurringKeys: ['netflix'] };
  await save(cloud.client('A'), [mk(A)], { nonRecurringKeys: [] });
  assert.deepEqual(cloud.settings.nonRecurringKeys, []); // documented: same behaviour as before this change
});

test('IL5 rollback to the previous app version (no txLinks in its writes): without the trigger links are wiped; with the trigger they are kept', async () => {
  for (const trigger of [false, true]) {
    const cloud = new Cloud(); cloud.mergeTrigger = trigger;
    cloud.settings = { txLinks: { 'tx-a': { g: 'g', r: 'COMPRA', at: 5 } } };
    // an old-version client writes a document without txLinks (simulated by direct upsert of settings)
    await cloud.client('old').from('user_settings').upsert({ settings: { nonRecurringKeys: [] } });
    assert.equal(!!cloud.settings.txLinks, trigger);
  }
});
