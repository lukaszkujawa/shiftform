import { Rng, hashString, mix } from './rng.js?v=129676c';
import { buildRules, playRules, jumpProfile, biomeRules, isBane } from './rules.js?v=129676c';
import { TILE, COLS, SOLID, EMPTY, ONE_WAY, createLevel, fillTiles, addObject, levelIndex } from './level.js?v=129676c';
import { playerSize, initialState } from './physics.js?v=129676c';
import { solve, solveRoute, replay, kicked, reachedBy } from './solver.js?v=129676c';
import { standAt } from './climb.js?v=129676c';
import { MOUTH } from './tunnel.js?v=129676c';
import { featureById, occupied, innerNodes, clamp, platform, clearAbove, carveBetween, jumpRise, crowded, ledgeSpots, layConnector, buildConnector, redrawPlatforms, placeMonster } from './features.js?v=129676c';
import { chooseFocus, stagePuzzles } from './focus.js?v=129676c';
import { THEMES } from './themes.js?v=129676c';
import { chooseKind, buildLedge, routeThrough } from './items.js?v=129676c';

const BIOME_SEGMENTS = 4;
const SEGMENT_ROWS = 18;
const BIOME_ROWS = BIOME_SEGMENTS * SEGMENT_ROWS;
const TOP_ROW = 3;
const FULL_ATTEMPTS = 3;
const PLAIN_ATTEMPTS = 6;
const SLIPPERY_ACCEL = 0.3;
const SLIPPERY_REACH = 0.7;
const SEGMENT_ATTEMPTS = 6;
const LEG_BUDGET = 4000;
const PHYSICS_LEG_BUDGET = 10000;
const BYPASS_BUDGET = 10000;
const FAST_TEMPO_FROM = 0.6;
const ITEM_ATTEMPTS = 4;
const ITEM_LEG_BUDGET = 8000;
const TWO_ITEMS_FROM = 4;
const PHYSICAL_TYPES = new Set(['crate', 'hook']);
const CONNECTOR_CHANCE = 0.3;
const MONSTER_CHANCE = 0.15;
const MONSTER_CHANCE_GROWTH = 0.3;
const COINS_PER_STRETCH = 3;
const MAX_COINS = 28;
const STRETCH_SHARE = 0.85;

export function generateBiome(seedText, index, entryCol, forcedMutators = null, forcedFocus = null, report = () => {}) {
  const base = mix(hashString(seedText), index * 7919 + 1);
  const entry = entryCol ?? new Rng(base).int(3, COLS - 5);
  const mutators = forcedMutators ?? biomeRules(seedText, index);
  const plans = [...Array(FULL_ATTEMPTS).fill(mutators), mutators.filter(id => !isBane(id)), ...Array(PLAIN_ATTEMPTS).fill([])];
  for (const [attempt, rules] of plans.entries()) {
    if (attempt > 0) report(0, 'starting over with a fresh plan');
    const level = buildBiome(new Rng(mix(base, attempt)), index, entry, rules, forcedFocus, report);
    if (level) return level;
  }
  throw new Error(`biome ${index} of ${seedText} could not be generated`);
}

function buildBiome(rng, index, entryCol, mutators, forcedFocus, report) {
  const difficulty = Math.min(1, index / 8);
  const rules = playRules(mutators);
  const world = buildRules(mutators.filter(isBane));
  const level = createLevel(rules, mutators, BIOME_ROWS);
  level.index = index;
  level.palette = rng.int(0, 359);
  level.theme = rng.int(0, THEMES.length - 1);
  level.entryCol = entryCol;

  const style = rng.chance(0.35) ? 'cave' : 'open';
  const size = playerSize(rules);
  const profile = jumpProfile(rules);
  const ctx = {
    level, rng, rules, difficulty, style, cave: style === 'cave', index,
    needsCeiling: rules.flipChance > 0 || rules.jumpFlipChance > 0,
    profile, size, rise: jumpRise(rules), nextBit: 1, waypoints: [], placed: [], report,
  };
  const worldRise = Math.min(ctx.rise, jumpRise(world)), worldReach = Math.min(profile.reach, jumpProfile(world).reach);
  ctx.slippery = rules.airAccel < SLIPPERY_ACCEL || rules.groundAccel < SLIPPERY_ACCEL;
  ctx.maxUp = clamp(Math.floor((worldRise * (rules.blinkJump ? 1 : 0.8)) / TILE), 1, 4);
  ctx.maxGap = clamp(Math.floor((worldReach * (0.45 + 0.3 * difficulty) * (ctx.slippery ? SLIPPERY_REACH : 1)) / TILE), 1, 7);
  ctx.clearance = ctx.needsCeiling ? (size.h > 30 ? 4 : 3) : clamp(Math.ceil((ctx.rise + size.h) / TILE) + 1, 3, 6);
  level.style = style;
  ctx.focus = chooseFocus(ctx, forcedFocus);
  level.focus = ctx.focus.id;
  level.title = ctx.focus.title;

  const floor = level.rows - 1;
  if (ctx.cave) level.tiles.fill(SOLID);
  sealBounds(level);
  level.start = { x: (entryCol + 1) * TILE - size.w / 2, y: floor * TILE - size.h };
  level.exit = { x: 0, y: -10 * TILE, w: 0, h: 0 };
  let entry = { col: clamp(entryCol - 1, 0, COLS - 4), row: floor, w: 4, dir: entryCol < COLS / 2 ? 1 : -1, kind: 'tiles', thick: 1, reserved: true, exit: true };
  if (ctx.cave) clearAbove(ctx, entry.col, entry.row, entry.w);
  digTunnel(ctx, floor);

  level.segments = [];
  ctx.items = [];
  ctx.clearings = [];
  const itemSegments = new Set(rng.shuffle([0, 1, 2, 3]).slice(0, index >= TWO_ITEMS_FROM ? 2 : 1));
  for (let k = 0; k < BIOME_SEGMENTS; k++) {
    const last = k === BIOME_SEGMENTS - 1;
    entry = buildSegment(ctx, ctx.focus.stages[k], entry, last ? TOP_ROW : entry.row - SEGMENT_ROWS, last);
    if (!entry) return null;
    if (itemSegments.has(k)) {
      report(((k + 1) / BIOME_SEGMENTS) * STRETCH_SHARE, 'hiding an item off the route');
      placeItem(ctx, k);
    }
  }
  report(STRETCH_SHARE, 'replaying the whole climb');
  if (!settleChain(level)) return null;
  scatterCoins(ctx);
  report(0.95, 'proving every item can be reached');
  level.itemProofs = proveItems(ctx);
  level.segments = level.segments.map(({ start, inputs, route, puzzle }) => ({ start, inputs, route, puzzle }));
  level.solution = level.segments.flatMap(s => s.inputs);
  return level;
}

