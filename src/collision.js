import { TILE, SOLID, ONE_WAY, tileAt, overlaps } from './level.js';

function tileSpan(x, y, w, h) {
  return { c0: Math.floor(x / TILE), c1: Math.floor((x + w - 0.001) / TILE), r0: Math.floor(y / TILE), r1: Math.floor((y + h - 0.001) / TILE) };
}

export function blockedBy(level, x, y, w, h, rects) {
  const { c0, c1, r0, r1 } = tileSpan(x, y, w, h);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) return true;
  return rects.some(rect => overlaps(x, y, w, h, rect));
}

export function resolveX(level, n, w, h, moveX, rects) {
  let hit = 0;
  const push = (rx, rw) => {
    const leftPen = n.x + w - rx;
    const rightPen = rx + rw - n.x;
    if (moveX > 0 || (moveX === 0 && leftPen < rightPen)) { n.x = rx - w; hit = 1; } else { n.x = rx + rw; hit = -1; }
  };
  const { c0, c1, r0, r1 } = tileSpan(n.x, n.y, w, h);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) push(c * TILE, TILE);
  for (const rect of rects) if (overlaps(n.x, n.y, w, h, rect)) push(rect.x, rect.w);
  return hit;
}

export function resolveY(level, n, w, h, moveY, prevY, rects, g) {
  let hit = null;
  const land = (ry, rh, id) => {
    const topPen = n.y + h - ry;
    const bottomPen = ry + rh - n.y;
    if (moveY > 0 || (moveY === 0 && topPen < bottomPen)) { n.y = ry - h; hit = { dir: 1, id }; } else { n.y = ry + rh; hit = { dir: -1, id }; }
  };
  const passesOneWay = (ry, rh) => {
    if (moveY * g <= 0) return true;
    return g > 0 ? prevY + h > ry + 0.01 : prevY < ry + rh - 0.01;
  };
  const { c0, c1, r0, r1 } = tileSpan(n.x, n.y, w, h);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = tileAt(level, c, r);
      if (tile === SOLID || (tile === ONE_WAY && !passesOneWay(r * TILE, TILE))) land(r * TILE, TILE, -1);
    }
  }
  for (const rect of rects) if (overlaps(n.x, n.y, w, h, rect)) land(rect.y, rect.h, rect.id);
  return hit;
}
