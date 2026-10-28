import { Rng, hashString, mix } from './rng.js';
import { MUTATORS, compatible, buildRules, jumpProfile } from './rules.js';
import { TILE, COLS, SOLID, EMPTY, ONE_WAY, createLevel, fillTiles, addObject, levelIndex, overlaps } from './level.js';
import { playerSize, initialState } from './physics.js';
import { solve, solveRoute, replay } from './solver.js';
import { standAt } from './climb.js';
import { FEATURES, clamp, platform, clearAbove, carveBetween, jumpRise } from './features.js';
import { chooseFocus, stagePuzzles } from './focus.js';
import { chooseKind, ledgeSpots, buildLedge, routeThrough } from './items.js';

export const BIOME_SEGMENTS = 4;
export const SEGMENT_ROWS = 18;
const BIOME_ROWS = BIOME_SEGMENTS * SEGMENT_ROWS;
const TOP_ROW = 3;
const BIOME_ATTEMPTS = 4;
const SEGMENT_ATTEMPTS = 6;
const LEG_BUDGET = 4000;
const PHYSICS_LEG_BUDGET = 8000;
const BYPASS_BUDGET = 10000;
const EXCLUDED_MUTATORS = new Set(['ceiling', 'wrap']);
const FAST_TEMPO_FROM = 0.6;
const ITEM_ATTEMPTS = 4;
const ITEM_LEG_BUDGET = 8000;
const TWO_ITEMS_FROM = 4;
const PHYSICAL_TYPES = new Set(['crate', 'hook']);

export function generateBiome(seedText, index, entryCol) {
  const base = mix(hashString(seedText), index * 7919 + 1);
  const entry = entryCol ?? new Rng(base).int(3, COLS - 5);
  for (let attempt = 0; attempt < BIOME_ATTEMPTS; attempt++) {
    const level = buildBiome(new Rng(mix(base, attempt)), index, entry, attempt === BIOME_ATTEMPTS - 1);
    if (level) return level;
  }
  throw new Error(`biome ${index} of ${seedText} could not be generated`);
}

function chooseMutators(rng, index, difficulty) {
  if (index === 0) return [];
  let count = 1;
  if (rng.chance(0.2 + 0.45 * difficulty)) count++;
  if (difficulty > 0.5 && rng.chance(0.35)) count++;
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const pool = MUTATORS.filter(m => !EXCLUDED_MUTATORS.has(m.id) && compatible(chosen, m));
    if (!pool.length) break;
    chosen.push(rng.weighted(pool, m => m.weight));
  }
  return chosen;
}

function physicsHints(level) {
  const index = levelIndex(level);
  return [
    index.crates.length && 'Walk into crates to push them. F lifts and throws.',
    index.hooks.length && 'F in mid-air grabs a hook. Jump lets go.',
  ].filter(Boolean);
}

function buildBiome(rng, index, entryCol, plain) {
  const difficulty = Math.min(1, index / 8);
  const mutators = plain ? [] : chooseMutators(rng, index, difficulty);
  const rules = buildRules(mutators.map(m => m.id));
  if (rules.flood) rules.flood *= 0.6;
  const level = createLevel(rules, mutators.map(m => m.id), BIOME_ROWS);
  level.index = index;
  level.palette = rng.int(0, 359);
  level.theme = rng.int(0, 5);
  level.entryCol = entryCol;

  const style = rng.chance(0.35) ? 'cave' : 'open';
  const size = playerSize(rules);
  const profile = jumpProfile(rules);
  const ctx = {
    level, rng, rules, difficulty, style, cave: style === 'cave', index,
    needsCeiling: rules.flipOnJump || rules.flipPeriod > 0,
    profile, size, rise: jumpRise(rules), nextBit: 1, waypoints: [], placed: [],
  };
  ctx.maxUp = clamp(Math.floor((ctx.rise * 0.8) / TILE), 1, 4);
  ctx.maxGap = clamp(Math.floor((profile.reach * (0.45 + 0.3 * difficulty)) / TILE), 1, 7);
  ctx.clearance = rules.flipOnJump ? (size.h > 30 ? 4 : 3) : clamp(Math.ceil((ctx.rise + size.h) / TILE) + 1, 3, 6);
  level.style = style;
  ctx.focus = chooseFocus(ctx);
  level.focus = ctx.focus.id;
  level.title = [ctx.focus.title, ...mutators.map(m => m.title)].join(' · ');

  const floor = level.rows - 1;
  if (ctx.cave) level.tiles.fill(SOLID);
  sealBounds(level);
  level.start = { x: (entryCol + 1) * TILE - size.w / 2, y: floor * TILE - size.h };
  level.exit = { x: 0, y: -10 * TILE, w: 0, h: 0 };
  let entry = { col: clamp(entryCol - 1, 0, COLS - 4), row: floor, w: 4, dir: entryCol < COLS / 2 ? 1 : -1, kind: 'tiles', thick: 1, reserved: true, exit: true };
  if (ctx.cave) clearAbove(ctx, entry.col, entry.row, entry.w);

  level.segments = [];
  ctx.items = [];
  const itemSegments = new Set(rng.shuffle([0, 1, 2, 3]).slice(0, index >= TWO_ITEMS_FROM ? 2 : 1));
  for (let k = 0; k < BIOME_SEGMENTS; k++) {
    const last = k === BIOME_SEGMENTS - 1;
    entry = buildSegment(ctx, ctx.focus.stages[k], entry, last ? TOP_ROW : entry.row - SEGMENT_ROWS, last);
    if (!entry) return null;
    if (itemSegments.has(k)) placeItem(ctx, k);
  }
  if (!settleChain(level)) return null;
  level.itemProofs = proveItems(ctx);
  level.segments = level.segments.map(({ start, inputs }) => ({ start, inputs }));
  level.solution = level.segments.flatMap(s => s.inputs);
  level.hints = [ctx.focus.hint, ...mutators.map(m => m.hint), ...physicsHints(level)];
  delete level.route;
  return level;
}

