import { COLS } from './level.js';
import { crowded, layConnector } from './features.js';

export const FLOOR_LIFTS = ['climb', 'bounce'];
export const MOVE_IDS = ['hop', 'stair', 'leap', 'run', 'shaft', 'drop', 'zig'];
const FLIP_CHANCE = 0.15;
const DEFAULT_MOVES = { hop: 4, stair: 2, leap: 1, run: 1, shaft: 2, drop: 1, zig: 1 };

const fits = (col, w) => col >= 0 && col + w <= COLS;

function ledge(from, dir, gap, w, up, extra = {}) {
  const col = dir > 0 ? from.col + from.w + gap : from.col - gap - w;
  return { col, row: from.row - up, w, kind: 'tiles', gap, dir, thick: 1, ...extra };
}

function place(from, blocked, gap, w, up, extra) {
  for (const dir of [from.dir, -from.dir]) {
    const node = ledge(from, dir, gap, w, up, extra);
    if (fits(node.col, w) && !blocked(node.col, node.row, w)) return node;
  }
  return null;
}

const ledgeWidth = ctx => (ctx.slippery ? ctx.rng.int(3, 5) : ctx.rng.int(2, 4));
const steerable = ctx => !ctx.slippery && ctx.rules.airAccel > 0;
const gravityFixed = ctx => !ctx.needsCeiling && ctx.rules.baseGravDir > 0 && !ctx.rules.wrapY;
const single = node => node && [node];

export const MOVES = {
  hop: {
    cost: 1, rows: 1.5,
    lay(ctx, from, remaining, blocked) {
      const { rng, maxUp, maxGap } = ctx;
      const up = Math.min(remaining, rng.int(1, maxUp));
      const reach = Math.max(1, Math.floor(maxGap * (1 - up / (maxUp + 1.5))));
      const start = rng.chance(FLIP_CHANCE) ? { ...from, dir: -from.dir } : from;
      return single(place(start, blocked, rng.int(1, reach), ledgeWidth(ctx), up));
    },
  },
  stair: {
    cost: 2, rows: 3, allowed: ctx => !ctx.slippery,
    lay(ctx, from, remaining, blocked) {
      if (remaining < 3) return null;
      const nodes = [];
      let last = from;
      for (let i = 0; i < 3; i++) {
        const node = ledge(last, from.dir, 1, 2, 1, { move: 'stair' });
        if (!fits(node.col, 2) || blocked(node.col, node.row, 2)) return null;
        nodes.push(node);
        last = node;
      }
      return nodes;
    },
  },
  leap: {
    cost: 2, rows: 0.5, allowed: steerable,
    lay(ctx, from, remaining, blocked) {
      const up = Math.min(remaining, ctx.rng.int(0, 1));
      return single(place(from, blocked, ctx.maxGap + ctx.rng.int(1, 2), 3, up, { move: 'leap' }));
    },
  },
  run: {
    cost: 1, rows: 0.5,
    lay(ctx, from, remaining, blocked) {
      const up = Math.min(remaining, ctx.rng.int(0, 1));
      return single(place(from, blocked, ctx.rng.int(1, 2), ctx.rng.int(6, 8), up, { move: 'run', thick: 2 }));
    },
  },
  shaft: {
    cost: 1, rows: 4,
    lay(ctx, from, remaining, blocked) {
      if (ctx.connectorsLeft <= 0) return null;
      const node = layConnector(ctx, from, remaining, blocked);
      if (node) ctx.connectorsLeft--;
      return single(node);
    },
  },
  drop: {
    cost: 2, rows: -2.5, allowed: ctx => gravityFixed(ctx) && !ctx.rules.fallDamage && !ctx.rules.flood,
    lay(ctx, from, remaining, blocked) {
      const fall = ctx.rng.int(2, 3);
      if (remaining < ctx.maxUp * 3 || from.row + fall >= ctx.level.rows - 2) return null;
      return single(place(from, blocked, ctx.maxGap + ctx.rng.int(1, 3), 3, -fall, { move: 'drop' }));
    },
  },
  zig: {
    cost: 1, rows: 2,
    lay(ctx, from, remaining, blocked) {
      const up = Math.min(remaining, ctx.maxUp);
      const node = ledge(from, -from.dir, 1, ledgeWidth(ctx), up, { move: 'zig' });
      return fits(node.col, node.w) && !blocked(node.col, node.row, node.w) ? [node] : null;
    },
  },
  pocket: {
    cost: 0, rows: 1.5,
    lay(ctx, from, remaining, blocked) {
      if (remaining <= ctx.maxUp + 2) return null;
      const up = Math.min(remaining, ctx.rng.int(1, ctx.maxUp));
      return single(place(from, blocked, ctx.rng.int(1, 2), ctx.puzzle?.room ?? ctx.rng.int(4, 5), up, { pocket: true }));
    },
  },
  wide: {
    cost: 0, rows: 0,
    lay(ctx, from, remaining, blocked) {
      if (remaining <= ctx.maxUp) return null;
      return single(place(from, blocked, ctx.maxGap + ctx.rng.int(3, 4), ledgeWidth(ctx), 0, { wide: true }));
    },
  },
  lift: {
    cost: 0, rows: 4,
    lay: (ctx, from, remaining, blocked) => single(layConnector(ctx, from, remaining, blocked, FLOOR_LIFTS)),
  },
};

export const moveAllowed = (ctx, id) => !MOVES[id].allowed || MOVES[id].allowed(ctx);

export function realise(ctx, id, from, remaining, blocked) {
  return moveAllowed(ctx, id) ? MOVES[id].lay(ctx, from, remaining, blocked) : null;
}

export function writeScript(ctx, spec, remaining) {
  const { rng, puzzle } = ctx;
  const vocabulary = Object.entries(spec.moves ?? DEFAULT_MOVES).filter(([id, weight]) => weight > 0 && moveAllowed(ctx, id));
  const script = [];
  let budget = ctx.budget, rows = 0;
  while (rows < remaining) {
    const affordable = vocabulary.filter(([id]) => MOVES[id].cost <= budget);
    const id = affordable.length ? rng.weighted(affordable, ([, weight]) => weight)[0] : 'hop';
    script.push(id);
    budget -= MOVES[id].cost;
    rows += Math.max(0.5, MOVES[id].rows);
  }
  const required = [...Array(puzzle?.pockets ?? 0).fill('pocket'), ...(puzzle?.wideGap ? ['wide'] : [])];
  let at = 1;
  for (const id of required) {
    at = rng.int(at, script.length);
    script.splice(at, 0, id);
    at++;
  }
  return script;
}
