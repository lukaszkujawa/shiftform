import { TILE, COLS, SOLID, ONE_WAY, tileAt } from './level.js?v=dc4d896';
import { levelRng } from './rng.js?v=dc4d896';

const FREE_SHARE = 0.14;
const FREE_WIDTH = 4;
const PROP_RUN = 9;
const HANG_RUN = 8;
const HANG_CHANCE = 0.3;
const BRACE_REACH = 8;
const MAST_GAP = 7;
const MAST_LIMIT = 4;
const MAST_BASE = 3;
const TIE_MIN = 8;
const TIE_MAX = 13;
const SPOT_CHANCE = 0.5;
const LEDGE_TYPES = new Set(['conveyor', 'crumble']);
const MOVING_TYPES = new Set(['mover']);

function findBlobs(level) {
  const owner = new Int32Array(level.rows * COLS).fill(-1);
  const at = (c, r) => r * COLS + c;
  const blobs = [];
  const add = cells => {
    const id = blobs.length;
    const blob = { id, left: COLS, right: 0, top: level.rows, bottom: 0, anchored: false, floorOf: new Map() };
    for (const [c, r] of cells) {
      owner[at(c, r)] = id;
      blob.left = Math.min(blob.left, c);
      blob.right = Math.max(blob.right, c + 1);
      blob.top = Math.min(blob.top, r);
      blob.bottom = Math.max(blob.bottom, r + 1);
      blob.floorOf.set(c, Math.max(blob.floorOf.get(c) ?? 0, r + 1));
      if (c === 0 || c === COLS - 1 || r === 0 || r === level.rows - 1) blob.anchored = true;
    }
    blobs.push(blob);
  };
  const filled = (c, r) => c >= 0 && c < COLS && r >= 0 && r < level.rows && owner[at(c, r)] === -1 && [SOLID, ONE_WAY].includes(tileAt(level, c, r));
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!filled(c, r)) continue;
      const cells = [], queue = [[c, r]];
      owner[at(c, r)] = -2;
      while (queue.length) {
        const [x, y] = queue.pop();
        cells.push([x, y]);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!filled(nx, ny)) continue;
          owner[at(nx, ny)] = -2;
          queue.push([nx, ny]);
        }
      }
      add(cells);
    }
  }
  for (const o of level.objects) {
    if (!LEDGE_TYPES.has(o.type)) continue;
    const col = Math.floor(o.x / TILE), row = Math.floor(o.y / TILE), w = Math.round(o.w / TILE);
    add(Array.from({ length: w }, (_, i) => [col + i, row]).filter(([c]) => c >= 0 && c < COLS));
  }
  return { blobs, ownerAt: (c, r) => (r >= 0 && r < level.rows ? owner[at(c, r)] : -1) };
}

function chooseFree(rng, floats) {
  return new Set(floats.filter(b => b.right - b.left <= FREE_WIDTH && rng.chance(FREE_SHARE)).map(b => b.id));
}

const widthOf = (rows, w) => Math.min(w, 12 + rows * 1.2);

function chooseMasts(rng, level, needy) {
  const masts = [];
  const score = col => needy.filter(b => !b.mast && Math.abs((b.left + b.right) / 2 - col) <= BRACE_REACH).length;
  const candidates = Array.from({ length: COLS - 5 }, (_, i) => i + 2);
  for (let n = 0; n < MAST_LIMIT; n++) {
    const open = candidates.filter(col => masts.every(m => Math.abs(m - col) >= MAST_GAP));
    if (!open.length) break;
    const best = rng.shuffle(open).reduce((a, b) => (score(b) > score(a) ? b : a));
    if (score(best) === 0 && masts.length >= MAST_BASE) break;
    masts.push(best);
    for (const b of needy) if (Math.abs((b.left + b.right) / 2 - best) <= BRACE_REACH) b.mast ??= best;
  }
  return masts.sort((a, b) => a - b);
}

