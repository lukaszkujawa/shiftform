import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, ROWS, COLS, CRATE_SIZE } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { soundEvents } from '../src/sounds.js';

const FLOOR = 13 * TILE;

function flatLevel(mutators = []) {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: FLOOR - 26 };
  return level;
}

function eventsOf(level, inputs, frames, s = initialState(level)) {
  const events = [];
  for (let i = 0; i < frames; i++) {
    const next = step(level, s, typeof inputs === 'function' ? inputs(i) : inputs);
    events.push(...soundEvents(level, s, next).map(e => ({ ...e, frame: i })));
    s = next;
  }
  return events;
}

const types = events => events.map(e => e.type);

test('jumping and landing make sounds', () => {
  const events = eventsOf(flatLevel(), i => ({ jump: i >= 10 && i < 20 }), 90);
  const jump = events.find(e => e.type === 'jump');
  const land = events.filter(e => e.type === 'land').at(-1);
  assert.ok(jump && jump.frame === 10);
  assert.ok(land && land.frame > jump.frame && land.speed > 3);
});

test('air jumps, dashes and deaths are reported', () => {
  const air = eventsOf(flatLevel(['double']), i => ({ jump: (i >= 10 && i < 14) || (i >= 24 && i < 28) }), 40);
  assert.ok(types(air).includes('airJump'));
  const dash = eventsOf(flatLevel(['dash']), i => ({ dash: i === 10 }), 20);
  assert.ok(types(dash).includes('dash'));
  const level = flatLevel();
  addObject(level, { type: 'spikes', x: 100, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  assert.equal(types(eventsOf(level, { right: true }, 60)).filter(t => t === 'death').length, 1);
});

test('keys, plates and gravity flips are reported', () => {
  const level = flatLevel();
  addObject(level, { type: 'key', x: 100, y: FLOOR - 20, w: 16, h: 18, bit: 1 });
  addObject(level, { type: 'plate', x: 200, y: FLOOR - 6, w: 26, h: 6, bit: 2 });
  const events = types(eventsOf(level, { right: true }, 80));
  assert.ok(events.includes('key'));
  assert.ok(events.includes('plateDown'));
  assert.ok(events.includes('plateUp'));
  const flip = flatLevel(['flipjump']);
  fillTiles(flip, 0, 0, COLS, 2, SOLID);
  assert.ok(types(eventsOf(flip, i => ({ jump: i === 12 }), 40)).includes('flip'));
});

test('crate handling sounds name the crate material', () => {
  const level = flatLevel();
  addObject(level, { type: 'crate', kind: 'steel', x: 52, y: FLOOR - CRATE_SIZE, w: CRATE_SIZE, h: CRATE_SIZE });
  const events = eventsOf(level, i => ({ interact: i === 20 || i === 40, right: i >= 38 && i <= 40 }), 140);
  assert.deepEqual(types(events).filter(t => ['lift', 'throw', 'crateLand'].includes(t)).slice(0, 3), ['lift', 'throw', 'crateLand']);
  assert.equal(events.find(e => e.type === 'crateLand').kind, 'steel');
  const push = flatLevel();
  addObject(push, { type: 'crate', kind: 'wood', x: 120, y: FLOOR - CRATE_SIZE, w: CRATE_SIZE, h: CRATE_SIZE });
  const pushing = eventsOf(push, { right: true }, 40).filter(e => e.type === 'push');
  assert.ok(pushing.length > 5);
  assert.equal(pushing[0].kind, 'wood');
});

test('springs and the gate launch sound different', () => {
  const level = flatLevel();
  addObject(level, { type: 'spring', x: 100, y: FLOOR - 12, w: 22, h: 12, dir: -1 });
  addObject(level, { type: 'spring', x: 400, y: FLOOR - 12, w: 22, h: 12, dir: -1, vel: 20 });
  const events = types(eventsOf(level, { right: true }, 200));
  assert.ok(events.includes('spring'));
  assert.ok(events.includes('launch'));
});

test('item pickups and shield breaks are reported', () => {
  const level = flatLevel();
  addObject(level, { type: 'item', kind: 'shield', x: 60, y: FLOOR - 24, w: 20, h: 20 });
  addObject(level, { type: 'spikes', x: 200, y: FLOOR - 14, w: 24, h: 14, dir: -1 });
  const events = eventsOf(level, { right: true }, 80);
  assert.equal(events.find(e => e.type === 'item').kind, 'shield');
  assert.ok(types(events).includes('shieldBreak'));
  assert.ok(!types(events).includes('death'));
});

test('reaching full charge and losing it are reported once each', () => {
  const level = flatLevel(['flywheel']);
  const events = eventsOf(level, i => ({ right: i < 100, left: i >= 100 }), 110);
  assert.equal(types(events).filter(t => t === 'charged').length, 1);
  assert.equal(types(events).filter(t => t === 'uncharged').length, 1);
  assert.ok(events.find(e => e.type === 'charged').frame < events.find(e => e.type === 'uncharged').frame);
});
