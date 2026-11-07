import { levelIndex } from '../world/level.js';
import { afloat, swellPhase } from '../world/bodies.js';
import { alpha, shade } from './themes.js';
import { TAU, contactShadow, glint, slab } from './paint.js';

export function drawPlatform(ctx, p, theme, rect, style) {
  if (style === p.rock) contactShadow(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  slab(ctx, rect.x, rect.y, rect.w, rect.h, 5, style, theme.outline ? p.ink : style === p.rock ? shade(p.rock, -10) : null, theme.outline || 1.2);
  ctx.fillStyle = p.rockEdge;
  ctx.fillRect(rect.x + 3, rect.y, rect.w - 6, 3);
}

export function drawRivets(ctx, color, points) {
  ctx.fillStyle = color;
  for (const [x, y] of points) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
}

const CRATE_LOOKS = {
  wood: { fill: 'hsl(32 55% 46%)', ink: 'hsl(28 50% 26%)' },
  steel: { fill: 'hsl(210 12% 64%)', ink: 'hsl(212 16% 34%)' },
  stone: { fill: 'hsl(30 6% 38%)', ink: 'hsl(30 8% 20%)' },
};

export function drawCrate(ctx, theme, p, kind, x, y, size) {
  const look = CRATE_LOOKS[kind];
  slab(ctx, x, y, size, size, kind === 'stone' ? 6 : 3, look.fill, theme.outline ? p.ink : look.ink, kind === 'stone' ? 2.5 : 2);
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'wood') {
    ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + size - 5, y + size - 5);
    ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + size - 3, y + 5);
    ctx.moveTo(x + 3, y + size - 5); ctx.lineTo(x + size - 3, y + size - 5);
    ctx.stroke();
  } else if (kind === 'steel') {
    drawRivets(ctx, look.ink, [[x + 5, y + 5], [x + size - 5, y + 5], [x + 5, y + size - 5], [x + size - 5, y + size - 5]]);
    ctx.fillStyle = look.ink;
    ctx.fillRect(x + 7, y + size / 2 - 1, size - 14, 2);
    ctx.fillStyle = 'hsl(0 0% 100% / 0.45)';
    ctx.fillRect(x + 7, y + size / 2 + 1, size - 14, 1);
  } else {
    ctx.moveTo(x + size * 0.3, y + 3); ctx.lineTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.25, y + size * 0.7);
    ctx.moveTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.8, y + size * 0.6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

const ROCK = 0.05;

export function drawBodies(ctx, p, theme, level, state) {
  const crates = levelIndex(level).crates;
  state.bodies.forEach((b, k) => {
    if (b.gone) return;
    const crate = crates[k];
    if (k === state.held || !afloat(level, b, crate)) return drawCrate(ctx, theme, p, crate.kind, b.x, b.y, crate.w);
    ctx.save();
    ctx.translate(b.x + crate.w / 2, b.y + crate.w / 2);
    ctx.rotate(Math.cos(swellPhase(b, state.clock)) * ROCK);
    drawCrate(ctx, theme, p, crate.kind, -crate.w / 2, -crate.w / 2, crate.w);
    ctx.restore();
  });
}

export const CAST_INK = 'hsl(240 35% 8% / 0.25)';
export const SHEEN = 'hsl(0 0% 100% / 0.35)';

function drawGlue(ctx, p, o, time) {
  const inner = o.side > 0 ? o.x : o.x + o.w, out = -o.side;
  ctx.fillStyle = alpha(p.accent, 0.75);
  ctx.beginPath();
  ctx.moveTo(inner, o.y - 4);
  for (let y = o.y; y <= o.y + o.h; y += 16) {
    const bulge = 4 + 3 * Math.sin(time / 900 + y / 23);
    ctx.quadraticCurveTo(inner + out * (bulge + 5), y + 8, inner + out * bulge * 0.4, y + 16);
  }
  ctx.lineTo(inner, o.y + o.h + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SHEEN;
  for (let y = o.y + 10; y < o.y + o.h; y += 32) { ctx.beginPath(); ctx.arc(inner + out * 3, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
}

export function drawClimb(ctx, p, look, o, time) {
  const cx = o.x + o.w / 2, bottom = o.y + o.h;
  ctx.lineCap = 'round';
  if (look === 'glue') return drawGlue(ctx, p, o, time);
  if (look === 'ladder') {
    const trace = dx => {
      ctx.beginPath();
      for (const x of [o.x + 2, o.x + o.w - 2]) { ctx.moveTo(x + dx, o.y - 6 + dx); ctx.lineTo(x + dx, bottom); }
      for (let y = o.y + 4; y < bottom; y += 12) { ctx.moveTo(o.x + 2 + dx, y + dx); ctx.lineTo(o.x + o.w - 2 + dx, y + dx); }
      ctx.stroke();
    };
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = CAST_INK;
    trace(1.5);
    ctx.strokeStyle = p.ink;
    trace(0);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = SHEEN;
    trace(-0.5);
    return;
  }
  const sway = y => Math.sin(time / 700 + y / 40) * 2.5 * ((y - o.y) / o.h);
  const strand = dx => {
    ctx.beginPath();
    ctx.moveTo(cx + dx, o.y - 6);
    for (let y = o.y; y <= bottom; y += 6) ctx.lineTo(cx + sway(y) + dx, y);
    ctx.stroke();
  };
  ctx.lineWidth = 3;
  ctx.strokeStyle = CAST_INK;
  strand(1.5);
  ctx.strokeStyle = look === 'vine' ? p.rockEdge : p.ink;
  strand(0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = SHEEN;
  strand(-0.6);
  ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  for (let y = o.y + 10, k = 0; y < bottom; y += 22, k++) {
    ctx.beginPath();
    if (look === 'vine') ctx.ellipse(cx + sway(y) + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
    else ctx.arc(cx + sway(y), y, 3, 0, TAU);
    ctx.fill();
    glint(ctx, cx + sway(y) + (look === 'vine' ? (k % 2 ? 4 : -8) : -1), y - 1, 0.9);
    ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  }
}

export function drawFlag(ctx, p, o, touched, time) {
  const x = o.x + 5, top = o.y + 4, bottom = o.y + o.h;
  const wave = Math.sin(time / 180 + o.x) * 2;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.strokeStyle = SHEEN;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 0.5, top); ctx.lineTo(x - 0.5, bottom); ctx.stroke();
  ctx.fillStyle = touched ? p.accent : alpha(p.dim, 0.5);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
  if (touched) {
    ctx.fillStyle = p.accentDeep;
    ctx.beginPath(); ctx.moveTo(x, top + 6.5 + wave / 2); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = p.ink;
  ctx.beginPath(); ctx.arc(x, top, 2, 0, TAU); ctx.fill();
  glint(ctx, x - 0.6, top - 0.6, 0.7);
}
