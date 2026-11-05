import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, ROWS, COLS, addObject, isSolidObject } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { step, initialState, playerSize } from '../src/world/physics.js';

function flatLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: 13 * TILE - 26 };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

function wallLevel(withCling) {
  const level = flatLevel();
  fillTiles(level, 6, 4, 1, 9, SOLID);
  if (withCling) addObject(level, { type: 'cling', x: 6 * TILE - 6, y: 4 * TILE, w: 6, h: 9 * TILE });
  level.start = { x: 4 * TILE, y: 13 * TILE - 26 };
  return level;
}

const towardWall = i => ({ right: true, jump: i < 12 || i === 30 });

test('a cling strip turns a wall into a wall jump without spending the kick', () => {
  const s = run(wallLevel(true), towardWall, 32);
  assert.ok(s.vy < 0, 'rising again after the second press');
  assert.ok(s.vx < 0, 'pushed away from the wall');
  assert.equal(s.lastKick, 0);
});

test('without the strip the same press is an ordinary leg kick', () => {
  const s = run(wallLevel(false), towardWall, 32);
  assert.equal(s.lastKick, 1);
});

function refillLevel() {
  const level = flatLevel();
  addObject(level, { type: 'refill', x: 30 + 1, y: 13 * TILE - 26 - 75, w: 18, h: 18 });
  return level;
}

const apexOf = (level, inputs) => {
  let s = initialState(level), top = Infinity;
  for (let i = 0; i < 90; i++) { s = step(level, s, inputs(i)); top = Math.min(top, s.y); }
  return top;
};

test('a refill grants one more jump in mid-air, once per flight', () => {
  const plain = apexOf(flatLevel(), i => ({ jump: i < 10 || (i >= 16 && i < 24) }));
  const boosted = apexOf(refillLevel(), i => ({ jump: i < 10 || (i >= 16 && i < 24) }));
  assert.ok(boosted < plain - 40, `refilled apex ${boosted} is well above ${plain}`);
  const twice = apexOf(refillLevel(), i => ({ jump: i < 10 || (i >= 16 && i < 24) || (i >= 30 && i < 38) }));
  assert.ok(Math.abs(twice - boosted) < 1, 'the second press finds the refill spent');
});

test('a refill adds its jump on top of the air jumps you already have', () => {
  const triple = () => { const level = refillLevel(); level.rules = { ...level.rules, jumps: 3 }; return level; };
  const touch = level => { let s = initialState(level); for (let i = 0; i < 14; i++) s = step(level, s, { jump: i < 10 }); return s; };
  const plain = touch((() => { const level = flatLevel(); level.rules = { ...level.rules, jumps: 3 }; return level; })());
  const boosted = touch(triple());
  assert.equal(boosted.jumpsLeft, plain.jumpsLeft + 1);
});

test('two refills give two jumps, and the first cannot be touched again for a third', () => {
  const level = flatLevel();
  const a = addObject(level, { type: 'refill', x: 400, y: 100, w: 18, h: 18 }), b = addObject(level, { type: 'refill', x: 500, y: 100, w: 18, h: 18 });
  const { w, h } = playerSize(level.rules), at = o => ({ x: o.x + o.w / 2 - w / 2, y: o.y + o.h / 2 - h / 2 });
  let s = { ...initialState(level), ...at(a), grounded: false, jumpsLeft: 0, vy: 0 };
  s = step(level, s, {});
  s = step(level, { ...s, ...at(b) }, {});
  s = step(level, { ...s, ...at(a) }, {});
  assert.equal(s.jumpsLeft, 2);
});

test('a refill stays lit while you pass through it and goes dim only when its jump is spent', () => {
  const level = refillLevel();
  let s = initialState(level), touched = null, jumped = null;
  for (let i = 0; i < 40; i++) {
    s = step(level, s, { jump: i < 10 || (i >= 16 && i < 24) });
    if (touched === null && s.armed >= 0) touched = { i, spent: s.spent };
    if (touched && jumped === null && s.spent) jumped = { i, armed: s.armed };
  }
  assert.ok(touched && touched.spent === 0, 'armed on touch, not yet spent');
  assert.ok(jumped && jumped.i >= 16 && jumped.armed === -1, 'spent at the jump');
});

test('a timer opens its door for a while and the door closes again', () => {
  const level = flatLevel();
  const timer = addObject(level, { type: 'timer', x: 60, y: 13 * TILE - 20, w: 16, h: 18, open: 60 });
  const door = addObject(level, { type: 'door', timer: timer.slot, open: 60, x: 300, y: 9 * TILE, w: 30, h: 4 * TILE });
  let s = run(level, {}, 5);
  assert.equal(isSolidObject(door, s, s.clock), true);
  s = run(level, { right: true }, 12, s);
  assert.equal(s.timers[timer.slot] >= 0, true, 'walking over the timer presses it');
  assert.equal(isSolidObject(door, s, s.clock), false);
  s = run(level, { right: true }, 30, s);
  assert.ok(s.x > 76, 'walked off the timer');
  s = run(level, {}, 60, s);
  assert.equal(isSolidObject(door, s, s.clock), true);
});
