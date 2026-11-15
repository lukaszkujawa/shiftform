import { THREE } from './toon.js?v=0a1f4db';
import { bodies, tombs, placedBlocks, flags } from './mech-loose.js?v=0a1f4db';
import { wires } from './mech-wires.js?v=0a1f4db';
import { flood, exitBeam } from './mech-flood.js?v=0a1f4db';

export function build(level, palette, theme) {
  const group = new THREE.Group();
  const parts = [bodies(level), tombs(palette), placedBlocks(palette), flags(palette), wires(level, palette, theme), exitBeam(level, palette), flood(level, palette, theme)];
  for (const part of parts) group.add(part.group);
  return { group, update: (...args) => { for (const part of parts) part.update(...args); } };
}
