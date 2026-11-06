import { TILE, COLS, SOLID, EMPTY, ONE_WAY, HOOK_REACH, SHOP_ROWS, fillTiles, addObject, tileAt, overlaps } from '../world/level.js';
import { wantsFeature, wantsMonster } from './design.js';
import { gravityFixed } from './features.js';

const SPIKE_H = 14;
const MARGIN = 2;
const LEDGE_W = 3;
const SAW_SIZE = 26;
const MINE_SIZE = 24;
const BUMPER_SIZE = 24;
const STEP_RISE = 2;
const ROCK_LID = 1;
const HOLE_W = 3;
const CLING_W = 6;
const FLUE_WALL = 2;
const FLUE_LIFT = 0.22;
const HALL_MIN = 9;
const FORK_CAP = 3;
const LADDER_W = 20;
const UPDRAFT_LIFT = 0.18;
const PERCH_W = 3;
const FLAPPER = { w: 22, h: 20 };
const sweepOf = ({ x, y, w, h, dx, dy, motion }) => (motion === 'orbit' ? { x: x - dx, y: y - dy, w: w + 2 * dx, h: h + 2 * dy } : { x, y, w: w + dx, h: h + dy });
const SKY_KILLERS = [
  { kind: 'flapper', monster: true, make: (x, y) => ({ type: 'monster', kind: 'flapper', ...FLAPPER, x, y, dx: 0, dy: 3 * TILE }) },
  { kind: 'urchin', monster: true, make: (x, y) => ({ type: 'monster', kind: 'urchin', motion: 'orbit', ...FLAPPER, x, y: y + TILE, dx: TILE, dy: TILE }) },
  { kind: 'saw', make: (x, y) => ({ type: 'saw', w: SAW_SIZE, h: SAW_SIZE, x: x - 2, y, dx: 0, dy: 3 * TILE }) },
];
const BED_W = 3;
const BED_HEADROOM = 3;

const clampCol = (col, w = 1) => Math.max(MARGIN, Math.min(COLS - MARGIN - w, col));
const cell = (col, row, w) => ({ x: col * TILE, y: row * TILE, w: w * TILE, h: TILE });
const standOn = (ctx, col, row, w) => ({ x: (col + w / 2) * TILE, y: row * TILE - ctx.size.h / 2, w: w * TILE });

function spikes(ctx, col, row, w, up) {
  if (!wantsFeature(ctx.design, 'spikeStrip')) return;
  addObject(ctx.level, { type: 'spikes', x: col * TILE + 3, y: up ? row * TILE - SPIKE_H : (row + 1) * TILE, w: w * TILE - 6, h: SPIKE_H, dir: up ? -1 : 1 });
}

function exitLedge(col, row) {
  return { col, row, w: LEDGE_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: col < COLS / 2 ? 1 : -1 };
}

function openSky(ctx, entry, roof) {
  if (ctx.cave) fillTiles(ctx.level, 0, roof - ctx.clearance, COLS, entry.row - roof + ctx.clearance, EMPTY);
}

function finished(ctx, entry, top, route, roof) {
  fillTiles(ctx.level, top.col, top.row, top.w, 1, SOLID);
  const footprint = { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - roof };
  return { top, route: [...route, standOn(ctx, top.col, top.row, top.w)], nodes: [entry, top], footprint, extent: { roof, band: entry.row } };
}

const kickable = ctx => gravityFixed(ctx) && ctx.rules.airAccel >= 0.3 && !ctx.rules.rubberWalls;

