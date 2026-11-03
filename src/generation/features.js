import { TILE, COLS, ROWS, SOLID, EMPTY, ONE_WAY, SPRING_VEL, HOOK_REACH, createLevel, fillTiles, setTile, addObject } from '../world/level.js';
import { step, initialState, playerSize } from '../world/physics.js';
import { SHOP_ROWS } from '../world/tunnel.js';

const LEDGE_WIDTH = 2;
export const GUARDS = ['laser', 'saw', 'crumble'];
const UPDRAFT_LIFT = 0.18;
const POOL_DEPTH = 3;
const BUMPER_REACH = 8;
const CLING_W = 6;
const CLING_DOORWAY = 2;

const corridorTop = ctx => (ctx.level.rows - SHOP_ROWS) * TILE;

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function platform(ctx, node, tile = SOLID) {
  fillTiles(ctx.level, node.col, node.row, node.w, node.thick, tile);
  if (node.hole) fillTiles(ctx.level, node.hole.col, node.row, node.hole.w, node.thick, EMPTY);
}

export function jumpRise(rules) {
  const level = createLevel({ ...rules, jumpFlipChance: 0, flood: 0 }, []);
  fillTiles(level, 0, ROWS - 1, COLS, 1, SOLID);
  level.start = { x: TILE, y: (ROWS - 1) * TILE - playerSize(rules).h };
  let s = initialState(level);
  for (let i = 0; i < 20; i++) s = step(level, s, {});
  const ground = s.y;
  let top = ground;
  for (let i = 0; i < 120 && !s.dead; i++) { s = step(level, s, { jump: true }); top = Math.min(top, s.y); }
  return ground - top;
}

export function clearAbove(ctx, col, row, w) {
  fillTiles(ctx.level, col, row - ctx.clearance, w, ctx.clearance, EMPTY);
}

export function carveBetween(ctx, a, b) {
  const col0 = Math.min(a.col, b.col), col1 = Math.max(a.col + a.w, b.col + b.w);
  const top = Math.min(a.row, b.row) - ctx.clearance - (ctx.needsCeiling ? 0 : 1);
  const bottom = Math.max(a.row, b.row) + 1;
  fillTiles(ctx.level, col0, top, col1 - col0, bottom - top, EMPTY);
}

function erase(ctx, node) {
  fillTiles(ctx.level, node.col, node.row, node.w, node.thick, EMPTY);
}

function convertNode(ctx, node, extra) {
  erase(ctx, node);
  node.kind = extra.type;
  return addObject(ctx.level, { x: node.col * TILE, y: node.row * TILE, w: node.w * TILE, h: TILE, ...extra });
}

export const occupied = (ctx, nodes) => [...ctx.placed, ...ctx.clearings, ...nodes];

const occupiedBut = (ctx, node) => occupied(ctx, ctx.nodes.filter(n => n !== node));

export const innerNodes = (ctx, allowed) => ctx.nodes.map((_, i) => i).slice(2).filter(allowed);

export function crowded(nodes, col, row, w) {
  return nodes.some(n => row <= n.row + 2 && row >= n.row - 2 - (n.span ?? 0) && col <= n.col + n.w && col + w >= n.col);
}

export function ledgeSpots(ctx, anchors, blocked) {
  const { rng, maxGap, maxUp } = ctx;
  const spots = [];
  for (const anchor of anchors) {
    for (const dir of [1, -1]) {
      for (let gap = 2; gap <= Math.max(2, maxGap); gap++) {
        for (let up = 0; up <= maxUp; up++) {
          const col = dir > 0 ? anchor.col + anchor.w + gap : anchor.col - gap - LEDGE_WIDTH;
          const row = anchor.row - up;
          if (col < 0 || col + LEDGE_WIDTH > COLS || blocked(anchor, col, row, LEDGE_WIDTH)) continue;
          spots.push({ anchor, ledge: { col, row, w: LEDGE_WIDTH, gap, dir, kind: 'tiles', thick: 1 } });
        }
      }
    }
  }
  return rng.shuffle(spots);
}

function openLedge(ctx, anchor, ledge) {
  if (ctx.cave) {
    clearAbove(ctx, ledge.col, ledge.row, ledge.w);
    carveBetween(ctx, anchor, ledge);
  }
  platform(ctx, ledge);
  redrawPlatforms(ctx);
}

