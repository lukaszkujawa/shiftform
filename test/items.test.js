import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, JETPACK_FUEL, BOOT_JUMPS } from '../src/physics.js';

const FLOOR = 13 * TILE;

function flatLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

const item = (level, kind, x = 60) => addObject(level, { type: 'item', kind, x, y: FLOOR - 24, w: 20, h: 20 });

test('walking over items collects them once', () => {
  const level = flatLevel();
  item(level, 'jetpack', 60);
  item(level, 'boots', 120);
  item(level, 'shield', 180);
  const s = run(level, { right: true }, 60);
  assert.equal(s.taken, 0b111);
  assert.equal(s.fuel, JETPACK_FUEL);
  assert.equal(s.boots, BOOT_JUMPS);
  assert.equal(s.shield, true);
});

test('the jetpack lifts after normal jumps and burns fuel', () => {
  const level = flatLevel();
  const plain = run(level, i => ({ jump: (i >= 5 && i < 10) || (i >= 20 && i < 60) }), 60);
  const withPack = { ...initialState(level), fuel: JETPACK_FUEL };
  let s = withPack, highest = Infinity;
  for (let i = 0; i < 60; i++) { s = step(level, s, { jump: (i >= 5 && i < 10) || (i >= 20 && i < 60) }); highest = Math.min(highest, s.y); }
  assert.ok(highest < plain.y - 100);
  assert.ok(s.fuel < JETPACK_FUEL && s.fuel > 0);
  const empty = run(level, { jump: true }, 400, { ...initialState(level), fuel: 10 });
  assert.equal(empty.fuel, 0);
});

test('boots give extra mid-air jumps', () => {
  const level = flatLevel();
  const taps = i => ({ jump: (i >= 5 && i < 9) || (i >= 12 && i < 16) });
  assert.equal(run(level, taps, 30).jumpsUsed, 1);
  const booted = run(level, taps, 30, { ...initialState(level), boots: 2 });
  assert.equal(booted.jumpsUsed, 2);
  assert.equal(booted.boots, 1);
});

test('a shield absorbs one hazard hit', () => {
  const level = flatLevel();
  addObject(level, { type: 'spikes', x: 100, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  addObject(level, { type: 'spikes', x: 400, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  const s = run(level, { right: true }, 60, { ...initialState(level), shield: true });
  assert.equal(s.dead, false);
  assert.equal(s.shield, false);
  assert.ok(s.x > 130);
  assert.equal(run(level, { right: true }, 200, s).dead, true);
});
