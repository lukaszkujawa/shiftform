import { objectRect, slain, cycleAt } from './level.js?v=5f043fa';
import { Rng, hashString } from './rng.js?v=5f043fa';
import { TAU, blink } from './life-kit.js?v=5f043fa';
import { alpha } from './themes.js?v=5f043fa';
import { glow } from './sprites.js?v=5f043fa';

const looks = new WeakMap();
const GAZE_RANGE = 260;

export function lookOf(o) {
  let look = looks.get(o);
  if (!look) {
    const rng = new Rng(hashString(`${o.kind}:${o.id}:${Math.round(o.x)}:${Math.round(o.y)}`));
    const spots = rng.chance(0.4);
    look = {
      hue: rng.int(-30, 30), light: rng.int(-8, 10), size: rng.float(0.92, 1.1),
      eyes: rng.weighted([1, 2, 3], n => (n === 2 ? 5 : n === 1 ? 2 : 1)), eyeSize: rng.float(0.8, 1.25), pupil: rng.float(0.35, 0.6),
      angry: rng.chance(0.35), fangs: rng.int(0, 2), spots, stripes: !spots && rng.chance(0.3), horns: rng.chance(0.3), antenna: rng.chance(0.3),
      tempo: rng.float(0.8, 1.25), phase: rng.float(0, TAU), marks: Array.from({ length: 3 }, () => ({ x: rng.float(-0.6, 0.6), y: rng.float(-0.3, 0.5), r: rng.float(1.5, 3) })),
    };
    looks.set(o, look);
  }
  return look;
}

export function tint(color, dh, dl = 0) {
  return color.replace(/hsl\((-?[\d.]+) ([\d.]+)% ([\d.]+)%/, (_, h, s, l) => `hsl(${(((+h + dh) % 360) + 360) % 360} ${s}% ${Math.max(0, Math.min(100, +l + dl))}%`);
}

function gaze(o, rect, state, player, clock) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = player.x - cx, dy = player.y - cy, dist = Math.hypot(dx, dy);
  if (dist < GAZE_RANGE && dist > 1) return { x: dx / dist, y: dy / dist };
  return { x: facingOf(o, clock), y: 0.1 };
}

function facingOf(o, clock) {
  if (!o.period) return o.dir ?? 1;
  const ahead = cycleAt(o, clock) < o.period / 2;
  return Math.sign(o.dx || 1) * (ahead ? 1 : -1);
}

function face(ctx, p, look, cx, cy, r, aim, open, spread = 1) {
  const n = look.eyes, size = r * look.eyeSize;
  for (let k = 0; k < n; k++) {
    const ex = cx + (k - (n - 1) / 2) * size * 2.3 * spread, ey = cy - (n === 3 && k === 1 ? size * 0.9 : 0);
    ctx.fillStyle = p.text;
    ctx.beginPath(); ctx.ellipse(ex, ey, size, Math.max(0.25, size * open), 0, 0, TAU); ctx.fill();
    if (open > 0.3) {
      ctx.fillStyle = p.playerInk;
      ctx.beginPath(); ctx.arc(ex + aim.x * size * 0.45, ey + aim.y * size * 0.35, size * look.pupil, 0, TAU); ctx.fill();
    }
    if (look.angry) {
      ctx.strokeStyle = p.playerInk;
      ctx.lineWidth = 1.5;
      const side = ex < cx - 0.1 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(ex - size * side, ey - size * 1.1); ctx.lineTo(ex + size * side, ey - size * 0.6); ctx.stroke();
    }
  }
}

function fangs(ctx, p, look, cx, y, dir = 1) {
  if (!look.fangs) return;
  ctx.fillStyle = p.text;
  ctx.beginPath();
  for (let k = 0; k < look.fangs; k++) {
    const fx = cx + (k - (look.fangs - 1) / 2) * 6;
    ctx.moveTo(fx - 2, y); ctx.lineTo(fx, y + 5 * dir); ctx.lineTo(fx + 2, y);
  }
  ctx.fill();
}

function markings(ctx, look, color, cx, cy, w, h) {
  ctx.fillStyle = color;
  if (look.spots) for (const m of look.marks) { ctx.beginPath(); ctx.arc(cx + m.x * w, cy + m.y * h, m.r, 0, TAU); ctx.fill(); }
  if (look.stripes) for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * w * 0.3 - 1.5, cy - h * 0.1, 3, h * 0.45);
}

