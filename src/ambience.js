import { WIDTH, HEIGHT } from './level.js';
import { GLYPHS } from './backdrops-flat.js';
import { TAU } from './paint.js';

const ALTITUDE_STOPS = [
  { at: 0, top: [35, 70, 75, 0.18], bottom: [30, 60, 70, 0.28], stars: 0 },
  { at: 300, top: [205, 70, 62, 0.22], bottom: [195, 60, 70, 0.18], stars: 0 },
  { at: 900, top: [275, 45, 40, 0.3], bottom: [20, 70, 55, 0.25], stars: 0.2 },
  { at: 1800, top: [235, 55, 8, 0.55], bottom: [250, 45, 18, 0.35], stars: 1 },
];

function mixStop(a, b, t) {
  const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
  const hsla = ([h, s, l, a]) => `hsl(${h} ${s}% ${l}% / ${a})`;
  return { top: hsla(mix(a.top, b.top)), bottom: hsla(mix(a.bottom, b.bottom)), stars: a.stars + (b.stars - a.stars) * t };
}

export function altitudeTint(metres) {
  const i = ALTITUDE_STOPS.findIndex(stop => stop.at > metres);
  if (i === -1) return mixStop(ALTITUDE_STOPS.at(-1), ALTITUDE_STOPS.at(-1), 0);
  if (i === 0) return mixStop(ALTITUDE_STOPS[0], ALTITUDE_STOPS[0], 0);
  const a = ALTITUDE_STOPS[i - 1], b = ALTITUDE_STOPS[i];
  return mixStop(a, b, (metres - a.at) / (b.at - a.at));
}

export function spawnAmbient(kind, rand) {
  switch (kind) {
    case 'snow': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.6 + rand() * 0.8, size: 2 + rand() * 2, alpha: 0.7, sway: rand() * TAU };
    case 'embers': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.6 - rand() * 0.9, size: 2 + rand() * 2, alpha: 0.8, sway: rand() * TAU };
    case 'motes': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0.1 + rand() * 0.2, vy: -0.05, size: 1.5 + rand() * 1.5, alpha: 0.35, sway: rand() * TAU };
    case 'sparks': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0, vy: 0, size: 1 + rand() * 2, alpha: 0.9, sway: rand() * TAU, twinkle: true };
    case 'stars': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: -0.15, vy: 0, size: 1 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'spores': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.2 - rand() * 0.3, size: 1.5 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'dust': return { x: -10, y: rand() * HEIGHT, vx: 0.8 + rand() * 0.9, vy: 0.05, size: 1 + rand() * 1.5, alpha: 0.45, sway: rand() * TAU };
    case 'bubbles': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.4 - rand() * 0.7, size: 1.5 + rand() * 2.5, alpha: 0.5, sway: rand() * TAU };
    case 'rain': return { x: rand() * (WIDTH + 200), y: -10, vx: -1.5, vy: 9 + rand() * 4, size: 1, alpha: 0.35, sway: 0, wobble: 0, shape: 'streak', trail: 2 };
    case 'sprinkles': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.8 + rand() * 0.6, size: 2, alpha: 0.8, sway: rand() * TAU, shape: 'streak', trail: 5 };
    case 'code': return { x: Math.floor(rand() * WIDTH / 16) * 16 + 4, y: -10, vx: 0, vy: 1.5 + rand() * 2.5, size: 14, alpha: 0.6, sway: 0, wobble: 0, shape: 'glyph', glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)] };
    case 'fog': return { x: -10, y: rand() * HEIGHT, vx: 0.25 + rand() * 0.3, vy: 0, size: 30 + rand() * 40, alpha: 0.07, sway: rand() * TAU };
    case 'petals': return { x: rand() * WIDTH, y: -10, vx: 0.3 + rand() * 0.4, vy: 0.4 + rand() * 0.5, size: 2.5 + rand(), alpha: 0.85, sway: rand() * TAU };
    case 'lanterns': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0.1 + rand() * 0.2, vy: -0.25 - rand() * 0.35, size: 2.5 + rand() * 2, alpha: 0.85, sway: rand() * TAU, twinkle: true };
    case 'leaves': return { x: rand() * WIDTH, y: -10, vx: 0.4 + rand() * 0.5, vy: 0.5 + rand() * 0.6, size: 3 + rand() * 2, alpha: 0.8, sway: rand() * TAU, wobble: 0.8, shape: 'streak', trail: 3 };
    default: return null;
  }
}
