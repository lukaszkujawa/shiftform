import { THREE } from './toon.js?v=cb728ba';
import { buildHome } from './set-home.js?v=cb728ba';
import { buildSignposts, buildClimbSign } from './set-signs.js?v=cb728ba';
import { buildMouths } from './set-mouths.js?v=cb728ba';
import { buildHall } from './set-hall.js?v=cb728ba';

const BUILDERS = [buildHome, buildSignposts, buildClimbSign, buildMouths, buildHall];

export function build(level, palette, theme) {
  const group = new THREE.Group(), pieces = BUILDERS.map(make => make(level, palette, theme));
  for (const piece of pieces) group.add(piece.group);
  return { group, update: (...args) => { for (const piece of pieces) piece.update(...args); } };
}
