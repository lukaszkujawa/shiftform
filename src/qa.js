import { TILE, COLS, SOLID, ONE_WAY, EMPTY, CRATE_SIZE, SPRING_VEL, HOOK_REACH, createLevel, fillTiles, addObject, tileAt, levelIndex, refreshIndex, overlaps } from './level.js?v=b79de16';
import { buildRules } from './rules.js?v=b79de16';
import { playerSize } from './physics.js?v=b79de16';
import { THEMES } from './themes.js?v=b79de16';

export const QA_SEED = 'test';
const ROWS = 36;
const MONSTER = { w: 22, h: 20 };
const UPDRAFT = 0.73;

export function sandboxLevel() {
  const level = createLevel(buildRules([]), [], ROWS);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  fillTiles(level, 0, 0, COLS, 1, SOLID);
  Object.assign(level, {
    index: 0, theme: THEMES.findIndex(t => t.id === 'paper'), palette: 200, title: 'QA sandbox', entryCol: 2, exitCol: COLS - 3, style: 'open', focus: 'first',
    segments: [], solution: [], itemProofs: [], exit: { x: -1e6, y: -1e6, w: 0, h: 0 }, start: { x: 200, y: (ROWS - 1) * TILE - playerSize(level.rules).h },
  });
  return level;
}

const cell = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });
const tile = kind => (level, x, y) => { const { col, row } = cell(x, y); fillTiles(level, col, row, 1, 1, kind); return null; };
const standing = shape => (level, x, y) => { const { col, row } = cell(x, y); return addObject(level, { ...shape, x: col * TILE + (TILE - shape.w) / 2, y: (row + 1) * TILE - shape.h }); };
const filling = shape => (level, x, y) => { const { col, row } = cell(x, y); return addObject(level, { ...shape, x: Math.min(col, COLS - shape.w / TILE) * TILE, y: row * TILE }); };
const monster = (kind, extra) => standing({ type: 'monster', kind, ...MONSTER, ...extra });

export const BLOCKS = [
  { id: 'solid', place: tile(SOLID) },
  { id: 'one-way', place: tile(ONE_WAY) },
  { id: 'trampoline', place: standing({ type: 'spring', w: TILE - 8, h: 12, dir: -1, vel: SPRING_VEL }) },
  { id: 'bumper →', place: standing({ type: 'bumper', w: 24, h: 24, dir: 1 }) },
  { id: 'bumper ←', place: standing({ type: 'bumper', w: 24, h: 24, dir: -1 }) },
  { id: 'conveyor', place: filling({ type: 'conveyor', w: 3 * TILE, h: TILE, speed: 2 }) },
  { id: 'mover ↔', place: filling({ type: 'mover', w: 3 * TILE, h: TILE, dx: 90, dy: 0, period: 240, phase: 0 }) },
  { id: 'mover ↕', place: filling({ type: 'mover', w: 3 * TILE, h: TILE, dx: 0, dy: -90, period: 240, phase: 0 }) },
  { id: 'phase platform', place: filling({ type: 'phase', w: 3 * TILE, h: TILE, period: 240, on: 132, phase: 0 }) },
  { id: 'crumble', place: filling({ type: 'crumble', w: 2 * TILE, h: TILE }) },
  { id: 'ladder', place: (level, x, y) => { const { col, row } = cell(x, y), bottom = (row + 1) * TILE, top = Math.max(TILE, bottom - 6 * TILE); return addObject(level, { type: 'climb', x: col * TILE + 5, y: top, w: TILE - 10, h: bottom - top }); } },
  { id: 'hook', place: standing({ type: 'hook', w: 12, h: 12, reach: HOOK_REACH }) },
  { id: 'water', place: filling({ type: 'water', w: 4 * TILE, h: 3 * TILE }) },
  { id: 'updraft', place: filling({ type: 'wind', w: 2 * TILE, h: 6 * TILE, ax: 0, ay: -UPDRAFT }) },
  { id: 'gust →', place: filling({ type: 'wind', w: 4 * TILE, h: 3 * TILE, ax: 0.25, ay: 0 }) },
  { id: 'saw', place: standing({ type: 'saw', w: 26, h: 26, dx: 90, dy: 0, period: 240, phase: 0 }) },
  { id: 'laser', place: (level, x, y) => { const { col, row } = cell(x, y), bottom = (row + 1) * TILE, top = Math.max(TILE, bottom - 5 * TILE); return addObject(level, { type: 'laser', x: col * TILE + 11, y: top, w: 8, h: bottom - top, period: 240, on: 96, phase: 0, dir: 1 }); } },
  { id: 'spikes', place: standing({ type: 'spikes', w: TILE, h: 14, dir: -1 }) },
  { id: 'gravity pad', place: standing({ type: 'gravpad', w: TILE - 6, h: 8, dir: -1 }) },
  { id: 'patroller', place: monster('patroller', { dx: 150, dy: 0, period: 300, phase: 0 }) },
  { id: 'flapper', place: monster('flapper', { dx: 0, dy: 90, period: 240, phase: 30 }) },
  { id: 'spitter', place: monster('spitter', { dir: -1 }) },
  { id: 'hopper', place: monster('hopper', { motion: 'hop', dx: 60, dy: 0, lift: 60, period: 240, phase: 0 }) },
  { id: 'urchin', place: monster('urchin', { motion: 'orbit', dx: 20, dy: 30, period: 240, phase: 0 }) },
  { id: 'spider', place: monster('spider', { motion: 'drop', dx: 0, dy: 60, period: 240, phase: 0 }) },
  { id: 'wood crate', place: standing({ type: 'crate', kind: 'wood', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'steel crate', place: standing({ type: 'crate', kind: 'steel', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'stone crate', place: standing({ type: 'crate', kind: 'stone', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'coin', place: standing({ type: 'coin', w: 14, h: 14 }) },
  { id: 'jetpack', place: standing({ type: 'item', kind: 'jetpack', w: 20, h: 20 }) },
  { id: 'spring boots', place: standing({ type: 'item', kind: 'boots', w: 20, h: 20 }) },
  { id: 'shield', place: standing({ type: 'item', kind: 'shield', w: 20, h: 20 }) },
  { id: 'heart', place: standing({ type: 'item', kind: 'heart', w: 20, h: 20 }) },
  { id: 'comet', place: standing({ type: 'item', kind: 'comet', w: 20, h: 20 }) },
  { id: 'checkpoint', place: standing({ type: 'checkpoint', w: 24, h: 40 }) },
];

export const freshBody = crate => ({ x: crate.x, y: crate.y, vx: 0, vy: 0, grounded: false, ground: -1, inPortal: false, gone: false, asleep: 0 });

export function removeAt(level, state, x, y) {
  const { col, row } = cell(x, y);
  const hit = level.objects.filter(o => o.type !== 'removed' && overlaps(col * TILE, row * TILE, TILE, TILE, o)).at(-1);
  if (hit?.type === 'crate') {
    const k = levelIndex(level).crates.indexOf(hit);
    return { ...state, bodies: state.bodies.map((b, i) => (i === k ? { ...b, gone: true } : b)) };
  }
  if (hit) {
    hit.type = 'removed';
    refreshIndex(level);
    return state;
  }
  if (row > 0 && row < level.rows - 1 && tileAt(level, col, row) !== EMPTY) fillTiles(level, col, row, 1, 1, EMPTY);
  return state;
}
