import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome, demandsMomentum } from '../../src/generator.js';
import { assertChains } from './helpers.js';

test('flywheel biomes contain sprint gaps that a standing jump cannot cross', () => {
  let sprints = 0, flywheels = 0;
  for (const seed of ['fly-8', 'fly-15', 'fly-3', 'fly-0', 'fly-4', 'fly-5']) {
    if (flywheels >= 2 && sprints >= 2) break;
    const biome = generateBiome(seed, 2, null, ['flywheel']);
    if (!biome.rules.flywheel) continue;
    flywheels++;
    assertChains(biome, seed);
    biome.segments.forEach((segment, k) => {
      if (!segment.sprint) return;
      sprints += segment.sprint.length;
      assert.ok(demandsMomentum(biome, segment), `${seed} segment ${k} needs momentum`);
    });
  }
  assert.ok(flywheels >= 2 && sprints >= 2, `${flywheels} flywheel biomes with ${sprints} sprint gaps`);
});
