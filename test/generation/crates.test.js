import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { TILE } from '../../src/level.js';
import { assertChains } from './helpers.js';

test('crate puzzles fetch, launch or stack crates that start off the platform they are needed on', () => {
  const seen = new Set();
  for (const seed of ['c1', 'c3', 'c2', 'c5', 'c4']) {
    if (['fetchBelow', 'fetchAbove', 'stackStep', 'springLift'].every(p => seen.has(p))) break;
    const biome = generateBiome(seed, 2, null, [], 'crates');
    assertChains(biome, seed);
    const crates = biome.objects.filter(o => o.type === 'crate');
    for (const segment of biome.segments.filter(s => s.puzzle && s.puzzle !== 'throwSwitch')) {
      seen.add(segment.puzzle);
      const moves = segment.route.filter(p => p.body !== undefined).map(p => {
        const crate = crates[p.body];
        return { dx: Math.abs(crate.x + crate.w / 2 - p.tx), dy: Math.abs(crate.y + crate.h / 2 - p.ty) };
      });
      assert.ok(moves.some(m => m.dy >= 2 * TILE), `${seed} ${segment.puzzle} brings a crate up or down`);
      assert.ok(moves.every(m => m.dx <= 12 * TILE && m.dy <= 7 * TILE), `${seed} ${segment.puzzle} keeps its crates close`);
    }
  }
  for (const puzzle of ['fetchBelow', 'fetchAbove', 'stackStep', 'springLift']) assert.ok(seen.has(puzzle), `${puzzle} appears`);
});
