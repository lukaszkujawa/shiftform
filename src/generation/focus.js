import { PUZZLES } from './features.js?v=ececfed';
import { rigsPossible } from './moves.js?v=ececfed';

const SLOW = 240;
const FAST = 120;
const BUDGET_BASE = 6;
const BUDGET_GROWTH = 8;
const stage = (puzzles, features = {}, tempo = null, connectors = null, connector = null, moves = null, riddle = null) => ({ puzzles, features, tempo, connectors, connector, moves, riddle });

const GENTLE = { hop: 4, stair: 2, run: 2, shaft: 2 };
const STAIRS = { hop: 2, stair: 4, run: 1, shaft: 2 };
const LEAPS = { hop: 3, leap: 3, run: 2, drop: 1, shaft: 2, soar: 1, fork: 2, rig: 1 };
const CRYSTALS = { hop: 2, soar: 3, shaft: 2, run: 1 };
const SHAFTS = { hop: 3, shaft: 4, run: 1, drop: 1 };
const SWINGS = { hop: 2, rig: 5, run: 1, shaft: 1 };
const BLASTS = { hop: 2, rig: 5, leap: 1, shaft: 1 };
const rigged = (rigs, spec) => ({ ...spec, rigs });
const MIXED = { hop: 3, stair: 2, leap: 2, run: 1, shaft: 2, drop: 1, fork: 1, rig: 1 };
const COMBOS = { hop: 4, leap: 4, stair: 2, fork: 2, soar: 1, rig: 1, shaft: 1 };
const TIGHTEN_FROM = 0.5;
const COMBOS_FROM = 0.75;

export const actionBudget = difficulty => BUDGET_BASE + Math.round(BUDGET_GROWTH * difficulty);

const WALKS = { open: 3, step: 2, ladder: 3, spring: 1, drop: 1 };
const PLATES = { plate: 3, lever: 1 };
const LOCKS = { lever: 3, key: 1, switch: 1 };
const ANY_SIGNAL = { plate: 3, lever: 3, key: 1, switch: 1 };
const LEVERS = { lever: 3, plate: 1 };
const WIRED_LOCKS = { door: 3, hatch: 3, bridge: 1 };
const NEGATED_GATES = { ops: ['and', 'or'], locks: [1, 2], negate: 0.5 };
const EVERY_GATE = { ops: ['and', 'or', 'xor'], locks: [2, 3], negate: 0.5 };
const riddle = (low, high, sources, gates, twists = false, stars = null, circuit = NEGATED_GATES) => ({ work: [low, high], sources, gates: { ...WALKS, ...gates }, twists, stars, circuit });
const wired = (low, high, circuit) => riddle(low, high, LEVERS, WIRED_LOCKS, false, null, circuit);
const starring = (stars, stages) => stages.map(spec => (spec.riddle ? { ...spec, riddle: { ...spec.riddle, stars } } : spec));
const chamber = (style, moves = GENTLE) => stage(null, {}, null, null, null, moves, style);
const WARM_UP = stage(null, {}, SLOW, null, null, GENTLE);
const EASING = stage(null, {}, null, null, null, GENTLE);
const ROOM_FROM_STRETCH = 2;
const INTERLUDE = riddle(2, 4, ANY_SIGNAL, { door: 3, hatch: 3, beam: 2, plug: 1, pit: 1, portal: 1 });
const INTERLUDE_STAGES = [{ stage: 2, from: 2 }, { stage: 1, from: 5 }];
const RIDDLE_FOCUS_WEIGHT = 4;
const PUZZLE_ROOMS = false;
const RIGGED_FOCUS_WEIGHT = 2;

