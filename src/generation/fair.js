import { TILE, SOLID, tileAt, overlaps, objectRect, isSolidObject, levelIndex, playerSize } from '../world/level.js?v=ececfed';
import { carryFrom } from '../world/bodies.js?v=ececfed';

const TRAVEL_SLACK_X = 10;
const TRAVEL_SLACK_Y = 12;
const SKIN = 1;

const insideTile = (level, s, w, h) => {
  for (let r = Math.floor((s.y + SKIN) / TILE); r <= Math.floor((s.y + h - SKIN) / TILE); r++) {
    for (let c = Math.floor((s.x + SKIN) / TILE); c <= Math.floor((s.x + w - SKIN) / TILE); c++) if (tileAt(level, c, r) === SOLID) return true;
  }
  return false;
};

const insideSolid = (level, s, w, h) => levelIndex(level).dynamic.some(o => isSolidObject(o, s, s.clock) && overlaps(s.x + SKIN, s.y + SKIN, w - 2 * SKIN, h - 2 * SKIN, objectRect(o, s.clock)));

function travelledTooFar(level, a, b) {
  if (a.rope >= 0 || b.rope >= 0 || a.barrel >= 0 || b.barrel >= 0 || a.climbing || b.climbing || b.inPortal || a.inPortal) return false;
  const carried = carryFrom(level, a.groundId, a.bodies, b.bodies, a.clock, b.clock);
  return Math.abs(b.x - a.x) > Math.max(Math.abs(a.vx), Math.abs(b.vx)) + Math.abs(carried.dx) + TRAVEL_SLACK_X
    || Math.abs(b.y - a.y) > Math.max(Math.abs(a.vy), Math.abs(b.vy)) + Math.abs(carried.dy) + TRAVEL_SLACK_Y;
}

export function fairMove(level, a, b) {
  const { w, h } = playerSize(level.rules);
  return !travelledTooFar(level, a, b) && !insideTile(level, b, w, h) && !insideSolid(level, b, w, h);
}
