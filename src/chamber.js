import { TILE, COLS, SOLID, EMPTY, ONE_WAY, CRATE_SIZE, fillTiles, addObject, overlaps, gatePins } from './level.js?v=e8bd9df';
import { THROW_VX, THROW_VY } from './bodies.js?v=e8bd9df';
import { EXIT, compose, rewire, twist, appraise } from './riddle.js?v=e8bd9df';

const FLOOR_LIFT = 3;
const HATCH_W = 3;
const MIN_CELL = 5;
const MIN_OVERLAP = 3;
const HOLE_W = 2;
const TOP_W = 4;
const SPIKE_H = 8;
const ALWAYS = 240;
const PLATE_W = 2;
const LADDER_STEP = 3;
const PLUG_WITHIN = 9;
const FUSE_OPEN = 240;
const STONE_WITHIN = 1.25 * TILE;
const THROW_DROP = 50;
const SHAPES = [[4, 4, 4], [6, 6], [5, 7], [7, 5], [4, 7], [7, 4], [8], [10]];
const COMPOSITIONS = 1000;
const TUNED_COMPOSITIONS = 600;
const ENOUGH_ROOMS = 8;
const PER_PLAN = 25;
const TUNED_PER_PLAN = 6;
const PROVEN_PLANS = 5;
const REPEAT_PENALTY = 4;
const TWIST_TRIES = 3;
const STAR_BONUS = 8;
const MAX_WALK_BONUS = 3;
const FAMILIAR_PENALTY = 3;
const DEPTH_WORK = 2;
const WIRE_LANE = 5;
const DOOR_HEADROOM = 20;
const CROSSINGS_BEFORE_TRUDGE = 7;
const WIDE_CHANCE = 0.4;
const FITS = 16;
const RANKED_RIDDLES = 30;
const TURN_TILES = 5;
const TURN_VALUE = 1;
const RETURN_VALUE = 0.8;
const SHELF_RISE = 3;
const SHELF_W = 2;
const SHELF_CHANCE = 0.5;
const SHELF_HEADROOM = 5;
const HURDLE_MIN_CELL = 8;
const HURDLE_W = 2;
const HURDLE_MARGIN = 3;
const HURDLE_CHANCE = 0.3;
const HURDLE_CHANCE_GROWTH = 0.4;
const UNDO_VALUE = 2.5;
const CONFLICT_VALUE = 3;
const MAX_CROSSINGS = 12;
const REWIRE_SHARE = 0.75;
const MAX_UNDO_VALUE = 3;
const CHORE_PENALTY = 4;
const GATE_RISE = 16;
const BRIDGE_GATE_RISE = 34;
const SHAFT_GATE_SIDE = 24;
const LEVER_W = 28;
const LEVER_H = 30;

const QUALITY_BARS = [{ from: 3, depth: 2 }, { from: 0, depth: 1 }];

const starredIn = (signature, stars) => !stars || signature.split('>').some(word => stars.includes(word));

export const worthSolving = ({ chore, idle, undone, conflicts, crossings, signature }, index, stars) => {
  const bar = QUALITY_BARS.find(({ from }) => index >= from);
  return !chore && !idle && crossings <= MAX_CROSSINGS && undone >= 1 && undone + conflicts >= bar.depth && starredIn(signature, stars);
};

const roofOf = (floor, heights) => floor - heights.reduce((sum, h) => sum + h + 1, 0);
const span = (from, w) => Array.from({ length: w }, (_, i) => from + i);
const floorOf = cell => cell.band - cell.raise;
const ceilingOf = cell => cell.band - cell.height - 1;

function splitDeck(rng, wideGap) {
  const count = rng.int(1, 3);
  const gates = Array.from({ length: count - 1 }, () => (wideGap && rng.chance(WIDE_CHANCE) ? wideGap : 1));
  const open = COLS - gates.reduce((s, g) => s + g, 0);
  const slack = open - count * MIN_CELL;
  if (slack < 0) return splitDeck(rng, 0);
  const shares = Array.from({ length: count }, () => rng.int(0, 10));
  const total = shares.reduce((s, v) => s + v, 0) || 1;
  const widths = shares.map(v => MIN_CELL + Math.floor((v / total) * slack));
  widths[count - 1] += open - widths.reduce((s, w) => s + w, 0);
  return { widths, gates };
}

