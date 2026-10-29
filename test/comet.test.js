import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, COMET_GATES, cometWindow } from '../src/physics.js';
import { enterBiome } from '../src/climb.js';

const FLOOR = 13 * TILE;

function flatLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  return level;
}

const comet = level => ({ ...initialState(level), comet: 1 });

function bounces(level, s, press, count) {
  const peaks = [];
  let top = s.y, seen = s.cometBounces, late = false;
  for (let i = 0; i < 2000 && peaks.length < count && s.comet; i++) {
    s = step(level, s, { jump: late && press(peaks.length) });
    late = false;
    top = Math.min(top, s.y);
    if (s.cometBounces > seen) { seen = s.cometBounces; peaks.push(FLOOR - 26 - top); top = s.y; late = true; }
  }
  return { s, peaks };
}

test('picking up a comet starts it', () => {
  const level = flatLevel();
  addObject(level, { type: 'item', kind: 'comet', x: 25, y: FLOOR - 30, w: 20, h: 20 });
  const s = step(level, initialState(level), {});
  assert.equal(s.comet, 1);
});

test('a comet rises through platforms and lands on top of them', () => {
  const level = flatLevel();
  fillTiles(level, 0, 11, COLS, 1, SOLID);
  let s = { ...comet(level), vy: -12 };
  for (let i = 0; i < 120; i++) s = step(level, s, {});
  assert.ok(s.y + 26 <= 11 * TILE + 0.5, `stays above the platform it rose through (${s.y})`);
  assert.ok(s.cometBounces > 0, 'bounced on top of it');
});

test('pressing jump on landing builds the combo and every perfect bounce goes higher', () => {
  const level = flatLevel();
  const { s, peaks } = bounces(level, comet(level), () => true, 4);
  assert.ok(s.comet >= 4, `combo ${s.comet}`);
  for (let k = 2; k < peaks.length; k++) assert.ok(peaks[k] > peaks[k - 1], `bounce ${k} higher (${peaks.map(Math.round)})`);
  assert.ok(cometWindow(5) < cometWindow(1), 'the window tightens as the combo grows');
});

test('the first bounce is free, a missed one burns the comet out on the next landing', () => {
  const level = flatLevel();
  let s = comet(level);
  for (let i = 0; i < 600 && s.comet; i++) s = step(level, s, {});
  assert.equal(s.comet, 0);
  assert.equal(s.cometBounces, 2, 'free first bounce, then one missed bounce');
  for (let i = 0; i < 30; i++) s = step(level, s, {});
  assert.equal(s.grounded, true);
  assert.equal(s.dead, false);
});

test('flying out of the top passes the gate and carries the comet into the next biome', () => {
  const level = flatLevel();
  let s = { ...comet(level), y: 40, vy: -14, comet: 4 };
  for (let i = 0; i < 20 && !s.won; i++) s = step(level, s, {});
  assert.equal(s.won, true);
  const next = enterBiome(level, s, flatLevel());
  assert.equal(next.comet, 4);
  assert.equal(next.cometGates, 1);
  assert.ok(next.vy < 0, 'still rising');
  const capped = enterBiome(level, { ...s, cometGates: COMET_GATES - 1 }, flatLevel());
  let t = { ...capped, y: FLOOR - 60, vy: 0 };
  for (let i = 0; i < 60; i++) t = step(flatLevel(), t, {});
  assert.equal(t.comet, 0, 'the comet ends on the first landing after its last gate');
});

test('hazards still kill a comet rider', () => {
  const level = flatLevel();
  addObject(level, { type: 'spikes', x: 0, y: FLOOR - 14, w: COLS * TILE, h: 14, dir: -1 });
  let s = { ...comet(level), y: FLOOR - 120 };
  for (let i = 0; i < 120 && !s.dead; i++) s = step(level, s, {});
  assert.equal(s.dead, true);
});

test('a miss says whether the press came too early or too late', () => {
  const level = flatLevel();
  const ride = pressAt => {
    let s = comet(level);
    for (let i = 0; i < 600 && !s.cometMissed; i++) s = step(level, s, { jump: i === pressAt });
    return s;
  };
  let second = -1;
  for (let i = 0, s = comet(level); second < 0; i++) {
    const before = s.cometBounces;
    s = step(level, s, {});
    if (s.cometBounces === 2 && before === 1) second = i;
  }
  const early = ride(second - cometWindow(1) - 4);
  assert.deepEqual([early.cometMissed, early.cometEarly], [true, true], 'pressed before the window opened');
  const late = ride(-1);
  assert.deepEqual([late.cometMissed, late.cometEarly], [true, false], 'never pressed');
});
