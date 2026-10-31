import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, EMPTY, TILE, ROWS, COLS } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState, blinkDestination, aimOf, TELEPORTS } from '../src/physics.js';
import { respawn, enterBiome } from '../src/climb.js';
import { equip, activeGear } from '../src/outfitter.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2, `${actual} is not near ${expected}`);
const FLOOR = 13 * TILE;
const UP = aimOf(0, -1);

function blinkLevel() {
  const level = createLevel(buildRules(['blink']), ['blink']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: FLOOR - 26 };
  return level;
}

function run(level, inputs, frames, s = initialState(level)) {
  for (let i = 0; i < frames; i++) s = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
  return s;
}

const settled = level => run(level, {}, 3);

test('with Teleport Hop, jump is still an ordinary jump', () => {
  const level = blinkLevel(), plain = createLevel(buildRules([]), []);
  Object.assign(plain, { tiles: level.tiles, start: level.start });
  const peak = lvl => { let s = settled(lvl), top = s.y; for (let i = 0; i < 40; i++) { s = step(lvl, s, { jump: true }); top = Math.min(top, s.y); } return top; };
  assert.equal(peak(level), peak(plain));
});

test('T teleports about a jump and a fifth along the aim', () => {
  const level = blinkLevel(), start = settled(level);
  const up = step(level, start, { blink: UP });
  near(up.y, start.y - 126);
  near(up.x, start.x);
  const landed = run(level, {}, 60, up);
  const diagonal = step(level, landed, { blink: aimOf(1, -1) });
  assert.ok(diagonal.x > landed.x + 80 && diagonal.y < landed.y - 80, 'aims up and to the right');
});

test('three teleports per biome: landing and dying do not recharge them, the next biome does', () => {
  const level = blinkLevel();
  let s = settled(level);
  for (let i = 0; i < TELEPORTS; i++) s = run(level, {}, 60, step(level, s, { blink: UP }));
  assert.equal(s.teleports, 0);
  const spent = step(level, s, { blink: UP });
  assert.ok(Math.abs(spent.y - s.y) < 2, 'nothing left to teleport with');
  assert.equal(respawn(level, { ...s, dead: true }, []).teleports, 0);
  assert.equal(enterBiome(level, s, level).teleports, TELEPORTS);
});

test('a teleport stops short of hazards and walls, and never leaves the level', () => {
  const level = blinkLevel();
  addObject(level, { type: 'spikes', x: 0, y: level.start.y - 140, w: COLS * TILE, h: 30 });
  const start = settled(level), up = step(level, start, { blink: UP });
  assert.equal(up.dead, false);
  assert.ok(up.y > start.y - 115, 'landed below the spikes');
  const top = blinkLevel();
  fillTiles(top, 0, 0, COLS, 13, EMPTY);
  const high = { ...settled(top), y: 30 };
  const to = blinkDestination(top, high, UP);
  assert.ok(to === null || to.y >= 0);
  const boxed = blinkLevel();
  fillTiles(boxed, 0, 0, COLS, 12, SOLID);
  const stuck = settled(boxed);
  const tried = step(boxed, stuck, { blink: UP });
  assert.equal(tried.dashLeft, stuck.dashLeft, 'nothing spent when there is nowhere to go');
});

test('Teleport Hop and Blink are worn together and both work', () => {
  assert.deepEqual(equip(['dash'], 'blink').gear, ['dash', 'blink']);
  const level = createLevel(buildRules(['dash', 'blink']), ['dash', 'blink']);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 300, y: FLOOR - 26 };
  const start = settled(level), up = step(level, start, { blink: UP });
  assert.ok(up.y < start.y - 100, 'teleports');
  const dashed = run(level, i => ({ dash: i === 0, right: true }), 4, up);
  assert.ok(dashed.dashTimer > 0 || dashed.x > up.x + 20, 'and still dashes');
});

test('Teleport Hop works in biomes whose banes change gravity', () => {
  for (const bane of ['flipjump', 'heavy']) assert.deepEqual(activeGear(['blink'], [bane]), ['blink'], bane);
});
