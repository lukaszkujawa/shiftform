import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { TILE } from '../../src/level.js';
import { assertChains } from './helpers.js';

const ROOMS = ['dropStep', 'stackRoom', 'bounceRoom', 'sinkRoom'];

test('crate rooms keep their crates inside the room and every stretch is proven', () => {
  const seen = new Set();
  for (const seed of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) {
    if (seen.size >= 3) break;
    const biome = generateBiome(seed, 3, null, [], 'crates');
    assertChains(biome, seed);
    const crates = biome.objects.filter(o => o.type === 'crate');
    for (const segment of biome.segments.filter(s => ROOMS.includes(s.puzzle))) {
      seen.add(segment.puzzle);
      const moves = segment.route.filter(p => p.body !== undefined).map(p => {
        const crate = crates[p.body];
        return { dx: Math.abs(crate.x + crate.w / 2 - p.tx), dy: Math.abs(crate.y + crate.h / 2 - p.ty) };
      });
      assert.ok(moves.length, `${seed} ${segment.puzzle} moves a crate`);
      assert.ok(moves.every(m => m.dx <= 9 * TILE && m.dy <= 4 * TILE), `${seed} ${segment.puzzle} keeps its crates in the room`);
    }
  }
  assert.ok(seen.size >= 3, `room kinds seen: ${[...seen].join(', ')}`);
});