function floorplan(ctx, entry, top) {
  const { rng } = ctx;
  const floor = entry.row - FLOOR_LIFT;
  const shapes = SHAPES.filter(shape => roofOf(floor, shape) >= top);
  if (!shapes.length) return null;
  const heights = rng.pick(shapes);
  const reach = Math.ceil(ctx.profile.reach / TILE) + 1;
  const cells = [], sides = [], lifts = [];
  let band = floor;
  heights.forEach((height, deck) => {
    const { widths, gates } = splitDeck(rng, reach <= 12 ? reach : 0);
    let col = 0;
    widths.forEach((w, i) => {
      const id = cells.length;
      cells.push({ id, deck, col0: col, col1: col + w - 1, band, height, raise: 0 });
      col += w;
      if (i < gates.length) {
        sides.push({ side: true, a: id, b: id + 1, col0: col, col1: col + gates[i] - 1, wide: gates[i] > 1 });
        col += gates[i];
      }
    });
    band -= height + 1;
  });
  for (const low of cells) for (const high of cells) {
    if (high.deck !== low.deck + 1) continue;
    const from = Math.max(low.col0, high.col0), to = Math.min(low.col1, high.col1);
    if (to - from + 1 >= MIN_OVERLAP) lifts.push({ low: low.id, high: high.id });
  }
  const hatch = entry.col + Math.floor((entry.w - HATCH_W) / 2);
  const home = cells.find(c => c.deck === 0 && c.col0 <= hatch && hatch + HATCH_W - 1 <= c.col1);
  if (!home || cells.length > 8) return null;
  return { floor, roof: band, cells, sides, lifts, hatch, entry: home.id, tops: cells.filter(c => c.deck === heights.length - 1).map(c => c.id) };
}

function raiseStep(cells, rng, link) {
  const low = cells[link.low], high = cells[link.high];
  const raise = Math.min(2, low.raise + rng.int(1, 2));
  if (raise <= low.raise || high.raise || high.height < raise + 3) return false;
  high.raise = raise;
  return true;
}

function holeIn(sides, cell, under, w, rng) {
  const walled = sides.filter(e => e.a === cell.id || e.b === cell.id).map(e => (e.a === cell.id ? 1 : -1));
  const spots = [];
  if (!walled.includes(-1)) spots.push(cell.col0);
  if (!walled.includes(1)) spots.push(cell.col1 - w + 1);
  const free = c => span(c, w).every(x => !cell.taken.has(x) && (!under || (x >= under.col0 && x <= under.col1 && !under.taken.has(x))));
  const col = rng.shuffle(spots).find(free);
  if (col === undefined) return null;
  for (const x of span(col, w)) { cell.taken.add(x); under?.taken.add(x); }
  return col;
}

function claimSpot(cell, rng, w, far = []) {
  const options = [];
  for (let c = cell.col0; c + w - 1 <= cell.col1; c++) if (span(c, w).every(x => !cell.taken.has(x))) options.push(c);
  if (!options.length) return null;
  const clear = options.filter(c => far.every(a => Math.abs(c - a) >= 3));
  const col = rng.pick(clear.length ? clear : options);
  for (const x of span(col, w)) cell.taken.add(x);
  return col;
}

function carryingCells(riddle, solution) {
  const cells = new Set();
  let carrying = false, here = riddle.entry;
  for (const action of solution) {
    if (action.type === 'lift') carrying = true;
    else if (action.type !== 'cross' && action.type !== 'take') carrying = false;
    if (action.type === 'cross') here = action.to;
    if (carrying) cells.add(here);
  }
  return cells;
}

function layHurdles(ctx, plan, cells, solution, links) {
  const { rng, difficulty } = ctx;
  const loaded = carryingCells(plan.riddleBase, solution);
  const gates = plan.sides.flatMap(edge => [edge.col0, edge.col1]);
  const holes = links.filter(l => l.hole !== undefined).flatMap(l => span(l.hole - 1, HATCH_W + 2));
  const hurdles = [];
  for (const cell of cells) {
    if (loaded.has(cell.id) || cell.col1 - cell.col0 + 1 < HURDLE_MIN_CELL || !rng.chance(HURDLE_CHANCE + HURDLE_CHANCE_GROWTH * difficulty)) continue;
    const options = [];
    for (let c = cell.col0 + HURDLE_MARGIN; c + HURDLE_W + HURDLE_MARGIN <= cell.col1 + 1; c++) {
      const cols = span(c - 1, HURDLE_W + 2);
      if (cols.every(x => !cell.taken.has(x) && !holes.includes(x)) && gates.every(g => Math.abs(g - c) >= HURDLE_MARGIN)) options.push(c);
    }
    if (!options.length) continue;
    const col = rng.pick(options);
    for (const x of span(col, HURDLE_W)) cell.taken.add(x);
    hurdles.push({ cell: cell.id, col });
  }
  return hurdles;
}

