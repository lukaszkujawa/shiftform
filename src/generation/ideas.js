import { TILE, COLS, SOLID, EMPTY, ONE_WAY, fillTiles, addObject, tileAt } from '../world/level.js';
import { wantsFeature } from './design.js';
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
      const w = rng.int(1, 2);
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
  const { rng, level } = ctx, drop = rng.int(5, 7), lid = entry.row - drop - 1;
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
  for (let col = from + rng.int(3, 4); col < to - 3; col += rng.int(4, 6)) spikes(ctx, col, lid, rng.int(1, 2), false);
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

export const IDEAS = [
  { id: 'thorns', title: 'Thorn Steps', raise: thornSteps },
  { id: 'pools', title: 'Hanging Pools', raise: hangingPools },
  { id: 'winding', title: 'The Winding', raise: theWinding },
  { id: 'pinball', title: 'Pinball Alley', raise: pinballAlley },
  { id: 'flue', title: 'The Flue', raise: theFlue },
  { id: 'hall', title: 'Upside-Down Hall', raise: upsideDownHall },
  { id: 'metronome', title: 'Metronome', raise: metronome },
  { id: 'fork', title: 'Fork', raise: fork },
];
