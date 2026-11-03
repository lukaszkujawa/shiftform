import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, objectRect, SOLID, TILE, ROWS, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { step, initialState, shoot } from '../src/world/physics.js';
import { standAt } from '../src/world/climb.js';
import { LURKERS, lurkerOf } from '../src/world/lurkers.js';

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

const lurk = (level, kind, x, y) => addObject(level, { type: 'lurker', kind, x, y, w: LURKERS[kind].w, h: LURKERS[kind].h });
const at = (level, x, y = FLOOR - 26, extra = {}) => ({ ...initialState(level), x, y, grounded: true, ...extra });
const follow = (level, s, frames, input = {}) => { const trail = []; for (let i = 0; i < frames && !s.dead; i++) { s = step(level, s, input); trail.push(s); } return { s, trail }; };

test('a faller hangs still until you walk under it, then drops and regrows', () => {
  const level = flatLevel();
  const drip = lurk(level, 'faller', 300, FLOOR - 7 * TILE);
  assert.equal(lurkerOf(drip, follow(level, at(level, 30), 60).s).mode, 'idle');
  const { trail, s } = follow(level, at(level, 300), 80);
  assert.ok(trail.some(n => lurkerOf(drip, n).mode === 'shake'), 'it warns first');
  assert.equal(s.dead, true, 'and lands on someone who stays put');
  const dodged = follow(level, at(level, 300), 18).s;
  const { s: after } = follow(level, { ...dodged, x: 100 }, 400);
  assert.equal(after.dead, false);
  assert.equal(lurkerOf(drip, after).y, drip.y, 'back on the ceiling');
});

test('a hound chases along its ledge, stops at the edge and walks home when you leave', () => {
  const level = flatLevel();
  fillTiles(level, 20, 13, 12, ROWS - 13, 0);
  const hound = lurk(level, 'hound', 400, FLOOR - 18);
  const start = at(level, 300, FLOOR - 26);
  const near = follow(level, start, 12).s;
  assert.equal(lurkerOf(hound, near).mode, 'chase');
  assert.ok(lurkerOf(hound, near).x < 400, 'it runs at you');
  const edge = createEdgeCase();
  assert.ok(edge.x + LURKERS.hound.w <= 12 * TILE + 1, 'it will not run off a ledge');
  const away = follow(level, { ...near, x: 30 + 25 * TILE }, 400).s;
  assert.equal(lurkerOf(hound, away).x, 400, 'home again');
});

function createEdgeCase() {
  const level = flatLevel();
  fillTiles(level, 12, 13, 30, ROWS - 13, 0);
  fillTiles(level, 20, 13, 10, 1, SOLID);
  const hound = lurk(level, 'hound', 200, FLOOR - 18);
  let s = { ...initialState(level), x: 22 * TILE, y: FLOOR - 26, grounded: true };
  for (let i = 0; i < 200; i++) s = step(level, s, {});
  return lurkerOf(hound, s);
}

test('a swooper warns, locks its aim and dives where you were, so stepping aside dodges it', () => {
  const level = flatLevel();
  const bird = lurk(level, 'swooper', 300, FLOOR - 5 * TILE);
  let s = at(level, 300);
  const stayed = follow(level, s, 140).s;
  assert.equal(stayed.dead, true, 'stand still and it hits you');
  for (let i = 0; i < 62; i++) s = step(level, s, {});
  assert.equal(lurkerOf(bird, s).mode, 'aim');
  const dodged = follow(level, s, 60, { left: true }).s;
  assert.equal(dodged.dead, false);
});

test('a bomber walks up, lights its fuse and blows, and stomping it defuses it', () => {
  const level = flatLevel();
  const bomb = lurk(level, 'bomber', 200, FLOOR - 20);
  const { trail, s } = follow(level, at(level, 130), 200);
  assert.ok(trail.some(n => lurkerOf(bomb, n).mode === 'fuse'));
  assert.equal(s.dead, true);
  const above = { ...initialState(level), x: 201, y: FLOOR - 120 };
  const stomped = follow(level, above, 40).s;
  assert.equal(stomped.dead, false);
  assert.equal(lurkerOf(bomb, stomped).dead, true);
});

test('a charger paws, runs you down faster than you can run, then stands stunned', () => {
  const level = flatLevel();
  fillTiles(level, 28, 12, 1, 1, SOLID);
  const bull = lurk(level, 'charger', 500, FLOOR - 22);
  const { trail } = follow(level, at(level, 650), 120);
  assert.ok(trail.some(n => lurkerOf(bull, n).mode === 'paw'));
  const fast = trail.map(n => lurkerOf(bull, n)).filter(m => m.mode === 'charge');
  assert.ok(fast.length > 2 && fast[1].x - fast[0].x > 4.2);
});

