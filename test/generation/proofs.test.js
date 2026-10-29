import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { replay, kicked } from '../../src/solver.js';
import { playerSize } from '../../src/physics.js';
import { overlaps } from '../../src/level.js';
import { climb, assertChains } from './helpers.js';

test('items sit off the proven route and each has its own proof', () => {
  let seen = 0;
  for (const seed of ['items-a', 'items-b']) {
    climb(seed, 3).forEach((biome, index) => {
      const { w, h } = playerSize(biome.rules);
      const items = biome.objects.filter(o => o.type === 'item');
      const checkpoints = biome.objects.filter(o => o.type === 'checkpoint');
      assert.equal(biome.itemProofs.length, items.length, `${seed}/${index} proves every item`);
      for (const proof of biome.itemProofs) {
        const item = biome.objects[proof.item];
        const end = replay(biome, proof.inputs, proof.start).at(-1);
        assert.ok(end.taken & (1 << item.slot), `${seed}/${index} proof collects the ${item.kind}`);
        const goal = checkpoints[proof.segment];
        assert.ok(goal ? overlaps(end.x, end.y, w, h, goal) : end.won, `${seed}/${index} proof still reaches the goal`);
      }
      assert.ok(biome.segments.every(s => items.every(item => s.start.taken & (1 << item.slot))), `${seed}/${index} chain is proven without items`);
      seen += items.length;
    });
  }
  assert.ok(seen >= 4);
});

test('every segment is proven without wall kicks', () => {
  for (const [seed, forced] of [['kickless-a', ['momentum']], ['kickless-b', ['ice']], ['kickless-c', undefined]]) {
    const biome = generateBiome(seed, 2, null, forced);
    assertChains(biome, seed);
    for (const segment of biome.segments) {
      const states = replay(biome, segment.inputs, segment.start);
      assert.ok(states.every((s, i) => i === 0 || !kicked(states[i - 1], s)), `${seed} proof never kicks`);
    }
  }
});

test('monsters turn up in later biomes and every climb past them is proven', () => {
  const kinds = new Set();
  let squashed = 0;
  for (const seed of ['m1', 'm3', 'm4']) {
    const biome = generateBiome(seed, 2, null);
    assertChains(biome, seed);
    biome.objects.filter(o => o.type === 'monster').forEach(m => kinds.add(m.kind));
    squashed += biome.segments.filter(s => replay(biome, s.inputs, s.start).at(-1).slain).length;
  }
  assert.deepEqual([...kinds].sort(), ['flapper', 'patroller', 'spitter']);
  assert.ok(squashed > 0, 'some proof squashes a monster on the way up');
  assert.equal(generateBiome('m1', 0, null).objects.some(o => o.type === 'monster'), false, 'the first biome stays monster-free');
});