function braceTo(out, blob, mastCol) {
  const mx = (mastCol + 0.5) * TILE;
  const side = mx < (blob.left + blob.right) * TILE / 2 ? blob.left : blob.right;
  const edge = (mx < side * TILE ? side + 0.5 : side - 0.5) * TILE;
  const y = (blob.bottom + 0.2) * TILE;
  const drop = Math.min(3 * TILE, Math.abs(edge - mx) * 0.6);
  out.beams.push({ x0: mx, y0: y, x1: edge, y1: y });
  out.knees.push({ x0: mx, y0: y + drop, x1: mx + (edge - mx) * 0.6, y1: y });
  out.joints.push({ x: mx, y }, { x: edge, y });
}

const STRUT_RUN = 9;
const FORK_MIN_ROWS = 2;
const STRUT_CHANCE = 0.55;
const OPEN_BAY_CHANCE = 0.18;

function strutFrom(ownerOf, free, mastCols, col, row, dir, rows) {
  for (let step = 1; step <= STRUT_RUN; step++) {
    const c = col + dir * step, r = row + step;
    if (c < 0 || c >= COLS) return { col: c - dir, row: r - 1, hits: 'edge', step };
    if (mastCols.includes(c)) return { col: c, row: r, hits: 'mast', step };
    if (r >= rows) return null;
    const id = ownerOf(c, r);
    if (id >= 0 && !free.has(id)) return { col: c, row: r, hits: id, step };
  }
  return null;
}

