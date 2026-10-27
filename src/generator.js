import { Rng, hashString, mix } from './rng.js';
import { MUTATORS, compatible, buildRules, jumpProfile } from './rules.js';
import { TILE, COLS, ROWS, WIDTH, HEIGHT, SOLID, EMPTY, createLevel, fillTiles, tileAt, addObject } from './level.js';
import { playerSize } from './physics.js';
import { solve } from './solver.js';
import { PUZZLES, FEATURES, clamp, platform, clearAbove, carveBetween } from './features.js';

const MAX_ATTEMPTS = 14;
const SOLVE_BUDGET = 60000;
const STYLES = ['pillars', 'islands', 'cave', 'spiral'];
const TIER_ROWS = [[13, 15], [8, 9], [3, 4]];

export function generateLevel(seedText, index) {
  const base = mix(hashString(seedText), index * 7919 + 1);
  const difficulty = Math.min(1, (index - 1) / 24);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(mix(base, attempt));
    const ease = attempt < 6 ? 1 : 0.7;
    const level = buildCandidate(rng, index, difficulty * ease);
    const solution = solve(level, { maxNodes: SOLVE_BUDGET });
    if (!solution) continue;
    const minFrames = attempt < 8 ? 100 + 160 * difficulty : 0;
    if (solution.frames < minFrames) continue;
    level.solution = solution.inputs;
    level.attempt = attempt;
    return level;
  }
  const level = buildFallback(new Rng(base), index);
  level.solution = solve(level)?.inputs ?? [];
  level.attempt = MAX_ATTEMPTS;
  return level;
}

function chooseMutators(rng, index, difficulty) {
  if (index > 2 && rng.chance(0.08)) return [];
  let count = 1;
  if (index > 1 && rng.chance(0.2 + 0.45 * difficulty)) count++;
  if (difficulty > 0.5 && rng.chance(0.35)) count++;
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const pool = MUTATORS.filter(m => compatible(chosen, m));
    if (!pool.length) break;
    chosen.push(rng.weighted(pool, m => m.weight));
  }
  return chosen;
}

function chooseStyle(rng, rules, difficulty) {
  const needsCeiling = rules.flipOnJump || rules.flipPeriod > 0;
  if (needsCeiling) return rng.chance(0.5) ? 'cave' : 'pillars';
  if (rules.blinkJump) return rng.pick(['pillars', 'islands', 'cave']);
  const weights = { pillars: 3, islands: 2.5, cave: 2.5, spiral: difficulty > 0.1 && !rules.flood ? 2.5 : 0 };
  return rng.weighted(STYLES, s => weights[s]);
}

export function buildCandidate(rng, index, difficulty) {
  const mutators = chooseMutators(rng, index, difficulty);
  const rules = buildRules(mutators.map(m => m.id));
  const level = createLevel(rules, mutators.map(m => m.id));
  level.index = index;
  level.title = mutators.length ? mutators.map(m => m.title).join(' + ') : 'Plain Sailing';
  level.hints = mutators.map(m => m.hint);
  level.palette = rng.int(0, 359);
  level.theme = rng.int(0, 5);

  const style = chooseStyle(rng, rules, difficulty);
  const profile = jumpProfile(rules);
  const size = playerSize(rules);
  const ctx = { level, rng, rules, difficulty, style, cave: style === 'cave', needsCeiling: rules.flipOnJump || rules.flipPeriod > 0, profile, size, nextBit: 1 };
  level.style = style;
  ctx.maxUp = clamp(Math.floor((profile.height * 0.75) / TILE), 1, 5);
  ctx.maxGap = clamp(Math.floor((profile.reach * (0.5 + 0.35 * difficulty)) / TILE), 1, 9);
  ctx.clearance = rules.flipOnJump ? (size.h > 30 ? 4 : 3) : clamp(Math.ceil((profile.height + size.h) / TILE) + 1, 3, 8);
  if (style === 'spiral') ctx.clearance = Math.min(ctx.clearance, 4);
  ctx.puzzle = choosePuzzle(ctx);

  const puzzle = ctx.puzzle;
  for (let tries = 0; tries < 4; tries++) {
    ctx.puzzle = puzzle;
    ctx.nodes = layPath(ctx);
    if (ctx.puzzle || !puzzle) break;
  }
  if (ctx.cave) level.tiles.fill(SOLID);
  carveAndBuild(ctx);
  if (ctx.puzzle) ctx.puzzle.apply(ctx);
  applyFeatures(ctx);
  decorate(ctx);
  placeStartAndExit(ctx);
  if ((rules.superhot || rules.slowAir || rules.clockRate > 1) && !level.timed) forceTimedObstacle(ctx);
  if (rules.baseGravDir < 0) flipVertical(level, size.h);
  return level;
}

function choosePuzzle(ctx) {
  const { rng, difficulty, cave } = ctx;
  const wanted = difficulty < 0.15 ? rng.chance(0.4) : true;
  if (!wanted) return null;
  const pool = PUZZLES.filter(p => !(cave && p.openOnly));
  return rng.weighted(pool, p => p.weight);
}

