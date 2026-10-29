import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome, demandsMomentum } from '../../src/generator.js';
import { assertChains } from './helpers.js';

test('flywheel biomes contain sprint gaps that a standing jump cannot cross', () => {
  let sprints = 0;
  for (const seed of ['fly-0', 'fly-8', 'fly-15']) {
    const biome = generateBiome(seed, 2, null, ['flywheel']);
    if (!biome.rules.flywheel) continue;
    assertChains(biome, seed);
    assert.ok(biome.segments.some(s => s.sprint), `${seed} lays a sprint gap`);
    biome.segments.forEach((segment, k) => {
      if (!segment.sprint) return;
      sprints += segment.sprint.length;
      assert.ok(demandsMomentum(biome, segment), `${seed} segment ${k} needs momentum`);
    });
  }
  assert.ok(sprints >= 2, 'sprint gaps were laid');
});
