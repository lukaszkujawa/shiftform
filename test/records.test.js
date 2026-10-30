import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestOf, saveBest, topClimbs } from '../src/records.js';

function browserStorage(entries) {
  const store = { ...entries };
  for (const [name, fn] of Object.entries({ getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = String(value); } })) Object.defineProperty(store, name, { value: fn });
  return store;
}

test('the personal leaderboard lists your best climb on every seed, highest first, up to fifty', () => {
  globalThis.localStorage = browserStorage({ 'shiftform:best:alpha': '120', 'shiftform:best:daily-2026-10-30': '480', 'shiftform:outfit': '{}', 'shiftform:best:zero': '0' });
  saveBest('beta', 260);
  assert.equal(bestOf('beta'), 260);
  assert.deepEqual(topClimbs(), [{ seed: 'daily-2026-10-30', metres: 480 }, { seed: 'beta', metres: 260 }, { seed: 'alpha', metres: 120 }]);
  for (let i = 0; i < 80; i++) saveBest(`seed-${i}`, 1000 + i);
  const top = topClimbs();
  assert.equal(top.length, 50);
  assert.equal(top[0].metres, 1079);
  delete globalThis.localStorage;
  assert.deepEqual(topClimbs(), [], 'no storage, no list');
});
