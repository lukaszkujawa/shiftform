import { TILE, COLS, ROWS, SOLID, EMPTY, ONE_WAY, SPRING_VEL, CRATE_SIZE, HOOK_REACH, createLevel, fillTiles, setTile, addObject } from './level.js?v=ea2fce6';
import { step, initialState, playerSize } from './physics.js?v=ea2fce6';
import { THROW_VY } from './bodies.js?v=ea2fce6';
import { chargedProfile, CHARGE_FRAMES, SPEED_BONUS, CHARGE_GATE } from './rules.js?v=ea2fce6';

const SPRINT_MARGIN = 0.8;
const LEDGE_WIDTH = 2;
export const GUARDS = ['laser', 'saw', 'crumble'];
const NOOK_GUARDS = ['laser', 'saw'];
const NOOK_REACH = 6;
const UPDRAFT_LIFT = 0.18;
const POOL_DEPTH = 3;
const BUMPER_REACH = 8;

export function sprintPlan(ctx) {
  const { rules, profile } = ctx;
  if (!rules.flywheel) return null;
  const tilesAt = charge => Math.floor((chargedProfile(rules, charge).reach * SPRINT_MARGIN) / TILE);
  const min = Math.ceil(profile.reach / TILE) + 1;
  const max = tilesAt(1);
  const chargeFor = gap => {
    let charge = 0.1;
    while (charge < 1 && tilesAt(charge) < gap) charge += 0.1;
    return Math.min(1, charge);
  };
  const runUpFor = gap => {
    const charge = chargeFor(gap);
    const boosted = Math.max(0, charge - CHARGE_GATE);
    const distance = CHARGE_FRAMES * rules.moveSpeed * (charge + (SPEED_BONUS * boosted * boosted) / (2 * (1 - CHARGE_GATE)));
    return Math.ceil(distance / TILE) + 2;
  };
  return max >= min ? { min, max, runUpFor } : null;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function platform(ctx, node, tile = SOLID) {
  fillTiles(ctx.level, node.col, node.row, node.w, node.thick, tile);
}

export function jumpRise(rules) {
  const level = createLevel({ ...rules, baseGravDir: 1, flipPeriod: 0, flood: 0 }, []);
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

function raiseNode(ctx, i, lift) {
  const { nodes, cave } = ctx;
  const prev = nodes[i - 1], node = nodes[i];
  erase(ctx, node);
  node.row = Math.max(2, node.row - lift);
  node.lifted = true;
  platform(ctx, node);
  if (cave) {
    clearAbove(ctx, node.col, node.row, node.w);
    carveBetween(ctx, prev, node);
  }
}

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
  FEATURES.find(f => f.id === guardId).apply({ ...ctx, nodes: [anchor, ledge] }, 1);
  redrawPlatforms(ctx);
}

export function redrawPlatforms(ctx) {
  if (!ctx.cave) return;
  for (const node of [...ctx.placed, ...ctx.clearings, ...ctx.nodes]) if (node.kind === 'tiles') platform(ctx, node);
}

function waypoint(ctx, after, point) {
  ctx.waypoints.push({ after, ...point });
}

function pickupOn(ctx, type, node, bit) {
  const others = [...ctx.placed, ...ctx.clearings, ...ctx.nodes.filter(n => n !== node)];
  const [spot] = ledgeSpots(ctx, [node], (_, col, row, w) => crowded(others, col, row, w));
  if (!spot) return null;
  const { ledge } = spot;
  guardedLedge(ctx, node, ledge);
  ctx.clearings.push(ledge);
  node.reserved = true;
  const i = ctx.nodes.indexOf(node);
  const pickup = addObject(ctx.level, { type, x: (ledge.col + 1) * TILE - 8, y: (ledge.row - 1) * TILE + 6, w: 16, h: 18, bit });
  waypoint(ctx, i, { x: pickup.x + pickup.w / 2, y: pickup.y + pickup.h / 2, bit });
  waypoint(ctx, i, { x: (node.col + node.w / 2) * TILE, y: node.row * TILE - ctx.size.h / 2, w: node.w * TILE });
  return pickup;
}

const range = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => lo + k);

function crateOn(ctx, col, row, kind) {
  return addObject(ctx.level, { type: 'crate', kind, x: col * TILE + (TILE - CRATE_SIZE) / 2, y: row * TILE - CRATE_SIZE, w: CRATE_SIZE, h: CRATE_SIZE });
}

