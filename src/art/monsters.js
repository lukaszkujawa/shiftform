import { objectRect, slain, cycleAt } from '../world/level.js?v=9b09a76';
import { Rng, hashString } from '../world/rng.js?v=9b09a76';
import { TAU, blink } from './life-kit.js?v=9b09a76';
import { alpha, tint } from './themes.js?v=9b09a76';
import { glow } from './sprites.js?v=9b09a76';
import { shadedBody } from './paint.js?v=9b09a76';
import { lurkerOf, BLAST_RADIUS, BITE_RISE } from '../world/lurkers.js?v=9b09a76';

const looks = new WeakMap();
const GAZE_RANGE = 260;
const EYE_WHITE = 'hsl(0 0% 97%)';
const INK = 'hsl(240 30% 10%)';
const ALERT = 'hsl(45 100% 60% / 1)';
const CRESTS = ['none', 'none', 'horns', 'antenna'];

export function lookOf(o) {
  let look = looks.get(o);
  if (!look) {
    const rng = new Rng(hashString(`${o.kind}:${o.id}:${Math.round(o.x)}:${Math.round(o.y)}`));
    const spots = rng.chance(0.4), crest = rng.pick(CRESTS);
    look = {
      hue: rng.int(-30, 30), light: rng.int(-8, 10), size: rng.float(0.92, 1.1),
      eyes: rng.weighted([1, 2, 3], n => (n === 2 ? 5 : n === 1 ? 2 : 1)), eyeSize: rng.float(0.8, 1.25), pupil: rng.float(0.35, 0.6),
      angry: rng.chance(0.35), fangs: rng.int(0, 2), spots, stripes: !spots && rng.chance(0.3), horns: crest === 'horns', antenna: crest === 'antenna',
      tempo: rng.float(0.8, 1.25), phase: rng.float(0, TAU), marks: Array.from({ length: 3 }, () => ({ x: rng.float(-0.55, 0.55), y: rng.float(0.2, 0.45), r: rng.float(1.2, 2) })),
    };
    looks.set(o, look);
  }
  return look;
}

function gaze(o, rect, player, facing) {
  const dx = player.x - (rect.x + rect.w / 2), dy = player.y - (rect.y + rect.h / 2), dist = Math.hypot(dx, dy);
  if (dist < GAZE_RANGE && dist > 1) return { x: dx / dist, y: dy / dist };
  return { x: facing, y: 0.1 };
}

function facingOf(o, clock) {
  if (!o.period) return o.dir ?? 1;
  const ahead = cycleAt(o, clock) < o.period / 2;
  return Math.sign(o.dx || 1) * (ahead ? 1 : -1);
}

function face(ctx, look, cx, cy, r, aim, open, spread = 1) {
  const n = look.eyes, size = r * look.eyeSize;
  for (let k = 0; k < n; k++) {
    const ex = cx + (k - (n - 1) / 2) * size * 2.3 * spread, ey = cy - (n === 3 && k === 1 ? size * 0.9 : 0);
    ctx.fillStyle = EYE_WHITE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(ex, ey, size, Math.max(0.25, size * open), 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (open > 0.3) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(ex + aim.x * size * 0.45, ey + aim.y * size * 0.35, size * look.pupil, 0, TAU); ctx.fill();
    }
    if (look.angry) {
      ctx.lineWidth = 1.5;
      const side = ex < cx - 0.1 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(ex - size * side, ey - size * 1.1); ctx.lineTo(ex + size * side, ey - size * 0.6); ctx.stroke();
    }
  }
}

function fangs(ctx, look, cx, y, dir = 1) {
  if (!look.fangs) return;
  ctx.fillStyle = EYE_WHITE;
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
  if (look.stripes) for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * w * 0.3 - 1.5, cy + h * 0.1, 3, h * 0.3);
}

