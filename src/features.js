import { TILE, COLS, ROWS, SOLID, EMPTY, ONE_WAY, fillTiles, setTile, addObject } from './level.js';
import { SPRING_VEL } from './physics.js';

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function platform(ctx, node, tile = SOLID) {
  fillTiles(ctx.level, node.col, node.row, node.w, node.thick, tile);
}

export function clearAbove(ctx, col, row, w) {
  fillTiles(ctx.level, col, row - ctx.clearance, w, ctx.clearance, EMPTY);
}

export function carveBetween(ctx, a, b) {
  const col0 = Math.min(a.col, b.col), col1 = Math.max(a.col + a.w, b.col + b.w);
  const top = Math.min(a.row, b.row) - ctx.clearance - (ctx.rules.flipOnJump ? 0 : 1);
  const bottom = Math.max(a.row, b.row) + 1;
  fillTiles(ctx.level, col0, top, col1 - col0, bottom - top, EMPTY);
}

function erase(ctx, node) {
  fillTiles(ctx.level, node.col, node.row, node.w, node.thick, EMPTY);
}

function allocBit(ctx) {
  const bit = ctx.nextBit;
  ctx.nextBit <<= 1;
  return bit;
}

function convertNode(ctx, node, extra) {
  erase(ctx, node);
  node.kind = extra.type;
  return addObject(ctx.level, { x: node.col * TILE, y: node.row * TILE, w: node.w * TILE, h: TILE, ...extra });
}

const liftable = ctx => ctx.style !== 'spiral';

function raiseNode(ctx, i, lift) {
  const { nodes, cave } = ctx;
  const prev = nodes[i - 1], node = nodes[i];
  erase(ctx, node);
  node.row = Math.max(2, node.row - lift);
  node.lifted = true;
  if (node.thick > 2) node.thick = ROWS - node.row;
  platform(ctx, node);
  if (cave) {
    clearAbove(ctx, node.col, node.row, node.w);
    carveBetween(ctx, prev, node);
  }
}

function pocketOn(ctx, node) {
  const { rng, maxUp, cave } = ctx;
  const col = node.col + 1 + rng.int(0, node.w - 4);
  const row = Math.max(2, node.row - (ctx.style === 'spiral' ? 2 : rng.int(2, Math.max(2, maxUp))));
  fillTiles(ctx.level, col, row, 2, 1, SOLID);
  if (cave) clearAbove(ctx, col, row, 2);
  node.reserved = true;
  return { col, row, nodeIndex: ctx.nodes.indexOf(node) };
}

function pickupOn(ctx, type, pocket, bit) {
  return addObject(ctx.level, { type, x: pocket.col * TILE + TILE - 8, y: (pocket.row - 1) * TILE + 6, w: 16, h: 18, bit, routeAfter: pocket.nodeIndex });
}

function barrierHeight(ctx, node) {
  return ctx.cave ? ctx.clearance : clamp(Math.ceil(ctx.profile.height / TILE) + 3, 3, node.row);
}

function entryCol(node) {
  return node.dir > 0 ? node.col : node.col + node.w - 1;
}

function exitCol(node) {
  return node.dir > 0 ? node.col + node.w - 1 : node.col;
}

function barrierOn(ctx, node, extra) {
  const height = barrierHeight(ctx, node);
  node.reserved = true;
  return addObject(ctx.level, { x: entryCol(node) * TILE, y: (node.row - height) * TILE, w: TILE, h: height * TILE, ...extra });
}

function pocketNodes(ctx) {
  return ctx.nodes.filter(n => n.pocket);
}

function barrierTarget(ctx, after) {
  const { nodes, rng } = ctx;
  const index = nodes.indexOf(after);
  return nodes[index + rng.int(1, Math.min(3, nodes.length - 1 - index))];
}

export const gapBox = (ctx, i) => {
  const prev = ctx.nodes[i - 1], node = ctx.nodes[i];
  const col0 = node.dir > 0 ? prev.col + prev.w : node.col + node.w;
  const col1 = node.dir > 0 ? node.col : prev.col;
  const local = ctx.cave || ctx.style === 'spiral';
  const top = local ? Math.max(0, Math.min(prev.row, node.row) - ctx.clearance) : 0;
  const bottom = local ? Math.max(prev.row, node.row) + 1 : ROWS;
  return { col0, col1, top, bottom, prev, node };
};

