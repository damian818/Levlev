/**
 * Unit tests for the repeat-pull merge skip: when a pull is triggered by
 * another device's fingerprint bump but the downloaded payload is identical
 * to the one already applied, the merge must be skipped so no state reference
 * changes (otherwise the autosave fires, bumps user_settings.updated_at and
 * the pull -> autosave -> bump -> pull loop repeats).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { isRepeatPulledPayload, rememberPulledPayloadKey, resetPulledPayloadKeyForTests } =
  await import('../src/services/supabaseSync.ts');

beforeEach(() => resetPulledPayloadKeyForTests());

test('first payload is never a repeat', () => {
  assert.equal(isRepeatPulledPayload('{"a":1}'), false);
});

test('null payload key is never a repeat (stringify failure must merge)', () => {
  rememberPulledPayloadKey('{"a":1}');
  assert.equal(isRepeatPulledPayload(null), false);
});

test('same payload key after remembering is a repeat', () => {
  const key = JSON.stringify({ transactions: [{ id: 't1', amount: 100 }], settings: { localCurrency: 'ARS' } });
  rememberPulledPayloadKey(key);
  assert.equal(isRepeatPulledPayload(key), true);
});

test('changed payload key is not a repeat, and remembering it moves the baseline', () => {
  const k1 = JSON.stringify({ transactions: [{ id: 't1', amount: 100 }] });
  const k2 = JSON.stringify({ transactions: [{ id: 't1', amount: 100 }, { id: 't2', amount: 50 }] });
  rememberPulledPayloadKey(k1);
  assert.equal(isRepeatPulledPayload(k2), false);
  rememberPulledPayloadKey(k2);
  assert.equal(isRepeatPulledPayload(k2), true);
  assert.equal(isRepeatPulledPayload(k1), false);
});

test('loop scenario: pull -> identical pull -> identical pull skips twice', () => {
  const key = JSON.stringify({ transactions: [{ id: 't1' }], settings: { hiddenCategoryIds: [] } });
  rememberPulledPayloadKey(key);
  // Each identical pull must report repeat so the caller skips the merge and
  // no autosave/bump/pull cycle starts.
  assert.equal(isRepeatPulledPayload(key), true);
  assert.equal(isRepeatPulledPayload(key), true);
});

test('reset clears the remembered key', () => {
  rememberPulledPayloadKey('{"a":1}');
  resetPulledPayloadKeyForTests();
  assert.equal(isRepeatPulledPayload('{"a":1}'), false);
});
