import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, objectRect, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, shoot } from '../src/physics.js';

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

const clockRect = (level, o, clock) => objectRect(o, clock);

test('a hopper leaps between the ends of its platform', () => {
  const level = flatLevel();
  const hopper = monster(level, 120, { kind: 'hopper', motion: 'hop', dx: 90, dy: 0, lift: 60, period: 200, phase: 0 });
  const ys = Array.from({ length: 100 }, (_, c) => clockRect(level, hopper, c).y);
  assert.ok(Math.min(...ys) < hopper.y - 50 && Math.max(...ys) === hopper.y);
  assert.ok(Math.abs(clockRect(level, hopper, 100).x - (hopper.x + 90)) < 1);
  assert.ok(Math.abs(clockRect(level, hopper, 200).x - hopper.x) < 1);
});

test('a spider hangs under a platform and drops on its thread', () => {
  const level = flatLevel();
  const spider = monster(level, 120, { kind: 'spider', motion: 'drop', dx: 0, dy: 60, period: 200, phase: 0, y: 200 });
  assert.equal(clockRect(level, spider, 0).y, 200);
  assert.equal(clockRect(level, spider, 60).y, 260);
  assert.ok(clockRect(level, spider, 150).y > 200 && clockRect(level, spider, 150).y < 260);
});

test('an urchin cannot be squashed, only shot', () => {
  const level = flatLevel();
  const urchin = monster(level, 150, { kind: 'urchin', motion: 'orbit', dx: 0, dy: 0, period: 100, phase: 0 });
  const above = run(level, {}, 60, { ...initialState(level), x: urchin.x, y: urchin.y - 80 });
  assert.equal(above.dead, true);
  const archer = { ...initialState(level), arrows: 5, facing: 1 };
  const s = run(level, {}, 20, shoot(level, archer));
  assert.equal(s.arrows, 4);
  assert.ok(s.slain & (1 << urchin.slot));
  assert.equal(s.dead, false);
});

test('arrows fly the way you face, stop at walls and run out of range', () => {
  const level = flatLevel();
  const far = monster(level, 30 + 20 * TILE);
  fillTiles(level, 8, 10, 1, 3, SOLID);
  const near = monster(level, 300);
  const archer = { ...initialState(level), arrows: 1, facing: 1 };
  let s = shoot(level, archer);
  assert.equal(shoot(level, s), null);
  s = run(level, {}, 60, s);
  assert.equal(s.flying.length, 0);
  assert.ok(!(s.slain & (1 << near.slot)), 'the wall stops the arrow');
  const open = flatLevel();
  const target = monster(open, 30 + 20 * TILE);
  const miss = run(open, {}, 80, shoot(open, { ...initialState(open), arrows: 1, facing: 1 }));
  assert.ok(!(miss.slain & (1 << target.slot)), 'out of range');
  assert.equal(miss.flying.length, 0);
  assert.ok(far);
});