const FOCUSES = [
  { id: 'first', title: 'First Steps', from: 0, until: 0, stages: [
    stage(null, {}, null, 0, null, { hop: 1 }), stage(null, {}, null, 1, null, { hop: 3, shaft: 2 }), stage(null, { mover: 1 }, SLOW, 0, null, { hop: 3, run: 1 }), stage(null, { crumble: 1, oneway: 1 }, null, 0, null, { hop: 3, stair: 1 }),
  ] },
  { id: 'strides', title: 'First Strides', from: 0, until: 0, stages: [
    stage(null, {}, null, 0, null, { run: 3, hop: 2, leap: 1 }), stage(null, { oneway: 1 }, null, 1, null, { hop: 2, leap: 2, drop: 1, shaft: 1 }), stage(null, { crumble: 1 }, null, 0, null, { run: 2, hop: 2, fork: 1 }), stage(null, { mover: 1 }, SLOW, 1, null, { hop: 3, leap: 1, shaft: 1 }),
  ] },
  { id: 'flights', title: 'First Flights', from: 0, until: 0, stages: [
    stage(null, {}, null, 0, null, { stair: 3, hop: 2 }), stage(null, { mover: 1 }, SLOW, 0, null, { hop: 2, stair: 1, run: 1 }), stage(null, {}, null, 2, null, { shaft: 3, hop: 2, drop: 1 }), stage(null, { crumble: 1, oneway: 1 }, null, 0, null, { hop: 2, stair: 2, fork: 1 }),
  ] },
  { id: 'crates', title: 'Crate Works', from: 1, riddles: true, stages: starring(['press'], [
    WARM_UP, EASING, chamber(riddle(3, 5, PLATES, { door: 3, hatch: 3, step: 3 })), chamber(riddle(4, 7, PLATES, { door: 2, hatch: 3, step: 2, bridge: 2 }, true)),
  ]) },
  { id: 'locks', title: 'Locksmith', from: 1, riddles: true, stages: starring(['and', 'or', 'xor'], [
    WARM_UP, EASING, chamber(riddle(3, 4, LOCKS, { door: 3, hatch: 2, bridge: 3 })), chamber(riddle(4, 6, LOCKS, { door: 3, hatch: 3, bridge: 2 }, true)),
  ]) },
  { id: 'circuits', title: 'Live Wires', from: 2, riddles: true, stages: starring(['and', 'or', 'xor'], [
    WARM_UP, EASING, chamber(wired(3, 6, NEGATED_GATES)), chamber(wired(4, 8, EVERY_GATE)),
  ]) },
  { id: 'lights', title: 'Cold Light', from: 2, riddles: true, stages: starring(['beam', 'plug'], [
    WARM_UP, EASING, chamber(riddle(3, 4, ANY_SIGNAL, { plug: 4, hatch: 1 })), chamber(riddle(4, 7, ANY_SIGNAL, { beam: 3, plug: 3, hatch: 2, door: 2 }, true)),
  ]) },
  { id: 'stones', title: 'Stepping Stones', from: 2, riddles: true, stages: starring(['stone'], [
    WARM_UP, EASING, chamber(riddle(3, 5, ANY_SIGNAL, { pit: 4, bridge: 2, hatch: 2 })), chamber(riddle(4, 7, ANY_SIGNAL, { pit: 3, beam: 2, bridge: 2, hatch: 2 }, true)),
  ]) },
  { id: 'wormholes', title: 'Wormholes', from: 3, riddles: true, stages: starring(['portal'], [
    WARM_UP, EASING, chamber(riddle(3, 5, ANY_SIGNAL, { portal: 4, beam: 2, hatch: 2 })), chamber(riddle(4, 7, ANY_SIGNAL, { portal: 3, plug: 2, pit: 2, hatch: 2 }, true)),
  ]) },
  { id: 'stopwatch', title: 'Stopwatch', from: 2, riddles: true, stages: starring(['fuse'], [
    WARM_UP, EASING, chamber(riddle(2, 4, ANY_SIGNAL, { fuse: 5, door: 2, hatch: 2 })), chamber(riddle(3, 6, ANY_SIGNAL, { fuse: 5, beam: 2, hatch: 2 }, true)),
  ]) },
  { id: 'lab', title: 'The Lab', from: 4, riddles: true, stages: [
    WARM_UP, EASING, chamber(riddle(5, 7, ANY_SIGNAL, { door: 3, beam: 3, plug: 2, pit: 3, bridge: 2, hatch: 3, portal: 1, fuse: 1 }, true, null, EVERY_GATE)), chamber(riddle(6, 9, ANY_SIGNAL, { door: 3, beam: 3, plug: 2, pit: 3, bridge: 2, hatch: 3, portal: 1, fuse: 1 }, true, null, EVERY_GATE)),
  ] },
  { id: 'momentum', title: 'Momentum', from: 1, rigged: true, stages: [
    rigged(['pendulum'], stage(null, {}, SLOW, 1, null, SWINGS)), rigged(['rail', 'pendulum'], stage(null, {}, SLOW, 1, null, SWINGS)), rigged(['wheel', 'rail'], stage(null, {}, null, 1, null, SWINGS)), rigged(['wheel', 'pendulum', 'rail'], stage(null, { crumble: 1 }, FAST, 1, null, SWINGS)),
  ] },
  { id: 'cannons', title: 'Cannonade', from: 1, rigged: true, unsteered: true, stages: [
    rigged(['cannon'], stage(null, {}, null, 1, null, BLASTS)), rigged(['cannon'], stage(null, {}, null, 1, null, BLASTS)), rigged(['cannon', 'pendulum'], stage(null, { crumble: 1 }, null, 1, null, BLASTS)), rigged(['cannon', 'wheel'], stage(null, { saw: 1 }, FAST, 1, null, BLASTS)),
  ] },
  { id: 'phase', title: 'Phase Shift', from: 1, stages: [
    stage(null, { phase: 1 }, SLOW, null, null, GENTLE), stage(['swing'], { phase: 2 }, SLOW, null, null, MIXED), stage(null, { phase: 2, mover: 1 }, null, null, null, MIXED), stage(null, { phase: 3, spikeStrip: 1 }, FAST, null, null, LEAPS),
  ] },
  { id: 'movers', title: 'Moving Parts', from: 1, stages: [
    stage(null, { mover: 1 }, SLOW, null, null, GENTLE), stage(null, { mover: 2 }, SLOW, null, null, MIXED), stage(['swing'], { mover: 2 }, null, null, null, MIXED), stage(null, { mover: 3 }, FAST, null, null, LEAPS),
  ] },
  { id: 'crumbles', title: 'Crumbling Heights', from: 1, stages: [
    stage(null, { crumble: 2 }, null, null, null, STAIRS), stage(['swing'], { crumble: 2 }, null, null, null, STAIRS), stage(null, { crumble: 2, fuse: 1 }, null, null, null, MIXED), stage(null, { crumble: 3, fuse: 2, floatingSpike: 1 }, null, null, null, STAIRS),
  ] },
  { id: 'swing', title: 'Swingers', from: 2, stages: [
    stage(['swing'], {}, null, null, null, MIXED), stage(['swing'], { gust: 1 }, null, null, null, LEAPS), stage(['swing'], { laser: 1 }, null, null, null, MIXED), stage(['swing'], { saw: 1, crumble: 1 }, null, null, null, LEAPS),
  ] },
  { id: 'timing', title: 'Clockwork', from: 1, stages: [
    stage(null, { laser: 1 }, SLOW, null, null, GENTLE), stage(null, { gate: 1, laser: 1 }, SLOW, null, null, LEAPS), stage(['swing'], { laser: 2, fuse: 1 }, null, null, null, LEAPS), stage(null, { laser: 2, gate: 2 }, FAST, null, null, MIXED),
  ] },
  { id: 'saws', title: 'Blade Run', from: 1, stages: [
    stage(null, { saw: 1 }, SLOW, null, null, LEAPS), stage(null, { saw: 2 }, SLOW, null, null, LEAPS), stage(['swing'], { saw: 1, conveyor: 1 }, null, null, null, MIXED), stage(null, { saw: 3 }, FAST, null, null, LEAPS),
  ] },
  { id: 'bouncer', title: 'Bouncer', from: 1, stages: [
    stage(null, {}, SLOW, 2, 'bounce', SHAFTS), stage(['bumperGap', 'swing'], {}, SLOW, 1, 'bounce', SHAFTS), stage(['bumperGap'], { saw: 1 }, null, 1, 'bounce', MIXED), stage(['bumperGap'], { crumble: 1 }, FAST, 2, 'bounce', SHAFTS),
  ] },
  { id: 'wind', title: 'Wind Tunnel', from: 2, stages: [
    stage(null, { gust: 1 }, SLOW, 1, 'updraft', SHAFTS), stage(null, { gust: 1 }, null, 2, 'updraft', SHAFTS), stage(['swing'], { gust: 1, crumble: 1 }, null, 1, 'updraft', MIXED), stage(null, { gust: 2, laser: 1 }, FAST, 2, 'updraft', SHAFTS),
  ] },
  { id: 'walls', title: 'Wallrun', from: 2, stages: [
    stage(null, {}, SLOW, 1, 'cling', SHAFTS), stage(null, { crumble: 1 }, null, 2, 'cling', SHAFTS), stage(['swing'], { laser: 1 }, null, 1, 'cling', MIXED), stage(null, { saw: 1 }, FAST, 2, 'cling', SHAFTS),
  ] },
  { id: 'crystals', title: 'Crystal Climb', from: 2, stages: [
    stage(null, {}, SLOW, 1, 'refill', CRYSTALS), stage(null, { laser: 1 }, null, 2, 'refill', CRYSTALS), stage(['swing'], { crumble: 1 }, null, 1, 'refill', MIXED), stage(null, { saw: 1 }, FAST, 2, 'refill', CRYSTALS),
  ] },
  { id: 'water', title: 'Waterworks', from: 2, open: true, stages: [
    stage(null, { pool: 1 }, SLOW, 1, 'swim', SHAFTS), stage(null, { pool: 2 }, null, 1, 'swim', LEAPS), stage(null, { pool: 1, laser: 1 }, null, 2, 'swim', SHAFTS), stage(null, { pool: 2, crumble: 1 }, FAST, 1, 'swim', MIXED),
  ] },
];

