import { levelIndex, objectRect } from './level.js?v=dd78f3b';

const ROPE_MIN = 40;
const ROPE_REEL = 2.5;
const ROPE_TOP_SPEED = 15;
export const GRIP_HANG = 14;
const GRIP_REACH = 38;
const GRIP_PULL = 7;

export function hookAnchor(hook, clock) {
  const rect = objectRect(hook, clock);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function tether(level, n, pw, ph) {
  const anchor = hookAnchor(level.objects[n.rope], n.clock);
  const fromX = n.x + pw / 2 - anchor.x, fromY = n.y + ph / 2 - anchor.y;
  const cx = fromX + n.vx, cy = fromY + n.vy, d = Math.hypot(cx, cy);
  if (d <= n.ropeLen) return { x: n.vx, y: n.vy };
  const k = n.ropeLen / d, toX = cx * k, toY = cy * k;
  const was = Math.hypot(fromX, fromY) || 1;
  const along = (n.vx * -fromY + n.vy * fromX) / was;
  const speed = Math.max(-ROPE_TOP_SPEED, Math.min(ROPE_TOP_SPEED, along));
  n.vx = (-toY / n.ropeLen) * speed;
  n.vy = (toX / n.ropeLen) * speed;
  return { x: toX - fromX, y: toY - fromY };
}

export function reel(level, n, input) {
  const most = Math.max(ROPE_MIN, level.objects[n.rope].reach), was = n.ropeLen;
  n.ropeLen = Math.max(ROPE_MIN, Math.min(most, was + ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * ROPE_REEL));
  n.vx *= was / n.ropeLen;
  n.vy *= was / n.ropeLen;
}

export function followGrip(level, s, n, pw, ph) {
  const hook = level.objects[n.rope];
  const before = hookAnchor(hook, s.clock), after = hookAnchor(hook, n.clock);
  const pull = v => Math.max(-GRIP_PULL, Math.min(GRIP_PULL, v));
  n.x += pull(before.x - n.x - pw / 2);
  n.y += pull(before.y + GRIP_HANG * n.gravDir - n.y - ph / 2);
  n.vx = after.x - before.x;
  n.vy = after.y - before.y;
}

export function grabHook(level, n, pw, ph, gripsOnly) {
  const cx = n.x + pw / 2, cy = n.y + ph / 2;
  let best = null, bestDistance = Infinity;
  for (const hook of levelIndex(level).hooks) {
    if (gripsOnly && !hook.grip) continue;
    const anchor = hookAnchor(hook, n.clock);
    const dx = anchor.x - cx, dy = anchor.y - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= (hook.grip ? GRIP_REACH : hook.reach) && d < bestDistance) { best = hook; bestDistance = d; }
  }
  if (!best) return false;
  n.rope = best.id;
  n.ropeLen = best.grip ? 0 : Math.max(ROPE_MIN, bestDistance);
  return true;
}
