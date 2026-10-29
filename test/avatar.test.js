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

test('each seed dresses the climber the same way every time, and seeds differ', () => {
  const a = createAvatar('amber-1'), b = createAvatar('amber-1');
  assert.deepEqual([a.accessory, a.hat, a.glasses, a.pattern, a.tint, a.spots], [b.accessory, b.hat, b.glasses, b.pattern, b.tint, b.spots]);
  const seeds = Array.from({ length: 24 }, (_, i) => `look-${i}`);
  const looks = seeds.map(createAvatar);
  const distinct = key => new Set(looks.map(l => l[key])).size;
  assert.ok(distinct('hat') >= 4, `${distinct('hat')} hats`);
  assert.ok(distinct('glasses') >= 3, `${distinct('glasses')} glasses`);
  assert.ok(distinct('pattern') >= 3, `${distinct('pattern')} patterns`);
  assert.ok(distinct('tint') >= 4, `${distinct('tint')} tints`);
  assert.ok(looks.every(l => (l.hat === null) !== (l.accessory === null)), 'a hat or a head accessory, never both or neither');
  assert.ok(looks.every(l => l.spots.length === 4 && l.spots.every(s => Math.abs(s.x) <= 0.3 && s.r > 0)));
  const bare = createAvatar('');
  assert.deepEqual([bare.accessory, bare.hat, bare.glasses, bare.pattern, bare.tint], [null, null, null, null, null]);
});
