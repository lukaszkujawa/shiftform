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
  const stillHoldingUp = run(level, { right: true, up: true }, 20, top);
  assert.ok(stillHoldingUp.grounded && stillHoldingUp.y + 26 === 6 * TILE && stillHoldingUp.x > 6 * TILE, 'steps onto the platform even with up still held');
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

test('one jump spends the ground grace, so a quick double tap is not a second jump', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  let s = run(level, {}, 3);
  s = step(level, s, { jump: true });
  assert.equal(s.coyote, 0, 'no grace left after leaving the ground by jumping');
  const tapped = step(level, step(level, s, {}), { jump: true });
  assert.equal(tapped.jumpsUsed, s.jumpsUsed, 'the second tap does nothing');
});

test('starting off is gentle, turning around is sharp, and pushing a crate is unchanged', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  const settled = run(level, {}, 3);
  const speeds = [];
  let s = settled;
  for (let i = 0; i < 10; i++) { s = step(level, s, { right: true }); speeds.push(s.vx); }
  assert.ok(speeds[0] < level.rules.groundAccel, `a tap moves a little: ${speeds[0]}`);
  assert.ok(speeds.findIndex(v => v >= level.rules.moveSpeed) >= 6, 'full speed takes a moment');
  const turned = step(level, s, { left: true });
  assert.ok(s.vx - turned.vx > level.rules.groundAccel * 1.5, 'reversing brakes hard');
  const coast = step(level, s, {});
  assert.ok(Math.abs(coast.vx) < Math.abs(s.vx), 'letting go still slows you down');
});

test('hazards forgive a two pixel graze', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  const graze = { type: 'spikes', x: 300 + 19, y: 13 * TILE - 14, w: 30, h: 14, dir: -1 };
  const grazed = createLevel(buildRules([]), []);
  Object.assign(grazed, { tiles: level.tiles, start: level.start });
  addObject(grazed, graze);
  assert.equal(run(grazed, {}, 5).dead, false, 'a pixel of overlap is survivable');
  const deep = createLevel(buildRules([]), []);
  Object.assign(deep, { tiles: level.tiles, start: level.start });
  addObject(deep, { ...graze, x: 300 + 10 });
  assert.equal(run(deep, {}, 5).dead, true, 'a real hit still kills');
});

const spiderClimb = level => {
  let s = initialState(level), top = s.y;
  for (let i = 0; i < 1200; i++) { const phase = i % 10; s = step(level, s, { left: phase >= 2, right: phase < 2, jump: phase < 9 }); top = Math.min(top, s.y); }
  return Math.round((level.start.y - top) / TILE);
};

test('Spider climbs real walls but not the edge of the screen, which only gives one kick', () => {
  const edge = createLevel(buildRules(['walls']), ['walls'], 60);
  fillTiles(edge, 0, 59, COLS, 1, SOLID);
  edge.start = { x: 4, y: 59 * TILE - 26 };
  assert.ok(spiderClimb(edge) < 8, `${spiderClimb(edge)} tiles up the screen edge`);
  const wall = createLevel(buildRules(['walls']), ['walls'], 60);
  fillTiles(wall, 0, 59, COLS, 1, SOLID);
  fillTiles(wall, 9, 0, 1, 59, SOLID);
  wall.start = { x: 10 * TILE + 4, y: 59 * TILE - 26 };
  assert.ok(spiderClimb(wall) > 30, `${spiderClimb(wall)} tiles up a real wall`);
});

test('a kick off a wall never flips gravity, a running jump still can', () => {
  const rules = { ...buildRules(['flipjump']), jumpFlipChance: 1 };
  const level = createLevel(rules, ['flipjump']);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  level.start = { x: 0, y: (ROWS - 1) * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 8; i++) s = step(level, s, { jump: i > 1 });
  s = step(level, s, {});
  s = step(level, s, { left: true, jump: true });
  assert.ok(s.lastKick && s.gravDir === 1, 'kicked off the screen edge');
  for (let i = 0; i < 12; i++) { s = step(level, s, { right: true }); assert.equal(s.gravDir, 1, `frame ${i} after the kick`); }
  let run = { ...initialState(level), x: 300 };
  for (let i = 0; i < 30 && run.gravDir > 0; i++) run = step(level, run, { right: true, jump: i > 10 });
  assert.equal(run.gravDir, -1, 'a running jump still rolls a flip');
});
