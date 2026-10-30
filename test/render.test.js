import { test } from 'node:test';
import { KINDS } from '../src/items.js';
import { ITEM_COLORS } from '../src/render.js';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, HEIGHT } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState } from '../src/physics.js';
import { THEMES } from '../src/themes.js';
import { createAvatar, DROWSY_FRAMES, ASLEEP_FRAMES } from '../src/avatar.js';

function stubContext(calls) {
  const values = {};
  const context = new Proxy(() => context, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return () => 0;
      if (key in values) return values[key];
      if (key === 'measureText') return () => ({ width: 10 });
      return (...args) => { calls.push(key); return context; };
    },
    set(_, key, value) { values[key] = value; return true; },
    apply: () => context,
  });
  return context;
}

function stubCanvas(calls) {
  const ctx = stubContext(calls);
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

function sample(theme) {
  const level = createLevel(buildRules([]), [], 36);
  Object.assign(level, { theme, index: 1, palette: 200, title: 'Sample', segments: [], entryCol: 4, exit: { x: 0, y: -300, w: 0, h: 0 } });
  fillTiles(level, 0, 34, 32, 2, SOLID);
  for (const [c, r, w] of [[2, 30, 6], [11, 27, 4], [18, 24, 5], [6, 21, 4], [13, 18, 6]]) fillTiles(level, c, r, w, 1, SOLID);
  fillTiles(level, 9, 24, 3, 1, ONE_WAY);
  addObject(level, { type: 'crate', kind: 'wood', x: 13 * TILE + 1, y: 27 * TILE - 28, w: 28, h: 28 });
  addObject(level, { type: 'climb', x: 19 * TILE + 5, y: 18 * TILE, w: 20, h: 6 * TILE });
  addObject(level, { type: 'monster', kind: 'patroller', x: 2 * TILE, y: 30 * TILE - 20, w: 22, h: 20, dx: 150, dy: 0, period: 300, phase: 0 });
  addObject(level, { type: 'monster', kind: 'flapper', x: 9 * TILE, y: 22 * TILE, w: 22, h: 20, dx: 0, dy: 90, period: 240, phase: 30 });
  const spitter = addObject(level, { type: 'monster', kind: 'spitter', x: 16 * TILE, y: 18 * TILE - 20, w: 22, h: 20, dir: -1 });
  addObject(level, { type: 'monster', kind: 'hopper', motion: 'hop', x: 20 * TILE, y: 24 * TILE - 20, w: 22, h: 20, dx: 60, dy: 0, lift: 60, period: 240, phase: 0 });
  addObject(level, { type: 'monster', kind: 'urchin', motion: 'orbit', x: 24 * TILE, y: 20 * TILE, w: 22, h: 20, dx: 20, dy: 30, period: 240, phase: 0 });
  addObject(level, { type: 'monster', kind: 'spider', motion: 'drop', x: 27 * TILE, y: 22 * TILE, w: 22, h: 20, dx: 0, dy: 60, period: 240, phase: 0 });
  addObject(level, { type: 'spring', x: 6 * TILE + 4, y: 34 * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel: 15 });
  for (const [k, kind] of KINDS.map(([kind]) => kind).entries()) addObject(level, { type: 'item', kind, x: (3 + k * 3) * TILE, y: 30 * TILE - 24, w: 20, h: 20 });
  addObject(level, { type: 'bumper', x: 12 * TILE, y: 33 * TILE, w: 24, h: 24, dir: 1 });
  addObject(level, { type: 'saw', x: 22 * TILE, y: 32 * TILE, w: 26, h: 26, dx: 90, dy: 0, period: 240, phase: 0 });
  addObject(level, { type: 'shot', source: spitter.id, x: 16 * TILE - 10, y: 18 * TILE - 22, w: 10, h: 10, dir: -1, speed: 3.5, range: 180, period: 150, phase: 0 });
  level.start = { x: 4 * TILE, y: 30 * TILE - 26 };
  return level;
}

test('every theme paints a full frame of backdrop, tiles, life and ambience', async () => {
  const calls = [];
  globalThis.OffscreenCanvas = class { constructor() { return stubCanvas(calls); } };
  globalThis.Path2D = class { constructor() { return stubContext(calls); } };
  const { createRenderer } = await import('../src/render.js');
  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  THEMES.forEach((theme, i) => {
    const renderer = createRenderer(stubCanvas(calls));
    const level = sample(i);
    calls.length = 0;
    const states = [initialState(level), { ...initialState(level), comet: 4, cometWait: 2, vy: -6, placed: [{ kind: 'plank', x: 300, y: 600, w: 90, h: 30, id: -1 }, { kind: 'trampoline', x: 400, y: 660, w: 60, h: 12, id: -1 }, { kind: 'ladder', x: 500, y: 500, w: 20, h: 180, id: -1 }] }, { ...initialState(level), comet: 2, cometMissed: true }];
    const avatars = [{ joy: 10, hat: 'crown', glasses: 'round', pattern: 'spots' }, { still: DROWSY_FRAMES + 1, hat: 'tophat', glasses: 'monocle', pattern: 'stripes' }, { still: ASLEEP_FRAMES + 1, blink: 3, hat: null, accessory: 'bow', glasses: 'shades', pattern: 'belly', tint: 'hsl(35 90% 82% / 1)' }].map(mood => ({ ...createAvatar(`look-${i}`), ...mood }));
    for (const [k, time] of [0, 500, 4000].entries()) {
      renderer.draw({ level, state: states[k], time, seed: 'render', camera: level.height - HEIGHT, below: null, above: null, ghost: null, rival: [null, { index: 1, state: { ...states[0], x: states[0].x + 60 }, altitude: 140, done: false }, { index: 2, state: null, altitude: 900, done: true }][k], maxLives: 3, trail: [], particles: [], flash: 0, shake: 0, lives: 2, over: false, quitting: k === 2, altitude: 100, best: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, building: k === 2 ? { fraction: 0.4, stage: 'proving stretch 2 of 4', phrase: 'Tuning the saws' } : null, keys, muted: true, toast: [{ kind: 'bow', text: 'Bow: five arrows', age: 400, ms: 3000 }, { kind: null, text: 'plain', age: 100, ms: 3000 }, null][k], avatar: avatars[k], points: 42, combo: [{ links: 0, floor: null, pop: null }, { links: 5, floor: 700, pop: { links: 5, age: 3, word: 'great', wordAge: 3 } }, { links: 3, floor: 900, pop: null }][k], shop: k === 0 ? { offer: ['jetpack', 'erase', 'plank'], bought: ['plank'], affordable: [true, false, false] } : null, inventory: [{ kinds: [], counts: [], active: null }, { kinds: ['plank', 'ladder', 'trampoline'], counts: [2, 1, 1], active: 'plank' }, { kinds: ['erase'], counts: [1], active: null }][k], planted: k === 1 ? [{ x: 200, y: 860, w: 24, h: 40 }] : [], doubled: k === 2, aim: [null, { kind: 'plank', rect: { kind: 'plank', x: 300, y: 500, w: 90, h: 30 }, x: 340, y: 510 }, { kind: 'erase', object: level.objects.find(o => o.type === 'monster'), x: 70, y: 890 }][k] });
    }
    assert.ok(calls.length > 500, `${theme.id} draws`);
  });
});

test('every item kind that can be found or bought has a colour', () => {
  for (const [kind] of KINDS) assert.ok(ITEM_COLORS[kind], kind);
});

test('the underpass draws its three keepers and every stall bubble', async () => {
  const calls = [];
  globalThis.OffscreenCanvas = class { constructor() { return stubCanvas(calls); } };
  globalThis.Path2D = class { constructor() { return stubContext(calls); } };
  const { createRenderer } = await import('../src/render.js');
  const { hallOf, STALLS } = await import('../src/tunnel.js');
  const hall = hallOf(sample(3));
  const renderer = createRenderer(stubCanvas(calls));
  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  const stalls = [
    { id: 'merchant', age: 80, offer: ['jetpack', 'plank', 'extraHeart'], bought: ['plank'], affordable: [true, false, false] },
    { id: 'rulesmith', age: 400, rows: [{ from: 'ice', options: ['ice', 'mirror', 'dark'], current: 'mirror', price: 1, affordable: true }, { from: 'heavy', options: ['heavy'], current: 'heavy', price: 1, affordable: false }] },
    { id: 'rulesmith', age: 400, rows: [] },
    { id: 'outfitter', age: 400, gear: ['double', 'walls', 'moon'], owned: [true, false, false], replaces: [null, null, 'dash'], prices: [2, 0, 4], affordable: [false, true, false] },
  ];
  for (const stall of stalls) {
    calls.length = 0;
    const state = { ...initialState(hall), x: STALLS[stall.id], y: 17 * TILE - 26 };
    renderer.draw({ level: hall, state, time: 1000, seed: 'hall', camera: 0, below: null, above: null, ghost: null, trail: [], particles: [], flash: 0, shake: 0, lives: 3, maxLives: 3, over: false, altitude: 0, best: 0, biomeIndex: 2, bannerAge: 1e9, touched: [], frozen: false, building: null, keys, muted: true, toast: null, inventory: { kinds: [], counts: [], active: null }, combo: { links: 0, floor: null, pop: null }, points: 400, runes: 4, gear: [{ id: 'double', active: true }, { id: 'dash', active: false }], stall });
    assert.ok(calls.includes('fillText') && calls.length > 200, `${stall.id} bubble draws`);
  }
});

test('the level-up card draws for one or several new rules', async () => {
  const calls = [];
  const { drawLevelUp } = await import('../src/hud.js');
  for (const ids of [['moon'], ['ice', 'double'], ['heavy', 'glide', 'dark']]) {
    calls.length = 0;
    drawLevelUp(stubContext(calls), { ids, age: 1200, ms: 5200 });
    assert.ok(calls.filter(c => c === "fillText").length >= 1 + ids.length * 2, ids.join());
  }
});

test('stall bubbles float above the keepers wherever the camera is', async () => {
  const { drawStallBubble, stallHit } = await import('../src/stall-ui.js');
  const { STALLS } = await import('../src/tunnel.js');
  const rows = [{ from: 'moon', options: ['moon', 'ice'], current: 'moon' }];
  for (const floor of [510, 380, 250]) {
    const stall = { id: 'rulesmith', age: 500, floor, rows };
    assert.equal(stallHit(stall, STALLS.rulesmith, floor - 2), null, `floor ${floor}`);
    assert.equal(stallHit(stall, STALLS.rulesmith - 40, floor - 140), 1, `floor ${floor}`);
  }
  const calls = [];
  const note = { id: 'merchant', age: 500, floor: 510, note: "Come back when you're more experienced." };
  drawStallBubble(stubContext(calls), note, { accent: '#fff', hazard: '#f00' }, 500);
  assert.ok(calls.includes('fillText'));
  assert.equal(stallHit(note, STALLS.merchant, 440), null);
});
