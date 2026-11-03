import { KINDS } from '../src/world/items.js';
import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';

export function stubContext(calls) {
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

export function stubCanvas(calls) {
  const ctx = stubContext(calls);
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

export function sample(theme) {
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
  const row = 22 * TILE;
  const elements = [
    { type: 'mover', w: 60, h: TILE, dx: 30, dy: 0, period: 240, phase: 0 }, { type: 'crumble', w: 60, h: TILE }, { type: 'conveyor', w: 90, h: TILE, speed: 2 },
    { type: 'toggle', w: 60, h: TILE, bit: 1, on: true }, { type: 'phase', w: 60, h: TILE, period: 240, on: 240, phase: 0 }, { type: 'gate', w: 12, h: 60, period: 240, on: 240, phase: 0 },
    { type: 'door', w: TILE, h: 60, bit: 2 }, { type: 'door', w: TILE, h: 60, bit: 2, plate: true }, { type: 'cannon', w: 34, h: 34, angle: -1, vel: 14, arc: 0 }, { type: 'portal', w: 20, h: 34 },
    { type: 'hook', w: 12, h: 12, reach: 90 }, { type: 'refill', w: 18, h: 18 }, { type: 'key', w: 16, h: 18, bit: 4 }, { type: 'orb', w: 16, h: 18, bit: 8 }, { type: 'coin', w: 14, h: 14 },
    { type: 'lever', w: 28, h: 30, bit: 2 }, { type: 'switch', w: 16, h: 18, bit: 2 }, { type: 'plate', w: 26, h: 6, bit: 2 }, { type: 'gravpad', w: 24, h: 8, dir: -1 }, { type: 'water', w: 90, h: 60 },
    { type: 'crate', kind: 'steel', w: 28, h: 28 }, { type: 'crate', kind: 'stone', w: 28, h: 28 }, { type: 'spikes', w: 24, h: 14, dir: -1 },
    { type: 'saw', kind: 'mine', w: 24, h: 24, dx: 0, dy: 0, period: 240, phase: 0 }, { type: 'saw', kind: 'crusher', w: 30, h: 30, dx: 0, dy: 30, period: 240, phase: 0 },
    { type: 'laser', w: 12, h: 60, dir: 1, period: 240, on: 240, phase: 0, steady: true }, { type: 'laser', kind: 'flame', w: 18, h: 40, dir: 1, period: 240, on: 240, phase: 0 },
  ];
  elements.forEach((element, k) => addObject(level, { ...element, x: (k % 9) * 3 * TILE + 10, y: row + Math.floor(k / 9) * 3 * TILE }));
  level.start = { x: 4 * TILE, y: 30 * TILE - 26 };
  return level;
}
