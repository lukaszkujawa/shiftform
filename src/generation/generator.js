import { Rng, hashString, mix, levelRng } from '../world/rng.js';
import { buildRules, jumpProfile, isBane } from '../world/rules.js';
import { pursuitOf } from '../world/pursuit.js';
import { TILE, COLS, SOLID, EMPTY, ONE_WAY, createLevel, fillTiles, addObject, levelIndex, overlaps } from '../world/level.js';
import { playerSize, initialState } from '../world/physics.js';
import { solve, solveRoute, replay, chainStates, kicked, reachedBy } from './solver.js';
import { fairMove } from './fair.js';
import { unsaveableJumps } from './sloppy.js';
import { standAt } from '../world/climb.js';
import { MOUTH, SHOP_ROWS } from '../world/tunnel.js';
import { HOME_TILES } from '../world/home.js';
import { featureById, gravityFixed, occupied, innerNodes, clamp, platform, clearAbove, carveBetween, jumpRise, crowded, ledgeSpots, buildConnector, redrawPlatforms, placeMonster, MECHANISM_TYPES, LOCK_TYPES } from './features.js';
import { monsterTries, wantsFeature, coinsPerStretch } from './design.js';
import { chooseFocus, stagePuzzles, stageRiddle, actionBudget, hardened } from './focus.js';
import { THEMES } from '../art/themes.js';
import { chooseKind, buildLedge, routeThrough } from '../world/items.js';
import { writeScript, realise } from './moves.js';
import { profileOf, score } from './critics.js';
import { chamberPlans, chamberFits, raiseChamber } from './chamber.js';
import { raiseSunken } from './sunken.js';
import { IDEAS } from './ideas.js';
import { buildRig } from './rigs.js';
import { runGauntlet, layHurdles } from './gauntlet.js';

const BIOME_SEGMENTS = 4;
const SUNKEN_FROM = 1;
const SUNKEN_CHANCE = 0.3;
const IDEA_CHANCE = 0.4;
const WHOLE_CHANCE = 0.08;
const WHOLE_FROM = 2;
const SUNKEN_ATTEMPTS = 3;
const ENTRY_TILES = 4;
const SEGMENT_ROWS = 18;
const TOP_ROW = 3;
const FULL_ATTEMPTS = 3;
const PLAIN_ATTEMPTS = 6;
const SLIPPERY_ACCEL = 0.3;
const SLIPPERY_REACH = 0.7;
const SEGMENT_ATTEMPTS = 6;
const LEG_BUDGET = 12000;
const PHYSICS_LEG_BUDGET = 10000;
const CHAMBER_LEG_BUDGET = 4000;
const SUNKEN_LEG_BUDGET = 16000;
const BYPASS_SEARCH = { grain: 4, maxNodes: 2500 };
const DOOR_SLACK = 1.75;
const FAST_TEMPO_FROM = 0.6;
const ITEM_ATTEMPTS = 4;
const ITEM_LEG_BUDGET = 8000;
const TWO_ITEMS_FROM = 4;
const MONSTER_CHANCE = 0.15;
const MONSTER_CHANCE_GROWTH = 0.85;
const SECOND_MONSTER_FROM = 4;
const BRUTAL_FROM = 4;
const GAP_SHARE = 0.45;
const GAP_SHARE_GROWTH = 0.3;
const COINS_PER_STRETCH = 3;
const MAX_COINS = 28;
const STRETCH_SHARE = 0.85;
const CANDIDATES = 4;
const PROVEN_CANDIDATES = 2;
const NOVELTY_WINDOW = 16;
const CHAMBER_CEILING = 2;
const RIGGED = new Set(['hook', 'cannon']);
const APEX_MOVES = new Set(['leap', 'soar']);
const TIDE_TRACKING = 1e-9;

