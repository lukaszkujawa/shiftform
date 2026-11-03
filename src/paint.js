import { WIDTH, HEIGHT } from './level.js?v=025552d';

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
