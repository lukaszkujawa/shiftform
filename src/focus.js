import { PUZZLES } from './features.js?v=3166742';

const SLOW = 240;
const FAST = 120;
const stage = (puzzles, features = {}, tempo = null, connectors = null, connector = null) => ({ puzzles, features, tempo, connectors, connector });

const FOCUSES = [
  { id: 'first', title: 'First Steps', from: 0, until: 0, stages: [
    stage(null, {}, null, 0), stage(null, {}, null, 1), stage(null, { mover: 1 }, SLOW, 0), stage(null, { crumble: 1, oneway: 1 }, null, 0),
  ] },
  { id: 'crates', title: 'Crate Works', from: 1, stages: [
    stage(['dropStep', 'bounceRoom']), stage(['sinkRoom', 'bounceRoom']), stage(['stackRoom', 'sinkRoom'], { conveyor: 1 }), stage(['stackRoom', 'bounceRoom'], { saw: 1 }),
  ] },
  { id: 'phase', title: 'Phase Shift', from: 1, stages: [
    stage(null, { phase: 1 }, SLOW), stage(['swing'], { phase: 2 }, SLOW), stage(null, { phase: 2, mover: 1 }), stage(null, { phase: 3, spikeStrip: 1 }, FAST),
  ] },
  { id: 'movers', title: 'Moving Parts', from: 1, stages: [
    stage(null, { mover: 1 }, SLOW), stage(null, { mover: 2 }, SLOW), stage(['swing'], { mover: 2 }), stage(null, { mover: 3 }, FAST),
  ] },
  { id: 'crumbles', title: 'Crumbling Heights', from: 1, stages: [
    stage(null, { crumble: 2 }), stage(['swing'], { crumble: 2 }), stage(['keyDoor'], { crumble: 2 }), stage(null, { crumble: 4, floatingSpike: 1 }),
  ] },
  { id: 'swing', title: 'Swingers', from: 2, stages: [
    stage(['swing']), stage(['swing'], { gust: 1 }), stage(['swing'], { laser: 1 }), stage(['swing'], { saw: 1, crumble: 1 }),
  ] },
  { id: 'timing', title: 'Clockwork', from: 1, stages: [
    stage(null, { laser: 1 }, SLOW), stage(null, { gate: 1, laser: 1 }, SLOW), stage(['swing'], { laser: 2 }), stage(null, { laser: 2, gate: 2 }, FAST),
  ] },
  { id: 'locks', title: 'Locksmith', from: 1, stages: [
    stage(['keyDoor']), stage(['switchBridge', 'keyDoor', 'swing']), stage(['switchWall', 'keyDoor'], { saw: 1 }), stage(['keyDoor', 'switchWall'], { laser: 1, gate: 1 }),
  ] },
  { id: 'saws', title: 'Blade Run', from: 1, stages: [
    stage(null, { saw: 1 }, SLOW), stage(null, { saw: 2 }, SLOW), stage(['swing'], { saw: 1, conveyor: 1 }), stage(null, { saw: 3 }, FAST),
  ] },
  { id: 'bouncer', title: 'Bouncer', from: 1, stages: [
    stage(null, {}, SLOW, 2, 'bounce'), stage(['bumperGap', 'swing'], {}, SLOW, 1, 'bounce'), stage(['bumperGap'], { saw: 1 }, null, 1, 'bounce'), stage(['bumperGap'], { crumble: 1 }, FAST, 2, 'bounce'),
  ] },
  { id: 'wind', title: 'Wind Tunnel', from: 2, stages: [
    stage(null, { gust: 1 }, SLOW, 1, 'updraft'), stage(null, { gust: 1 }, null, 2, 'updraft'), stage(['swing'], { gust: 1, crumble: 1 }, null, 1, 'updraft'), stage(null, { gust: 2, laser: 1 }, FAST, 2, 'updraft'),
  ] },
  { id: 'water', title: 'Waterworks', from: 2, stages: [
    stage(null, { pool: 1 }, SLOW, 1, 'swim'), stage(null, { pool: 2 }, null, 1, 'swim'), stage(null, { pool: 1, laser: 1 }, null, 2, 'swim'), stage(null, { pool: 2, crumble: 1 }, FAST, 1, 'swim'),
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
