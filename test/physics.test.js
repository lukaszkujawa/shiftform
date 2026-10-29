import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, ROWS, COLS, addObject } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, CRUMBLE_RESPAWN } from '../src/physics.js';

function flatLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: 13 * TILE - 26 };
  return level;
}

function runFrom(level, s, inputs, frames) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

function run(level, inputs, frames) {
  return runFrom(level, initialState(level), inputs, frames);
}

test('player lands on the floor and stays grounded', () => {
  const s = run(flatLevel(), {}, 30);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 13 * TILE - 26);
});

test('holding right walks the player right without passing walls', () => {
  const s = run(flatLevel(), { right: true }, 400);
  assert.equal(s.x, COLS * TILE - 20);
});

test('jump rises then returns to the ground', () => {
  const level = flatLevel();
  const peak = run(level, i => ({ jump: i >= 10 && i < 30 }), 29);
  assert.ok(peak.y < 13 * TILE - 26 - 60);
  const landed = run(level, i => ({ jump: i >= 10 && i < 30 }), 120);
  assert.equal(landed.grounded, true);
});

test('step is deterministic', () => {
  const level = flatLevel(['bouncy', 'ice']);
  const a = run(level, i => ({ right: true, jump: i % 20 < 5 }), 200);
  const b = run(level, i => ({ right: true, jump: i % 20 < 5 }), 200);
  assert.deepEqual(a, b);
});

test('mirror swaps the input direction', () => {
  const s = run(flatLevel(['mirror']), { right: true }, 60);
  assert.equal(s.x, 0);
});

test('flip-on-jump sends the player to the ceiling', () => {
  const level = flatLevel(['flipjump']);
  fillTiles(level, 0, 0, COLS, 2, SOLID);
  const s = run(level, i => ({ jump: i === 12 }), 120);
  assert.equal(s.gravDir, -1);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 2 * TILE);
});

test('spikes kill and keys unlock doors', () => {
  const level = flatLevel();
  addObject(level, { type: 'key', x: 100, y: 13 * TILE - 20, w: 16, h: 18, bit: 1 });
  addObject(level, { type: 'door', x: 200, y: 10 * TILE, w: TILE, h: 3 * TILE, bit: 1 });
  const s = run(level, { right: true }, 200);
  assert.equal(s.flags, 1);
  assert.ok(s.x > 230);
  addObject(level, { type: 'spikes', x: 300, y: 13 * TILE - 14, w: 24, h: 14, dir: -1 });
  assert.equal(run(level, { right: true }, 200).dead, true);
});

test('falling off the world kills unless wrapping', () => {
  const level = createLevel(buildRules([]), []);
  level.start = { x: 30, y: 100 };
  assert.equal(run(level, {}, 200).dead, true);
  const wrap = createLevel(buildRules(['wrap']), ['wrap']);
  wrap.start = { x: 30, y: 100 };
  assert.equal(run(wrap, {}, 200).dead, false);
});

test('a quick jump tap just before landing jumps on landing', () => {
  const level = flatLevel();
  level.start = { x: 30, y: 13 * TILE - 26 - 60 };
  let s = initialState(level);
  while (!step(level, s, {}).grounded) s = step(level, s, {});
  for (let i = 0; i < 8; i++) s = step(level, s, { jump: i < 2 });
  assert.equal(s.jumpsUsed, 1);
});

test('tall levels keep physics working below the first screen', () => {
  const level = createLevel(buildRules([]), [], 72);
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  level.start = { x: 30, y: 60 * TILE };
  const s = run(level, {}, 200);
  assert.equal(s.dead, false);
  assert.equal(s.grounded, true);
  assert.equal(s.y, 71 * TILE - 26);
});

test('standing on a vertical mover rides it without sliding off', () => {
  const level = flatLevel();
  const mover = addObject(level, { type: 'mover', x: 300, y: 10 * TILE, w: 3 * TILE, h: TILE, dx: 0, dy: -60, period: 120, phase: 0 });
  level.start = { x: 335, y: 10 * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 240; i++) {
    s = step(level, s, {});
    if (i > 5) {
      assert.equal(s.x, 335, `frame ${i} keeps x`);
      assert.equal(s.groundId, mover.id, `frame ${i} stays on the mover`);
    }
  }
});

test('jumping into a descending mover from below never lands on top of it', () => {
  for (const phase of [0, 30, 60, 90]) {
    const level = flatLevel();
    const mover = addObject(level, { type: 'mover', x: 300, y: 10 * TILE, w: 3 * TILE, h: TILE, dx: 0, dy: -60, period: 120, phase });
    level.start = { x: 335, y: 13 * TILE - 26 };
    let s = initialState(level);
    for (let i = 0; i < 90; i++) {
      s = step(level, s, { jump: i >= 5 && i < 25 });
      assert.notEqual(s.groundId, mover.id, `phase ${phase} frame ${i} must not stand on the mover`);
    }
  }
});

test('a crumbling platform vanishes after you step off and comes back', () => {
  const level = flatLevel();
  const crumble = addObject(level, { type: 'crumble', x: 300, y: 10 * TILE, w: 2 * TILE, h: TILE });
  level.start = { x: 310, y: 10 * TILE - 26 };
  let s = run(level, {}, 10);
  assert.equal(s.groundId, crumble.id);
  s = runFrom(level, s, { right: true }, 30);
  assert.ok(s.crumbled[0] > 0);
  s = runFrom(level, s, { left: true }, 60);
  assert.notEqual(s.groundId, crumble.id);
  s = runFrom(level, s, {}, CRUMBLE_RESPAWN);
  assert.equal(s.crumbled[0], 0);
});

