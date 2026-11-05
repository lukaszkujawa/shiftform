import { TILE, COLS, SOLID, EMPTY, fillTiles, addObject } from '../world/level.js';
import { wantsFeature } from './design.js';

const SPIKE_H = 14;
const MARGIN = 2;
const LEDGE_W = 3;
const SAW_SIZE = 26;
const MINE_SIZE = 24;
const BUMPER_SIZE = 24;
const STEP_RISE = 2;
const ROCK_LID = 1;
const HOLE_W = 3;

const clampCol = (col, w = 1) => Math.max(MARGIN, Math.min(COLS - MARGIN - w, col));
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

function thornSteps(ctx, entry, topRow, fierce) {
  const { rng, level } = ctx, roof = Math.max(topRow, entry.row - 12 - Math.round(5 * fierce));
  const lanes = rng.int(2, 3), gap = rng.int(2, 3), blockW = 2, pitch = rng.int(2, 3);
  const span = lanes * blockW + (lanes - 1) * gap;
  const left = clampCol(entry.col + entry.w + 1 > COLS - span - MARGIN ? entry.col - span - 1 : entry.col + entry.w + 1, span);
  const laneOf = step => { const bounce = step % (2 * lanes - 2); return bounce < lanes ? bounce : 2 * lanes - 2 - bounce; };
  openSky(ctx, entry, roof);
  const route = [];
  let step = 0, row = entry.row - pitch;
  for (; row > roof + pitch; row -= pitch, step++) {
    const col = left + laneOf(step) * (blockW + gap), safe = rng.chance(0.5) ? 0 : 1;
    fillTiles(level, col, row, blockW, 1, SOLID);
    spikes(ctx, col + 1 - safe, row, 1, true);
    spikes(ctx, col, row, blockW, false);
    route.push(standOn(ctx, col + safe, row, 1));
  }
  if (step < 3) return null;
  const top = exitLedge(clampCol(left + laneOf(step) * (blockW + gap), LEDGE_W), row);
  return finished(ctx, entry, top, route, row);
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

export const IDEAS = [
  { id: 'thorns', title: 'Thorn Steps', raise: thornSteps },
  { id: 'pools', title: 'Hanging Pools', raise: hangingPools },
  { id: 'winding', title: 'The Winding', raise: theWinding },
  { id: 'pinball', title: 'Pinball Alley', raise: pinballAlley },
];
