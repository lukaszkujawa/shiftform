import { levelIndex, objectRect, overlaps, crushed } from './level.js?v=3f651af';
import { playerSize } from './physics.js?v=3f651af';

const CLIMB_STEP = 14;
const TRIGGERED = { spring: o => o.vel ? 'launch' : 'spring', bumper: () => 'bumper' };

function playerEvents(level, prev, next, w, h) {
  const events = [];
  if (next.dead && !prev.dead) events.push({ type: 'death' });
  if (next.jumpsUsed > prev.jumpsUsed) events.push({ type: prev.grounded || prev.coyote > 0 || prev.rope >= 0 || prev.climbing ? 'jump' : 'airJump' });
  if (next.grounded && !prev.grounded) events.push({ type: 'land', speed: Math.abs(prev.vy) });
  if (next.dashTimer > prev.dashTimer) events.push({ type: 'dash' });
  if (next.lastKick !== 0 && next.lastKick !== prev.lastKick) events.push({ type: 'kick', side: next.lastKick });
  if (next.gravDir !== prev.gravDir) events.push({ type: 'flip', dir: next.gravDir });
  if (next.inPortal && !prev.inPortal) events.push({ type: 'portal' });
  if (next.rope >= 0 && prev.rope < 0) events.push({ type: 'grab' });
  if (next.rope < 0 && prev.rope >= 0) events.push({ type: 'letGo' });
  if (next.climbing && !prev.climbing) events.push({ type: 'grab' });
  if (next.climbing && prev.climbing && Math.floor(next.y / CLIMB_STEP) !== Math.floor(prev.y / CLIMB_STEP)) events.push({ type: 'climbStep' });
  if (next.charge >= 1 && prev.charge < 1) events.push({ type: 'charged' });
  const wet = s => levelIndex(level).water.some(o => overlaps(s.x, s.y, w, h, o));
  if (wet(next) && !wet(prev)) events.push({ type: 'splash' });
  if (prev.charge >= 1 && next.charge < 1) events.push({ type: 'uncharged' });
  for (const o of levelIndex(level).triggers) {
    const sound = TRIGGERED[o.type];
    if (!sound || crushed(level, next, o)) continue;
    const rect = objectRect(o, next.clock);
    if (overlaps(next.x, next.y, w, h, rect) && !overlaps(prev.x, prev.y, w, h, objectRect(o, prev.clock))) events.push({ type: sound(o) });
  }
  return events;
}

function worldEvents(level, prev, next) {
  const events = [];
  const gained = next.flags & ~prev.flags;
  if (gained) for (const o of level.objects) if (o.bit & gained && (o.type === 'key' || o.type === 'switch')) events.push({ type: o.type });
  if (next.crumbled.some((t, k) => t > 0 && !prev.crumbled[k])) events.push({ type: 'crumble' });
  if (next.pressed & ~prev.pressed) events.push({ type: 'plateDown' });
  if (prev.pressed & ~next.pressed) events.push({ type: 'plateUp' });
  if (next.crushed & ~prev.crushed) events.push({ type: 'crush' });
  if (next.slain & ~prev.slain) events.push({ type: 'stomp' });
  if (next.comet > prev.comet && prev.comet > 0) events.push({ type: 'cometPerfect', combo: next.comet });
  else if (next.cometBounces > prev.cometBounces) events.push({ type: 'cometBounce' });
  if (next.cometMissed && !prev.cometMissed) events.push({ type: 'cometLate' });
  if (prev.comet > 0 && next.comet === 0 && !next.dead) events.push({ type: 'cometOut' });
  if (next.coins & ~prev.coins) events.push({ type: 'coin' });
  const collected = next.taken & ~prev.taken;
  if (collected) for (const o of levelIndex(level).items) if (collected & (1 << o.slot)) events.push({ type: 'item', kind: o.kind });
  if (prev.shield && !next.shield) events.push({ type: 'shieldBreak' });
  return events;
}

function crateEvents(level, prev, next, w, h) {
  const events = [];
  const crates = levelIndex(level).crates;
  if (next.held >= 0 && prev.held < 0) events.push({ type: 'lift', kind: crates[next.held].kind });
  if (prev.held >= 0 && next.held < 0) events.push({ type: next.bodies[prev.held].vx !== 0 ? 'throw' : 'drop', kind: crates[prev.held].kind });
  next.bodies.forEach((b, k) => {
    const before = prev.bodies[k];
    if (!before || b.gone || k === next.held) return;
    const crate = crates[k];
    if (b.grounded && !before.grounded && Math.abs(before.vy) > 2) events.push({ type: 'crateLand', kind: crate.kind, speed: Math.abs(before.vy) });
    if (b.grounded && Math.abs(b.x - before.x) > 0.3 && overlaps(next.x - 2, next.y, w + 4, h, { x: b.x, y: b.y, w: crate.w, h: crate.h })) events.push({ type: 'push', kind: crate.kind });
  });
  return events;
}

export function soundEvents(level, prev, next) {
  const { w, h } = playerSize(level.rules);
  return [...playerEvents(level, prev, next, w, h), ...worldEvents(level, prev, next), ...crateEvents(level, prev, next, w, h)];
}
