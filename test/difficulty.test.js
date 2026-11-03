import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, COLS, TILE } from '../src/world/level.js';
import { buildRules, biomeBanes, isBane } from '../src/world/rules.js';
import { createRun, advance, atImp, difficultyOffer, wantedChain } from '../src/world/run.js';
import { DIFFICULTIES, rewardOf } from '../src/world/difficulty.js';
import { impX, nearImp } from '../src/world/imp.js';
import { playerSize } from '../src/world/physics.js';
import { decodeGhost, encodeGhost } from '../src/game/ghost.js';

const FLOOR = 71;

function biome(index, mutators = []) {
  const level = createLevel(buildRules(mutators), mutators, FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  Object.assign(level, { index, theme: 0, palette: 40, title: '', segments: [], entryCol: 4, exitCol: 4, timed: true, provenMutators: mutators });
  level.start = { x: 150, y: FLOOR * TILE - 26 };
  level.exit = { x: 120, y: -30, w: 60, h: 30 };
  for (const row of [52, 34, 16]) addObject(level, { type: 'checkpoint', x: 300, y: row * TILE - 40, w: 24, h: 40 });
  return level;
}

function generator() {
  const built = new Map();
  return want => built.get(want.index) ?? built.set(want.index, biome(want.index, want.rules)).get(want.index);
}

const flagsOf = level => level.objects.filter(o => o.type === 'checkpoint');
const started = (difficulty = 0, seed = 'tiers') => {
  const biomes = generator(), run = createRun(5, seed);
  run.difficulty = difficulty;
  advance(run, biomes);
  return { run, biomes };
};
const standAtImp = run => { run.s = { ...run.s, x: impX(run.level) - 10, y: FLOOR * TILE - playerSize(run.level.rules).h, vy: 0, grounded: true }; };
const gate = (run, biomes) => { run.s = { ...run.s, x: 140, y: -40, vy: -9 }; return advance(run, biomes, {}).entered; };

test('the four tiers pay what they promise, and a perfect climb doubles it', () => {
  assert.deepEqual(DIFFICULTIES.map(d => [d.id, d.banes, d.runes, d.gold]), [['normal', 0, 1, 100], ['hard', 1, 2, 200], ['torment', 2, 3, 400], ['impossible', 3, 5, 600]]);
  assert.deepEqual(rewardOf(3, false), { runes: 5, gold: 600 });
  assert.deepEqual(rewardOf(3, true), { runes: 10, gold: 1200 });
});

test('finishing a biome pays by the difficulty it was finished on', () => {
  DIFFICULTIES.forEach((tier, difficulty) => {
    const { run, biomes } = started(difficulty);
    assert.deepEqual(gate(run, biomes).reward, { runes: tier.runes, gold: tier.gold });
    assert.deepEqual([run.runes, run.points, run.earned], [tier.runes, tier.gold, tier.gold]);
  });
});

test('nothing is dealt unasked: normal keeps the biome exactly as it was built', () => {
  const biomes = generator(), run = createRun(5, 'plain');
  advance(run, biomes);
  assert.equal(run.level, biomes({ index: 0 }));
  assert.deepEqual(run.level.mutators, []);
  assert.equal(flagsOf(run.level).length, 3);
});

test('hard, torment and impossible add one, two and three banes and take one, two and all flags', () => {
  [[1, 1, 2], [2, 2, 1], [3, 3, 0]].forEach(([difficulty, banes, flags]) => {
    const { run } = started(difficulty);
    assert.equal(run.level.mutators.filter(isBane).length, banes);
    assert.equal(flagsOf(run.level).length, flags);
    assert.equal(run.level.objects.length, run.level.proven.objects.length, 'object ids stay put');
  });
});

test('the biome is proven without banes: difficulty never asks for a rebuild', () => {
  const { run, biomes } = started(0);
  const before = JSON.stringify(wantedChain(run, 2));
  standAtImp(run);
  advance(run, biomes, { difficulty: 3 });
  assert.equal(JSON.stringify(wantedChain(run, 2)), before);
  assert.equal(run.level.tiles, run.level.proven.tiles);
});

test('the imp only hears you when you stand by it on the floor', () => {
  const { run, biomes } = started();
  run.s = { ...run.s, x: impX(run.level) + 200, grounded: true };
  assert.equal(atImp(run), false);
  assert.equal(advance(run, biomes, { difficulty: 2 }), null);
  assert.equal(run.difficulty, 0);
  standAtImp(run);
  assert.equal(nearImp(run.level, { ...run.s, y: run.s.y - 90 }), false, 'not from the air above it');
  assert.equal(advance(run, biomes, { difficulty: 0 }), null, 'the difficulty you already have is no change');
  assert.equal(advance(run, biomes, { difficulty: 9 }), null);
});

test('changing difficulty wipes your flags and clock, keeps you at the imp and refills nothing', () => {
  const { run, biomes } = started();
  const flag = flagsOf(run.level)[2];
  run.s = { ...run.s, x: flag.x, y: flag.y + 14 };
  advance(run, biomes, {});
  assert.equal(run.touched.length, 1);
  Object.assign(run, { elapsed: 500, lives: 2 });
  standAtImp(run);
  run.s = { ...run.s, coins: 5, placed: [{ kind: 'tomb', x: 0, y: 0, w: 10, h: 10 }, { kind: 'plank', x: 0, y: 0, w: 10, h: 10 }] };
  const x = run.s.x;
  assert.equal(advance(run, biomes, { difficulty: 1 }).type, 'difficulty');
  assert.deepEqual([run.touched, run.elapsed, run.lives, run.s.coins, run.s.x], [[], 0, 2, 5, x]);
  assert.deepEqual(run.s.placed.map(rect => rect.kind), ['plank'], "old deaths leave no stepping stones");
  run.s = { ...run.s, grounded: true };
  advance(run, biomes, { restart: true });
  assert.equal(run.s.y, run.level.start.y, 'R has nowhere to go but the floor');
  standAtImp(run);
  advance(run, biomes, { difficulty: 0 });
  assert.equal(flagsOf(run.level).length, 3, 'going back down brings the flags back');
  assert.deepEqual(run.level.mutators, []);
});

test('a difficulty you choose carries into the next biome', () => {
  const { run, biomes } = started();
  standAtImp(run);
  advance(run, biomes, { difficulty: 2 });
  gate(run, biomes);
  assert.equal(run.index, 1);
  assert.deepEqual(run.level.mutators, biomeBanes('tiers', 1, 2, true));
  assert.equal(flagsOf(run.level).length, 1);
});

test('the imp offers each tier with its banes, flags and reward', () => {
  const { run } = started(1);
  const offer = difficultyOffer(run);
  assert.deepEqual(offer.map(t => t.flags), [3, 2, 1, 0]);
  assert.deepEqual(offer.map(t => t.current), [false, true, false, false]);
  assert.deepEqual(offer[3].rules, biomeBanes('tiers', 0, 3, true));
});

test('a recorded difficulty change travels in a ghost', async () => {
  const recording = { codes: [0, 0, 1], acts: [{ at: 2, type: 'difficulty', value: 3 }] };
  assert.deepEqual((await decodeGhost(await encodeGhost(recording))).acts, recording.acts);
});
