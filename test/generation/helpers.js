import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { replay } from '../../src/generation/solver.js';
import { playerSize } from '../../src/world/physics.js';
import { standAt } from '../../src/world/climb.js';
import { overlaps, TILE } from '../../src/world/level.js';

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


const TURN_TILES = 3;

export function walkOf(level, segment) {
  const { h } = playerSize(level.rules);
  const bands = segment.bounds.bands;
  const seen = new Set();
  let deck = null, far = 0, heading = 0, turnbacks = 0, returns = 0;
  for (const s of replay(level, segment.inputs, segment.start)) {
    if (!s.grounded) continue;
    const feet = s.y + h, here = bands.filter(band => band * TILE >= feet - 1).at(-1) ?? null;
    if (here === null) continue;
    if (here !== deck) {
      if (seen.has(here)) returns++;
      seen.add(here);
      deck = here;
      far = s.x;
      heading = 0;
      continue;
    }
    const moved = (s.x - far) / TILE;
    if (heading * moved > 0 || !heading) {
      if (Math.abs(moved) >= TURN_TILES || heading) { heading = Math.sign(moved); far = s.x; }
    } else if (Math.abs(moved) >= TURN_TILES) {
      turnbacks++;
      heading = Math.sign(moved);
      far = s.x;
    }
  }
  return { turnbacks, returns, trivial: turnbacks + returns === 0 };
}
