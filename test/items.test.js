import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedBiomes } from './fixed-biomes.js';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { KINDS } from '../src/items.js';
import { TRICKS } from '../src/tricks.js';
import { step, initialState, JETPACK_FUEL, BOOT_JUMPS, ARROWS } from '../src/physics.js';

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

test('the jetpack climbs under Lead Boots', () => {
  const level = createLevel(buildRules(['heavy']), ['heavy']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  const inputs = i => ({ jump: (i >= 5 && i < 10) || i >= 20 });
  const lift = run(level, inputs, 60, { ...initialState(level), fuel: JETPACK_FUEL });
  const later = run(level, inputs, 90, { ...initialState(level), fuel: JETPACK_FUEL });
  assert.ok(later.y < lift.y - 60, `jetpack should keep climbing, rose ${lift.y - later.y}`);
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

test('a bow grants five arrows and the fire act spends them and is recorded', async () => {
  const level = flatLevel();
  item(level, 'bow', 60);
  const s = run(level, { right: true }, 30);
  assert.equal(s.arrows, ARROWS);
  const { createRun, advance } = await import('../src/run.js');
  const { encodeGhost, decodeGhost } = await import('../src/ghost.js');
  const biomes = fixedBiomes([[0, level]]);
  const r = createRun(5);
  advance(r, biomes);
  r.s = { ...r.s, arrows: 2 };
  assert.deepEqual(advance(r, biomes, { fire: true }), { type: 'shot' });
  assert.equal(r.s.arrows, 1);
  assert.equal(r.s.flying.length, 1);
  const ghost = await decodeGhost(await encodeGhost({ codes: [0, 0], acts: [{ at: 1, type: 'fire' }] }));
  assert.deepEqual(ghost.acts, [{ at: 1, type: 'fire' }]);
});

test('every item kind has a shop card, which also supplies its pickup text', () => {
  for (const [kind] of KINDS) assert.ok(TRICKS[kind]?.title && TRICKS[kind]?.text, kind);
});