function snapshot(ctx) {
  const { level } = ctx;
  return { tiles: level.tiles.slice(), objects: level.objects.length, nextBit: ctx.nextBit, waypoints: ctx.waypoints.length, timed: level.timed };
}

function restore(ctx, saved) {
  const { level } = ctx;
  level.tiles = saved.tiles;
  level.objects.length = saved.objects;
  level.timed = saved.timed;
  ctx.nextBit = saved.nextBit;
  ctx.waypoints.length = saved.waypoints;
}

function buildSegment(ctx, spec, entry, topRow, last) {
  const { level, rng } = ctx;
  ctx.tempo = spec.tempo ?? (ctx.difficulty >= FAST_TEMPO_FROM ? 120 : null);
  for (let attempt = 0; attempt < SEGMENT_ATTEMPTS; attempt++) {
    const saved = snapshot(ctx);
    const simple = attempt === SEGMENT_ATTEMPTS - 1;
    const puzzles = simple ? [] : stagePuzzles(ctx, spec);
    ctx.puzzle = puzzles.length ? rng.pick(puzzles) : null;
    const nodes = layClimb(ctx, { ...entry }, topRow);
    if (!nodes || (puzzles.length && !ctx.puzzle)) { restore(ctx, saved); continue; }
    ctx.nodes = nodes;
    buildNodes(ctx);
    if (ctx.puzzle) ctx.puzzle.apply(ctx);
    if (!simple && !applyStage(ctx, spec.features)) { restore(ctx, saved); continue; }
    ensureTimed(ctx);
    const top = nodes[nodes.length - 1];
    const goal = last ? placeGate(ctx, top) : placeCheckpoint(ctx, top);
    sealBounds(level);
    const added = level.objects.slice(saved.objects);
    const physical = added.some(o => PHYSICAL_TYPES.has(o.type));
    level.segments.push({ route: segmentRoute(ctx, nodes, saved.waypoints), goal, physical, inputs: [], start: null });
    const segment = level.segments[level.segments.length - 1];
    if (settleChain(level) && !(physical && bypassable(level, segment.route, segment.start, goal, added))) {
      ctx.placed.push(...nodes.slice(1));
      segment.nodes = nodes;
      return top;
    }
    level.segments.pop();
    restore(ctx, saved);
  }
  return null;
}

function crowded(nodes, col, row, w) {
  return nodes.some(n => Math.abs(n.row - row) <= 2 && col <= n.col + n.w && col + w >= n.col);
}

