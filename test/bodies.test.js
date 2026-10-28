import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS, CRATE_SIZE, HOOK_REACH } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

const FLOOR = 13 * TILE;

function flatLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  return level;
}

function crate(level, kind, x, y = FLOOR - CRATE_SIZE) {
  return addObject(level, { type: 'crate', kind, x, y, w: CRATE_SIZE, h: CRATE_SIZE });
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('walking into a wooden crate pushes it', () => {
  const level = flatLevel();
  crate(level, 'wood', 120);
  const s = run(level, { right: true }, 60);
  assert.ok(s.bodies[0].x > 200);
  assert.ok(Math.abs(s.x + 20 - s.bodies[0].x) < 1);
});

test('a steel crate pushes slower than wood', () => {
  const wood = flatLevel(), steel = flatLevel();
  crate(wood, 'wood', 120);
  crate(steel, 'steel', 120);
  assert.ok(run(steel, { right: true }, 60).bodies[0].x < run(wood, { right: true }, 60).bodies[0].x - 40);
});

test('stone only moves when dashed into', () => {
  const walk = flatLevel(['dash']);
  crate(walk, 'stone', 120);
  assert.equal(run(walk, { right: true }, 60).bodies[0].x, 120);
  const dash = flatLevel(['dash']);
  crate(dash, 'stone', 120);
  const s = run(dash, i => ({ right: true, dash: i === 18 }), 60);
  assert.ok(s.bodies[0].x > 140);
});

test('a light crate stuck behind a heavy one does not move', () => {
  const level = flatLevel(['dash']);
  crate(level, 'wood', 120);
  crate(level, 'stone', 120 + CRATE_SIZE);
  const s = run(level, { right: true }, 60);
  assert.equal(s.bodies[0].x, 120);
  assert.equal(s.bodies[1].x, 120 + CRATE_SIZE);
});

test('two wooden crates push together but three exceed strength', () => {
  const two = flatLevel();
  crate(two, 'wood', 120);
  crate(two, 'wood', 120 + CRATE_SIZE);
  assert.ok(run(two, { right: true }, 60).bodies[1].x > 200);
  const three = flatLevel();
  for (let i = 0; i < 3; i++) crate(three, 'wood', 120 + i * CRATE_SIZE);
  assert.equal(run(three, { right: true }, 60).bodies[0].x, 120);
});

test('crates fall off ledges and stack', () => {
  const level = flatLevel();
  crate(level, 'wood', 200);
  crate(level, 'wood', 200, FLOOR - 200);
  const s = run(level, {}, 80);
  assert.equal(s.bodies[1].y, FLOOR - 2 * CRATE_SIZE);
  assert.equal(s.bodies[1].grounded, true);
});

test('the player can stand on a crate', () => {
  const level = flatLevel();
  crate(level, 'stone', 30, FLOOR - CRATE_SIZE);
  level.start = { x: 34, y: FLOOR - 100 };
  const s = run(level, {}, 60);
  assert.equal(s.y, FLOOR - CRATE_SIZE - 26);
  assert.equal(s.groundId, 0);
});

test('F lifts a crate overhead and throwing sends it flying', () => {
  const level = flatLevel();
  crate(level, 'wood', 52);
  const lifted = run(level, i => ({ interact: i === 20 }), 22);
  assert.equal(lifted.held, 0);
  assert.equal(lifted.bodies[0].y, lifted.y - CRATE_SIZE);
  const thrown = run(level, i => ({ right: i > 25 && i < 30, interact: i === 28 }), 120, lifted);
  assert.equal(thrown.held, -1);
  assert.ok(thrown.bodies[0].x > lifted.x + 120);
  assert.equal(thrown.bodies[0].grounded, true);
});

test('heavier crates are thrown shorter', () => {
  const throwDistance = kind => {
    const level = flatLevel();
    crate(level, kind, 52);
    const s = run(level, i => ({ interact: i === 20 || i === 40, right: i >= 38 && i <= 40 }), 140);
    return s.bodies[0].x;
  };
  assert.ok(throwDistance('steel') < throwDistance('wood') - 60);
});

test('F while standing still sets the crate down in front', () => {
  const level = flatLevel();
  crate(level, 'wood', 52);
  const s = run(level, i => ({ interact: i === 20 || i === 40 }), 60);
  assert.equal(s.held, -1);
  assert.equal(s.bodies[0].y, FLOOR - CRATE_SIZE);
  assert.ok(s.bodies[0].x >= s.x + 20);
});

test('stone cannot be lifted and steel blocks jumping while carried', () => {
  const stone = flatLevel();
  crate(stone, 'stone', 52);
  assert.equal(run(stone, i => ({ interact: i === 20 }), 22).held, -1);
  const steel = flatLevel();
  crate(steel, 'steel', 52);
  const s = run(steel, i => ({ interact: i === 20, jump: i > 24 && i < 30 }), 32);
  assert.equal(s.held, 0);
  assert.equal(s.grounded, true);
});

test('a crate on a pressure plate holds its door open', () => {
  const level = flatLevel();
  crate(level, 'wood', 180);
  addObject(level, { type: 'plate', x: 182, y: FLOOR - 6, w: 26, h: 6, bit: 1 });
  addObject(level, { type: 'door', x: 400, y: 10 * TILE, w: TILE, h: 3 * TILE, bit: 1, plate: true });
  const hop = i => ({ right: true, jump: i > 20 && i < 34 });
  const held = run(level, hop, 200);
  assert.equal(held.pressed, 1);
  assert.ok(held.x > 430);
  const empty = initialState(level);
  const blocked = run(level, hop, 200, { ...empty, bodies: [{ ...empty.bodies[0], gone: true }] });
  assert.equal(blocked.pressed, 0);
  assert.ok(blocked.x < 400);
});

test('crates ride conveyors and float on water', () => {
  const level = flatLevel();
  addObject(level, { type: 'conveyor', x: 300, y: FLOOR - TILE, w: 4 * TILE, h: TILE, speed: 2 });
  crate(level, 'wood', 310, FLOOR - TILE - CRATE_SIZE);
  fillTiles(level, 20, 13, 6, ROWS - 13, 0);
  addObject(level, { type: 'water', x: 600, y: 14 * TILE, w: 6 * TILE, h: 4 * TILE });
  crate(level, 'wood', 650, 200);
  crate(level, 'stone', 720, 200);
  const s = run(level, {}, 400);
  assert.ok(s.bodies[0].x > 380);
  assert.ok(Math.abs(s.bodies[1].y + CRATE_SIZE / 2 - 14 * TILE) < 8);
  assert.ok(s.bodies[2].y > 15 * TILE);
});

test('crates block lasers and cover spikes', () => {
  const level = flatLevel();
  addObject(level, { type: 'laser', x: 141, y: 0, w: 8, h: FLOOR, period: 120, on: 120, phase: 0, dir: 1 });
  crate(level, 'wood', 131, 100);
  const s = run(level, {}, 60);
  assert.equal(s.dead, false);
  const spiky = flatLevel();
  addObject(spiky, { type: 'spikes', x: 120, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  crate(spiky, 'wood', 118, 300);
  spiky.start = { x: 122, y: 200 };
  const covered = run(spiky, {}, 120);
  assert.equal(covered.dead, false);
  assert.equal(covered.bodies[0].y, FLOOR - 14 - CRATE_SIZE);
});

test('stone crushes saws', () => {
  const level = flatLevel();
  addObject(level, { type: 'saw', x: 200, y: FLOOR - 26, w: 26, h: 26, dx: 0, dy: 0, period: 120, phase: 0 });
  crate(level, 'stone', 199, 100);
  const s = run(level, {}, 60);
  assert.equal(s.crushed, 1);
  const walked = run(level, { right: true }, 120, { ...s, bodies: [{ ...s.bodies[0], gone: true }] });
  assert.equal(walked.dead, false);
  assert.ok(walked.x > 300);
});

test('a thrown crate presses a switch', () => {
  const level = flatLevel();
  crate(level, 'wood', 52);
  addObject(level, { type: 'switch', x: 260, y: FLOOR - 18, w: 16, h: 18, bit: 1 });
  const s = run(level, i => ({ interact: i === 20 || i === 40, right: i >= 38 && i <= 40 }), 160);
  assert.equal(s.flags, 1);
});

test('grabbing a hook swings the player across a gap', () => {
  const level = flatLevel();
  fillTiles(level, 8, 13, 10, ROWS - 13, 0);
  addObject(level, { type: 'hook', x: 384, y: 250, w: 12, h: 12, reach: HOOK_REACH });
  level.start = { x: 200, y: FLOOR - 26 };
  const s = run(level, i => ({ right: true, jump: i >= 10 && i < 16, interact: i === 24 }), 70);
  assert.ok(s.rope >= 0);
  const swung = run(level, i => ({ right: true, interact: i === 0 }), 200, run(level, { right: true }, 10, s));
  assert.equal(swung.dead, false);
  assert.ok(swung.x > 18 * TILE);
});

test('replacing objects with the same count refreshes the level index', () => {
  const level = flatLevel();
  crate(level, 'wood', 120);
  assert.equal(initialState(level).bodies.length, 1);
  level.objects.length = 0;
  addObject(level, { type: 'spikes', x: 300, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  assert.equal(initialState(level).bodies.length, 0);
});

test('a crate rides a vertical mover without sliding off', () => {
  const level = flatLevel();
  addObject(level, { type: 'mover', x: 300, y: 10 * TILE, w: 3 * TILE, h: TILE, dx: 0, dy: -60, period: 120, phase: 0 });
  crate(level, 'wood', 331, 10 * TILE - CRATE_SIZE);
  const s = run(level, {}, 240);
  assert.equal(s.bodies[0].x, 331);
  assert.equal(s.bodies[0].gone, false);
});
