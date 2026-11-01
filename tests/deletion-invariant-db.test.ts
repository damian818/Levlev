/**
 * DB-level tests for supabase/migrations/20261101_deletion_invariant.sql.
 *
 * Runs the real migration against real Postgres (PGlite, WASM) with a stubbed
 * auth schema and a non-owner role so RLS policies actually apply. Covers what
 * the logic-level tests cannot: trigger semantics on INSERT and UPDATE upsert
 * paths, the atomic delete RPC, settings-document compatibility, backfill, and
 * cross-user isolation.
 *
 * Needs the optional dev-only dependency: npm i --no-save @electric-sql/pglite
 * Skips cleanly when it is not installed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let PGlite: any;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  test('deletion-invariant DB tests skipped (install @electric-sql/pglite to run)', (t) => {
    t.skip('optional dependency @electric-sql/pglite not installed');
  });
  // eslint-disable-next-line no-throw-literal
  throw { __skip: true }; // stop evaluating the rest of the module
}

const here = dirname(fileURLToPath(import.meta.url));
const baseSchema = readFileSync(join(here, '..', 'supabase-schema.sql'), 'utf8')
  .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/, '');
const migration = readFileSync(join(here, '..', 'supabase', 'migrations', '20261101_deletion_invariant.sql'), 'utf8');

const USER_A = 'aaaaaaaa-1111-1111-1111-111111111111';
const USER_B = 'bbbbbbbb-2222-2222-2222-222222222222';

async function makeDb() {
  const db = new PGlite();
  // Minimal Supabase auth emulation: users table for the FK, auth.uid() and
  // auth.jwt() driven by request.jwt.claim.* settings (same as PostgREST).
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@test.dev'), ('${USER_B}', 'b@test.dev');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS
      $$ SELECT jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
  `);
  await db.exec(baseSchema);
  // Non-owner role so RLS applies; broad grants emulate Supabase's authenticated role.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE appuser NOLOGIN;
    GRANT authenticated TO appuser;
    GRANT USAGE ON SCHEMA public, auth TO appuser;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appuser;
    GRANT SELECT ON auth.users TO appuser;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO appuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO appuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO appuser;
  `);
  return db;
}

async function asUser(db: any, userId: string, email: string, fn: () => Promise<any>) {
  await db.exec(`SET ROLE appuser; SELECT set_config('request.jwt.claim.sub', '${userId}', false); SELECT set_config('request.jwt.claim.email', '${email}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.email', '', false);`);
  }
}

const baseTx = (id: string, userId: string) => ({
  id, user_id: userId, date: '2026-11-01', title: 'Netflix', amount: 10, currency: 'ARS',
  category: 'Facturas y tarifas', account: 'BBVA', type: 'EXPENSE',
});

async function insertTx(db: any, tx: any) {
  await db.query(
    `INSERT INTO public.transactions (id, user_id, date, title, amount, currency, category, account, type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [tx.id, tx.user_id, tx.date, tx.title, tx.amount, tx.currency, tx.category, tx.account, tx.type]
  );
}

test('delete RPC tombstones + deletes; upsert of the same id is rejected (INSERT path)', async () => {
  const db = await makeDb();
  await db.exec(migration);
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await insertTx(db, baseTx(`${USER_A}_tx-netflix`, USER_A));
    const res = await db.query(`SELECT public.delete_transactions(ARRAY['tx-netflix']) AS affected`);
    assert.equal(res.rows[0].affected, 1);
    const gone = await db.query(`SELECT count(*)::int c FROM public.transactions WHERE id = '${USER_A}_tx-netflix'`);
    assert.equal(gone.rows[0].c, 0);
    const tom = await db.query(`SELECT id FROM public.deleted_transactions ORDER BY id`);
    assert.deepEqual(tom.rows.map((r: any) => r.id).sort(), [`${USER_A}_tx-netflix`, 'tx-netflix'].sort());
    // Resurrection attempt with the stored (prefixed) id form -> rejected
    await assert.rejects(
      insertTx(db, baseTx(`${USER_A}_tx-netflix`, USER_A)),
      /tombstoned/
    );
    // Resurrection attempt with the clean id form -> also rejected
    await assert.rejects(
      insertTx(db, baseTx('tx-netflix', USER_A)),
      /tombstoned/
    );
  });
  await db.close();
});

test('rejects the UPDATE path of an upsert on a live row whose id was tombstoned elsewhere', async () => {
  const db = await makeDb();
  await db.exec(migration);
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await insertTx(db, baseTx(`${USER_A}_tx-live`, USER_A)); // row stays alive
    // Another device records the tombstone through the settings document (old client)
    await db.query(
      `INSERT INTO public.user_settings (id, user_id, settings) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings`,
      [`${USER_A}_settings`, USER_A, JSON.stringify({ deletedTxIds: ['tx-live'] })]
    );
    // compat trigger copied it into deleted_transactions
    const tom = await db.query(`SELECT id FROM public.deleted_transactions WHERE id = 'tx-live'`);
    assert.equal(tom.rows.length, 1);
    // Stale session upserts the still-locally-present row -> UPDATE path -> rejected
    await assert.rejects(
      insertTx(db, { ...baseTx(`${USER_A}_tx-live`, USER_A), title: 'Netflix edited' }),
      /tombstoned/
    );
  });
  await db.close();
});

test('stale-session race: read before delete, write after delete is rejected', async () => {
  const db = await makeDb();
  await db.exec(migration);
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await insertTx(db, baseTx(`${USER_A}_tx-race`, USER_A));
    // Session 1 "read" (holds the row locally) — nothing to do, it has the row.
    // Session 2 deletes it.
    await db.query(`SELECT public.delete_transactions(ARRAY['${USER_A}_tx-race'])`);
    // Session 1's whole-list save lands afterwards -> must be rejected by the trigger
    await assert.rejects(
      insertTx(db, baseTx(`${USER_A}_tx-race`, USER_A)),
      /tombstoned/
    );
  });
  await db.close();
});

test('cross-user isolation: another user cannot delete or blanket-tombstone my rows', async () => {
  const db = await makeDb();
  await db.exec(migration);
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await insertTx(db, baseTx(`${USER_A}_tx-mine`, USER_A));
  });
  await asUser(db, USER_B, 'b@test.dev', async () => {
    // B cannot even see A's row (RLS)
    const seen = await db.query(`SELECT count(*)::int c FROM public.transactions WHERE id = '${USER_A}_tx-mine'`);
    assert.equal(seen.rows[0].c, 0);
    // RPC deletes nothing and refuses to tombstone A's prefixed namespace
    const res = await db.query(`SELECT public.delete_transactions(ARRAY['${USER_A}_tx-mine']) AS affected`);
    assert.equal(res.rows[0].affected, 0);
    const tom = await db.query(`SELECT count(*)::int c FROM public.deleted_transactions`);
    assert.equal(tom.rows[0].c, 0); // B sees only own rows; and none were created
    // Direct insert with someone else's user_id is blocked by WITH CHECK
    await assert.rejects(
      db.query(`INSERT INTO public.deleted_transactions (id, user_id) VALUES ('x', '${USER_A}')`),
      /row-level security|row violates/i
    );
  });
  // A's row survives and A can still write it (no stray tombstone)
  await asUser(db, USER_A, 'a@test.dev', async () => {
    const alive = await db.query(`SELECT count(*)::int c FROM public.transactions WHERE id = '${USER_A}_tx-mine'`);
    assert.equal(alive.rows[0].c, 1);
    await insertTx(db, { ...baseTx(`${USER_A}_tx-mine`, USER_A), title: 'Still mine' });
  });
  await db.close();
});

test('backfill: existing settings deletedTxIds land in deleted_transactions at migration time', async () => {
  const db = await makeDb();
  // Pre-migration state: tombstones only inside the settings document
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await db.query(
      `INSERT INTO public.user_settings (id, user_id, settings) VALUES ($1, $2, $3::jsonb)`,
      [`${USER_A}_settings`, USER_A, JSON.stringify({ deletedTxIds: [`${USER_A}_tx-old`, 'tx-clean'] })]
    );
  });
  await db.exec(migration);
  const tom = await db.query(`SELECT id FROM public.deleted_transactions ORDER BY id`);
  assert.deepEqual(tom.rows.map((r: any) => r.id), [`${USER_A}_tx-old`, 'tx-clean']);
  // And the invariant now covers them
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await assert.rejects(
      insertTx(db, baseTx(`${USER_A}_tx-old`, USER_A)),
      /tombstoned/
    );
  });
  await db.close();
});

test('re-adding with a fresh id keeps working (normal app flow unaffected)', async () => {
  const db = await makeDb();
  await db.exec(migration);
  await asUser(db, USER_A, 'a@test.dev', async () => {
    await db.query(`SELECT public.delete_transactions(ARRAY['tx-gone'])`);
    await insertTx(db, baseTx(`${USER_A}_tx-new`, USER_A)); // new id, no tombstone
    const c = await db.query(`SELECT count(*)::int c FROM public.transactions`);
    assert.equal(c.rows[0].c, 1);
  });
  await db.close();
});