const sideCol = (node, side) => side > 0 ? node.col + node.w - 1 : node.col;

function nookSides(ctx, node) {
  const next = ctx.nodes[ctx.nodes.indexOf(node) + 1];
  const free = side => side !== -node.dir && side !== next.dir;
  return [-next.dir, next.dir].map(side => ({ side, free: free(side) })).sort((a, b) => b.free - a.free);
}

const clashes = (others, col, row0, row1, w) => others.some(n => n.col < col + w + 1 && n.col + n.w > col - 1 && n.row >= row0 - 1 && n.row <= row1 + 1);

function nookSpot(ctx, anchors, spots, w, near = () => true) {
  for (const anchor of anchors) {
    const others = [...ctx.placed, ...ctx.clearings, ...ctx.nodes.filter(n => n !== anchor)];
    for (const { side, free } of nookSides(ctx, anchor)) {
      for (const [rise, gap] of ctx.rng.shuffle(spots)) {
        const col = side > 0 ? anchor.col + anchor.w + gap : anchor.col - gap - w;
        const row = anchor.row - rise;
        if (col < 0 || col + w > COLS || row < 2 || row >= ctx.level.rows - 1 || crowded(others, col, row, w) || clashes(others, col, row - 2, row - 1, w) || !near(col, w)) continue;
        return { anchor, free, ledge: { col, row, w, gap, dir: side, kind: 'tiles', thick: 1 } };
      }
    }
  }
  return null;
}

function fetchFrom(ctx, { anchor, ledge }, kind) {
  ctx.clearings.push(ledge);
  anchor.reserved = true;
  const crate = crateOn(ctx, sideCol(ledge, ledge.dir), ledge.row, kind);
  waypoint(ctx, ctx.nodes.indexOf(anchor), { x: crate.x + CRATE_SIZE / 2, y: crate.y + CRATE_SIZE / 2, fetch: crate.slot });
  return crate;
}

const climbBackGap = (ctx, rise) => Math.max(2, Math.floor(ctx.maxGap * (1 - rise / (ctx.maxUp + 1.5))));

function nookBelow(ctx, node) {
  const i = ctx.nodes.indexOf(node);
  const anchors = ctx.nodes.slice(Math.max(1, i - 2), i + 1).reverse();
  const spots = range(2, ctx.maxUp).flatMap(down => range(2, climbBackGap(ctx, down)).map(gap => [-down, gap]));
  const near = (col, w) => Math.max(col - node.col - node.w, node.col - col - w) <= NOOK_REACH;
  const spot = nookSpot(ctx, anchors, spots, LEDGE_WIDTH, near);
  if (!spot) return null;
  if (spot.free) guardedLedge(ctx, spot.anchor, spot.ledge, NOOK_GUARDS);
  else openLedge(ctx, spot.anchor, spot.ledge);
  return fetchFrom(ctx, spot, 'wood');
}

function nookAbove(ctx, node, kind) {
  const spot = nookSpot(ctx, [node], range(2, ctx.maxUp).map(up => [up, 0]), LEDGE_WIDTH);
  if (!spot) return null;
  const { ledge } = spot;
  if (ctx.cave) {
    clearAbove(ctx, ledge.col, ledge.row, ledge.w);
    fillTiles(ctx.level, ledge.col, ledge.row + 1, ledge.w, node.row - ledge.row - 1, EMPTY);
  }
  platform(ctx, ledge);
  return fetchFrom(ctx, spot, kind);
}

function crateGoal(ctx, node, crate, col, height = 0) {
  const x = (col + 0.5) * TILE;
  return { x: x - node.dir * TILE, y: node.row * TILE - ctx.size.h / 2, body: crate.slot, tx: x, ty: node.row * TILE - CRATE_SIZE * (height + 0.5) };
}

function plateOn(ctx, node, bit, crate) {
  if (!crate) return null;
  node.reserved = true;
  const col = exitCol(node);
  const plate = addObject(ctx.level, { type: 'plate', x: col * TILE + 2, y: node.row * TILE - 6, w: TILE - 4, h: 6, bit });
  waypoint(ctx, ctx.nodes.indexOf(node), crateGoal(ctx, node, crate, col));
  return plate;
}

const LIFT_ROWS = 3;