function layClimb(ctx, entry, topRow) {
  const { rng, maxUp, maxGap, puzzle } = ctx;
  const nodes = [entry];
  let pocketsLeft = puzzle ? puzzle.pockets : 0;
  let wideLeft = puzzle && puzzle.wideGap ? 1 : 0;
  let { col, row, w, dir } = entry;
  for (let guard = 0; row > topRow && guard < 60; guard++) {
    const remaining = row - topRow;
    const wantWide = wideLeft > 0 && pocketsLeft === 0 && remaining > maxUp && rng.chance(0.5);
    const up = wantWide ? 0 : Math.min(remaining, rng.int(1, maxUp));
    const reach = Math.max(1, Math.floor(maxGap * (1 - up / (maxUp + 1.5))));
    const gap = wantWide ? maxGap + rng.int(3, 4) : rng.int(1, reach);
    const wantPocket = pocketsLeft > 0 && remaining > maxUp + 2 && rng.chance(0.5);
    const nextW = wantPocket ? rng.int(4, 5) : rng.int(2, 4);
    const place = d => d > 0 ? col + w + gap : col - gap - nextW;
    const fits = c => c >= 0 && c + nextW <= COLS;
    let nextCol = place(dir);
    if (!fits(nextCol) || rng.chance(0.15)) { dir = -dir; nextCol = place(dir); }
    const nextRow = row - up;
    if (!fits(nextCol) || crowded([...ctx.placed, ...nodes.slice(0, -1)], nextCol, nextRow, nextW)) continue;
    nodes.push({ col: nextCol, row: nextRow, w: nextW, kind: 'tiles', gap, dir, thick: 1, pocket: wantPocket, wide: wantWide });
    if (wantPocket) pocketsLeft--;
    if (wantWide) wideLeft--;
    col = nextCol;
    row = nextRow;
    w = nextW;
  }
  if (row > topRow) return null;
  const top = nodes[nodes.length - 1];
  top.exit = true;
  if (top.pocket) { top.pocket = false; pocketsLeft++; }
  if (top.w < 3) { top.w = 3; top.col = clamp(top.col, 0, COLS - 3); }
  if (pocketsLeft > 0 || wideLeft > 0) ctx.puzzle = null;
  return nodes;
}

function buildNodes(ctx) {
  const { nodes, cave } = ctx;
  if (cave) {
    for (let i = 1; i < nodes.length; i++) {
      clearAbove(ctx, nodes[i].col, nodes[i].row, nodes[i].w);
      carveBetween(ctx, nodes[i - 1], nodes[i]);
    }
  }
  nodes.forEach(node => platform(ctx, node));
}

function applyStage(ctx, features) {
  const { rng, nodes } = ctx;
  const used = new Set();
  let wanted = 0, placed = 0;
  for (const [id, count] of Object.entries(features)) {
    const feature = FEATURES.find(f => f.id === id);
    for (let n = 0; n < count; n++) {
      wanted++;
      const options = nodes.map((_, i) => i).slice(2).filter(i => !used.has(i) && feature.allowed(ctx, i));
      if (!options.length) continue;
      const i = rng.pick(options);
      feature.apply(ctx, i);
      used.add(i);
      placed++;
    }
  }
  return wanted === 0 || placed > 0;
}

function ensureTimed(ctx) {
  const { rules, level, nodes } = ctx;
  if (!(rules.superhot || rules.slowAir || rules.clockRate > 1) || level.timed) return;
  const i = nodes.findIndex((n, idx) => idx > 1 && n.gap >= 2 && !n.wide);
  const laser = FEATURES.find(f => f.id === 'laser'), phase = FEATURES.find(f => f.id === 'phase');
  if (i > 1) laser.apply(ctx, i);
  else {
    const j = nodes.findIndex((_, idx) => idx > 1 && phase.allowed(ctx, idx));
    if (j > 1) phase.apply(ctx, j);
  }
}

function sealBounds(level) {
  const floor = level.rows - 1;
  fillTiles(level, 0, floor, COLS, 1, SOLID);
  fillTiles(level, level.entryCol, floor, 2, 1, ONE_WAY);
  fillTiles(level, 0, 0, COLS, 1, SOLID);
  if (level.exitCol !== undefined) fillTiles(level, level.exitCol, 0, 2, 1, EMPTY);
}

function placeCheckpoint(ctx, node) {
  return addObject(ctx.level, { type: 'checkpoint', x: (node.col + node.w / 2) * TILE - 12, y: node.row * TILE - 40, w: 24, h: 40 });
}

