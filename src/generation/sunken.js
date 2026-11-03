import { TILE, COLS, SOLID, EMPTY, fillTiles, addObject, waterRects } from '../world/level.js';

const MIN_ROWS = 12;
const MAX_ROWS = 18;
const MIN_HEADROOM = 4;
const LANE = 2;
const PIECE = [4, 7];
const EDGE = 1;
const MIN_FIERCE = 0.35;
const LEDGE_W = 4;
const SPIKE_H = 14;
const EEL = { w: 26, h: 12 };
const JELLY = { w: 18, h: 18 };
const HAZARD_PERIODS = [240, 120];
const CURRENT = 0.12;
const POCKET = { w: 2, h: 2, coins: 3, clear: 2 };

function carver(cells) {
  return (col, row, w, h) => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) cells.add(`${c},${r}`);
  };
}

function laySweep(ctx, walk, carve, low, high, dir) {
  const { rng } = ctx;
  const margin = EDGE + LANE;
  while (dir > 0 ? walk.col < COLS - margin - PIECE[0] : walk.col > margin + PIECE[0]) {
    const length = Math.min(rng.int(...PIECE), dir > 0 ? COLS - margin - walk.col : walk.col - margin);
    const next = walk.col + dir * length, from = Math.min(walk.col, next);
    carve(from, walk.top, length + LANE, LANE);
    walk.pieces.push({ from, cols: length + LANE, top: walk.top, dir });
    walk.point(next, walk.top);
    walk.col = next;
    const options = [-3, -2, 2, 3].map(step => walk.top + step).filter(top => top >= low && top <= high);
    if (!options.length) continue;
    const top = rng.pick(options), start = Math.min(top, walk.top), rows = Math.abs(top - walk.top) + LANE;
    carve(walk.col, start, LANE, rows);
    walk.shafts.push({ col: walk.col, top: start, rows, down: top > walk.top });
    walk.top = top;
    walk.point(walk.col, walk.top);
  }
}

function layPassage(ctx, entry, floor, roof, band, fierce) {
  const cells = new Set(), carve = carver(cells), corners = [];
  const far = entry.dir < 0 ? entry.col : entry.col + entry.w - LANE;
  const point = (c, r) => corners.push({ x: (c + LANE / 2) * TILE, y: (r + LANE / 2) * TILE, w: 3 * TILE });
  const col = Math.max(EDGE + LANE, Math.min(COLS - EDGE - 2 * LANE, far));
  carve(col, band, LANE, floor - band);
  const walk = { col, top: band - LANE, pieces: [], shafts: [], point };
  carve(col, band - LANE, LANE, LANE);
  point(col, band - LANE);
  const sweeps = fierce < 0.6 ? 1 : 2, height = band - roof - LANE, each = Math.floor(height / sweeps);
  let dir = col < COLS / 2 ? 1 : -1;
  for (let k = 0; k < sweeps; k++) {
    const high = band - LANE - k * each, low = Math.max(roof + 1, high - each + LANE + 1);
    if (k) {
      carve(walk.col, low, LANE, walk.top - low + LANE);
      walk.shafts.push({ col: walk.col, top: low, rows: walk.top - low + LANE, down: false });
      walk.top = low;
      point(walk.col, walk.top);
    }
    laySweep(ctx, walk, carve, low, high, dir);
    dir = -dir;
  }
  carve(walk.col, roof, LANE, walk.top - roof + LANE);
  walk.shafts.push({ col: walk.col, top: roof, rows: walk.top - roof, down: false });
  return { cells, pieces: walk.pieces, shafts: walk.shafts, corners, exitCol: walk.col };
}

function layTeeth(level, piece, rng, fierce) {
  const teeth = [];
  let high = rng.chance(0.5);
  for (let col = piece.from + LANE + 1; col < piece.from + piece.cols - LANE - 1; col += 3) {
    if (!rng.chance(0.35 + 0.5 * fierce)) continue;
    fillTiles(level, col, high ? piece.top : piece.top + 1, 1, 1, SOLID);
    teeth.push(col);
    high = !high;
  }
  return teeth;
}

function layStrip(level, piece, col, up) {
  addObject(level, { type: 'spikes', x: col * TILE + 3, y: up ? piece.top * TILE : (piece.top + LANE) * TILE - SPIKE_H, w: TILE - 6, h: SPIKE_H, dir: up ? 1 : -1 });
}

function layPieceDanger(ctx, piece, fierce) {
  const { rng, level } = ctx;
  const roll = rng.float(0, 1);
  if (roll < 0.4) return layTeeth(level, piece, rng, fierce);
  if (roll < 0.7 && piece.cols >= 6) {
    const period = rng.pick(HAZARD_PERIODS), low = rng.chance(0.5), y = piece.top * TILE + (low ? LANE * TILE - EEL.h - 2 : 2);
    addObject(level, { type: 'monster', kind: 'eel', x: piece.from * TILE + 2, y, ...EEL, dx: piece.cols * TILE - EEL.w - 4, dy: 0, period, phase: rng.int(0, period - 1) });
    return [];
  }
  let up = rng.chance(0.5);
  for (let col = piece.from + LANE; col < piece.from + piece.cols - LANE; col += 2) {
    if (rng.chance(0.3 + 0.5 * fierce)) layStrip(level, piece, col, up);
    up = !up;
  }
  return [];
}