function stationsOf(plan, solution) {
  const { riddle, cells } = plan;
  const at = riddle.crates.map(c => c.col);
  const hatchMiddle = plan.hatch + 1;
  const stations = [{ band: cells[plan.entry].band, col: hatchMiddle }];
  let here = plan.entry;
  const visit = (cell, col) => stations.push({ band: cells[cell].band, col });
  for (const action of solution) {
    const link = riddle.links[action.link];
    switch (action.type) {
      case 'lift': visit(here, action.plate !== undefined ? riddle.plates[action.plate].col : action.link !== undefined ? link.geometry.col0 : at[action.crate]); break;
      case 'set': at[action.crate] = stations.at(-1).col; break;
      case 'press': visit(here, riddle.plates[action.plate].col); at[action.crate] = riddle.plates[action.plate].col; break;
      case 'take':
      case 'pull': visit(here, riddle.pickups[action.pickup].col); break;
      case 'plug':
      case 'stone':
      case 'lob': visit(here, link.geometry.col0); at[action.crate] = link.geometry.col0; break;
      case 'chute':
      case 'launch': visit(here, link.hole); at[action.crate] = link.hole; break;
      case 'cross': {
        const col = link.geometry.side ? link.geometry.col0 : link.hole;
        visit(here, col);
        if (action.to !== EXIT) visit(action.to, col);
        here = action.to;
        break;
      }
    }
  }
  return stations;
}

export function walkFrom(stations) {
  const decks = new Set();
  let band = null, last = 0, heading = 0, turnbacks = 0, returns = 0;
  for (const station of stations) {
    if (station.band !== band) {
      if (decks.has(station.band)) returns++;
      decks.add(station.band);
      band = station.band;
      last = station.col;
      heading = 0;
      continue;
    }
    const moved = station.col - last;
    if (Math.abs(moved) < TURN_TILES) continue;
    if (heading && Math.sign(moved) !== heading) turnbacks++;
    heading = Math.sign(moved);
    last = station.col;
  }
  return { turnbacks, returns };
}

function bestFit(ctx, plan, riddle, solution) {
  let best = null;
  for (let n = 0; n < FITS; n++) {
    const fitted = fit(ctx, { ...plan, riddleBase: riddle }, riddle, solution);
    if (!fitted) continue;
    const { turnbacks, returns } = walkFrom(stationsOf(fitted, solution));
    const walk = TURN_VALUE * turnbacks + RETURN_VALUE * returns;
    if (!best || walk > best.walk) best = { plan: fitted, walk };
  }
  return best;
}

function fit(ctx, plan, riddle, solution) {
  const { rng } = ctx;
  const cells = plan.cells.map(c => ({ ...c, raise: 0, taken: new Set(c.id === plan.entry ? span(plan.hatch, HATCH_W) : []) }));
  const links = riddle.links.map(l => ({ ...l }));
  for (const link of links) if (link.kind === 'step' && !raiseStep(cells, rng, link)) link.kind = 'open';
  for (const link of links) {
    if (link.geometry.side) {
      if (link.kind !== 'step' && (cells[link.low].raise || cells[link.high].raise)) return null;
      continue;
    }
    const w = link.kind === 'spring' ? HATCH_W : HOLE_W;
    const col = link.high === EXIT ? holeIn(plan.sides, cells[link.low], null, w, rng) : holeIn(plan.sides, cells[link.high], cells[link.low], w, rng);
    if (col === null) return null;
    link.hole = col;
  }
  const gatesOf = bit => links.filter(l => l.bit & bit && l.geometry.side).map(l => l.geometry.col0);
  const plates = riddle.plates.map(p => ({ ...p, col: claimSpot(cells[p.cell], rng, PLATE_W, gatesOf(p.bit)) }));
  const pickups = riddle.pickups.map(p => {
    const cell = cells[p.cell];
    const shelf = p.type !== 'timer' && p.type !== 'lever' && cell.height - cell.raise >= SHELF_HEADROOM && rng.chance(SHELF_CHANCE);
    return { ...p, shelf, col: claimSpot(cell, rng, shelf ? SHELF_W : 1, gatesOf(p.bit)) };
  });
  const crates = riddle.crates.map(c => ({ ...c, col: claimSpot(cells[c.cell], rng, 1) }));
  if ([...plates, ...pickups, ...crates].some(p => p.col === null)) return null;
  const fitted = { ...riddle, links, plates, pickups, crates };
  return { ...plan, cells, riddle: fitted, hurdles: layHurdles(ctx, plan, cells, solution, links) };
}

const pairsOf = signature => {
  const words = signature.split('>');
  return words.slice(1).map((word, i) => `${words[i]}>${word}`);
};

function familiarity(signature, history) {
  const pairs = pairsOf(signature);
  if (!pairs.length) return 0;
  const seen = new Set(history.flatMap(h => (h.riddle ? pairsOf(h.riddle) : [])));
  return pairs.filter(pair => seen.has(pair)).length / pairs.length;
}