export function growStructure(level) {
  const rng = levelRng(level, 'structure', 23, 11);
  const out = { masts: [], props: [], forks: [], struts: [], trestles: [], hangers: [], beams: [], knees: [], ties: [], crosses: [], bays: [], rails: [], joints: [], feet: [], spots: [] };
  const { blobs, ownerAt } = findBlobs(level);
  const floats = blobs.filter(b => !b.anchored).sort((a, b) => b.bottom - a.bottom);
  const free = chooseFree(rng, floats);
  const solidBelow = (col, from) => {
    for (let r = from; r < level.rows; r++) {
      const id = ownerAt(col, r);
      if (id >= 0 && !free.has(id)) return { row: r, id };
    }
    return { row: level.rows - 1, id: -1 };
  };
  const held = floats.filter(b => !free.has(b.id));
  const midOf = b => Math.floor((b.left + b.right - 1) / 2);
  const under = b => ({ col: midOf(b), from: b.floorOf.get(midOf(b)) ?? b.bottom });
  for (const b of held) { const u = under(b); b.run = solidBelow(u.col, u.from).row - u.from; }
  const mastCols = chooseMasts(rng, level, held.filter(b => b.run > PROP_RUN));
  const floorY = (level.rows - 1) * TILE;
  const reachOf = col => held.filter(b => Math.abs((b.left + b.right) / 2 - col) <= BRACE_REACH);
  const highest = col => Math.min(...reachOf(col).map(b => b.top), level.rows - 1);
  for (const col of mastCols) {
    const top = Math.max(0, highest(col) - rng.int(2, 5));
    out.masts.push({ x: (col + 0.5) * TILE, top: top * TILE, bottom: floorY });
    out.feet.push({ x: (col + 0.5) * TILE, y: floorY, w: 3 * TILE });
  }
  const standing = new Set();
  const carrying = new Set();
  for (const b of held) {
    const { col, from } = under(b);
    const below = solidBelow(col, from), rows = below.row - from, x = (col + 0.5) * TILE, w = b.right - b.left;
    const dir = rng.chance(0.5) ? -1 : 1, edge = dir > 0 ? b.right - 1 : b.left;
    const strut = rng.chance(STRUT_CHANCE) ? strutFrom(ownerAt, free, mastCols, edge, b.bottom, dir, level.rows) : null;
    const nearMast = b.mast !== undefined && mastCols.includes(b.mast);
    if (nearMast && rows > PROP_RUN) {
      braceTo(out, b, b.mast);
    } else if (strut && (rows > 2 || strut.step < rows)) {
      const y0 = b.bottom * TILE;
      out.struts.push({ x0: (edge + 0.5) * TILE, y0, x1: (strut.col + 0.5) * TILE, y1: strut.row * TILE, w: 8 + strut.step * 0.8 });
      out.joints.push({ x: (edge + 0.5) * TILE, y: y0 + 2 });
      if (typeof strut.hits === 'number') carrying.add(strut.hits);
      if (strut.step > 4) out.feet.push({ x: (strut.col + 0.5) * TILE, y: strut.row * TILE, w: 26 });
    } else if (rows > PROP_RUN) {
      const spread = Math.min(3, rows * 0.1) * TILE, top = from * TILE, bottom = below.row * TILE, half = (w / 2) * TILE * 0.7;
      out.trestles.push({ x0: x - half, x1: x + half, x0b: x - half - spread, x1b: x + half + spread, top, bottom, step: rng.int(3, 4) * TILE });
      out.feet.push({ x: x - half - spread, y: bottom, w: 24 }, { x: x + half + spread, y: bottom, w: 24 });
      if (below.id >= 0) carrying.add(below.id);
    } else if (rows > 0) {
      const postW = widthOf(rows, 24);
      out.props.push({ x, top: from * TILE, bottom: below.row * TILE, w: postW });
      if (rows >= FORK_MIN_ROWS && w >= 3) {
        const reach = Math.min((w / 2) * TILE - 4, 2 * TILE), drop = Math.min(rows * TILE * 0.5, reach * 1.1);
        for (const side of [-1, 1]) out.forks.push({ x0: x, y0: from * TILE + drop, x1: x + side * reach, y1: from * TILE, w: 7 });
      }
      if (rows >= 3) out.feet.push({ x, y: below.row * TILE, w: postW + 10 });
      if (below.id >= 0) carrying.add(below.id);
      if (rows >= 5 && rng.chance(SPOT_CHANCE)) out.spots.push({ x, y: (from + rows * rng.float(0.3, 0.7)) * TILE, on: 'prop', pick: rng.next() });
    }
  }
  for (const b of [...held].reverse()) {
    standing.add(b.id);
    if (carrying.has(b.id) || !rng.chance(HANG_CHANCE)) continue;
    const col = midOf(b);
    for (let row = b.top - 1; row >= 0 && b.top - row <= HANG_RUN; row--) {
      const id = ownerAt(col, row);
      if (id < 0 || free.has(id)) continue;
      if (blobs[id].anchored || standing.has(id)) {
        const x = (col + 0.5) * TILE;
        out.hangers.push({ x: x - TILE * 0.6, top: (row + 1) * TILE, bottom: b.top * TILE }, { x: x + TILE * 0.6, top: (row + 1) * TILE, bottom: b.top * TILE });
      }
      break;
    }
  }
  for (let i = 0; i + 1 < out.masts.length; i++) {
    const a = out.masts[i], b = out.masts[i + 1];
    const top = Math.max(a.top, b.top) + TILE;
    let y = floorY - rng.int(TIE_MIN, TIE_MAX) * TILE, last = floorY;
    while (last > top) {
      const upper = Math.max(y, top);
      out.ties.push({ x0: a.x, y0: upper, x1: b.x, y1: upper });
      out.joints.push({ x: a.x, y: upper }, { x: b.x, y: upper });
      const open = rng.chance(OPEN_BAY_CHANCE);
      if (open) {
        const flip = rng.chance(0.5);
        out.crosses.push({ x0: flip ? a.x : b.x, y0: last, x1: flip ? b.x : a.x, y1: upper });
      } else out.bays.push({ x0: a.x, x1: b.x, y0: upper, y1: last, pick: rng.next() });
      if (rng.chance(SPOT_CHANCE)) out.spots.push({ x: (a.x + b.x) / 2 + rng.float(-30, 30), y: upper, on: 'tie', pick: rng.next() });
      last = upper;
      y = upper - rng.int(TIE_MIN, TIE_MAX) * TILE;
      if (upper <= top) break;
    }
  }
  for (const m of out.masts) {
    out.spots.push({ x: m.x, y: m.top, on: 'top', pick: rng.next() });
    for (let y = m.top + rng.int(5, 9) * TILE; y < m.bottom - 2 * TILE; y += rng.int(7, 12) * TILE) if (rng.chance(SPOT_CHANCE)) out.spots.push({ x: m.x, y, on: 'mast', pick: rng.next() });
  }
  for (const o of level.objects) {
    if (!MOVING_TYPES.has(o.type)) continue;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    out.rails.push({ x0: cx, y0: cy, x1: cx + o.dx, y1: cy + o.dy });
  }
  out.free = free.size;
  out.held = held.length;
  return out;
}
