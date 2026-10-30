import { objectRect, overlaps, wrap } from './level.js?v=5f043fa';
import { hashString } from './rng.js?v=5f043fa';
import { TAU } from './life-kit.js?v=5f043fa';
import { alpha } from './themes.js?v=5f043fa';
import { lit, sprite, stamp } from './sprites.js?v=5f043fa';
import { tint } from './monsters.js?v=5f043fa';
import { roundRect } from './paint.js?v=5f043fa';

const BELT = 5;
const CLEAT = 1.5;
const CLEAT_GAP = 9;
const RIVET_GAP = 36;
const touches = new Map();
const keyOf = o => `${o.id}:${Math.round(o.x)}:${Math.round(o.y)}`;
const variant = (o, n) => hashString(keyOf(o)) % n;

function touched(o, player, time, pad = 4) {
  const key = keyOf(o);
  if (player && overlaps(player.x, player.y, player.w, player.h, { x: o.x - pad, y: o.y - pad, w: o.w + pad * 2, h: o.h + pad * 2 })) touches.set(key, time);
  const since = (time - (touches.get(key) ?? -1e9)) / 1000;
  return since < 0.7 ? Math.exp(-since * 5) * Math.cos(since * 28) : 0;
}

export function drawSpring(ctx, p, o, time, player, color = p.accent) {
  const up = (o.dir ?? -1) < 0;
  const kick = touched(o, player, time, 6);
  const coils = 3 + variant(o, 3), compress = Math.max(0, kick) * 0.5 + 0.03 * Math.sin(time / 400 + o.x);
  const h = o.h * (1 - compress), top = up ? o.y + o.h - h : o.y;
  ctx.strokeStyle = tint(color, variant(o, 5) * 6 - 12);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(o.x + 2, up ? o.y + o.h : o.y);
  for (let i = 0; i <= coils * 2; i++) {
    const y = (up ? o.y + o.h : o.y) + (up ? -1 : 1) * (h * i) / (coils * 2);
    ctx.lineTo(i % 2 ? o.x + o.w - 2 : o.x + 2, y);
  }
  ctx.stroke();
  ctx.fillStyle = color;
  const padY = up ? top - 3 : top + h, stretch = 1 + Math.max(0, -kick) * 0.15;
  ctx.fillRect(o.x - 2 - (o.w * (stretch - 1)) / 2, padY, (o.w + 4) * stretch, 3);
  ctx.fillStyle = alpha(color, 0.5);
  ctx.fillRect(o.x, up ? o.y + o.h - 2 : o.y, o.w, 2);
  if (kick > 0.05) {
    ctx.strokeStyle = alpha(color, kick * 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, padY, o.w * (0.8 + (1 - kick) * 0.8), 3 + (1 - kick) * 6, 0, 0, TAU); ctx.stroke();
  }
}

