import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, COLS, ROWS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { soundEvents } from '../src/sounds.js';
import { createAvatar, stepAvatar, moodOf, ASLEEP_FRAMES } from '../src/avatar.js';

const FLOOR = 13 * TILE;

function flatLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 200, y: FLOOR - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  return level;
}

function play(level, inputs, s = initialState(level), avatar = createAvatar('seed')) {
  const puffs = [], squash = [];
  for (const input of inputs) {
    const next = step(level, s, input);
    puffs.push(...stepAvatar(avatar, level, s, next, soundEvents(level, s, next), () => 0.5));
    squash.push(avatar.squash);
    s = next;
  }
  return { s, avatar, puffs, squash };
}

test('landing squashes the body and it springs back', () => {
  const level = flatLevel();
  const { squash, puffs } = play(level, Array(90).fill({}), { ...initialState(level), y: FLOOR - 200, grounded: false });
  assert.ok(Math.min(...squash) < -0.2, `squashed ${Math.min(...squash)}`);
  assert.ok(Math.abs(squash.at(-1)) < 0.01, 'settled');
  assert.ok(puffs.length >= 2, 'landing kicks up dust');
});

test('running leaves footstep dust and a jump stretches the body', () => {
  const level = flatLevel();
  const run = play(level, [...Array(10).fill({}), ...Array(50).fill({ right: true })]);
  assert.ok(run.puffs.length >= 2, `${run.puffs.length} footsteps`);
  assert.ok(run.avatar.sway < 0, 'the accessory trails behind the run');
  const jump = play(level, [...Array(10).fill({}), { jump: true }, {}, {}]);
  assert.ok(Math.max(...jump.squash) > 0.1, 'stretched on take-off');
});

test('the face reacts to the moment', () => {
  const level = flatLevel();
  addObject(level, { type: 'monster', kind: 'patroller', x: 300, y: FLOOR - 20, w: 22, h: 20, dx: 0, dy: 0, period: 300, phase: 0 });
  const idle = play(level, Array(ASLEEP_FRAMES + 30).fill({}));
  assert.ok(idle.avatar.lookX > 0.8, 'watches the nearby monster');
  assert.equal(moodOf(idle.avatar, idle.s), 'asleep', 'dozes off when left alone');
  const falling = { ...initialState(level), grounded: false, vy: 12 };
  assert.equal(moodOf(createAvatar('x'), falling), 'scared');
  assert.equal(moodOf(createAvatar('x'), { ...falling, comet: 2 }), 'joy');
  assert.equal(moodOf(createAvatar('x'), initialState(level)), 'calm');
});

test('each seed dresses the climber the same way every time', () => {
  assert.equal(createAvatar('amber-1').accessory, createAvatar('amber-1').accessory);
  const looks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(seed => createAvatar(seed).accessory));
  assert.ok(looks.size >= 3, [...looks].join());
});
