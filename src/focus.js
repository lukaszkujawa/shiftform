import { PUZZLES } from './features.js';

const SLOW = 240;
const FAST = 120;
const BUDGET_BASE = 6;
const BUDGET_GROWTH = 8;
const stage = (puzzles, features = {}, tempo = null, connectors = null, connector = null, moves = null) => ({ puzzles, features, tempo, connectors, connector, moves });

const GENTLE = { hop: 4, stair: 2, run: 2, shaft: 2 };
const STAIRS = { hop: 2, stair: 4, zig: 1, run: 1, shaft: 2 };
const LEAPS = { hop: 3, leap: 3, run: 2, drop: 1, shaft: 2 };
const SHAFTS = { hop: 3, shaft: 4, run: 1, drop: 1 };
const MIXED = { hop: 3, stair: 2, leap: 2, run: 1, shaft: 2, drop: 1, zig: 1 };

export const actionBudget = difficulty => BUDGET_BASE + Math.round(BUDGET_GROWTH * difficulty);

const FOCUSES = [
  { id: 'first', title: 'First Steps', from: 0, until: 0, stages: [
    stage(null, {}, null, 0, null, { hop: 1 }), stage(null, {}, null, 1, null, { hop: 3, shaft: 2 }), stage(null, { mover: 1 }, SLOW, 0, null, { hop: 3, run: 1 }), stage(null, { crumble: 1, oneway: 1 }, null, 0, null, { hop: 3, stair: 1 }),
  ] },
  { id: 'crates', title: 'Crate Works', from: 1, stages: [
    stage(['dropStep', 'bounceRoom'], {}, null, null, null, GENTLE), stage(['sinkRoom', 'bounceRoom'], {}, null, null, null, GENTLE), stage(['stackRoom', 'sinkRoom'], { conveyor: 1 }, null, null, null, MIXED), stage(['stackRoom', 'bounceRoom'], { saw: 1 }, null, null, null, MIXED),
  ] },
  { id: 'phase', title: 'Phase Shift', from: 1, stages: [
    stage(null, { phase: 1 }, SLOW, null, null, GENTLE), stage(['swing'], { phase: 2 }, SLOW, null, null, MIXED), stage(null, { phase: 2, mover: 1 }, null, null, null, MIXED), stage(null, { phase: 3, spikeStrip: 1 }, FAST, null, null, LEAPS),
  ] },
  { id: 'movers', title: 'Moving Parts', from: 1, stages: [
    stage(null, { mover: 1 }, SLOW, null, null, GENTLE), stage(null, { mover: 2 }, SLOW, null, null, MIXED), stage(['swing'], { mover: 2 }, null, null, null, MIXED), stage(null, { mover: 3 }, FAST, null, null, LEAPS),
  ] },
  { id: 'crumbles', title: 'Crumbling Heights', from: 1, stages: [
    stage(null, { crumble: 2 }, null, null, null, STAIRS), stage(['swing'], { crumble: 2 }, null, null, null, STAIRS), stage(['keyDoor', 'farKey'], { crumble: 2 }, null, null, null, MIXED), stage(null, { crumble: 4, floatingSpike: 1 }, null, null, null, STAIRS),
  ] },
  { id: 'swing', title: 'Swingers', from: 2, stages: [
    stage(['swing'], {}, null, null, null, MIXED), stage(['swing'], { gust: 1 }, null, null, null, LEAPS), stage(['swing'], { laser: 1 }, null, null, null, MIXED), stage(['swing'], { saw: 1, crumble: 1 }, null, null, null, LEAPS),
  ] },
  { id: 'timing', title: 'Clockwork', from: 1, stages: [
    stage(null, { laser: 1 }, SLOW, null, null, GENTLE), stage(null, { gate: 1, laser: 1 }, SLOW, null, null, LEAPS), stage(['swing'], { laser: 2 }, null, null, null, LEAPS), stage(null, { laser: 2, gate: 2 }, FAST, null, null, MIXED),
  ] },
  { id: 'locks', title: 'Locksmith', from: 1, stages: [
    stage(['keyDoor', 'farKey'], {}, null, null, null, GENTLE), stage(['switchBridge', 'keyDoor', 'farKey', 'swing'], {}, null, null, null, MIXED), stage(['switchWall', 'keyDoor', 'farKey'], { saw: 1 }, null, null, null, MIXED), stage(['keyDoor', 'switchWall'], { laser: 1, gate: 1 }, null, null, null, MIXED),
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
  { id: 'water', title: 'Waterworks', from: 2, stages: [
    stage(null, { pool: 1 }, SLOW, 1, 'swim', SHAFTS), stage(null, { pool: 2 }, null, 1, 'swim', LEAPS), stage(null, { pool: 1, laser: 1 }, null, 2, 'swim', SHAFTS), stage(null, { pool: 2, crumble: 1 }, FAST, 1, 'swim', MIXED),
  ] },
];

export function stagePuzzles(ctx, spec) {
  if (!spec.puzzles) return [];
  return PUZZLES.filter(p => spec.puzzles.includes(p.id) && !(ctx.cave && p.openOnly) && (!p.allowed || p.allowed(ctx)));
}

export function chooseFocus(ctx, forced = null) {
  const usable = f => f.stages.every(spec => !spec.puzzles || stagePuzzles(ctx, spec).length);
  const wanted = FOCUSES.find(f => f.id === forced && usable(f));
  return wanted ?? ctx.rng.pick(FOCUSES.filter(f => f.from <= ctx.index && ctx.index <= (f.until ?? Infinity) && usable(f)));
}
