import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, COLS, TILE } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';

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
