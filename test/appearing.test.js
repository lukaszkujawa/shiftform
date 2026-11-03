import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, COLS, TILE } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { step, initialState } from '../src/world/physics.js';

const FLOOR = 30;

function arena(block) {
  const level = createLevel(buildRules([]), [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  level.start = { x: 200, y: FLOOR * TILE - 26 };
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  return { level, block: addObject(level, { x: 150, y: (FLOOR - 4) * TILE, w: 120, h: 40, ...block }) };
}

const closes = { type: 'phase', period: 240, on: 120, phase: 0 };

function insideAsItAppears(block, extra = {}) {
  const { level, block: o } = arena(block);
  return { level, o, s: { ...initialState(level), x: o.x + 40, y: o.y + 7, vx: 0, vy: 0, grounded: false, ...extra } };
}

test('a timed block appearing around you does not move you', () => {
  const { level, s: inside } = insideAsItAppears(closes, { clock: 239 });
  const on = step(level, inside, {});
  assert.ok(Math.abs(on.x - inside.x) < 0.01 && Math.abs(on.y - inside.y) < 2, `moved from ${inside.x},${inside.y} to ${on.x},${on.y}`);
});

test('every kind of switched block leaves you where you are', () => {
  for (const [block, extra] of [
    [{ type: 'gate', period: 240, on: 120, phase: 0 }, { clock: 239 }],
    [{ type: 'toggle', bit: 1, on: false }, {}],
    [{ type: 'door', bit: 1 }, {}],
  ]) {
    const { level, s: inside } = insideAsItAppears(block, extra);
    const on = step(level, inside, {});
    assert.ok(Math.abs(on.x - inside.x) < 0.01 && Math.abs(on.y - inside.y) < 2, `${block.type} moved you to ${on.x},${on.y} from ${inside.x},${inside.y}`);
  }
});

test('you fall out of it naturally, and once clear it is solid again', () => {
  const { level, o, s: inside } = insideAsItAppears({ type: 'phase', period: 240, on: 240, phase: 0 });
  let s = inside;
  for (let i = 0; i < 90 && !s.grounded; i++) s = step(level, s, {});
  assert.ok(s.grounded && s.y + 26 === FLOOR * TILE, `reached the floor, ${s.y}`);
  const rising = { ...s, x: o.x + 40, y: o.y + o.h + 3, vy: -8, grounded: false };
  const stopped = step(level, step(level, rising, {}), {});
  assert.ok(stopped.y >= o.y + o.h, `a clear climber bumps its underside, ${stopped.y}`);
});

test('a block that is on still blocks and carries as before', () => {
  const { level, block: o } = arena({ type: 'phase', period: 240, on: 240, phase: 0 });
  let s = { ...initialState(level), x: o.x + 40, y: o.y - 60, vy: 0, grounded: false };
  for (let i = 0; i < 40; i++) s = step(level, s, {});
  assert.ok(s.grounded && s.y + 26 === o.y, `stands on it, ${s.y}`);
  const moving = { ...initialState(level), x: o.x - 30, y: o.y + 4, vx: 6, grounded: false };
  assert.ok(step(level, moving, { right: true }).x + 20 <= o.x + 0.01, 'and stops you from the side');
});

function moverIntoWall() {
  const level = createLevel(buildRules([]), [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  fillTiles(level, 14, FLOOR - 6, 3, 3, SOLID);
  const mover = addObject(level, { type: 'mover', x: 300, y: (FLOOR - 3) * TILE, w: 90, h: TILE, dx: 120, dy: 0, period: 240, phase: 0 });
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  level.start = { x: 340, y: mover.y - 26 };
  return { level, wall: 14 * TILE };
}

test('a platform carrying you into a wall never puts you through it, whichever way you face', () => {
  for (const tapEvery of [Infinity, 1, 3, 5, 9, 17]) {
    const { level, wall } = moverIntoWall();
    let s = { ...initialState(level), facing: -1 };
    for (let i = 0; i < 240 && !s.dead; i++) {
      s = step(level, s, { left: i % tapEvery === 0 });
      assert.ok(s.x + 20 <= wall + 1, `tapping away every ${tapEvery}, frame ${i}: x ${s.x} is past the wall at ${wall}`);
    }
  }
});

test('a platform rising under a ceiling never lifts you through it', () => {
  const level = createLevel(buildRules([]), [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  fillTiles(level, 8, FLOOR - 12, 8, 3, SOLID);
  const mover = addObject(level, { type: 'mover', x: 300, y: (FLOOR - 3) * TILE, w: 90, h: TILE, dx: 0, dy: -180, period: 240, phase: 0 });
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  level.start = { x: 340, y: mover.y - 26 };
  let s = initialState(level);
  for (let i = 0; i < 240 && !s.dead; i++) {
    s = step(level, s, {});
    assert.ok(s.y >= (FLOOR - 9) * TILE - 1, `frame ${i}: y ${s.y} went up through the ceiling`);
  }
});

test('being squeezed between a platform and a wall is fatal rather than a teleport', () => {
  const level = createLevel(buildRules([]), [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  fillTiles(level, 14, FLOOR - 4, 3, 4, SOLID);
  addObject(level, { type: 'mover', x: 200, y: (FLOOR - 2) * TILE, w: 60, h: 2 * TILE, dx: 170, dy: 0, period: 240, phase: 0 });
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  level.start = { x: 14 * TILE - 21, y: FLOOR * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 120 && !s.dead; i++) {
    s = step(level, s, {});
    assert.ok(s.x + 20 <= 14 * TILE + 1 && s.y >= FLOOR * TILE - 27, `frame ${i}: moved to ${s.x},${s.y}`);
  }
  assert.equal(s.dead, true);
});

