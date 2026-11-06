import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { initialState } from '../src/world/physics.js';
import { solve } from '../src/generation/solver.js';
import { stumbles } from '../src/generation/stumble.js';
import { introduces, unseen, hardened } from '../src/generation/focus.js';

const LEDGE = 30;

function gapLevel(dress = () => {}) {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  fillTiles(level, 3, LEDGE, 6, 1, SOLID);
  fillTiles(level, 12, LEDGE, 8, 1, SOLID);
  level.start = { x: 4 * TILE, y: LEDGE * TILE - 26 };
  dress(level);
  const start = { ...initialState(level), grounded: true };
  const goal = { x: 16 * TILE, y: (LEDGE - 2) * TILE, w: 4 * TILE, h: 2 * TILE };
  const proof = solve(level, { start, goal, route: [{ x: goal.x + goal.w / 2, y: goal.y + goal.h / 2 }], maxNodes: 40000 });
  assert.ok(proof, 'the gap is provable');
  return { level, segment: { inputs: proof.inputs, start } };
}

test('a plain hop between ledges never kills a slightly mistimed jump', () => {
  const { level, segment } = gapLevel();
  const { deaths, jumps, worst } = stumbles(level, segment);
  assert.ok(jumps >= 1);
  assert.equal(deaths, 0);
  assert.equal(worst, 0);
});

test('spikes on the landing edge kill some mistimed jumps and take the blame', () => {
  let spikes;
  const { level, segment } = gapLevel(level => { spikes = addObject(level, { type: 'spikes', x: 12 * TILE + 2, y: LEDGE * TILE - 14, w: 2 * TILE - 4, h: 14, dir: -1 }); });
  const { deaths, worst, blame } = stumbles(level, segment);
  assert.ok(deaths > 0 && worst > 0, `deaths ${deaths}`);
  assert.ok(blame.get(spikes.id) > 0, 'the spikes are blamed');
});

test('a beam that is off most of the time is harmless to a player who waits for the window', () => {
  const { level, segment } = gapLevel(level => addObject(level, { type: 'laser', x: 10 * TILE + 11, y: (LEDGE - 6) * TILE, w: 8, h: 7 * TILE, period: 240, on: 40, phase: 0, dir: 1 }));
  assert.equal(stumbles(level, segment).deaths, 0);
});

test('a stage introducing something the run has not shown stays gentle', () => {
  const gentle = { hop: 4 }, spec = { features: { mover: 1 }, connector: 'cling', moves: gentle, tempo: 240 };
  const seenAll = { history: [{ focus: 'a', shown: ['mover', 'cling'] }] };
  const seenSome = { history: [{ focus: 'a', shown: ['mover'] }] };
  assert.equal(introduces({ history: [] }, spec), false, 'an empty history introduces nothing');
  assert.equal(introduces(seenAll, spec), false);
  assert.equal(introduces(seenSome, spec), true);
  assert.deepEqual(unseen(seenSome, ['mover', 'cling', 'saw']), ['cling', 'saw']);
  assert.deepEqual(unseen({ history: [] }, ['cling']), []);
  assert.equal(hardened(spec, 1, true), spec);
  assert.notEqual(hardened(spec, 1, false).tempo, 240);
});
