import { WIDTH, HEIGHT } from '../world/level.js?v=c6cd642';

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

export function fitText(ctx, text, x, y, maxWidth, weight, size) {
  ctx.font = font(weight, size);
  const width = ctx.measureText(text).width;
  if (width > maxWidth) ctx.font = font(weight, Math.max(7, (size * maxWidth) / width));
  ctx.fillText(text, x, y);
}

export function wrapText(ctx, text, width) {
  return text.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1], joined = last ? `${last} ${word}` : word;
    if (ctx.measureText(joined).width <= width) lines[lines.length - 1] = joined;
    else lines.push(word);
    return lines;
  }, ['']);
}

const SHADE = 'hsl(240 35% 8% / 0.24)';
const SHINE = 'hsl(0 0% 100% / 0.3)';
const CAST = 'hsl(240 35% 8% / 0.22)';

export function contactShadow(ctx, x, y, w, h, r) {
  ctx.fillStyle = CAST;
  roundRect(ctx, x + 1, y + 3, w, h, r);
  ctx.fill();
}

export function slab(ctx, x, y, w, h, r, fill, line, width = 1.4) {
  const band = Math.min(h * 0.3, 6);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = SHADE;
  ctx.beginPath();
  ctx.roundRect(x, y + h - band, w, band, [0, 0, r, r]);
  ctx.fill();
  ctx.fillStyle = SHINE;
  ctx.fillRect(x + r, y + 1.5, Math.max(0, w - 2 * r), Math.min(1.5, h * 0.15));
  if (!line) return;
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = line;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function glint(ctx, x, y, r) {
  ctx.fillStyle = 'hsl(0 0% 100% / 0.75)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function shadedBody(ctx, trace, { fill, shade, line }, width = 1.4) {
  ctx.beginPath();
  trace();
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.clip();
  ctx.translate(-2, -3);
  ctx.beginPath();
  trace();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  trace();
  ctx.strokeStyle = line;
  ctx.lineWidth = width;
  ctx.stroke();
}
