import { TILE, COLS, SOLID, EMPTY, fillTiles, addObject, waterRects } from './level.js';

const MIN_ROWS = 12;
const MAX_ROWS = 16;
const MIN_HEADROOM = 4;
const LANE = 2;
const RISE = [3, 4];
const MIN_RUN = 6;
const LEDGE_W = 4;
const SPIKE_H = 14;
const EEL = { w: 26, h: 12 };
const JELLY = { w: 18, h: 18 };
const HAZARD_PERIODS = [240, 120];
const EDGE = 1;

function carver(cells) {
  return (col, row, w, h) => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) cells.add(`${c},${r}`);
  };
}

function layPassage(ctx, entry, floor, roof, band) {
  const { rng } = ctx, cells = new Set(), carve = carver(cells), runs = [], shafts = [], corners = [];
  const far = entry.dir < 0 ? entry.col : entry.col + entry.w - LANE;
  let col = Math.max(EDGE, Math.min(COLS - EDGE - LANE, far)), row = band;
  carve(col, band, LANE, floor - band);
  const point = (c, r) => corners.push({ x: (c + LANE / 2) * TILE, y: (r + LANE / 2) * TILE, w: 3 * TILE, coarse: true });
  point(col, band);
  while (row - rng.int(...RISE) - LANE > roof + 1) {
    const rise = rng.int(...RISE);
    if (row - rise - LANE <= roof) break;
    carve(col, row - rise, LANE, rise);
    shafts.push({ col, top: row - rise, rows: rise });
    row -= rise;
    const toRight = col < COLS / 2, span = rng.int(MIN_RUN, Math.max(MIN_RUN, Math.floor(COLS * 0.55)));
    const next = Math.max(EDGE, Math.min(COLS - EDGE - LANE, col + (toRight ? span : -span)));
    const from = Math.min(col, next), cols = Math.abs(next - col) + LANE;
    carve(from, row - LANE, cols, LANE);
    runs.push({ from, cols, top: row - LANE });
    point(col, row - LANE);
    col = next;
    point(col, row - LANE);
    row -= LANE;
  }
  carve(col, roof, LANE, row - roof);
  return { cells, runs, shafts, corners, exitCol: col };
}

function layDangers(ctx, runs, shafts) {
  const { rng, level, difficulty } = ctx;
  for (const run of runs) {
    if (run.cols < MIN_RUN) continue;
    const period = rng.pick(HAZARD_PERIODS);
    if (rng.chance(0.5)) {
      const low = rng.chance(0.5), y = run.top * TILE + (low ? LANE * TILE - EEL.h - 2 : 2);
      addObject(level, { type: 'monster', kind: 'eel', x: run.from * TILE + 2, y, ...EEL, dx: run.cols * TILE - EEL.w - 4, dy: 0, period, phase: rng.int(0, period - 1) });
      continue;
    }
    const strips = 1 + (rng.chance(difficulty) ? 1 : 0);
    for (let k = 0; k < strips; k++) {
      const col = run.from + LANE + Math.floor(((k + rng.float(0.2, 0.8)) * (run.cols - 2 * LANE - 2)) / strips), up = rng.chance(0.5);
      addObject(level, { type: 'spikes', x: col * TILE + 3, y: up ? run.top * TILE : (run.top + LANE) * TILE - SPIKE_H, w: 2 * TILE - 6, h: SPIKE_H, dir: up ? 1 : -1 });
    }
  }
  for (const shaft of shafts) {
    if (!rng.chance(0.35 + 0.35 * difficulty)) continue;
    const period = rng.pick(HAZARD_PERIODS), side = rng.chance(0.5);
    addObject(level, { type: 'monster', kind: 'jelly', x: (shaft.col + (side ? LANE : 0)) * TILE + (side ? -JELLY.w - 2 : 2), y: shaft.top * TILE, ...JELLY, dx: 0, dy: shaft.rows * TILE - JELLY.h, period, phase: rng.int(0, period - 1) });
  }
}

export function raiseSunken(ctx, entry, topRow) {
  const { level } = ctx, floor = entry.row, rows = Math.min(MAX_ROWS, floor - topRow);
  if (rows < MIN_ROWS) return null;
  const roof = floor - rows;
  const band = floor - Math.max(MIN_HEADROOM, ctx.clearance);
  fillTiles(level, 0, roof, COLS, band - roof, SOLID);
  const { cells, runs, shafts, corners, exitCol } = layPassage(ctx, entry, floor, roof, band);
  for (const key of cells) { const [c, r] = key.split(',').map(Number); fillTiles(level, c, r, 1, 1, EMPTY); }
  if (ctx.cave) fillTiles(level, 0, roof - ctx.clearance, COLS, ctx.clearance, EMPTY);
  for (const rect of waterRects((c, r) => cells.has(`${c},${r}`), (c, r) => r < roof, COLS, level.rows)) addObject(level, { type: 'water', ...rect });
  layDangers(ctx, runs, shafts);
  const col = exitCol + LANE + LEDGE_W <= COLS ? exitCol + LANE : exitCol - LEDGE_W;
  const top = { col, row: roof, w: LEDGE_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: col < COLS / 2 ? 1 : -1 };
  const route = [...corners, { x: (top.col + LEDGE_W / 2) * TILE, y: roof * TILE - ctx.size.h / 2, w: LEDGE_W * TILE }];
  return { top, route, nodes: [entry, top], footprint: { col: 0, row: band, w: COLS, span: band - roof }, bounds: { roof, floor } };
}