export function guardedLedge(ctx, anchor, ledge, guards = GUARDS) {
  openLedge(ctx, anchor, ledge);
  const guardId = ctx.rng.pick(guards);
  featureById(guardId).apply({ ...ctx, nodes: [anchor, ledge] }, 1);
  redrawPlatforms(ctx);
}

export function redrawPlatforms(ctx) {
  if (!ctx.cave) return;
  for (const node of occupied(ctx, ctx.nodes)) if (node.kind === 'tiles') platform(ctx, node);
  for (const { row, tiles } of ctx.seals) tiles.forEach((tile, col) => setTile(ctx.level, col, row, tile));
}

function waypoint(ctx, after, point) {
  ctx.waypoints.push({ after, ...point });
}

export const MECHANISM_TYPES = new Set(['crate', 'hook', 'key', 'switch', 'lever', 'timer']);
export const LOCK_TYPES = new Set(['door', 'toggle']);

function hookOver(ctx, i) {
  const box = gapBox(ctx, i);
  const length = ctx.rng.int(3, 4) * TILE;
  const x = ((box.col0 + box.col1) / 2) * TILE;
  const y = Math.max(TILE / 2, Math.min(box.prev.row, box.node.row) * TILE - length);
  const hookRow = Math.floor(y / TILE);
  if (ctx.cave) fillTiles(ctx.level, box.col0, hookRow - 1, box.col1 - box.col0, box.bottom - hookRow + 1, EMPTY);
  addObject(ctx.level, { type: 'hook', x: x - 6, y: y - 6, w: 12, h: 12, reach: HOOK_REACH });
  waypoint(ctx, i - 1, { x, y: y + length, rope: true });
}

const tempoOf = ctx => ctx.tempo ?? ctx.rng.pick([120, 240]);

const gravityFixed = ctx => !ctx.needsCeiling && ctx.rules.baseGravDir > 0 && !ctx.rules.wrapY;

function barrierHeight(ctx, node) {
  return ctx.cave ? ctx.clearance : clamp(Math.ceil(ctx.profile.height / TILE) + 3, 3, node.row);
}

function entryCol(node) {
  return node.dir > 0 ? node.col : node.col + node.w - 1;
}

function exitCol(node) {
  return node.dir > 0 ? node.col + node.w - 1 : node.col;
}

export const gapBox = (ctx, i) => {
  const prev = ctx.nodes[i - 1], node = ctx.nodes[i];
  const col0 = node.dir > 0 ? prev.col + prev.w : node.col + node.w;
  const col1 = node.dir > 0 ? node.col : prev.col;
  const top = Math.max(0, Math.min(prev.row, node.row) - ctx.clearance);
  const bottom = Math.max(prev.row, node.row) + 1;
  return { col0, col1, top, bottom, prev, node };
};

