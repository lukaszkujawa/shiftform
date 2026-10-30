import { PUZZLES } from './features.js?v=6eb245d';

const SLOW = 240;
const FAST = 120;
const stage = (puzzles, features = {}, tempo = null, connectors = null, connector = null) => ({ puzzles, features, tempo, connectors, connector });

export const FOCUSES = [
  { id: 'first', title: 'First Steps', hint: 'Walk, jump, climb. Take your time.', from: 0, until: 0, stages: [
    stage(null, {}, null, 0), stage(null, {}, null, 1), stage(null, { mover: 1 }, SLOW, 0), stage(null, { crumble: 1, oneway: 1 }, null, 0),
  ], tips: [
    'Arrows move, Z or Space jumps. Tap for a hop, hold for a full jump.',
    'Hold up at a ladder to climb it. A trampoline launches you when you step on it.',
    'Moving platforms carry you. Jump off near the top of their swing.',
    'Crumbling platforms give way once you leave them. The flag is a checkpoint.',
  ] },
  { id: 'crates', title: 'Crate Works', hint: 'Crates hide off the path. Fetch them, stack them, launch them.', from: 1, stages: [
    stage(['fetchBelow']), stage(['fetchAbove', 'plateDoor']), stage(['springLift', 'plateBridge'], { conveyor: 1 }), stage(['stackStep', 'throwSwitch'], { saw: 1 }),
  ] },
  { id: 'phase', title: 'Phase Shift', hint: 'Platforms blink in and out. Watch the rhythm.', from: 1, stages: [
    stage(null, { phase: 1 }, SLOW), stage(null, { phase: 3 }, SLOW), stage(null, { phase: 2, mover: 1 }), stage(null, { phase: 3, spikeStrip: 1 }, FAST),
  ] },
  { id: 'movers', title: 'Moving Parts', hint: 'Ride the platforms.', from: 1, stages: [
    stage(null, { mover: 1 }, SLOW), stage(null, { mover: 2 }, SLOW), stage(null, { mover: 2, saw: 1 }), stage(null, { mover: 3 }, FAST),
  ] },
  { id: 'crumbles', title: 'Crumbling Heights', hint: 'Platforms give way once you leave them.', from: 1, stages: [
    stage(null, { crumble: 2 }), stage(null, { crumble: 3 }), stage(['keyDoor'], { crumble: 2 }), stage(null, { crumble: 4, floatingSpike: 1 }),
  ] },
  { id: 'swing', title: 'Swingers', hint: 'Hooks carry you across the gaps.', from: 2, stages: [
    stage(['swing']), stage(['swing'], { gust: 1 }), stage(['swing'], { laser: 1 }), stage(['swing'], { saw: 1, crumble: 1 }),
  ] },
  { id: 'timing', title: 'Clockwork', hint: 'Lasers and gates keep time. So should you.', from: 1, stages: [
    stage(null, { laser: 1 }, SLOW), stage(null, { gate: 1, laser: 1 }, SLOW), stage(null, { laser: 2, crumble: 1 }), stage(null, { laser: 2, gate: 2 }, FAST),
  ] },
  { id: 'locks', title: 'Locksmith', hint: 'Find the key, flip the switch.', from: 1, stages: [
    stage(['keyDoor']), stage(['switchBridge', 'keyDoor']), stage(['switchWall', 'keyDoor'], { saw: 1 }), stage(['keyDoor', 'switchWall'], { laser: 1, gate: 1 }),
  ] },
  { id: 'saws', title: 'Blade Run', hint: 'Saws patrol the gaps. Time your jumps.', from: 1, stages: [
    stage(null, { saw: 1 }, SLOW), stage(null, { saw: 2 }, SLOW), stage(null, { saw: 2, conveyor: 1 }), stage(null, { saw: 3 }, FAST),
  ] },
  { id: 'bouncer', title: 'Bouncer', hint: 'Trampolines lift you, bumpers fling you. Let them.', from: 1, stages: [
    stage(null, {}, SLOW, 2, 'bounce'), stage(['bumperGap'], {}, SLOW, 1, 'bounce'), stage(['bumperGap'], { saw: 1 }, null, 1, 'bounce'), stage(['bumperGap'], { crumble: 1 }, FAST, 2, 'bounce'),
  ] },
  { id: 'wind', title: 'Wind Tunnel', hint: 'Gusts push, updrafts lift. Lean into them.', from: 2, stages: [
    stage(null, { gust: 1 }, SLOW, 1, 'updraft'), stage(null, { gust: 1 }, null, 2, 'updraft'), stage(null, { gust: 2, crumble: 1 }, null, 1, 'updraft'), stage(null, { gust: 2, laser: 1 }, FAST, 2, 'updraft'),
  ] },
  { id: 'water', title: 'Waterworks', hint: 'Pools in the gaps. Swim up, jump out.', from: 2, stages: [
    stage(null, { pool: 1 }, SLOW, 1, 'swim'), stage(null, { pool: 2 }, null, 1, 'swim'), stage(null, { pool: 1, laser: 1 }, null, 2, 'swim'), stage(null, { pool: 2, crumble: 1 }, FAST, 1, 'swim'),
  ] },
];

export function stagePuzzles(ctx, spec) {
  if (!spec.puzzles) return [];
  return PUZZLES.filter(p => spec.puzzles.includes(p.id) && !(ctx.cave && p.openOnly) && (!p.allowed || p.allowed(ctx)));
}

export function chooseFocus(ctx, forced = null) {
  const pool = FOCUSES.filter(f => (forced ? f.id === forced : f.from <= ctx.index && ctx.index <= (f.until ?? Infinity)) && f.stages.every(spec => !spec.puzzles || stagePuzzles(ctx, spec).length));
  return ctx.rng.pick(pool);
}
