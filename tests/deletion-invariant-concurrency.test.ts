/**
 * Real-concurrency tests for supabase/migrations/20261101_deletion_invariant.sql.
 *
 * Runs the migration on a real embedded PostgreSQL server and drives TWO
 * simultaneous client connections with explicit transactions — the scenario
 * the logic-level and single-connection tests cannot reproduce: a write whose
 * statement is already in flight while a delete on another connection commits.
 *
 * Needs the optional dev-only dependencies:
 *   npm i --no-save embedded-postgres pg
 * Skips cleanly when they are not installed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let EmbeddedPostgres: any;
let pg: any;
let depsOk = true;
try {
  ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  ({ default: pg } = await import('pg'));
} catch {
  depsOk = false;
  test('deletion-invariant concurrency tests skipped (install embedded-postgres and pg to run)', (t) => {
    t.skip('optional dependencies not installed');
  });
}

// Everything below only runs when the optional deps are installed (clean skip otherwise).
if (depsOk) {

const here = dirname(fileURLToPath(import.meta.url));
const baseSchema = readFileSync(join(here, '..', 'supabase-schema.sql'), 'utf8')
  .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/, '');
const migration = readFileSync(join(here, '..', 'supabase', 'migrations', '20261101_deletion_invariant.sql'), 'utf8');

const USER_A = 'aaaaaaaa-1111-1111-1111-111111111111';
const USER_B = 'bbbbbbbb-2222-2222-2222-222222222222';
const PG_PASSWORD = `pg-${Math.random().toString(36).slice(2)}-${Date.now()}`; // ephemeral, local throwaway instance only
const PORT = 55440 + (process.pid % 200);
const DATADIR = `/tmp/epg-conc-${process.pid}`;

let server: any;

async function connect(): Promise<any> {
  const client = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: PG_PASSWORD, database: 'postgres' });
  await client.connect();
  return client;
}

async function asUser(client: any, userId: string) {
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
}

const insertSql = `INSERT INTO public.transactions (id, user_id, date, title, amount, currency, category, account, type)
  VALUES ($1, $2, '2026-11-01', 'Test', 10, 'ARS', 'General', 'BBVA', 'EXPENSE')`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = new EmbeddedPostgres({ databaseDir: DATADIR, port: PORT, user: 'postgres', password: PG_PASSWORD, persistent: false });
  await server.initialise();
  await server.start();
  const setup = await connect();
  await setup.query(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@test.dev'), ('${USER_B}', 'b@test.dev');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS
      $$ SELECT jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
  `);
  await setup.query(baseSchema);
  await setup.query(migration);
  await setup.end();
});

after(async () => {
  if (server) await server.stop();
});

test('in-flight INSERT on one connection waits for a concurrent delete commit and is then rejected', async () => {
  const writer = await connect();
  const deleter = await connect();
  await asUser(writer, USER_A);
  await asUser(deleter, USER_A);
  try {
    // Deleter starts first and holds ROW EXCLUSIVE on deleted_transactions.
    await deleter.query('BEGIN');
    await deleter.query(`SELECT public.delete_transactions(ARRAY['tx-inflight'])`);
    await sleep(150);

    // Writer's INSERT fires the reject trigger, which must BLOCK on the
    // uncommitted delete instead of checking a stale snapshot.
    const insertPromise = insertTx(writer, `${USER_A}_tx-inflight`);
    await sleep(400);
    await deleter.query('COMMIT');

    await assert.rejects(insertPromise, /tombstoned/);
    const c = await writer.query(`SELECT count(*)::int c FROM public.transactions WHERE id = '${USER_A}_tx-inflight'`);
    assert.equal(c.rows[0].c, 0);
  } finally {
    await writer.end();
    await deleter.end();
  }

  async function insertTx(client: any, id: string) {
    return client.query(insertSql, [id, USER_A]);
  }
});

test('stale-read race: session that read before the delete cannot write after it commits', async () => {
  const stale = await connect();
  const deleter = await connect();
  await asUser(stale, USER_A);
  await asUser(deleter, USER_A);
  try {
    // Stale session "read the list" (the row is not there and no tombstone exists yet)
    const before = await stale.query(`SELECT count(*)::int c FROM public.deleted_transactions WHERE id = 'tx-stale'`);
    assert.equal(before.rows[0].c, 0);
    // Other device deletes (autocommit), then the stale session's save lands
    await deleter.query(`SELECT public.delete_transactions(ARRAY['tx-stale'])`);
    await assert.rejects(
      stale.query(insertSql, [`${USER_A}_tx-stale`, USER_A]),
      /tombstoned/
    );
  } finally {
    await stale.end();
    await deleter.end();
  }
});

test('concurrent writes of different ids both succeed (no false serialization)', async () => {
  const c1 = await connect();
  const c2 = await connect();
  await asUser(c1, USER_A);
  await asUser(c2, USER_A);
  try {
    await Promise.all([
      c1.query(insertSql, [`${USER_A}_tx-par1`, USER_A]),
      c2.query(insertSql, [`${USER_A}_tx-par2`, USER_A]),
    ]);
    const c = await c1.query(`SELECT count(*)::int c FROM public.transactions WHERE id IN ('${USER_A}_tx-par1', '${USER_A}_tx-par2')`);
    assert.equal(c.rows[0].c, 2);
  } finally {
    await c1.end();
    await c2.end();
  }
});

test('a blind tombstone from another user does not block my future id', async () => {
  const other = await connect();
  const mine = await connect();
  await asUser(other, USER_B);
  await asUser(mine, USER_A);
  try {
    // B tombstones a nonexistent clean id (all it can do without knowing real ids)
    await other.query(`SELECT public.delete_transactions(ARRAY['tx-future'])`);
    // A later creates a transaction that happens to use that id: must succeed
    await mine.query(insertSql, [`${USER_A}_tx-future`, USER_A]);
    const c = await mine.query(`SELECT count(*)::int c FROM public.transactions WHERE id = '${USER_A}_tx-future'`);
    assert.equal(c.rows[0].c, 1);
  } finally {
    await other.end();
    await mine.end();
  }
});

}