export function generateBiome(seedText, index, entryCol, mutators = [], forcedFocus = null, report = () => {}, history = [], design = null) {
  const base = mix(hashString(seedText), index * 7919 + 1);
  const entry = entryCol ?? new Rng(base).int(3, COLS - 5);
  const plans = [...Array(FULL_ATTEMPTS).fill(mutators), mutators.filter(id => !isBane(id)), ...Array(PLAIN_ATTEMPTS).fill([])];
  for (const [attempt, rules] of plans.entries()) {
    if (attempt > 0) report(0, 'starting over with a fresh plan');
    const level = buildBiome(new Rng(mix(base, attempt)), index, entry, rules, forcedFocus, report, history, design);
    if (level) return level;
  }
  throw new Error(`biome ${index} of ${seedText} could not be generated`);
}

function buildBiome(rng, index, entryCol, mutators, forcedFocus, report, history, design) {
  const stretches = design?.stretches ?? BIOME_SEGMENTS;
  const difficulty = Math.min(1, index / BRUTAL_FROM);
  const rules = buildRules(mutators);
  const world = buildRules(mutators.filter(isBane));
  const level = createLevel(rules, mutators, stretches * SEGMENT_ROWS);
  level.index = index;
  level.provenMutators = mutators;
  level.palette = rng.int(0, 359);
  level.theme = rng.int(0, THEMES.length - 1);
  level.entryCol = entryCol;

  const style = rng.chance(0.35) ? 'cave' : 'open';
  const size = playerSize(rules);
  const profile = jumpProfile(rules);
  const ctx = {
    level, rng, rules, difficulty, style, cave: style === 'cave', index,
    needsCeiling: rules.jumpFlipChance > 0,
    profile, size, rise: jumpRise(rules), nextBit: 1, waypoints: [], placed: [], report, history: history.slice(), design, stretches,
  };
  const worldRise = Math.min(ctx.rise, jumpRise(world)), worldReach = Math.min(profile.reach, jumpProfile(world).reach);
  ctx.slippery = rules.airAccel < SLIPPERY_ACCEL || rules.groundAccel < SLIPPERY_ACCEL;
  ctx.maxUp = clamp(Math.floor((worldRise * 0.8) / TILE), 1, 4);
  ctx.maxGap = clamp(Math.floor((worldReach * (GAP_SHARE + GAP_SHARE_GROWTH * difficulty) * (ctx.slippery ? SLIPPERY_REACH : 1)) / TILE), 1, 7);
  ctx.budget = actionBudget(difficulty);
  ctx.clearance = ctx.needsCeiling ? (size.h > 30 ? 4 : 3) : clamp(Math.ceil((ctx.rise + size.h) / TILE) + 1, 3, 6);
  level.style = style;
  ctx.focus = chooseFocus(ctx, forcedFocus);
  if (ctx.focus.open) ctx.cave = false, ctx.style = level.style = 'open';
  level.focus = ctx.focus.id;
  const flood = levelRng(level, 'sunken', 31, 5);
  const floods = design?.flooded === 'always' || (design?.flooded !== 'never' && !forcedFocus && flood.chance(SUNKEN_CHANCE));
  ctx.sunkenStretch = floods && index >= SUNKEN_FROM && stretches > 2 ? flood.int(2, stretches - 1) : 0;
  const inspired = levelRng(level, 'ideas', 37, 11), forced = IDEAS.find(idea => idea.id === design?.idea);
  const open = design?.idea !== 'never' && !forcedFocus;
  const whole = open && index >= WHOLE_FROM && inspired.chance(WHOLE_CHANCE) ? inspired.pick(IDEAS.filter(idea => idea.whole)) : null;
  const usesIdea = forced || whole || (open && index >= SUNKEN_FROM && inspired.chance(IDEA_CHANCE));
  ctx.idea = usesIdea && gravityFixed(ctx) && stretches > 2 ? forced ?? whole ?? inspired.pick(IDEAS.filter(idea => !idea.whole)) : null;
  ctx.ideaStretch = ctx.idea ? inspired.int(2, stretches - 1) : 0;
  if (ctx.idea?.whole) ctx.sunkenStretch = 0;
  if (ctx.ideaStretch === ctx.sunkenStretch) {
    if (forced) ctx.sunkenStretch = 0;
    else ctx.ideaStretch = 0;
  }
  level.title = ctx.focus.title;

  const floor = level.rows - 1;
  if (ctx.cave) level.tiles.fill(SOLID);
  sealBounds(level);
  level.start = { x: (entryCol + (design ? 0.5 : 1)) * TILE - size.w / 2, y: floor * TILE - size.h };
  level.exit = { x: 0, y: -10 * TILE, w: 0, h: 0 };
  const entryW = index === 0 ? HOME_TILES + 3 : ENTRY_TILES;
  let entry = { col: clamp(entryCol + 1 - Math.ceil(entryW / 2), 0, COLS - entryW), row: floor, w: entryW, dir: entryCol < COLS / 2 ? 1 : -1, kind: 'tiles', thick: 1, reserved: true, exit: true };
  if (ctx.cave) clearAbove(ctx, entry.col, entry.row, entry.w);
  digTunnel(ctx, floor);

  level.segments = [];
  ctx.items = [];
  ctx.clearings = [];
  ctx.seals = [];
  level.wires = [];
  level.rooms = [];
  const itemSegments = new Set(rng.shuffle(Array.from({ length: stretches }, (_, k) => k)).slice(0, (index >= TWO_ITEMS_FROM ? 2 : 1) * Math.ceil(stretches / BIOME_SEGMENTS)));
  let owedItems = 0;
  const placedItemOn = new Set();
  for (let k = 0; k < stretches; k++) {
    const last = k === stretches - 1;
    entry = buildSegment(ctx, hardened(ctx.focus.stages[k % ctx.focus.stages.length], difficulty), entry, last ? TOP_ROW : entry.row - SEGMENT_ROWS, last);
    if (!entry) return null;
    if (itemSegments.has(k)) owedItems++;
    if (owedItems && !level.segments[k].sealed) {
      report(((k + 1) / stretches) * STRETCH_SHARE, 'hiding an item off the route');
      placeItem(ctx, k);
      placedItemOn.add(k);
      owedItems--;
    }
  }
  for (let k = 0; owedItems && k < stretches; k++) {
    if (level.segments[k].sealed || placedItemOn.has(k)) continue;
    placeItem(ctx, k);
    owedItems--;
  }
  report(STRETCH_SHARE, 'replaying the whole climb');
  if (!settleChain(level)) return null;
  level.segments.forEach(segment => widenTimedDoors(level, segment));
  if (!settleChain(level)) return null;
  planPursuit(ctx);
  report(0.9, 'proving every item can be reached');
  runGauntlet(ctx, proveItems(ctx));
  if (!settleChain(level)) return null;
  planPursuit(ctx);
  scatterCoins(ctx);
  report(0.95, 'proving the dressed climb');
  level.itemProofs = proveItems(ctx);
  level.moves = level.segments.flatMap(s => s.nodes.slice(1).map(n => n.connector ? 'shaft' : n.move ?? 'hop'));
  level.profiles = ctx.history.slice(-NOVELTY_WINDOW);
  level.segments = level.segments.map(({ start, inputs, route, puzzle, owned, bounds, logic, sunken, added, idea }) => ({ start, inputs, route, puzzle, owned, bounds, logic, idea, ...(sunken ? { sunken, added } : {}) }));
  level.solution = level.segments.flatMap(s => s.inputs);
  return level;
}