function scoreOf(appraisal, style, ctx) {
  const { work, revisits, reuse, temptations, idle, cells, gates, crossings, signature, undone, conflicts, chore } = appraisal;
  const bonus = Math.round(ctx.difficulty * DEPTH_WORK);
  const [low, high] = style.work.map(limit => limit + bonus);
  const off = work < low ? low - work : work > high ? work - high : 0;
  const trudge = Math.max(0, crossings - CROSSINGS_BEFORE_TRUDGE);
  const repeated = ctx.history.some(h => h.riddle === signature) ? REPEAT_PENALTY : 0;
  const starred = starredIn(signature, style.stars) ? STAR_BONUS : 0;
  return starred - 2 * off - 3 * idle + Math.min(MAX_UNDO_VALUE, undone) * UNDO_VALUE + Math.min(MAX_UNDO_VALUE, conflicts) * CONFLICT_VALUE - (chore ? CHORE_PENALTY : 0) + 0.5 * revisits + 1.5 * reuse + Math.min(temptations, 4) * 0.5 + 0.2 * cells + 0.6 * gates - 0.4 * trudge - repeated - FAMILIAR_PENALTY * familiarity(signature, ctx.history);
}

export function chamberPlans(ctx, style, entry, top) {
  const { rng } = ctx;
  const best = new Map();
  let plan = null;
  for (let n = 0; n < (style.circuit ? TUNED_COMPOSITIONS : COMPOSITIONS) && !(style.circuit && best.size >= ENOUGH_ROOMS); n++) {
    if (n % (style.circuit ? TUNED_PER_PLAN : PER_PLAN) === 0) plan = floorplan(ctx, entry, top);
    if (!plan) continue;
    const graph = { cells: plan.cells.length, entry: plan.entry, sides: plan.sides, lifts: plan.lifts, tops: plan.tops };
    let riddle = compose(graph, rng, style);
    if (!riddle) continue;
    let appraisal = appraise(riddle);
    let score = appraisal ? scoreOf(appraisal, style, ctx) : -Infinity;
    for (let t = 0; t < TWIST_TRIES && (style.twists || style.circuit); t++) {
      const twisted = style.circuit && (!style.twists || rng.chance(REWIRE_SHARE)) ? rewire(riddle, rng, style.circuit, style.stars) : twist(riddle, rng);
      const looked = twisted && appraise(twisted);
      if (!looked) continue;
      const better = scoreOf(looked, style, ctx);
      const passes = worthSolving(looked, ctx.index, style.stars), passed = appraisal && worthSolving(appraisal, ctx.index, style.stars);
      if (passes !== passed ? passes : better > score) { riddle = twisted; appraisal = looked; score = better; }
    }
    if (appraisal && worthSolving(appraisal, ctx.index, style.stars) && (best.get(appraisal.signature)?.score ?? -Infinity) < score) best.set(appraisal.signature, { source: plan, riddle, appraisal, score });
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score).slice(0, RANKED_RIDDLES);
  const walked = ranked.flatMap(({ source, riddle, appraisal, score }) => {
    const fitted = bestFit(ctx, source, riddle, appraisal.solution);
    return fitted?.walk > 0 ? [{ plan: fitted.plan, appraisal, score: score + Math.min(MAX_WALK_BONUS, fitted.walk) }] : [];
  });
  return walked.sort((a, b) => b.score - a.score).slice(0, PROVEN_PLANS);
}

function roomy(ctx, plan) {
  const rect = { x: 0, y: plan.roof * TILE, w: COLS * TILE, h: (plan.floor - plan.roof) * TILE };
  return !ctx.level.objects.some(o => o.type !== 'checkpoint' && overlaps(o.x, o.y + Math.min(0, o.dy ?? 0), o.w + Math.abs(o.dx ?? 0), o.h + Math.abs(o.dy ?? 0), rect));
}

function carve(ctx, plan) {
  const { level } = ctx;
  fillTiles(level, 0, plan.roof, COLS, plan.floor - plan.roof + 1, SOLID);
  for (const cell of plan.cells) {
    fillTiles(level, 0, ceilingOf(cell) + 1, COLS, cell.height, EMPTY);
  }
  for (const cell of plan.cells) if (cell.raise) fillTiles(level, cell.col0, floorOf(cell), cell.col1 - cell.col0 + 1, cell.raise, SOLID);
  for (const edge of plan.sides) {
    const raises = plan.cells.filter(c => c.id === edge.a || c.id === edge.b).map(c => c.raise);
    const raise = Math.max(...raises);
    if (raise && raises.includes(0)) fillTiles(level, edge.col0, plan.cells[edge.a].band - raise, edge.col1 - edge.col0 + 1, raise, SOLID);
  }
  fillTiles(level, plan.hatch, plan.floor, HATCH_W, 1, ONE_WAY);
}

function sealBands(ctx, plan) {
  const { level } = ctx;
  const bands = new Set([plan.floor, plan.roof, ...plan.cells.map(cell => cell.band)]);
  ctx.seals.push(...[...bands].map(row => ({ row, tiles: Array.from({ length: COLS }, (_, c) => level.tiles[row * COLS + c]) })));
}

