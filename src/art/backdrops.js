import { HEIGHT, WIDTH } from '../world/level.js?v=1c29e2a';
import { lightBackdrop, seededNoise } from './backdrop-kit.js?v=1c29e2a';
import { FLAT_BACKGROUNDS } from './backdrops-flat.js?v=1c29e2a';
import { HORIZON_BACKGROUNDS } from './backdrops-horizon.js?v=1c29e2a';

const BACKGROUNDS = { ...FLAT_BACKGROUNDS, ...HORIZON_BACKGROUNDS };

export const hasHorizon = background => background in HORIZON_BACKGROUNDS;

export function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  BACKGROUNDS[theme.background](ctx, p, seededNoise(level.palette * 7919 + 13));
  lightBackdrop(ctx);
  return canvas;
}
