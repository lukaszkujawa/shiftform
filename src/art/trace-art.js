import { WIDTH } from '../world/level.js';
import { alpha } from './themes.js';
import { TAU, font, strokeDashed } from './paint.js';

const PATH = { color: 'hsl(90 100% 62% / 0.9)', death: 'hsl(0 95% 60%)', dot: 1.1, gap: 40, cross: 7 };
const ECHO = { gap: 60, cross: 6, ring: 14, under: 'hsl(240 30% 8% / 0.7)' };

function drawDeath(ctx, q) {
  ctx.strokeStyle = PATH.death;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(q.x - PATH.cross, q.y - PATH.cross); ctx.lineTo(q.x + PATH.cross, q.y + PATH.cross);
  ctx.moveTo(q.x + PATH.cross, q.y - PATH.cross); ctx.lineTo(q.x - PATH.cross, q.y + PATH.cross);
  ctx.stroke();
  ctx.fillStyle = PATH.death;
  ctx.font = font(800, 11);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`died: ${q.death} @${q.frame}`, q.x, q.y - PATH.cross - 3);
}

function tracePolyline(ctx, points, gap) {
  ctx.beginPath();
  points.forEach((q, i) => {
    const previous = points[i - 1];
    if (previous && Math.hypot(q.x - previous.x, q.y - previous.y) < gap) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  });
  ctx.stroke();
}

export function drawPath(ctx, points) {
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = PATH.color;
  ctx.lineWidth = 1.5;
  tracePolyline(ctx, points, PATH.gap);
  for (const q of points) { ctx.beginPath(); ctx.arc(q.x, q.y, PATH.dot, 0, TAU); ctx.fill(); }
  for (const q of points) if (q.death) drawDeath(ctx, q);
  ctx.restore();
}

export function drawEcho(ctx, p, echo) {
  const end = echo.points[echo.points.length - 1];
  if (!end) return;
  const life = echo.age / echo.ms, fade = Math.max(0, 1 - life);
  ctx.save();
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = ECHO.under;
  ctx.lineWidth = 4.5;
  tracePolyline(ctx, echo.points, ECHO.gap);
  ctx.strokeStyle = p.player;
  ctx.lineWidth = 2.5;
  tracePolyline(ctx, echo.points, ECHO.gap);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(end.x - ECHO.cross, end.y - ECHO.cross); ctx.lineTo(end.x + ECHO.cross, end.y + ECHO.cross);
  ctx.moveTo(end.x + ECHO.cross, end.y - ECHO.cross); ctx.lineTo(end.x - ECHO.cross, end.y + ECHO.cross);
  ctx.stroke();
  ctx.globalAlpha = fade * Math.max(0, 1 - life * 3);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(end.x, end.y, ECHO.cross + life * 3 * ECHO.ring, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawGuideLine(ctx, color, y, label, below = false) {
  ctx.save();
  ctx.strokeStyle = alpha(color, 0.55);
  ctx.lineWidth = 1.5;
  strokeDashed(ctx, [10, 8], () => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); });
  ctx.font = font(700, 11);
  ctx.textAlign = 'right';
  ctx.textBaseline = below ? 'top' : 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  const ly = below ? y + 3 : y - 3;
  ctx.strokeText(label, WIDTH - 12, ly);
  ctx.fillStyle = color;
  ctx.fillText(label, WIDTH - 12, ly);
  ctx.restore();
}