function thickness(ctx, row, tier) {
  if (ctx.cave) return 1;
  if (ctx.style === 'islands' || tier > 0) return ctx.rng.int(1, 2);
  return ROWS - row;
}

function layPath(ctx) {
  const { rng, maxUp, maxGap, needsCeiling, puzzle, style } = ctx;
  const tiers = style === 'spiral' ? 3 : 1;
  const minRow = needsCeiling ? 7 : 4;
  const startRow = tiers > 1 ? rng.int(14, 15) : needsCeiling ? rng.int(9, 13) : rng.int(8, 14);
  const nodes = [{ col: 0, row: startRow, w: 3, kind: 'tiles', gap: 0, dir: 1, tier: 0, thick: thickness(ctx, startRow, 0) }];
  let pocketsLeft = puzzle ? puzzle.pockets : 0;
  let wideLeft = puzzle && puzzle.wideGap ? 1 : 0;
  let dir = 1, col = 0, row = startRow, w = 3;

  for (let tier = 0; tier < tiers; tier++) {
    const [rowMin, rowMax] = tiers > 1 ? TIER_ROWS[tier] : [minRow, 15];
    const tierUp = tiers > 1 ? 1 : maxUp;
    while (dir > 0 ? col + w < 27 : col > 5) {
      const wantWide = wideLeft > 0 && pocketsLeft === 0 && tier === 0 && (rng.chance(0.5) || col > 14);
      const up = wantWide ? 0 : rng.chance(0.55) ? rng.int(1, tierUp) : 0;
      const down = up === 0 && rng.chance(0.5) ? rng.int(1, wantWide ? 2 : 4) : 0;
      const reachScale = 1 - up / (maxUp + 1.5);
      const gap = wantWide ? maxGap + rng.int(3, 4) : rng.chance(0.12) ? 0 : rng.int(1, Math.max(1, Math.floor(maxGap * reachScale)));
      const nextRow = clamp(row + down - up, rowMin, rowMax);
      const wantPocket = pocketsLeft > 0 && nextRow > 4 && tier === 0 && (tiers === 1 || nextRow >= 14) && (rng.chance(0.4) || col > 12);
      let nextW = wantPocket ? rng.int(4, 5) : rng.int(2, 4);
      let nextCol = dir > 0 ? col + w + gap : col - gap - nextW;
      if (dir < 0 && nextCol < 0) { nextCol = 0; nextW = Math.min(nextW, col - gap); }
      nextW = Math.min(nextW, COLS - nextCol);
      if (nextW < 2) break;
      nodes.push({ col: nextCol, row: nextRow, w: nextW, kind: 'tiles', gap, dir, tier, pocket: wantPocket, wide: wantWide, thick: thickness(ctx, nextRow, tier) });
      if (wantPocket) pocketsLeft--;
      if (wantWide) wideLeft--;
      col = nextCol;
      row = nextRow;
      w = nextW;
    }
    if (tier === tiers - 1) break;
    const targetRow = TIER_ROWS[tier + 1][1];
    const outer = dir > 0 ? COLS - 2 : 0, inner = dir > 0 ? COLS - 5 : 3;
    const overlapsOuter = col + w > outer && col < outer + 2;
    const sides = overlapsOuter ? [inner, outer] : [outer, inner];
    let step = 0;
    while (row - maxUp > targetRow) {
      row -= maxUp;
      col = sides[step % 2];
      w = 2;
      nodes.push({ col, row, w, kind: 'tiles', gap: 0, dir, tier, ladder: true, thick: 1 });
      step++;
    }
    const lastSide = step ? sides[(step - 1) % 2] : (overlapsOuter ? outer : inner);
    dir = -dir;
    row = targetRow;
    col = lastSide === outer ? (dir > 0 ? 3 : COLS - 6) : (dir > 0 ? 0 : COLS - 3);
    w = 3;
    nodes.push({ col, row, w, kind: 'tiles', gap: 0, dir, tier: tier + 1, ladder: true, thick: 1 });
  }
  const last = nodes[nodes.length - 1];
  last.w = COLS - last.col;
  last.exit = true;
  last.dir = 1;
  if (last.pocket) { last.pocket = false; pocketsLeft++; }
  if (pocketsLeft > 0 || wideLeft > 0) ctx.puzzle = null;
  return nodes;
}

function carveAndBuild(ctx) {
  const { level, nodes, cave, clearance } = ctx;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (cave) {
      clearAbove(ctx, node.col, node.row, node.w);
      if (i > 0) carveBetween(ctx, nodes[i - 1], node);
    }
    platform(ctx, node);
  }
  const first = nodes[0], last = nodes[nodes.length - 1];
  fillTiles(level, 0, first.row - clearance, 2, clearance, EMPTY);
  fillTiles(level, COLS - 2, last.row - exitHeight(ctx), 2, exitHeight(ctx), EMPTY);
}

function exitHeight(ctx) {
  return Math.max(3, Math.ceil(ctx.size.h / TILE) + 1);
}

