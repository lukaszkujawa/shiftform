import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedBiomes } from './fixed-biomes.js';
import { createLevel, addObject, fillTiles, SOLID, ONE_WAY, TILE, COLS, WIDTH } from '../src/world/level.js';
import { buildRules, MUTATORS } from '../src/world/rules.js';
import { withSkills } from '../src/world/skills.js';
import { createRun, advance, stallOf } from '../src/world/run.js';
import { hallOf } from '../src/world/tunnel.js';
import { TRICK_COST } from '../src/world/tricks.js';

function biome() {
  const level = createLevel(buildRules([]), [], 72);
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  fillTiles(level, 15, 71, 2, 1, ONE_WAY);
  Object.assign(level, { index: 0, theme: 0, palette: 120, title: '', segments: [], exit: { x: 0, y: -10 * TILE, w: 0, h: 0 } });
  level.start = { x: 15 * TILE + 5, y: 71 * TILE - 26 };
  return level;
}

function walk(run, biomes, input, until, limit = 2000) {
  for (let i = 0; i < limit; i++) {
    const event = advance(run, biomes, run.phase === 'rewrite' ? { done: true } : input);
    if (until(event)) return event;
  }
  return null;
}

test('walking off either edge of the floor goes through the underpass and wraps to the other side', () => {
  const level = biome(), biomes = fixedBiomes([[0, level]]);
  for (const [key, dir] of [['left', -1], ['right', 1]]) {
    const run = createRun(5);
    advance(run, biomes);
    run.s = { ...run.s, fuel: 40 };
    assert.equal(walk(run, biomes, { [key]: true }, e => e?.type === 'underpass')?.type, 'underpass');
    assert.ok(run.level.hall && run.hall.level.tiles === level.tiles, 'inside the hall');
    assert.equal(run.s.fuel, 40, 'items come along');
    assert.ok(dir < 0 ? run.s.x > WIDTH / 2 : run.s.x < WIDTH / 2, 'enters at the far end of the hall');
    assert.equal(walk(run, biomes, { [key]: true }, e => e?.type === 'surface')?.type, 'surface');
    assert.equal(run.level.tiles, level.tiles);
    assert.ok(dir < 0 ? run.s.x > WIDTH - 3 * TILE : run.s.x < 3 * TILE, 'comes out on the opposite edge of the climb');
    assert.equal(run.s.fuel, 40);
  }
});

test('turning back in the hall returns to the edge you came from, and R leaves the hall', () => {
  const level = biome(), biomes = fixedBiomes([[0, level]]);
  const run = createRun(5);
  advance(run, biomes);
  walk(run, biomes, { left: true }, e => e?.type === 'underpass');
  walk(run, biomes, { right: true }, e => e?.type === 'surface');
  assert.ok(run.s.x < 3 * TILE, 'back at the left edge');
  walk(run, biomes, { left: true }, e => e?.type === 'underpass');
  for (let i = 0; i < 20; i++) advance(run, biomes, {});
  advance(run, biomes, { restart: true });
  assert.equal(run.level.tiles, level.tiles);
  assert.equal(run.hall, null);
});

test('a comet bought in the underpass waits for the surface', () => {
  const level = biome(), biomes = fixedBiomes([[0, level], [1, level]]);
  addObject(level, { type: 'coin', x: level.start.x, y: level.start.y, w: 14, h: 14 });
  const run = createRun(5);
  advance(run, biomes);
  advance(run, biomes, {});
  assert.deepEqual([run.points, run.earned], [1, 1], 'a coin scores');
  run.index = 1;
  walk(run, biomes, { left: true }, () => stallOf(run) === 'merchant');
  run.offer = ['comet', 'plank', 'heart'];
  run.points = TRICK_COST;
  assert.equal(advance(run, biomes, { pick: 1 }).kind, 'comet');
  assert.deepEqual([run.points, run.earned], [0, 1], 'spending keeps the score');
  assert.equal(run.s.comet, 0, 'not in the hall');
  for (let i = 0; i < 30; i++) advance(run, biomes, {});
  assert.ok(run.s.grounded && run.s.vy === 0, 'still walking the hall floor');
  walk(run, biomes, { left: true }, e => e?.type === 'surface');
  assert.ok(run.s.comet > 0, 'the comet fires on the surface');
});

test('mirrored controls carry you straight through the underpass', () => {
  const level = biome(), mirrored = { ...level, rules: buildRules(['mirror']), mutators: ['mirror'] };
  const biomes = fixedBiomes([[0, mirrored]]);
  const run = createRun(5);
  advance(run, biomes);
  const passes = [];
  for (let i = 0; i < 900; i++) {
    const type = advance(run, biomes, { left: true })?.type;
    if (type === 'underpass' || type === 'surface') passes.push({ type, i });
  }
  assert.ok(passes.length >= 2 && passes[0].type === 'underpass' && passes[1].type === 'surface');
  assert.ok(passes[1].i - passes[0].i > 150, 'walked the whole hall instead of bouncing back');
  const hall = hallOf(mirrored);
  assert.equal(hall.rules.mirror, true);
});

test('a bane worn on a harder difficulty comes off in the underpass and back on at the surface', () => {
  const level = biome(), biomes = fixedBiomes([[0, level]]);
  const run = createRun(5, 'underground');
  advance(run, biomes);
  Object.assign(run, { difficulty: 3, skills: { shield: 2 } });
  run.level = { ...level, rules: withSkills(buildRules(['heavy', 'ice', 'glass']), run.skills), mutators: ['heavy', 'ice', 'glass'] };
  const above = run.level;
  walk(run, biomes, { left: true }, e => e?.type === 'underpass');
  assert.deepEqual(run.level.mutators, []);
  assert.equal(run.level.rules.gravity, buildRules([]).gravity);
  assert.equal(run.level.rules.fallDamage, false);
  assert.equal(run.level.rules.shields, 2);
  walk(run, biomes, { right: true }, e => e?.type === 'surface');
  assert.equal(run.level, above);
});

test('every bane but mirrored controls stays above ground, while boons and skills come along', () => {
  const level = biome(), plain = hallOf({ ...level, rules: buildRules([]), mutators: [] }).rules;
  for (const { id } of MUTATORS.filter(m => m.effect === 'bane')) {
    const hall = hallOf({ ...level, rules: buildRules([id]), mutators: [id] });
    assert.deepEqual(hall.rules, id === 'mirror' ? { ...plain, mirror: true } : plain, id);
    assert.deepEqual(hall.mutators, id === 'mirror' ? ['mirror'] : [], id);
  }
  const skilled = { dash: 2, shield: 3, jump: 1 };
  const hall = hallOf({ ...level, rules: withSkills(buildRules(['heavy', 'glide']), skilled), mutators: ['heavy', 'glide'] }, skilled);
  assert.deepEqual(hall.rules, { ...withSkills(buildRules(['glide']), skilled), blinkJump: false });
  assert.deepEqual(hall.mutators, ['glide']);
});
