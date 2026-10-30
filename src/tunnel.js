import { TILE, COLS, ROWS, WIDTH, SOLID, createLevel, fillTiles } from './level.js';
import { initialState, playerSize } from './physics.js';
import { inventoryOf } from './climb.js';

export const MOUTH = { w: 2, h: 2 };
export const HALL_CEILING = 8;
const EDGE = 2;
export const MERCHANT = 'merchant';
export const RULESMITH = 'rulesmith';
export const OUTFITTER = 'outfitter';
export const DICER = 'dicer';
export const STALLS = { [MERCHANT]: WIDTH / 5, [OUTFITTER]: (WIDTH * 2) / 5, [RULESMITH]: (WIDTH * 3) / 5, [DICER]: (WIDTH * 4) / 5 };
const REACH = 64;
const halls = new WeakMap();

export function hallOf(level) {
  let hall = halls.get(level);
  if (!hall) {
    hall = createLevel({ ...level.rules, flood: 0 }, level.mutators, ROWS);
    fillTiles(hall, 0, ROWS - 1, COLS, 1, SOLID);
    fillTiles(hall, 0, 0, COLS, HALL_CEILING, SOLID);
    Object.assign(hall, { hall: true, index: -1, variant: Math.max(0, level.index), theme: level.theme, palette: level.palette, title: 'Underpass', segments: [], exit: { x: 0, y: -10 * TILE, w: 0, h: 0 } });
    halls.set(level, hall);
  }
  return hall;
}

export function tunnelExit(level, s, input) {
  const { w, h } = playerSize(level.rules);
  const onFloor = s.grounded && s.gravDir > 0 && Math.abs(s.y + h - (level.rows - 1) * TILE) < 1;
  if (!onFloor || !(input.left || input.right) || s.held >= 0 || s.rope >= 0 || s.dead || s.won) return 0;
  if (s.x <= 0.5 && s.facing < 0) return -1;
  if (s.x >= WIDTH - w - 0.5 && s.facing > 0) return 1;
  return 0;
}

export function arrive(level, base, from, side) {
  const { w, h } = playerSize(level.rules);
  return {
    ...base,
    ...inventoryOf(from),
    x: side < 0 ? WIDTH - w - EDGE : EDGE,
    y: (level.rows - 1) * TILE - h,
    vx: from.vx, vy: 0, facing: side, grounded: true, frame: from.frame,
  };
}

export const enterHall = (hall, s, side) => arrive(hall, initialState(hall), s, side);

export function stallAt(level, s) {
  if (!level.hall || !s.grounded) return null;
  const { w } = playerSize(level.rules);
  return Object.keys(STALLS).find(id => Math.abs(s.x + w / 2 - STALLS[id]) < REACH) ?? null;
}
