import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, COLS, SOLID, createLevel, fillTiles, addObject } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState, step, playerSize, cannonAim } from '../src/physics.js';
import { standAt } from '../src/climb.js';
import { launchTo } from '../src/rigs.js';

const FLOOR = 40;
const rules = buildRules([]);

function arena(extra = () => {}) {
  const level = createLevel(rules, [], 44);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  level.start = { x: 3 * TILE, y: FLOOR * TILE - playerSize(rules).h };
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  extra(level);
  return level;
}

const run = (level, s, inputs) => inputs.reduce((state, input) => step(level, state, input), s);
const hold = (input, n) => Array(n).fill(input);
const settle = level => run(level, initialState(level), hold({}, 6));

test('leaving a moving platform keeps its speed', () => {
  const ride = dx => arena(level => addObject(level, { type: 'mover', x: 10 * TILE, y: 30 * TILE, w: 3 * TILE, h: TILE, dx, dy: 0, period: 120, phase: 0 }));
  const launchSpeed = dx => {
    const level = ride(dx);
    const on = { ...initialState(level), x: 11 * TILE, y: 30 * TILE - playerSize(rules).h };
    const standing = run(level, on, hold({}, 6));
    assert.ok(standing.grounded);
    return run(level, standing, [{ jump: true }, {}]).vx;
  };
  assert.ok(launchSpeed(8 * TILE) > 3, 'a fast platform throws you forward');
  assert.equal(launchSpeed(0), 0, 'a still platform adds nothing');
});

test('a flung climber keeps speed while holding the same way, and landing ends it', () => {
  const level = arena(l => addObject(l, { type: 'mover', x: 5 * TILE, y: 30 * TILE, w: 3 * TILE, h: TILE, dx: 16 * TILE, dy: 0, period: 120, phase: 0 }));
  const on = { ...initialState(level), x: 6 * TILE, y: 30 * TILE - playerSize(rules).h };
  const standing = run(level, on, hold({}, 6));
  const off = run(level, standing, hold({ jump: true, right: true }, 2));
  assert.ok(off.flung && off.vx > rules.moveSpeed);
  const later = run(level, off, hold({ jump: true, right: true }, 12));
  assert.ok(later.vx > rules.moveSpeed, 'still faster than a run');
  const down = run(level, later, hold({ right: true }, 120));
  assert.ok(down.grounded && !down.flung);
});

test('dashing does not count as being flung', () => {
  const level = createLevel(buildRules(['dash']), [], 44);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  level.start = { x: 3 * TILE, y: FLOOR * TILE - 26 };
  const up = run(level, initialState(level), [...hold({}, 6), { jump: true, right: true }, ...hold({ jump: true, right: true }, 5)]);
  const dashed = run(level, up, [{ dash: true, right: true }, ...hold({ right: true }, 8)]);
  assert.equal(dashed.flung, false);
  assert.ok(run(level, dashed, hold({ right: true }, 14)).vx <= level.rules.moveSpeed + 0.01);
});

const rail = level => addObject(level, { type: 'hook', grip: true, x: 3 * TILE + 4, y: FLOOR * TILE - 46, w: 12, h: 12, reach: 0, dx: 10 * TILE, dy: -4 * TILE, period: 120, phase: 113 });

test('a grip can be taken from the ground, carries you and does not snap', () => {
  const level = arena(rail);
  const on = run(level, settle(level), [{ interact: true }]);
  assert.ok(on.rope >= 0, 'grabbed');
  assert.ok(Math.hypot(on.vx, on.vy) < 12, `no fling from the grab, ${on.vx}, ${on.vy}`);
  const riding = run(level, on, hold({}, 20));
  assert.ok(riding.x > on.x + 60 && riding.y < on.y - 20, 'moved with the rail');
  assert.ok(Math.abs(riding.vx - (2 * 300) / 120) < 0.5, 'moves at the rail speed');
});

test('letting go keeps the handle velocity; jumping off adds to it', () => {
  const level = arena(rail);
  const riding = run(level, run(level, settle(level), [{ interact: true }]), hold({}, 20));
  const dropped = run(level, riding, [{ interact: true }]);
  assert.equal(dropped.rope, -1);
  assert.ok(dropped.flung && dropped.vx > 4);
  const jumped = run(level, riding, [{ jump: true }]);
  assert.equal(jumped.rope, -1);
  assert.ok(jumped.vy < -rules.jumpVel, `jump adds the upward motion, ${jumped.vy}`);
});

test('a grip is out of reach from afar and a plain hook still needs the air', () => {
  const far = arena(level => addObject(level, { type: 'hook', grip: true, x: 20 * TILE, y: FLOOR * TILE - 46, w: 12, h: 12, reach: 0 }));
  assert.equal(run(far, settle(far), [{ interact: true }]).rope, -1);
  const plain = arena(level => addObject(level, { type: 'hook', x: 4 * TILE, y: FLOOR * TILE - 60, w: 12, h: 12, reach: 150 }));
  assert.equal(run(plain, settle(plain), [{ interact: true }]).rope, -1);
});

