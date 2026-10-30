import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, blinkDestination } from '../src/physics.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2, `${actual} is not near ${expected}`);

const FLOOR = 13 * TILE;

function blinkLevel() {
  const level = createLevel(buildRules(['blink']), ['blink']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 90, y: FLOOR - 26 };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames && !s.dead; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('a blink rises the full height when the way is clear', () => {
  const level = blinkLevel();
  const s = run(level, i => ({ jump: i === 2 }), 3);
  near(s.y, level.start.y - 75);
  near(s.x, level.start.x);
});

test('a blink never lands on a hazard', () => {
  const level = blinkLevel();
  addObject(level, { type: 'spikes', x: 0, y: level.start.y - 80, w: COLS * TILE, h: 30 });
  const s = run(level, i => ({ jump: i === 2 }), 3);
  assert.equal(s.dead, false);
  near(s.y, level.start.y - 45);
});

test('holding a direction leans the blink one tile that way', () => {
  const level = blinkLevel();
  const s = run(level, i => ({ jump: i === 2, right: i === 2 }), 3);
  near(s.x, level.start.x + TILE);
  near(s.y, level.start.y - 75);
});

test('a leaned blink falls back to straight up when the side is blocked', () => {
  const level = blinkLevel();
  fillTiles(level, 4, 8, 1, 5, SOLID);
  const to = blinkDestination(level, initialState(level), 1);
  assert.deepEqual(to, { x: level.start.x, y: level.start.y - 75 });
});

test('boxed in, the jump becomes a hop instead of vanishing', () => {
  const level = blinkLevel();
  fillTiles(level, 0, 9, COLS, 3, SOLID);
  assert.equal(blinkDestination(level, initialState(level), 0), null);
  const s = run(level, i => ({ jump: i === 2 }), 3);
  assert.ok(!s.grounded && s.y < level.start.y, `hop expected, got y ${s.y}`);
  assert.equal(run(level, i => ({ jump: i === 2 }), 30).dead, false);
});
