import { THREE } from './toon.js?v=7aa3937';
import { bodies, tombs, placedBlocks, flags } from './mech-loose.js?v=7aa3937';
import { wires } from './mech-wires.js?v=7aa3937';
import { flood, exitBeam } from './mech-flood.js?v=7aa3937';

export function build(level, palette, theme) {
  const group = new THREE.Group();
  const parts = [bodies(level), tombs(palette), placedBlocks(palette), flags(palette), wires(level, palette, theme), exitBeam(level, palette), flood(level, palette, theme)];
  for (const part of parts) group.add(part.group);
  return { group, update: (...args) => { for (const part of parts) part.update(...args); } };
}
