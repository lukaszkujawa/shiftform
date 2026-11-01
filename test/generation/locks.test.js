import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { solve } from '../../src/solver.js';
import { assertChains } from './helpers.js';

const BYPASS_BUDGET = 10000;

test('far keys open a door in the next stretch and every stretch is proven', () => {
  let far = 0;
  for (const seed of ['far-1', 'far-2', 'far-3', 'far-4']) {
    const biome = generateBiome(seed, 3, null, [], 'locks');
    assertChains(biome, seed);
    biome.segments.forEach((segment, k) => {
      if (segment.puzzle !== 'farKey') return;
      far++;
      const key = segment.route.find(p => p.bit);
      const door = biome.objects.find(o => o.type === 'door' && o.bit === key.bit);
      const next = biome.segments[k + 1];
      const top = Math.min(...next.route.map(p => p.y)), bottom = Math.max(...next.route.map(p => p.y));
      assert.ok(door.y + door.h >= top - 60 && door.y <= bottom + 60, `${seed} stretch ${k}: the door stands in the next stretch`);
    });
  }
  assert.ok(far >= 2, `${far} far keys across four biomes`);
});

test('lock puzzles cannot be finished without their key or switch', () => {
  for (const seed of ['far-1', 'far-2']) {
    const biome = generateBiome(seed, 3, null, [], 'locks');
    biome.segments.forEach((segment, k) => {
      if (!['keyDoor', 'switchWall', 'switchBridge', 'farKey'].includes(segment.puzzle)) return;
      const bit = segment.route.find(p => p.bit).bit;
      const lockStretch = segment.puzzle === 'farKey' ? biome.segments[k + 1] : segment;
      const bare = { ...biome, objects: biome.objects.map(o => (o.type === 'key' || o.type === 'switch') && o.bit === bit ? { ...o, type: 'removed' } : o) };
      const start = { ...lockStretch.start, flags: lockStretch.start.flags & ~bit };
      const goal = biome.objects.filter(o => o.type === 'checkpoint')[biome.segments.indexOf(lockStretch)] ?? null;
      const route = lockStretch.route.filter(p => !p.bit && p.body === undefined);
      assert.equal(solve(bare, { start, goal, route, maxNodes: BYPASS_BUDGET }), null, `${seed} stretch ${k} ${segment.puzzle} needs its mechanism`);
    });
  }
});
