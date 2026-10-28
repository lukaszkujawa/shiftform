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

const SIGNATURES = { crates: ['crate'], phase: ['phase'], movers: ['mover'], crumbles: ['crumble'], swing: ['hook'], timing: ['laser', 'gate'], locks: ['key', 'switch'], saws: ['saw'] };

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
      assert.ok(biome.segments.every(s => s.start.taken === (1 << items.length) - 1), `${seed}/${index} chain is proven without items`);
      seen += items.length;
    });
  }
  assert.ok(seen >= 4);
});
