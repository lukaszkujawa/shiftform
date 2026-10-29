import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { serializeLevel, deserializeLevel, COLS } from '../../src/level.js';
import { climb, assertChains } from './helpers.js';

const SIGNATURES = { first: ['mover', 'crumble'], crates: ['crate'], phase: ['phase'], movers: ['mover'], crumbles: ['crumble'], swing: ['hook'], timing: ['laser', 'gate'], locks: ['key', 'switch'], saws: ['saw'] };

test('biomes are tall levels whose segments chain to the exit', () => {
  for (const seed of ['one', 'two', 'three']) {
    climb(seed, 2).forEach((biome, index) => {
      assert.equal(biome.rows, 72);
      assertChains(biome, `${seed}/${index}`);
    });
  }
});

test('each biome opens where the next one has its hatch', () => {
  const [a, b] = climb('gates', 2);
  assert.ok(a.exitCol >= 0 && a.exitCol < COLS - 1);
  assert.equal(b.entryCol, a.exitCol);
});

test('biome generation is deterministic, reports its progress and survives serialization', () => {
  const progress = [];
  const a = generateBiome('hello', 0, null, null, null, (fraction, stage) => progress.push({ fraction, stage }));
  const b = generateBiome('hello', 0, null);
  assert.deepEqual(serializeLevel(a), serializeLevel(b));
  assert.ok(progress.length >= 8, `${progress.length} progress reports`);
  assert.ok(progress.every(p => p.fraction >= 0 && p.fraction <= 1 && typeof p.stage === 'string' && p.stage.length > 0));
  assert.ok(progress.some(p => /stretch 4/.test(p.stage)) && progress.at(-1).fraction >= 0.9, JSON.stringify(progress.at(-1)));
  const copy = deserializeLevel(JSON.parse(JSON.stringify(serializeLevel(a))));
  assertChains(copy, 'copy');
});

test('biomes are built around a focus whose elements appear', () => {
  for (const seed of ['focus-a', 'focus-b']) {
    climb(seed, 3).forEach((biome, index) => {
      assert.ok(SIGNATURES[biome.focus], `${seed}/${index} has a focus`);
      assert.ok(biome.objects.some(o => SIGNATURES[biome.focus].includes(o.type)), `${seed}/${index} ${biome.focus} shows its elements`);
      assert.ok(biome.title.length > 0);
      assertChains(biome, `${seed}/${index}`);
    });
  }
});
