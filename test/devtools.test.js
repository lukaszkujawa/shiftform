import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, framesOf, causeOfDeath } from '../src/devtools.js';
import { createLevel, fillTiles, addObject, SOLID, ROWS, COLS, TILE } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, playerSize } from '../src/physics.js';

test('a script spells out held keys, taps, waits and raw key presses frame by frame', () => {
  const frames = parseScript('right 3, right+jump 2, wait 2, tap jump, press KeyR');
  assert.deepEqual(frames.map(f => f.keys), [['right'], ['right'], ['right'], ['right', 'jump'], ['right', 'jump'], [], [], ['jump'], []]);
  assert.equal(frames.at(-1).press, 'KeyR');
  assert.throws(() => parseScript('fly 3'), /unknown key/);
  assert.deepEqual(framesOf([{ left: true, jump: false }, { jump: true }]).map(f => f.keys), [['left'], ['jump']]);
});

test('a death names the hazard that caused it', () => {
  const level = createLevel(buildRules([]), [], ROWS);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  const { h } = playerSize(level.rules);
  addObject(level, { type: 'spikes', x: 8 * TILE, y: (ROWS - 1) * TILE - 14, w: TILE, h: 14, dir: -1 });
  level.start = { x: 6 * TILE, y: (ROWS - 1) * TILE - h };
  let prev = initialState(level), s = prev;
  for (let i = 0; i < 60 && !s.dead; i++) { prev = s; s = step(level, s, { right: true }); }
  assert.equal(s.dead, true);
  assert.match(causeOfDeath(level, prev, s), /^spikes #/);
  const fallen = { ...s, y: level.height + 50 };
  assert.equal(causeOfDeath(level, prev, fallen), 'fell out of the biome');
});
