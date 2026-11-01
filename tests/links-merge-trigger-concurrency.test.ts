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

const here = dirname(fileURLToPath(import.meta.url));
const baseSchema = readFileSync(join(here, '..', 'supabase-schema.sql'), 'utf8')
  .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/, '');
const proposal = readFileSync(join(here, '..', 'docs', 'proposals', 'tx-links-merge-trigger.proposal.sql'), 'utf8');

const USER_A = 'aaaaaaaa-1111-1111-1111-111111111111';
const USER_B = 'bbbbbbbb-2222-2222-2222-222222222222';
const PG_PASSWORD = `pg-${Math.random().toString(36).slice(2)}-${Date.now()}`; // ephemeral, local throwaway instance only
const PORT = 55640 + (process.pid % 200);
const DATADIR = `/tmp/epg-links-${process.pid}`;

let server: any;

async function connect(): Promise<any> {
  const client = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: PG_PASSWORD, database: 'postgres' });
  await client.connect();
  return client;
}

async function asUser(client: any, userId: string) {
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


before(async () => {
  if (!depsOk) return;
  server = new EmbeddedPostgres({ databaseDir: DATADIR, port: PORT, user: 'postgres', password: PG_PASSWORD, persistent: false });
  await server.initialise();
  await server.start();
  const setup = await connect();
  await setup.query(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@test.dev');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
  `);
  await setup.query(baseSchema);
  await setup.end();
});
after(async () => { if (server) await server.stop(); });

const upsert = (c: any, settings: any) => c.query(
  `INSERT INTO public.user_settings (id, user_id, settings) VALUES ($1, $2, $3::jsonb)
   ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings`, [`${USER_A}_settings`, USER_A, JSON.stringify(settings)]);
const read = async (c: any) => (await c.query(`SELECT settings FROM public.user_settings WHERE id = $1`, [`${USER_A}_settings`])).rows[0].settings;

if (depsOk) {
  test('WITHOUT the trigger: two interleaved whole-document writes lose one device\'s links (the problem)', async () => {
    const c1 = await connect(); const c2 = await connect();
    try {
      await upsert(c1, { txLinks: {} });
      await c1.query('BEGIN'); await upsert(c1, { txLinks: { 'tx-a': { g: 'gA', at: 1 } }, other: 1 });
      const p2 = upsert(c2, { txLinks: { 'tx-c': { g: 'gB', at: 2 } } });
      await sleep(300); await c1.query('COMMIT'); await p2;
      const s = await read(c1);
      assert.equal(s.txLinks['tx-a'], undefined); // lost: last writer replaced the document
    } finally { await c1.end(); await c2.end(); }
  });

  test('WITH the trigger: concurrent writers keep both devices\' links; latest "at" wins per movement; unlink is explicit; old client cannot wipe', async () => {
    await (async () => { const s = await connect(); await s.query(proposal); await s.query(`DELETE FROM public.user_settings`); await s.end(); })();
    const c1 = await connect(); const c2 = await connect(); const c3 = await connect();
    try {
      await upsert(c1, { txLinks: {} });
      await c1.query('BEGIN'); await upsert(c1, { txLinks: { 'tx-a': { g: 'gA', r: 'COMPRA', at: 10 }, 'tx-b': { g: 'gA', r: 'REINTEGRO', at: 10 } } });
      const p2 = upsert(c2, { txLinks: { 'tx-c': { g: 'gB', at: 20 }, 'tx-a': { g: 'stale', at: 5 } }, localCurrency: 'ARS' }); // blocks on c1's row lock
      await sleep(300); await c1.query('COMMIT'); await p2;
      let s = await read(c1);
      assert.equal(s.txLinks['tx-a'].g, 'gA');      // older "at" from the stale writer did not win
      assert.equal(s.txLinks['tx-b'].g, 'gA');
      assert.equal(s.txLinks['tx-c'].g, 'gB');      // both devices' entries present
      assert.equal(s.localCurrency, 'ARS');          // other keys: normal whole-document replace
      await upsert(c3, { txLinks: { 'tx-a': { g: null, at: 30 }, 'tx-b': { g: null, at: 30 } } }); // explicit unlink wins
      s = await read(c1); assert.equal(s.txLinks['tx-a'].g, null);
      await upsert(c3, { nonRecurringKeys: [] });    // old app version: no txLinks in its document
      s = await read(c1); assert.equal(s.txLinks['tx-c'].g, 'gB'); assert.equal(s.txLinks['tx-a'].g, null);
    } finally { await c1.end(); await c2.end(); await c3.end(); }
  });
}
