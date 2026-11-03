import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { replay, solve } from '../../src/generation/solver.js';
import { START_POSITIONS } from '../../src/world/level.js';
import { assertChains } from './helpers.js';

const rigged = biome => biome.objects.filter(o => o.grip || o.type === 'cannon');
const usedBy = (biome, segment) => replay(biome, segment.inputs, segment.start).some(s => s.barrel >= 0 || (s.rope >= 0 && biome.objects[s.rope].grip));

for (const focus of ['momentum', 'cannons']) {
  test(`${focus} biomes are proven and their proofs really use the rigs`, () => {
    let rigs = 0, used = 0;
    for (const seed of [`${focus}-a`, `${focus}-b`, `${focus}-c`]) {
      const biome = generateBiome(seed, 3, null, [], focus);
      assert.equal(biome.focus, focus);
      assertChains(biome, seed);
      rigs += rigged(biome).length;
      used += biome.segments.filter(segment => usedBy(biome, segment)).length;
    }
    assert.ok(rigs >= 6, `${rigs} rigs`);
    assert.ok(used >= 4, `${used} stretches use them`);
  });
}

test('a rig gap cannot be crossed without the rig', () => {
  let gaps = 0, crossed = 0;
  for (const seed of ['gap-a', 'gap-b', 'gap-c', 'gap-d']) {
    const biome = generateBiome(seed, 3, null, [], 'momentum');
    const bare = { ...biome, objects: biome.objects.map(o => (o.grip ? { ...o, type: 'removed' } : o)) };
    const goals = biome.objects.filter(o => o.type === 'checkpoint');
    biome.segments.forEach((segment, k) => {
      if (!usedBy(biome, segment)) return;
      gaps++;
      const route = segment.route.filter(p => !p.rope);
      if (solve(bare, { start: segment.start, goal: goals[k] ?? null, route, grain: 3, maxNodes: 8000 })) crossed++;
    });
  }
  assert.ok(gaps >= 3, `${gaps} rigged stretches`);
  assert.ok(crossed * 2 <= gaps, `${crossed} of ${gaps} crossed without the rig`);
});

test('generated wheels, pendulums and rails start from varied, discrete positions', () => {
  const handles = ['rig-1', 'rig-2', 'rig-3', 'rig-4'].flatMap(seed => generateBiome(seed, 2, null, [], 'momentum').objects.filter(o => o.type === 'hook' && o.grip));
  const rails = handles.filter(o => !o.motion), wheels = handles.filter(o => o.motion === 'orbit'), swings = handles.filter(o => o.motion === 'swing');
  for (const o of handles) assert.equal(Number.isInteger((o.phase * START_POSITIONS) / o.period), true, `phase ${o.phase} of ${o.period}`);
  for (const group of [rails, swings]) if (group.length > 1) assert.ok(new Set(group.map(o => o.phase)).size > 1, 'not all starting together');
  assert.ok(handles.length > 4 && new Set(handles.map(o => o.phase)).size > 2);
  assert.ok(wheels.length + rails.length + swings.length === handles.length);
});

