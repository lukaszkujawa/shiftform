import { TILE, EMPTY, START_POSITIONS, fillTiles, addObject, startPhase } from '../world/level.js?v=ececfed';

const HANDLE = 12;
const CANNON_SIZE = 34;
const FAST = 120;
const HANDLE_ABOVE_FEET = 46;
const CANNON_ABOVE_FEET = 62;
const WHEEL_HANDLES = 2;
const SWING_ARC = 0.9;
const SWING_ABOVE_FEET = 72;
const AIM_SWEEP = 0.14;
const APEX_CLEARANCE = 36;
const MAX_LAUNCH = 24;
const CHAIN_FROM = 0.3;
const CHAIN_RISE = 4;

const clearGap = ctx => Math.ceil(ctx.profile.reach / TILE) + 1;
const feetOf = node => node.row * TILE;
const edgeOf = node => (node.dir > 0 ? node.col + node.w : node.col) * TILE;
const centerOf = node => (node.col + node.w / 2) * TILE;

const randomStart = (ctx, period) => (ctx.design?.devices === 'synced' ? 0 : startPhase(ctx.rng.int(0, START_POSITIONS - 1), period));
const handle = (x, y, extra) => ({ type: 'hook', grip: true, x: x - HANDLE / 2, y: y - HANDLE / 2, w: HANDLE, h: HANDLE, reach: 0, ...extra });

export function launchTo(rules, from, to) {
  const rise = Math.max(0, from.y - to.y) + APEX_CLEARANCE;
  const vy = Math.sqrt(2 * rules.gravity * rise);
  const air = vy / rules.gravity + Math.sqrt((2 * (rise - (from.y - to.y))) / rules.gravity);
  const vx = (to.x - from.x) / air;
  return { vel: Math.min(MAX_LAUNCH, Math.hypot(vx, vy)), angle: Math.atan2(-vy, vx) };
}

function grabPoint(ctx, node, i, x, y) {
  ctx.waypoints.push({ after: i - 1, x, y, rope: true, coarse: true });
}

function carveAround(ctx, prev, node, top) {
  if (!ctx.cave) return;
  const col0 = Math.min(prev.col, node.col), col1 = Math.max(prev.col + prev.w, node.col + node.w);
  fillTiles(ctx.level, col0, top, col1 - col0, Math.max(prev.row, node.row) - top + 1, EMPTY);
}

export const RIGS = {
  wheel: {
    plan: ctx => {
      const gap = clearGap(ctx);
      const radius = (gap * TILE - TILE) / 2;
      return { gap, up: ctx.rng.int(1, 3), above: Math.ceil((radius * 2 + HANDLE_ABOVE_FEET) / TILE) + 1, radius };
    },
    build(ctx, prev, node, i) {
      const { radius } = node.rig;
      const x = edgeOf(prev) + node.dir * (node.gap * TILE) / 2, y = feetOf(prev) - HANDLE_ABOVE_FEET - radius;
      carveAround(ctx, prev, node, Math.floor((y - radius) / TILE) - 1);
      const start = randomStart(ctx, FAST);
      for (let k = 0; k < WHEEL_HANDLES; k++) addObject(ctx.level, handle(x, y, { motion: 'orbit', dx: radius, dy: node.dir * radius, period: FAST, phase: (start + (k * FAST) / WHEEL_HANDLES) % FAST }));
      grabPoint(ctx, node, i, x, y + radius);
    },
  },
  pendulum: {
    plan: ctx => {
      const gap = clearGap(ctx);
      const length = Math.ceil((gap * TILE + TILE) / (2 * Math.sin(SWING_ARC)));
      return { gap, up: ctx.rng.int(0, 1), above: Math.ceil((length * Math.cos(SWING_ARC) + SWING_ABOVE_FEET) / TILE) + 1, length };
    },
    build(ctx, prev, node, i) {
      const { length } = node.rig;
      const gap = (node.gap * TILE) / 2;
      const x = edgeOf(prev) + node.dir * gap, y = feetOf(prev) - SWING_ABOVE_FEET - length * Math.cos(SWING_ARC);
      carveAround(ctx, prev, node, Math.floor(y / TILE) - 1);
      addObject(ctx.level, handle(x, y, { motion: 'swing', dx: length, dy: length, arc: SWING_ARC, period: FAST, phase: randomStart(ctx, FAST) }));
      grabPoint(ctx, node, i, x - node.dir * gap * 0.8, feetOf(prev) - SWING_ABOVE_FEET);
    },
  },
  rail: {
    plan: ctx => ({ gap: clearGap(ctx) + ctx.rng.int(0, 3), up: ctx.rng.int(1, 4), above: 3 }),
    build(ctx, prev, node, i) {
      const x = edgeOf(prev) - node.dir * TILE / 2, y = feetOf(prev) - HANDLE_ABOVE_FEET;
      const toX = (node.dir > 0 ? node.col + 0.5 : node.col + node.w - 0.5) * TILE, toY = feetOf(node) - HANDLE_ABOVE_FEET;
      carveAround(ctx, prev, node, Math.floor(Math.min(y, toY) / TILE) - 2);
      const period = ctx.tempo ?? 240;
      addObject(ctx.level, handle(x, y, { dx: toX - x, dy: toY - y, period, phase: randomStart(ctx, period) }));
      grabPoint(ctx, node, i, x, y);
    },
  },
  cannon: {
    plan: ctx => {
      const chained = ctx.difficulty >= CHAIN_FROM && ctx.rng.chance(0.5);
      const gap = clearGap(ctx) + ctx.rng.int(0, 2);
      return chained ? { gap, up: ctx.rng.int(5, 7), above: 9, chained } : { gap, up: ctx.rng.int(1, 3), above: 5, chained };
    },
    build(ctx, prev, node, i) {
      const { rules, level } = ctx;
      const first = { x: edgeOf(prev) + node.dir * 2.5 * TILE, y: feetOf(prev) - CANNON_ABOVE_FEET };
      const target = { x: centerOf(node), y: feetOf(node) - ctx.size.h / 2 };
      carveAround(ctx, prev, node, node.row - node.rig.above);
      const place = (at, aimed, arc, auto) => addObject(level, { type: 'cannon', x: at.x - CANNON_SIZE / 2, y: at.y - CANNON_SIZE / 2, w: CANNON_SIZE, h: CANNON_SIZE, ...launchTo(rules, at, aimed), arc, auto });
      const sweep = rules.airAccel > 0 ? AIM_SWEEP : 0;
      const stops = [];
      if (node.rig.chained) {
        const second = { x: (first.x + target.x) / 2, y: first.y - CHAIN_RISE * TILE };
        stops.push(place(first, second, 0, true), place(second, target, sweep, false));
      } else stops.push(place(first, target, sweep, false));
      for (const stop of stops) ctx.waypoints.push({ after: i - 1, x: stop.x + stop.w / 2, y: stop.y + stop.h / 2, barrel: stop.id, coarse: true });
    },
  },
};

export const buildRig = (ctx, node, i) => {
  ctx.nodes[i - 1].reserved = true;
  node.reserved = true;
  RIGS[node.rig.kind].build(ctx, ctx.nodes[i - 1], node, i);
};
