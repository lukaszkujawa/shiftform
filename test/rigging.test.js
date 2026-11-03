import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, COLS, TILE, HOOK_REACH } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { createStrand, stepStrand, swayOf, noteClimber } from '../src/rigging.js';

const FLOOR = 40;

function hung() {
  const level = createLevel(buildRules([]), [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  level.start = { x: 400, y: 20 * TILE };
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  const hook = addObject(level, { type: 'hook', x: 400, y: 15 * TILE, w: 12, h: 12, reach: HOOK_REACH });
  const s = { ...initialState(level), x: 396, y: 15 * TILE + 80, grounded: false, vx: 0, vy: 0, rope: hook.id, ropeLen: 90 };
  return { level, hook, s };
}

const run = (level, s, input, frames) => { for (let i = 0; i < frames; i++) s = step(level, s, input); return s; };

test('up reels the rope in and down lets it out, within its range', () => {
  const { level, s } = hung();
  const shorter = run(level, s, { up: true }, 10);
  assert.equal(shorter.ropeLen, 65);
  assert.equal(run(level, s, { up: true }, 200).ropeLen, 40, 'never shorter than the minimum');
  const longer = run(level, s, { down: true }, 10);
  assert.equal(longer.ropeLen, 115);
  assert.equal(run(level, s, { down: true }, 200).ropeLen, HOOK_REACH, 'never longer than its reach');
  assert.equal(run(level, s, {}, 10).ropeLen, 90, 'left alone it keeps its length');
});

test('the up key reels even though it also counts as jump, and a plain jump still leaves the rope', () => {
  const { level, hook, s } = hung();
  const upKey = { up: true, jump: true };
  const held = run(level, s, upKey, 12);
  assert.equal(held.rope, hook.id, 'still on');
  assert.equal(held.ropeLen, 60);
  assert.equal(step(level, run(level, s, {}, 3), { jump: true }).rope, -1, 'jump lets go');
  assert.equal(step(level, run(level, s, {}, 3), { interact: true }).rope, -1, 'and so does grab');
});

test('reeling in lifts the climber towards the hook and they keep swinging', () => {
  const { level, hook, s } = hung();
  const settled = run(level, s, {}, 60);
  const lifted = run(level, settled, { up: true }, 18);
  assert.ok(lifted.y < settled.y - 20, `rose from ${settled.y} to ${lifted.y}`);
  assert.equal(lifted.rope, hook.id);
  assert.equal(lifted.dead, false);
});

test('a rope is a hanging strand: it droops when slack and pulls straight when taut', () => {
  const settle = (tipX, tipY, length) => {
    const strand = createStrand(0, 0, length);
    for (let i = 0; i < 300; i++) stepStrand(strand, 0, 0, { x: tipX, y: tipY }, length);
    return strand.points;
  };
  const slack = settle(60, 0, 100), taut = settle(100, 0, 100);
  assert.ok(slack[5].y > 25, `slack droops ${slack[5].y}`);
  assert.ok(Math.abs(taut[5].y) < 12, `taut pulls nearly straight ${taut[5].y}`);
});

test('a released rope falls and hangs from its hook at a short rest length', () => {
  const strand = createStrand(0, 0, 100);
  for (let i = 0; i < 5; i++) stepStrand(strand, 0, 0, { x: 90, y: 30 }, 100);
  for (let i = 0; i < 400; i++) stepStrand(strand, 0, 0, null, 22);
  const end = strand.points.at(-1);
  assert.ok(Math.abs(end.x) < 1 && end.y > 15 && end.y < 30, `${end.x},${end.y}`);
});

test('a handle takes your weight, jolts when you grab it fast, and recoils when you let go', () => {
  const hook = { id: 0, grip: true, type: 'hook', x: 100, y: 100, w: 12, h: 12, dx: 0, dy: 0, period: 240, phase: 0 };
  const at = (frame, rope, vx = 0, vy = 0) => ({ frame, clock: frame, rope, gravDir: 1, vx, vy });
  let sway;
  for (let f = 0; f < 5; f++) sway = swayOf(hook, at(f, -1));
  assert.ok(Math.hypot(sway.x, sway.y) < 0.01, 'at rest with nobody on it');
  noteClimber({ vx: 8, vy: 6 });
  let most = 0;
  for (let f = 5; f < 15; f++) { sway = swayOf(hook, at(f, 0)); most = Math.max(most, sway.x); }
  assert.ok(most > 3, `kicked along by the climber, ${most}`);
  for (let f = 15; f < 90; f++) sway = swayOf(hook, at(f, 0));
  assert.ok(Math.abs(sway.x) < 0.3 && sway.y > 5, `settles under the weight, ${sway.x}, ${sway.y}`);
  let high = Infinity;
  for (let f = 90; f < 110; f++) { sway = swayOf(hook, at(f, -1)); high = Math.min(high, sway.y); }
  assert.ok(high < -0.5, `springs up past rest when let go, ${high}`);
  for (let f = 110; f < 220; f++) sway = swayOf(hook, at(f, -1));
  assert.ok(Math.hypot(sway.x, sway.y) < 0.1, 'and comes back to rest');
});

test('a handle never strays beyond its reach, even when the clock jumps', () => {
  const hook = { id: 0, grip: true, type: 'hook', x: 100, y: 100, w: 12, h: 12, reach: 0, dx: 300, dy: 300, period: 60, phase: 0 };
  for (let f = 0; f < 200; f++) {
    const sway = swayOf(hook, { frame: f, clock: f * 17, rope: -1, gravDir: 1, vx: 0, vy: 0 });
    assert.ok(Math.abs(sway.x) <= 14 && Math.abs(sway.y) <= 14);
  }
});
