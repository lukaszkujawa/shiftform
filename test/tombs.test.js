import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { initialState, step, playerSize } from '../src/world/physics.js';
import { TOMB, tombOf } from '../src/world/tombs.js';

function yard() {
  const level = createLevel(buildRules([]), [], 30);
  fillTiles(level, 0, 28, 10, 2, SOLID);
  fillTiles(level, 20, 28, 12, 2, SOLID);
  fillTiles(level, 4, 20, 4, 1, ONE_WAY);
  fillTiles(level, 24, 24, 3, 1, SOLID);
  return level;
}

const dying = (level, x, y, placed = []) => ({ ...initialState(level), x, y, frame: 500, placed });

test('a tombstone falls from the death spot until it lands, on rock, on a one-way ledge or on a plank, and never when it would leave the biome', () => {
  const level = yard(), { w } = playerSize(level.rules);
  const onRock = tombOf(level, dying(level, 25 * TILE, 10 * TILE));
  assert.equal(onRock.y + TOMB.h, 24 * TILE, 'rests on the first solid top below');
  assert.equal(onRock.x, Math.round(25 * TILE + w / 2 - TOMB.w / 2));
  assert.deepEqual([onRock.from, onRock.born], [10 * TILE, 500]);
  assert.equal(tombOf(level, dying(level, 5 * TILE, 5 * TILE)).y + TOMB.h, 20 * TILE, 'a one-way ledge catches it');
  const plank = { kind: 'plank', x: 12 * TILE, y: 15 * TILE, w: 3 * TILE, h: TILE, id: -1 };
  assert.equal(tombOf(level, dying(level, 13 * TILE, 5 * TILE, [plank])).y + TOMB.h, 15 * TILE, 'a built plank catches it');
  assert.equal(tombOf(level, dying(level, 13 * TILE, 20 * TILE)), null, 'the pit swallows it');
  assert.equal(tombOf(level, dying(level, 2 * TILE, 28 * TILE)).y + TOMB.h, 28 * TILE, 'dying inside rock leaves the stone on top of it');
  const first = tombOf(level, dying(level, 25 * TILE, 10 * TILE));
  assert.equal(tombOf(level, { ...dying(level, 25 * TILE, 10 * TILE), tombs: [first] }).y, first.y, 'dying twice in one spot never stacks the stones');
});

test('a tombstone is only scenery: you fall and walk straight through it and cannot kick off it', () => {
  const level = yard(), { w, h } = playerSize(level.rules);
  const tomb = tombOf(level, dying(level, 25 * TILE, 10 * TILE));
  const fall = { ...initialState(level), x: tomb.x + tomb.w / 2 - w / 2, y: tomb.y - h - 40, vy: 0 };
  const watch = (from, input, frames) => { const seen = [from]; for (let i = 0; i < frames; i++) seen.push(step(level, seen.at(-1), input)); return seen; };
  const ends = [fall, { ...fall, tombs: [tomb] }].map(s => watch(s, {}, 60).at(-1));
  assert.deepEqual([ends[1].x, ends[1].y, ends[1].grounded], [ends[0].x, ends[0].y, ends[0].grounded], 'falls through the stone as if it were not there');
  const walk = { ...initialState(level), x: tomb.x - w - 20, y: 24 * TILE - h, vy: 0, grounded: true };
  const walked = [walk, { ...walk, tombs: [tomb] }].map(s => watch(s, { right: true }, 30).at(-1).x);
  assert.equal(walked[1], walked[0], 'walks through it');
  const air = { ...initialState(level), x: tomb.x - w, y: tomb.y + TOMB.h - 2 - h, vy: 2, jumpsLeft: 0, tombs: [tomb] };
  assert.equal(step(level, air, { jump: true }).lastKick, 0, 'gives nothing to kick off');
});

test('a laser destroys a tombstone that would land in its beam', () => {
  const level = yard();
  const { w } = playerSize(level.rules);
  addObject(level, { type: 'laser', x: 25 * TILE + 11, y: 18 * TILE, w: 8, h: 6 * TILE, dir: 1, period: 240, on: 240, phase: 0 });
  assert.equal(tombOf(level, dying(level, 25 * TILE + 15 - w / 2, 20 * TILE)), null, 'nothing left in the beam');
  assert.ok(tombOf(level, dying(level, 21 * TILE, 10 * TILE)), 'a stone away from the beam stands');
});

const sprung = () => {
  const level = yard();
  addObject(level, { type: 'spring', x: 25 * TILE, y: 24 * TILE - 12, w: 22, h: 12, dir: -1, vel: 12 });
  return level;
};

test('dying at a trampoline catapults the stone off in a direction of its own', () => {
  const level = sprung();
  const tombs = Array.from({ length: 40 }, (_, k) => tombOf(level, { ...dying(level, 25 * TILE, 24 * TILE - 26), frame: 500 + k })).filter(Boolean);
  assert.ok(tombs.length > 10, `${tombs.length} landed`);
  assert.ok(tombs.every(t => t.path.length > 3), 'each flies');
  assert.ok(new Set(tombs.map(t => t.x)).size > 5, 'to different places');
  assert.ok(tombs.some(t => t.x < 25 * TILE) && tombs.some(t => t.x > 25 * TILE), 'both ways');
  assert.ok(tombs.every(t => t.path.some(([, y]) => y < 24 * TILE - 26)), 'upwards first');
  assert.ok(tombs.every(t => t.x >= 0 && t.x + TOMB.w <= 32 * TILE), 'it stays on the screen');
  const one = tombOf(level, dying(level, 25 * TILE, 24 * TILE - 26));
  assert.deepEqual(tombOf(level, dying(level, 25 * TILE, 24 * TILE - 26)), one, 'the same every replay, so a ghost agrees');
  assert.equal(tombOf(level, dying(level, 21 * TILE, 10 * TILE)).path, undefined, 'away from a trampoline it just falls');
  assert.ok(tombOf(yard(), dying(yard(), 25 * TILE, 10 * TILE)));
});

test('a built trampoline catapults a stone too', () => {
  const level = yard();
  const pad = { kind: 'trampoline', x: 25 * TILE, y: 24 * TILE - 10, w: 30, h: 10, id: -1 };
  const tomb = Array.from({ length: 10 }, (_, k) => tombOf(level, { ...dying(level, 25 * TILE, 24 * TILE - 26, [pad]), frame: 700 + k })).find(Boolean);
  assert.ok(tomb.path);
});