function thornSteps(ctx, entry, topRow, fierce) {
  if (!kickable(ctx)) return null;
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 17 - Math.round(6 * fierce));
  const gap = rng.int(3, 4), blockW = rng.int(1, 2), blockH = 2, pitch = 3;
  const gapCol = clampCol(entry.col + (entry.w >> 1) - (gap >> 1) - blockW, gap + blockW * 2) + blockW;
  const sideCol = side => (side < 0 ? gapCol - blockW : gapCol + gap);
  const faceX = side => (side < 0 ? gapCol * TILE : (gapCol + gap) * TILE - CLING_W);
  openSky(ctx, entry, roof);
  const route = [];
  let side = rng.chance(0.5) ? -1 : 1, row = entry.row - 2 - blockH, count = 0;
  for (; row - pitch > roof; row -= pitch, side = -side, count++) {
    fillTiles(level, sideCol(side), row, blockW, blockH, SOLID);
    spikes(ctx, sideCol(side), row, blockW, true);
    if (count > 0 && rng.chance(0.3 + 0.6 * fierce)) spikes(ctx, sideCol(side), row + blockH - 1, blockW, false);
    addObject(level, { type: 'cling', x: faceX(side), y: row * TILE, w: CLING_W, h: blockH * TILE });
    route.push({ x: faceX(side) + (side < 0 ? 1 : -1) * ctx.size.w / 2 + CLING_W / 2, y: (row + blockH / 2) * TILE, w: TILE });
  }
  if (count < 4) return null;
  const top = exitLedge(side < 0 ? gapCol - LEDGE_W : gapCol + gap, row + 1);
  return finished(ctx, entry, top, route, top.row);
}

function hangingPools(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 13 - Math.round(4 * fierce));
  const poolW = rng.int(2, 3), poolH = rng.int(1, 2), rimW = 2, drift = rng.int(0, 1);
  const centre = clampCol(entry.col + (entry.w >> 1) - (poolW >> 1), poolW + rimW * 2), route = [];
  openSky(ctx, entry, roof);
  let side = centre < COLS / 2 ? 1 : -1, floor = entry.row, col = centre, count = 0;
  for (;;) {
    const surface = floor - STEP_RISE - poolH;
    if (surface - poolH - STEP_RISE < roof) break;
    addObject(level, { type: 'water', x: col * TILE, y: surface * TILE, w: poolW * TILE, h: poolH * TILE });
    const rim = side > 0 ? col + poolW : col - rimW;
    fillTiles(level, rim, surface, rimW, 1, SOLID);
    const shielded = side > 0 ? col : col + poolW - 1;
    if (poolW > 2 && rng.chance(0.4 + 0.5 * fierce)) {
      fillTiles(level, shielded, surface + poolH, 1, 1, SOLID);
      spikes(ctx, shielded, surface + poolH, 1, false);
    }
    route.push(standOn(ctx, rim, surface, rimW));
    floor = surface;
    col = clampCol(rim + (side > 0 ? rimW - poolW + drift : -drift), poolW + rimW * 2);
    side = -side;
    count++;
  }
  if (count < 2) return null;
  const top = exitLedge(clampCol(col, LEDGE_W), floor - STEP_RISE - 1);
  return finished(ctx, entry, top, route, top.row);
}

function stepsUp(ctx, shaft, floor, rise, inward) {
  const route = [];
  let side = inward < 0 ? shaft + HOLE_W - 1 : shaft, row = floor - STEP_RISE;
  for (; floor - row < rise; row -= STEP_RISE, side = side === shaft ? shaft + HOLE_W - 1 : shaft) {
    fillTiles(ctx.level, side, row, 1, 1, SOLID);
    route.push(standOn(ctx, side, row, 1));
  }
  return route;
}

