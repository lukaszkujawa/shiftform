import { HEIGHT, WIDTH } from '../world/level.js?v=0a1f4db';
import { lightBackdrop, seededNoise } from './backdrop-kit.js?v=0a1f4db';
import { FLAT_BACKGROUNDS } from './backdrops-flat.js?v=0a1f4db';
import { HORIZON_BACKGROUNDS } from './backdrops-horizon.js?v=0a1f4db';

const BACKGROUNDS = { ...FLAT_BACKGROUNDS, ...HORIZON_BACKGROUNDS };

export const hasHorizon = background => background in HORIZON_BACKGROUNDS;

export function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  BACKGROUNDS[theme.background](ctx, p, seededNoise(level.palette * 7919 + 13));
  lightBackdrop(ctx);
  return canvas;
}