test('a sniper aims, then fires at where it locked on, and its bolt dies on walls', () => {
  const level = flatLevel();
  const eye = lurk(level, 'sniper', 500, FLOOR - 22);
  let s = at(level, 300);
  let shot = null;
  for (let i = 0; i < 260 && !s.dead && !shot; i++) { s = step(level, s, {}); shot = lurkerOf(eye, s).bolt; }
  assert.ok(shot && shot.vx < 0, 'fired towards you');
  assert.equal(follow(level, s, 90).s.dead, true);
  const walled = flatLevel();
  fillTiles(walled, 14, 0, 1, 13, SOLID);
  const blind = lurk(walled, 'sniper', 500, FLOOR - 22);
  assert.equal(lurkerOf(blind, follow(walled, at(walled, 300), 300).s).mode, 'idle', 'no line of sight, no shot');
});

test('a wraith floats through walls after you and freezes while you face it', () => {
  const level = flatLevel();
  fillTiles(level, 12, 0, 1, 13, SOLID);
  const ghost = lurk(level, 'wraith', 450, FLOOR - 30);
  const facing = follow(level, at(level, 300, FLOOR - 26, { facing: 1 }), 80).s;
  assert.equal(lurkerOf(ghost, facing).mode, 'shy');
  assert.equal(lurkerOf(ghost, facing).x, 450, 'it holds still while watched');
  const turned = follow(level, at(level, 300, FLOOR - 26, { facing: -1 }), 80).s;
  assert.ok(lurkerOf(ghost, turned).x < 400, 'and comes on when you look away, through the wall');
  const above = { ...initialState(level), x: 451, y: FLOOR - 120, facing: -1 };
  assert.equal(follow(level, above, 80).s.dead, true, 'it cannot be stomped');
});

test('a snapper bites from its ledge when you step close', () => {
  const level = flatLevel();
  const jaws = lurk(level, 'snapper', 300, FLOOR - 14);
  const { trail, s } = follow(level, at(level, 285), 40);
  assert.ok(trail.some(n => lurkerOf(jaws, n).mode === 'tell'));
  assert.equal(s.dead, true);
});

test('lurkers forget you on the floor and arrows drop them', () => {
  const level = flatLevel();
  const low = createLevel(buildRules([]), [], 40);
  fillTiles(low, 0, 39, COLS, 1, SOLID);
  const hound = lurk(low, 'hound', 300, 39 * TILE - 18);
  assert.equal(lurkerOf(hound, follow(low, { ...initialState(low), x: 280, y: 39 * TILE - 26, grounded: true }, 30).s).mode, 'idle');
  const target = lurk(level, 'charger', 300, FLOOR - 22);
  const s = follow(level, shoot(level, { ...at(level, 150), arrows: 1, facing: 1 }), 40).s;
  assert.equal(lurkerOf(target, s).dead, true);
});

test('a checkpoint snapshot and a respawn put every lurker back at home', () => {
  const level = flatLevel();
  const flag = addObject(level, { type: 'checkpoint', x: 60, y: FLOOR - 40, w: 24, h: 40 });
  const hound = lurk(level, 'hound', 300, FLOOR - 18);
  const chased = follow(level, at(level, 220), 30).s;
  assert.notEqual(lurkerOf(hound, chased).x, 300);
  assert.equal(lurkerOf(hound, standAt(level, chased, flag)).x, 300);
});

test('a puffer swells and shrinks on the clock and a crawler walks round its ledge', () => {
  const level = flatLevel();
  const puffer = monster(level, 200, { kind: 'puffer', motion: 'puff', dx: 0, dy: 0, grow: 16, period: 120, phase: 0 });
  assert.equal(objectRect(puffer, 0).w, puffer.w);
  assert.equal(objectRect(puffer, 30).w, puffer.w + 32);
  const crawler = monster(level, 100, { kind: 'crawler', motion: 'perimeter', y: 100, w: 14, h: 14, dx: 90, dy: 44, period: 268, phase: 0 });
  assert.deepEqual([objectRect(crawler, 90).x, objectRect(crawler, 90).y], [190, 100]);
  assert.deepEqual([objectRect(crawler, 112).x, objectRect(crawler, 112).y], [190, 122]);
  assert.deepEqual([objectRect(crawler, 224).x, objectRect(crawler, 224).y], [100, 144]);
  assert.deepEqual([objectRect(crawler, 268).x, objectRect(crawler, 268).y], [100, 100]);
});
