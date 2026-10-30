import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { assertChains } from './helpers.js';

const FOCUS_SIGNS = {
  bouncer: { seeds: ['bounce-1', 'bounce-2', 'bounce-3'], has: b => b.objects.filter(o => o.type === 'bumper').length >= 1 && b.objects.some(o => o.type === 'spring' && o.y > 120), label: 'a bumper gap and a trampoline' },
  wind: { seeds: ['gust-1', 'gust-2', 'gust-3'], has: b => b.objects.some(o => o.type === 'wind' && o.ay < 0) && b.objects.some(o => o.type === 'wind' && o.ax !== 0), label: 'an updraft and a gust' },
  water: { seeds: ['pool-1', 'pool-2', 'pool-3'], has: b => b.objects.filter(o => o.type === 'water').length >= 2, label: 'pools and a swim shaft' },
};

for (const [focus, { seeds, has, label }] of Object.entries(FOCUS_SIGNS)) {
  test(`${focus} biomes are proven and show ${label}`, () => {
    let shown = 0;
    for (const seed of seeds) {
      const biome = generateBiome(seed, 2, null, [], focus);
      assert.equal(biome.focus, focus);
      assertChains(biome, seed);
      if (has(biome)) shown++;
    }
    assert.ok(shown >= 2, `${shown} of ${seeds.length} ${focus} biomes show ${label}`);
  });
}