function scatterCoins(ctx) {
  const { level, rng } = ctx;
  for (const segment of level.segments) {
    const spots = rng.shuffle(segment.nodes.slice(1, -1).filter(node => node.kind === 'tiles')).slice(0, COINS_PER_STRETCH);
    for (const node of spots) {
      if (levelIndex(level).coins.length >= MAX_COINS) return;
      addObject(level, { type: 'coin', x: (node.col + node.w / 2) * TILE - 7, y: (node.row - 1) * TILE + 2, w: 14, h: 14 });
    }
  }
}

function snapshot(ctx) {
  const { level } = ctx;
  return { tiles: level.tiles.slice(), objects: level.objects.length, nextBit: ctx.nextBit, waypoints: ctx.waypoints.length, timed: level.timed };
}

function provenSegment(ctx, segment, { goal, physical, added }) {
  const { level } = ctx;
  return settleChain(level) && !(physical && bypassable(level, segment.route, segment.start, goal, added));
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
  ctx.connectors = spec.connectors;
  ctx.connectorKind = spec.connector;
  const stretch = level.segments.length + 1;
  const progress = step => ((stretch - 1 + step / SEGMENT_ATTEMPTS) / BIOME_SEGMENTS) * STRETCH_SHARE;
  for (let attempt = 0; attempt < SEGMENT_ATTEMPTS; attempt++) {
    ctx.report(progress(attempt), `laying stretch ${stretch} of ${BIOME_SEGMENTS}`);
    const saved = snapshot(ctx);
    const simple = attempt === SEGMENT_ATTEMPTS - 1;
    const puzzles = simple ? [] : stagePuzzles(ctx, spec);
    ctx.puzzle = puzzles.length ? rng.pick(puzzles) : null;
    ctx.clearings = [];
    const nodes = layClimb(ctx, { ...entry }, topRow);
    if (!nodes || (puzzles.length && !ctx.puzzle)) { restore(ctx, saved); continue; }
    ctx.nodes = nodes;
    buildNodes(ctx);
    if (ctx.puzzle?.apply(ctx) === false) { restore(ctx, saved); continue; }
    if (!simple && !applyStage(ctx, spec.features)) { restore(ctx, saved); continue; }
    if (!simple && ctx.index > 0 && rng.chance(MONSTER_CHANCE + MONSTER_CHANCE_GROWTH * ctx.difficulty)) placeMonster(ctx);
    redrawPlatforms(ctx);
    ensureTimed(ctx);
    const top = nodes[nodes.length - 1];
    const goal = last ? placeGate(ctx, top) : placeCheckpoint(ctx, top);
    sealBounds(level);
    const added = level.objects.slice(saved.objects);
    const physical = added.some(o => PHYSICAL_TYPES.has(o.type));
    level.segments.push({ route: segmentRoute(ctx, nodes, saved.waypoints), goal, physical, puzzle: ctx.puzzle?.id ?? null, inputs: [], start: null });
    const segment = level.segments[level.segments.length - 1];
    ctx.report(progress(attempt + 0.5), `proving stretch ${stretch} of ${BIOME_SEGMENTS}`);
    if (provenSegment(ctx, segment, { goal, physical, added })) {
      ctx.placed.push(...nodes.slice(1), ...ctx.clearings);
      segment.nodes = nodes;
      return top;
    }
    level.segments.pop();
    restore(ctx, saved);
  }
  return null;
}

