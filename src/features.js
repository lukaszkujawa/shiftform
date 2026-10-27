import { TILE, COLS, ROWS, SOLID, EMPTY, fillTiles, setTile, addObject } from './level.js';
import { SPRING_VEL } from './physics.js';

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function platform(ctx, node) {
  fillTiles(ctx.level, node.col, node.row, node.w, ctx.cave ? 1 : ROWS - node.row, SOLID);
}

export function clearAbove(ctx, col, row, w) {
  fillTiles(ctx.level, col, row - ctx.clearance, w, ctx.clearance, EMPTY);
}

function erase(ctx, node) {
  fillTiles(ctx.level, node.col, node.row, node.w, ctx.cave ? 1 : ROWS - node.row, EMPTY);
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

function raiseNode(ctx, i, lift) {
  const { nodes, level, cave, clearance } = ctx;
  const prev = nodes[i - 1], node = nodes[i];
  erase(ctx, node);
  node.row = Math.max(2, node.row - lift);
  node.lifted = true;
  platform(ctx, node);
  if (cave) {
    clearAbove(ctx, node.col, node.row, node.w);
    const top = node.row - clearance;
    fillTiles(level, prev.col + prev.w, top, node.col - prev.col - prev.w, prev.row + 1 - top, EMPTY);
  }
}

function pocketOn(ctx, node) {
  const { rng, maxUp, cave } = ctx;
  const col = node.col + 1 + rng.int(0, node.w - 4);
  const row = Math.max(2, node.row - rng.int(2, Math.max(2, maxUp)));
  fillTiles(ctx.level, col, row, 2, 1, SOLID);
  if (cave) clearAbove(ctx, col, row, 2);
  node.reserved = true;
  return { col, row };
}

function pickupOn(ctx, type, pocket, bit) {
  return addObject(ctx.level, { type, x: pocket.col * TILE + TILE - 8, y: (pocket.row - 1) * TILE + 6, w: 16, h: 18, bit });
}

function barrierOn(ctx, node, extra) {
  const { clearance, cave, profile } = ctx;
  const height = cave ? clearance : clamp(Math.ceil(profile.height / TILE) + 3, 3, node.row);
  node.reserved = true;
  return addObject(ctx.level, { x: node.col * TILE, y: (node.row - height) * TILE, w: TILE, h: height * TILE, ...extra });
}

function pocketNodes(ctx) {
  return ctx.nodes.filter(n => n.pocket);
}

function barrierTarget(ctx, after) {
  const { nodes, rng } = ctx;
  const index = nodes.indexOf(after);
  return nodes[index + rng.int(1, Math.min(3, nodes.length - 1 - index))];
}

const gapBox = (ctx, i) => {
  const prev = ctx.nodes[i - 1], node = ctx.nodes[i];
  const top = ctx.cave ? Math.min(prev.row, node.row) - ctx.clearance : 0;
  const bottom = ctx.cave ? Math.max(prev.row, node.row) + 1 : ROWS;
  return { col0: prev.col + prev.w, col1: node.col, top, bottom, prev, node };
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
      const a = addObject(ctx.level, { type: 'portal', x: (prev.col + prev.w - 1) * TILE + 5, y: (prev.row - 1) * TILE - 4, w: 20, h: 34, target: -1 });
      const b = addObject(ctx.level, { type: 'portal', x: (node.col + 1) * TILE + 5, y: Math.max(0, node.row - 5) * TILE, w: 20, h: 34, target: a.id });
      a.target = b.id;
    },
  },
];

const plainNode = (ctx, i) => {
  const node = ctx.nodes[i];
  return node.kind === 'tiles' && !node.exit && !node.reserved && !node.pocket;
};

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
    id: 'spring', weight: () => 2,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i - 1].kind === 'tiles' && !ctx.nodes[i].wide && ctx.nodes[i].row > 5 && !ctx.rules.flipOnJump && springLift(ctx) >= 2,
    apply: (ctx, i) => {
      const prev = ctx.nodes[i - 1];
      addObject(ctx.level, { type: 'spring', x: (prev.col + prev.w - 1) * TILE + 4, y: prev.row * TILE - 12, w: TILE - 8, h: 12, dir: -1 });
      raiseNode(ctx, i, ctx.rng.int(2, springLift(ctx)));
    },
  },
  {
    id: 'laser', weight: ctx => 2 + ctx.difficulty,
    allowed: (ctx, i) => ctx.nodes[i].gap >= 2 && !ctx.nodes[i].wide,
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const col = rng.int(box.col0, box.col1 - 1);
      const period = rng.pick([120, 240]);
      addObject(level, { type: 'laser', x: col * TILE + 11, y: box.top * TILE, w: 8, h: (box.bottom - box.top) * TILE, period, on: Math.floor(period * 0.4), phase: rng.int(0, 239) });
    },
  },
  {
    id: 'wind', weight: () => 1.5,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].gap >= 2 && !ctx.nodes[i].wide && ctx.nodes[i].row > 7 && !ctx.needsCeiling && !ctx.rules.wrapY,
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
    id: 'water', weight: () => 1,
    allowed: (ctx, i) => ctx.nodes[i].gap >= 3 && !ctx.nodes[i].wide && !ctx.needsCeiling && Math.max(ctx.nodes[i].row, ctx.nodes[i - 1].row) < 15,
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
    allowed: (ctx, i) => ctx.nodes[i].gap >= 3 && !ctx.nodes[i].wide && !ctx.cave,
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

function springLift(ctx) {
  const height = (SPRING_VEL * SPRING_VEL) / (2 * ctx.rules.gravity);
  return clamp(Math.floor((height * 0.8) / TILE), 0, 6);
}