function serpentine(ctx, entry, topRow, climbUp, dress) {
  const { rng, level } = ctx, height = rng.int(3, 4), rise = height + ROCK_LID;
  const band = entry.row - Math.max(4, ctx.clearance) - ctx.rng.int(0, 1);
  const count = Math.min(rng.int(2, 4), Math.floor((band - topRow - 1) / rise));
  if (count < 2) return null;
  const roof = band - 1 - count * rise + ROCK_LID - 1;
  fillTiles(level, 0, roof, COLS, band - roof + 1, SOLID);
  const left = rng.int(MARGIN, 4), right = COLS - rng.int(MARGIN, 4);
  let dir = entry.col + (entry.w >> 1) < COLS / 2 ? 1 : -1, shaft = clampCol(entry.col + (entry.w >> 1) - (HOLE_W >> 1), HOLE_W);
  fillTiles(level, shaft, band - ROCK_LID - height, HOLE_W, height + ROCK_LID + 2, EMPTY);
  const route = stepsUp(ctx, shaft, entry.row, entry.row - band + ROCK_LID, dir);
  let floor = band - ROCK_LID;
  for (let k = 0; k < count; k++, floor -= rise, dir = -dir) {
    const far = dir > 0 ? right - HOLE_W : left;
    const from = Math.min(shaft, far), to = Math.max(shaft, far) + HOLE_W;
    fillTiles(level, from, floor - height, to - from, height, EMPTY);
    dress({ from: from + HOLE_W, to: to - HOLE_W, floor, height, dir });
    fillTiles(level, far, floor - rise, HOLE_W, ROCK_LID, EMPTY);
    route.push(standOn(ctx, far + 1, floor, 1), ...climbUp(far, floor, rise, -dir));
    shaft = far;
  }
  if (ctx.cave) fillTiles(level, 0, roof - ctx.clearance, COLS, ctx.clearance, EMPTY);
  const lastDir = -dir, top = exitLedge(lastDir > 0 ? shaft - LEDGE_W : shaft + HOLE_W, floor + ROCK_LID - 1);
  return { top, route: [...route, standOn(ctx, top.col, top.row, top.w)], nodes: [entry, top], footprint: { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - top.row }, extent: { roof: top.row, band } };
}

function theWinding(ctx, entry, topRow, fierce) {
  const { rng } = ctx;
  return serpentine(ctx, entry, topRow, (shaft, floor, rise, inward) => stepsUp(ctx, shaft, floor, rise, inward), ({ from, to, floor, height }) => {
    for (let col = from + rng.int(1, 3); col < to - 2; col += rng.int(4, 7)) {
      const w = height > 3 && rng.chance(fierce) ? 2 : 1;
      if (rng.chance(0.75)) spikes(ctx, col, floor, w, true);
      else if (height > 3 && rng.chance(fierce)) spikes(ctx, col, floor - height - 1, w, false);
    }
  });
}

