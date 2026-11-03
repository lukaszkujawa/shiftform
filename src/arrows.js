import { TILE, levelIndex, objectRect, overlaps, playerSize, slain, erased } from './level.js';
import { blockedBy } from './collision.js';
import { lurkerOf, dangersOf, slayLurker } from './lurkers.js';

const ARROW_SPEED = 9;
const ARROW_RANGE = 14 * TILE;
const ARROW_LONG = 14, ARROW_THIN = 3;

export function flyArrows(level, n, solids) {
  if (!n.flying.length) return;
  const monsters = levelIndex(level).monsters;
  n.flying = n.flying.flatMap(arrow => {
    const x = arrow.x + arrow.vx, y = arrow.y + arrow.vy, left = arrow.left - ARROW_SPEED, { w, h } = arrow;
    if (left <= 0 || blockedBy(level, x, y, w, h, solids)) return [];
    const hit = monsters.find(m => !slain(n, m) && !erased(n, m) && overlaps(x, y, w, h, objectRect(m, n.clock)));
    if (hit) { n.slain |= 1 << hit.slot; return []; }
    const lurker = levelIndex(level).lurkers.find(o => !erased(n, o) && dangersOf(o, lurkerOf(o, n)).some(zone => overlaps(x, y, w, h, zone)));
    if (lurker) { slayLurker(n, lurker); return []; }
    return [{ ...arrow, x, y, left }];
  });
}

function loose(s, pw, ph, [ahead, up]) {
  const dx = ahead * (s.facing || 1), dy = -up * s.gravDir, reach = Math.hypot(dx, dy), ux = dx / reach, uy = dy / reach;
  const w = Math.abs(ux) * ARROW_LONG + Math.abs(uy) * ARROW_THIN, h = Math.abs(uy) * ARROW_LONG + Math.abs(ux) * ARROW_THIN;
  const cx = s.x + pw / 2 + dx * (pw / 2 + ARROW_LONG / 2), cy = s.y + ph * 0.4 + ARROW_THIN / 2 + dy * (ph * 0.4 + ARROW_LONG / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h, vx: ux * ARROW_SPEED, vy: uy * ARROW_SPEED, left: ARROW_RANGE };
}

export function shoot(level, s) {
  if (s.arrows <= 0 || s.dead || s.won) return null;
  const { w, h } = playerSize(level.rules);
  return { ...s, arrows: s.arrows - 1, flying: [...s.flying, ...level.rules.volley.map(aim => loose(s, w, h, aim))] };
}
