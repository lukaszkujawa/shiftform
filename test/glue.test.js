import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, COLS, GLUE_W } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { initialState, step } from '../src/world/physics.js';

function glueLevel() {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  fillTiles(level, 12, 22, 1, 13, SOLID);
  addObject(level, { type: 'climb', kind: 'glue', side: 1, x: 12 * TILE - GLUE_W, y: 24 * TILE, w: GLUE_W, h: 10 * TILE });
  level.start = { x: 9 * TILE, y: 35 * TILE - 26 };
  return level;
}

const run = (level, s, input, frames) => { for (let i = 0; i < frames && !s.dead; i++) s = step(level, s, input); return s; };

test('touching a glue wall in the air sticks you to it, you can climb it, and jumping kicks you away', () => {
  const level = glueLevel();
  let s = run(level, { ...initialState(level), grounded: true }, { right: true, jump: true }, 6);
  s = run(level, s, { right: true }, 40);
  assert.ok(s.climbing, 'stuck to the wall');
  assert.equal(s.vy, 0);
  const hanging = s.y;
  s = run(level, s, { up: true }, 30);
  assert.ok(s.y < hanging - 60, 'climbed up');
  s = run(level, s, { down: true }, 12);
  assert.ok(s.climbing && s.y > hanging - 60, 'slid down');
  s = run(level, s, { jump: true, left: true }, 2);
  assert.ok(!s.climbing && s.vx < -3 && s.vy < 0, `kicked off: vx ${s.vx.toFixed(1)} vy ${s.vy.toFixed(1)}`);
});

test('pressing away from a glue wall lets go of it', () => {
  const level = glueLevel();
  let s = run(level, { ...initialState(level), grounded: true }, { right: true, jump: true }, 6);
  s = run(level, s, { right: true }, 40);
  assert.ok(s.climbing);
  s = run(level, s, { left: true }, 3);
  assert.ok(!s.climbing);
});
