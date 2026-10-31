import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, SOLID, EMPTY, tileAt, levelIndex } from '../src/level.js';
import { initialState, step } from '../src/physics.js';
import { createRun, advance } from '../src/run.js';
import { fixedBiomes } from './fixed-biomes.js';
import { BLOCKS, sandboxLevel, freshBody, removeAt } from '../src/qa.js';

test('the sandbox is a sealed empty biome with no way out that every block can be built in and removed from', () => {
  const level = sandboxLevel();
  assert.ok(level.objects.length === 0 && tileAt(level, 5, level.rows - 1) === SOLID && tileAt(level, 5, 5) === EMPTY);
  let state = initialState(level);
  BLOCKS.forEach((block, i) => {
    const x = (2 + (i % 14) * 2) * TILE + 15, y = (6 + Math.floor(i / 14) * 8) * TILE + 15;
    const placed = block.place(level, x, y);
    const top = Math.floor(y / TILE) * TILE;
    if (placed) assert.ok(placed.id >= 0 && Math.abs(placed.x + placed.w / 2 - x) < 2 * TILE && placed.y < top + TILE && placed.y + placed.h > top, `${block.id} touches the clicked cell`);
    else assert.equal(tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)), block.id === 'solid' ? SOLID : 2, `${block.id} fills the clicked cell`);
    if (placed?.type === 'crate') state = { ...state, bodies: [...state.bodies, freshBody(placed)] };
  });
  assert.equal(state.bodies.length, levelIndex(level).crates.length, 'a body per crate');
  for (let i = 0; i < 120; i++) state = step(level, state, { right: i % 40 < 20, jump: i % 30 === 0 });
  assert.ok(!state.won, 'there is no exit to reach');
  const saw = level.objects.find(o => o.type === 'saw');
  removeAt(level, state, saw.x + 5, saw.y + 5);
  assert.equal(saw.type, 'removed');
  assert.ok(!levelIndex(level).triggers.includes(saw), 'the index forgets it');
  const crate = levelIndex(level).crates[0], without = removeAt(level, state, crate.x + 5, crate.y + 5);
  assert.ok(without.bodies[0].gone && crate.type === 'crate', 'a removed crate keeps its slot but its body is gone');
  removeAt(level, state, 5 * TILE + 3, level.height - TILE + 3);
  assert.equal(tileAt(level, 5, level.rows - 1), SOLID, 'the floor cannot be dug out');
  const run = createRun(5, 'test');
  advance(run, fixedBiomes([[0, level]]));
  assert.equal(run.phase, 'play');
});