function ladderAt(ctx, col, top, bottom) {
  return addObject(ctx.level, { type: 'climb', x: col * TILE + 5, y: top * TILE, w: TILE - 10, h: (bottom - top) * TILE });
}

function springAt(ctx, col, bottom, top) {
  const { rules, size } = ctx;
  const vel = Math.sqrt(2 * rules.gravity * ((bottom - top) * TILE + size.h + 24));
  return addObject(ctx.level, { type: 'spring', x: col * TILE + 4, y: bottom * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel });
}

function signalOf(link, bits, rect, rise = GATE_RISE) {
  if (!link.gate) return { bit: bits(link.bit) };
  const local = mask => Array.from({ length: 7 }, (_, i) => 1 << i).filter(b => mask & b).reduce((all, b) => all | bits(b), 0);
  const shaft = !link.geometry.side;
  const inward = rect.x + rect.w / 2 < (COLS * TILE) / 2 ? rect.w + SHAFT_GATE_SIDE : -SHAFT_GATE_SIDE;
  const place = shaft ? { x: rect.x + inward, y: rect.y + rect.h + rise, dir: -1 } : { x: rect.x + rect.w / 2, y: rect.y - rise, dir: 1 };
  const gate = { op: link.gate.op, mask: local(link.gate.mask), not: local(link.gate.not), ...place };
  return { bit: gate.mask, gate };
}

function lockObject(ctx, link, bits, viaPlate, rect) {
  const inverse = link.kind === 'shutter' || link.kind === 'trapdoor';
  const signal = signalOf(link, bits, rect);
  return addObject(ctx.level, inverse ? { type: 'toggle', on: true, ...signal, ...rect } : { type: 'door', plate: viaPlate(link.bit), ...signal, ...rect });
}

function buildShaft(ctx, plan, link, bits, viaPlate) {
  const { level } = ctx;
  const low = plan.cells[link.low], exit = link.high === EXIT;
  const top = exit ? plan.roof : floorOf(plan.cells[link.high]);
  const thick = exit ? 1 : plan.cells[link.high].raise + 1;
  const w = link.kind === 'spring' ? HATCH_W : HOLE_W;
  fillTiles(level, link.hole, top, w, thick, EMPTY);
  const floorSide = link.hole === (exit ? low.col0 : plan.cells[link.high].col0) ? 1 : -1;
  const ladder = floorSide > 0 ? link.hole + w - 1 : link.hole;
  link.ladder = ladder;
  link.top = top;
  if (link.kind === 'spring') {
    fillTiles(level, link.hole, top, w, 1, ONE_WAY);
    springAt(ctx, link.hole + 1, floorOf(low), top);
    return;
  }
  if (link.kind !== 'drop') ladderAt(ctx, ladder, top, floorOf(low));
  if (link.bit) lockObject(ctx, link, bits, viaPlate, { x: link.hole * TILE, y: top * TILE, w: w * TILE, h: TILE });
}

const doorRows = ctx => Math.ceil((ctx.size.h + CRATE_SIZE + DOOR_HEADROOM) / TILE);

function buildSide(ctx, plan, link, bits, viaPlate, fuses) {
  const { level } = ctx;
  const { col0, col1 } = link.geometry;
  const cell = plan.cells[link.low];
  const interior = cell.height, top = ceilingOf(cell) + 1, y = top * TILE, h = interior * TILE, ground = cell.band * TILE;
  const w = (col1 - col0 + 1) * TILE;
  switch (link.kind) {
    case 'door':
    case 'shutter': {
      const rows = doorRows(ctx);
      fillTiles(level, col0, top, 1, interior - rows, SOLID);
      lockObject(ctx, link, bits, viaPlate, { x: col0 * TILE, y: ground - rows * TILE, w: TILE, h: rows * TILE });
      break;
    }
    case 'beam':
    case 'plug':
      addObject(level, { type: 'laser', steady: true, x: col0 * TILE + 11, y, w: 8, h, dir: link.kind === 'beam' ? 1 : -1, period: ALWAYS, on: ALWAYS, phase: 0 });
      break;
    case 'portal': {
      fillTiles(level, col0, top, 1, interior, SOLID);
      const portalAt = col => ({ type: 'portal', x: col * TILE + 5, y: ground - 34, w: 20, h: 34 });
      const a = addObject(level, { ...portalAt(col0 - 1), target: -1 });
      a.target = addObject(level, { ...portalAt(col0 + 1), target: a.id }).id;
      break;
    }
    case 'fuse': {
      const rows = doorRows(ctx);
      fillTiles(level, col0, top, 1, interior - rows, SOLID);
      addObject(level, { type: 'door', timer: fuses(), open: FUSE_OPEN, x: col0 * TILE, y: ground - rows * TILE, w: TILE, h: rows * TILE });
      break;
    }
    case 'pit':
      addObject(level, { type: 'spikes', x: col0 * TILE, y: ground - SPIKE_H, w, h: SPIKE_H, dir: -1 });
      break;
    case 'bridge':
      addObject(level, { type: 'spikes', x: col0 * TILE, y: ground - SPIKE_H, w, h: SPIKE_H, dir: -1 });
      {
        const rect = { x: col0 * TILE, y: ground - SPIKE_H, w, h: SPIKE_H };
        addObject(level, { type: 'toggle', on: true, ...signalOf(link, bits, rect, BRIDGE_GATE_RISE), ...rect });
      }
      break;
  }
}

