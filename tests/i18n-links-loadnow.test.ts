import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// i18n.ts touches browser APIs on import; shim what it needs.
(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { resources } = await import('../src/i18n.ts');
const en: any = resources.en.translation, es: any = resources.es.translation;
const NS = ['loadnow', 'txlinks'];
const keysOf = (o: any) => Object.keys(o).sort();
const ph = (s: string) => (s.match(/{{\w+}}/g) || []).sort().join(',');

test('loadnow and txlinks: same keys in ES and EN, same placeholders, no empty or identical-by-accident ES copies of EN where they must differ', () => {
  for (const ns of NS) {
    assert.deepEqual(keysOf(es[ns]), keysOf(en[ns]), `${ns} key mismatch`);
    for (const k of keysOf(en[ns])) {
      assert.ok(en[ns][k] && es[ns][k], `${ns}.${k} empty`);
      assert.equal(ph(en[ns][k]), ph(es[ns][k]), `${ns}.${k} placeholders differ`);
    }
  }
  for (const k of ['button', 'pending_title', 'confirm', 'summary']) assert.notEqual(en.loadnow[k], es.loadnow[k]);
  for (const k of ['title', 'role_COMPRA', 'role_REINTEGRO', 'merge_title', 'link']) assert.notEqual(en.txlinks[k], es.txlinks[k]);
});

test('every t("loadnow.*"/"txlinks.*") used by the new components exists in both languages', () => {
  const files = ['LinkTransactionsModal', 'PendingRecurringLoadList', 'MonthlyHeatmap', 'TransactionsTab'].map(f => readFileSync(`src/components/${f}.tsx`, 'utf8')).join('\n');
  const used = new Set<string>();
  for (const m of files.matchAll(/t\(\s*['"`]((?:loadnow|txlinks)\.[\w$.{}]+)['"`]/g)) used.add(m[1]);
  // dynamic keys
  for (const r of ['COMPRA', 'REINTEGRO', 'PROPINA', 'OTRO']) used.add(`txlinks.role_${r}`);
  for (const h of ['account', 'type', 'both']) used.add(`txlinks.hint_${h}`);
  for (const k of used) {
    if (k.includes('${')) continue;
    const [ns, key] = k.split('.');
    assert.ok(en[ns]?.[key], `missing EN ${k}`); assert.ok(es[ns]?.[key], `missing ES ${k}`);
  }
  assert.ok(used.size > 25);
});

test('new component files have no hardcoded user-visible text outside t()', () => {
  for (const f of ['LinkTransactionsModal', 'PendingRecurringLoadList']) {
    const src = readFileSync(`src/components/${f}.tsx`, 'utf8');
    // text nodes between tags containing letters, not {expressions}
    const bad = [...src.matchAll(/>\s*([A-Za-zÁ-ú][^<>{}]*)\s*</g)].map(m => m[1].trim()).filter(x => x && !/[;=()]/.test(x));
    assert.deepEqual(bad, [], `${f} hardcoded text: ${bad.join(' | ')}`);
    assert.ok(!/(placeholder|title|aria-label)="[A-Za-zÁ-ú]/.test(src), `${f} hardcoded attribute text`);
  }
});