function springBay(ctx, node) {
  const others = [...ctx.placed, ...ctx.clearings, ...ctx.nodes.filter(n => n !== node)];
  const shelfRow = node.row - LIFT_ROWS;
  for (const { side } of nookSides(ctx, node)) {
    const inner = sideCol(node, side) + side, spring = inner + side;
    const col = Math.min(inner, spring + side);
    if (col < 0 || col + 3 > COLS || shelfRow < 2 || clashes(others, col, shelfRow, node.row, 3)) continue;
    return { side, inner, spring, col, shelfRow };
  }
  return null;
}

function bridgeWideGap(ctx, bit) {
  const box = gapBox(ctx, ctx.nodes.findIndex(n => n.wide));
  const row = Math.max(box.prev.row, box.node.row);
  if (ctx.cave) fillTiles(ctx.level, box.col0, row - ctx.clearance, box.col1 - box.col0, ctx.clearance + 1, EMPTY);
  addObject(ctx.level, { type: 'toggle', on: true, bit, x: box.col0 * TILE, y: row * TILE, w: (box.col1 - box.col0) * TILE, h: TILE });
}

function hookOver(ctx, i) {
  const box = gapBox(ctx, i);
  const length = ctx.rng.int(3, 4) * TILE;
  const x = ((box.col0 + box.col1) / 2) * TILE;
  const y = Math.max(TILE / 2, Math.min(box.prev.row, box.node.row) * TILE - length);
  addObject(ctx.level, { type: 'hook', x: x - 6, y: y - 6, w: 12, h: 12, reach: HOOK_REACH });
  waypoint(ctx, i - 1, { x, y: y + length, rope: true });
}

const tempoOf = ctx => ctx.tempo ?? ctx.rng.pick([120, 240]);

const steppable = ctx => ctx.rules.jumps === 1 && !ctx.rules.wallJump && !ctx.rules.blinkJump && !ctx.needsCeiling;
const stepRows = ctx => Math.ceil((ctx.rise + 4) / TILE);
const throwRows = ctx => Math.ceil((ctx.rise + CRATE_SIZE + 6) / TILE);
const stackRows = ctx => Math.ceil((ctx.rise + CRATE_SIZE + 4) / TILE);
const throwRise = ctx => (THROW_VY * THROW_VY) / (2 * ctx.rules.gravity);

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
  const top = Math.max(0, Math.min(prev.row, node.row) - ctx.clearance);
  const bottom = Math.max(prev.row, node.row) + 1;
  return { col0, col1, top, bottom, prev, node };
};

