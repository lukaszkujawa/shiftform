import { WIDTH, HEIGHT } from './level.js?v=a3cd24e';

export const TAU = Math.PI * 2;

export const font = (weight, size) => `${weight} ${size}px system-ui, sans-serif`;

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function veil(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

export function strokeDashed(ctx, dash, trace) {
  ctx.setLineDash(dash);
  trace();
  ctx.stroke();
  ctx.setLineDash([]);
}
