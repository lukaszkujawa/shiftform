import { THREE } from './toon.js';
import { buildHome } from './set-home.js';
import { buildSignposts, buildClimbSign } from './set-signs.js';
import { buildMouths } from './set-mouths.js';
import { buildHall } from './set-hall.js';

const BUILDERS = [buildHome, buildSignposts, buildClimbSign, buildMouths, buildHall];

export function build(level, palette, theme) {
  const group = new THREE.Group(), pieces = BUILDERS.map(make => make(level, palette, theme));
  for (const piece of pieces) group.add(piece.group);
  return { group, update: (...args) => { for (const piece of pieces) piece.update(...args); } };
}
