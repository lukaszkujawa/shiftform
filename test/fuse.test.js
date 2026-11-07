import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { initialState, step, FUSE_CHARGE, FUSE_BURN } from '../src/world/physics.js';

function fuseLevel() {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  fillTiles(level, 8, 30, 6, 1, SOLID);
  const fuses = [4, 5, 6, 7].map(col => addObject(level, { type: 'crumble', kind: 'fuse', x: col * TILE, y: 30 * TILE, w: TILE, h: TILE }));
  const fuse = fuses[1];
  level.start = { x: 4 * TILE + 5, y: 30 * TILE - 26 };
  return { level, fuse, fuses };
}

const run = (level, s, input, frames) => { for (let i = 0; i < frames && !s.dead; i++) s = step(level, s, input); return s; };

test('a fuse block is harmless until you leave it, then charges for four seconds and burns for eight', () => {
  const { level, fuse } = fuseLevel();
  let s = run(level, { ...initialState(level), grounded: true }, {}, 30);
  assert.equal(s.crumbled[fuse.slot], 0);
  s = run(level, s, { right: true }, 60);
  assert.ok(s.x > 8 * TILE, 'walked onto the ledge');
  const lit = FUSE_CHARGE + FUSE_BURN - s.crumbled[fuse.slot];
  assert.ok(lit > 0 && lit < 60, `lit ${lit} frames ago`);
  s = run(level, s, {}, FUSE_CHARGE - lit - 80);
  s = run(level, s, { left: true }, 50);
  assert.ok(s.x < 8 * TILE && !s.dead, 'stepping back on while it charges is safe');
  s = run(level, s, {}, 60);
  assert.ok(s.dead, 'standing on it when it ignites kills');
});

test('each fuse tile lights on its own as you walk across the row', () => {
  const { level, fuses } = fuseLevel();
  const s = run(level, { ...initialState(level), grounded: true }, { right: true }, 60);
  const ages = fuses.map(f => s.crumbled[f.slot]);
  assert.ok(ages.every(left => left > 0), `all lit: ${ages}`);
  assert.ok(ages[0] < ages[1] && ages[1] < ages[2] && ages[2] < ages[3], `lit in walking order: ${ages}`);
});

test('a burnt-out fuse block is safe again after its burn', () => {
  const { level, fuse } = fuseLevel();
  let s = run(level, { ...initialState(level), grounded: true }, { right: true }, 60);
  s = run(level, s, {}, FUSE_CHARGE + FUSE_BURN);
  assert.equal(s.crumbled[fuse.slot], 0);
  s = run(level, s, { left: true }, 60);
  assert.ok(!s.dead && s.x < 8 * TILE);
});
