import { TILE, WIDTH } from '../world/level.js?v=cb728ba';
import { MOUTH } from '../world/tunnel.js?v=cb728ba';
import { alpha } from '../art/themes.js?v=cb728ba';
import { THREE, colorOf, mesh, roundBox, placed, sphere, createPainter, glowing, shining } from './toon.js?v=cb728ba';
import { glow, cutout } from './set-kit.js?v=cb728ba';

const PORTAL = { pillar: 12, course: 15, lintel: 12, stone: 17, overhang: 8 };
const DEPTH = { front: -6, back: -42, cave: -70 };
const DARK = 'hsl(235 35% 4% / 1)';
const LANTERN_CAP = 'hsl(235 35% 10% / 1)';
const MOTE = 'hsl(40 100% 80% / 1)';
const CAVE_MOUTH = 'hsl(235 30% 12% / 1)';

function stone(parts, p, x, y, w, h) {
  const depth = DEPTH.front - DEPTH.back, z = (DEPTH.front + DEPTH.back) / 2;
  parts.add(p.rock, placed(roundBox(w - 0.6, h - 0.6, depth, 2.5, 2), x + w / 2, -(y + h / 2), z), { outline: 1.2 });
  parts.add(p.rockEdge, placed(roundBox(w - 3, 2, 2, 0.8), x + w / 2, -(y + 2), DEPTH.front + 0.6));
}

function cave(open, top, floor) {
  const geometry = new THREE.BoxGeometry(open + 40, floor - top, DEPTH.front - DEPTH.cave, 1, 1, 6);
  const colors = [], position = geometry.attributes.position, deep = colorOf(DARK), mouth = colorOf(CAVE_MOUTH);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getZ(i) / (DEPTH.front - DEPTH.cave)) + 0.5;
    colors.push(...deep.clone().lerp(mouth, t * t).toArray());
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const inside = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false }));
  inside.position.set((open - 40) / 2, -(top + floor) / 2, (DEPTH.front + DEPTH.cave) / 2);
  return inside;
}

function mouth(p, floor) {
  const w = MOUTH.w * TILE, h = MOUTH.h * TILE, top = floor - h, open = w - PORTAL.pillar, lintel = top - PORTAL.lintel;
  const group = new THREE.Group(), parts = createPainter();
  group.add(cave(open, top, floor));
  for (const [x, z] of [[open * 0.66, -46], [open * 0.28, -58]]) {
    parts.add(p.rockDeep, placed(roundBox(5, h - 4, 5, 1.5), x, -(top + 4 + (h - 4) / 2), z));
    parts.add(p.rockDeep, placed(roundBox(18, 4, 6, 1.5), x, -(top + 6), z));
  }
  for (let y = floor - PORTAL.course; y > top - 1; y -= PORTAL.course) stone(parts, p, open, y, PORTAL.pillar, PORTAL.course);
  stone(parts, p, open - 2, floor - 5, PORTAL.pillar + 4, 5);
  stone(parts, p, open - 3, top - 2, PORTAL.pillar + 6, 6);
  for (let x = -6, k = 0; x < w + PORTAL.overhang; x += PORTAL.stone, k++) stone(parts, p, x, lintel + (k % 2), Math.min(PORTAL.stone, w + PORTAL.overhang - x), PORTAL.lintel - (k % 2));
  const key = { x: w / 2 - 9, y: lintel - 4, w: 18, h: PORTAL.lintel + 6 };
  parts.add(p.rock, placed(roundBox(key.w, key.h, DEPTH.front - DEPTH.back + 4, 3, 2), key.x + key.w / 2, -(key.y + key.h / 2), (DEPTH.front + DEPTH.back) / 2 + 2), { outline: 1.3 });
  const lx = w + 7, ly = top + 10, hook = [w + PORTAL.overhang - 3, lintel + PORTAL.lintel];
  const cord = new THREE.CylinderGeometry(0.6, 0.6, Math.hypot(lx - hook[0], ly - hook[1]), 6);
  parts.add(DARK, placed(cord, (lx + hook[0]) / 2, -(ly + hook[1]) / 2, -4.5, { rz: Math.atan2(lx - hook[0], ly - hook[1]) }));
  parts.add(LANTERN_CAP, placed(roundBox(10, 2.4, 10, 0.8), lx, -ly, -4.5), { outline: 0.6 });
  parts.build(group);
  const arrow = mesh(cutout([[key.x + 5, key.y + key.h / 2], [key.x + 12, key.y + key.h / 2 - 5], [key.x + 12, key.y + key.h / 2 + 5]], 1, 0.4), glowing(p.accent), 0);
  arrow.position.z = DEPTH.front + 5;
  const lamp = mesh(roundBox(8, 11, 8, 3), glowing(p.accent), 1);
  lamp.position.set(lx, -(ly + 6.5), -4.5);
  const halo = glow(alpha(p.accent, 0.4), 22, lx, -(ly + 7), -7);
  const warmth = glow('hsl(38 100% 66% / 0.26)', 50, 0, -(floor - 12), DEPTH.back - 4);
  const motes = Array.from({ length: 4 }, () => mesh(sphere, glowing(MOTE), 0));
  for (const mote of motes) mote.scale.setScalar(1.3);
  group.add(arrow, shining(lamp, p.accent, { power: 0.9, reach: 150 }), halo, warmth, ...motes);
  return {
    group,
    update(time) {
      arrow.material.opacity = 0.65 + 0.35 * Math.sin(time / 350);
      halo.scale.setScalar(22 * (1 + 0.12 * Math.sin(time / 90) * Math.sin(time / 37)));
      warmth.material.opacity = 0.26 + 0.05 * Math.sin(time / 420);
      motes.forEach((mote, i) => {
        const t = (time / 2600 + i / 4) % 1;
        mote.position.set(open * (1 - t) * 0.9, -(floor - 10 - i * 10 + Math.sin(t * Math.PI * 2 + i) * 3), -20 - i * 6);
        mote.material.opacity = (1 - t) * 0.55;
      });
    },
  };
}

export function buildMouths(level, p) {
  const group = new THREE.Group();
  if (level.hall || level.custom) return { group, update() {} };
  const left = mouth(p, (level.rows - 1) * TILE), right = left.group.clone();
  right.scale.x = -1;
  right.position.x = WIDTH;
  group.add(left.group, right);
  return { group, update: (state, time) => left.update(time) };
}