const shownIn = history => new Set(history.flatMap(h => h.shown ?? []));

export const introduces = (ctx, spec) => {
  if (!ctx.history.length) return false;
  const shown = shownIn(ctx.history);
  return [...Object.keys(spec.features ?? {}), ...(spec.connector ? [spec.connector] : [])].some(id => !shown.has(id));
};

export const unseen = (ctx, ids) => {
  const shown = shownIn(ctx.history);
  return ctx.history.length ? ids.filter(id => !shown.has(id)) : [];
};

export function hardened(spec, difficulty, fresh = false) {
  if (difficulty < TIGHTEN_FROM || fresh) return spec;
  const moves = spec.moves !== GENTLE ? spec.moves : difficulty >= COMBOS_FROM ? COMBOS : LEAPS;
  return { ...spec, moves, tempo: spec.tempo === SLOW ? null : spec.tempo };
}

const chamberAllowed = ctx => !ctx.needsCeiling && !ctx.rules.flood && !ctx.rules.jumpBudget && !ctx.rules.wrapY && !ctx.rules.blinkJump && ctx.rules.baseGravDir > 0;

export function stageRiddle(ctx, spec) {
  const k = ctx.level.segments.length;
  if (!k || !ctx.index || !chamberAllowed(ctx)) return null;
  if (ctx.level.segments.some(segment => segment.bounds)) return null;
  if (ctx.focus.riddles) return k >= ROOM_FROM_STRETCH ? spec.riddle : null;
  return PUZZLE_ROOMS && INTERLUDE_STAGES.some(({ stage: at, from }) => at === k && ctx.index >= from) ? INTERLUDE : null;
}

