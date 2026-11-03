import { test } from 'node:test';
import { KINDS } from '../src/items.js';
import { ITEM_COLORS } from '../src/icons.js';
import assert from 'node:assert/strict';
import { TILE, HEIGHT } from '../src/level.js';
import { initialState } from '../src/physics.js';
import { THEMES } from '../src/themes.js';
import { createAvatar, DROWSY_FRAMES, ASLEEP_FRAMES } from '../src/avatar.js';

import { sample, stubCanvas, stubContext } from './render-fixtures.js';

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
    const states = [initialState(level), { ...initialState(level), comet: 4, cometWait: 2, vy: -6, placed: [{ kind: 'tomb', x: 200, y: 500, w: 26, h: 18, id: -1, from: 500, born: 0, path: [[200, 500]] }, { kind: 'plank', x: 300, y: 600, w: 90, h: 30, id: -1 }, { kind: 'trampoline', x: 400, y: 660, w: 60, h: 12, id: -1 }, { kind: 'ladder', x: 500, y: 500, w: 20, h: 180, id: -1 }] }, { ...initialState(level), comet: 2, cometMissed: true }];
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

test('the underpass draws its keepers and every stall bubble', async () => {
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
    { id: 'trainer', age: 400, skills: [{ id: 'dash', level: 2, price: 3, affordable: true, tip: {} }, { id: 'jump', level: 5, price: 6, affordable: false, tip: {} }, { id: 'torch', level: 0, price: 0, affordable: true, tip: {} }] },
    { id: 'dicer', age: 400, dice: true, affordable: true },
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
    drawLevelUp(stubContext(calls), { ids, reward: { runes: 1, gold: 100 }, age: 1200, ms: 5200 });
    assert.ok(calls.filter(c => c === "fillText").length >= 1 + ids.length * 2, ids.join());
  }
});

test('stall bubbles float above the keepers wherever the camera is', async () => {
  const { drawStallBubble, stallHit } = await import('../src/stall-ui.js');
  const { STALLS } = await import('../src/tunnel.js');
  const skills = [{ id: 'dash', level: 0, price: 1, affordable: true, tip: {} }];
  for (const floor of [510, 380, 250]) {
    const stall = { id: 'trainer', age: 500, floor, skills };
    assert.equal(stallHit(stall, STALLS.trainer, floor - 2), null, `floor ${floor}`);
    assert.equal(stallHit(stall, STALLS.trainer - 10, floor - 140), 1, `floor ${floor}`);
  }
  const calls = [];
  const note = { id: 'merchant', age: 500, floor: 510, note: "Come back when you're more experienced." };
  drawStallBubble(stubContext(calls), note, { accent: '#fff', hazard: '#f00' }, 500);
  assert.ok(calls.includes('fillText'));
  assert.equal(stallHit(note, STALLS.merchant, 440), null);
});

test('a crate landing on a trampoline bends it like the climber does', async () => {
  const { drawSpring } = await import('../src/gadgets.js');
  const padOf = (spring, touchers, time) => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, key) => (key === 'fillRect' ? (...args) => calls.push(args) : () => {}), set: () => true });
    drawSpring(ctx, { accent: 'hsl(0 0% 50% / 1)' }, spring, time, touchers);
    return calls[0][1];
  };
  const spring = { id: 901, x: 100, y: 500, w: 22, h: 12, dir: -1 }, idle = { id: 902, x: 400, y: 500, w: 22, h: 12, dir: -1 };
  const crate = { x: 98, y: 472, w: 28, h: 28 };
  padOf(spring, [crate], 1000);
  assert.notEqual(padOf(spring, [], 1050), padOf(idle, [], 1050), 'the pad is still moving fifty milliseconds after the crate hit it');
});

test('a custom level with every block built draws a full frame', async () => {
  const calls = [];
  globalThis.OffscreenCanvas = class { constructor() { return stubCanvas(calls); } };
  globalThis.Path2D = class { constructor() { return stubContext(calls); } };
  const { createRenderer } = await import('../src/render.js');
  const { BLOCKS, blankBlueprint, levelFrom } = await import('../src/blueprint.js');
  const { createEditor } = await import('../src/editor.js');
  const editor = createEditor(blankBlueprint(72));
  BLOCKS.forEach((block, i) => editor.place(block, { c: 2 + (i % 12) * 2, r: 5 + Math.floor(i / 12) * 10, w: block.size?.[0] ?? 1, h: block.size?.[1] ?? 1 }));
  const level = levelFrom(editor.blueprint);
  const renderer = createRenderer(stubCanvas(calls));
  const state = initialState(level);
  renderer.draw({ level, state, time: 500, seed: 'test', camera: 0, below: null, above: null, ghost: null, rival: null, trail: [], particles: [], flash: 0, shake: 0, lives: 3, maxLives: 3, altitude: 0, best: 0, record: 0, biomeIndex: 0, collected: [], runes: 0, keys: {}, skills: [], points: 0, inventory: [], planted: [], path: [], touched: [], stall: null, editing: { at: { c: 3, r: 3 }, rect: { c: 3, r: 3, w: 2, h: 1 }, block: BLOCKS.find(b => b.id === 'wheel'), erasing: false, wiring: false, linking: null, items: editor.blueprint.items } });
  assert.ok(calls.length > 100, 'the world and the editor overlay were drawn');
});

test('the badge shows the level you are on, however many banes you have met', async () => {
  const calls = [], texts = [];
  globalThis.OffscreenCanvas = class { constructor() { return stubCanvas(calls); } };
  globalThis.Path2D = class { constructor() { return stubContext(calls); } };
  const { createRenderer } = await import('../src/render.js');
  const inner = stubContext(calls);
  const ctx = new Proxy(inner, {
    get: (target, key) => (key === 'fillText' ? text => { texts.push(text); } : target[key]),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const renderer = createRenderer({ width: 0, height: 0, style: {}, getContext: () => ctx });
  const level = sample(0), keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  for (const biomeIndex of [0, 6]) {
    renderer.draw({ level, state: initialState(level), time: 0, seed: 'badge', camera: level.height - HEIGHT, below: null, above: null, ghost: null, rival: null, trail: [], particles: [], flash: 0, shake: 0, lives: 3, maxLives: 3, over: false, altitude: 0, best: 0, biomeIndex, bannerAge: 1e9, touched: [], frozen: false, building: null, keys, muted: true, toast: null, collected: [] });
  }
  assert.ok(texts.includes('LV 1') && texts.includes('LV 7'), texts.filter(t => /^LV/.test(t)).join());
});
