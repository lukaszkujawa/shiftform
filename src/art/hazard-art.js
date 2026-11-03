import { objectRect, phaseOn, cycleAt } from '../world/level.js?v=dd78f3b';
import { alpha, tint } from './themes.js?v=dd78f3b';
import { glow } from './sprites.js?v=dd78f3b';
import { TAU, glint, slab } from './paint.js?v=dd78f3b';

const LOOKS = {
  ember: 'lava', inferno: 'lava', mine: 'lava', dunes: 'lava',
  crystal: 'shards', frost: 'shards', lunar: 'shards', cathedral: 'shards', sky: 'shards',
  jungle: 'thorns', bayou: 'thorns', blossom: 'thorns', country: 'thorns', autumn: 'thorns', mushroom: 'thorns', savanna: 'thorns', ruins: 'thorns', hive: 'thorns',
  neon: 'arcs', matrix: 'arcs', synthwave: 'arcs', void: 'arcs', ship: 'arcs', city: 'arcs', office: 'arcs',
  lab: 'ooze', factory: 'ooze', deep: 'ooze', harbor: 'ooze', pirate: 'ooze', haunted: 'ooze',
};

const teethOf = o => Math.max(1, Math.round(o.w / 12));
const edges = o => ({ tip: o.dir < 0 ? o.y : o.y + o.h, base: o.dir < 0 ? o.y + o.h : o.y, up: o.dir < 0 ? 1 : -1 });

function blades(ctx, p, o) {
  const { tip, base } = edges(o), n = teethOf(o);
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
    ctx.moveTo(x0, base); ctx.lineTo((x0 + x1) / 2, tip); ctx.lineTo(x1, base);
  }
  ctx.fill();
  ctx.fillStyle = tint(p.hazard, 0, -16);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
    ctx.moveTo((x0 + x1) / 2, base); ctx.lineTo((x0 + x1) / 2, tip); ctx.lineTo(x1, base);
  }
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
    ctx.moveTo(x0, base); ctx.lineTo((x0 + x1) / 2, tip); ctx.lineTo(x1, base);
  }
}

function shards(ctx, p, o) {
  const { base, up } = edges(o), n = teethOf(o);
  for (let i = 0; i < n; i++) {
    const x = o.x + ((i + 0.5) * o.w) / n, wide = o.w / n / 2, tall = o.h * (0.65 + 0.35 * Math.abs(Math.sin(o.x + i * 2.4))), lean = Math.sin(o.x * 0.7 + i * 1.7) * 3;
    ctx.fillStyle = p.hazard;
    ctx.beginPath(); ctx.moveTo(x - wide, base); ctx.lineTo(x + lean, base - up * tall); ctx.lineTo(x + wide, base); ctx.fill();
    ctx.fillStyle = alpha('white', 0.45);
    ctx.beginPath(); ctx.moveTo(x - wide * 0.4, base); ctx.lineTo(x + lean, base - up * tall); ctx.lineTo(x, base); ctx.fill();
  }
}

function thorns(ctx, p, o, time) {
  const { base, up } = edges(o), n = teethOf(o), dark = tint(p.hazard, 0, -16), sway = Math.sin(time / 500 + o.x) * 1.5;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(o.x, base - up * 4);
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(o.x + ((i - 0.5) * o.w) / n, base - up * (i % 2 ? 11 : 1), o.x + (i * o.w) / n, base - up * 4);
  ctx.stroke();
  ctx.fillStyle = p.hazard;
  for (let i = 0; i < n; i++) {
    const x = o.x + ((i + 0.5) * o.w) / n, side = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(x - 4, base - up * 4); ctx.quadraticCurveTo(x + side * 2 + sway, base - up * 9, x + side * 5 + sway, base - up * o.h); ctx.lineTo(x + 4, base - up * 4); ctx.fill();
  }
}

function lava(ctx, p, o, time, theme) {
  const { tip, base, up } = edges(o), wave = x => Math.sin(x * 0.09 + time / 260) * 2 + Math.sin(x * 0.23 - time / 410);
  glow(ctx, theme, p.hazard, 14);
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  ctx.moveTo(o.x, base);
  for (let x = o.x; x <= o.x + o.w; x += 5) ctx.lineTo(x, tip + up * (3 + wave(x)));
  ctx.lineTo(o.x + o.w, base);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = tint(p.hazard, 25, 22);
  for (let k = 0; k * 22 < o.w; k++) {
    const age = (time / 900 + k * 0.37) % 1, x = o.x + 6 + k * 22 + Math.sin(k * 3) * 4;
    ctx.beginPath(); ctx.arc(x, base - up * (4 + age * 9), 2.5 * (1 - age), 0, TAU); ctx.fill();
  }
}

function ooze(ctx, p, o, time) {
  const { base, up } = edges(o), n = teethOf(o);
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  ctx.moveTo(o.x, base);
  for (let i = 0; i <= n; i++) {
    const x = o.x + (i * o.w) / n, swell = Math.sin(time / 350 + i * 1.9 + o.x) * 2.5;
    ctx.quadraticCurveTo(x - o.w / n / 2, base - up * (i % 2 ? 14 + swell : 8 + swell), x, base - up * 7);
  }
  ctx.lineTo(o.x + o.w, base);
  ctx.fill();
  ctx.fillStyle = alpha('white', 0.4);
  for (let i = 0; i < n; i += 2) { ctx.beginPath(); ctx.arc(o.x + ((i + 0.5) * o.w) / n, base - up * 8, 1.8, 0, TAU); ctx.fill(); }
}