const runway = (mutators = ['flywheel']) => flatLevel(mutators);

function flight(level, runFrames) {
  let s = initialState(level), top = s.y, takeoff = null, landing = null;
  for (let i = 0; i < runFrames + 120 && landing === null; i++) {
    s = step(level, s, { right: true, jump: i >= runFrames && i < runFrames + 40 });
    if (i < runFrames) continue;
    if (!s.grounded) { top = Math.min(top, s.y); if (takeoff === null) takeoff = s.x; }
    else if (takeoff !== null) landing = s.x;
  }
  return { rise: level.start.y - top, span: landing - takeoff };
}

test('running one way charges to full and a non-flywheel level never charges', () => {
  const charged = run(runway(), { right: true }, 90);
  assert.equal(charged.charge, 1);
  assert.equal(charged.chargeDir, 1);
  assert.equal(run(runway([]), { right: true }, 90).charge, 0);
});

test('a charged jump is higher and longer than a standing one', () => {
  const cold = flight(runway(), 2), hot = flight(runway(), 90);
  assert.ok(hot.rise > cold.rise * 1.4 && hot.rise < cold.rise * 1.7, `rise ${hot.rise} vs ${cold.rise}`);
  assert.ok(hot.span > cold.span * 1.6 && hot.span < cold.span * 2.1, `span ${hot.span} vs ${cold.span}`);
});

test('charge carries through a jump and drops on turning, stopping or hitting a wall', () => {
  const level = runway();
  const flying = run(level, i => ({ right: true, jump: i >= 90 && i < 110 }), 100);
  assert.equal(flying.grounded, false);
  assert.equal(flying.charge, 1);
  const turned = step(level, run(level, { right: true }, 90), { left: true });
  assert.equal(turned.charge, 0);
  assert.equal(turned.chargeDir, 0);
  assert.equal(run(level, i => ({ right: i < 90 }), 110).charge, 0);
  assert.equal(run(level, { right: true }, 400).charge, 0);
});

test('a dash neither builds nor spends charge', () => {
  const level = runway(['flywheel', 'dash']);
  const before = run(level, { right: true }, 40);
  const dashing = runFrom(level, before, i => ({ right: true, dash: i === 0 }), 6);
  assert.equal(dashing.charge, before.charge);
});

test('coins are picked up once, placed planks hold the player and erased hazards stop biting', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 100, y: 13 * TILE - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  const coin = addObject(level, { type: 'coin', x: 105, y: 13 * TILE - 30, w: 14, h: 14 });
  const spikes = addObject(level, { type: 'spikes', x: 200, y: 13 * TILE - 14, w: 24, h: 14, dir: -1 });
  let s = step(level, initialState(level), {});
  assert.equal(s.coins, 1 << coin.slot, 'coin collected');
  s = step(level, { ...s, placed: [{ x: 60, y: 10 * TILE, w: 90, h: TILE, id: -1 }], y: 10 * TILE - 26 - 4 }, {});
  for (let i = 0; i < 10; i++) s = step(level, s, {});
  assert.equal(s.grounded, true);
  assert.equal(s.y + 26, 10 * TILE, 'stands on the placed plank');
  const hit = step(level, { ...initialState(level), x: 200 }, {});
  assert.equal(hit.dead, true, 'spikes kill without the eraser');
  const spared = step(level, { ...initialState(level), x: 200, erased: [spikes.id] }, {});
  assert.equal(spared.dead, false, 'erased spikes are harmless');
});

test('placed trampolines launch the player and placed ladders can be climbed', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 100, y: 13 * TILE - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  const pad = { kind: 'trampoline', x: 90, y: 11 * TILE, w: 60, h: 12, id: -1 };
  let s = step(level, { ...initialState(level), placed: [pad], y: 11 * TILE - 26 - 2 }, {});
  for (let i = 0; i < 6 && !(s.vy < -8); i++) s = step(level, s, {});
  assert.ok(s.vy < -8, 'launched upward');
  const ladder = { kind: 'ladder', x: 105, y: 6 * TILE, w: 20, h: 7 * TILE, id: -1 };
  s = { ...initialState(level), placed: [ladder], grounded: true };
  for (let i = 0; i < 30; i++) s = step(level, s, { up: true });
  assert.ok(s.climbing && s.y < 13 * TILE - 26 - 40, 'climbs the hung ladder');
});

test('letting go of jump early cuts the rise, so taps hop and holds soar, but springs are never cut', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 100, y: 13 * TILE - 26 };
  level.exit = { x: -100, y: -100, w: 0, h: 0 };
  const apex = inputs => {
    let s = { ...initialState(level), grounded: true }, top = s.y;
    for (let i = 0; i < 90; i++) { s = step(level, s, inputs(i)); top = Math.min(top, s.y); }
    return 13 * TILE - 26 - top;
  };
  const tap = apex(i => ({ jump: i < 2 })), short = apex(i => ({ jump: i < 6 })), full = apex(() => ({ jump: true }));
  assert.ok(tap < 30, `tap hops ${tap.toFixed(1)}px`);
  assert.ok(short > tap + 15 && short < 70, `short press ${short.toFixed(1)}px`);
  assert.ok(full > 100, `full hold ${full.toFixed(1)}px`);
  addObject(level, { type: 'spring', x: 95, y: 13 * TILE - 12, w: 30, h: 12, dir: -1 });
  const launched = apex(i => ({ jump: i < 1 }));
  assert.ok(launched > 150, `spring launch stays high at ${launched.toFixed(1)}px even though jump was released`);
});