function horns(ctx, color, cx, top, look) {
  ctx.fillStyle = color;
  if (look.horns) for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * 5, top + 2); ctx.lineTo(cx + side * 9, top - 7); ctx.lineTo(cx + side * 2, top); ctx.fill(); }
  if (look.antenna) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + 4, top - 8, cx + 1, top - 11); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 1, top - 12, 2, 0, TAU); ctx.fill(); }
}

function velocity(o, clock) {
  const now = objectRect(o, clock), before = objectRect(o, clock - 1);
  return { vx: now.x - before.x, vy: now.y - before.y };
}

function squashed(ctx, p, body, o) {
  ctx.fillStyle = alpha(body, 0.6);
  ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h - 2, o.w * 0.65, 3.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    const ex = o.x + o.w / 2 + side * 5, ey = o.y + o.h - 3;
    ctx.beginPath(); ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2); ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); ctx.stroke();
  }
}

export function drawMonster(ctx, p, theme, level, o, state, time, player) {
  const look = lookOf(o), body = tint(p.hazard, look.hue, look.light), dark = tint(body, 0, -18);
  if (slain(state, o)) {
    if (o.kind !== 'flapper' && o.kind !== 'urchin') squashed(ctx, p, body, o);
    return;
  }
  const rect = objectRect(o, state.clock), t = time / 1000 * look.tempo + look.phase;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, bottom = rect.y + rect.h;
  const aim = gaze(o, rect, state, player, state.clock);
  const open = blink(t, look.phase), breath = 1 + 0.04 * Math.sin(t * 3);
  const { vx, vy } = velocity(o, state.clock);
  glow(ctx, theme, body, 10);
  ctx.fillStyle = body;
  if (o.kind === 'patroller') {
    const stride = Math.sin(t * 14) * 2.5 * Math.min(1, Math.abs(vx) * 2);
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, (rect.w / 2) * look.size, (rect.h / 2 - 1) * breath, 0, Math.PI, TAU); ctx.lineTo(cx + rect.w / 2, bottom - 3); ctx.lineTo(cx - rect.w / 2, bottom - 3); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const sx = cx + k * 6; ctx.moveTo(sx - 3, rect.y + 4); ctx.lineTo(sx, rect.y - 3 - (k === 0 ? 2 : 0)); ctx.lineTo(sx + 3, rect.y + 4); }
    ctx.fill();
    ctx.shadowBlur = 0;
    markings(ctx, look, dark, cx, cy + 3, rect.w, rect.h);
    ctx.fillStyle = dark;
    for (const side of [-1, 1]) ctx.fillRect(cx + side * 6 - 2, bottom - 4 + side * stride * 0.6, 4, 4);
    horns(ctx, dark, cx, rect.y - 2, look);
    face(ctx, p, look, cx + aim.x * 2, cy + 1, 3, aim, open);
    fangs(ctx, p, look, cx + aim.x * 2, bottom - 6);
  } else if (o.kind === 'flapper') {
    const flap = Math.sin(t * 18) * 8;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + side * 5, cy); ctx.quadraticCurveTo(cx + side * 14, cy - 10 - flap, cx + side * 20, cy - flap); ctx.quadraticCurveTo(cx + side * 12, cy + 2, cx + side * 5, cy + 4); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 8 * look.size * breath, 0, TAU); ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy + 7); ctx.quadraticCurveTo(cx - aim.x * 6, cy + 14 + Math.sin(t * 9) * 3, cx - aim.x * 2, cy + 19); ctx.stroke();
    ctx.shadowBlur = 0;
    markings(ctx, look, dark, cx, cy, 10, 10);
    horns(ctx, dark, cx, cy - 8, look);
    face(ctx, p, look, cx, cy - 1, 3.6, aim, open, 0.8);
    fangs(ctx, p, look, cx, cy + 5);
  } else if (o.kind === 'hopper') {
    const airborne = o.y - rect.y > 1, stretch = Math.max(-0.25, Math.min(0.25, -vy * 0.06));
    const rw = (rect.w / 2 + (airborne ? 0 : 2)) * (1 - stretch) * look.size, rh = (rect.h / 2 - (airborne ? 0 : 2)) * (1 + stretch) * breath;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + side * 9, bottom - 3, 5, airborne ? 4.5 : 2.5, side * (airborne ? 0.7 : 0), 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(cx, cy + 3, rw, rh, 0, 0, TAU); ctx.fill();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + side * 6, rect.y + 3, 4.5 * look.eyeSize, 0, TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
    markings(ctx, look, dark, cx, cy + 4, rect.w * 0.8, rect.h * 0.6);
    ctx.fillStyle = tint(body, 0, 14);
    ctx.beginPath(); ctx.ellipse(cx, bottom - 5, 5 + 1.5 * Math.sin(t * 6), 3 + 1.2 * Math.sin(t * 6), 0, 0, TAU); ctx.fill();
    face(ctx, p, { ...look, eyes: 2 }, cx, rect.y + 3, 2.6, aim, open, 1.05);
  } else if (o.kind === 'urchin') {
    const spin = time / 700 + look.phase, spikes = 10 + (look.eyes === 1 ? 4 : 2);
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a = spin + (i / spikes) * TAU, b = a + TAU / (spikes * 2), reach = 12 + 2 * Math.sin(t * 5 + i);
      ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      ctx.lineTo(cx + Math.cos(b) * 7, cy + Math.sin(b) * 7);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy, 6.5 * breath, 0, TAU); ctx.fill();
    face(ctx, p, { ...look, eyes: Math.min(look.eyes, 2), angry: true }, cx, cy, look.eyes === 1 ? 3.8 : 2.4, aim, open, 0.9);
  } else if (o.kind === 'spider') {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = alpha(p.ink, 0.5);
    ctx.lineWidth = 1;
    const sway = Math.sin(t * 2) * 1.5;
    ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.quadraticCurveTo(cx + sway * 3, (o.y + rect.y) / 2, cx, rect.y + 4); ctx.stroke();
    glow(ctx, theme, body, 10);
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const skitter = Math.sin(t * 16) * (1 + Math.min(3, Math.abs(vy)));
    ctx.beginPath();
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { const ly = cy - 3 + k * 3, wave = skitter * (k % 2 ? 1 : -1); ctx.moveTo(cx + side * 5, ly); ctx.lineTo(cx + side * 12, ly - 4 + wave); ctx.lineTo(cx + side * 15, ly + 4 + wave * 0.5); }
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(cx, cy + 3, 7 * look.size, 8 * breath, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 6, 4.5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    markings(ctx, look, dark, cx, cy + 4, 10, 10);
    face(ctx, p, { ...look, eyes: 2 + (look.eyes === 3 ? 1 : 0) }, cx, cy - 6, 1.6, aim, open, 1.1);
    fangs(ctx, p, { ...look, fangs: 2 }, cx, cy - 3);
  } else {
    const shot = level.objects.find(s => s.type === 'shot' && s.source === o.id);
    const phase = shot ? cycleAt(shot, state.clock) : 0;
    const charge = shot && shot.period - phase < 40 ? (40 - (shot.period - phase)) / 40 : 0;
    const recoil = shot && phase < 12 ? 1 - phase / 12 : 0;
    const puff = 1 + charge * 0.3 - recoil * 0.15, dir = o.dir ?? aim.x;
    ctx.beginPath(); ctx.moveTo(cx - (rect.w / 2) * puff, bottom); ctx.quadraticCurveTo(cx - (rect.w / 2) * puff, rect.y - 4 * puff, cx, rect.y - 2 - 4 * (puff - 1) * 4); ctx.quadraticCurveTo(cx + (rect.w / 2) * puff, rect.y - 4 * puff, cx + (rect.w / 2) * puff, bottom); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    markings(ctx, look, dark, cx, cy + 2, rect.w, rect.h);
    horns(ctx, dark, cx, rect.y - 2, look);
    const gape = 3 + (recoil ? 5 : charge * 2) + Math.abs(Math.sin(t * 4));
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.ellipse(cx + dir * 6, cy + 2, 4 + recoil * 2, gape, 0, 0, TAU); ctx.fill();
    fangs(ctx, p, look, cx + dir * 6, cy - gape + 2);
    face(ctx, p, look, cx - dir * 3, rect.y + 5, 2.5, aim, open, 0.9);
  }
  ctx.shadowBlur = 0;
}
