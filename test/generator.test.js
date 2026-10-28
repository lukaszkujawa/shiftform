import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../src/generator.js';
import { replay } from '../src/solver.js';
import { playerSize } from '../src/physics.js';
import { standAt } from '../src/climb.js';
import { overlaps, serializeLevel, deserializeLevel, COLS } from '../src/level.js';

const climb = (seed, count) => {
  const biomes = [];
  let entryCol = null;
  for (let index = 0; index < count; index++) {
    const biome = generateBiome(seed, index, entryCol);
    biomes.push(biome);
    entryCol = biome.exitCol;
  }
  return biomes;
};

function assertChains(level, label) {
  const { w, h } = playerSize(level.rules);
  const checkpoints = level.objects.filter(o => o.type === 'checkpoint');
  assert.equal(checkpoints.length, level.segments.length - 1, `${label} has a checkpoint per segment boundary`);
  level.segments.forEach((segment, k) => {
    const end = replay(level, segment.inputs, segment.start).at(-1);
    if (k === level.segments.length - 1) {
      assert.equal(end.won, true, `${label} last segment reaches the exit`);
      return;
    }
    const checkpoint = checkpoints[k];
    assert.ok(overlaps(end.x, end.y, w, h, checkpoint), `${label} segment ${k} reaches its checkpoint`);
    const next = level.segments[k + 1].start;
    const stood = standAt(level, end, checkpoint);
    assert.equal(next.x, stood.x, `${label} segment ${k + 1} starts on checkpoint ${k}`);
    assert.equal(next.y, stood.y);
  });
}

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

test('biome generation is deterministic and survives serialization', () => {
  const a = generateBiome('hello', 0, null);
  const b = generateBiome('hello', 0, null);
  assert.deepEqual(serializeLevel(a), serializeLevel(b));
  const copy = deserializeLevel(JSON.parse(JSON.stringify(serializeLevel(a))));
  assertChains(copy, 'copy');
});