export const PUZZLES = [
  {
    id: 'keyDoor', weight: 3, pockets: 1,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      if (!pickupOn(ctx, 'key', node, bit)) return false;
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'door', bit });
    },
  },
  {
    id: 'switchWall', weight: 2, pockets: 1,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      if (!pickupOn(ctx, 'switch', node, bit)) return false;
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'toggle', on: false, bit });
    },
  },
  {
    id: 'switchBridge', weight: 3, pockets: 1, wideGap: true,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const bit = allocBit(ctx);
      if (!pickupOn(ctx, 'switch', node, bit)) return false;
      bridgeWideGap(ctx, bit);
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
  {
    id: 'fetchBelow', lowNook: true, raisesNext: true, weight: 4, pockets: 1,
    allowed: ctx => steppable(ctx) && ctx.maxUp >= 2 && stepRows(ctx) * TILE <= ctx.rise + CRATE_SIZE - 4,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const i = ctx.nodes.indexOf(node);
      raiseNode(ctx, i + 1, ctx.nodes[i + 1].row - node.row + stepRows(ctx));
      const crate = nookBelow(ctx, node);
      if (!crate) return false;
      waypoint(ctx, i, crateGoal(ctx, node, crate, exitCol(node)));
    },
  },
  {
    id: 'fetchAbove', weight: 4, pockets: 1,
    allowed: ctx => !ctx.needsCeiling && ctx.maxUp >= 2,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const plate = plateOn(ctx, node, allocBit(ctx), nookAbove(ctx, node, ctx.rng.pick(['wood', 'steel'])));
      if (!plate) return false;
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'door', bit: plate.bit, plate: true });
    },
  },
  {
    id: 'stackStep', lowNook: true, raisesNext: true, weight: 4, pockets: 1,
    allowed: ctx => steppable(ctx) && ctx.maxUp >= 2 && stackRows(ctx) * TILE <= ctx.rise + 2 * CRATE_SIZE - 4,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const i = ctx.nodes.indexOf(node), col = exitCol(node);
      raiseNode(ctx, i + 1, ctx.nodes[i + 1].row - node.row + stackRows(ctx));
      const base = crateOn(ctx, col, node.row, 'wood');
      waypoint(ctx, i, crateGoal(ctx, node, base, col));
      const top = nookBelow(ctx, node);
      if (!top) return false;
      waypoint(ctx, i, crateGoal(ctx, node, top, col, 1));
    },
  },
  {
    id: 'springLift', weight: 4, pockets: 1,
    allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY,
    apply: ctx => {
      const { level, rules } = ctx;
      const [node] = pocketNodes(ctx);
      const bay = springBay(ctx, node);
      if (!bay) return false;
      const bit = allocBit(ctx);
      node.reserved = true;
      ctx.clearings.push({ col: bay.col, row: node.row, w: 3, span: LIFT_ROWS });
      if (ctx.cave) fillTiles(level, bay.col, bay.shelfRow - ctx.clearance, 3, node.row - bay.shelfRow + ctx.clearance, EMPTY);
      fillTiles(level, Math.min(bay.inner, bay.spring), node.row, 2, 1, SOLID);
      fillTiles(level, bay.col, bay.shelfRow, 3, 1, ONE_WAY);
      const vel = Math.sqrt(4 * rules.gravity * (LIFT_ROWS + 1) * TILE);
      addObject(level, { type: 'spring', x: bay.spring * TILE + 4, y: node.row * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
      addObject(level, { type: 'plate', x: bay.spring * TILE + 2, y: bay.shelfRow * TILE - 6, w: TILE - 4, h: 6, bit });
      const crate = crateOn(ctx, sideCol(node, bay.side) - bay.side, node.row, 'steel');
      const x = (bay.spring + 0.5) * TILE;
      waypoint(ctx, ctx.nodes.indexOf(node), { x: x - 2 * bay.side * TILE, y: node.row * TILE - ctx.size.h / 2, body: crate.slot, tx: x, ty: bay.shelfRow * TILE - CRATE_SIZE / 2, within: TILE });
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'door', bit, plate: true });
    },
  },
  {
    id: 'plateDoor', lowNook: true, weight: 4, pockets: 1,
    allowed: ctx => !ctx.needsCeiling && ctx.maxUp >= 2,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const plate = plateOn(ctx, node, allocBit(ctx), nookBelow(ctx, node));
      if (!plate) return false;
      barrierOn(ctx, barrierTarget(ctx, node), { type: 'door', bit: plate.bit, plate: true });
    },
  },
  {
    id: 'plateBridge', lowNook: true, weight: 3, pockets: 1, wideGap: true,
    allowed: ctx => !ctx.needsCeiling && ctx.maxUp >= 2,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const plate = plateOn(ctx, node, allocBit(ctx), nookBelow(ctx, node));
      if (!plate) return false;
      bridgeWideGap(ctx, plate.bit);
    },
  },
  {
    id: 'throwSwitch', weight: 3, pockets: 1, openOnly: true,
    allowed: ctx => steppable(ctx) && throwRows(ctx) * TILE <= ctx.rise + ctx.size.h + throwRise(ctx) * 0.6,
    apply: ctx => {
      const [node] = pocketNodes(ctx);
      const i = ctx.nodes.indexOf(node);
      const bit = allocBit(ctx);
      node.reserved = true;
      const col = node.dir > 0 ? exitCol(node) - 1 : exitCol(node);
      const row = Math.max(1, node.row - throwRows(ctx));
      fillTiles(ctx.level, col, row, 2, 1, SOLID);
      const target = addObject(ctx.level, { type: 'switch', x: col * TILE + TILE - 8, y: (row - 1) * TILE + 6, w: 16, h: 18, bit });
      const crate = crateOn(ctx, entryCol(node) + node.dir, node.row, 'wood');
      waypoint(ctx, i, { x: (entryCol(node) + 0.5) * TILE, y: node.row * TILE - ctx.size.h / 2, bit, body: crate.slot, tx: target.x + target.w / 2, ty: target.y + target.h / 2 });
      barrierOn(ctx, ctx.nodes[i + 1], { type: 'toggle', on: false, bit });
    },
  },
  {
    id: 'swing', weight: 2.5, pockets: 0, wideGap: true, openOnly: true,
    apply: ctx => hookOver(ctx, ctx.nodes.findIndex(n => n.wide)),
  },
  {
    id: 'bumperGap', weight: 3, pockets: 0, wideGap: true,
    allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY && ctx.maxGap <= BUMPER_REACH - 3,
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

const plainNode = (ctx, i) => {
  const node = ctx.nodes[i];
  return node.kind === 'tiles' && !node.exit && !node.reserved && !node.pocket && !node.connector;
};

const plainGap = (ctx, i, min) => ctx.nodes[i].gap >= min && !ctx.nodes[i].wide && !ctx.nodes[i].connector && !ctx.nodes[i].sprint;

function springLift(ctx) {
  const height = (SPRING_VEL * SPRING_VEL) / (2 * ctx.rules.gravity);
  return clamp(Math.floor((height * 0.8) / TILE), 0, 6);
}

const gravityFixed = ctx => !ctx.needsCeiling && !ctx.rules.blinkJump && ctx.rules.baseGravDir > 0;

const CONNECTORS = [
  { type: 'climb', allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY, gap: () => 0 },
  { type: 'bounce', allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY && ctx.rules.airAccel >= 0.3, gap: rng => rng.int(1, 2) },
  { type: 'updraft', allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY && ctx.rules.airAccel >= 0.3 && !ctx.rules.flood, gap: rng => rng.int(2, 3) },
  { type: 'swim', allowed: ctx => gravityFixed(ctx) && !ctx.rules.wrapY && !ctx.rules.flood && !ctx.rules.fallDamage, gap: () => 1 },
];

function flightBlocked(blocked, base, top, bottom) {
  for (let r = bottom - 3; r > top - 3; r -= 4) if (blocked(base - 1, r, 3)) return true;
  return blocked(base - 1, top - 3, 3);
}

export function layConnector(ctx, from, remaining, blocked) {
  const { rng, maxUp } = ctx;
  const kinds = CONNECTORS.filter(k => k.allowed(ctx));
  if (!kinds.length || remaining < maxUp + 2) return null;
  const kind = kinds.find(k => k.type === ctx.connectorKind) ?? rng.pick(kinds);
  const up = Math.min(remaining, rng.int(maxUp + 2, maxUp + 5));
  const w = rng.int(3, 4), gap = kind.gap(rng), row = from.row - up;
  for (const dir of [from.dir, -from.dir]) {
    const base = dir > 0 ? from.col + from.w - 1 : from.col;
    const col = dir > 0 ? base + 1 + gap : base - gap - w;
    const flies = kind.type === 'bounce' || kind.type === 'updraft';
    if (col < 0 || col + w > COLS || blocked(col, row, w) || (flies && flightBlocked(blocked, base, row, from.row))) continue;
    from.reserved = true;
    const flight = flies ? { col: base - 1, row: from.row, w: 3, span: up + 3, kind: 'air' } : null;
    return { col, row, w, kind: 'tiles', gap, dir, thick: 1, connector: { type: kind.type, base, from: from.row }, flight };
  }
  return null;
}

export function buildConnector(ctx, node) {
  const { type, base, from } = node.connector;
  const col0 = node.dir > 0 ? base + 1 : node.col + node.w, col1 = node.dir > 0 ? node.col : base;
  if (type === 'climb') {
    addObject(ctx.level, { type: 'climb', x: base * TILE + 5, y: node.row * TILE, w: TILE - 10, h: (from - node.row) * TILE });
  } else if (type === 'updraft') {
    if (ctx.cave) fillTiles(ctx.level, col0, node.row - ctx.clearance, col1 - col0, from - node.row + ctx.clearance + 1, EMPTY);
    addObject(ctx.level, { type: 'wind', x: col0 * TILE, y: (node.row - 2) * TILE, w: (col1 - col0) * TILE, h: (from - node.row + 3) * TILE, ax: 0, ay: -(ctx.rules.gravity + UPDRAFT_LIFT) });
  } else if (type === 'swim') {
    if (ctx.cave) fillTiles(ctx.level, col0, node.row - ctx.clearance, col1 - col0, from - node.row + ctx.clearance + 1, EMPTY);
    fillTiles(ctx.level, col0, from + 1, col1 - col0, 1, SOLID);
    addObject(ctx.level, { type: 'water', x: col0 * TILE, y: node.row * TILE, w: (col1 - col0) * TILE, h: (from - node.row + 1) * TILE });
  } else {
    const vel = Math.sqrt(2 * ctx.rules.gravity * ((from - node.row) * TILE + ctx.size.h + 24));
    addObject(ctx.level, { type: 'spring', x: base * TILE + 4, y: from * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
  }
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
      const { rng, level, cave } = ctx;
      const box = gapBox(ctx, i);
      const vertical = rng.chance(0.4);
      const row = Math.min(box.prev.row, box.node.row) - rng.int(1, 3);
      const span = (box.col1 - box.col0) * TILE - 26;
      const saw = vertical
        ? { x: box.col0 * TILE + rng.int(0, Math.max(0, span)), y: (row - 2) * TILE, dx: 0, dy: 4 * TILE }
        : { x: box.col0 * TILE, y: row * TILE, dx: span, dy: 0 };
      if (cave) fillTiles(level, box.col0, row - 2, box.col1 - box.col0, Math.max(box.prev.row, box.node.row) - row + 3, EMPTY);
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
    allowed: (ctx, i) => plainGap(ctx, i, 2) && !ctx.cave && gravityFixed(ctx) && !ctx.rules.flood && !ctx.rules.fallDamage && ctx.nodes[i].row > POOL_DEPTH + 3,
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

export const MONSTERS = [
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
    kind: 'flapper', weight: 2,
    allowed: (ctx, i) => plainGap(ctx, i, 2) && Math.min(ctx.nodes[i].row, ctx.nodes[i - 1].row) > 4 && !ctx.rules.blinkJump,
    apply: (ctx, i) => {
      const { rng, level, cave } = ctx;
      const box = gapBox(ctx, i);
      const row = Math.min(box.prev.row, box.node.row) - rng.int(1, 2);
      const span = (box.col1 - box.col0) * TILE - MONSTER_W;
      const path = rng.chance(0.5)
        ? { x: box.col0 * TILE + rng.int(0, Math.max(0, span)), y: (row - 2) * TILE, dx: 0, dy: 3 * TILE }
        : { x: box.col0 * TILE, y: row * TILE, dx: span, dy: 0 };
      if (cave) fillTiles(level, box.col0, row - 2, box.col1 - box.col0, Math.max(box.prev.row, box.node.row) - row + 3, EMPTY);
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
      const { rng, level, cave } = ctx;
      const box = gapBox(ctx, i);
      const row = Math.min(box.prev.row, box.node.row) - 1;
      const cx = ((box.col0 + box.col1) / 2) * TILE, reach = Math.min(TILE, ((box.col1 - box.col0) * TILE - MONSTER_W) / 2);
      if (cave) fillTiles(level, box.col0, row - 3, box.col1 - box.col0, Math.max(box.prev.row, box.node.row) - row + 4, EMPTY);
      addObject(level, { type: 'monster', kind: 'urchin', motion: 'orbit', x: cx - MONSTER_W / 2, y: (row - 1) * TILE, w: MONSTER_W, h: MONSTER_H, dx: reach, dy: TILE, period: tempoOf(ctx) * 2, phase: rng.int(0, 239) });
    },
  },
  {
    kind: 'spider', weight: 2,
    allowed: (ctx, i) => plainGap(ctx, i, 1) && ctx.nodes[i - 1].row - ctx.nodes[i].row >= 2 && gravityFixed(ctx),
    apply: (ctx, i) => {
      const { rng, level, cave } = ctx;
      const node = ctx.nodes[i], prev = ctx.nodes[i - 1];
      const col = node.dir > 0 ? node.col : node.col + node.w - 1;
      if (cave) fillTiles(level, col, node.row + 1, 1, prev.row - node.row + 1, EMPTY);
      addObject(level, { type: 'monster', kind: 'spider', motion: 'drop', x: col * TILE + (TILE - MONSTER_W) / 2, y: (node.row + 1) * TILE, w: MONSTER_W, h: MONSTER_H, dx: 0, dy: (prev.row - node.row) * TILE, period: tempoOf(ctx) * 2, phase: rng.int(0, 239) });
    },
  },
];

export function placeMonster(ctx) {
  const spots = m => ctx.nodes.map((_, i) => i).slice(2).filter(i => m.allowed(ctx, i));
  const kinds = MONSTERS.map(m => ({ m, at: spots(m) })).filter(k => k.at.length);
  if (!kinds.length) return;
  const { m, at } = ctx.rng.weighted(kinds, k => k.m.weight);
  m.apply(ctx, ctx.rng.pick(at));
}
