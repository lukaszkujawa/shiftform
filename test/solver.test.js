import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, overlaps, SOLID, TILE, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState } from '../src/physics.js';
import { solve, replay } from '../src/solver.js';

test('solve reaches a goal rect from a given start state', () => {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  fillTiles(level, 10, 32, 6, 1, SOLID);
  level.start = { x: 30, y: 35 * TILE - 26 };
  const start = { ...initialState(level), x: 120, y: 35 * TILE - 26, frame: 500 };
  const goal = { x: 300, y: 30 * TILE, w: 180, h: 2 * TILE };
  const result = solve(level, { start, goal, maxNodes: 20000 });
  assert.ok(result);
  const end = replay(level, result.inputs, start).at(-1);
  assert.ok(overlaps(end.x, end.y, 20, 26, goal));
});
