import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, COLS, TILE } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, LONG_JUMP_RANGE } from '../src/physics.js';
import { soundEvents } from '../src/sounds.js';
import { generateBiome } from '../src/generator.js';
import { createRun, advance } from '../src/run.js';
import { COMBO_FROM, freshCombo } from '../src/combo.js';

const FLOOR = 71;

function flat(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators, FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  Object.assign(level, { index: 0, theme: 0, palette: 40, title: '', segments: [], entryCol: 4, exitCol: 4, provenMutators: mutators });
  level.start = { x: 40, y: FLOOR * TILE - 26 };
  level.exit = { x: 120, y: -30, w: 60, h: 30 };
  return level;
}

function leap(level, longJump) {
  let s = initialState(level);
  for (let i = 0; i < 20; i++) s = step(level, s, { right: true });
  const from = s.x;
  let top = s.y;
  s = step(level, s, { right: true, jump: true, longJump });
  for (let i = 0; i < 90 && !s.grounded; i++) {
    s = step(level, s, { right: true, jump: true, longJump });
    top = Math.min(top, s.y);
  }
  return { range: s.x - from, top, landed: s };
}

test('a long jump carries half as far again at the same height, and ends on landing', () => {
  const usual = leap(flat(), false), long = leap(flat(), true);
  const ratio = long.range / usual.range;
  assert.ok(Math.abs(ratio - LONG_JUMP_RANGE) < 0.05, `${long.range} against ${usual.range} is x${ratio}`);
  assert.equal(long.top, usual.top);
  assert.equal(long.landed.longJump, false);
});

test('only a jump from the ground becomes long, and it has its own sound', () => {
  const level = flat(['double']);
  let s = initialState(level);
  for (let i = 0; i < 5; i++) s = step(level, s, {});
  const taken = step(level, s, { jump: true, longJump: true });
  assert.equal(taken.longJump, true);
  assert.deepEqual(soundEvents(level, s, taken).map(event => event.type).filter(type => /jump/i.test(type)), ['longJump']);
  const usual = step(level, s, { jump: true });
  assert.deepEqual(soundEvents(level, s, usual).map(event => event.type).filter(type => /jump/i.test(type)), ['jump']);
  let up = taken;
  for (let i = 0; i < 6; i++) up = step(level, up, {});
  const again = step(level, up, { jump: true, longJump: true });
  assert.equal(again.longJump, false, 'an air jump ends it');
});

test('the run hands out a long jump only once the combo is reached', () => {
  const level = flat();
  const biomes = () => level;
  const jumpWith = links => {
    const run = createRun(3, 'long');
    advance(run, biomes);
    for (let i = 0; i < 5; i++) advance(run, biomes, {});
    run.combo = { ...freshCombo(), links };
    advance(run, biomes, { jump: true });
    return run.s.longJump;
  };
  assert.equal(jumpWith(COMBO_FROM - 1), false);
  assert.equal(jumpWith(COMBO_FROM), true);
});

test('the proof never long jumps, even when a run replays it through a combo', () => {
  const level = generateBiome('ghost-race', 0, null);
  for (const { inputs, start } of level.segments) {
    let s = start;
    for (const input of inputs) {
      assert.equal(input.longJump, false);
      s = step(level, s, input);
      assert.equal(s.longJump, false);
    }
  }
});
