import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { standAt, touchCheckpoints, respawn, enterBiome, altitudeMetres } from '../src/climb.js';

function tower(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators, 72);
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  fillTiles(level, 10, 71, 2, 1, ONE_WAY);
  fillTiles(level, 0, 50, 8, 1, SOLID);
  fillTiles(level, 0, 20, 8, 1, SOLID);
  level.start = { x: 305, y: 71 * TILE - 26 };
  addObject(level, { type: 'checkpoint', x: 60, y: 50 * TILE - 40, w: 24, h: 40 });
  addObject(level, { type: 'checkpoint', x: 60, y: 20 * TILE - 40, w: 24, h: 40 });
  return level;
}

const at = (level, x, y) => ({ ...initialState(level), x, y, frame: 900 });

test('standAt puts the player on the checkpoint ready to move', () => {
  const level = tower();
  const s = standAt(level, { ...at(level, 300, 100), vx: 5, vy: 7 }, level.objects[0]);
  assert.equal(s.y, 50 * TILE - 26);
  assert.equal(s.x, 62);
  assert.equal(s.vx, 0);
  assert.equal(step(level, s, {}).y, s.y);
});

test('touching a checkpoint records it once', () => {
  const level = tower();
  const s = standAt(level, at(level, 0, 0), level.objects[0]);
  const touched = touchCheckpoints(level, s, []);
  assert.equal(touched.length, 1);
  assert.equal(touchCheckpoints(level, s, touched), touched);
});

test('respawn uses the highest touched checkpoint at or below the player', () => {
  const level = tower();
  const touched = level.objects.map(o => ({ id: o.id, y: o.y + o.h, snapshot: standAt(level, at(level, 0, 0), o) }));
  assert.equal(respawn(level, at(level, 100, 40 * TILE), touched).y, 50 * TILE - 26);
  assert.equal(respawn(level, at(level, 100, 10 * TILE), touched).y, 20 * TILE - 26);
  assert.equal(respawn(level, at(level, 100, 60 * TILE), touched).y, level.start.y);
  assert.equal(respawn(level, at(level, 100, 10 * TILE), touched).frame, 900);
});

test('entering the next biome rises through the hatch and lands on it', () => {
  const from = tower(), to = tower(['moon']);
  let s = enterBiome(from, { ...at(from, 305, -4), vy: -9, vx: 0 }, to);
  assert.equal(s.x, 305);
  assert.ok(s.vy < 0);
  for (let i = 0; i < 240; i++) s = step(to, s, {});
  assert.equal(s.grounded, true);
  assert.equal(s.y, 71 * TILE - 26);
});

test('altitude grows with height and biome index', () => {
  const level = tower();
  const low = altitudeMetres(0, level, at(level, 0, 60 * TILE));
  assert.ok(altitudeMetres(0, level, at(level, 0, 10 * TILE)) > low);
  assert.equal(altitudeMetres(1, level, at(level, 0, 60 * TILE)) - low, 72 * 2);
});
