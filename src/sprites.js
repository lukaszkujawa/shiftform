const SCALE = 3;
const CACHE_LIMIT = 240;
const cache = new Map();
const liveEffects = () => !globalThis.document?.body.classList.contains('touch-device');

export const lit = (theme, blur) => (theme.glow && liveEffects() ? blur : 0);

export function glow(ctx, theme, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = lit(theme, blur);
}

export function sprite(key, size, paint) {
  let image = cache.get(key);
  if (!image) {
    image = new OffscreenCanvas(size * SCALE, size * SCALE);
    const g = image.getContext('2d');
    g.scale(SCALE, SCALE);
    g.translate(size / 2, size / 2);
    paint(g);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, image);
  }
  return image;
}

export function stamp(ctx, image, cx, cy, squeeze = 1) {
  const w = (image.width / SCALE) * squeeze, h = image.height / SCALE;
  ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
}