function layClimb(ctx, entry, topRow) {
  const { rng, maxUp, maxGap, puzzle } = ctx;
  const nodes = [entry];
  let pocketsLeft = puzzle ? puzzle.pockets : 0;
  let wideLeft = puzzle && puzzle.wideGap ? 1 : 0;
  let connectorsLeft = ctx.connectors ?? Infinity;
  const connectorChance = ctx.connectors == null ? CONNECTOR_CHANCE : 0.6;
  let { col, row, w, dir } = entry;
  for (let guard = 0; row > topRow && guard < 60; guard++) {
    const remaining = row - topRow;
    const taken = occupied(ctx, nodes.slice(0, -1));
    if (connectorsLeft > 0 && pocketsLeft === 0 && wideLeft === 0 && !(puzzle?.raisesNext && nodes[nodes.length - 1].pocket) && rng.chance(connectorChance)) {
      const node = layConnector(ctx, nodes[nodes.length - 1], remaining, (c, r, cw) => crowded(taken, c, r, cw));
      if (node) {
        connectorsLeft--;
        nodes.push(node);
        if (node.flight) ctx.clearings.push(node.flight);
        ({ col, row, w, dir } = node);
        continue;
      }
    }
    const wantWide = wideLeft > 0 && pocketsLeft === 0 && remaining > maxUp && rng.chance(0.5);
    const up = wantWide ? 0 : Math.min(remaining, rng.int(1, maxUp));
    const reach = Math.max(1, Math.floor(maxGap * (1 - up / (maxUp + 1.5))));
    const gap = wantWide ? maxGap + rng.int(3, 4) : rng.int(1, reach);
    const wantPocket = pocketsLeft > 0 && remaining > maxUp + 2 && rng.chance(0.5);
    const nextW = wantPocket ? puzzle.room ?? rng.int(4, 5) : ctx.slippery ? rng.int(3, 5) : rng.int(2, 4);
    const place = d => d > 0 ? col + w + gap : col - gap - nextW;
    const fits = c => c >= 0 && c + nextW <= COLS;
    let nextCol = place(dir);
    if (!fits(nextCol) || rng.chance(0.15)) { dir = -dir; nextCol = place(dir); }
    const nextRow = row - up;
    if (!fits(nextCol) || crowded(taken, nextCol, nextRow, nextW)) continue;
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
  nodes.filter(node => node.connector).forEach(node => buildConnector(ctx, node));
}

function applyStage(ctx, features) {
  const { rng, nodes } = ctx;
  const used = new Set();
  let wanted = 0, placed = 0;
  for (const [id, count] of Object.entries(features)) {
    const feature = featureById(id);
    for (let n = 0; n < count; n++) {
      wanted++;
      const options = innerNodes(ctx, i => !used.has(i) && feature.allowed(ctx, i));
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
  const { level, nodes, rules } = ctx;
  if (!(rules.superhot || rules.slowAir || rules.clockRate > 1) || level.timed) return;
  const i = nodes.findIndex((n, idx) => idx > 1 && n.gap >= 2 && !n.wide);
  const laser = featureById('laser'), phase = featureById('phase');
  if (i > 1) laser.apply(ctx, i);
  else {
    const j = nodes.findIndex((_, idx) => idx > 1 && phase.allowed(ctx, idx));
    if (j > 1) phase.apply(ctx, j);
  }
}

function digTunnel(ctx, floor) {
  if (ctx.cave) fillTiles(ctx.level, 0, floor - MOUTH.h, COLS, MOUTH.h, EMPTY);
  for (const col of [0, COLS - MOUTH.w]) ctx.placed.push({ col, row: floor, w: MOUTH.w, kind: 'tunnel' });
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
  const reached = reachedBy(goal, w, h);
  const done = s => (s.taken & (1 << plan.item.slot)) !== 0 && reached(s);
  if (holds(level, plan.inputs, start, done)) return true;
  const inputs = provenInputs(level, plan.route, { start, goal, maxNodes: ITEM_LEG_BUDGET });
  if (!inputs || !holds(level, inputs, start, done)) return false;
  plan.inputs = inputs;
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

function holds(level, inputs, start, reached) {
  const states = replay(level, inputs, start);
  return inputs.length > 0 && reached(states.at(-1)) && !states.some((s, i) => i > 0 && kicked(states[i - 1], s));
}

function provenInputs(level, route, options) {
  return solveRoute(level, route, { ...options, kicks: false })?.inputs ?? null;
}

function settleChain(level) {
  const { w, h } = playerSize(level.rules);
  let start = withItemsTaken(level, initialState(level));
  for (const segment of level.segments) {
    segment.start = start;
    const reached = reachedBy(segment.goal, w, h);
    if (!holds(level, segment.inputs, start, reached)) {
      const inputs = provenInputs(level, segment.route, { start, goal: segment.goal, maxNodes: segment.physical ? PHYSICS_LEG_BUDGET : LEG_BUDGET });
      if (!inputs) return false;
      segment.inputs = inputs;
    }
    start = segment.goal ? standAt(level, replay(level, segment.inputs, start).at(-1), segment.goal) : null;
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
