import { test } from 'node:test';
import { respawn, enterBiome } from '../src/world/climb.js';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, ROWS, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { step, initialState, TURN_WINDOW } from '../src/world/physics.js';

const FLOOR = 13 * TILE;

function shaft() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 10, 0, 1, 13, SOLID);
  fillTiles(level, 14, 0, 1, 13, SOLID);
  level.start = { x: 11 * TILE + 2, y: 6 * TILE };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

test('legs against a wall in mid-air kick off it with jump', () => {
  const level = shaft();
  let s = run(level, { left: true }, 4);
  assert.equal(s.grounded, false);
  const kicked = step(level, s, { jump: true });
  assert.ok(kicked.vx > 0, 'pushed away from the left wall');
  assert.ok(kicked.vy < -5, 'launched upward');
  assert.equal(kicked.lastKick, -1);
});

test('the next kick must come off the other wall', () => {
  const level = shaft();
  let s = run(level, { left: true }, 4);
  s = step(level, s, { jump: true });
  s = run(level, { left: true }, 12, s);
  const again = step(level, step(level, s, { left: true }), { left: true, jump: true });
  assert.ok(again.vx <= 0, 'no second kick off the same wall');
  let across = s;
  for (let i = 0; i < 30 && across.x + 20 < 14 * TILE - 1; i++) across = step(level, across, { right: true });
  const other = step(level, across, { right: true, jump: true });
  assert.ok(other.vx < 0 && other.vy < -5, 'kick off the opposite wall');
});

test('landing just short of a ledge top pops the player onto it', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 12, 10, 4, 3, SOLID);
  level.start = { x: 12 * TILE - 22, y: 10 * TILE - 26 + 6 };
  const s = run(level, { right: true }, 12, { ...initialState(level), vy: -1 });
  assert.equal(s.y + 26, 10 * TILE, 'standing on the ledge');
});

test('clipping a corner with the head slides past it', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 0, 9, 10, 1, SOLID);
  level.start = { x: 10 * TILE - 4, y: FLOOR - 26 };
  let s = initialState(level), top = Infinity;
  for (let i = 0; i < 40; i++) { s = step(level, s, { jump: i >= 3 && i < 30 }); top = Math.min(top, s.y); }
  assert.ok(top < 9 * TILE, 'rose past the platform edge');
});

test('glass bones survives a jump and kick but not a long fall', () => {
  const level = createLevel(buildRules(['glass']), ['glass']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 0, 0, 10, 13, SOLID);
  level.start = { x: 300, y: FLOOR - 26 };
  const presses = [[0, 4], [12, 16], [24, 28]];
  const s = run(level, i => ({ left: true, jump: presses.some(([a, b]) => i >= a && i < b) }), 120, run(level, { left: true }, 10));
  assert.equal(s.dead, false);
  assert.equal(s.grounded, true);
  level.start = { x: 400, y: FLOOR - 26 - 6 * TILE };
  assert.equal(run(level, {}, 120).dead, true);
});

function ladderLevel() {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  fillTiles(level, 6, 6, 5, 1, SOLID);
  addObject(level, { type: 'climb', x: 5 * TILE + 5, y: 6 * TILE, w: 20, h: 7 * TILE });
  level.start = { x: 5 * TILE + 5, y: FLOOR - 26 };
  return level;
}

const UP = { up: true, jump: true };

test('holding up on a ladder climbs it instead of jumping, and the top steps onto the platform', () => {
  const level = ladderLevel();
  const grabbed = step(level, initialState(level), UP);
  assert.equal(grabbed.climbing, true);
  assert.ok(grabbed.vy < 0 && grabbed.vy > -4, 'climbs, does not jump');
  const top = run(level, UP, 90, grabbed);
  assert.ok(top.climbing && Math.abs(top.y + 26 - 6 * TILE) <= 3, 'stops with feet at the platform');
  const off = run(level, { right: true }, 20, top);
  assert.ok(off.grounded && off.y + 26 === 6 * TILE && off.x > 6 * TILE, 'walks onto the platform');
  const stillHoldingUp = run(level, { right: true, up: true }, 20, top);
  assert.ok(stillHoldingUp.grounded && stillHoldingUp.y + 26 === 6 * TILE && stillHoldingUp.x > 6 * TILE, 'steps onto the platform even with up still held');
});