function planPursuit({ level, size }) {
  const rules = { ...level.rules, flood: level.rules.flood || TIDE_TRACKING };
  level.pursuit = pursuitOf(chainStates({ ...level, rules }), size.h, level.height);
}

function scatterCoins(ctx) {
  const { level, rng } = ctx;
  const coin = (x, y, extra = {}) => levelIndex(level).coins.length < MAX_COINS && addObject(level, { type: 'coin', x: x - 7, y, w: 14, h: 14, ...extra });
  for (const segment of level.segments) {
    const states = replay(level, segment.inputs, segment.start);
    segment.nodes.forEach((node, i) => {
      if (!APEX_MOVES.has(node.move) || i === 0) return;
      const apex = apexOver(states, segment.nodes[i - 1], node, ctx.size.w);
      if (apex && ctx.design?.coins !== 'none') coin(apex.x + ctx.size.w / 2, apex.y + ctx.size.h / 2 - 7, { apex: true });
    });
    const spots = (segment.rests ?? rng.shuffle(segment.nodes.slice(1, -1).filter(node => node.kind === 'tiles'))).slice(0, coinsPerStretch(ctx.design, COINS_PER_STRETCH));
    for (const node of spots) coin((node.col + node.w / 2) * TILE, (node.row - 1) * TILE + 2);
  }
}

