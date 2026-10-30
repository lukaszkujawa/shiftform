import { objectRect, overlaps } from './level.js?v=ea2fce6';
import { hashString } from './rng.js?v=ea2fce6';
import { TAU } from './life-kit.js?v=ea2fce6';
import { alpha } from './themes.js?v=ea2fce6';
import { glow, lit, sprite, stamp } from './sprites.js?v=ea2fce6';
import { tint } from './monsters.js?v=ea2fce6';

const touches = new Map();
const keyOf = o => `${o.id}:${Math.round(o.x)}:${Math.round(o.y)}`;
const variant = (o, n) => hashString(keyOf(o)) % n;

function touched(o, rect, player, time, pad = 4) {
  const key = keyOf(o);
  if (player && overlaps(player.x, player.y, player.w, player.h, { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 })) touches.set(key, time);
  const since = (time - (touches.get(key) ?? -1e9)) / 1000;
  return since < 0.7 ? Math.exp(-since * 5) * Math.cos(since * 28) : 0;
}

export function drawSpring(ctx, p, o, time, player, color = p.accent) {
  const up = (o.dir ?? -1) < 0;
  const kick = touched(o, o, player, time, 6);
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
  const hit = touched(o, o, player, time), pulse = 1 + 0.06 * Math.sin(time / 300 + o.x) + Math.max(0, hit) * 0.25;
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

export function drawSaw(ctx, p, theme, o, clock, time) {
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
  const along = Math.abs(rect.x - o.x) + Math.abs(rect.y - o.y), span = Math.abs(o.dx) + Math.abs(o.dy);
  const atEnd = span > 0 && (along < 6 || span - along < 6);
  if (atEnd) {
    glow(ctx, theme, p.hazard, 8);
    ctx.strokeStyle = alpha(p.text, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (time / 90 + i * 1.7) % TAU, len = 6 + ((time / 30 + i * 7) % 8);
      ctx.moveTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); ctx.lineTo(cx + Math.cos(a) * (15 + len), cy + Math.sin(a) * (15 + len));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