test('jump leaps off a ladder, down climbs down, and walking past does not grab', () => {
  const level = ladderLevel();
  const mid = run(level, UP, 30);
  const leap = step(level, step(level, mid, {}), { jump: true, right: true });
  assert.equal(leap.climbing, false);
  assert.ok(leap.vy < -5, 'jumps off');
  const down = run(level, { down: true }, 20, step(level, mid, {}));
  assert.ok(down.climbing && down.y > mid.y, 'climbs down');
  const past = run(level, { right: true }, 20);
  assert.equal(past.climbing, false);
});

test('one jump spends the ground grace, so a quick double tap is not a second jump', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  let s = run(level, {}, 3);
  s = step(level, s, { jump: true });
  assert.equal(s.coyote, 0, 'no grace left after leaving the ground by jumping');
  const tapped = step(level, step(level, s, {}), { jump: true });
  assert.equal(tapped.jumpsUsed, s.jumpsUsed, 'the second tap does nothing');
});

test('starting off is gentle, turning around is sharp, and pushing a crate is unchanged', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  const settled = run(level, {}, 3);
  const speeds = [];
  let s = settled;
  for (let i = 0; i < 30; i++) { s = step(level, s, { right: true }); speeds.push(s.vx); }
  assert.ok(speeds[0] < level.rules.groundAccel, `a tap moves a little: ${speeds[0]}`);
  assert.equal(speeds.findIndex(v => v >= level.rules.moveSpeed) + 1, 15, 'full speed takes 250 ms');
  const turned = step(level, s, { left: true });
  assert.ok(s.vx - turned.vx > level.rules.groundAccel * 1.5, 'reversing brakes hard');
  const coast = step(level, s, {});
  assert.ok(Math.abs(coast.vx) < Math.abs(s.vx), 'letting go still slows you down');
  const turnFrames = gap => {
    let t = s;
    for (let i = 0; i < gap; i++) t = step(level, t, {});
    let frames = 0;
    while (t.vx > -level.rules.moveSpeed + 1e-9 && frames < 30) { t = step(level, t, { left: true }); frames++; }
    return frames;
  };
  assert.ok(turnFrames(0) <= 8 && turnFrames(8) <= 10, `a held turn within the window still snaps round to full speed: ${turnFrames(0)}, ${turnFrames(8)} frames`);
  assert.ok(turnFrames(TURN_WINDOW + 6) >= 9, `a turn after the window starts from scratch: ${turnFrames(TURN_WINDOW + 6)} frames`);
});

test('hazards forgive a two pixel graze', () => {
  const level = createLevel(buildRules([]), []);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: 13 * TILE - 26 };
  const graze = { type: 'spikes', x: 300 + 19, y: 13 * TILE - 14, w: 30, h: 14, dir: -1 };
  const grazed = createLevel(buildRules([]), []);
  Object.assign(grazed, { tiles: level.tiles, start: level.start });
  addObject(grazed, graze);
  assert.equal(run(grazed, {}, 5).dead, false, 'a pixel of overlap is survivable');
  const deep = createLevel(buildRules([]), []);
  Object.assign(deep, { tiles: level.tiles, start: level.start });
  addObject(deep, { ...graze, x: 300 + 10 });
  assert.equal(run(deep, {}, 5).dead, true, 'a real hit still kills');
});

const spiderClimb = level => {
  let s = initialState(level), top = s.y;
  for (let i = 0; i < 1200; i++) { const phase = i % 10; s = step(level, s, { left: phase >= 2, right: phase < 2, jump: phase < 9 }); top = Math.min(top, s.y); }
  return Math.round((level.start.y - top) / TILE);
};

