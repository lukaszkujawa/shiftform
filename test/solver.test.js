import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, overlaps, SOLID, TILE, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState } from '../src/physics.js';
import { solve, replay, stateKey } from '../src/solver.js';
import { step } from '../src/physics.js';

test('solve reaches a goal rect from a given start state', () => {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  fillTiles(level, 10, 32, 6, 1, SOLID);
  level.start = { x: 30, y: 35 * TILE - 26 };
  const start = { ...initialState(level), x: 120, y: 35 * TILE - 26, frame: 500 };
  const goal = { x: 300, y: 30 * TILE, w: 180, h: 2 * TILE };
  const result = solve(level, { start, goal, route: [{ x: goal.x + goal.w / 2, y: goal.y + goal.h / 2 }], maxNodes: 20000 });
  assert.ok(result);
  const end = replay(level, result.inputs, start).at(-1);
  assert.ok(overlaps(end.x, end.y, 20, 26, goal));
});

test('states that differ only in charge get different keys in a flywheel level', () => {
  const level = createLevel(buildRules(['flywheel']), ['flywheel']);
  fillTiles(level, 0, 17, COLS, 1, SOLID);
  level.start = { x: 30, y: 17 * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 30; i++) s = step(level, s, {});
  const cold = { ...s, charge: 0, chargeDir: 0 }, hot = { ...s, charge: 1, chargeDir: 1 };
  assert.notDeepEqual(stateKey(level, cold), stateKey(level, hot));
  const plain = createLevel(buildRules([]), []);
  assert.deepEqual(stateKey(plain, cold), stateKey(plain, hot));
});
