import { alpha } from './themes.js?v=56b76b7';
import { TAU, font, roundRect } from './paint.js?v=56b76b7';

export const ITEM_COLORS = { jetpack: 'hsl(25 90% 60% / 1)', boots: 'hsl(190 80% 60% / 1)', shield: 'hsl(210 85% 72% / 1)', heart: 'hsl(350 85% 62% / 1)', comet: 'hsl(40 100% 62% / 1)', bow: 'hsl(95 60% 58% / 1)' };
export const COIN_COLOR = 'hsl(48 95% 60% / 1)';
export const RUNE_COLOR = 'hsl(275 85% 72% / 1)';

export function drawRune(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.75, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.75, y);
  ctx.closePath();
  ctx.fillStyle = RUNE_COLOR;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x - r * 0.3, y);
  ctx.closePath();
  ctx.fillStyle = 'hsl(275 100% 92% / 0.8)';
  ctx.fill();
}
export const BRIGHT_TEXT = 'hsl(0 0% 97%)';

const ITEM_ICONS = {
  jetpack(ctx) {
    ctx.roundRect(-8, -9, 7, 15, 3);
    ctx.roundRect(1, -9, 7, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(45 100% 60%)';
    ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-4.5, 11); ctx.lineTo(-3, 7); ctx.moveTo(3, 7); ctx.lineTo(4.5, 11); ctx.lineTo(6, 7); ctx.fill();
  },
  boots(ctx) {
    ctx.moveTo(-6, -9); ctx.lineTo(1, -9); ctx.lineTo(1, 1); ctx.lineTo(8, 1); ctx.lineTo(8, 6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(-5, 8 + i * 2); ctx.lineTo(7, 8 + i * 2); }
    ctx.stroke();
  },
  shield(ctx) {
    ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.lineTo(7, 3); ctx.lineTo(0, 10); ctx.lineTo(-7, 3); ctx.lineTo(-8, -6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  bow(ctx) {
    ctx.strokeStyle = ITEM_COLORS.bow;
    ctx.lineWidth = 2.5;
    ctx.arc(-4, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = 'hsl(0 0% 100% / 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(-4, 10); ctx.moveTo(-7, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = 'hsl(0 0% 100% / 0.85)';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
  },
  comet(ctx) {
    ctx.moveTo(-10, 9); ctx.quadraticCurveTo(-4, 0, 1, -3); ctx.lineTo(4, 3); ctx.quadraticCurveTo(-1, 6, -10, 9);
    ctx.fill();
    ctx.beginPath(); ctx.arc(3, -2, 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  },
  heart(ctx) {
    ctx.moveTo(0, 9); ctx.bezierCurveTo(-12, 0, -8, -11, 0, -4); ctx.bezierCurveTo(8, -11, 12, 0, 0, 9);
    ctx.fill();
    ctx.stroke();
  },
};

export function drawItemIcon(ctx, kind, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = ITEM_COLORS[kind];
  ctx.strokeStyle = 'hsl(0 0% 100% / 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ITEM_ICONS[kind](ctx);
  ctx.restore();
}

const TRICK_ICONS = {
  plank(ctx, p) {
    roundRect(ctx, -24, -6, 48, 12, 4);
    ctx.fillStyle = p.accentSoft; ctx.fill();
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = p.accent; ctx.fillRect(-21, -6, 42, 3);
  },
  trampoline(ctx, p) {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-18, -6 + i * 5); ctx.lineTo(18, -6 + i * 5); } ctx.stroke();
    ctx.fillStyle = p.accent; ctx.fillRect(-22, -12, 44, 4);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-6, -24); ctx.lineTo(6, -24); ctx.closePath(); ctx.fill();
  },
  ladder(ctx, p) {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(-9, 24); ctx.moveTo(9, -24); ctx.lineTo(9, 24); for (let y = -18; y <= 18; y += 9) { ctx.moveTo(-9, y); ctx.lineTo(9, y); } ctx.stroke();
  },
  flag(ctx, p) {
    ctx.strokeStyle = BRIGHT_TEXT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-8, 24); ctx.stroke();
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(16, -14); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
  },
  extraHeart(ctx, p) {
    ctx.fillStyle = p.hazard; ctx.font = font(800, 34); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♥', 0, 2);
    ctx.fillStyle = BRIGHT_TEXT; ctx.font = font(800, 18); ctx.fillText('+1', 18, -12);
  },
  double(ctx) {
    ctx.fillStyle = COIN_COLOR; ctx.beginPath(); ctx.arc(-8, 2, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = BRIGHT_TEXT; ctx.font = font(900, 22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('×2', 12, -6);
  },
  erase(ctx, p) {
    ctx.strokeStyle = p.hazard; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
    ctx.strokeStyle = alpha(p.text, 0.6); ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
  },
};

export function drawTrickIcon(ctx, p, kind, cx, cy, scale = 1.6) {
  if (ITEM_COLORS[kind]) { drawItemIcon(ctx, kind, cx, cy, scale); return; }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale / 1.6, scale / 1.6);
  ctx.lineCap = 'round';
  TRICK_ICONS[kind](ctx, p);
  ctx.restore();
}

const DIE_FACES = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];

export function drawDie(ctx, x, y, size, face) {
  roundRect(ctx, x - size / 2, y - size / 2, size, size, size * 0.22);
  ctx.fillStyle = 'hsl(0 0% 96% / 1)';
  ctx.fill();
  ctx.fillStyle = 'hsl(350 70% 40% / 1)';
  const pip = size * 0.26;
  for (const [dx, dy] of DIE_FACES[face]) { ctx.beginPath(); ctx.arc(x + dx * pip, y + dy * pip, size * 0.09, 0, TAU); ctx.fill(); }
}