function apexOver(states, prev, node, width) {
  const left = Math.min(prev.col + prev.w, node.col + node.w) * TILE, right = Math.max(prev.col, node.col) * TILE;
  const over = states.filter(s => s.x + width / 2 >= left && s.x + width / 2 <= right);
  return over.length ? over.reduce((top, s) => (s.y < top.y ? s : top)) : null;
}

function snapshot(ctx) {
  const { level } = ctx;
  return { tiles: level.tiles.slice(), objects: level.objects.length, wires: level.wires.length, nextBit: ctx.nextBit, waypoints: ctx.waypoints.length, timed: level.timed };
}

function restore(ctx, saved) {
  const { level } = ctx;
  level.tiles = saved.tiles;
  level.objects.length = saved.objects;
  level.wires.length = saved.wires;
  level.timed = saved.timed;
  ctx.nextBit = saved.nextBit;
  ctx.waypoints.length = saved.waypoints;
}

function buildSegment(ctx, spec, entry, topRow, last) {
  const { level, rng } = ctx;
  ctx.tempo = spec.tempo ?? (ctx.difficulty >= FAST_TEMPO_FROM ? 120 : null);
  ctx.connectors = spec.connectors;
  ctx.connectorKind = spec.connector;
  ctx.spec = spec;
  ctx.last = last;
  const stretch = level.segments.length + 1;
  const progress = step => ((stretch - 1 + step / SEGMENT_ATTEMPTS) / ctx.stretches) * STRETCH_SHARE;
  if (ctx.idea?.whole || (stretch === ctx.ideaStretch && !last)) {
    ctx.report(progress(0), `trying an idea on stretch ${stretch} of ${ctx.stretches}`);
    const top = provenSetPiece(ctx, entry, topRow, ctx.idea.raise, extent => ({ idea: ctx.idea.id, extent }), last ? placeGate : placeCheckpoint);
    if (top) return top;
  }
  if (stretch === ctx.sunkenStretch && !last) {
    ctx.report(progress(0), `flooding stretch ${stretch} of ${ctx.stretches}`);
    const top = provenSetPiece(ctx, entry, topRow, raiseSunken, sunken => ({ sunken }));
    if (top) return top;
  }
  const riddle = stageRiddle(ctx, spec);
  if (riddle) {
    ctx.report(progress(0), `designing stretch ${stretch} of ${ctx.stretches}`);
    const top = provenChamber(ctx, riddle, entry, Math.max(last ? TOP_ROW : topRow, CHAMBER_CEILING));
    if (top) return top;
  }
  for (let attempt = 0; attempt < SEGMENT_ATTEMPTS; attempt++) {
    ctx.report(progress(attempt), `laying stretch ${stretch} of ${ctx.stretches}`);
    const simple = attempt === SEGMENT_ATTEMPTS - 1;
    ctx.simple = simple;
    const puzzles = simple ? [] : stagePuzzles(ctx, spec);
    ctx.puzzle = puzzles.length ? rng.weighted(puzzles, p => p.weight) : null;
    for (const laid of rankedCandidates(ctx, entry, topRow, puzzles.length > 0)) {
      ctx.report(progress(attempt + 0.5), `proving stretch ${stretch} of ${ctx.stretches}`);
      const top = buildCandidate(ctx, laid, spec, simple);
      if (top) return top;
    }
  }
  return null;
}