const restOf = (plan, pickup) => floorOf(plan.cells[pickup.cell]) - (pickup.shelf ? SHELF_RISE : 0);

function positionOf(plan, cellId, col, size) {
  return { x: (col + 0.5) * TILE, y: floorOf(plan.cells[cellId]) * TILE - size.h / 2 };
}

const stand = (plan, cellId, col, size, w = 3 * TILE) => ({ ...positionOf(plan, cellId, col, size), w, firm: true });

function middleOf(cell) {
  return Math.floor((cell.col0 + cell.col1) / 2);
}

function crossingPoints(plan, link, action, size) {
  if (link.geometry.side) {
    const { col0, col1 } = link.geometry;
    const toward = plan.cells[action.to].col0 > col1 ? 1 : -1;
    const near = toward > 0 ? col1 + 2 : col0 - 2;
    const stone = { x: ((col0 + col1 + 1) / 2) * TILE, y: plan.cells[link.low].band * TILE - SPIKE_H - CRATE_SIZE - size.h / 2, w: 4 * TILE, firm: true };
    return [...(link.kind === 'pit' ? [stone] : []), stand(plan, action.to, near, size)];
  }
  const cells = plan.cells, low = cells[link.low];
  const bottom = floorOf(low), up = link.low === action.from;
  const exit = link.high === EXIT;
  const top = link.top;
  if (link.kind === 'spring') return up ? [stand(plan, link.low, link.hole + 1, size, TILE)] : [];
  const x = (link.ladder + 0.5) * TILE;
  const rungs = [];
  for (let row = bottom - LADDER_STEP; row > top; row -= LADDER_STEP) rungs.push({ x, y: row * TILE, w: TILE });
  const base = { x, y: bottom * TILE - size.h / 2, w: 2 * TILE };
  if (exit) return [base, ...rungs];
  const landing = stand(plan, link.high, link.ladder + (link.hole === cells[link.high].col0 ? 2 : -2), size, 2 * TILE);
  if (up) return [base, ...rungs, landing];
  return [landing, base];
}

const throwRange = ({ rules }) => THROW_VX * ((THROW_VY + Math.sqrt(THROW_VY ** 2 + 2 * rules.gravity * THROW_DROP)) / rules.gravity);