function crest(ctx, c, cx, top, look) {
  if (look.horns) for (const side of [-1, 1]) shadedBody(ctx, () => { ctx.moveTo(cx + side * 5, top + 2); ctx.lineTo(cx + side * 9, top - 7); ctx.lineTo(cx + side * 2, top); ctx.closePath(); }, c, 1);
  if (look.antenna) {
    ctx.strokeStyle = c.line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + 4, top - 8, cx + 1, top - 11); ctx.stroke();
    ctx.fillStyle = c.fill;
    ctx.beginPath(); ctx.arc(cx + 1, top - 12, 2, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

const gleam = (ctx, x, y, r = 1.6) => { ctx.fillStyle = 'hsl(0 0% 100% / 0.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

function velocity(o, clock) {
  const now = objectRect(o, clock), before = objectRect(o, clock - 1);
  return { vx: now.x - before.x, vy: now.y - before.y };
}

function legs(ctx, c, cx, bottom, stride, spread = 6) {
  for (const side of [-1, 1]) shadedBody(ctx, () => ctx.rect(cx + side * spread - 2, bottom - 4 + side * stride * 0.6, 4, 4), { fill: c.shade, shade: c.shade, line: c.line }, 1);
}

function squashed(ctx, c, rect) {
  ctx.fillStyle = alpha(c.fill, 0.6);
  ctx.beginPath(); ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h - 2, rect.w * 0.65, 3.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    const ex = rect.x + rect.w / 2 + side * 5, ey = rect.y + rect.h - 3;
    ctx.beginPath(); ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2); ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); ctx.stroke();
  }
}