function arcs(ctx, p, o, time, theme) {
  const { base, up } = edges(o), n = teethOf(o), tick = Math.floor(time / 70);
  ctx.fillStyle = tint(p.hazard, 0, -20);
  ctx.fillRect(o.x, up > 0 ? base - 4 : base, o.w, 4);
  glow(ctx, theme, p.hazard, 10);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = o.x + ((i + 0.5) * o.w) / n, jag = k => Math.sin((tick + i * 7) * 12.9898 + k * 78.2) * 4;
    ctx.moveTo(x, base);
    for (let k = 1; k <= 3; k++) ctx.lineTo(x + jag(k), base - up * (o.h * k) / 3);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

const SPIKE_ART = { blades, shards, thorns, lava, ooze, arcs };

export const spikeLook = theme => LOOKS[theme.id] ?? 'blades';

export function drawSpikes(ctx, p, theme, o, time) {
  const look = spikeLook(theme);
  SPIKE_ART[look](ctx, p, o, time, theme);
  ctx.shadowBlur = 0;
  if (look === 'blades' && theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawMine(ctx, p, o, clock) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.w / 2, wink = Math.floor(clock / 20) % 2;
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, reach = i % 2 ? r * 0.68 : r;
    ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint(p.hazard, 0, -26);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = wink ? 'white' : p.hazard;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, TAU); ctx.fill();
  glint(ctx, cx - r * 0.32, cy - r * 0.32, 1.5);
}

function drawPendulum(ctx, p, o, clock) {
  const rect = objectRect(o, clock), cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, px = o.x + o.w / 2, py = o.y + o.h / 2;
  const angle = Math.atan2(cx - px, cy - py);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.fillStyle = p.ink;
  ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-angle);
  ctx.fillStyle = p.hazard;
  ctx.beginPath(); ctx.moveTo(-rect.w / 2 - 3, -5); ctx.quadraticCurveTo(0, -rect.h / 2 + 2, rect.w / 2 + 3, -5); ctx.quadraticCurveTo(rect.w / 3, rect.h / 2 + 3, 0, rect.h / 2 + 5); ctx.quadraticCurveTo(-rect.w / 3, rect.h / 2 + 3, -rect.w / 2 - 3, -5); ctx.fill();
  ctx.fillStyle = alpha('white', 0.35);
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(rect.w / 3, 2); ctx.lineTo(0, rect.h / 2 + 3); ctx.fill();
  ctx.restore();
}

function drawCrusher(ctx, p, o, clock) {
  const rect = objectRect(o, clock), cx = rect.x + rect.w / 2;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.lineTo(cx, rect.y); ctx.stroke();
  ctx.setLineDash([]);
  slab(ctx, rect.x, rect.y, rect.w, rect.h - 8, 2, tint(p.rockEdge, 0, -10));
  ctx.fillStyle = p.ink;
  ctx.fillRect(rect.x, rect.y, rect.w, 3);
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  const n = Math.round(rect.w / 8), bottom = rect.y + rect.h;
  for (let i = 0; i < n; i++) {
    const x0 = rect.x + (i * rect.w) / n, x1 = rect.x + ((i + 1) * rect.w) / n;
    ctx.moveTo(x0, bottom - 8); ctx.lineTo((x0 + x1) / 2, bottom); ctx.lineTo(x1, bottom - 8);
  }
  ctx.fill();
}

export function drawFlame(ctx, p, theme, o, state, time) {
  const on = phaseOn(o, state.clock), warming = !on && o.period - cycleAt(o, state.clock) < 30;
  const nozzle = o.dir < 0 ? o.y + o.h : o.y, reach = o.dir < 0 ? -1 : 1, cx = o.x + o.w / 2;
  slab(ctx, cx - 9, o.dir < 0 ? nozzle - 5 : nozzle, 18, 5, 1.5, p.ink);
  if (warming) {
    ctx.fillStyle = alpha(p.hazard, 0.6);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + Math.sin(time / 60 + k) * 4, nozzle + reach * (8 + k * 5), 2, 0, TAU); ctx.fill(); }
  }
  if (!on) return;
  glow(ctx, theme, p.hazard, 18);
  for (const [scale, color] of [[1, p.hazard], [0.55, tint(p.hazard, 30, 25)]]) {
    const half = (o.w / 2) * scale, length = o.h * (scale === 1 ? 1 : 0.7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - half, nozzle);
    for (let k = 1; k <= 4; k++) ctx.lineTo(cx - half * (1 - k / 5) + Math.sin(time / 45 + k * 2) * 3, nozzle + reach * (length * k) / 4);
    for (let k = 3; k >= 0; k--) ctx.lineTo(cx + half * (1 - k / 5) + Math.sin(time / 38 + k * 3) * 3, nozzle + reach * (length * k) / 4);
    ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export const KILLER_ART = { mine: drawMine, pendulum: drawPendulum, crusher: drawCrusher };