function crateRoute(ctx, plan, riddle, solution, crates, bits, timers) {
  const { size } = ctx;
  const route = [];
  const at = riddle.crates.map(c => ({ x: (c.col + 0.5) * TILE, y: floorOf(plan.cells[c.cell]) * TILE - CRATE_SIZE / 2 }));
  let here = plan.entry;
  const rest = (k, x, row, within, sunk = 0, flies = false) => {
    at[k] = { x, y: row * TILE - CRATE_SIZE / 2 - sunk };
    route.push({ x, y: row * TILE - size.h / 2, body: crates[k].slot, tx: x, ty: at[k].y, within, once: true, flies });
  };
  let weighted = 0, flipped = 0;
  const nearGate = gate => {
    const before = plan.cells[here].col0 > gate.col1 ? gate.col1 + 2 : gate.col0 - 2;
    route.push(stand(plan, here, before, size, 2 * TILE));
  };
  for (const action of solution) {
    const link = riddle.links[action.link];
    const before = route.length;
    switch (action.type) {
      case 'lift':
        if (action.plate !== undefined) weighted &= ~bits(riddle.plates[action.plate].bit);
        route.push({ x: at[action.crate].x, y: at[action.crate].y, hold: crates[action.crate].slot });
        break;
      case 'set': {
        const cell = plan.cells[action.cell];
        rest(action.crate, (middleOf(cell) + 0.5) * TILE, floorOf(cell), ((cell.col1 - cell.col0) / 2 + 0.5) * TILE);
        break;
      }
      case 'press': {
        const plate = riddle.plates[action.plate];
        route.push(stand(plan, plate.cell, plate.col + 1, size, 4 * TILE));
        rest(action.crate, (plate.col + 1) * TILE, floorOf(plan.cells[plate.cell]), (PLATE_W * TILE) / 2 + 4);
        break;
      }
      case 'plug':
        nearGate(link.geometry);
        rest(action.crate, (link.geometry.col0 + 0.5) * TILE, plan.cells[link.low].band, PLUG_WITHIN);
        break;
      case 'stone': {
        const middle = ((link.geometry.col0 + link.geometry.col1 + 1) / 2) * TILE, toward = plan.cells[here].col0 > link.geometry.col1 ? -1 : 1;
        route.push({ x: middle - toward * throwRange(ctx), y: floorOf(plan.cells[here]) * TILE - size.h / 2, w: 1.5 * TILE, firm: true });
        rest(action.crate, ((link.geometry.col0 + link.geometry.col1 + 1) / 2) * TILE, plan.cells[link.low].band, STONE_WITHIN, SPIKE_H, true);
        break;
      }
      case 'lob': {
        nearGate(link.geometry);
        const cell = plan.cells[action.to];
        rest(action.crate, (middleOf(cell) + 0.5) * TILE, floorOf(cell), ((cell.col1 - cell.col0) / 2 + 1) * TILE, 0, true);
        break;
      }
      case 'chute': {
        const high = plan.cells[link.high];
        route.push(stand(plan, link.high, link.hole === high.col0 ? link.hole + 3 : link.hole - 2, size, 2 * TILE));
        rest(action.crate, (link.hole + 1) * TILE, floorOf(plan.cells[link.low]), 3 * TILE, 0, true);
        break;
      }
      case 'launch': {
        route.push(stand(plan, link.low, link.hole + 1, size, 4 * TILE));
        rest(action.crate, (link.hole + 1.5) * TILE, floorOf(plan.cells[link.high]), 4 * TILE, 0, true);
        break;
      }
      case 'take': {
        const pickup = riddle.pickups[action.pickup];
        const spot = { x: (pickup.col + 0.5) * TILE, y: restOf(plan, pickup) * TILE - size.h / 2 };
        route.push(timers.has(pickup) ? { x: spot.x, y: spot.y, timer: timers.get(pickup).slot } : { x: spot.x, y: spot.y, bit: bits(pickup.bit) });
        break;
      }
      case 'pull': {
        const pickup = riddle.pickups[action.pickup], bit = bits(pickup.bit);
        flipped ^= bit;
        route.push({ x: (pickup.col + 0.5) * TILE, y: floorOf(plan.cells[pickup.cell]) * TILE - size.h / 2, bit, on: (flipped & bit) !== 0, once: true });
        break;
      }
      case 'cross':
        route.push(...crossingPoints(plan, link, action, size));
        here = action.to;
        break;
    }
    if (weighted) for (const point of route.slice(before)) point.pressed = weighted;
    if (action.type === 'press') weighted |= bits(riddle.plates[action.plate].bit);
  }
  return route;
}

function layWires(ctx, plan, firstObject) {
  const { level } = ctx;
  const objects = level.objects.slice(firstObject);
  const center = o => [o.x + o.w / 2, o.y + o.h / 2];
  const sourceOf = o => o.type === 'plate' || o.type === 'key' || o.type === 'switch' || o.type === 'lever';
  const cellAt = source => plan.cells.find(c => source.y < floorOf(c) * TILE && source.y >= ceilingOf(c) * TILE && source.x >= c.col0 * TILE && source.x < (c.col1 + 1) * TILE);
  objects.filter(sourceOf).forEach((source, lane) => {
    const [sx, sy] = center(source);
    const rail = (ceilingOf(cellAt(source)) + 1) * TILE + WIRE_LANE * (lane + 1);
    for (const lock of objects.filter(o => (o.type === 'door' || o.type === 'toggle') && o.bit & source.bit)) {
      const [lx, ly] = lock.gate ? gatePins(lock.gate).find(pin => pin.bit === source.bit).at : center(lock);
      level.wires.push({ bit: source.bit, points: [[sx, sy], [sx, rail], [lx, rail], [lx, ly]] });
    }
  });
  for (const lock of objects.filter(o => o.gate)) {
    const [lx, ly] = center(lock);
    level.wires.push({ gate: lock.gate, points: [[lock.gate.x, lock.gate.y], [lock.gate.x, ly], [lx, ly]] });
  }
  for (const timer of objects.filter(o => o.type === 'timer')) {
    const [sx, sy] = center(timer);
    const rail = (ceilingOf(cellAt(timer)) + 1) * TILE + WIRE_LANE;
    for (const door of objects.filter(o => o.type === 'door' && o.timer === timer.slot)) {
      const [lx, ly] = center(door);
      level.wires.push({ timer: timer.slot, points: [[sx, sy], [sx, rail], [lx, rail], [lx, ly]] });
    }
  }
}