const ROAMERS = {
  eel({ ctx, c, cx, cy, rect, t, aim, open, vx }) {
    const facing = vx < 0 ? -1 : 1, half = rect.w / 2, wave = x => Math.sin(t * 9 + x * 0.35) * 2.2;
    shadedBody(ctx, () => {
      ctx.moveTo(cx + facing * half, cy);
      for (const k of [0.5, 0, -0.5]) ctx.lineTo(cx + facing * half * k, cy - 4.5 + wave(k * half) + Math.abs(k) * 1.5);
      ctx.lineTo(cx - facing * (half + 4), cy + wave(-half) - 3);
      ctx.lineTo(cx - facing * (half + 4), cy + wave(-half) + 3);
      for (const k of [-0.5, 0, 0.5]) ctx.lineTo(cx + facing * half * k, cy + 4.5 + wave(k * half) - Math.abs(k) * 1.5);
      ctx.closePath();
    }, c);
    gleam(ctx, cx + facing * half * 0.1, cy - 2);
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath(); ctx.arc(cx + facing * half * 0.62, cy - 1.5, 2.4 * open, 0, TAU); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx + facing * half * 0.62 + aim.x, cy - 1.5 + aim.y, 1.1 * open, 0, TAU); ctx.fill();
  },
  jelly({ ctx, c, cx, rect, t, aim, open, breath }) {
    const dome = rect.w / 2 * breath, top = rect.y + 1, skirt = rect.y + rect.h * 0.6;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      const x = cx + k * dome * 0.6;
      ctx.moveTo(x, skirt);
      ctx.quadraticCurveTo(x + Math.sin(t * 6 + k) * 3, skirt + 5, x + Math.sin(t * 6 + k + 1) * 2, rect.y + rect.h + 4);
    }
    ctx.stroke();
    shadedBody(ctx, () => {
      ctx.moveTo(cx - dome, skirt);
      ctx.quadraticCurveTo(cx - dome, top, cx, top);
      ctx.quadraticCurveTo(cx + dome, top, cx + dome, skirt);
      ctx.quadraticCurveTo(cx, skirt - 3, cx - dome, skirt);
      ctx.closePath();
    }, c);
    gleam(ctx, cx - dome * 0.4, top + 4);
    face(ctx, { eyes: 2, eyeSize: 0.8, pupil: 0.5 }, cx, top + rect.h * 0.3, 2.4, aim, open);
  },
  patroller({ ctx, c, look, rect, cx, cy, bottom, t, aim, open, breath, vx }) {
    const stride = Math.sin(t * 14) * 2.5 * Math.min(1, Math.abs(vx) * 2);
    legs(ctx, c, cx, bottom, stride);
    shadedBody(ctx, () => {
      ctx.moveTo(cx - rect.w / 2, bottom - 3);
      ctx.quadraticCurveTo(cx - rect.w / 2, rect.y + 2, cx - 9, rect.y + 4);
      for (let k = -1; k <= 1; k++) { const sx = cx + k * 6; ctx.lineTo(sx - 3, rect.y + 4 * breath); ctx.lineTo(sx, rect.y - 3 - (k === 0 ? 2 : 0)); ctx.lineTo(sx + 3, rect.y + 4 * breath); }
      ctx.quadraticCurveTo(cx + rect.w / 2, rect.y + 2, cx + rect.w / 2, bottom - 3);
      ctx.closePath();
    }, c);
    markings(ctx, look, c.shade, cx, cy + 3, rect.w, rect.h);
    crest(ctx, c, cx, rect.y - 2, look);
    gleam(ctx, cx - 7, cy - 2);
    face(ctx, look, cx + aim.x * 2, cy + 1, 3, aim, open);
    fangs(ctx, look, cx + aim.x * 2, bottom - 6);
  },
  flapper({ ctx, c, look, cx, cy, t, aim, open, breath }) {
    const flap = Math.sin(t * 18) * 8;
    for (const side of [-1, 1]) shadedBody(ctx, () => { ctx.moveTo(cx + side * 5, cy); ctx.quadraticCurveTo(cx + side * 14, cy - 10 - flap, cx + side * 20, cy - flap); ctx.quadraticCurveTo(cx + side * 12, cy + 2, cx + side * 5, cy + 4); ctx.closePath(); }, c, 1.1);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy + 7); ctx.quadraticCurveTo(cx - aim.x * 6, cy + 14 + Math.sin(t * 9) * 3, cx - aim.x * 2, cy + 19); ctx.stroke();
    shadedBody(ctx, () => ctx.arc(cx, cy, 8 * look.size * breath, 0, TAU), c);
    markings(ctx, look, c.shade, cx, cy, 10, 10);
    crest(ctx, c, cx, cy - 8, look);
    gleam(ctx, cx - 4, cy - 4);
    face(ctx, look, cx, cy - 1, 3.6, aim, open, 0.8);
    fangs(ctx, look, cx, cy + 5);
  },
  hopper({ ctx, c, look, o, rect, cx, cy, bottom, t, aim, open, breath, vy }) {
    const airborne = o.y - rect.y > 1, stretch = Math.max(-0.25, Math.min(0.25, -vy * 0.06));
    const rw = (rect.w / 2 + (airborne ? 0 : 2)) * (1 - stretch) * look.size, rh = (rect.h / 2 - (airborne ? 0 : 2)) * (1 + stretch) * breath;
    for (const side of [-1, 1]) shadedBody(ctx, () => ctx.ellipse(cx + side * 9, bottom - 3, 5, airborne ? 4.5 : 2.5, side * (airborne ? 0.7 : 0), 0, TAU), c, 1);
    shadedBody(ctx, () => ctx.ellipse(cx, cy + 3, rw, rh, 0, 0, TAU), c);
    for (const side of [-1, 1]) shadedBody(ctx, () => ctx.arc(cx + side * 6, rect.y + 3, 4.5 * look.eyeSize, 0, TAU), c, 1);
    markings(ctx, look, c.shade, cx, cy + 4, rect.w * 0.8, rect.h * 0.6);
    ctx.fillStyle = tint(c.fill, 0, 14);
    ctx.beginPath(); ctx.ellipse(cx, bottom - 5, 5 + 1.5 * Math.sin(t * 6), 3 + 1.2 * Math.sin(t * 6), 0, 0, TAU); ctx.fill();
    face(ctx, { ...look, eyes: 2 }, cx, rect.y + 3, 2.6, aim, open, 1.05);
  },
  urchin({ ctx, c, look, cx, cy, t, aim, open, breath, time }) {
    const spin = time / 700 + look.phase, spikes = 10 + (look.eyes === 1 ? 4 : 2);
    shadedBody(ctx, () => {
      for (let i = 0; i < spikes; i++) {
        const a = spin + (i / spikes) * TAU, b = a + TAU / (spikes * 2), reach = 12 + 2 * Math.sin(t * 5 + i);
        ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
        ctx.lineTo(cx + Math.cos(b) * 7, cy + Math.sin(b) * 7);
      }
      ctx.closePath();
    }, c, 1.1);
    ctx.fillStyle = c.shade;
    ctx.beginPath(); ctx.arc(cx, cy, 6.5 * breath, 0, TAU); ctx.fill();
    face(ctx, { ...look, eyes: Math.min(look.eyes, 2), angry: true }, cx, cy, look.eyes === 1 ? 3.8 : 2.4, aim, open, 0.9);
  },
  spider({ ctx, p, c, look, o, rect, cx, cy, t, aim, open, breath, vy }) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = alpha(p.ink, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.quadraticCurveTo(cx + Math.sin(t * 2) * 4.5, (o.y + rect.y) / 2, cx, rect.y + 4); ctx.stroke();
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const skitter = Math.sin(t * 16) * (1 + Math.min(3, Math.abs(vy)));
    ctx.beginPath();
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { const ly = cy - 3 + k * 3, wave = skitter * (k % 2 ? 1 : -1); ctx.moveTo(cx + side * 5, ly); ctx.lineTo(cx + side * 12, ly - 4 + wave); ctx.lineTo(cx + side * 15, ly + 4 + wave * 0.5); }
    ctx.stroke();
    shadedBody(ctx, () => ctx.ellipse(cx, cy + 3, 7 * look.size, 8 * breath, 0, 0, TAU), c);
    shadedBody(ctx, () => ctx.arc(cx, cy - 6, 4.5, 0, TAU), c, 1);
    markings(ctx, look, c.shade, cx, cy + 4, 10, 10);
    gleam(ctx, cx - 3, cy + 1);
    face(ctx, { ...look, eyes: 2 + (look.eyes === 3 ? 1 : 0) }, cx, cy - 6, 1.6, aim, open, 1.1);
    fangs(ctx, { ...look, fangs: 2 }, cx, cy - 3);
  },
  spitter({ ctx, c, look, o, level, state, rect, cx, cy, bottom, t, aim, open }) {
    const shot = level.objects.find(s => s.type === 'shot' && s.source === o.id);
    const phase = shot ? cycleAt(shot, state.clock) : 0;
    const charge = shot && shot.period - phase < 40 ? (40 - (shot.period - phase)) / 40 : 0;
    const recoil = shot && phase < 12 ? 1 - phase / 12 : 0;
    const puff = 1 + charge * 0.3 - recoil * 0.15, dir = o.dir ?? aim.x;
    shadedBody(ctx, () => { ctx.moveTo(cx - (rect.w / 2) * puff, bottom); ctx.quadraticCurveTo(cx - (rect.w / 2) * puff, rect.y - 4 * puff, cx, rect.y - 2 - 4 * (puff - 1) * 4); ctx.quadraticCurveTo(cx + (rect.w / 2) * puff, rect.y - 4 * puff, cx + (rect.w / 2) * puff, bottom); ctx.closePath(); }, c);
    markings(ctx, look, c.shade, cx, cy + 2, rect.w, rect.h);
    crest(ctx, c, cx, rect.y - 2, look);
    const gape = 3 + (recoil ? 5 : charge * 2) + Math.abs(Math.sin(t * 4));
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(cx + dir * 6, cy + 2, 4 + recoil * 2, gape, 0, 0, TAU); ctx.fill();
    fangs(ctx, look, cx + dir * 6, cy - gape + 2);
    face(ctx, look, cx - dir * 3, rect.y + 5, 2.5, aim, open, 0.9);
  },
  crawler({ ctx, c, look, cx, cy, t, aim, open, vx, vy }) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(vy, vx || 0.01));
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) for (const side of [-1, 1]) { ctx.moveTo(k * 4, 0); ctx.lineTo(k * 5 + Math.sin(t * 16 + k) * 1.5, side * 8); }
    ctx.stroke();
    shadedBody(ctx, () => ctx.ellipse(0, 0, 9, 6, 0, 0, TAU), c, 1.2);
    ctx.strokeStyle = c.shade;
    for (const x of [-3, 2]) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x, 5); ctx.stroke(); }
    ctx.restore();
    face(ctx, { ...look, eyes: 2, angry: false }, cx, cy, 1.8, aim, open, 0.9);
  },
  puffer({ ctx, c, look, rect, cx, cy, aim, open }) {
    const r = rect.w / 2, spines = 12;
    shadedBody(ctx, () => {
      for (let i = 0; i < spines; i++) {
        const a = (i / spines) * TAU, b = a + TAU / (spines * 2);
        ctx.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
        ctx.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r);
      }
      ctx.closePath();
    }, c, 1.1);
    gleam(ctx, cx - r * 0.45, cy - r * 0.45, r * 0.14);
    face(ctx, { ...look, eyes: 2 }, cx, cy - r * 0.1, Math.max(2, r * 0.22), aim, open, 1);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.4, Math.max(1.5, r * 0.14), 0, TAU); ctx.fill();
  },
  leaper({ ctx, c, look, cx, cy, t, open, aim, vy }) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(vy < -0.2 ? -Math.PI / 2 : vy > 0.2 ? Math.PI / 2 : 0);
    const wag = Math.sin(t * 16) * 3;
    shadedBody(ctx, () => { ctx.moveTo(-9, 0); ctx.lineTo(-17, -6 + wag); ctx.lineTo(-17, 6 + wag); ctx.closePath(); }, c, 1.1);
    shadedBody(ctx, () => { ctx.moveTo(-2, -6); ctx.lineTo(2, -12); ctx.lineTo(6, -6); ctx.closePath(); }, c, 1.1);
    shadedBody(ctx, () => ctx.ellipse(0, 0, 11, 7.5, 0, 0, TAU), c);
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath(); ctx.moveTo(8, 3); ctx.lineTo(10, 6); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    face(ctx, { ...look, eyes: 1 }, cx + (vy ? 0 : 4), cy - (vy ? 3 : 2), 2.6, aim, open);
  },
};

