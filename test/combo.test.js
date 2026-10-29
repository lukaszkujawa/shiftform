import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { stepCombo, freshCombo, REST_FRAMES } from '../src/combo.js';

function stairs() {
  const level = createLevel(buildRules([]), [], 24);
  fillTiles(level, 0, 23, COLS, 1, SOLID);
  for (let k = 0; k < 6; k++) fillTiles(level, 4 + k * 4, 21 - k * 2, 3, 1, SOLID);
  level.start = { x: 40, y: 23 * TILE - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  return level;
}

function climb(level, s, combo, frames, input) {
  const log = [];
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const next = step(level, s, typeof input === 'function' ? input(i, s) : input);
    combo = stepCombo(level, s, next, combo);
    peak = Math.max(peak, combo.links);
    if (combo.gained) log.push({ links: combo.links, gained: combo.gained });
    s = next;
  }
  return { s, combo, log, peak };
}

test('hopping up a staircase without stopping builds a combo that pays growing points', () => {
  const level = stairs();
  const hop = i => ({ right: true, jump: i % 12 < 8 });
  const { peak, log } = climb(level, initialState(level), freshCombo(), 400, hop);
  assert.ok(peak >= 4, `${peak} links`);
  assert.deepEqual(log.slice(0, 2).map(l => l.gained), [3, 4]);
});

test('landings at or below the combo line never pay, so an easy stretch cannot be farmed', () => {
  const level = stairs();
  const up = { ...initialState(level), grounded: true };
  const land = (combo, feet) => stepCombo(level, { ...up, grounded: false }, { ...up, y: feet - 26 }, combo);
  let combo = land(freshCombo(), 690);
  combo = land(combo, 630);
  assert.deepEqual([combo.links, combo.gained, combo.floor], [2, 0, null], 'the first two links pay nothing and leave no line');
  combo = land(combo, 570);
  assert.deepEqual([combo.links, combo.gained, combo.floor], [3, 3, 570], 'the third link pays and sets the line');
  combo = land(combo, 690);
  assert.deepEqual([combo.links, combo.gained], [1, 0], 'dropping back down restarts the chain');
  combo = land(combo, 630);
  assert.deepEqual([combo.links, combo.gained, combo.floor], [1, 0, 570], 'climbing below the line pays nothing');
  combo = land(combo, 570);
  assert.deepEqual([combo.links, combo.gained], [1, 0], 'the line itself does not count');
  combo = land(combo, 510);
  assert.deepEqual([combo.links, combo.gained, combo.floor], [2, 0, 570], 'a second link above the line is not yet a combo');
  combo = land(combo, 450);
  assert.deepEqual([combo.links, combo.gained, combo.floor], [3, 3, 450], 'the third link pays again and lifts the line');
  assert.equal(freshCombo(combo.floor).floor, 450, 'breaking the chain keeps the line');
});

test('standing still, landing lower, climbing or dying breaks the chain', () => {
  const level = stairs();
  let state = { ...initialState(level), grounded: true };
  const high = { links: 4, landY: 500, rest: 0, gained: 0, floor: 500 };
  let combo = high;
  for (let i = 0; i <= REST_FRAMES; i++) { const next = step(level, state, {}); combo = stepCombo(level, state, next, combo); state = next; }
  assert.equal(combo.links, 0, 'resting too long breaks it');
  const low = stepCombo(level, { ...state, grounded: false }, { ...state, grounded: true }, high);
  assert.equal(low.links, 1, 'landing lower than the last landing restarts at one');
  assert.equal(stepCombo(level, state, { ...state, climbing: true }, high).links, 0);
  assert.equal(stepCombo(level, state, { ...state, dead: true }, high).links, 0);
});
