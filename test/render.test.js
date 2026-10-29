import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, HEIGHT } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState } from '../src/physics.js';
import { THEMES } from '../src/themes.js';

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
  Object.assign(level, { theme, index: 1, palette: 200, title: 'Sample', hints: ['hint'], segments: [], entryCol: 4, exit: { x: 0, y: -300, w: 0, h: 0 } });
  fillTiles(level, 0, 34, 32, 2, SOLID);
  for (const [c, r, w] of [[2, 30, 6], [11, 27, 4], [18, 24, 5], [6, 21, 4], [13, 18, 6]]) fillTiles(level, c, r, w, 1, SOLID);
  fillTiles(level, 9, 24, 3, 1, ONE_WAY);
  addObject(level, { type: 'crate', kind: 'wood', x: 13 * TILE + 1, y: 27 * TILE - 28, w: 28, h: 28 });
  addObject(level, { type: 'climb', x: 19 * TILE + 5, y: 18 * TILE, w: 20, h: 6 * TILE });
  addObject(level, { type: 'monster', kind: 'patroller', x: 2 * TILE, y: 30 * TILE - 20, w: 22, h: 20, dx: 150, dy: 0, period: 300, phase: 0 });
  addObject(level, { type: 'monster', kind: 'flapper', x: 9 * TILE, y: 22 * TILE, w: 22, h: 20, dx: 0, dy: 90, period: 240, phase: 30 });
  const spitter = addObject(level, { type: 'monster', kind: 'spitter', x: 16 * TILE, y: 18 * TILE - 20, w: 22, h: 20, dir: -1 });
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
    const states = [initialState(level), { ...initialState(level), comet: 4, cometWait: 2, vy: -6 }, { ...initialState(level), comet: 2, cometMissed: true }];
    for (const [k, time] of [0, 500, 4000].entries()) {
      renderer.draw({ level, state: states[k], time, seed: 'render', camera: level.height - HEIGHT, below: null, above: null, ghost: null, rival: [null, { index: 1, state: { ...states[0], x: states[0].x + 60 }, altitude: 140, done: false }, { index: 2, state: null, altitude: 900, done: true }][k], maxLives: 3, trail: [], particles: [], flash: 0, shake: 0, lives: 2, over: false, altitude: 100, best: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, message: '', keys, muted: true, toast: null });
    }
    assert.ok(calls.length > 500, `${theme.id} draws`);
  });
});