function aimLine(ctx, x0, y0, x1, y1, strength) {
  ctx.strokeStyle = alpha(ALERT, 0.25 + 0.6 * strength);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
}

const sleepy = look => ({ ...look, angry: false });

const LURK_ART = {
  faller({ ctx, c, look, o, m, cx, t, aim }) {
    if (m.mode === 'splat') {
      ctx.fillStyle = c.shade;
      ctx.beginPath(); ctx.ellipse(cx, m.y + o.h - 2, o.w * 0.8 * Math.max(0.2, 1 - m.age / 90), 3, 0, 0, TAU); ctx.fill();
      return;
    }
    const grown = m.mode === 'regrow' ? m.age / 120 : 1, jolt = m.mode === 'shake' ? Math.sin(m.age * 2.2) * 2.5 : 0, drop = m.mode === 'fall';
    const top = m.y, tall = (drop ? o.h + 6 : o.h) * grown, wide = (drop ? 8 : 11) * grown, x = cx + jolt;
    shadedBody(ctx, () => { ctx.moveTo(x - wide, top); ctx.lineTo(x + wide, top); ctx.quadraticCurveTo(x + wide, top + tall * 0.7, x, top + tall); ctx.quadraticCurveTo(x - wide, top + tall * 0.7, x - wide, top); ctx.closePath(); }, c);
    if (grown < 1) return;
    gleam(ctx, x - 4, top + 5);
    const awake = m.mode !== 'idle';
    face(ctx, { ...look, eyes: 2, angry: awake }, x, top + 7, 2.4, aim, awake ? 1 : Math.abs(Math.sin(t * 0.7)) > 0.92 ? 1 : 0.12, 1);
  },
  hound({ ctx, c, look, o, m, cx, bottom, t, aim, open }) {
    const dir = m.dir, chase = m.mode === 'chase', stride = chase ? Math.sin(t * 24) * 3 : 0, top = m.y + (chase ? 2 : 4);
    legs(ctx, c, cx, bottom, stride, 8);
    shadedBody(ctx, () => {
      ctx.moveTo(cx - dir * 13, bottom - 3);
      ctx.lineTo(cx - dir * 15, top - 1);
      ctx.lineTo(cx - dir * 7, top + 2);
      ctx.lineTo(cx + dir * 4, top - 1);
      ctx.lineTo(cx + dir * 6, top - 7);
      ctx.lineTo(cx + dir * 9, top - 1);
      ctx.lineTo(cx + dir * 14, top + 5);
      ctx.lineTo(cx + dir * 13, bottom - 3);
      ctx.closePath();
    }, c);
    markings(ctx, look, c.shade, cx, top + 4, o.w * 0.8, o.h * 0.5);
    face(ctx, { ...look, eyes: 1, angry: chase }, cx + dir * 7, top + 4, 2.4, aim, m.mode === 'idle' ? 0.15 : open);
    if (chase) fangs(ctx, { ...look, fangs: 2 }, cx + dir * 9, bottom - 7);
  },
  swooper({ ctx, c, look, o, m, cx, cy, t, aim, open }) {
    if (m.mode === 'aim' && m.aim) aimLine(ctx, cx, cy, m.aim.x + o.w / 2, m.aim.y + o.h / 2, m.age / 28);
    const spread = m.mode === 'idle' ? 0.35 : m.mode === 'dive' ? 0.75 : 1, flap = m.mode === 'dive' ? 0 : Math.sin(t * 16) * 5 * spread;
    for (const side of [-1, 1]) shadedBody(ctx, () => { ctx.moveTo(cx + side * 4, cy - 2); ctx.lineTo(cx + side * 18 * spread, cy - 8 - flap); ctx.lineTo(cx + side * 13 * spread, cy + 2 - flap / 2); ctx.lineTo(cx + side * 4, cy + 4); ctx.closePath(); }, c, 1.1);
    shadedBody(ctx, () => { ctx.moveTo(cx, cy - 9); ctx.quadraticCurveTo(cx + 8, cy - 6, cx + 6, cy + 3); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 6, cy + 3); ctx.quadraticCurveTo(cx - 8, cy - 6, cx, cy - 9); ctx.closePath(); }, c);
    face(ctx, { ...look, eyes: 2, angry: m.mode !== 'idle' }, cx, cy - 3, 2, aim, m.mode === 'idle' ? 0.15 : open, 0.95);
    ctx.fillStyle = ALERT;
    ctx.beginPath(); ctx.moveTo(cx - 2, cy + 1); ctx.lineTo(cx + 2, cy + 1); ctx.lineTo(cx, cy + 5); ctx.closePath(); ctx.fill();
  },
  snapper({ ctx, c, look, o, m, cx, bottom, aim, open }) {
    if (m.mode === 'idle' || m.mode === 'tell' || m.mode === 'sink') {
      const peek = m.mode === 'tell' ? 7 : 3;
      face(ctx, { ...look, eyes: 2, angry: m.mode === 'tell' }, cx, bottom - peek, 2.2, aim, open, 1.2);
      return;
    }
    const rise = BITE_RISE + o.h, gape = 8 + Math.abs(Math.sin(m.age * 0.5)) * 6;
    for (const side of [-1, 1]) {
      shadedBody(ctx, () => { ctx.moveTo(cx + side * 3, bottom); ctx.quadraticCurveTo(cx + side * (gape + 10), bottom - rise * 0.5, cx + side * 2, bottom - rise); ctx.lineTo(cx + side * gape * 0.6, bottom - rise * 0.5); ctx.closePath(); }, c);
      ctx.fillStyle = EYE_WHITE;
      for (let k = 1; k <= 3; k++) { const y = bottom - (rise * k) / 4; ctx.beginPath(); ctx.moveTo(cx + side * gape * 0.5, y - 3); ctx.lineTo(cx + side * (gape * 0.5 - 4), y); ctx.lineTo(cx + side * gape * 0.5, y + 3); ctx.closePath(); ctx.fill(); }
    }
  },
  bomber({ ctx, c, look, o, m, cx, cy, bottom, t, aim, open, time }) {
    if (m.mode === 'gone') return;
    if (m.mode === 'blast') {
      const k = m.age / 10, r = BLAST_RADIUS * (0.5 + k * 0.5);
      ctx.fillStyle = alpha(ALERT, 0.8 * (1 - k));
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = alpha(c.fill, 1 - k);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      return;
    }
    const lit = m.mode === 'fuse', swell = lit ? 1 + (m.age / 42) * 0.25 : 1, hot = lit && Math.floor(m.age / 5) % 2 === 0;
    const skin = hot ? { fill: ALERT, shade: c.fill, line: c.line } : c;
    legs(ctx, c, cx, bottom, m.mode === 'walk' ? Math.sin(t * 18) * 2.5 : 0, 5);
    shadedBody(ctx, () => ctx.arc(cx, cy, (o.w / 2) * swell, 0, TAU), skin);
    gleam(ctx, cx - 4, cy - 5);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 2, m.y); ctx.quadraticCurveTo(cx + 7, m.y - 7, cx + 3, m.y - 11); ctx.stroke();
    if (m.mode !== 'idle') { ctx.fillStyle = ALERT; ctx.beginPath(); ctx.arc(cx + 3, m.y - 12, 2 + Math.sin(time / 40), 0, TAU); ctx.fill(); }
    face(ctx, { ...look, eyes: 2, angry: lit }, cx, cy, 2.3, aim, m.mode === 'idle' ? 0.2 : open, 1);
  },
  charger({ ctx, c, look, o, m, cx, bottom, t, aim, open, time }) {
    const dir = m.dir, stun = m.mode === 'stun', charge = m.mode === 'charge', top = m.y + 3;
    legs(ctx, c, cx, bottom, charge ? Math.sin(t * 28) * 3 : m.mode === 'paw' ? Math.sin(t * 18) * 2 : 0, 10);
    shadedBody(ctx, () => { ctx.moveTo(cx + dir * 7, top + 2); ctx.lineTo(cx + dir * 19, top - 7); ctx.lineTo(cx + dir * 14, top + 7); ctx.closePath(); }, { fill: 'hsl(40 40% 84%)', shade: 'hsl(35 25% 60%)', line: c.line }, 1);
    shadedBody(ctx, () => ctx.roundRect(cx - o.w / 2, top, o.w, o.h - 6, 6), c);
    markings(ctx, look, c.shade, cx - dir * 4, top + 4, o.w * 0.5, o.h * 0.4);
    if (stun) {
      ctx.fillStyle = ALERT;
      for (let k = 0; k < 3; k++) { const a = time / 200 + (k * TAU) / 3; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 10, top - 5 + Math.sin(a) * 3, 1.8, 0, TAU); ctx.fill(); }
    }
    face(ctx, { ...look, eyes: 1, angry: !stun }, cx + dir * 8, top + 7, 2.6, aim, stun ? 0.2 : open);
  },
  sniper({ ctx, c, o, m, cx, bottom, player, time }) {
    const eye = { x: cx, y: m.y + 7 }, aiming = m.mode === 'aim', target = aiming && m.aim ? m.aim : player;
    if (aiming && m.aim) aimLine(ctx, eye.x, eye.y, m.aim.x, m.aim.y, m.age / 55);
    shadedBody(ctx, () => { ctx.moveTo(cx - o.w / 2, bottom); ctx.quadraticCurveTo(cx - 3, bottom - 8, cx - 2, eye.y); ctx.lineTo(cx + 2, eye.y); ctx.quadraticCurveTo(cx + 3, bottom - 8, cx + o.w / 2, bottom); ctx.closePath(); }, c);
    shadedBody(ctx, () => ctx.arc(eye.x, eye.y, 7.5, 0, TAU), { fill: EYE_WHITE, shade: 'hsl(0 0% 78%)', line: c.line });
    const d = Math.hypot(target.x - eye.x, target.y - eye.y) || 1, ix = eye.x + ((target.x - eye.x) / d) * 3, iy = eye.y + ((target.y - eye.y) / d) * 3;
    ctx.fillStyle = aiming && m.age > 40 ? ALERT : c.fill;
    ctx.beginPath(); ctx.arc(ix, iy, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(ix, iy, 1.8, 0, TAU); ctx.fill();
    if (m.bolt) {
      const bx = m.bolt.x + 5, by = m.bolt.y + 5;
      ctx.fillStyle = alpha(ALERT, 0.4);
      ctx.beginPath(); ctx.arc(bx, by, 8 + Math.sin(time / 50), 0, TAU); ctx.fill();
      ctx.fillStyle = ALERT;
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, TAU); ctx.fill();
    }
  },
  wraith({ ctx, c, look, o, m, cx, bottom, t, aim, time }) {
    const shy = m.mode === 'shy', sway = Math.sin(time / 500) * 2, x = cx + sway, top = m.y, half = o.w / 2;
    const veil = { fill: alpha(tint(c.fill, 0, 34), shy ? 0.45 : 0.8), shade: alpha(c.fill, shy ? 0.4 : 0.75), line: alpha(c.line, shy ? 0.5 : 0.85) };
    shadedBody(ctx, () => {
      ctx.moveTo(x - half, bottom);
      ctx.bezierCurveTo(x - half, top - 5, x + half, top - 5, x + half, bottom);
      for (let k = 3; k >= 0; k--) { const hx = x - half + (k * o.w) / 4; ctx.quadraticCurveTo(hx + o.w / 8, bottom - 6 + Math.sin(t * 5 + k) * 2, hx, bottom); }
      ctx.closePath();
    }, veil);
    if (shy) {
      ctx.fillStyle = veil.line;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + side * 4.5, top + 9, 4.5, 3.4, 0, 0, TAU); ctx.fill(); }
      return;
    }
    face(ctx, { ...look, eyes: 2, angry: m.mode === 'hunt' }, x, top + 9, 2.6, aim, 1, 1);
    if (m.mode === 'hunt') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, top + 16, 3, 3.5 + Math.sin(t * 4), 0, 0, TAU); ctx.fill(); }
  },
};