function buildCandidate(ctx, laid, spec, simple) {
  const { level, rng } = ctx;
  const saved = snapshot(ctx);
  const abandon = () => { restore(ctx, saved); return null; };
  ctx.nodes = laid.nodes;
  ctx.clearings = laid.clearings;
  ctx.puzzle = laid.puzzle;
  const { nodes } = laid;
  buildNodes(ctx);
  if (ctx.puzzle?.apply(ctx) === false) return abandon();
  if (simple) level.simplified = true;
  if (!simple && !applyStage(ctx, spec.features)) return abandon();
  if (!simple && ctx.index > 0) {
    const tries = ctx.design ? monsterTries(ctx.design) : (rng.chance(MONSTER_CHANCE + MONSTER_CHANCE_GROWTH * ctx.difficulty) ? 1 : 0) + (ctx.index >= SECOND_MONSTER_FROM ? 1 : 0);
    for (let n = 0; n < tries; n++) placeMonster(ctx);
    layHurdles(ctx);
  }
  redrawPlatforms(ctx);
  ensureTimed(ctx);
  const top = nodes[nodes.length - 1];
  const goal = ctx.last ? placeGate(ctx, top) : placeCheckpoint(ctx, top);
  sealBounds(level);
  const added = level.objects.slice(saved.objects);
  const segment = { route: segmentRoute(ctx, nodes, saved.waypoints), goal, physical: added.some(o => RIGGED.has(o.type)), added, puzzle: ctx.puzzle?.id ?? null, inputs: [], start: null };
  level.segments.push(segment);
  const fairEnough = () => simple || unsaveableJumps(level, segment.inputs, segment.start) === 0;
  if (!settleChain(level) || !fairEnough()) {
    level.segments.pop();
    return abandon();
  }
  ctx.placed.push(...nodes.slice(1), ...ctx.clearings);
  segment.nodes = nodes;
  segment.profile = laid.profile;
  ctx.history.push({ ...laid.profile, focus: ctx.focus.id });
  return top;
}

function provenSetPiece(ctx, entry, topRow, raise, tagOf, goalOf = placeCheckpoint) {
  const { level } = ctx;
  ctx.nodes = [entry];
  for (let attempt = 0; attempt < SUNKEN_ATTEMPTS; attempt++) {
    const saved = snapshot(ctx);
    const raised = raise(ctx, entry, topRow, ctx.difficulty * (1 - attempt / SUNKEN_ATTEMPTS));
    if (!raised) return null;
    const { top, route, nodes, footprint, extent, alternates = [] } = raised;
    ensureTimed(ctx);
    const goal = goalOf(ctx, top);
    sealBounds(level);
    const added = level.objects.slice(saved.objects);
    const segment = { route, goal, physical: true, added, puzzle: null, inputs: [], start: null, sealed: true, ...tagOf(extent) };
    level.segments.push(segment);
    if (settleChain(level) && alternates.every(other => provenInputs(level, other, { start: segment.start, goal, maxNodes: SUNKEN_LEG_BUDGET }))) {
      segment.nodes = nodes;
      segment.profile = profileOf(nodes);
      ctx.placed.push(top, footprint);
      ctx.history.push({ ...segment.profile, focus: ctx.focus.id });
      return top;
    }
    level.segments.pop();
    restore(ctx, saved);
  }
  return null;
}

