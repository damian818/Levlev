/**
 * Write-path bump contract: the sync fingerprint (egress gate) relies on every
 * write path either changing a row count or bumping user_settings.updated_at.
 * These tests prove that contract for the paths where it is not obvious:
 *
 * - saveAll whose settings pre-read FAILED skips the settings upsert, so it
 *   must bump updated_at with a column-scoped update (never an upsert, which
 *   would wipe the settings document).
 * - deleteCategory / deleteAccount write no settings row, so they must bump
 *   updated_at too (static source assertion, same style as other repo tests).
 * - deleteAllUserDataFromSupabase needs no bump: wiping rows changes the
 *   transaction/attachment counts the fingerprint tracks.
 *
 * Edits and delete+add pairs that leave row counts unchanged are detected via
 * updated_at alone; those scenarios live in sync-fingerprint.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// localStorage shim must exist before the module under test is exercised.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const { saveAllUserDataWithClient } = await import('../src/services/supabaseSync.ts');

type Call = { table: string; op: string; payload?: any };

function makeMockClient(opts: { failSettingsSelect?: boolean } = {}) {
  const calls: Call[] = [];
  const builderFor = (table: string): any => new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: any) => resolve({
          data: table === 'user_settings' ? null : [],
          error: table === 'user_settings' && opts.failSettingsSelect ? { message: 'simulated read failure' } : null,
          count: 0,
        });
      }
      if (prop === 'maybeSingle') {
        return async () => ({
          data: null,
          error: table === 'user_settings' && opts.failSettingsSelect ? { message: 'simulated read failure' } : null,
        });
      }
      return (...args: any[]) => {
        if (prop === 'upsert' || prop === 'update' || prop === 'delete') {
          calls.push({ table, op: prop, payload: args[0] });
        }
        return builderFor(table);
      };
    },
  });
  const client: any = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
    from: (table: string) => builderFor(table),
    rpc: async () => ({ data: null, error: null }),
  };
  return { calls, client };
}

const ONE_TX = {
  id: 'tx-1', title: 'Test', amount: 1, currency: 'ARS', type: 'EXPENSE',
  date: '2026-11-17', account: 'Visa BBVA', category: 'Transporte',
};

test('saveAll upserts user_settings with a fresh updated_at (normal path)', async () => {
  const { calls, client } = makeMockClient();
  await saveAllUserDataWithClient(client, 'user-1', {
    transactions: [ONE_TX], categories: [], accounts: [], budgets: [], settings: {},
  } as any);
  const upsert = calls.find(c => c.table === 'user_settings' && c.op === 'upsert');
  assert.ok(upsert, 'expected a user_settings upsert');
  assert.equal(typeof upsert.payload.updated_at, 'string');
  assert.ok(!Number.isNaN(Date.parse(upsert.payload.updated_at)));
});

test('saveAll bumps updated_at via column-scoped update when the settings pre-read failed', async () => {
  const { calls, client } = makeMockClient({ failSettingsSelect: true });
  await saveAllUserDataWithClient(client, 'user-1', {
    transactions: [ONE_TX], categories: [], accounts: [], budgets: [], settings: {},
  } as any);
  const update = calls.find(c => c.table === 'user_settings' && c.op === 'update');
  assert.ok(update, 'expected a user_settings update bump');
  assert.deepEqual(Object.keys(update.payload), ['updated_at'], 'bump must touch only updated_at, never the settings document');
  assert.ok(!Number.isNaN(Date.parse(update.payload.updated_at)));
  assert.ok(!calls.some(c => c.table === 'user_settings' && c.op === 'upsert'), 'must not upsert a partial settings row');
});

// Static contract for the write paths that are not injectable-client testable:
// their source must bump updated_at one way or another.
const SRC = readFileSync(new URL('../src/services/supabaseSync.ts', import.meta.url), 'utf8');

function bodyOf(fnName: string): string {
  const start = SRC.indexOf(`export async function ${fnName}`);
  assert.ok(start >= 0, `${fnName} not found in supabaseSync.ts`);
  const rest = SRC.slice(start);
  const next = rest.slice(10).search(/\nexport (async )?function /);
  return next === -1 ? rest : rest.slice(0, next + 10);
}

test('deleteCategoryFromSupabase bumps updated_at after a successful delete', () => {
  assert.match(bodyOf('deleteCategoryFromSupabase'), /touchSettingsUpdatedAt/);
});

test('deleteAccountFromSupabase bumps updated_at after a successful delete', () => {
  assert.match(bodyOf('deleteAccountFromSupabase'), /touchSettingsUpdatedAt/);
});

test('deleteTransactionFromSupabase writes a fresh updated_at to user_settings', () => {
  assert.match(bodyOf('deleteTransactionFromSupabase'), /updated_at: new Date\(\)\.toISOString\(\)/);
});

test('saveTransactionAttachmentsToSupabase writes a fresh updated_at to user_settings', () => {
  assert.match(bodyOf('saveTransactionAttachmentsToSupabase'), /updated_at: new Date\(\)\.toISOString\(\)/);
});

test('saveAllUserDataWithClient has the fallback bump for the failed pre-read case', () => {
  assert.match(bodyOf('saveAllUserDataWithClient'), /touchSettingsUpdatedAt/);
});
