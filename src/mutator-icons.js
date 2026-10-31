import { sprite, stamp } from './sprites.js';
import { TAU } from './paint.js';

export const EFFECT_COLORS = { boon: 'hsl(145 62% 46% / 1)', bane: 'hsl(355 78% 58% / 1)' };
const ICON_SIZE = 24;
const GLYPH = 'hsl(0 0% 100% / 1)';

const line = (g, ...pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
const shape = (g, ...pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
const ring = (g, x, y, r, a0 = 0, a1 = TAU) => { g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); };
const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const chevron = (g, y, w = 0.5) => line(g, -w, y + w * 0.7, 0, y, w, y + w * 0.7);
const arrow = (g, x0, y0, x1, y1) => {
  const a = Math.atan2(y1 - y0, x1 - x0), h = 0.35;
  line(g, x0, y0, x1, y1);
  line(g, x1 - h * Math.cos(a - 0.6), y1 - h * Math.sin(a - 0.6), x1, y1, x1 - h * Math.cos(a + 0.6), y1 - h * Math.sin(a + 0.6));
};
const wave = (g, y) => { g.beginPath(); g.moveTo(-0.7, y); g.quadraticCurveTo(-0.35, y - 0.25, 0, y); g.quadraticCurveTo(0.35, y + 0.25, 0.7, y); g.stroke(); };

const GLYPHS = {
  moon: g => { g.beginPath(); g.arc(0, 0, 0.62, 0.9, TAU - 0.9); g.arc(0.3, 0, 0.45, TAU - 1.45, 1.45, true); g.closePath(); g.fill(); },
  heavy: g => { shape(g, -0.6, 0.6, 0.6, 0.6, 0.38, -0.25, -0.38, -0.25); ring(g, 0, -0.42, 0.2); },
  flipjump: g => { arrow(g, -0.28, 0.6, -0.28, -0.55); arrow(g, 0.28, -0.6, 0.28, 0.55); },
  bouncy: g => line(g, -0.5, 0.6, 0.5, 0.4, -0.5, 0.15, 0.5, -0.1, -0.5, -0.35, 0.5, -0.6),
  ice: g => { for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; line(g, -Math.cos(a) * 0.65, -Math.sin(a) * 0.65, Math.cos(a) * 0.65, Math.sin(a) * 0.65); } },
  mirror: g => { arrow(g, -0.6, -0.25, 0.6, -0.25); arrow(g, 0.6, 0.3, -0.6, 0.3); },
  double: g => { chevron(g, -0.45); chevron(g, 0.05); },
  triple: g => { chevron(g, -0.6, 0.38); chevron(g, -0.15, 0.38); chevron(g, 0.3, 0.38); },
  walls: g => { line(g, -0.55, -0.65, -0.55, 0.65); arrow(g, -0.4, 0.45, 0.55, -0.35); },
  momentum: g => { arrow(g, -0.65, 0, 0.6, 0); line(g, -0.1, -0.5, 0.25, -0.15); line(g, 0.25, -0.5, -0.1, -0.15); },
  dash: g => { arrow(g, -0.2, 0, 0.65, 0); line(g, -0.65, -0.3, -0.3, -0.3); line(g, -0.7, 0.3, -0.35, 0.3); },
  superhot: g => { shape(g, -0.45, -0.6, 0.45, -0.6, 0, 0); shape(g, -0.45, 0.6, 0.45, 0.6, 0, 0); },
  wrap: g => { ring(g, 0, 0, 0.5, -1.2, Math.PI + 1.2); arrow(g, -0.2, -0.46, -0.05, -0.5); },
  tiny: g => { ring(g, 0, 0, 0.6); dot(g, 0, 0.25, 0.16); },
  giant: g => { g.fillRect(-0.55, -0.55, 1.1, 1.1); },
  glide: g => { g.beginPath(); g.arc(0, -0.05, 0.62, Math.PI, TAU); g.closePath(); g.fill(); line(g, 0, -0.05, 0, 0.5, -0.2, 0.62); },
  dark: g => { ring(g, 0, 0, 0.55); g.beginPath(); g.arc(0, 0, 0.55, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); },
  sprint: g => { g.fillRect(-0.5, -0.25, 0.75, 0.8); ring(g, 0.32, 0.1, 0.22, -Math.PI / 2, Math.PI / 2); line(g, -0.25, -0.65, -0.15, -0.4); line(g, 0.05, -0.65, 0.15, -0.4); },
  rationed: g => { line(g, -0.4, -0.55, 0.45, -0.55, -0.05, 0.6); line(g, -0.15, 0, 0.3, 0); },
  slowair: g => { ring(g, 0, 0.05, 0.58); line(g, 0, 0.05, 0, -0.32); line(g, 0, 0.05, 0.25, 0.2); },
  blink: g => { for (const [x, y] of [[-0.45, 0.5], [-0.2, 0.15], [0.05, -0.15]]) dot(g, x, y, 0.1); arrow(g, 0.05, -0.15, 0.5, -0.6); },
  rubber: g => { line(g, 0.6, -0.65, 0.6, 0.65); g.beginPath(); g.moveTo(-0.6, -0.4); g.quadraticCurveTo(0.7, 0, -0.45, 0.45); g.stroke(); line(g, -0.25, 0.25, -0.45, 0.45, -0.2, 0.6); },
  glass: g => { ring(g, 0, 0, 0.6); line(g, -0.1, -0.6, 0.12, -0.15, -0.15, 0.15, 0.08, 0.6); },
  flood: g => { wave(g, 0.15); wave(g, 0.5); arrow(g, 0, -0.1, 0, -0.65); },
  hyper: g => { ring(g, 0, 0, 0.6); line(g, -0.25, -0.25, 0.05, 0, -0.25, 0.25); line(g, 0.05, -0.25, 0.35, 0, 0.05, 0.25); },
  spare: g => { g.beginPath(); g.moveTo(0, 0.6); g.bezierCurveTo(-0.85, 0, -0.45, -0.75, 0, -0.3); g.bezierCurveTo(0.45, -0.75, 0.85, 0, 0, 0.6); g.fill(); },
  charm: g => { for (const [x, y] of [[0, -0.3], [0.3, 0], [0, 0.3], [-0.3, 0]]) dot(g, x, y, 0.24); line(g, 0, 0.3, 0.2, 0.7); },
  torch: g => { shape(g, -0.15, 0.7, 0.15, 0.7, 0.22, -0.05, -0.22, -0.05); g.beginPath(); g.moveTo(0, -0.75); g.quadraticCurveTo(0.42, -0.35, 0.2, -0.12); g.lineTo(-0.2, -0.12); g.quadraticCurveTo(-0.42, -0.35, 0, -0.75); g.fill(); },
  grip: g => { shape(g, -0.45, -0.6, -0.05, -0.6, -0.05, 0.05, 0.55, 0.15, 0.55, 0.4, -0.45, 0.4); for (const x of [-0.35, 0, 0.35]) shape(g, x - 0.1, 0.45, x + 0.1, 0.45, x, 0.68); },
  flywheel: g => { ring(g, 0, 0, 0.55, 0, Math.PI * 1.5); ring(g, 0, 0, 0.25, Math.PI, TAU + Math.PI / 2); arrow(g, 0.05, -0.55, 0.06, -0.55); },
};

export function drawMutatorIcon(ctx, mutator, x, y, size = 18) {
  const image = sprite(`mutator:${mutator.id}`, ICON_SIZE, g => {
    const r = ICON_SIZE / 2 - 1;
    g.fillStyle = EFFECT_COLORS[mutator.effect];
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.scale(r * 0.62, r * 0.62);
    g.strokeStyle = g.fillStyle = GLYPH;
    g.lineWidth = 0.2;
    g.lineCap = g.lineJoin = 'round';
    GLYPHS[mutator.id](g);
  });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / ICON_SIZE, size / ICON_SIZE);
  stamp(ctx, image, 0, 0);
  ctx.restore();
}
