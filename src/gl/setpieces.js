import { THREE } from './toon.js?v=1c29e2a';
import { buildHome } from './set-home.js?v=1c29e2a';
import { buildSignposts, buildClimbSign } from './set-signs.js?v=1c29e2a';
import { buildMouths } from './set-mouths.js?v=1c29e2a';
import { buildHall } from './set-hall.js?v=1c29e2a';

const BUILDERS = [buildHome, buildSignposts, buildClimbSign, buildMouths, buildHall];

export function build(level, palette, theme) {
  const group = new THREE.Group(), pieces = BUILDERS.map(make => make(level, palette, theme));
  for (const piece of pieces) group.add(piece.group);
  return { group, update: (...args) => { for (const piece of pieces) piece.update(...args); } };
}