function provenChamber(ctx, style, entry, ceiling) {
  const { level } = ctx;
  ctx.nodes = [entry];
  for (const candidate of chamberPlans(ctx, style, entry, ceiling)) {
    if (!chamberFits(ctx, candidate)) continue;
    const saved = snapshot(ctx);
    const seals = ctx.seals.length;
    const { top, route, nodes, signature, logic, bounds, rests, footprint } = raiseChamber(ctx, candidate, entry);
    const goal = ctx.last ? placeGate(ctx, top) : placeCheckpoint(ctx, top);
    sealBounds(level);
    const added = level.objects.slice(saved.objects);
    const segment = { route, goal, physical: true, added, puzzle: signature, inputs: [], start: null, sealed: true };
    level.segments.push(segment);
    if (settleChain(level) && !bypassable(level, segment, added)) {
      segment.nodes = nodes;
      segment.bounds = bounds;
      segment.logic = logic;
      segment.rests = rests;
      level.rooms.push({ top: bounds.roof * TILE, bottom: bounds.floor * TILE });
      segment.owned = added.map(o => o.id);
      segment.profile = profileOf(nodes);
      ctx.placed.push(top, footprint);
      ctx.history.push({ ...segment.profile, focus: ctx.focus.id, riddle: signature });
      return top;
    }
    level.segments.pop();
    ctx.seals.length = seals;
    restore(ctx, saved);
    delete level.exitCol;
  }
  return null;
}

function widenTimedDoors(level, segment) {
  const { w, h } = playerSize(level.rules);
  const states = replay(level, segment.inputs, segment.start);
  for (const door of segment.added.filter(o => o.type === 'door' && o.timer !== undefined)) {
    const timer = segment.added.find(o => o.type === 'timer' && o.slot === door.timer);
    const fired = states.findIndex(s => s.timers[door.timer] >= 0);
    const passed = states.findLastIndex(s => overlaps(s.x, s.y, w, h, door));
    if (fired < 0 || passed < fired) continue;
    door.open = timer.open = Math.max(door.open, Math.ceil((passed - fired) * DOOR_SLACK));
  }
}

function rankedCandidates(ctx, entry, topRow, needsPuzzle) {
  const weights = ctx.spec.moves ?? {};
  const laid = [];
  for (let c = 0; c < CANDIDATES; c++) {
    const candidate = layClimb(ctx, { ...entry }, topRow);
    if (!candidate || (needsPuzzle && !candidate.puzzle)) continue;
    candidate.profile = profileOf(candidate.nodes);
    candidate.score = score(candidate.profile, ctx.history, weights);
    laid.push(candidate);
  }
  return laid.sort((a, b) => b.score - a.score).slice(0, PROVEN_CANDIDATES);
}

function layClimb(ctx, entry, topRow) {
  const { puzzle } = ctx;
  const nodes = [entry], clearings = [];
  const script = writeScript(ctx, ctx.spec, entry.row - topRow);
  const offFloor = entry.row === ctx.level.rows - 1;
  const lowest = ctx.level.rows - 1 - (ctx.index && !ctx.needsCeiling ? SHOP_ROWS : 2);
  ctx.connectorsLeft = ctx.connectors ?? Infinity;
  let at = 0, retried = -1;
  for (let guard = 0; nodes[nodes.length - 1].row > topRow && guard < 60; guard++) {
    const from = nodes[nodes.length - 1];
    const remaining = from.row - topRow;
    const taken = occupied(ctx, [...clearings, ...nodes.slice(0, -1)]);
    const blocked = (c, r, w) => r > lowest || crowded(taken, c, r, w);
    const wanted = offFloor && nodes.length === 1 ? 'lift' : script[at++] ?? 'hop';
    let laid = realise(ctx, wanted, from, remaining, blocked);
    if (!laid && (wanted === 'wide' || retried !== at)) {
      script.splice(at, 0, wanted);
      retried = at + 1;
    }
    if (!laid && wanted !== 'hop') laid = realise(ctx, 'hop', from, remaining, blocked);
    if (!laid) laid = realise(ctx, 'turn', from, remaining, blocked);
    if (!laid) continue;
    for (const node of laid) {
      nodes.push(node);
      if (node.flight) clearings.push(node.flight);
    }
  }
  const top = nodes[nodes.length - 1];
  if (top.row > topRow) return null;
  top.exit = true;
  if (top.w < 3) { top.w = 3; top.col = clamp(top.col, 0, COLS - 3); }
  const kept = !puzzle || nodes.some(n => n.wide);
  return { nodes, clearings, puzzle: kept ? puzzle : null };
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
  nodes.filter(node => node.refill).forEach(node => addObject(ctx.level, { type: 'refill', x: (node.refill.col + 0.5) * TILE - 9, y: (node.refill.row + 0.5) * TILE - 9, w: 18, h: 18 }));
  nodes.filter(node => node.connector).forEach(node => buildConnector(ctx, node));
  nodes.forEach((node, i) => { if (i && node.rig) buildRig(ctx, node, i); });
}

