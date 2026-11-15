import { THREE } from './toon.js?v=3328ffe';
import { buildHome } from './set-home.js?v=3328ffe';
import { buildSignposts, buildClimbSign } from './set-signs.js?v=3328ffe';
import { buildMouths } from './set-mouths.js?v=3328ffe';
import { buildHall } from './set-hall.js?v=3328ffe';

const BUILDERS = [buildHome, buildSignposts, buildClimbSign, buildMouths, buildHall];

export function build(level, palette, theme) {
  const group = new THREE.Group(), pieces = BUILDERS.map(make => make(level, palette, theme));
  for (const piece of pieces) group.add(piece.group);
  return { group, update: (...args) => { for (const piece of pieces) piece.update(...args); } };
}
