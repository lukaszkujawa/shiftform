import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { assertChains } from './helpers.js';

const HAZARDS = new Set(['spikes', 'laser', 'saw', 'monster']);

test('the first biome is a gentle lesson with a tip per stretch and no hazards', () => {
  for (const seed of ['lesson-a', 'lesson-b', 'lesson-c']) {
    const biome = generateBiome(seed, 0, null);
    assertChains(biome, seed);
    assert.equal(biome.focus, 'first');
    assert.equal(biome.mutators.length, 0);
    assert.equal(biome.tips.length, 4, `${seed} has a tip per stretch`);
    assert.ok(biome.objects.every(o => !HAZARDS.has(o.type)), `${seed} has no hazards`);
    assert.ok(biome.segments.every(s => !s.puzzle), `${seed} has no puzzles`);
    assert.ok(biome.objects.some(o => o.type === 'mover'), `${seed} teaches moving platforms`);
    assert.ok(biome.objects.some(o => o.type === 'crumble'), `${seed} teaches crumbling platforms`);
    assert.ok(biome.objects.some(o => o.type === 'climb' || o.type === 'spring'), `${seed} teaches a connector`);
    const coins = biome.objects.filter(o => o.type === 'coin');
    assert.ok(coins.length >= 6 && coins.length <= 28, `${seed} scatters ${coins.length} coins`);
    assert.ok(coins.every(c => c.slot < 28 && biome.tiles[(Math.floor(c.y / 30) + 1) * 32 + Math.floor((c.x + 7) / 30)] === 1), `${seed} coins hover over platforms`);
  }
  assert.notEqual(generateBiome('lesson-a', 1, null).focus, 'first');
});