function coinRests(plan, appraisal) {
  const walked = new Set(appraisal.solution.flatMap(a => (a.type === 'cross' ? [a.from, a.to] : [])));
  const others = plan.cells.filter(c => c.id !== plan.entry);
  const ordered = [...others.filter(c => !walked.has(c.id)), ...others.filter(c => walked.has(c.id))];
  const clearCol = cell => [...span(cell.col0, cell.col1 - cell.col0 + 1)].sort((a, b) => Math.abs(a - middleOf(cell)) - Math.abs(b - middleOf(cell))).find(col => !cell.taken.has(col)) ?? middleOf(cell);
  return ordered.map(c => ({ col: clearCol(c), row: floorOf(c), w: 1, kind: 'tiles' }));
}

export function raiseChamber(ctx, candidate, entry) {
  const { level } = ctx;
  const { plan, appraisal } = candidate;
  const { riddle } = plan;
  const local = new Map();
  const bits = bit => {
    if (!local.has(bit)) { local.set(bit, ctx.nextBit); ctx.nextBit <<= 1; }
    return local.get(bit);
  };
  const viaPlate = bit => riddle.plates.some(p => p.bit === bit);
  carve(ctx, plan);
  const added = level.objects.length;
  const timers = new Map();
  for (const pickup of riddle.pickups.filter(p => p.type === 'timer')) timers.set(pickup, addObject(level, { type: 'timer', x: (pickup.col + 0.5) * TILE - 8, y: (floorOf(plan.cells[pickup.cell]) - 1) * TILE + 6, w: 16, h: 18, open: FUSE_OPEN }));
  const fuses = () => [...timers.values()][0].slot;
  for (const link of riddle.links) (link.geometry.side ? buildSide : buildShaft)(ctx, plan, link, bits, viaPlate, fuses);
  for (const plate of riddle.plates) {
    addObject(level, { type: 'plate', x: plate.col * TILE + 2, y: floorOf(plan.cells[plate.cell]) * TILE - 6, w: PLATE_W * TILE - 4, h: 6, bit: bits(plate.bit) });
  }
  for (const pickup of riddle.pickups.filter(p => p.type !== 'timer')) {
    const rest = restOf(plan, pickup);
    if (pickup.shelf) fillTiles(level, pickup.col, rest, SHELF_W, 1, SOLID);
    const bit = bits(pickup.bit);
    if (pickup.type === 'lever') addObject(level, { type: 'lever', x: (pickup.col + 0.5) * TILE - LEVER_W / 2, y: rest * TILE - LEVER_H, w: LEVER_W, h: LEVER_H, bit });
    else addObject(level, { type: pickup.type, x: (pickup.col + 0.5) * TILE - 8, y: (rest - 1) * TILE + 6, w: 16, h: 18, bit });
  }
  for (const { cell, col } of plan.hurdles) addObject(level, { type: 'spikes', x: col * TILE + 2, y: floorOf(plan.cells[cell]) * TILE - SPIKE_H, w: HURDLE_W * TILE - 4, h: SPIKE_H, dir: -1 });
  const crates = riddle.crates.map(c => addObject(level, { type: 'crate', kind: c.kind, x: c.col * TILE + (TILE - CRATE_SIZE) / 2, y: floorOf(plan.cells[c.cell]) * TILE - CRATE_SIZE, w: CRATE_SIZE, h: CRATE_SIZE }));
  sealBands(ctx, plan);
  layWires(ctx, plan, added);
  const exit = riddle.links.find(l => l.high === EXIT);
  const w = exit.kind === 'spring' ? HATCH_W : HOLE_W;
  const col = exit.hole + w + TOP_W <= COLS ? exit.hole + w : exit.hole - TOP_W;
  const top = { col, row: plan.roof, w: TOP_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: col < COLS / 2 ? 1 : -1 };
  if (ctx.cave) fillTiles(level, Math.min(col, exit.hole), plan.roof - ctx.clearance, TOP_W + w, ctx.clearance, EMPTY);
  const route = [
    { x: (plan.hatch + HATCH_W / 2) * TILE, y: plan.floor * TILE - ctx.size.h / 2, w: 3 * TILE },
    ...crateRoute(ctx, plan, riddle, appraisal.solution, crates, bits, timers),
    { x: (top.col + TOP_W / 2) * TILE, y: plan.roof * TILE - ctx.size.h / 2, w: TOP_W * TILE },
  ];
  return { top, route, nodes: [entry, top], signature: appraisal.signature, logic: { work: appraisal.work, undone: appraisal.undone, conflicts: appraisal.conflicts, chore: appraisal.chore }, bounds: { roof: plan.roof, floor: plan.floor, bands: [...new Set(plan.cells.map(cell => cell.band))] }, rests: coinRests(plan, appraisal), footprint: { col: 0, row: plan.floor + 1, w: COLS, span: plan.floor + 1 - plan.roof - 3, kind: 'air' } };
}

export const chamberFits = (ctx, candidate) => roomy(ctx, candidate.plan);
