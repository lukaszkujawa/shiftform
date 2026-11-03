import { playerSize, hookAnchor } from './physics.js?v=ac45b7e';
import { glint } from './paint.js?v=ac45b7e';
import { alpha, shade } from './themes.js?v=ac45b7e';

const SEGMENTS = 10;
const PASSES = 4;
const DRAG = 0.985;
const FALL = 0.4;
const TENSION_CURVE = 4;
const IDLE_LENGTH = 22;
const REEL_EASE = 0.14;
const SWAY = { spring: 0.11, damp: 0.84, reach: 14, sag: 7, inertia: 1.6, jolt: 3, arrive: 0.7, recoil: 0.55, bend: 1.5 };

const strands = new WeakMap();
const sways = new WeakMap();
const climber = { vx: 0, vy: 0 };
const ARM_REACH = 6;
const HANG_TILT = 0.3;
const MIN_VISIBLE_ROPE = 10;

export const hangSide = hook => (hook.id % 2 ? 1 : -1);
export const hangTilt = hook => hangSide(hook) * HANG_TILT;

export function handOf(level, s) {
  const hook = level.objects[s.rope], anchor = hookAnchor(hook, s.clock);
  if (hook.grip) { const sway = swayOf(hook, s); return { x: anchor.x + sway.x, y: anchor.y + sway.y }; }
  const { w, h } = playerSize(level.rules), cx = s.x + w / 2, cy = s.y + h / 2, d = Math.hypot(anchor.x - cx, anchor.y - cy) || 1, reach = Math.min(d, h / 2 + ARM_REACH);
  return { x: cx + ((anchor.x - cx) / d) * reach, y: cy + ((anchor.y - cy) / d) * reach };
}

export const visibleRope = (level, ropeLen) => Math.max(MIN_VISIBLE_ROPE, ropeLen - playerSize(level.rules).h / 2 - ARM_REACH);
const clamp = (v, most) => Math.max(-most, Math.min(most, v));

export function createStrand(x, y, length) {
  const points = Array.from({ length: SEGMENTS + 1 }, (_, k) => {
    const py = y + (length * k) / SEGMENTS;
    return { x, y: py, px: x, py };
  });
  return { points, length, frame: -1 };
}

export function stepStrand(strand, ax, ay, tip, length, g = 1) {
  const { points } = strand;
  strand.length += (length - strand.length) * (tip ? 1 : REEL_EASE);
  const rest = strand.length / SEGMENTS;
  const pull = tip ? Math.min(1, Math.hypot(tip.x - ax, tip.y - ay) / strand.length) ** TENSION_CURVE : 0;
  const fall = FALL * (1 - pull) * g;
  for (const q of points) {
    const vx = (q.x - q.px) * DRAG, vy = (q.y - q.py) * DRAG;
    q.px = q.x;
    q.py = q.y;
    q.x += vx;
    q.y += vy + fall;
  }
  const last = points[SEGMENTS];
  for (let pass = 0; pass < PASSES; pass++) {
    points[0].x = ax;
    points[0].y = ay;
    if (tip) { last.x = tip.x; last.y = tip.y; }
    for (let k = 0; k < SEGMENTS; k++) {
      const a = points[k], b = points[k + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const push = (d - rest) / d / 2;
      a.x += dx * push; a.y += dy * push;
      b.x -= dx * push; b.y -= dy * push;
    }
  }
  points[0].x = ax;
  points[0].y = ay;
  if (tip) { last.x = tip.x; last.y = tip.y; }
}

function traceStrand(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let k = 1; k < SEGMENTS; k++) ctx.quadraticCurveTo(points[k].x, points[k].y, (points[k].x + points[k + 1].x) / 2, (points[k].y + points[k + 1].y) / 2);
  ctx.lineTo(points[SEGMENTS].x, points[SEGMENTS].y);
}

export function drawHookRope(ctx, p, level, hook, state) {
  const anchor = hookAnchor(hook, state.clock);
  const held = state.rope === hook.id;
  let strand = strands.get(hook);
  if (!strand) strands.set(hook, strand = createStrand(anchor.x, anchor.y, IDLE_LENGTH));
  if (strand.frame !== state.frame) {
    strand.frame = state.frame;
    stepStrand(strand, anchor.x, anchor.y, held ? handOf(level, state) : null, held ? visibleRope(level, state.ropeLen) : IDLE_LENGTH, state.gravDir ?? 1);
  }
  const { points } = strand;
  ctx.lineCap = ctx.lineJoin = 'round';
  traceStrand(ctx, points);
  ctx.strokeStyle = shade(p.ink, -12);
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = shade(p.rockEdge, 10);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = alpha(p.ink, 0.45);
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (held) return;
  const end = points[SEGMENTS];
  ctx.fillStyle = p.ink;
  ctx.beginPath(); ctx.arc(end.x, end.y, 2.6, 0, Math.PI * 2); ctx.fill();
  glint(ctx, end.x - 0.8, end.y - 0.8, 0.8);
}

export function swayOf(hook, state) {
  const anchor = hookAnchor(hook, state.clock);
  let sway = sways.get(hook);
  if (!sway) sways.set(hook, sway = { x: 0, y: 0, vx: 0, vy: 0, lastX: anchor.x, lastY: anchor.y, speedX: 0, speedY: 0, held: false, frame: -1 });
  if (sway.frame === state.frame) return sway;
  sway.frame = state.frame;
  const speedX = anchor.x - sway.lastX, speedY = anchor.y - sway.lastY, held = state.rope === hook.id, g = state.gravDir ?? 1;
  sway.vx -= clamp(speedX - sway.speedX, SWAY.jolt) * SWAY.inertia;
  sway.vy -= clamp(speedY - sway.speedY, SWAY.jolt) * SWAY.inertia;
  if (held && !sway.held) { sway.vx += (climber.vx - speedX) * SWAY.arrive; sway.vy += (climber.vy - speedY) * SWAY.arrive; }
  if (!held && sway.held) { sway.vx -= (state.vx - speedX) * SWAY.recoil; sway.vy -= (state.vy - speedY + SWAY.sag * g) * SWAY.recoil; }
  sway.vx = (sway.vx - sway.x * SWAY.spring) * SWAY.damp;
  sway.vy = (sway.vy + ((held ? SWAY.sag * g : 0) - sway.y) * SWAY.spring) * SWAY.damp;
  sway.x = clamp(sway.x + sway.vx, SWAY.reach);
  sway.y = clamp(sway.y + sway.vy, SWAY.reach);
  Object.assign(sway, { lastX: anchor.x, lastY: anchor.y, speedX, speedY, held });
  return sway;
}

export function noteClimber(state) {
  climber.vx = state.vx;
  climber.vy = state.vy;
}

export function gripOffset(level, state) {
  const hook = state.rope >= 0 ? level.objects[state.rope] : null;
  return hook?.grip ? swayOf(hook, state) : null;
}

export function drawArm(ctx, fromX, fromY, x, y, sway) {
  const bendX = (fromX + x) / 2 - sway.x * SWAY.bend, bendY = (fromY + y) / 2 - sway.y * SWAY.bend;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo(bendX, bendY, x, y);
  ctx.stroke();
}