export function stagePuzzles(ctx, spec) {
  if (!spec.puzzles) return [];
  return PUZZLES.filter(p => spec.puzzles.includes(p.id) && !(ctx.cave && p.openOnly) && (!p.allowed || p.allowed(ctx)));
}

export const BUILDER_STYLES = FOCUSES.filter(f => !f.riddles).map(({ id, title }) => ({ id, title }));

export function chooseFocus(ctx, forced = null) {
  const usable = f => (!f.riddles || chamberAllowed(ctx)) && (!f.rigged || rigsPossible(ctx, f)) && f.stages.every(spec => !spec.puzzles || stagePuzzles(ctx, spec).length);
  const wanted = FOCUSES.find(f => f.id === forced && usable(f));
  if (wanted) return wanted;
  const eligible = FOCUSES.filter(f => (PUZZLE_ROOMS || !f.riddles) && f.from <= ctx.index && ctx.index <= (f.until ?? Infinity) && usable(f));
  const since = f => { const at = ctx.history.findLastIndex(h => h.focus === f.id); return at < 0 ? Infinity : ctx.history.length - at; };
  const longest = Math.max(...eligible.map(since));
  const bag = eligible.filter(f => since(f) === longest);
  return ctx.rng.weighted(bag, f => (f.riddles ? RIDDLE_FOCUS_WEIGHT : f.rigged ? RIGGED_FOCUS_WEIGHT : 1));
}
