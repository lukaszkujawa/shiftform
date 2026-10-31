import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { replay } from '../../src/solver.js';
import { playerSize } from '../../src/physics.js';
import { standAt } from '../../src/climb.js';
import { overlaps } from '../../src/level.js';

export const climb = (seed, count) => {
  const biomes = [];
  let entryCol = null;
  for (let index = 0; index < count; index++) {
    const biome = generateBiome(seed, index, entryCol);
    biomes.push(biome);
    entryCol = biome.exitCol;
  }
  return biomes;
};

export function assertChains(level, label) {
  const { w, h } = playerSize(level.rules);
  const checkpoints = level.objects.filter(o => o.type === 'checkpoint');
  assert.equal(checkpoints.length, level.segments.length - 1, `${label} has a checkpoint per segment boundary`);
  level.segments.forEach((segment, k) => {
    const states = replay(level, segment.inputs, segment.start), end = states.at(-1);
    if (k === level.segments.length - 1) {
      assert.equal(end.won, true, `${label} last segment reaches the exit`);
      return;
    }
    const checkpoint = checkpoints[k];
    const touch = states.findIndex(s => overlaps(s.x, s.y, w, h, checkpoint));
    assert.equal(touch, states.length - 1, `${label} segment ${k} ends the moment it first touches its checkpoint`);
    const next = level.segments[k + 1].start;
    const stood = standAt(level, end, checkpoint);
    assert.equal(next.x, stood.x, `${label} segment ${k + 1} starts on checkpoint ${k}`);
    assert.equal(next.y, stood.y);
    assert.equal(next.clock, stood.clock, `${label} segment ${k + 1} starts on the clock of that first touch`);
  });
}

