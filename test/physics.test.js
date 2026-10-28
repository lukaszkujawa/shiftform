import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, ROWS, COLS, addObject } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

function flatLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: 13 * TILE - 26 };
  return level;
}

function run(level, inputs, frames) {
  let s = initialState(level);
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('player lands on the floor and stays grounded', () => {
  const s = run(flatLevel(), {}, 30);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 13 * TILE - 26);
});

test('holding right walks the player right without passing walls', () => {
  const s = run(flatLevel(), { right: true }, 400);
  assert.equal(s.x, COLS * TILE - 20);
});

test('jump rises then returns to the ground', () => {
  const level = flatLevel();
  const peak = run(level, i => ({ jump: i >= 10 && i < 30 }), 29);
  assert.ok(peak.y < 13 * TILE - 26 - 60);
  const landed = run(level, i => ({ jump: i >= 10 && i < 30 }), 120);
  assert.equal(landed.grounded, true);
});

test('step is deterministic', () => {
  const level = flatLevel(['bouncy', 'ice']);
  const a = run(level, i => ({ right: true, jump: i % 20 < 5 }), 200);
  const b = run(level, i => ({ right: true, jump: i % 20 < 5 }), 200);
  assert.deepEqual(a, b);
});

test('mirror swaps the input direction', () => {
  const s = run(flatLevel(['mirror']), { right: true }, 60);
  assert.equal(s.x, 0);
});

test('flip-on-jump sends the player to the ceiling', () => {
  const level = flatLevel(['flipjump']);
  fillTiles(level, 0, 0, COLS, 2, SOLID);
  const s = run(level, i => ({ jump: i === 12 }), 120);
  assert.equal(s.gravDir, -1);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 2 * TILE);
});

test('spikes kill and keys unlock doors', () => {
  const level = flatLevel();
  addObject(level, { type: 'key', x: 100, y: 13 * TILE - 20, w: 16, h: 18, bit: 1 });
  addObject(level, { type: 'door', x: 200, y: 10 * TILE, w: TILE, h: 3 * TILE, bit: 1 });
  const s = run(level, { right: true }, 200);
  assert.equal(s.flags, 1);
  assert.ok(s.x > 230);
  addObject(level, { type: 'spikes', x: 300, y: 13 * TILE - 14, w: 24, h: 14, dir: -1 });
  assert.equal(run(level, { right: true }, 200).dead, true);
});

test('falling off the world kills unless wrapping', () => {
  const level = createLevel(buildRules([]), []);
  level.start = { x: 30, y: 100 };
  assert.equal(run(level, {}, 200).dead, true);
  const wrap = createLevel(buildRules(['wrap']), ['wrap']);
  wrap.start = { x: 30, y: 100 };
  assert.equal(run(wrap, {}, 200).dead, false);
});

test('a quick jump tap just before landing jumps on landing', () => {
  const level = flatLevel();
  level.start = { x: 30, y: 13 * TILE - 26 - 60 };
  let s = initialState(level);
  while (!step(level, s, {}).grounded) s = step(level, s, {});
  for (let i = 0; i < 8; i++) s = step(level, s, { jump: i < 2 });
  assert.equal(s.jumpsUsed, 1);
});

test('tall levels keep physics working below the first screen', () => {
  const level = createLevel(buildRules([]), [], 72);
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  level.start = { x: 30, y: 60 * TILE };
  const s = run(level, {}, 200);
  assert.equal(s.dead, false);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 71 * TILE - 26);
});