function placeGate(ctx, node) {
  const { level, rules, size } = ctx;
  const exitCol = clamp(node.col + Math.floor(node.w / 2) - 1, 0, COLS - 2);
  fillTiles(level, exitCol, 0, 2, node.row, EMPTY);
  const vel = Math.sqrt(2 * rules.gravity * (node.row * TILE + size.h + 30));
  addObject(level, { type: 'spring', x: exitCol * TILE + 4, y: node.row * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
  level.exit = { x: exitCol * TILE, y: -TILE, w: 2 * TILE, h: TILE };
  level.exitCol = exitCol;
  return null;
}

function withItemsTaken(level, state) {
  return { ...state, taken: (1 << levelIndex(level).items.length) - 1 };
}

function placeItem(ctx, k) {
  const { level, rng, size } = ctx;
  const segment = level.segments[k];
  const anchors = segment.nodes.slice(1, -1);
  const spots = ledgeSpots(ctx, anchors, (anchor, col, row, w) => crowded(ctx.placed.filter(n => n !== anchor), col, row, w));
  for (const { anchor, ledge } of spots.slice(0, ITEM_ATTEMPTS)) {
    const saved = snapshot(ctx);
    const item = buildLedge(ctx, anchor, ledge, chooseKind(rng));
    sealBounds(level);
    const anchorPoint = segment.route.find(p => p.x === (anchor.col + anchor.w / 2) * TILE && p.y === anchor.row * TILE - size.h / 2);
    const plan = { item, segment: k, route: routeThrough(segment.route, anchorPoint, item), inputs: [] };
    if (settleChain(level) && proveItem(level, plan)) {
      ctx.items.push(plan);
      ctx.placed.push(ledge);
      return;
    }
    restore(ctx, saved);
    settleChain(level);
  }
}

function itemStart(level, plan) {
  const start = level.segments[plan.segment].start;
  return { ...start, taken: start.taken & ~(1 << plan.item.slot) };
}

function proveItem(level, plan) {
  const { w, h } = playerSize(level.rules);
  const start = itemStart(level, plan);
  const goal = level.segments[plan.segment].goal;
  const end = replay(level, plan.inputs, start).at(-1);
  const done = s => (s.taken & (1 << plan.item.slot)) !== 0 && (goal ? overlaps(s.x, s.y, w, h, goal) : s.won);
  if (plan.inputs.length && done(end)) return true;
  const result = solveRoute(level, plan.route, { start, goal, maxNodes: ITEM_LEG_BUDGET });
  if (!result || !done(result.end)) return false;
  plan.inputs = result.inputs;
  return true;
}

function proveItems(ctx) {
  const { level } = ctx;
  return ctx.items.flatMap(plan => {
    if (proveItem(level, plan)) return [{ item: plan.item.id, segment: plan.segment, start: itemStart(level, plan), inputs: plan.inputs }];
    plan.item.type = 'removed';
    return [];
  });
}

function settleChain(level) {
  const { w, h } = playerSize(level.rules);
  let start = withItemsTaken(level, initialState(level));
  for (const segment of level.segments) {
    segment.start = start;
    const reached = segment.goal ? s => overlaps(s.x, s.y, w, h, segment.goal) : s => s.won;
    let end = replay(level, segment.inputs, start).at(-1);
    if (!segment.inputs.length || !reached(end)) {
      const result = solveRoute(level, segment.route, { start, goal: segment.goal, maxNodes: segment.physical ? PHYSICS_LEG_BUDGET : LEG_BUDGET });
      if (!result) return false;
      segment.inputs = result.inputs;
      end = result.end;
    }
    start = segment.goal ? standAt(level, end, segment.goal) : null;
  }
  return true;
}

function segmentRoute(ctx, nodes, firstWaypoint) {
  const route = [];
  const waypoints = ctx.waypoints.slice(firstWaypoint);
  nodes.forEach((node, i) => {
    route.push({ x: (node.col + node.w / 2) * TILE, y: node.row * TILE - ctx.size.h / 2, w: node.w * TILE });
    for (const { after, ...point } of waypoints) if (after === i) route.push(point);
  });
  return route;
}

function bypassable(level, route, begin, goal, added) {
  const removed = new Set(added.filter(o => PHYSICAL_TYPES.has(o.type)));
  const bare = { ...level, objects: level.objects.map(o => o.type === 'hook' && removed.has(o) ? { ...o, type: 'removed' } : o) };
  const bareRoute = route.filter(p => p.body === undefined || p.bit).map(({ body, ...p }) => p);
  const crates = levelIndex(level).crates;
  const start = { ...begin, bodies: begin.bodies.map((b, k) => removed.has(crates[k]) ? { ...b, gone: true } : b) };
  return !!solve(bare, { start, goal, route: bareRoute, maxNodes: BYPASS_BUDGET });
}
