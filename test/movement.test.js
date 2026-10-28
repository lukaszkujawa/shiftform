import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

const FLOOR = 13 * TILE;

function shaft() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 10, 0, 1, 13, SOLID);
  fillTiles(level, 14, 0, 1, 13, SOLID);
  level.start = { x: 11 * TILE + 2, y: 6 * TILE };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('legs against a wall in mid-air kick off it with jump', () => {
  const level = shaft();
  let s = run(level, { left: true }, 4);
  assert.equal(s.grounded, false);
  const kicked = step(level, s, { jump: true });
  assert.ok(kicked.vx > 0, 'pushed away from the left wall');
  assert.ok(kicked.vy < -5, 'launched upward');
  assert.equal(kicked.lastKick, -1);
});

test('the next kick must come off the other wall', () => {
  const level = shaft();
  let s = run(level, { left: true }, 4);
  s = step(level, s, { jump: true });
  s = run(level, { left: true }, 12, s);
  const again = step(level, step(level, s, { left: true }), { left: true, jump: true });
  assert.ok(again.vx <= 0, 'no second kick off the same wall');
  let across = s;
  for (let i = 0; i < 30 && across.x + 20 < 14 * TILE - 1; i++) across = step(level, across, { right: true });
  const other = step(level, across, { right: true, jump: true });
  assert.ok(other.vx < 0 && other.vy < -5, 'kick off the opposite wall');
});

test('landing just short of a ledge top pops the player onto it', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 12, 10, 4, 3, SOLID);
  level.start = { x: 12 * TILE - 22, y: 10 * TILE - 26 + 6 };
  const s = run(level, { right: true }, 12, { ...initialState(level), vy: -1 });
  assert.equal(s.y + 26, 10 * TILE, 'standing on the ledge');
});

test('clipping a corner with the head slides past it', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 0, 9, 10, 1, SOLID);
  level.start = { x: 10 * TILE - 4, y: FLOOR - 26 };
  let s = initialState(level), top = Infinity;
  for (let i = 0; i < 40; i++) { s = step(level, s, { jump: i >= 3 && i < 30 }); top = Math.min(top, s.y); }
  assert.ok(top < 9 * TILE, 'rose past the platform edge');
});

test('glass bones survives a jump and kick but not a long fall', () => {
  const level = createLevel(buildRules(['glass']), ['glass']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 0, 0, 10, 13, SOLID);
  level.start = { x: 300, y: FLOOR - 26 };
  const presses = [[0, 4], [12, 16], [24, 28]];
  const s = run(level, i => ({ left: true, jump: presses.some(([a, b]) => i >= a && i < b) }), 120, run(level, { left: true }, 10));
  assert.equal(s.dead, false);
  assert.equal(s.grounded, true);
  level.start = { x: 400, y: FLOOR - 26 - 6 * TILE };
  assert.equal(run(level, {}, 120).dead, true);
});

function ladderLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 6, 6, 5, 1, SOLID);
  addObject(level, { type: 'climb', x: 5 * TILE + 5, y: 6 * TILE, w: 20, h: 7 * TILE });
  level.start = { x: 5 * TILE + 5, y: FLOOR - 26 };
  return level;
}

const UP = { up: true, jump: true };

test('holding up on a ladder climbs it instead of jumping, and the top steps onto the platform', () => {
  const level = ladderLevel();
  const grabbed = step(level, initialState(level), UP);
  assert.equal(grabbed.climbing, true);
  assert.ok(grabbed.vy < 0 && grabbed.vy > -4, 'climbs, does not jump');
  const top = run(level, UP, 90, grabbed);
  assert.ok(top.climbing && Math.abs(top.y + 26 - 6 * TILE) <= 3, 'stops with feet at the platform');
  const off = run(level, { right: true }, 20, top);
  assert.ok(off.grounded && off.y + 26 === 6 * TILE && off.x > 6 * TILE, 'walks onto the platform');
});

test('jump leaps off a ladder, down climbs down, and walking past does not grab', () => {
  const level = ladderLevel();
  const mid = run(level, UP, 30);
  const leap = step(level, step(level, mid, {}), { jump: true, right: true });
  assert.equal(leap.climbing, false);
  assert.ok(leap.vy < -5, 'jumps off');
  const down = run(level, { down: true }, 20, step(level, mid, {}));
  assert.ok(down.climbing && down.y > mid.y, 'climbs down');
  const past = run(level, { right: true }, 20);
  assert.equal(past.climbing, false);
});