function applyFeatures(ctx) {
  const { rng, nodes, difficulty } = ctx;
  const pFeature = 0.3 + 0.55 * difficulty;
  const minFeatures = (ctx.puzzle ? 0 : 1) + (difficulty > 0.2 ? 1 : 0) + (difficulty > 0.6 ? 1 : 0);
  let applied = 0;
  for (const i of rng.shuffle(nodes.map((_, i) => i).slice(1))) {
    if (applied >= minFeatures && !rng.chance(pFeature)) continue;
    const pool = FEATURES.filter(f => f.allowed(ctx, i));
    if (!pool.length) continue;
    rng.weighted(pool, f => f.weight(ctx)).apply(ctx, i);
    applied++;
  }
}

function decorate(ctx) {
  const { level, rng, nodes, cave, difficulty, clearance, style } = ctx;
  if (cave) return;
  if (style !== 'spiral' && rng.chance(0.5)) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(level, c, ROWS - 1) === EMPTY && tileAt(level, c, ROWS - 2) === EMPTY) {
        addObject(level, { type: 'spikes', x: c * TILE + 3, y: HEIGHT - 14, w: TILE - 6, h: 14, dir: -1 });
      }
    }
  }
  if (style !== 'spiral') {
    for (const node of nodes) {
      if (node.kind !== 'tiles' || node.lifted || node.row <= 3 || !rng.chance(0.4 + difficulty * 0.3)) continue;
      const col = node.col + rng.int(0, node.w - 1);
      const row = node.row - clearance - rng.int(2, 4);
      if (row >= 1) fillTiles(level, col, row - 1, Math.min(2, COLS - col), 2, SOLID);
    }
  }
  if (ctx.needsCeiling) {
    const always = ctx.rules.flipPeriod > 0;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1], node = nodes[i];
      const row = Math.min(prev.row, node.row) - clearance - 1;
      if (row < 0) continue;
      if (node.gap > 0) fillTiles(level, prev.col + prev.w - 1, row, node.col - prev.col - prev.w + 2, 1, SOLID);
      if (always || rng.chance(0.6)) fillTiles(level, node.col, node.row - clearance - 1 - (always ? 0 : rng.int(0, 1)), node.w, 1, SOLID);
    }
    if (always) fillTiles(level, 0, nodes[0].row - clearance - 1, nodes[0].w, 1, SOLID);
  }
}

function placeStartAndExit(ctx) {
  const { level, nodes, size } = ctx;
  const first = nodes[0], last = nodes[nodes.length - 1];
  level.start = { x: TILE * 0.5, y: first.row * TILE - size.h };
  const exitH = exitHeight(ctx);
  level.exit = { x: WIDTH - TILE * 0.7, y: (last.row - exitH) * TILE, w: TILE * 0.7, h: exitH * TILE };
  level.floodMin = last.row * TILE + 2;
  level.route = [];
  nodes.forEach((node, i) => {
    level.route.push({ x: (node.col + node.w / 2) * TILE, y: node.row * TILE - size.h / 2 });
    for (const o of level.objects) if (o.routeAfter === i) level.route.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, bit: o.bit });
  });
  level.route.push({ x: level.exit.x + level.exit.w / 2, y: level.exit.y + level.exit.h / 2 });
}

function forceTimedObstacle(ctx) {
  const i = ctx.nodes.findIndex((n, idx) => idx > 0 && n.gap >= 2 && !n.wide && !n.ladder);
  const laser = FEATURES.find(f => f.id === 'laser'), phase = FEATURES.find(f => f.id === 'phase');
  if (i > 0) laser.apply(ctx, i);
  else if (phase.allowed(ctx, 1)) phase.apply(ctx, 1);
}

function flipVertical(level, playerH) {
  const flipped = new Uint8Array(level.tiles.length);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) flipped[(ROWS - 1 - r) * COLS + c] = level.tiles[r * COLS + c];
  level.tiles = flipped;
  for (const o of level.objects) {
    o.y = HEIGHT - o.y - o.h;
    if (o.dy) o.dy = -o.dy;
    if (o.dir && o.type !== 'bumper') o.dir = -o.dir;
    if (o.ay) o.ay = -o.ay;
  }
  level.start.y = HEIGHT - level.start.y - playerH;
  level.exit.y = HEIGHT - level.exit.y - level.exit.h;
  level.floodMin = 0;
  for (const point of level.route) point.y = HEIGHT - point.y;
}

function buildFallback(rng, index) {
  const level = createLevel(buildRules([]), []);
  level.index = index;
  level.title = 'A Breather';
  level.hints = [];
  level.palette = rng.int(0, 359);
  level.theme = rng.int(0, 5);
  level.style = 'pillars';
  const row = 13;
  fillTiles(level, 0, row, COLS, ROWS - row, SOLID);
  fillTiles(level, 10, row, 3, ROWS - row, EMPTY);
  fillTiles(level, 20, row, 3, ROWS - row, EMPTY);
  level.start = { x: TILE * 0.5, y: row * TILE - 26 };
  level.exit = { x: WIDTH - TILE * 0.7, y: (row - 3) * TILE, w: TILE * 0.7, h: 3 * TILE };
  return level;
}