export const PUZZLES = [
  {
    id: 'keyDoor', weight: 3, pockets: 1,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      pickupOn(ctx, 'key', pocketOn(ctx, node), bit);
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'door', bit });
    },
  },
  {
    id: 'switchWall', weight: 2, pockets: 1,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      pickupOn(ctx, 'switch', pocketOn(ctx, node), bit);
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'toggle', on: false, bit });
    },
  },
  {
    id: 'switchBridge', weight: 3, pockets: 1, wideGap: true,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      pickupOn(ctx, 'switch', pocketOn(ctx, node), bit);
      const i = ctx.nodes.findIndex(n => n.wide);
      const box = gapBox(ctx, i);
      const row = Math.max(box.prev.row, box.node.row);
      if (ctx.cave) fillTiles(ctx.level, box.col0, row - ctx.clearance, box.col1 - box.col0, ctx.clearance + 1, EMPTY);
      addObject(ctx.level, { type: 'toggle', on: true, bit, x: box.col0 * TILE, y: row * TILE, w: (box.col1 - box.col0) * TILE, h: TILE });
    },
  },
  {
    id: 'orbs', weight: 2, pockets: 2,
    apply: ctx => {
      for (const node of pocketNodes(ctx)) {
        const bit = allocBit(ctx);
        pickupOn(ctx, 'orb', pocketOn(ctx, node), bit);
        ctx.level.exitNeeds |= bit;
      }
    },
  },
  {
    id: 'portal', weight: 2.5, pockets: 0, wideGap: true, openOnly: true,
    apply: ctx => {
      const i = ctx.nodes.findIndex(n => n.wide);
      const { prev, node } = gapBox(ctx, i);
      prev.reserved = true;
      node.reserved = true;
      const a = addObject(ctx.level, { type: 'portal', x: exitCol(prev) * TILE + 5, y: (prev.row - 1) * TILE - 4, w: 20, h: 34, target: -1 });
      const b = addObject(ctx.level, { type: 'portal', x: (entryCol(node) + node.dir) * TILE + 5, y: Math.max(0, node.row - 5) * TILE, w: 20, h: 34, target: a.id });
      a.target = b.id;
    },
  },
];

const plainNode = (ctx, i) => {
  const node = ctx.nodes[i];
  return node.kind === 'tiles' && !node.exit && !node.reserved && !node.pocket && !node.ladder;
};

const plainGap = (ctx, i, min) => ctx.nodes[i].gap >= min && !ctx.nodes[i].wide && !ctx.nodes[i].ladder;

function springLift(ctx) {
  const height = (SPRING_VEL * SPRING_VEL) / (2 * ctx.rules.gravity);
  return clamp(Math.floor((height * 0.8) / TILE), 0, 6);
}

const gravityFixed = ctx => !ctx.needsCeiling && !ctx.rules.blinkJump && ctx.rules.baseGravDir > 0;