function layCurrents(ctx, pieces, shafts, fierce) {
  const { rng, level } = ctx;
  for (const piece of pieces) {
    if (!rng.chance(0.15 + 0.3 * fierce)) continue;
    addObject(level, { type: 'wind', x: piece.from * TILE, y: piece.top * TILE, w: piece.cols * TILE, h: LANE * TILE, ax: -piece.dir * CURRENT, ay: 0 });
  }
  for (const shaft of shafts) {
    if (shaft.down || shaft.rows < 3 || !rng.chance(0.2 + 0.3 * fierce)) continue;
    addObject(level, { type: 'wind', x: shaft.col * TILE, y: shaft.top * TILE, w: LANE * TILE, h: shaft.rows * TILE, ax: 0, ay: CURRENT });
  }
}

function layJellies(ctx, shafts, fierce) {
  const { rng, level } = ctx;
  for (const shaft of shafts) {
    if (shaft.rows < 3 || !rng.chance(0.25 + 0.4 * fierce)) continue;
    const period = rng.pick(HAZARD_PERIODS), side = rng.chance(0.5);
    addObject(level, { type: 'monster', kind: 'jelly', x: (shaft.col + (side ? LANE : 0)) * TILE + (side ? -JELLY.w - 2 : 2), y: shaft.top * TILE, ...JELLY, dx: 0, dy: shaft.rows * TILE - JELLY.h, period, phase: rng.int(0, period - 1) });
  }
}

function layPockets(ctx, cells, carve, pieces, roof) {
  const { rng, level } = ctx;
  const free = (col, top) => {
    for (let r = top - POCKET.clear; r < top; r++) for (let c = col - 1; c < col + POCKET.w + 1; c++) if (r <= roof || cells.has(`${c},${r}`)) return false;
    return true;
  };
  const pockets = [];
  for (const piece of rng.shuffle(pieces)) {
    if (pockets.length >= 2 || piece.cols < 6) continue;
    const col = piece.from + rng.int(LANE, piece.cols - LANE - POCKET.w);
    if (!free(col, piece.top - POCKET.h + 1)) continue;
    carve(col, piece.top - POCKET.h, POCKET.w, POCKET.h);
    pockets.push({ col, top: piece.top - POCKET.h });
  }
  return () => {
    for (const { col, top } of pockets) for (let k = 0; k < POCKET.coins; k++) addObject(level, { type: 'coin', x: (col + 1) * TILE - 7 + (k - 1) * 16, y: (top + 0.5) * TILE - 7, w: 14, h: 14 });
  };
}

export function raiseSunken(ctx, entry, topRow, fierceness) {
  const { level } = ctx, floor = entry.row, fierce = Math.max(MIN_FIERCE, fierceness);
  const rows = Math.min(MIN_ROWS + Math.round((MAX_ROWS - MIN_ROWS) * fierce), floor - topRow);
  if (rows < MIN_ROWS) return null;
  const roof = floor - rows, band = floor - Math.max(MIN_HEADROOM, ctx.clearance);
  fillTiles(level, 0, roof, COLS, band - roof, SOLID);
  const { cells, pieces, shafts, corners, exitCol } = layPassage(ctx, entry, floor, roof, band, fierce);
  const coins = layPockets(ctx, cells, carver(cells), pieces, roof);
  for (const key of cells) { const [c, r] = key.split(',').map(Number); fillTiles(level, c, r, 1, 1, EMPTY); }
  if (ctx.cave) fillTiles(level, 0, roof - ctx.clearance, COLS, ctx.clearance, EMPTY);
  for (const piece of pieces) layPieceDanger(ctx, piece, fierce);
  for (const rect of waterRects((c, r) => cells.has(`${c},${r}`) && level.tiles[r * COLS + c] !== SOLID, (c, r) => r < roof, COLS, level.rows)) addObject(level, { type: 'water', ...rect });
  layCurrents(ctx, pieces, shafts, fierce);
  layJellies(ctx, shafts, fierce);
  coins();
  const col = exitCol + LANE + LEDGE_W <= COLS ? exitCol + LANE : exitCol - LEDGE_W;
  const top = { col, row: roof, w: LEDGE_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: col < COLS / 2 ? 1 : -1 };
  const route = [...corners, { x: (top.col + LEDGE_W / 2) * TILE, y: roof * TILE - ctx.size.h / 2, w: LEDGE_W * TILE }];
  return { top, route, nodes: [entry, top], footprint: { col: 0, row: band, w: COLS, span: band - roof }, extent: { roof, band } };
}