test('Spider climbs real walls but not the edge of the screen, which only gives one kick', () => {
  const edge = createLevel(buildRules(['walls']), ['walls'], 60);
  fillTiles(edge, 0, 59, COLS, 1, SOLID);
  edge.start = { x: 4, y: 59 * TILE - 26 };
  assert.ok(spiderClimb(edge) < 8, `${spiderClimb(edge)} tiles up the screen edge`);
  const wall = createLevel(buildRules(['walls']), ['walls'], 60);
  fillTiles(wall, 0, 59, COLS, 1, SOLID);
  fillTiles(wall, 9, 0, 1, 59, SOLID);
  wall.start = { x: 10 * TILE + 4, y: 59 * TILE - 26 };
  assert.ok(spiderClimb(wall) > 30, `${spiderClimb(wall)} tiles up a real wall`);
});

test('a kick off a wall never flips gravity, a running jump still can', () => {
  const rules = { ...buildRules(['flipjump']), jumpFlipChance: 1 };
  const level = createLevel(rules, ['flipjump']);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  level.start = { x: 0, y: (ROWS - 1) * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 8; i++) s = step(level, s, { jump: i > 1 });
  s = step(level, s, {});
  s = step(level, s, { left: true, jump: true });
  assert.ok(s.lastKick && s.gravDir === 1, 'kicked off the screen edge');
  for (let i = 0; i < 12; i++) { s = step(level, s, { right: true }); assert.equal(s.gravDir, 1, `frame ${i} after the kick`); }
  let run = { ...initialState(level), x: 300 };
  for (let i = 0; i < 30 && run.gravDir > 0; i++) run = step(level, run, { right: true, jump: i > 10 });
  assert.equal(run.gravDir, -1, 'a running jump still rolls a flip');
});

function flipLevel() {
  const rules = { ...buildRules(['flipjump']), jumpFlipChance: 1, flipFrames: 20 };
  const level = createLevel(rules, ['flipjump']);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  fillTiles(level, 0, 0, COLS, 2, SOLID);
  level.start = { x: 60, y: (ROWS - 1) * TILE - 26 };
  return level;
}

function spamJumps(level, s, frames) {
  let flips = 0;
  for (let i = 0; i < frames; i++) {
    const before = s;
    s = step(level, { ...s, x: 100 + (i % 200) }, { right: true, jump: i % 30 < 12 });
    if (before.gravDir > 0 && s.gravDir < 0) flips++;
  }
  return { s, flips };
}

test('spamming running jumps flips gravity once from a height, then never again', () => {
  const level = flipLevel();
  const { s, flips } = spamJumps(level, initialState(level), 900);
  assert.equal(flips, 1);
  assert.deepEqual(s.flippedRows, [ROWS - 1]);
});

test('a different height can still flip', () => {
  const level = flipLevel();
  fillTiles(level, 0, ROWS - 6, COLS, 1, ONE_WAY);
  const floor = spamJumps(level, initialState(level), 300).s;
  const raised = { ...floor, y: (ROWS - 6) * TILE - 26, vy: 0, grounded: true, gravDir: 1, flipLeft: 0 };
  assert.equal(spamJumps(level, raised, 120).flips, 1);
});

test('a used height stays used after dying, but a new biome starts clean', () => {
  const level = flipLevel();
  const used = spamJumps(level, initialState(level), 300).s;
  const back = respawn(level, { ...used, dead: true }, []);
  assert.deepEqual(back.flippedRows, [ROWS - 1]);
  assert.equal(spamJumps(level, back, 300).flips, 0);
  assert.deepEqual(enterBiome(level, used, level).flippedRows, []);
});

function ledgeLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, 10, ROWS - 13, SOLID);
  level.start = { x: 276, y: 13 * TILE - 26 };
  return level;
}

const settle = level => { let s = initialState(level); for (let i = 0; i < 5; i++) s = step(level, s, {}); return s; };

const walkThenRelease = (level, holdFrames, after = 60) => {
  let s = settle(level), caught = 0;
  for (let i = 0; i < holdFrames + after; i++) { s = step(level, s, i < holdFrames ? { right: true } : {}); if (s.teeter) caught = s.teeter; }
  return { s, caught };
};

