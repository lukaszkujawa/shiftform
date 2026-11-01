import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { assertChains } from './helpers.js';

test('crumbling heights climbs stairs and every stretch is proven', () => {
  let stairs = 0;
  for (const seed of ['stair-1', 'stair-2', 'stair-3']) {
    const biome = generateBiome(seed, 2, null, [], 'crumbles');
    assertChains(biome, seed);
    stairs += biome.moves.filter(m => m === 'stair').length;
  }
  assert.ok(stairs >= 3, `${stairs} stair runs across three biomes`);
});

test('blade run leaps and is proven', () => {
  const seen = new Set();
  for (const seed of ['leap-1', 'leap-2', 'leap-3']) {
    const biome = generateBiome(seed, 4, null, [], 'saws');
    assertChains(biome, seed);
    biome.moves.forEach(m => seen.add(m));
  }
  assert.ok(seen.has('leap'), `moves seen: ${[...seen].join(',')}`);
});

test('a deep biome uses at least three move kinds and the first biome keeps to gentle ones', () => {
  const deep = generateBiome('kinds-1', 6, null);
  assertChains(deep, 'kinds-1');
  assert.ok(new Set(deep.moves).size >= 3, `kinds: ${[...new Set(deep.moves)].join(',')}`);
  const first = generateBiome('kinds-1', 0, null);
  assert.ok(first.moves.every(m => ['hop', 'shaft', 'run', 'stair'].includes(m)), `first biome moves: ${first.moves.join(',')}`);
});

test('leaps carry a coin at the apex', () => {
  for (const seed of ['leap-1', 'leap-2', 'leap-3']) {
    const biome = generateBiome(seed, 4, null, [], 'saws');
    if (biome.moves.includes('leap')) assert.ok(biome.objects.some(o => o.type === 'coin' && o.apex), `${seed} has an apex coin`);
  }
});
