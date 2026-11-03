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

test('the harder the landing the deeper the squash', () => {
  const level = flatLevel();
  const deepest = drop => Math.min(...play(level, Array(70).fill({}), { ...initialState(level), y: FLOOR - 26 - drop, grounded: false }).squash);
  assert.ok(deepest(150) < deepest(40) && deepest(40) < deepest(10), `${deepest(10)} ${deepest(40)} ${deepest(150)}`);
});

test('hitting a wall squeezes the body against it, harder at speed, once', () => {
  const walled = () => {
    const level = flatLevel();
    fillTiles(level, 15, 10, 1, 3, SOLID);
    return level;
  };
  const at = (level, vx) => ({ ...initialState(level), x: 15 * TILE - 40, y: FLOOR - 26, grounded: true, vx });
  const slam = vx => play(walled(), [...Array(8).fill({ right: true }), ...Array(30).fill({})], at(walled(), vx));
  const soft = Math.max(...slam(4).squash), hard = Math.max(...slam(12).squash);
  assert.ok(hard > soft && soft > 0.03, `${soft} ${hard}`);

  const level = walled();
  let s = at(level, 6);
  const bumps = [], avatar = createAvatar('seed');
  let pressed = 0;
  for (let i = 0; i < 40; i++) {
    const next = step(level, s, { right: true });
    const events = soundEvents(level, s, next);
    bumps.push(...events.filter(event => event.type === 'bumpWall'));
    stepAvatar(avatar, level, s, next, events, () => 0.5);
    pressed = bumps.length && !pressed ? avatar.pressed : pressed;
    s = next;
  }
  assert.equal(bumps.length, 1, 'leaning on a wall is not hitting it again');
  assert.equal(pressed, 1, 'the squeeze stays against the wall');
  assert.equal(avatar.pressed, 0, 'and lets go once settled');
});

test('kicking off a marked wall squeezes towards it, and a head bump squashes', () => {
  const level = flatLevel();
  fillTiles(level, 15, 0, 1, 13, SOLID);
  addObject(level, { type: 'cling', x: 15 * TILE - 2, y: 0, w: 4, h: 13 * TILE });
  const beside = { ...initialState(level), x: 15 * TILE - 20, y: FLOOR - 150, vy: 1, grounded: false, jumpsLeft: 0 };
  const kicked = play(level, [{ jump: true }], beside);
  assert.equal(kicked.s.wallSide, 1);
  assert.equal(kicked.avatar.pressed, 1);
  assert.ok(kicked.avatar.squash > 0.1, `${kicked.avatar.squash}`);

  const roofed = flatLevel();
  fillTiles(roofed, 0, 8, COLS, 1, SOLID);
  const rising = { ...initialState(roofed), y: 9 * TILE + 4, vy: -10, grounded: false };
  assert.ok(Math.min(...play(roofed, Array(8).fill({}), rising).squash) < -0.1);
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
  const looks = seeds.map(seed => createAvatar(seed));
  const distinct = key => new Set(looks.map(l => l[key])).size;
  assert.ok(distinct('hat') >= 4, `${distinct('hat')} hats`);
  assert.ok(distinct('glasses') >= 3, `${distinct('glasses')} glasses`);
  assert.ok(distinct('pattern') >= 3, `${distinct('pattern')} patterns`);
  assert.ok(distinct('tint') >= 4, `${distinct('tint')} tints`);
  assert.ok(looks.every(l => (l.hat === null) !== (l.accessory === null)), 'a hat or a head accessory, never both or neither');
  assert.ok(looks.every(l => l.spots.length === 4 && l.spots.every(s => Math.abs(s.x) <= 0.3 && s.y > 0.1 && s.r > 0)));
  const bare = createAvatar('');
  assert.deepEqual([bare.accessory, bare.hat, bare.glasses, bare.pattern, bare.tint], [null, null, null, null, null]);
});

test('reversing at a run skids: the climber leans into the turn and kicks up dust', () => {
  const level = flatLevel();
  let s = initialState(level);
  const avatar = createAvatar('seed');
  const tick = input => { const next = step(level, s, input); const dust = stepAvatar(avatar, level, s, next, soundEvents(level, s, next), () => 0.5); s = next; return dust; };
  for (let i = 0; i < 40; i++) tick({ right: true });
  assert.ok(s.vx >= level.rules.moveSpeed && avatar.lean > 0, 'running leans forward');
  let dust = 0;
  for (let i = 0; i < 6; i++) dust += tick({ left: true }).length;
  assert.ok(avatar.lean < -0.5, `leans hard into the new direction: ${avatar.lean.toFixed(2)}`);
  assert.ok(dust >= 2, `dust from the feet: ${dust}`);
  for (let i = 0; i < 40; i++) tick({ left: true });
  assert.ok(avatar.lean < 0 && avatar.lean > -0.2, 'and settles into an ordinary run the other way');
});

test('a teeter leans the climber over the drop and pulls it back within a second', () => {
  const level = createLevel(buildRules([]), []);
  const avatar = createAvatar('teeter');
  const standing = { ...initialState(level), grounded: true, vx: 0, facing: 1, runDir: 1, ran: 100 };
  stepAvatar(avatar, level, standing, { ...standing, teeter: 1 }, []);
  let peak = 0;
  for (let i = 0; i < 20; i++) { stepAvatar(avatar, level, standing, standing, []); peak = Math.max(peak, avatar.lean); }
  assert.ok(peak > 0.3, `leans over the drop: ${peak}`);
  for (let i = 0; i < 50; i++) stepAvatar(avatar, level, standing, standing, []);
  assert.ok(Math.abs(avatar.lean) < 0.03, `back upright: ${avatar.lean}`);
});
