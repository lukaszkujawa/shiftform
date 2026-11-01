import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, ROWS, COLS, addObject, isSolidObject } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

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
