import { HEIGHT, WIDTH } from '../world/level.js?v=c6cd642';
import { TAU, veil } from './paint.js?v=c6cd642';

export function seededNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const RIDGE = { rim: 'hsl(0 0% 100% / 0.2)', rimWidth: 3, hazeFrom: HEIGHT * 0.45, haze: 'hsl(0 0% 100% / 0.1)', clear: 'hsl(0 0% 100% / 0)' };

export function fillBelow(ctx, style, trace) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  trace();
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  const haze = ctx.createLinearGradient(0, RIDGE.hazeFrom, 0, HEIGHT);
  haze.addColorStop(0, RIDGE.clear);
  haze.addColorStop(1, RIDGE.haze);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = RIDGE.rim;
  ctx.lineWidth = RIDGE.rimWidth;
  ctx.stroke();
  ctx.restore();
}

export function lightBackdrop(ctx) {
  const light = ctx.createLinearGradient(0, 0, WIDTH, 0);
  light.addColorStop(0, 'hsl(0 0% 100% / 0.07)');
  light.addColorStop(0.4, 'hsl(0 0% 100% / 0)');
  light.addColorStop(0.72, 'hsl(240 35% 8% / 0)');
  light.addColorStop(1, 'hsl(240 35% 8% / 0.13)');
  veil(ctx, light);
}


export const silhouette = (ctx, x, y, scale, draw) => { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); draw(ctx); ctx.restore(); };
export const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
