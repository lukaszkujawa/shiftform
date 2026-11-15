import { toon, mesh } from './toon.js?v=0a1f4db';

export const still = node => ({ node, update: null });
export const centre = (rect, z = 0) => [rect.x + rect.w / 2, -(rect.y + rect.h / 2), z];
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];

export function at(node, x, y, z = 0) {
  node.position.set(x, y, z);
  return node;
}

export function sized(node, sx, sy = sx, sz = sx) {
  node.scale.set(sx, sy, sz);
  return node;
}

export function part(geometry, css, scale, place = [0, 0, 0], outline = 0) {
  const piece = mesh(geometry, toon(css), outline);
  piece.scale.set(...scale);
  piece.position.set(...place);
  return piece;
}
