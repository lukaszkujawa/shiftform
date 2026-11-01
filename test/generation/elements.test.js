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

test('crystal climbs soar over refills and are proven', () => {
  let refills = 0, soars = 0;
  for (const seed of ['crystal-1', 'crystal-2', 'crystal-3']) {
    const biome = generateBiome(seed, 3, null, [], 'crystals');
    assertChains(biome, seed);
    refills += count(biome, 'refill');
    soars += biome.moves.filter(m => m === 'soar').length;
  }
  assert.ok(refills >= 4, `${refills} refills`);
  assert.ok(soars >= 2, `${soars} soars`);
});

import { solve } from '../../src/solver.js';

test('stopwatch biomes run timed doors that cannot be passed without the timer', () => {
  let runs = 0;
  for (const seed of ['timer-1', 'timer-2', 'timer-3']) {
    const biome = generateBiome(seed, 3, null, [], 'stopwatch');
    assertChains(biome, seed);
    biome.segments.forEach((segment, k) => {
      if (segment.puzzle !== 'timedRun') return;
      runs++;
      const slot = segment.route.find(p => p.timer !== undefined).timer;
      const bare = { ...biome, objects: biome.objects.map(o => o.type === 'timer' && o.slot === slot ? { ...o, type: 'removed' } : o) };
      const goal = biome.objects.filter(o => o.type === 'checkpoint')[k] ?? null;
      assert.equal(solve(bare, { start: segment.start, goal, route: segment.route.filter(p => p.timer === undefined && !p.bit && p.body === undefined), maxNodes: 10000 }), null, `${seed} stretch ${k} needs its timer`);
    });
  }
  assert.ok(runs >= 3, `${runs} timed runs`);
});
