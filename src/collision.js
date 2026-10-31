import { TILE, SOLID, ONE_WAY, tileAt, overlaps } from './level.js?v=3f651af';

function tileSpan(x, y, w, h) {
  return { c0: Math.floor(x / TILE), c1: Math.floor((x + w - 0.001) / TILE), r0: Math.floor(y / TILE), r1: Math.floor((y + h - 0.001) / TILE) };
}

const VERTICAL_CONTACT = 8;

const rock = (level, c, r) => tileAt(level, c, r - 1) === SOLID || tileAt(level, c, r + 1) === SOLID;

function verticalContact(n, w, h, rect) {
  const depthY = Math.min(n.y + h - rect.y, rect.y + rect.h - n.y);
  const depthX = Math.min(n.x + w - rect.x, rect.x + rect.w - n.x);
  return depthY <= VERTICAL_CONTACT && depthY < depthX;
}

export function blockedBy(level, x, y, w, h, rects) {
  const { c0, c1, r0, r1 } = tileSpan(x, y, w, h);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) return true;
  return rects.some(rect => overlaps(x, y, w, h, rect));
}

export function resolveX(level, n, w, h, moveX, rects, ghost = false) {
  let hit = 0;
  const push = (rx, rw) => {
    const leftPen = n.x + w - rx;
    const rightPen = rx + rw - n.x;
    if (moveX > 0 || (moveX === 0 && leftPen < rightPen)) { n.x = rx - w; hit = 1; } else { n.x = rx + rw; hit = -1; }
  };
  const { c0, c1, r0, r1 } = tileSpan(n.x, n.y, w, h);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID && (!ghost || rock(level, c, r))) push(c * TILE, TILE);
  for (const rect of rects) if (overlaps(n.x, n.y, w, h, rect) && !verticalContact(n, w, h, rect)) push(rect.x, rect.w);
  return hit;
}

export function resolveY(level, n, w, h, moveY, prevY, rects, g, ghost = false) {
  let hit = null;
  const fromAbove = (ry, rh) => moveY > 0 || (moveY === 0 && n.y + h - ry < ry + rh - n.y);
  const land = (ry, rh, id, above) => {
    if (above) { n.y = ry - h; hit = { dir: 1, id }; } else { n.y = ry + rh; hit = { dir: -1, id }; }
  };
  const passesOneWay = (ry, rh) => {
    if (moveY * g <= 0) return true;
    return g > 0 ? prevY + h > ry + 0.01 : prevY < ry + rh - 0.01;
  };
  const { c0, c1, r0, r1 } = tileSpan(n.x, n.y, w, h);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = tileAt(level, c, r);
      const exposed = tile === SOLID && tileAt(level, c, r - g) !== SOLID;
      const oneWay = tile === ONE_WAY || (ghost && exposed);
      if ((tile === SOLID && !ghost) || (oneWay && !passesOneWay(r * TILE, TILE))) land(r * TILE, TILE, -1, fromAbove(r * TILE, TILE));
    }
  }
  for (const rect of rects) {
    if (!overlaps(n.x, n.y, w, h, rect) || (ghost && passesOneWay(rect.y, rect.h))) continue;
    land(rect.y, rect.h, rect.id, prevY + h / 2 < rect.y + rect.h / 2);
  }
  return hit;
}
