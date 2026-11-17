/**
 * Unit tests for fetchSyncFingerprintWithClient: the cheap "did the cloud
 * change?" probe that gates the multi-MB full pull (Supabase free-plan egress
 * fix). Mock client mirrors supabase-js: query builders are thenable and
 * user_settings goes through .eq().maybeSingle().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fetchSyncFingerprintWithClient, SYNC_FINGERPRINT_KEY } = await import('../src/services/supabaseSync.ts');

type ProbeState = {
  updatedAt?: string;
  txCount?: number;
  delCount?: number;
  attCount?: number;
  failTables?: Set<string>;
};

function makeMockClient(state: ProbeState, opts: { session?: boolean } = {}) {
  const builderFor = (table: string): any => {
    const fail = state.failTables?.has(table) ? { message: `simulated ${table} failure` } : null;
    const result: any = {
      data: table === 'user_settings' && !fail ? { updated_at: state.updatedAt } : null,
      count: table === 'transactions' ? state.txCount
        : table === 'deleted_transactions' ? state.delCount
        : table === 'transaction_attachments' ? state.attCount
        : null,
      error: fail,
    };
    const b: any = {
      select: (_cols?: string, _opts?: any) => b,
      eq: (_c: string, _v: any) => b,
      maybeSingle: async () => result,
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return b;
  };
  return {
    auth: {
      getSession: async () => ({
        data: { session: opts.session === false ? null : { user: { id: 'user-1' } } },
      }),
    },
    from: (table: string) => builderFor(table),
  } as any;
}

test('fingerprint is stable when nothing changed', async () => {
  const client = makeMockClient({ updatedAt: '2026-11-17T10:00:00Z', txCount: 100, delCount: 5, attCount: 3 });
  const fp1 = await fetchSyncFingerprintWithClient(client);
  const fp2 = await fetchSyncFingerprintWithClient(client);
  assert.ok(fp1);
  assert.equal(fp1, fp2);
});

test('fingerprint changes when user_settings.updated_at changes', async () => {
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient({ updatedAt: '2026-11-17T10:00:00Z', txCount: 100, delCount: 5, attCount: 3 }));
  const fp2 = await fetchSyncFingerprintWithClient(makeMockClient({ updatedAt: '2026-11-17T10:01:00Z', txCount: 100, delCount: 5, attCount: 3 }));
  assert.notEqual(fp1, fp2);
});

test('fingerprint changes when a transaction is added or deleted', async () => {
  const base = { updatedAt: '2026-11-17T10:00:00Z', txCount: 100, delCount: 5, attCount: 3 };
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient(base));
  assert.notEqual(fp1, await fetchSyncFingerprintWithClient(makeMockClient({ ...base, txCount: 101 })));
  assert.notEqual(fp1, await fetchSyncFingerprintWithClient(makeMockClient({ ...base, txCount: 99, delCount: 6 })));
});

test('fingerprint changes when an attachment is added or removed', async () => {
  const base = { updatedAt: '2026-11-17T10:00:00Z', txCount: 100, delCount: 5, attCount: 3 };
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient(base));
  assert.notEqual(fp1, await fetchSyncFingerprintWithClient(makeMockClient({ ...base, attCount: 4 })));
});

test('edit in place (counts unchanged) is still detected via updated_at', async () => {
  // A recategorization or title fix changes no row counts: only the settings
  // bump reveals it.
  const base = { txCount: 100, delCount: 5, attCount: 3 };
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient({ ...base, updatedAt: '2026-11-17T10:00:00Z' }));
  const fp2 = await fetchSyncFingerprintWithClient(makeMockClient({ ...base, updatedAt: '2026-11-17T10:05:00Z' }));
  assert.notEqual(fp1, fp2);
});

test('delete + add leaving the count unchanged is still detected via updated_at', async () => {
  const base = { txCount: 100, delCount: 6, attCount: 3 };
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient({ ...base, updatedAt: '2026-11-17T10:00:00Z' }));
  const fp2 = await fetchSyncFingerprintWithClient(makeMockClient({ ...base, updatedAt: '2026-11-17T10:06:00Z' }));
  assert.notEqual(fp1, fp2);
});

test('returns null when there is no session (caller falls back to full pull)', async () => {
  const client = makeMockClient({ updatedAt: '2026-11-17T10:00:00Z' }, { session: false });
  assert.equal(await fetchSyncFingerprintWithClient(client), null);
});

test('returns null when every probe fails (caller falls back to full pull)', async () => {
  const client = makeMockClient({
    failTables: new Set(['user_settings', 'transactions', 'deleted_transactions', 'transaction_attachments']),
  });
  assert.equal(await fetchSyncFingerprintWithClient(client), null);
});

test('a single failing probe degrades to a constant instead of failing the fingerprint', async () => {
  const base = { updatedAt: '2026-11-17T10:00:00Z', txCount: 100, delCount: 5, attCount: 3, failTables: new Set(['transaction_attachments']) };
  const fp1 = await fetchSyncFingerprintWithClient(makeMockClient(base));
  assert.ok(fp1);
  // The working probes still detect changes.
  const fp2 = await fetchSyncFingerprintWithClient(makeMockClient({ ...base, txCount: 101 }));
  assert.notEqual(fp1, fp2);
});

test('exports the localStorage key used by the gate', () => {
  assert.equal(typeof SYNC_FINGERPRINT_KEY, 'string');
  assert.ok(SYNC_FINGERPRINT_KEY.length > 0);
});
