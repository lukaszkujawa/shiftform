import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOLID, ONE_WAY } from '../../src/world/level.js';
import { generateBiome } from '../../src/generation/generator.js';
import { assertChains } from './helpers.js';

const OPENERS = ['first', 'strides', 'flights'];
const MOSTLY_GROUNDED = 0.7;

const GENTLE = new Set(['saw', 'flapper', 'urchin']);

test('the first biome is a gentle lesson with one or two readable dangers', () => {
  for (const seed of ['lesson-a', 'lesson-b', 'lesson-c']) {
    const biome = generateBiome(seed, 0, null);
    assertChains(biome, seed);
    assert.ok(OPENERS.includes(biome.focus), `${seed} opens with ${biome.focus}`);
    assert.equal(biome.mutators.length, 0);
    const dangers = biome.objects.filter(o => ['spikes', 'laser', 'saw', 'monster', 'lurker'].includes(o.type));
    assert.ok(dangers.length <= 2 && dangers.every(o => GENTLE.has(o.kind ?? o.type)), `${seed} dangers: ${dangers.map(o => o.kind ?? o.type)}`);
    assert.ok(biome.segments.every(s => !s.puzzle), `${seed} has no puzzles`);
    assert.ok(biome.objects.some(o => o.type === 'mover'), `${seed} teaches moving platforms`);
    assert.ok(biome.objects.some(o => o.type === 'crumble'), `${seed} teaches crumbling platforms`);
    assert.ok(biome.objects.some(o => o.type === 'climb' || o.type === 'spring'), `${seed} teaches a connector`);
    const coins = biome.objects.filter(o => o.type === 'coin');
    assert.ok(coins.length >= 6 && coins.length <= 28, `${seed} scatters ${coins.length} coins`);
    const grounded = coins.filter(c => [SOLID, ONE_WAY].includes(biome.tiles[(Math.floor(c.y / 30) + 1) * 32 + Math.floor((c.x + 7) / 30)]));
    assert.ok(coins.every(c => c.slot < 28) && grounded.length >= coins.length * MOSTLY_GROUNDED, `${seed}: ${grounded.length} of ${coins.length} coins hover over platforms`);
  }
  assert.ok(!OPENERS.includes(generateBiome('lesson-a', 1, null).focus));
});
