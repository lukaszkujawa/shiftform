import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../src/generator.js';
import { replay } from '../src/solver.js';
import { serializeLevel, deserializeLevel } from '../src/level.js';

test('generation is deterministic for a seed and index', () => {
  const a = generateLevel('hello', 3);
  const b = generateLevel('hello', 3);
  assert.deepEqual(serializeLevel(a), serializeLevel(b));
});

test('different seeds give different levels', () => {
  const a = generateLevel('alpha', 1);
  const b = generateLevel('beta', 1);
  assert.notDeepEqual(Array.from(a.tiles), Array.from(b.tiles));
});

test('every generated level replays its solution to the exit', () => {
  for (const seed of ['one', 'two', 'three', 'four', 'five', 'six']) {
    for (let index = 1; index <= 8; index++) {
      const level = generateLevel(seed, index);
      assert.ok(level.solution.length > 0, `${seed}/${index} has a solution`);
      assert.ok(level.objects.length > 0, `${seed}/${index} has at least one object`);
      const states = replay(level, level.solution);
      assert.equal(states[states.length - 1].won, true, `${seed}/${index} solution reaches the exit`);
    }
  }
});

test('levels survive serialization', () => {
  const level = generateLevel('roundtrip', 5);
  const copy = deserializeLevel(JSON.parse(JSON.stringify(serializeLevel(level))));
  const states = replay(copy, level.solution);
  assert.equal(states[states.length - 1].won, true);
});

test('physics puzzles are solved by moving crates or swinging', () => {
  const cases = [['five', 11, 'crateStep'], ['two', 10, 'plateDoor'], ['ember-4', 2, 'plateBridge'], ['two', 9, 'throwSwitch'], ['ember-4', 5, 'swing']];
  for (const [seed, index, puzzle] of cases) {
    const level = generateLevel(seed, index);
    assert.equal(level.puzzle, puzzle, `${seed}/${index} builds ${puzzle}`);
    const states = replay(level, level.solution);
    const first = states[0];
    assert.equal(states.at(-1).won, true, `${seed}/${index} reaches the exit`);
    const used = states.some(s => s.rope >= 0 || s.held >= 0 || s.bodies.some((b, k) => Math.abs(b.x - first.bodies[k].x) > 20 || Math.abs(b.y - first.bodies[k].y) > 20));
    assert.ok(used, `${seed}/${index} solution uses its ${puzzle}`);
  }
});