export const FEATURES = [
  {
    id: 'mover', weight: () => 3,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w <= 3,
    apply: (ctx, i) => {
      const { rng, nodes, cave, level, clearance } = ctx;
      const node = nodes[i];
      const vertical = rng.chance(0.5);
      const dx = vertical ? 0 : rng.int(2, 4) * TILE * (rng.chance(0.5) ? 1 : -1);
      const dy = vertical ? rng.int(2, 3) * TILE * (node.row > 10 ? -1 : 1) : 0;
      if (cave) {
        const c0 = Math.min(node.col, node.col + dx / TILE), c1 = Math.max(node.col + node.w, node.col + node.w + dx / TILE);
        const r0 = Math.min(node.row, node.row + dy / TILE) - clearance, r1 = Math.max(node.row, node.row + dy / TILE) + 1;
        fillTiles(level, c0, r0, c1 - c0, r1 - r0 + 1, EMPTY);
      }
      convertNode(ctx, node, { type: 'mover', dx, dy, period: rng.pick([120, 240]), phase: rng.int(0, 239) });
    },
  },
  {
    id: 'phase', weight: ctx => 2 + ctx.difficulty,
    allowed: plainNode,
    apply: (ctx, i) => {
      const period = ctx.rng.pick([120, 240]);
      convertNode(ctx, ctx.nodes[i], { type: 'phase', period, on: Math.floor(period * 0.55), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    id: 'crumble', weight: ctx => 1 + ctx.difficulty * 2,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w <= 3 && ctx.nextBit < 1 << 28,
    apply: (ctx, i) => convertNode(ctx, ctx.nodes[i], { type: 'crumble', bit: allocBit(ctx) }),
  },
  {
    id: 'conveyor', weight: () => 1.5,
    allowed: (ctx, i) => plainNode(ctx, i) && !ctx.rules.flipOnJump,
    apply: (ctx, i) => convertNode(ctx, ctx.nodes[i], { type: 'conveyor', speed: ctx.rng.float(1.5, 3) * (ctx.rng.chance(0.5) ? 1 : -1) }),
  },
  {
    id: 'oneway', weight: () => 1.5,
    allowed: (ctx, i) => plainNode(ctx, i) && !ctx.cave && ctx.nodes[i].row > 4,
    apply: (ctx, i) => {
      const node = ctx.nodes[i];
      erase(ctx, node);
      node.thick = 1;
      node.kind = 'oneway';
      platform(ctx, node, ONE_WAY);
    },
  },
  {
    id: 'spring', weight: () => 2,
    allowed: (ctx, i) => liftable(ctx) && plainNode(ctx, i) && ctx.nodes[i - 1].kind === 'tiles' && plainGap(ctx, i, 0) && ctx.nodes[i].row > 5 && !ctx.rules.flipOnJump && springLift(ctx) >= 2,
    apply: (ctx, i) => {
      const prev = ctx.nodes[i - 1];
      addObject(ctx.level, { type: 'spring', x: exitCol(prev) * TILE + 4, y: prev.row * TILE - 12, w: TILE - 8, h: 12, dir: -1 });
      raiseNode(ctx, i, ctx.rng.int(2, springLift(ctx)));
    },
  },
  {
    id: 'bumper', weight: () => 1.5,
    allowed: (ctx, i) => liftable(ctx) && plainNode(ctx, i) && !ctx.cave && plainGap(ctx, i, 4) && ctx.nodes[i].row > 5 && gravityFixed(ctx),
    apply: (ctx, i) => {
      raiseNode(ctx, i, ctx.rng.int(1, 3));
      const box = gapBox(ctx, i);
      const col = Math.floor((box.col0 + box.col1) / 2);
      addObject(ctx.level, { type: 'bumper', x: col * TILE + 5, y: (box.prev.row - 1) * TILE + 5, w: 20, h: 20, dir: box.node.dir });
    },
  },
  {
    id: 'laser', weight: ctx => 2 + ctx.difficulty,
    allowed: (ctx, i) => plainGap(ctx, i, 2),
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const col = rng.int(box.col0, box.col1 - 1);
      const period = rng.pick([120, 240]);
      addObject(level, { type: 'laser', x: col * TILE + 11, y: box.top * TILE, w: 8, h: (box.bottom - box.top) * TILE, period, on: Math.floor(period * 0.4), phase: rng.int(0, 239) });
    },
  },
  {
    id: 'saw', weight: ctx => 1.5 + ctx.difficulty,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && Math.min(ctx.nodes[i].row, ctx.nodes[i - 1].row) > 3,
    apply: (ctx, i) => {
      const { rng, level, cave } = ctx;
      const box = gapBox(ctx, i);
      const vertical = rng.chance(0.4);
      const row = Math.min(box.prev.row, box.node.row) - rng.int(1, 3);
      const span = (box.col1 - box.col0) * TILE - 26;
      const saw = vertical
        ? { x: box.col0 * TILE + rng.int(0, Math.max(0, span)), y: (row - 2) * TILE, dx: 0, dy: 4 * TILE }
        : { x: box.col0 * TILE, y: row * TILE, dx: span, dy: 0 };
      if (cave) fillTiles(level, box.col0, row - 2, box.col1 - box.col0, Math.max(box.prev.row, box.node.row) - row + 3, EMPTY);
      addObject(level, { type: 'saw', w: 26, h: 26, period: rng.pick([120, 240]), phase: rng.int(0, 239), ...saw });
    },
  },
  {
    id: 'gate', weight: ctx => 1.5 + ctx.difficulty,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 2,
    apply: (ctx, i) => {
      const node = ctx.nodes[i];
      const height = barrierHeight(ctx, node);
      const period = ctx.rng.pick([120, 240]);
      node.reserved = true;
      addObject(ctx.level, { type: 'gate', x: entryCol(node) * TILE + 9, y: (node.row - height) * TILE, w: 12, h: height * TILE, period, on: Math.floor(period * 0.5), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    id: 'gravpad', weight: () => 2,
    allowed: (ctx, i) => ctx.cave && plainNode(ctx, i) && i + 1 < ctx.nodes.length && plainNode(ctx, i + 1) && gravityFixed(ctx) && !ctx.rules.wrapY && ctx.nodes[i].gap <= 3 && ctx.nodes[i + 1].gap <= 3,
    apply: (ctx, i) => {
      const node = ctx.nodes[i], next = ctx.nodes[i + 1];
      node.reserved = true;
      next.reserved = true;
      const top = Math.min(node.row, next.row) - ctx.clearance - 1;
      fillTiles(ctx.level, Math.min(node.col, next.col), top + 1, Math.max(node.col + node.w, next.col + next.w) - Math.min(node.col, next.col), Math.max(node.row, next.row) - top - 1, EMPTY);
      fillTiles(ctx.level, Math.min(node.col, next.col), top, Math.max(node.col + node.w, next.col + next.w) - Math.min(node.col, next.col), 1, SOLID);
      addObject(ctx.level, { type: 'gravpad', x: entryCol(node) * TILE + 3, y: node.row * TILE - 8, w: TILE - 6, h: 8, dir: -1 });
      addObject(ctx.level, { type: 'gravpad', x: exitCol(next) * TILE + 3, y: (top + 1) * TILE, w: TILE - 6, h: 8, dir: 1 });
    },
  },
  {
    id: 'wind', weight: () => 1.5,
    allowed: (ctx, i) => liftable(ctx) && plainNode(ctx, i) && plainGap(ctx, i, 2) && ctx.nodes[i].row > 7 && gravityFixed(ctx) && !ctx.rules.wrapY,
    apply: (ctx, i) => {
      const { rng, level, cave } = ctx;
      raiseNode(ctx, i, rng.int(3, 6));
      const box = gapBox(ctx, i);
      const top = Math.max(0, box.node.row - 2);
      if (cave) fillTiles(level, box.col0, top, box.col1 - box.col0, box.bottom - top, EMPTY);
      addObject(level, { type: 'wind', x: box.col0 * TILE, y: top * TILE, w: (box.col1 - box.col0) * TILE, h: (box.bottom - top) * TILE, ax: 0, ay: -(ctx.rules.gravity + 0.3) });
    },
  },
  {
    id: 'gust', weight: () => 1.5,
    allowed: (ctx, i) => plainGap(ctx, i, 3) && ctx.rules.airAccel > 0,
    apply: (ctx, i) => {
      const box = gapBox(ctx, i);
      const top = Math.max(0, Math.min(box.prev.row, box.node.row) - 5);
      addObject(ctx.level, { type: 'wind', x: box.col0 * TILE, y: top * TILE, w: (box.col1 - box.col0) * TILE, h: (box.bottom - top) * TILE, ax: -box.node.dir * ctx.rng.float(0.18, 0.3), ay: 0 });
    },
  },
  {
    id: 'water', weight: () => 1,
    allowed: (ctx, i) => plainGap(ctx, i, 3) && !ctx.needsCeiling && !ctx.rules.flood && Math.max(ctx.nodes[i].row, ctx.nodes[i - 1].row) < 15,
    apply: (ctx, i) => {
      const box = gapBox(ctx, i);
      const top = Math.max(box.prev.row, box.node.row) + 1;
      if (ctx.cave) fillTiles(ctx.level, box.col0, top, box.col1 - box.col0, ROWS - top - 1, EMPTY);
      addObject(ctx.level, { type: 'water', x: box.col0 * TILE, y: top * TILE, w: (box.col1 - box.col0) * TILE, h: (ROWS - top) * TILE });
    },
  },
  {
    id: 'spikeStrip', weight: ctx => 1.5 + ctx.difficulty,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 3,
    apply: (ctx, i) => {
      const node = ctx.nodes[i];
      addObject(ctx.level, { type: 'spikes', x: (node.col + 1) * TILE + 3, y: node.row * TILE - 14, w: TILE - 6, h: 14, dir: -1 });
    },
  },
  {
    id: 'floatingSpike', weight: ctx => 1 + ctx.difficulty,
    allowed: (ctx, i) => plainGap(ctx, i, 3) && !ctx.cave,
    apply: (ctx, i) => {
      const box = gapBox(ctx, i);
      const col = ctx.rng.int(box.col0, box.col1 - 1);
      const row = Math.min(box.prev.row, box.node.row) - ctx.rng.int(2, 4);
      if (row < 1) return;
      setTile(ctx.level, col, row, SOLID);
      addObject(ctx.level, { type: 'spikes', x: col * TILE + 3, y: (row + 1) * TILE, w: TILE - 6, h: 14, dir: 1 });
      addObject(ctx.level, { type: 'spikes', x: col * TILE + 3, y: row * TILE - 14, w: TILE - 6, h: 14, dir: -1 });
    },
  },
];