test('letting go at low speed stops the climber at the lip of a ledge and teeters', () => {
  const { s, caught } = walkThenRelease(ledgeLevel(), 10);
  assert.equal(s.grounded, true, 'still on the ledge');
  assert.ok(s.x + 10 <= 302 && s.x + 10 > 296, `centre at the lip: ${s.x + 10}`);
  assert.equal(s.vx, 0);
  assert.equal(caught, 1);
});

test('running off a ledge at speed still falls, and so does holding toward the drop', () => {
  assert.equal(walkThenRelease(ledgeLevel(), 30).s.grounded, false);
  let s = settle(ledgeLevel());
  const level = ledgeLevel();
  for (let i = 0; i < 40; i++) s = step(level, s, { right: true });
  assert.equal(s.grounded, false);
});

test('black ice keeps the slide', () => {
  const { s, caught } = walkThenRelease(ledgeLevel(['ice']), 20, 200);
  assert.equal(caught, 0);
  assert.equal(s.grounded, false);
});

test('landing with the centre past the lip scrambles back onto the ledge, unless you hold toward the drop', () => {
  const dropOnto = (x, inputs) => {
    const level = ledgeLevel();
    level.start = { x, y: 13 * TILE - 26 - 90 };
    let s = initialState(level), caught = 0;
    for (let i = 0; i < 60; i++) { s = step(level, s, inputs); if (s.teeter) caught = s.teeter; }
    return { s, caught };
  };
  const back = dropOnto(294, {});
  assert.equal(back.s.grounded, true);
  assert.ok(back.s.x + 10 <= 300, `centre back on the ledge: ${back.s.x + 10}`);
  assert.equal(back.caught, 1);
  const pushed = dropOnto(294, { right: true });
  assert.equal(pushed.s.grounded, false);
});

test('after the catch, holding toward the drop walks you off instead of tugging you back', () => {
  const level = ledgeLevel();
  let s = settle(level);
  for (let i = 0; i < 70; i++) s = step(level, s, i < 10 ? { right: true } : {});
  assert.equal(s.grounded, true);
  assert.equal(s.vx, 0);
  const atLip = s.x;
  for (let i = 0; i < 30; i++) s = step(level, s, { right: true });
  assert.ok(s.x > atLip + 20, `moved on from the lip: ${s.x - atLip}`);
  assert.equal(s.grounded, false);
});

function openAir() {
  const level = createLevel(buildRules([]), [], 40);
  fillTiles(level, 0, 39, COLS, 1, SOLID);
  level.start = { x: 100, y: 39 * TILE - 26 };
  return level;
}

function airborneAt(level, vx) {
  let s = initialState(level);
  for (let i = 0; i < 5; i++) s = step(level, s, {});
  for (let i = 0; i < 6; i++) s = step(level, s, { jump: true });
  return { ...s, vx };
}

const glide = (level, s, input, frames) => { for (let i = 0; i < frames; i++) s = step(level, s, input(i)); return s; };

test('a small nudge in mid-air stays small and fades away', () => {
  const level = openAir(), from = airborneAt(level, 0);
  const after = glide(level, from, i => ({ right: i < 2 }), 12);
  assert.ok(after.x - from.x < 8, `drifted ${after.x - from.x} px`);
  assert.ok(Math.abs(after.vx) < 0.3, `still moving at ${after.vx}`);
});

test('pushing back in mid-air brakes faster than it builds speed', () => {
  const level = openAir();
  const braked = glide(level, airborneAt(level, 4.2), () => ({ left: true }), 1);
  const built = glide(level, airborneAt(level, 0), () => ({ left: true }), 1);
  assert.ok(4.2 - braked.vx > 2 * Math.abs(built.vx) - 1e-9, `braked ${4.2 - braked.vx}, built ${built.vx}`);
});

test('holding a direction still reaches full speed, so full jumps go as far', () => {
  const level = openAir();
  assert.equal(glide(level, airborneAt(level, 0), () => ({ right: true }), 20).vx, level.rules.moveSpeed);
});

test('a run keeps most of its momentum when you let go', () => {
  const level = openAir();
  assert.ok(glide(level, airborneAt(level, 4.2), () => ({}), 10).vx > 2.8);
});