function applyStage(ctx, features) {
  const { rng } = ctx;
  const used = new Set();
  let wanted = 0, placed = 0;
  for (const [id, count] of Object.entries(features)) {
    if (!wantsFeature(ctx.design, id)) continue;
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
  if (i > 1 && wantsFeature(ctx.design, 'laser')) laser.apply(ctx, i);
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
  addObject(level, { type: 'spring', x: (exitCol + 1) * TILE - (TILE - 8) / 2, y: node.row * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
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
    if (settleChain(level) && !chainTouches(level, item) && proveItem(level, plan)) {
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
    if (!chainTouches(level, plan.item) && proveItem(level, plan)) return [{ item: plan.item.id, segment: plan.segment, start: itemStart(level, plan), inputs: plan.inputs }];
    plan.item.type = 'removed';
    return [];
  });
}

function chainTouches(level, item) {
  const { w, h } = playerSize(level.rules);
  return chainStates(level).some(s => overlaps(s.x, s.y, w, h, item));
}

function holds(level, inputs, start, reached) {
  const states = replay(level, inputs, start);
  return inputs.length > 0 && reached(states.at(-1)) && !states.some((s, i) => i > 0 && (kicked(states[i - 1], s) || !fairMove(level, states[i - 1], s)));
}

function provenInputs(level, route, options) {
  return solveRoute(level, route, { ...options, kicks: false, fair: true })?.inputs ?? null;
}

function settleChain(level) {
  const { w, h } = playerSize(level.rules);
  let start = withItemsTaken(level, initialState(level));
  for (const segment of level.segments) {
    segment.start = start;
    const reached = reachedBy(segment.goal, w, h);
    if (!holds(level, segment.inputs, start, reached)) {
      const inputs = provenInputs(level, segment.route, { start, goal: segment.goal, maxNodes: segment.sunken || segment.idea ? SUNKEN_LEG_BUDGET : segment.sealed ? CHAMBER_LEG_BUDGET : segment.physical ? PHYSICS_LEG_BUDGET : LEG_BUDGET });
      if (!inputs) return false;
      segment.inputs = inputs;
    }
    const states = replay(level, segment.inputs, start), touch = Math.max(1, states.findIndex(reached));
    segment.inputs = segment.inputs.slice(0, touch);
    start = segment.goal ? standAt(level, states[touch], segment.goal) : null;
  }
  return true;
}

function segmentRoute(ctx, nodes, firstWaypoint) {
  const route = [];
  const waypoints = ctx.waypoints.slice(firstWaypoint);
  nodes.forEach((node, i) => {
    route.push({ x: (node.col + node.w / 2) * TILE, y: node.row * TILE - ctx.size.h / 2, w: node.w * TILE, coarse: !!node.rig });
    for (const { after, ...point } of waypoints) if (after === i) route.push(point);
  });
  return route;
}

function bypassable(level, { route, start: begin, goal }, added) {
  const removed = new Set(added.filter(o => MECHANISM_TYPES.has(o.type)));
  const bare = { ...level, objects: level.objects.map(o => o.type !== 'crate' && removed.has(o) ? { ...o, type: 'removed' } : o) };
  const crates = levelIndex(level).crates;
  const mask = added.reduce((bits, o) => (LOCK_TYPES.has(o.type) ? bits | o.bit : bits), 0);
  const start = { ...begin, flags: begin.flags & ~mask, bodies: begin.bodies.map((b, k) => removed.has(crates[k]) ? { ...b, gone: true } : b) };
  return !!solve(bare, { start, goal, route: route.filter(p => p.body === undefined && p.hold === undefined && !p.bit && p.timer === undefined), ...BYPASS_SEARCH });
}
