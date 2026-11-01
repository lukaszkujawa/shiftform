import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { assertChains } from './helpers.js';

const count = (biome, type) => biome.objects.filter(o => o.type === type).length;

test('wallrun biomes climb cling shafts and are proven', () => {
  let shafts = 0;
  for (const seed of ['cling-1', 'cling-2', 'cling-3']) {
    const biome = generateBiome(seed, 2, null, [], 'walls');
    assert.equal(biome.focus, 'walls');
    assertChains(biome, seed);
    shafts += count(biome, 'cling') / 2;
  }
  assert.ok(shafts >= 3, `${shafts} cling shafts across three biomes`);
});