export function drawBumper(ctx, p, theme, o, time, player) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const hit = touched(o, player, time), pulse = 1 + 0.06 * Math.sin(time / 300 + o.x) + Math.max(0, hit) * 0.25;
  const chevrons = 2 + variant(o, 2), blur = lit(theme, 10);
  const image = sprite(`bumper:${p.accent}:${p.accentSoft}:${chevrons}:${blur}`, 56, g => {
    g.shadowColor = p.accent;
    g.shadowBlur = blur;
    g.fillStyle = p.accentSoft;
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = p.accent;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = alpha(p.accent, 0.25);
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  stamp(ctx, image, 0, 0);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const slide = ((time / 160) % 6) * o.dir;
  for (let k = 0; k < chevrons; k++) {
    const x = -6 + ((k * 6 + slide + 60) % (chevrons * 6)) - 3;
    ctx.globalAlpha = 0.45 + 0.55 * (1 - Math.abs(x + 2) / 9);
    ctx.beginPath(); ctx.moveTo(x - 3 * o.dir, -5); ctx.lineTo(x + 3 * o.dir, 0); ctx.lineTo(x - 3 * o.dir, 5); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (hit > 0.05) {
    ctx.strokeStyle = alpha(p.accent, hit);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 14 + (1 - hit) * 14, 0, TAU); ctx.stroke();
  }
}

export function drawSaw(ctx, p, theme, o, clock) {
  const rect = objectRect(o, clock);
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const teeth = 8 + variant(o, 4) * 2, bolts = 3 + variant(o, 3), blur = lit(theme, 12);
  const ends = [[o.x + o.w / 2, o.y + o.h / 2], [o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2]];
  ctx.strokeStyle = alpha(p.ink, 0.3);
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ends[0][0], ends[0][1]); ctx.lineTo(ends[1][0], ends[1][1]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = alpha(p.ink, 0.4);
  for (const [x, y] of ends) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  const image = sprite(`saw:${p.hazard}:${p.bgTop}:${teeth}:${bolts}:${blur}`, 64, g => {
    g.shadowColor = p.hazard;
    g.shadowBlur = blur;
    g.fillStyle = p.hazard;
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU, b = a + TAU / (teeth * 2);
      g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
      g.lineTo(Math.cos(b) * 10, Math.sin(b) * 10);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = tint(p.hazard, 0, -20);
    g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    g.fillStyle = p.bgTop;
    for (let i = 0; i < bolts; i++) { const a = (i / bolts) * TAU; g.beginPath(); g.arc(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 1.2, 0, TAU); g.fill(); }
  });
  ctx.strokeStyle = alpha(p.hazard, 0.18);
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(clock / 6);
  stamp(ctx, image, 0, 0);
  ctx.restore();
}

function beltPoint(left, right, cy, radius, along) {
  const run = right - left, bend = Math.PI * radius;
  if (along < run) return { x: left + along, y: cy - radius, a: -Math.PI / 2 };
  if (along < run + bend) { const a = -Math.PI / 2 + (along - run) / radius; return { x: right + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, a }; }
  if (along < 2 * run + bend) return { x: right - (along - run - bend), y: cy + radius, a: Math.PI / 2 };
  const a = Math.PI / 2 + (along - 2 * run - bend) / radius;
  return { x: left + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, a };
}

function drawRoller(ctx, p, x, y, radius, turn) {
  ctx.fillStyle = p.rockDeep;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.rockEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = turn + (i * TAU) / 3; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); }
  ctx.stroke();
  ctx.fillStyle = p.rockEdge;
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
}

export function drawConveyor(ctx, p, theme, o, clock) {
  const r = o.h / 2, cy = o.y + r, left = o.x + r, right = o.x + o.w - r, radius = r - BELT / 2;
  const travel = clock * o.speed, loop = 2 * (right - left) + TAU * radius;
  roundRect(ctx, o.x, o.y, o.w, o.h, r);
  ctx.fillStyle = tint(p.rockDeep, 0, -8);
  ctx.fill();
  if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = theme.outline; ctx.stroke(); }
  ctx.fillStyle = p.rock;
  ctx.fillRect(left, o.y + BELT, right - left, o.h - 2 * BELT);
  ctx.fillStyle = alpha(p.rockEdge, 0.35);
  for (let x = left + RIVET_GAP / 2; x < right - RIVET_GAP / 4; x += RIVET_GAP) { ctx.beginPath(); ctx.arc(x, cy, 1.8, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = alpha(p.rockEdge, 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let along = wrap(travel, CLEAT_GAP); along < loop; along += CLEAT_GAP) {
    const { x, y, a } = beltPoint(left, right, cy, radius, along);
    const dx = Math.cos(a) * CLEAT, dy = Math.sin(a) * CLEAT;
    ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy);
  }
  ctx.stroke();
  for (const x of [left, right]) drawRoller(ctx, p, x, cy, r - BELT, travel / radius);
}
