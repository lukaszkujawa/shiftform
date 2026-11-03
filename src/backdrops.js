import { HEIGHT, WIDTH } from './level.js';
import { lightBackdrop, seededNoise } from './backdrop-kit.js';
import { FLAT_BACKGROUNDS } from './backdrops-flat.js';
import { HORIZON_BACKGROUNDS } from './backdrops-horizon.js';

const BACKGROUNDS = { ...FLAT_BACKGROUNDS, ...HORIZON_BACKGROUNDS };

export const hasHorizon = background => background in HORIZON_BACKGROUNDS;

export function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  BACKGROUNDS[theme.background](ctx, p, seededNoise(level.palette * 7919 + 13));
  lightBackdrop(ctx);
  return canvas;
}
