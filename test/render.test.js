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
    for (const time of [0, 500, 4000]) {
      renderer.draw({ level, state: initialState(level), time, seed: 'render', camera: level.height - HEIGHT, below: null, above: null, ghost: null, trail: [], particles: [], flash: 0, shake: 0, lives: 5, over: false, altitude: 100, best: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, message: '', keys, muted: true, toast: null });
    }
    assert.ok(calls.length > 500, `${theme.id} draws`);
  });
});