test('landing grips for a moment, and on ice it does not', () => {
  const slideAfterLanding = rules => {
    const level = createLevel(rules, [], 40);
    fillTiles(level, 0, 39, COLS, 1, SOLID);
    level.start = { x: 100, y: 39 * TILE - 26 };
    let s = { ...initialState(level), y: 39 * TILE - 40, vy: 4, vx: 4.2, grounded: false, frame: 500 };
    for (let i = 0; i < 12 && !s.grounded; i++) s = step(level, s, { right: true });
    assert.ok(s.grounded);
    return glide(level, s, () => ({}), 30).x - s.x;
  };
  assert.ok(slideAfterLanding(buildRules([])) < 8, `slid ${slideAfterLanding(buildRules([]))} px`);
  assert.ok(slideAfterLanding(buildRules(['ice'])) > 60, 'ice stays ice');
});

function openFloor() {
  const level = createLevel(buildRules([]), [], 40);
  fillTiles(level, 0, 39, COLS, 1, SOLID);
  level.start = { x: 300, y: 39 * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 8; i++) s = step(level, s, {});
  return { level, s };
}

test('a tap back stops you rather than launching you the other way', () => {
  const { level, s } = openFloor();
  const running = glide(level, s, () => ({ right: true }), 20);
  const tapped = glide(level, running, () => ({ left: true }), 5);
  assert.ok(Math.abs(tapped.vx) < 1, `speed after the tap: ${tapped.vx}`);
  assert.ok(glide(level, tapped, () => ({}), 30).x > running.x, 'you end up ahead of where you tapped, not behind it');
});

test('holding the turn still snaps round to full speed quickly', () => {
  const { level, s } = openFloor();
  const running = glide(level, s, () => ({ right: true }), 20);
  assert.equal(glide(level, running, () => ({ left: true }), 8).vx, -level.rules.moveSpeed);
});

test('a quick tap stops crisply, a run still slides, and ice stays ice', () => {
  const { level, s } = openFloor();
  const tapped = glide(level, s, () => ({ right: true }), 6);
  assert.ok(glide(level, tapped, () => ({}), 30).x - tapped.x < 3, 'barely any slide after a tap');
  const running = glide(level, s, () => ({ right: true }), 20);
  assert.ok(glide(level, running, () => ({}), 30).x - running.x > 8, 'a full run still slides');
  const ice = createLevel(buildRules(['ice']), [], 40);
  fillTiles(ice, 0, 39, COLS, 1, SOLID);
  ice.start = { x: 100, y: 39 * TILE - 26 };
  let slick = initialState(ice);
  for (let i = 0; i < 8; i++) slick = step(ice, slick, {});
  for (let i = 0; i < 20; i++) slick = step(ice, slick, { right: true });
  const held = slick;
  for (let i = 0; i < 30; i++) slick = step(ice, slick, {});
  assert.ok(slick.x - held.x > 15, `ice slid ${slick.x - held.x} px`);
});

test('a refused jump while carrying spends nothing and kicks nothing', () => {
  const level = openAir();
  addObject(level, { type: 'crate', kind: 'steel', x: 400, y: 0, w: 28, h: 28 });
  const from = { ...airborneAt(level, 0), held: 0, boots: 5, jumpsLeft: 1 };
  const after = step(level, from, { jump: true });
  assert.deepEqual([after.boots, after.jumpsLeft, after.lastKick], [5, 1, 0]);
  assert.ok(after.vy > from.vy);
});

test('a jump tapped just before landing is as small as a normal tap', () => {
  const level = openAir();
  const rise = run => { let s = run, top = s.y; for (let i = 0; i < 40; i++) { s = step(level, s, {}); top = Math.min(top, s.y); } return run.y - top; };
  let s = glide(level, initialState(level), () => ({}), 8);
  const normal = rise(step(level, s, { jump: true }));
  const falling = { ...s, y: s.y - 6, vy: 3, grounded: false, jumpBuffer: 4, jumpsLeft: 0 };
  const buffered = rise(falling) - 6;
  assert.ok(buffered < normal + 10, `normal ${normal}, buffered ${buffered}`);
});