test('wheels and pendulums move their handles', () => {
  const orbit = arena(level => addObject(level, { type: 'hook', grip: true, x: 3 * TILE, y: FLOOR * TILE - 200, w: 12, h: 12, reach: 0, motion: 'orbit', dx: 90, dy: 90, period: 120, phase: 90 }));
  assert.ok(orbit.objects[0].motion === 'orbit');
  const swing = arena(level => addObject(level, { type: 'hook', grip: true, x: 3 * TILE, y: FLOOR * TILE - 200, w: 12, h: 12, reach: 0, motion: 'swing', dx: 150, dy: 150, arc: 0.9, period: 120, phase: 0 }));
  assert.ok(swing.timed && orbit.timed, 'handles run on the clock');
});

const barrel = (extra = {}) => level => addObject(level, { type: 'cannon', x: 3 * TILE, y: FLOOR * TILE - 40, w: 34, h: 34, angle: -1, vel: 14, arc: 0, ...extra });

test('a cannon holds you still until you fire, then launches along its aim', () => {
  const level = arena(barrel());
  const inside = run(level, initialState(level), hold({}, 3));
  assert.equal(inside.barrel, level.objects[0].id);
  const waited = run(level, inside, hold({}, 40));
  assert.equal(waited.barrel, level.objects[0].id);
  assert.equal(waited.vy, 0);
  const fired = run(level, waited, [{ jump: true }]);
  assert.equal(fired.barrel, -1);
  assert.ok(fired.flung);
  assert.ok(fired.vy < -8 && fired.vx > 5, `${fired.vx}, ${fired.vy}`);
});

test('a cannon does not recatch you until you have left it', () => {
  const level = arena(barrel({ angle: -Math.PI / 2, vel: 3 }));
  const fired = run(level, run(level, initialState(level), hold({}, 3)), [{ jump: true }, ...hold({}, 4)]);
  assert.equal(fired.barrel, -1);
});

test('an automatic cannon fires itself', () => {
  const level = arena(barrel({ auto: true }));
  const fired = run(level, initialState(level), hold({}, 40));
  assert.equal(fired.barrel, -1);
  assert.ok(fired.y < FLOOR * TILE - 60);
});

test('a sweeping cannon aims with the time spent inside', () => {
  const cannon = { angle: -1, arc: 0.2 };
  assert.notEqual(cannonAim(cannon, 0), cannonAim(cannon, 24));
  assert.equal(cannonAim({ angle: -1, arc: 0 }, 24), -1);
});

test('respawning at a checkpoint leaves the cannon and ends the fling', () => {
  const level = arena(barrel());
  const inside = run(level, initialState(level), hold({}, 3));
  const stood = standAt(level, { ...inside, flung: true }, { x: 100, y: 100, w: 24, h: 40 });
  assert.equal(stood.barrel, -1);
  assert.equal(stood.flung, false);
});

test('launchTo lands within reach of its target under real gravity', () => {
  const from = { x: 200, y: 900 }, to = { x: 500, y: 800 };
  const { vel, angle } = launchTo(rules, from, to);
  let x = from.x, y = from.y, vx = Math.cos(angle) * vel, vy = Math.sin(angle) * vel;
  while (vy < 0 || y < to.y) { vy += rules.gravity; x += vx; y += vy; }
  assert.ok(Math.abs(x - to.x) < 40, `landed ${x - to.x} away`);
});

test('a carried crate shields you at any speed, in both directions', () => {
  for (const mutators of [[], ['sprint'], ['dash'], ['giant']]) {
    const worldRules = buildRules(mutators), { h } = playerSize(worldRules);
    for (const [dir, startCol] of [['right', 10], ['left', 24]]) {
      const level = createLevel(worldRules, mutators, 44);
      fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
      level.start = { x: startCol * TILE, y: FLOOR * TILE - h };
      level.exit = { x: 0, y: -300, w: 0, h: 0 };
      addObject(level, { type: 'crate', kind: 'wood', x: startCol * TILE, y: FLOOR * TILE - 28, w: 28, h: 28 });
      addObject(level, { type: 'laser', steady: true, x: 17 * TILE + 11, y: (FLOOR - 8) * TILE, w: 8, h: 8 * TILE, dir: 1, period: 240, on: 240, phase: 0 });
      let s = run(level, initialState(level), [...hold({}, 6), { interact: true }, {}]);
      assert.ok(s.held >= 0, 'lifted');
      const input = { [dir]: true, dash: true };
      for (let i = 0; i < 200 && !s.dead; i++) s = step(level, s, i % 20 < 8 ? input : { [dir]: true });
      assert.equal(s.dead, false, `${mutators.join() || 'plain'} running ${dir}`);
    }
  }
});
