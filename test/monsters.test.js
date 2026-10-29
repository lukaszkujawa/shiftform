import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, objectRect, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

const FLOOR = 13 * TILE;

function flatLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  return level;
}

const monster = (level, x, extra = {}) => addObject(level, { type: 'monster', kind: 'patroller', x, y: FLOOR - 20, w: 22, h: 20, ...extra });

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames && !s.dead; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('walking into a monster kills the player', () => {
  const level = flatLevel();
  monster(level, 120);
  assert.equal(run(level, { right: true }, 60).dead, true);
});

test('landing on a monster slays it and bounces the player up', () => {
  const level = flatLevel();
  const m = monster(level, 40);
  let s = { ...initialState(level), x: 41, y: FLOOR - 110 };
  for (let i = 0; i < 40 && !(s.slain & 1); i++) s = step(level, s, {});
  assert.equal(s.dead, false);
  assert.equal(s.slain, 1 << m.slot);
  assert.ok(s.vy < 0, 'bounced');
  assert.equal(run(level, { right: true }, 60, s).dead, false, 'a slain monster is harmless');
});

test('a patroller walks its platform and back on the clock', () => {
  const level = flatLevel();
  const m = monster(level, 100, { dx: 90, dy: 0, period: 180, phase: 0 });
  assert.equal(objectRect(m, 0).x, 100);
  assert.equal(objectRect(m, 90).x, 190);
  assert.equal(objectRect(m, 180).x, 100);
});

test('shots fly from their spitter, fade past their range and stop when it is slain', () => {
  const level = flatLevel();
  const spitter = monster(level, 300, { kind: 'spitter' });
  const shot = addObject(level, { type: 'shot', source: spitter.id, x: 290, y: FLOOR - 18, w: 10, h: 10, dir: -1, speed: 4, range: 200, period: 120, phase: 0 });
  assert.equal(objectRect(shot, 10).x, 250);
  assert.ok(objectRect(shot, 60).x < -500, 'spent past its range');
  const s = { ...initialState(level), x: 200, y: FLOOR - 26 };
  assert.equal(run(level, {}, 40, s).dead, true);
  assert.equal(run(level, {}, 40, { ...s, slain: 1 << spitter.slot }).dead, false);
});
