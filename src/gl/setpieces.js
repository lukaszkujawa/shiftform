import { THREE } from './toon.js?v=c6062ce';
import { buildHome } from './set-home.js?v=c6062ce';
import { buildSignposts, buildClimbSign } from './set-signs.js?v=c6062ce';
import { buildMouths } from './set-mouths.js?v=c6062ce';
import { buildHall } from './set-hall.js?v=c6062ce';

const BUILDERS = [buildHome, buildSignposts, buildClimbSign, buildMouths, buildHall];

export function build(level, palette, theme) {
  const group = new THREE.Group(), pieces = BUILDERS.map(make => make(level, palette, theme));
  for (const piece of pieces) group.add(piece.group);
  return { group, update: (...args) => { for (const piece of pieces) piece.update(...args); } };
}