function springUp(ctx, shaft, floor, rise) {
  const vel = Math.sqrt(2 * ctx.rules.gravity * ((rise + 1.5) * TILE));
  addObject(ctx.level, { type: 'spring', x: (shaft + 1) * TILE + 4, y: floor * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
  return [];
}

function pinballAlley(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx;
  return serpentine(ctx, entry, topRow, (shaft, floor, rise) => springUp(ctx, shaft, floor, rise), ({ from, to, floor, height, dir }) => {
    const spacing = rng.int(4, 6), ceiling = (floor - height) * TILE;
    for (let col = from + 1; col < to - 1; col += spacing) {
      addObject(level, { type: 'bumper', x: col * TILE + 3, y: floor * TILE - BUMPER_SIZE, w: BUMPER_SIZE, h: BUMPER_SIZE, dir });
      if (!wantsFeature(ctx.design, 'saw') || !rng.chance(0.35 + 0.5 * fierce)) continue;
      const at = col + (spacing >> 1);
      if (rng.chance(0.5)) addObject(level, { type: 'saw', kind: 'mine', x: at * TILE + 3, y: ceiling + 1, w: MINE_SIZE, h: MINE_SIZE, dx: 0, dy: 0, period: 240, phase: 0 });
      else addObject(level, { type: 'saw', x: at * TILE + 2, y: ceiling + 1, w: SAW_SIZE, h: SAW_SIZE, dx: 0, dy: (height - 1) * TILE - SAW_SIZE, period: 240, phase: rng.int(0, 7) * 30 });
    }
  });
}

function theFlue(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx, roof = Math.max(topRow + 1, entry.row - 16), wide = rng.int(6, 7), base = entry.row - 3;
  const left = clampCol(entry.col + (entry.w >> 1) - (wide >> 1), wide);
  openSky(ctx, entry, roof);
  fillTiles(level, left - FLUE_WALL, roof + 1, wide + FLUE_WALL * 2, base - roof - 1, SOLID);
  fillTiles(level, left, roof + 1, wide, base - roof - 1, EMPTY);
  addObject(level, { type: 'wind', x: left * TILE, y: (roof + 1) * TILE, w: wide * TILE, h: (entry.row - roof - 1) * TILE, ax: 0, ay: -(ctx.rules.gravity + FLUE_LIFT) });
  const route = [];
  let side = rng.chance(0.5) ? 0 : 1;
  for (let row = base - 3; row > roof + 2; row -= rng.int(3, 4), side = 1 - side) {
    const stub = wide - 4, col = side ? left + wide - stub : left;
    fillTiles(level, col, row, stub, 1, SOLID);
    spikes(ctx, col, row, stub, true);
    spikes(ctx, col, row, stub, false);
    const gapCol = side ? left : left + stub;
    route.push({ x: (gapCol + 2) * TILE, y: row * TILE, w: 4 * TILE });
  }
  if (route.length < 2) return null;
  const top = exitLedge(left > COLS / 2 ? left - LEDGE_W : left + wide, roof);
  route.push({ x: (left + wide / 2) * TILE, y: roof * TILE, w: wide * TILE, coarse: true });
  if (ctx.cave) fillTiles(level, 0, roof - ctx.clearance, COLS, ctx.clearance, EMPTY);
  return { top, route: [...route, standOn(ctx, top.col, top.row, top.w)], nodes: [entry, top], footprint: { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - roof }, extent: { roof, band: base } };
}

function upsideDownHall(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx, drop = rng.int(6, 7), lid = entry.row - drop - 1;
  if (lid - 2 < topRow) return null;
  const toRight = entry.col + entry.w / 2 < COLS / 2, near = toRight ? entry.col + entry.w : entry.col - 1;
  const hole = toRight ? rng.int(COLS - 7, COLS - 5) : rng.int(2, 4);
  if (Math.abs(hole - near) < HALL_MIN) return null;
  const low = Math.min(near, hole), high = Math.max(near, hole) + 3;
  fillTiles(level, 0, lid - 1, COLS, 2, SOLID);
  if (ctx.cave) fillTiles(level, 0, lid - 1 - ctx.clearance, COLS, ctx.clearance, EMPTY);
  if (ctx.cave) fillTiles(level, Math.max(0, low - 3), lid + 1, high - low + 6, entry.row - lid - 1, EMPTY);
  fillTiles(level, hole, lid - 1, 3, 2, EMPTY);
  const pad = toRight ? entry.col + entry.w - 1 : entry.col;
  addObject(level, { type: 'gravpad', x: pad * TILE + 3, y: entry.row * TILE - 8, w: TILE - 6, h: 8, dir: -1 });
  const from = toRight ? near + 1 : hole + 3, to = toRight ? hole - 1 : near;
  fillTiles(level, from, entry.row, to - from, 1, SOLID);
  spikes(ctx, from, entry.row, to - from, true);
  const route = [{ x: (pad + 0.5) * TILE, y: (lid + 1) * TILE + ctx.size.h / 2, w: 3 * TILE, coarse: true }];
  for (let col = from + rng.int(3, 4); col < to - 3; col += rng.int(4, 6)) spikes(ctx, col, lid, rng.chance(fierce) ? 2 : 1, false);
  const exitPad = toRight ? hole - 1 : hole + 3;
  addObject(level, { type: 'gravpad', x: exitPad * TILE + 3, y: (lid + 1) * TILE, w: TILE - 6, h: 8, dir: 1 });
  route.push({ x: (exitPad + 0.5) * TILE, y: (lid + 1) * TILE + ctx.size.h / 2, w: 2 * TILE, coarse: true });
  const ledgeRow = lid + 2;
  fillTiles(level, hole, ledgeRow, 3, 1, SOLID);
  route.push(standOn(ctx, hole, ledgeRow, 3));
  const top = exitLedge(toRight ? hole - LEDGE_W : hole + 3, lid - 1);
  return { top, route: [...route, standOn(ctx, top.col, top.row, top.w)], nodes: [entry, top], footprint: { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - top.row }, extent: { roof: top.row, band: entry.row } };
}

function metronome(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 16), period = 240, beat = rng.int(30, 42), lit = Math.round(period * (0.7 - 0.15 * fierce));
  const w = rng.int(2, 3), gap = rng.int(1, 2), restEvery = rng.int(4, 5);
  const left = clampCol(entry.col + (entry.w >> 1) - w - (gap >> 1), w * 2 + gap);
  openSky(ctx, entry, roof);
  const route = [];
  let step = 0, wave = 0, row = entry.row - 2;
  for (; row > roof + 2; row -= 2, step++) {
    const col = step % 2 ? left + w + gap : left;
    if (step % restEvery === restEvery - 1) {
      fillTiles(level, col, row, w, 1, SOLID);
      wave = 0;
    } else addObject(level, { type: 'phase', ...cell(col, row, w), period, on: lit, phase: (period - (wave++ * beat) % period) % period });
    route.push(standOn(ctx, col, row, w));
  }
  if (step < 5) return null;
  const top = exitLedge(clampCol(step % 2 ? left + w + gap : left + w - LEDGE_W, LEDGE_W), row);
  return finished(ctx, entry, top, route, row);
}

function forkTunnel(ctx, mirror, c, j, floor, easy) {
  const { level } = ctx, w = easy ? 3 : 1, roof = j - 3;
  const route = [...[floor - 1, (floor + j) >> 1].map(row => ({ x: c * TILE, y: row * TILE, w: TILE })), { ...standOn(ctx, c - 1, j, 2), firm: true }];
  const at = (x, wide) => (mirror ? 2 * c - x - wide : x);
  const ledge = (col, row, wide) => {
    fillTiles(level, col, row, wide, 1, SOLID);
    route.push(standOn(ctx, col, row, wide));
  };
  ledge(mirror ? c + 2 : 0, j + 2, mirror ? COLS - c - 2 : c - 2);
  const low = at(c - 9 - w, w), high = at(c - 5 - w, w);
  ledge(low, j, w);
  ledge(high, j - 1, w);
  fillTiles(level, high, roof, w, 1, ONE_WAY);
  if (easy) return route;
  spikes(ctx, at(c - 8 - w, 3), j + 2, 3, true);
  for (let k = 0; k < 4; k++) addObject(level, { type: 'coin', x: (at(c - 12 + k, 1) + 0.5) * TILE - 7, y: (j + 0.4) * TILE, w: 14, h: 14 });
  return route;
}

function fork(ctx, entry, topRow) {
  const { rng, level } = ctx, c = rng.int(14, 16), j = entry.row - rng.int(6, 7), roof = j - 3;
  if (roof - 2 < topRow) return null;
  openSky(ctx, entry, roof - 1);
  for (let col = Math.min(entry.col, c - 1); col < Math.max(entry.col + entry.w, c + 1); col++) if (tileAt(level, col, entry.row) !== SOLID) fillTiles(level, col, entry.row, 1, 1, ONE_WAY);
  fillTiles(level, 0, roof, COLS, 1, SOLID);
  for (const [stem, cap] of [[c - 2, c - 1 - FORK_CAP], [c + 1, c + 1]]) {
    fillTiles(level, cap, j, FORK_CAP, 1, SOLID);
    fillTiles(level, stem, j + 1, 1, entry.row - 3 - j, SOLID);
    fillTiles(level, stem, roof + 1, 1, 1, SOLID);
  }
  for (const [col, dir] of [[c - 2, -1], [c + 1, 1]]) addObject(level, { type: 'bumper', x: col * TILE + 3, y: j * TILE - BUMPER_SIZE, w: BUMPER_SIZE, h: BUMPER_SIZE, dir });
  fillTiles(level, c - 1, j, 2, 1, ONE_WAY);
  addObject(level, { type: 'climb', x: c * TILE - LADDER_W / 2, y: (j - 1) * TILE, w: LADDER_W, h: (entry.row - j + 1) * TILE });
  const greedRight = rng.chance(0.5);
  const top = { col: c - FORK_CAP - 2, row: roof, w: 2 * FORK_CAP + 4, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: 1 };
  const finish = standOn(ctx, c - 1, roof, 2);
  const footprint = { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - roof };
  return { top, route: [...forkTunnel(ctx, !greedRight, c, j, entry.row, true), finish], alternates: [[...forkTunnel(ctx, greedRight, c, j, entry.row, false), finish]], nodes: [entry, top], footprint, extent: { roof, band: entry.row } };
}

function spikedBlock(ctx, col, row, w, h = 1) {
  fillTiles(ctx.level, col, row, w, h, SOLID);
  spikes(ctx, col, row, w, true);
  spikes(ctx, col, row + h - 1, w, false);
  if (!wantsFeature(ctx.design, 'spikeStrip')) return;
  addObject(ctx.level, { type: 'spikes', x: col * TILE - SPIKE_H, y: row * TILE + 3, w: SPIKE_H, h: h * TILE - 6, side: -1 });
  addObject(ctx.level, { type: 'spikes', x: (col + w) * TILE, y: row * TILE + 3, w: SPIKE_H, h: h * TILE - 6, side: 1 });
}

const SKY_MOVES = {
  updraft(ctx, cur, dir) {
    const { rng } = ctx, rise = rng.int(5, 6), lane = 2;
    const col0 = dir > 0 ? cur.col + cur.w : cur.col - lane;
    const col = dir > 0 ? col0 + lane : col0 - PERCH_W, row = cur.row - rise;
    const wind = { type: 'wind', x: col0 * TILE, y: (row - 2) * TILE, w: lane * TILE, h: (cur.row - row + 3) * TILE, ax: 0, ay: -(ctx.rules.gravity + UPDRAFT_LIFT) };
    return { next: { col, row, w: PERCH_W }, parts: [wind], via: [], hazards: [[dir > 0 ? col + 1 : col + PERCH_W - 2, (cur.row + row) >> 1, 1]] };
  },
  spring(ctx, cur, dir) {
    const { rng } = ctx, rise = rng.int(5, 6);
    const pad = dir > 0 ? cur.col + cur.w - 1 : cur.col;
    const col = dir > 0 ? pad + rng.int(0, 1) : pad - rng.int(0, 1) - PERCH_W + 1;
    const vel = Math.sqrt(2 * ctx.rules.gravity * (rise * TILE + ctx.size.h + 24));
    const spring = { type: 'spring', x: pad * TILE + 4, y: cur.row * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel };
    return { next: { col, row: cur.row - rise, w: PERCH_W }, parts: [spring], via: [], hazards: [[pad - dir * 3, cur.row - 3, 1]] };
  },
  hook(ctx, cur, dir) {
    const { rng } = ctx, length = rng.int(3, 4);
    const edge = dir > 0 ? cur.col + cur.w : cur.col - 1;
    const hookCol = edge + dir * 2, x = (hookCol + 0.5) * TILE, y = (cur.row - 1 - length) * TILE;
    const col = dir > 0 ? edge + rng.int(4, 5) : edge - rng.int(4, 5) - PERCH_W + 1;
    const hook = { type: 'hook', x: x - 6, y: y - 6, w: 12, h: 12, reach: HOOK_REACH };
    return { next: { col, row: cur.row - 1, w: PERCH_W }, parts: [hook], via: [{ x, y: y + length * TILE, rope: true }], hazards: [[hookCol - 1, cur.row + 3, 3]] };
  },
};

function skyRun(ctx, entry, topRow, fierce) {
  if (!kickable(ctx) || ctx.rules.flood) return null;
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 20 - Math.round(6 * fierce));
  openSky(ctx, entry, roof);
  const fits = move => move.next.row > roof + 1 && move.next.col >= MARGIN && move.next.col + PERCH_W <= COLS - MARGIN && move.parts.every(o => o.y > (roof - 1) * TILE);
  const route = [];
  let cur = entry, last = null, count = 0;
  for (;;) {
    const toward = cur.col + cur.w / 2 < COLS / 2 ? 1 : -1, dir = rng.chance(0.75) ? toward : -toward;
    const candidates = rng.shuffle(Object.keys(SKY_MOVES).filter(kind => kind !== last)).flatMap(kind => [dir, -dir].map(side => ({ kind, ...SKY_MOVES[kind](ctx, cur, side) })));
    const move = candidates.find(fits);
    if (!move) break;
    last = move.kind;
    const { next, parts, via, hazards } = move;
    for (const part of parts) addObject(level, part);
    fillTiles(level, next.col, next.row, next.w, 1, ONE_WAY);
    for (const [col, row, w] of hazards) if (rng.chance(0.4 + 0.5 * fierce) && col >= 1 && col + w < COLS - 1) spikedBlock(ctx, col, row, w);
    if (wantsMonster(ctx.design, 'flapper') && rng.chance(0.3 * fierce)) {
      const col = next.col < COLS / 2 ? next.col + PERCH_W + 2 : next.col - 3;
      addObject(level, { type: 'monster', kind: 'flapper', ...FLAPPER, x: col * TILE + 4, y: (next.row - 2) * TILE, dx: 0, dy: 3 * TILE, period: rng.pick([180, 240]), phase: rng.int(0, 7) * 30 });
    }
    route.push(...via, standOn(ctx, next.col, next.row, next.w));
    cur = next;
    count++;
  }
  if (count < 3) return null;
  route.pop();
  return finished(ctx, entry, exitLedge(cur.col, cur.row), route, cur.row);
}

