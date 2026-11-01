import { COLS, TILE } from './level.js';
import { crowded, featureById, layConnector } from './features.js';

export const FLOOR_LIFTS = ['climb', 'bounce'];
export const MOVE_IDS = ['hop', 'stair', 'leap', 'run', 'shaft', 'drop', 'soar', 'fork'];
const DEFAULT_MOVES = { hop: 4, stair: 2, leap: 1, run: 1, shaft: 2, drop: 1 };
const REST = 'run';
const DUET_CHANCE = 0.35;
const TOWERING_ROWS = 3;
const SCRIPT_FILL = 0.75;
const PUZZLE_SHARE = 0.6;
const SPAN_SHARE = 0.85;
const SPAN_GAP = 3;
const SPAN_REACH = 0.7;

const fits = (col, w) => col >= 0 && col + w <= COLS;

function ledge(from, dir, gap, w, up, extra = {}) {
  const col = dir > 0 ? from.col + from.w + gap : from.col - gap - w;
  return { col, row: from.row - up, w, kind: 'tiles', gap, dir, thick: 1, ...extra };
}

function place(from, blocked, gap, w, up, extra) {
  const node = ledge(from, from.dir, gap, w, up, extra);
  return fits(node.col, w) && !blocked(node.col, node.row, w) ? node : null;
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
      return single(place(from, blocked, rng.int(1, reach), ledgeWidth(ctx), up));
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
      return single(place(from, blocked, ctx.maxGap, 3, 0, { move: 'leap' }));
    },
  },
  run: {
    cost: 0, rows: 0.5,
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
    cost: 2, rows: -2.5, allowed: ctx => gravityFixed(ctx) && !ctx.rules.fallDamage && !ctx.rules.flood && !ctx.rules.bounce,
    lay(ctx, from, remaining, blocked) {
      const fall = ctx.rng.int(2, 3);
      if (remaining < ctx.maxUp * 3 || from.row + fall >= ctx.level.rows - 2) return null;
      return single(place(from, blocked, ctx.maxGap, 3, -fall, { move: 'drop' }));
    },
  },
  turn: {
    cost: 0, rows: 3,
    lay(ctx, from, remaining, blocked) {
      const back = { ...from, dir: -from.dir };
      const shaft = ctx.connectorsLeft > 0 && layConnector(ctx, back, remaining, blocked);
      if (shaft) {
        ctx.connectorsLeft--;
        from.reserved = true;
        return [shaft];
      }
      const w = ledgeWidth(ctx);
      for (const [gap, up] of [[1, ctx.maxUp], [2, ctx.maxUp], [1, ctx.maxUp + 1], [3, ctx.maxUp]]) {
        const node = place(back, blocked, gap, w, Math.min(remaining, up), { move: 'turn' });
        if (node) return [node];
      }
      const lift = layConnector(ctx, back, remaining, blocked);
      if (lift) from.reserved = true;
      return single(lift);
    },
  },
  soar: {
    cost: 2, rows: 0.5, allowed: ctx => steerable(ctx) && ctx.rules.baseGravDir > 0,
    lay(ctx, from, remaining, blocked) {
      const gap = ctx.maxGap + ctx.rng.int(3, 4);
      const node = place(from, blocked, gap, 3, Math.min(remaining, ctx.rng.int(0, 1)), { move: 'soar' });
      if (!node) return null;
      const mid = node.dir > 0 ? from.col + from.w + Math.floor(gap / 2) : from.col - Math.ceil(gap / 2);
      node.refill = { col: mid, row: Math.min(from.row, node.row) - 1 };
      return [node];
    },
  },
  fork: {
    cost: 2, rows: 2, allowed: steerable,
    lay(ctx, from, remaining, blocked) {
      if (remaining < 2) return null;
      const safe = ledge(from, from.dir, 1, 2, 1, { move: 'fork', safe: true });
      const join = ledge(safe, from.dir, 1, 3, 1, { move: 'fork' });
      for (const node of [safe, join]) if (!fits(node.col, node.w) || blocked(node.col, node.row, node.w)) return null;
      return [safe, join];
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
      const gap = Math.min(ctx.puzzle?.maxWide ?? Infinity, Math.max(ctx.maxGap + ctx.rng.int(3, 4), Math.ceil(ctx.profile.reach / TILE) + 1));
      return single(place(from, blocked, gap, ledgeWidth(ctx), 0, { wide: true }));
    },
  },
  span: {
    cost: 0, rows: 0.5,
    lay(ctx, from, remaining, blocked) {
      const limit = Math.max(2, Math.floor((ctx.profile.reach / TILE) * SPAN_REACH));
      const gap = Math.min(limit, ctx.rng.int(SPAN_GAP, Math.max(SPAN_GAP, ctx.maxGap)));
      return single(place(from, blocked, gap, ledgeWidth(ctx), Math.min(remaining, ctx.rng.int(0, 1)), { span: true }));
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

const rowsOf = id => Math.max(0.5, MOVES[id].rows);
const phraseCost = phrase => phrase.reduce((sum, id) => sum + MOVES[id].cost, 0);
const phraseRows = phrase => phrase.reduce((sum, id) => sum + rowsOf(id), 0);

const towering = id => MOVES[id].rows >= TOWERING_ROWS;

function writePhrases(ctx, motifs, remaining, restRows) {
  const { rng } = ctx;
  const phrases = [];
  let budget = ctx.budget, rows = 0, previous = null;
  while (rows < remaining * SCRIPT_FILL) {
    const affordable = motifs.filter(([id]) => MOVES[id].cost * 2 <= budget);
    const fresh = affordable.filter(([id]) => id !== previous);
    const first = fresh.length ? rng.weighted(fresh, ([, weight]) => weight)[0] : 'hop';
    const partners = towering(first) ? [] : fresh.filter(([id]) => id !== first && !towering(id) && (MOVES[id].cost + MOVES[first].cost) * 2 <= budget);
    const motif = partners.length && rng.chance(DUET_CHANCE) ? [first, rng.weighted(partners, ([, weight]) => weight)[0]] : [first];
    const repeats = towering(first) ? 1 : Math.max(2, Math.min(rng.int(2, 3), Math.floor(budget / Math.max(1, phraseCost(motif)))));
    const phrase = Array.from({ length: repeats }, () => motif).flat();
    phrases.push(phrase);
    budget -= phraseCost(phrase);
    rows += phraseRows(phrase) + restRows;
    previous = first;
  }
  const costliestFirst = phrases.sort((a, b) => phraseCost(b) - phraseCost(a));
  return [costliestFirst.at(-1), ...costliestFirst.slice(0, -1)];
}

function insertWithin(ctx, script, ids, share, remaining) {
  let lowest = 1;
  for (const id of ids) {
    let rows = 0, last = lowest;
    script.forEach((move, i) => {
      if (i >= lowest && rows <= share * remaining) last = i;
      rows += rowsOf(move);
    });
    const at = ctx.rng.int(lowest, Math.max(lowest, last));
    script.splice(at, 0, id);
    lowest = at + 1;
  }
}

const gapsWanted = spec => Object.entries(spec.features ?? {}).reduce((sum, [id, count]) => sum + (featureById(id).gap ? count : 0), 0);

export function writeScript(ctx, spec, remaining) {
  const { puzzle } = ctx;
  const vocabulary = Object.entries(spec.moves ?? DEFAULT_MOVES).filter(([id, weight]) => weight > 0 && moveAllowed(ctx, id));
  const rests = vocabulary.some(([id]) => id === REST);
  const phrases = writePhrases(ctx, vocabulary.filter(([id]) => id !== REST), remaining, rests ? rowsOf(REST) : 0);
  const script = phrases.flatMap((phrase, i) => (rests && i > 0 ? [REST, ...phrase] : phrase));
  insertWithin(ctx, script, Array(gapsWanted(spec)).fill('span'), SPAN_SHARE, remaining);
  insertWithin(ctx, script, [...Array(puzzle?.pockets ?? 0).fill('pocket'), ...(puzzle?.wideGap ? ['wide'] : [])], PUZZLE_SHARE, remaining);
  return script;
}