const coloursOf = (p, look) => {
  const fill = tint(p.hazard, look.hue, look.light);
  return { fill, shade: tint(fill, 0, -14), line: tint(fill, 0, -34) };
};

export function drawMonster(ctx, p, theme, level, o, state, time, player) {
  const look = lookOf(o), c = coloursOf(p, look);
  if (slain(state, o)) {
    if (!o.motion && !o.dx && !o.dy) squashed(ctx, c, o);
    return;
  }
  const rect = objectRect(o, state.clock), t = time / 1000 * look.tempo + look.phase;
  const { vx, vy } = velocity(o, state.clock);
  glow(ctx, theme, c.fill, 10);
  ROAMERS[o.kind]({
    ctx, p, c, look, o, level, state, rect, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, bottom: rect.y + rect.h, t, time, vx, vy,
    aim: gaze(o, rect, player, facingOf(o, state.clock)), open: blink(t, look.phase), breath: 1 + 0.04 * Math.sin(t * 3),
  });
  ctx.shadowBlur = 0;
}

export function drawLurker(ctx, p, theme, o, state, time, player) {
  const look = lookOf(o), c = coloursOf(p, look), m = lurkerOf(o, state), rect = { x: m.x, y: m.y, w: o.w, h: o.h };
  if (m.dead) {
    if (o.kind !== 'wraith' && o.kind !== 'swooper') squashed(ctx, c, rect);
    return;
  }
  const t = time / 1000 * look.tempo + look.phase;
  glow(ctx, theme, c.fill, 10);
  LURK_ART[o.kind]({ ctx, p, c, look: sleepy(look), o, m, player, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, bottom: rect.y + rect.h, t, time, aim: gaze(o, rect, player, m.dir), open: blink(t, look.phase) });
  ctx.shadowBlur = 0;
}
