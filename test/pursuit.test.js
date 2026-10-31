import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PURSUIT, pursuitOf, pursuitLevel } from '../src/pursuit.js';

const HEIGHT = 2000, PLAYER = 26;
const climb = t => (t < 60 ? 1900 : t < 400 ? 1900 - (t - 60) * 2 : t < 500 ? 1220 + (t - 400) : 1320 - (t - 500) * 3);
const states = Array.from({ length: 900 }, (_, t) => ({ tide: t - 1, y: climb(t) - PLAYER }));

test('the pursuer starts below the biome, never rises faster than its rate and never reaches the proof', () => {
  const table = pursuitOf(states, PLAYER, HEIGHT);
  assert.ok(pursuitLevel(table, 0) >= HEIGHT && pursuitLevel(table, 0) <= HEIGHT + PURSUIT.below, 'starts just below the biome');
  assert.ok(pursuitLevel(table, 1) < HEIGHT + PURSUIT.below, 'and is already creeping on the first tick');
  let previous = pursuitLevel(table, 0);
  for (let tide = 1; tide < 3000; tide++) {
    const y = pursuitLevel(table, tide);
    assert.ok(y <= previous, `rises monotonically at ${tide}`);
    assert.ok(previous - y <= PURSUIT.rate + 1e-9, `rises at most ${PURSUIT.rate} per tick at ${tide}`);
    const steady = tide > 60 * PURSUIT.slack + PURSUIT.delay + 2 * PURSUIT.step && tide < 400 * PURSUIT.slack + PURSUIT.delay - 2 * PURSUIT.step;
    if (steady) assert.ok(previous - y >= PURSUIT.creep - 1e-9, `and never idles while the proof climbs: at least ${PURSUIT.creep} per tick at ${tide}`);
    previous = y;
  }
  for (const s of states) {
    const feet = s.y + PLAYER;
    assert.ok(pursuitLevel(table, Math.max(0, s.tide)) >= feet + PURSUIT.margin - 1e-9, `keeps its margin under the proof at tide ${s.tide}`);
  }
});

test('a climber at the slack pace stays ahead and the pursuer keeps coming after the proof ends', () => {
  const table = pursuitOf(states, PLAYER, HEIGHT);
  for (let tide = 0; tide < 898 * PURSUIT.slack + PURSUIT.delay; tide++) {
    const feet = climb(Math.floor((tide - PURSUIT.delay) / PURSUIT.slack) + 1);
    if (tide >= PURSUIT.delay) assert.ok(pursuitLevel(table, tide) >= feet, `a slow climber survives at tide ${tide}`);
  }
  const end = (table.ys.length - 1) * table.step;
  assert.ok(pursuitLevel(table, end + 1000) < pursuitLevel(table, end), 'the tail keeps rising');
  assert.ok(pursuitLevel(table, 100000) < 0, 'and eventually swallows the biome');
});
