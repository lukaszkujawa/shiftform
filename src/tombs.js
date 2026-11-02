import { TILE, WIDTH, SOLID, ONE_WAY, tileAt, overlaps } from './level.js?v=ee21d18';
import { playerSize } from './physics.js?v=ee21d18';

export const TOMB = { w: 26, h: 18 };

function caught(level, placed, x, y) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + TOMB.w - 0.001) / TILE), r0 = Math.floor(y / TILE), r1 = Math.floor((y + TOMB.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID || tileAt(level, c, r) === ONE_WAY) return true;
  return placed.some(rect => rect.kind !== 'ladder' && overlaps(x, y, TOMB.w, TOMB.h, rect));
}

export function tombOf(level, state) {
  const { w } = playerSize(level.rules);
  const x = Math.max(0, Math.min(WIDTH - TOMB.w, Math.round(state.x + w / 2 - TOMB.w / 2)));
  let y = Math.round(state.y);
  while (caught(level, state.placed, x, y)) if (--y < 0) return null;
  while (!caught(level, state.placed, x, y + 1)) {
    if (++y + TOMB.h >= level.height) return null;
  }
  if (level.objects.some(o => o.type === 'laser' && overlaps(x, y, TOMB.w, TOMB.h, o))) return null;
  return { kind: 'tomb', oneWay: true, x, y, w: TOMB.w, h: TOMB.h, id: -1, from: Math.round(state.y), born: state.frame };
}
