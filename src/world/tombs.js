import { TILE, WIDTH, SOLID, ONE_WAY, tileAt, overlaps } from './level.js?v=dd78f3b';
import { playerSize } from './physics.js?v=dd78f3b';
import { Rng, mix } from './rng.js?v=dd78f3b';

export const TOMB = { w: 26, h: 18 };
const SPRING_REACH = 8;
const FLING = { gravity: 0.45, speed: [11, 16], spread: [0.11, 0.89], frames: 900 };

function caught(level, placed, x, y) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + TOMB.w - 0.001) / TILE), r0 = Math.floor(y / TILE), r1 = Math.floor((y + TOMB.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID || tileAt(level, c, r) === ONE_WAY) return true;
  return placed.some(rect => rect.kind !== 'ladder' && overlaps(x, y, TOMB.w, TOMB.h, rect));
}

function atTrampoline(level, state) {
  const { w, h } = playerSize(level.rules);
  const near = o => overlaps(state.x - SPRING_REACH, state.y - SPRING_REACH, w + 2 * SPRING_REACH, h + 2 * SPRING_REACH, o);
  return level.objects.some(o => o.type === 'spring' && near(o)) || state.placed.some(rect => rect.kind === 'trampoline' && near(rect));
}

const solidUnder = (level, x, y) => {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + TOMB.w - 0.001) / TILE), r0 = Math.floor(y / TILE), r1 = Math.floor((y + TOMB.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) return true;
  return false;
};

function fling(level, state, x0, y0) {
  const rng = new Rng(mix(state.frame * 2 + 1, Math.round(state.x) * 4099 + Math.round(state.y)));
  const angle = Math.PI * rng.float(...FLING.spread), speed = rng.float(...FLING.speed);
  let x = x0, y = y0, vx = Math.cos(angle) * speed, vy = -Math.sin(angle) * speed;
  const path = [];
  for (let k = 0; k < FLING.frames; k++) {
    vy += FLING.gravity;
    const nx = x + vx;
    if (nx < 0 || nx > WIDTH - TOMB.w || solidUnder(level, nx, y)) vx = -vx;
    else x = nx;
    const ny = y + vy;
    if (vy < 0 && solidUnder(level, x, ny)) vy = 0;
    else if (vy > 0 && caught(level, state.placed, x, ny)) return settled(level, state, Math.round(x), Math.round(y), path);
    else y = ny;
    if (y + TOMB.h >= level.height) return null;
    path.push([Math.round(x), Math.round(y)]);
  }
  return null;
}

function settled(level, state, x, y0, path) {
  let y = y0;
  while (caught(level, state.placed, x, y)) if (--y < 0) return null;
  while (!caught(level, state.placed, x, y + 1)) if (++y + TOMB.h >= level.height) return null;
  if (level.objects.some(o => o.type === 'laser' && overlaps(x, y, TOMB.w, TOMB.h, o))) return null;
  return { kind: 'tomb', oneWay: true, x, y, w: TOMB.w, h: TOMB.h, id: -1, from: Math.round(state.y), born: state.frame, ...(path ? { path } : {}) };
}

export function tombOf(level, state) {
  const { w } = playerSize(level.rules);
  const x = Math.max(0, Math.min(WIDTH - TOMB.w, Math.round(state.x + w / 2 - TOMB.w / 2)));
  if (atTrampoline(level, state)) return fling(level, state, x, Math.round(state.y));
  return settled(level, state, x, Math.round(state.y));
}