const bedClear = (level, col, row) => !level.objects.some(o => overlaps(o.x, o.y, o.w, o.h, { x: col * TILE, y: (row - BED_HEADROOM) * TILE, w: BED_W * TILE, h: (BED_HEADROOM + 1) * TILE }));

function springBed(ctx, entry, dir, rise) {
  const row = entry.row;
  const col = [0, 1, 2].map(gap => (dir > 0 ? entry.col + entry.w + gap : entry.col - BED_W - gap)).find(at => at >= MARGIN && at + BED_W <= COLS - MARGIN && bedClear(ctx.level, at, row));
  if (col === undefined) return null;
  fillTiles(ctx.level, col, row, BED_W, 1, SOLID);
  const vel = Math.sqrt(2 * ctx.rules.gravity * (rise * TILE + ctx.size.h));
  for (let k = 0; k < BED_W; k++) addObject(ctx.level, { type: 'spring', x: (col + k) * TILE + 4, y: row * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
  return { x: (col + BED_W / 2) * TILE, y: (row - rise) * TILE, col };
}

function freeFlight(ctx, entry, topRow, fierce) {
  if (!kickable(ctx) || ctx.rules.flood) return null;
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 24 - Math.round(4 * fierce));
  openSky(ctx, entry, roof);
  const toward = entry.col + entry.w / 2 < COLS / 2 ? 1 : -1;
  const launch = springBed(ctx, entry, toward, rng.int(5, 6)) ?? springBed(ctx, entry, -toward, rng.int(5, 6));
  if (!launch) return null;
  const route = [{ x: launch.x, y: launch.y + 2 * TILE, w: BED_W * TILE }];
  let pivot = { x: launch.x + toward * rng.int(2, 3) * TILE, y: launch.y - TILE }, count = 0;
  const flyers = rng.shuffle(SKY_KILLERS.filter(({ kind, monster }) => (monster ? wantsMonster(ctx.design, kind) : wantsFeature(ctx.design, 'saw'))));
  const dangers = [], danger = (o, rank) => dangers.push({ rank, box: sweepOf(o), place: () => addObject(level, o) });
  const fits = at => at.x >= 3 * TILE && at.x <= (COLS - 3) * TILE && at.y >= (roof + 2) * TILE;
  while (fits(pivot)) {
    const hook = addObject(level, { type: 'hook', x: pivot.x - 6, y: pivot.y - 6, w: 12, h: 12, reach: HOOK_REACH });
    route.push({ x: pivot.x, y: pivot.y + 3 * TILE, w: 6 * TILE, coarse: true, rope: true, hook: hook.id });
    count++;
    const dir = pivot.x < (COLS / 2) * TILE ? 1 : -1, span = (5 + rng.int(0, 1) + Math.round(fierce)) * TILE, rise = 3 * TILE;
    const next = { x: pivot.x + dir * span, y: pivot.y - rise };
    if (!fits(next)) break;
    const midCol = Math.round((pivot.x + next.x) / 2 / TILE), pivotRow = Math.round(pivot.y / TILE), nextCol = Math.round(next.x / TILE), nextRow = pivotRow - 3;
    const aside = [nextCol + dir * rng.int(3, 4), nextRow + rng.int(-1, 1)];
    for (const [mid, row] of [[midCol + rng.int(-2, 2), pivotRow + rng.int(4, 6)], [midCol + rng.int(-1, 1), nextRow - rng.int(2, 3)]]) {
      if (!rng.chance(0.25 + 0.65 * fierce)) continue;
      const w = rng.int(2, 3), h = rng.int(1, 2), col = mid - (w >> 1);
      if (col > 1 && col + w < COLS - 1) dangers.push({ rank: 2, box: { x: col * TILE - SPIKE_H, y: row * TILE - SPIKE_H, w: w * TILE + 2 * SPIKE_H, h: h * TILE + 2 * SPIKE_H }, place: () => spikedBlock(ctx, col, row, w, h) });
    }
    if (flyers.length && rng.chance(0.6 * fierce)) {
      const [col, row] = aside;
      danger({ ...flyers[count % flyers.length].make(col * TILE + 4, (row - 1) * TILE), period: rng.pick([180, 240]), phase: rng.int(0, 7) * 30 }, 0);
    }
    if (wantsFeature(ctx.design, 'saw') && rng.chance(fierce)) {
      const x = pivot.x - dir * rng.int(3, 4) * TILE, y = pivot.y + rng.int(0, 2) * TILE;
      if (x > TILE && x < (COLS - 1) * TILE) danger({ type: 'saw', kind: 'mine', x: x - MINE_SIZE / 2, y: y - MINE_SIZE / 2, w: MINE_SIZE, h: MINE_SIZE, dx: 0, dy: 0, period: 240, phase: 0 }, 1);
    }
    pivot = next;
  }
  if (count < 3) return null;
  const last = route.at(-1), dir = last.x < (COLS / 2) * TILE ? 1 : -1;
  const col = Math.max(MARGIN, Math.min(COLS - MARGIN - LEDGE_W, Math.round(last.x / TILE) + (dir > 0 ? 2 : -2 - LEDGE_W))), row = Math.round((last.y - 3 * TILE) / TILE) + 1;
  const landing = { x: (col - BED_W - 1) * TILE, y: (row - 3) * TILE, w: (LEDGE_W + 2 * BED_W + 2) * TILE, h: 3 * TILE };
  const takeoff = { x: (launch.col - 1) * TILE, y: launch.y - 3 * TILE, w: (BED_W + 2) * TILE, h: entry.row * TILE - launch.y + 3 * TILE };
  const footing = { x: (entry.col - 1) * TILE, y: (entry.row - 2) * TILE, w: (entry.w + 2) * TILE, h: 2 * TILE };
  const shop = { x: 0, y: (level.rows - SHOP_ROWS) * TILE, w: COLS * TILE, h: SHOP_ROWS * TILE };
  return { ...finished(ctx, entry, exitLedge(col, row), route, row), dangers: dangers.sort((a, b) => a.rank - b.rank), clear: [landing, takeoff, footing, shop] };
}

export const IDEAS = [
  { id: 'thorns', title: 'Thorn Steps', raise: thornSteps },
  { id: 'pools', title: 'Hanging Pools', raise: hangingPools },
  { id: 'winding', title: 'The Winding', raise: theWinding },
  { id: 'pinball', title: 'Pinball Alley', raise: pinballAlley },
  { id: 'flue', title: 'The Flue', raise: theFlue },
  { id: 'hall', title: 'Upside-Down Hall', raise: upsideDownHall },
  { id: 'metronome', title: 'Metronome', raise: metronome },
  { id: 'fork', title: 'Fork', raise: fork },
  { id: 'sky', title: 'Sky Run', raise: skyRun },
  { id: 'flight', title: 'Free Flight', raise: freeFlight, whole: true },
];
