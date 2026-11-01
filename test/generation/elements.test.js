import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome, BYPASS_SEARCHES } from '../../src/generator.js';
import { replay } from '../../src/solver.js';
import { playerSize } from '../../src/physics.js';
import { overlaps } from '../../src/level.js';
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
      assert.ok(!BYPASS_SEARCHES.some(search => solve(bare, { start: segment.start, goal, route: segment.route.filter(p => p.timer === undefined && !p.bit && p.body === undefined), ...search })), `${seed} stretch ${k} needs its timer`);
    });
  }
  assert.ok(runs >= 3, `${runs} timed runs`);
});

test('blade run biomes carry forks whose join is one leap from the ledge before the safe step', () => {
  let forks = 0;
  for (const seed of ['fork-1', 'fork-2', 'fork-3']) {
    const biome = generateBiome(seed, 4, null, [], 'saws');
    assertChains(biome, seed);
    forks += biome.moves.filter(m => m === 'fork').length / 2;
  }
  assert.ok(forks >= 2, `${forks} forks`);
});

import { tileAt, SOLID, TILE } from '../../src/level.js';

test('every cling strip keeps a solid wall beside it for its whole height', () => {
  let strips = 0, caves = 0;
  for (const seed of ['cling-1', 'cling-2', 'cling-3', 'cling-4', 'cling-5', 'cling-6']) {
    const biome = generateBiome(seed, 2, null, [], 'walls');
    if (biome.style === 'cave') caves++;
    for (const o of biome.objects.filter(o => o.type === 'cling')) {
      strips++;
      const col = Math.floor((o.x + o.w / 2) / TILE);
      for (let row = Math.round(o.y / TILE); row < Math.round((o.y + o.h) / TILE); row++) {
        assert.equal(tileAt(biome, col, row), SOLID, `${seed} (${biome.style}): cling at column ${col} row ${row} has no wall`);
      }
    }
  }
  assert.ok(strips >= 6 && caves >= 1, `${strips} strips, ${caves} cave biomes`);
});

test('a timed door stays open well past what the proof needs', () => {
  let doors = 0;
  for (const seed of ['slack-1', 'slack-2', 'slack-3']) {
    const biome = generateBiome(seed, 3, null, [], 'stopwatch');
    const { w, h } = playerSize(biome.rules);
    for (const segment of biome.segments) {
      const states = replay(biome, segment.inputs, segment.start);
      for (const door of biome.objects.filter(o => o.type === 'door' && o.timer !== undefined)) {
        const fired = states.findIndex(s => s.timers[door.timer] >= 0);
        const passed = states.findLastIndex(s => overlaps(s.x, s.y, w, h, door));
        if (fired < 0 || passed < fired) continue;
        doors++;
        assert.ok(door.open >= (passed - fired) * 1.7, `${seed}: open ${door.open}, proof needs ${passed - fired}`);
      }
    }
  }
  assert.ok(doors >= 2, `${doors} timed doors`);
});

test('waterworks is always open air, so its pools have somewhere to sit', () => {
  for (const seed of ['pool-1', 'pool-2', 'pool-3', 'pool-4']) {
    const biome = generateBiome(seed, 3, null, [], 'water');
    assert.equal(biome.style, 'open');
    assert.ok(biome.objects.some(o => o.type === 'water'), `${seed} has water`);
  }
});
