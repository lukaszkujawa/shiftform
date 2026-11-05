import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { fairMove } from '../../src/generation/fair.js';
import { replay } from '../../src/generation/solver.js';
import { unsaveableJumps } from '../../src/generation/sloppy.js';
import { addObject, createLevel, fillTiles, COLS, SOLID, TILE } from '../../src/world/level.js';
import { buildRules } from '../../src/world/rules.js';
import { initialState } from '../../src/world/physics.js';

const SEEDS = ['fair-a', 'fair-b', 'fair-c'];

function room() {
  const level = createLevel(buildRules([]), [], 20);
  fillTiles(level, 0, 19, COLS, 1, SOLID);
  fillTiles(level, 10, 14, 3, 5, SOLID);
  level.start = { x: 100, y: 19 * TILE - 26 };
  return level;
}

test('a proof may not pass through rock, stand inside a solid block, or move further than its speed allows', () => {
  const level = room(), a = initialState(level);
  assert.equal(fairMove(level, a, { ...a, x: a.x + 3, vx: 3 }), true);
  assert.equal(fairMove(level, a, { ...a, x: a.x + 80, vx: 0 }), false, 'a jump with no speed behind it');
  const inRock = { ...a, x: 10 * TILE + 5, y: 16 * TILE };
  assert.equal(fairMove(level, inRock, inRock), false, 'inside rock');
  addObject(level, { type: 'phase', x: 200, y: 19 * TILE - 40, w: 90, h: 30, period: 240, on: 240, phase: 0 });
  const inBlock = { ...a, x: 210, y: 19 * TILE - 40 };
  assert.equal(fairMove(level, inBlock, inBlock), false, 'inside a block that is switched on');
});

test('generated proofs make only fair moves', () => {
  for (const seed of SEEDS) {
    for (const index of [1, 5]) {
      const level = generateBiome(seed, index, null, []);
      for (const { inputs, start } of level.segments) {
        const states = replay(level, inputs, start);
        states.forEach((s, i) => { if (i) assert.ok(fairMove(level, states[i - 1], s), `${seed}/${index} frame ${i}`); });
      }
    }
  }
});

test('most stretches have no jump a three-frame slip cannot steer back from', () => {
  const stretches = SEEDS.flatMap(seed => [1, 5].flatMap(index => generateBiome(seed, index, null, []).segments.map(segment => ({ segment, level: generateBiome(seed, index, null, []) }))).slice(0, 4));
  const clean = stretches.filter(({ level, segment }) => unsaveableJumps(level, segment.inputs, segment.start) === 0).length;
  assert.ok(clean >= stretches.length - 2, `${clean} of ${stretches.length}`);
});