export const PUZZLES = [
  {
    id: 'portal', weight: 2.5, wideGap: true, openOnly: true,
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
  {
    id: 'swing', weight: 2.5, wideGap: true,
    apply: ctx => hookOver(ctx, ctx.nodes.findIndex(n => n.wide)),
  },
  {
    id: 'bumperGap', weight: 3, wideGap: true, maxWide: BUMPER_REACH,
    allowed: ctx => gravityFixed(ctx) && ctx.maxGap <= BUMPER_REACH - 3,
    apply: ctx => {
      const i = ctx.nodes.findIndex(n => n.wide);
      const box = gapBox(ctx, i);
      if (box.col1 - box.col0 > BUMPER_REACH) return false;
      box.prev.reserved = true;
      box.node.reserved = true;
      if (ctx.cave) fillTiles(ctx.level, box.col0, box.top, box.col1 - box.col0, box.bottom - box.top, EMPTY);
      addObject(ctx.level, { type: 'bumper', x: exitCol(box.prev) * TILE + 3, y: box.prev.row * TILE - 24, w: 24, h: 24, dir: box.node.dir });
    },
  },
];

export const plainNode = (ctx, i) => {
  const node = ctx.nodes[i];
  return node.kind === 'tiles' && !node.exit && !node.reserved && !node.connector;
};

const plainGap = (ctx, i, min) => ctx.nodes[i].gap >= min && !ctx.nodes[i].wide && !ctx.nodes[i].connector && !ctx.nodes[i].rig;

function springLift(ctx) {
  const height = (SPRING_VEL * SPRING_VEL) / (2 * ctx.rules.gravity);
  return clamp(Math.floor((height * 0.8) / TILE), 0, 6);
}

const CONNECTORS = [
  { type: 'climb', weight: 3, allowed: gravityFixed, gap: () => 0 },
  { type: 'bounce', weight: 3, allowed: ctx => gravityFixed(ctx) && ctx.rules.airAccel >= 0.3, gap: rng => rng.int(1, 2) },
  { type: 'updraft', weight: 1, allowed: ctx => gravityFixed(ctx) && ctx.rules.airAccel >= 0.3 && !ctx.rules.flood, gap: rng => rng.int(2, 3) },
  { type: 'swim', weight: 1, allowed: ctx => gravityFixed(ctx) && !ctx.rules.flood && !ctx.rules.fallDamage, gap: () => 1 },
  { type: 'cling', weight: 2, allowed: ctx => gravityFixed(ctx) && ctx.rules.airAccel >= 0.3 && !ctx.rules.rubberWalls, gap: () => 2 },
  { type: 'refill', weight: 1, allowed: ctx => gravityFixed(ctx) && ctx.rules.airAccel >= 0.3, gap: () => 1 },
];

function flightBlocked(blocked, base, top, bottom) {
  for (let r = bottom - 3; r > top - 3; r -= 4) if (blocked(base - 1, r, 3)) return true;
  return blocked(base - 1, top - 3, 3);
}

export function layConnector(ctx, from, remaining, blocked, types = null) {
  const { rng, maxUp } = ctx;
  const kinds = CONNECTORS.filter(k => k.allowed(ctx) && (!types || types.includes(k.type)));
  if (!kinds.length || remaining < maxUp + 2) return null;
  const kind = kinds.find(k => k.type === ctx.connectorKind) ?? rng.weighted(kinds, k => k.weight);
  const up = Math.min(remaining, rng.int(maxUp + 2, maxUp + 5));
  const w = rng.int(3, 4), gap = kind.gap(rng), row = from.row - up;
  for (const dir of [from.dir, -from.dir]) {
    const base = dir > 0 ? from.col + from.w - 1 : from.col;
    const col = dir > 0 ? base + 1 + gap : base - gap - w;
    const flies = kind.type === 'bounce' || kind.type === 'updraft';
    const spans = flies || kind.type === 'cling' || kind.type === 'refill';
    if (col < 0 || col + w > COLS || blocked(col, row, w) || (spans && flightBlocked(blocked, base, row, Math.min(from.row, ctx.level.rows - 1 - SHOP_ROWS)))) continue;
    from.reserved = true;
    const flight = spans ? { col: base - 1, row: from.row, w: 3 + gap, span: up + 3, kind: 'air' } : null;
    return { col, row, w, kind: 'tiles', gap, dir, thick: 1, connector: { type: kind.type, base, from: from.row }, flight };
  }
  return null;
}

export function buildConnector(ctx, node) {
  const { type, base, from } = node.connector;
  const col0 = node.dir > 0 ? base + 1 : node.col + node.w, col1 = node.dir > 0 ? node.col : base;
  if (ctx.cave && (type === 'updraft' || type === 'swim')) fillTiles(ctx.level, col0, node.row - ctx.clearance, col1 - col0, from - node.row + ctx.clearance + 1, EMPTY);
  if (type === 'climb') {
    addObject(ctx.level, { type: 'climb', x: base * TILE + 5, y: node.row * TILE, w: TILE - 10, h: (from - node.row) * TILE });
  } else if (type === 'updraft') {
    addObject(ctx.level, { type: 'wind', x: col0 * TILE, y: (node.row - 2) * TILE, w: (col1 - col0) * TILE, h: (from - node.row + 3) * TILE, ax: 0, ay: -(ctx.rules.gravity + UPDRAFT_LIFT) });
  } else if (type === 'swim') {
    fillTiles(ctx.level, col0, from + 1, col1 - col0, 1, SOLID);
    addObject(ctx.level, { type: 'water', x: col0 * TILE, y: node.row * TILE, w: (col1 - col0) * TILE, h: (from - node.row + 1) * TILE });
  } else if (type === 'refill') {
    const col = node.dir > 0 ? base + 1 : base - 1;
    if (ctx.cave) fillTiles(ctx.level, col - 1, node.row - ctx.clearance, 3, from - node.row + ctx.clearance, EMPTY);
    for (let row = from - 3; row > node.row; row -= 3) addObject(ctx.level, { type: 'refill', x: (col + 0.5) * TILE - 9, y: (row + 0.5) * TILE - 9, w: 18, h: 18 });
  } else if (type === 'cling') {
    const far = node.dir > 0 ? node.col : node.col + node.w - 1;
    const top = node.row + 1, nearBottom = from - CLING_DOORWAY, inward = Math.sign(far - base);
    fillTiles(ctx.level, Math.min(base, far) + 1, node.row - ctx.clearance, Math.abs(far - base) - 1, from - node.row + ctx.clearance, EMPTY);
    for (const [col, height] of [[base, nearBottom - top], [far, from - top]]) {
      const pillar = { col, row: top, w: 1, thick: height, kind: 'tiles' };
      platform(ctx, pillar);
      ctx.clearings.push(pillar);
    }
    const face = (col, side) => (side > 0 ? (col + 1) * TILE - CLING_W : col * TILE);
    addObject(ctx.level, { type: 'cling', x: face(base, inward), y: top * TILE, w: CLING_W, h: (nearBottom - top) * TILE });
    addObject(ctx.level, { type: 'cling', x: face(far, -inward), y: top * TILE, w: CLING_W, h: (from - top) * TILE });
  } else {
    const vel = Math.sqrt(2 * ctx.rules.gravity * ((from - node.row) * TILE + ctx.size.h + 24));
    addObject(ctx.level, { type: 'spring', x: base * TILE + 4, y: from * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
  }
}

function carveOver(ctx, box, row, above) {
  if (ctx.cave) fillTiles(ctx.level, box.col0, row - above, box.col1 - box.col0, Math.max(box.prev.row, box.node.row) - row + above + 1, EMPTY);
}

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
      convertNode(ctx, node, { type: 'mover', dx, dy, period: tempoOf(ctx), phase: rng.int(0, 239) });
    },
  },
  {
    id: 'phase', weight: ctx => 2 + ctx.difficulty,
    allowed: plainNode,
    apply: (ctx, i) => {
      const period = tempoOf(ctx);
      convertNode(ctx, ctx.nodes[i], { type: 'phase', period, on: Math.floor(period * 0.55), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    id: 'crumble', weight: ctx => 1 + ctx.difficulty * 2,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w <= 3,
    apply: (ctx, i) => convertNode(ctx, ctx.nodes[i], { type: 'crumble' }),
  },
  {
    id: 'conveyor', weight: () => 1.5,
    allowed: (ctx, i) => plainNode(ctx, i) && !ctx.needsCeiling,
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
    id: 'laser', weight: ctx => 2 + ctx.difficulty,
    allowed: (ctx, i) => plainGap(ctx, i, 2),
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const col = rng.int(box.col0, box.col1 - 1);
      const period = tempoOf(ctx);
      addObject(level, { type: 'laser', x: col * TILE + 11, y: box.top * TILE, w: 8, h: (box.bottom - box.top) * TILE, period, on: Math.floor(period * 0.4), phase: rng.int(0, 239), dir: 1 });
    },
  },
  {
    id: 'saw', weight: ctx => 1.5 + ctx.difficulty,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && Math.min(ctx.nodes[i].row, ctx.nodes[i - 1].row) > 3,
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const row = Math.min(box.prev.row, box.node.row) - rng.int(1, 3);
      const vertical = rng.chance(0.4) && (row + 2) * TILE + 26 <= corridorTop(ctx);
      const span = (box.col1 - box.col0) * TILE - 26;
      const saw = vertical
        ? { x: box.col0 * TILE + rng.int(0, Math.max(0, span)), y: (row - 2) * TILE, dx: 0, dy: 4 * TILE }
        : { x: box.col0 * TILE, y: row * TILE, dx: span, dy: 0 };
      carveOver(ctx, box, row, 2);
      addObject(level, { type: 'saw', w: 26, h: 26, period: tempoOf(ctx), phase: rng.int(0, 239), ...saw });
    },
  },
  {
    id: 'gate', weight: ctx => 1.5 + ctx.difficulty,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 2 && ctx.nodes[i].gap >= 2,
    apply: (ctx, i) => {
      const node = ctx.nodes[i];
      const height = barrierHeight(ctx, node);
      const period = tempoOf(ctx);
      const edge = node.dir > 0 ? node.col * TILE : (node.col + node.w) * TILE;
      node.reserved = true;
      addObject(ctx.level, { type: 'gate', x: edge - 6, y: (node.row - height) * TILE, w: 12, h: height * TILE, period, on: Math.floor(period * (0.65 + 0.1 * ctx.difficulty)), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    id: 'gravpad', weight: () => 2,
    allowed: (ctx, i) => ctx.cave && plainNode(ctx, i) && i + 1 < ctx.nodes.length && plainNode(ctx, i + 1) && gravityFixed(ctx) && ctx.nodes[i].gap <= 3 && ctx.nodes[i + 1].gap <= 3,
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
    id: 'gust', weight: () => 1.5,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && ctx.rules.airAccel > 0,
    apply: (ctx, i) => {
      const box = gapBox(ctx, i);
      const top = Math.max(0, Math.min(box.prev.row, box.node.row) - 5);
      addObject(ctx.level, { type: 'wind', x: box.col0 * TILE, y: top * TILE, w: (box.col1 - box.col0) * TILE, h: (box.bottom - top) * TILE, ax: -box.node.dir * ctx.rng.float(0.18, 0.3), ay: 0 });
    },
  },
  {
    id: 'pool', weight: () => 2,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && !ctx.cave && gravityFixed(ctx) && !ctx.rules.flood && !ctx.rules.fallDamage && ctx.nodes[i].row > POOL_DEPTH + 3 && Math.max(ctx.nodes[i].row, ctx.nodes[i - 1].row) + POOL_DEPTH + SHOP_ROWS < ctx.level.rows - 1,
    apply: (ctx, i) => {
      const box = gapBox(ctx, i);
      const surface = Math.max(box.prev.row, box.node.row), floor = surface + POOL_DEPTH;
      box.prev.reserved = true;
      box.node.reserved = true;
      fillTiles(ctx.level, box.col0 - 1, surface + 1, box.col1 - box.col0 + 2, POOL_DEPTH, SOLID);
      fillTiles(ctx.level, box.col0, surface, box.col1 - box.col0, POOL_DEPTH, EMPTY);
      ctx.clearings.push({ col: box.col0 - 1, row: floor, w: box.col1 - box.col0 + 2, span: POOL_DEPTH + 1 });
      addObject(ctx.level, { type: 'water', x: box.col0 * TILE, y: surface * TILE, w: (box.col1 - box.col0) * TILE, h: POOL_DEPTH * TILE });
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

const MONSTER_W = 22, MONSTER_H = 20;

const MONSTERS = [
  {
    kind: 'patroller', weight: 4,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 3 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const node = ctx.nodes[i], speed = ctx.rng.float(0.6, 1.1);
      const dx = node.w * TILE - MONSTER_W - 4;
      node.reserved = true;
      addObject(ctx.level, { type: 'monster', kind: 'patroller', x: node.col * TILE + 2, y: node.row * TILE - MONSTER_H, w: MONSTER_W, h: MONSTER_H, dx, dy: 0, period: 2 * Math.round(dx / speed), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    kind: 'crawler', weight: 3,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 2 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const node = ctx.nodes[i], size = 14, dx = node.w * TILE + size, dy = node.thick * TILE + size;
      node.reserved = true;
      addObject(ctx.level, { type: 'monster', kind: 'crawler', motion: 'perimeter', x: node.col * TILE - size, y: node.row * TILE - size, w: size, h: size, dx, dy, period: 2 * Math.round((dx + dy) / 1.1), phase: ctx.rng.int(0, 239) });
    },
  },
  {
    kind: 'flapper', weight: 2,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && Math.min(ctx.nodes[i].row, ctx.nodes[i - 1].row) > 4,
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const row = Math.min(box.prev.row, box.node.row) - rng.int(1, 2);
      const span = (box.col1 - box.col0) * TILE - MONSTER_W;
      const path = rng.chance(0.5) && (row + 1) * TILE + MONSTER_H <= corridorTop(ctx)
        ? { x: box.col0 * TILE + rng.int(0, Math.max(0, span)), y: (row - 2) * TILE, dx: 0, dy: 3 * TILE }
        : { x: box.col0 * TILE, y: row * TILE, dx: span, dy: 0 };
      carveOver(ctx, box, row, 2);
      addObject(level, { type: 'monster', kind: 'flapper', w: MONSTER_W, h: MONSTER_H, period: tempoOf(ctx) * 1.5, phase: rng.int(0, 239), ...path });
    },
  },
  {
    kind: 'spitter', weight: 3,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 3 && ctx.nodes[i].gap >= 2 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const node = ctx.nodes[i], dir = -node.dir, col = exitCol(node);
      node.reserved = true;
      const spitter = addObject(ctx.level, { type: 'monster', kind: 'spitter', x: col * TILE + (TILE - MONSTER_W) / 2, y: node.row * TILE - MONSTER_H, w: MONSTER_W, h: MONSTER_H, dir });
      addObject(ctx.level, { type: 'shot', source: spitter.id, x: spitter.x + (dir > 0 ? MONSTER_W : -10), y: node.row * TILE - 22, w: 10, h: 10, dir, speed: 3.5, range: (node.w + node.gap) * TILE, period: ctx.rng.pick([150, 180]), phase: ctx.rng.int(0, 179) });
    },
  },
  {
    kind: 'hopper', weight: 3,
    allowed: (ctx, i) => plainNode(ctx, i) && ctx.nodes[i].w >= 3 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const node = ctx.nodes[i];
      node.reserved = true;
      addObject(ctx.level, { type: 'monster', kind: 'hopper', motion: 'hop', x: node.col * TILE + 2, y: node.row * TILE - MONSTER_H, w: MONSTER_W, h: MONSTER_H, dx: node.w * TILE - MONSTER_W - 4, dy: 0, lift: 2 * TILE, period: tempoOf(ctx) * 2, phase: ctx.rng.int(0, 239) });
    },
  },
  {
    kind: 'urchin', weight: 2,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && Math.min(ctx.nodes[i].row, ctx.nodes[i - 1].row) > 4 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const { rng, level } = ctx;
      const box = gapBox(ctx, i);
      const row = Math.min(box.prev.row, box.node.row) - 1;
      const cx = ((box.col0 + box.col1) / 2) * TILE, reach = Math.min(TILE, ((box.col1 - box.col0) * TILE - MONSTER_W) / 2);
      carveOver(ctx, box, row, 3);
      addObject(level, { type: 'monster', kind: 'urchin', motion: 'orbit', x: cx - MONSTER_W / 2, y: (row - 1) * TILE, w: MONSTER_W, h: MONSTER_H, dx: reach, dy: TILE, period: tempoOf(ctx) * 2, phase: rng.int(0, 239) });
    },
  },
  {
    kind: 'spider', weight: 2,
    allowed: (ctx, i) => plainGap(ctx, i, 1) && ctx.nodes[i - 1].row - ctx.nodes[i].row >= 2 && ctx.nodes[i - 1].row * TILE + TILE + MONSTER_H <= corridorTop(ctx) && gravityFixed(ctx),
    apply: (ctx, i) => {
      const { rng, level, cave } = ctx;
      const node = ctx.nodes[i], prev = ctx.nodes[i - 1];
      const col = node.dir > 0 ? node.col : node.col + node.w - 1;
      if (cave) fillTiles(level, col, node.row + 1, 1, prev.row - node.row + 1, EMPTY);
      addObject(level, { type: 'monster', kind: 'spider', motion: 'drop', x: col * TILE + (TILE - MONSTER_W) / 2, y: (node.row + 1) * TILE, w: MONSTER_W, h: MONSTER_H, dx: 0, dy: (prev.row - node.row) * TILE, period: tempoOf(ctx) * 2, phase: rng.int(0, 239) });
    },
  },
];

const FEATURE_BY_ID = new Map(FEATURES.map(f => [f.id, f]));

export const featureById = id => FEATURE_BY_ID.get(id);

export function placeMonster(ctx) {
  const spots = m => innerNodes(ctx, i => m.allowed(ctx, i));
  const kinds = MONSTERS.map(m => ({ m, at: spots(m) })).filter(k => k.at.length);
  if (!kinds.length) return;
  const { m, at } = ctx.rng.weighted(kinds, k => k.m.weight);
  m.apply(ctx, ctx.rng.pick(at));
}
