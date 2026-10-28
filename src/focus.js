import { PUZZLES } from './features.js';

const SLOW = 240;
const FAST = 120;
const stage = (puzzles, features = {}, tempo = null) => ({ puzzles, features, tempo });

export const FOCUSES = [
  { id: 'crates', title: 'Crate Works', hint: 'Crates are the way up: push, carry, throw.', from: 1, stages: [
    stage(['crateStep']), stage(['plateDoor', 'crateStep']), stage(['plateBridge', 'plateDoor'], { conveyor: 1 }), stage(['throwSwitch', 'plateDoor'], { saw: 1 }),
  ] },
  { id: 'phase', title: 'Phase Shift', hint: 'Platforms blink in and out. Watch the rhythm.', from: 0, stages: [
    stage(null, { phase: 1 }, SLOW), stage(null, { phase: 3 }, SLOW), stage(null, { phase: 2, mover: 1 }), stage(null, { phase: 3, spikeStrip: 1 }, FAST),
  ] },
  { id: 'movers', title: 'Moving Parts', hint: 'Ride the platforms.', from: 0, stages: [
    stage(null, { mover: 1 }, SLOW), stage(null, { mover: 2 }, SLOW), stage(null, { mover: 2, saw: 1 }), stage(null, { mover: 3 }, FAST),
  ] },
  { id: 'crumbles', title: 'Crumbling Heights', hint: 'Platforms give way once you leave them.', from: 0, stages: [
    stage(null, { crumble: 2 }), stage(null, { crumble: 3 }), stage(['keyDoor'], { crumble: 2 }), stage(null, { crumble: 4, floatingSpike: 1 }),
  ] },
  { id: 'swing', title: 'Swingers', hint: 'Hooks carry you across the gaps.', from: 2, stages: [
    stage(['swing']), stage(['swing'], { gust: 1 }), stage(['swing'], { laser: 1 }), stage(['swing'], { saw: 1, crumble: 1 }),
  ] },
  { id: 'timing', title: 'Clockwork', hint: 'Lasers and gates keep time. So should you.', from: 1, stages: [
    stage(null, { laser: 1 }, SLOW), stage(null, { gate: 1, laser: 1 }, SLOW), stage(null, { laser: 2, crumble: 1 }), stage(null, { laser: 2, gate: 2 }, FAST),
  ] },
  { id: 'locks', title: 'Locksmith', hint: 'Find the key, flip the switch.', from: 0, stages: [
    stage(['keyDoor']), stage(['switchBridge', 'keyDoor']), stage(['switchWall', 'keyDoor'], { saw: 1 }), stage(['keyDoor', 'switchWall'], { laser: 1, gate: 1 }),
  ] },
  { id: 'saws', title: 'Blade Run', hint: 'Saws patrol the gaps. Time your jumps.', from: 1, stages: [
    stage(null, { saw: 1 }, SLOW), stage(null, { saw: 2 }, SLOW), stage(null, { saw: 2, conveyor: 1 }), stage(null, { saw: 3 }, FAST),
  ] },
];

export function stagePuzzles(ctx, spec) {
  if (!spec.puzzles) return [];
  return PUZZLES.filter(p => spec.puzzles.includes(p.id) && !(ctx.cave && p.openOnly) && (!p.allowed || p.allowed(ctx)));
}

export function chooseFocus(ctx) {
  const pool = FOCUSES.filter(f => f.from <= ctx.index && f.stages.every(spec => !spec.puzzles || stagePuzzles(ctx, spec).length));
  return ctx.rng.pick(pool);
}
