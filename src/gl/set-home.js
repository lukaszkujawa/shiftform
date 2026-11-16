import { homeOf, atWardrobe } from '../world/home.js?v=7aa3937';
import { THREE, toon, mesh, roundBox, placed, sphere, cylinder, createPainter, glowing, shining } from './toon.js?v=7aa3937';
import { painting, glow, cutout, between } from './set-kit.js?v=7aa3937';
import { font, roundRect } from '../art/paint.js?v=7aa3937';

const ROOF_H = 54;
const EAVE = 14;
const HIP = 20;
const FRONT = -4;
const BACK = -44;
const WALL = -38;
const LOOK = {
  roof: 'hsl(8 58% 52% / 1)', roofEdge: 'hsl(8 50% 38% / 1)', brick: 'hsl(12 35% 42% / 1)', brickDark: 'hsl(12 30% 32% / 1)',
  wall: 'hsl(38 55% 88% / 1)', paper: 'hsl(38 45% 81% / 1)', trim: 'hsl(26 42% 40% / 1)', floor: 'hsl(30 45% 56% / 1)',
  wood: 'hsl(26 48% 44% / 1)', woodDark: 'hsl(24 45% 28% / 1)', brass: 'hsl(45 85% 60% / 1)',
  glass: 'hsl(205 70% 80% / 1)', curtain: 'hsl(340 60% 72% / 1)', rug: 'hsl(340 55% 62% / 1)', rugInner: 'hsl(40 80% 72% / 1)',
  mirror: 'hsl(200 55% 84% / 1)', shine: 'hsl(0 0% 100% / 1)', lamp: 'hsl(45 100% 78% / 1)', glow: 'hsl(45 100% 70% / 0.3)',
  hill: 'hsl(120 35% 55% / 1)', sky: 'hsl(200 70% 85% / 1)', bubble: 'hsl(240 25% 12% / 0.85)', label: 'hsl(0 0% 97% / 1)',
  smoke: 'hsl(0 0% 94% / 1)', ring: 'hsl(48 100% 70% / 1)',
};

const box = (x0, y0, x1, y1, z0, z1, r = 1.5) => placed(roundBox(x1 - x0, y1 - y0, z1 - z0, r, 2), (x0 + x1) / 2, -(y0 + y1) / 2, (z0 + z1) / 2);

function hipRoof(x0, x1, eave, ridge, zf, zb) {
  const mid = (x0 + x1) / 2, A = [x0, eave, zf], B = [x1, eave, zf], C = [x1, eave, zb], D = [x0, eave, zb], P = [mid, ridge, zf - HIP], Q = [mid, ridge, zb + HIP];
  const faces = [A, B, P, B, C, Q, B, Q, P, C, D, Q, D, A, P, D, P, Q, A, D, C, A, C, B];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

const rod = (from, to, r) => {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], length = Math.hypot(dx, dy, dz);
  const geometry = new THREE.CylinderGeometry(r, r, length, 8);
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize())));
  return placed(geometry, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
};

function roof({ x, right, top }, parts) {
  const x0 = x - EAVE, x1 = right + EAVE, eave = -top, ridge = -(top - ROOF_H), mid = (x + right) / 2, chimney = right - 52;
  parts.add(LOOK.roof, hipRoof(x0, x1, eave, ridge, FRONT, BACK - 2), { outline: 1.5, weld: true });
  const apex = [mid, ridge, FRONT - HIP + 1];
  for (const corner of [[x0, eave, FRONT + 1], [x1, eave, FRONT + 1]]) parts.add(LOOK.roofEdge, rod(corner, apex, 2.5), { outline: 0.8 });
  parts.add(LOOK.roofEdge, rod([x0, eave, FRONT + 1], [x1, eave, FRONT + 1], 2.5), { outline: 0.8 });
  for (const f of [0.22, 0.7]) {
    const half = (1 - f) * (x1 - x0) / 2 - 6;
    parts.add(LOOK.roofEdge, rod([mid - half, between(eave, ridge, f), FRONT - f * HIP + 0.6], [mid + half, between(eave, ridge, f), FRONT - f * HIP + 0.6], 1));
  }
  const tilt = -Math.atan2(HIP, ROOF_H), f = 0.45, oculus = [mid, between(eave, ridge, f), FRONT - f * HIP + 0.8];
  parts.add(LOOK.trim, placed(new THREE.TorusGeometry(9, 1.6, 8, 24), ...oculus, { rx: tilt }), { outline: 0.8 });
  parts.add(LOOK.glass, placed(new THREE.CylinderGeometry(9, 9, 1.2, 24), ...oculus, { rx: tilt + Math.PI / 2 }));
  parts.add(LOOK.trim, placed(roundBox(1.6, 17, 1.6, 0.6), ...oculus, { rx: tilt }));
  parts.add(LOOK.brick, box(chimney, top - ROOF_H + 4, chimney + 16, top + 4, -34, -18, 1), { outline: 1.2 });
  parts.add(LOOK.brickDark, box(chimney - 2, top - ROOF_H + 1, chimney + 18, top - ROOF_H + 7, -36, -16, 1.5), { outline: 1.2 });
}

function room({ x, right, top, floor, windowX }, parts) {
  const mid = (x + right) / 2;
  parts.add(LOOK.wall, box(x, top, right, floor, BACK, WALL, 0.5));
  for (let sx = x + 7; sx < right - 4; sx += 14) parts.add(LOOK.paper, box(sx, top, sx + 5, floor, WALL - 1, WALL + 0.4, 0.2));
  parts.add(LOOK.trim, box(x - 5, top - 4, right + 5, top + 4, BACK, FRONT), { outline: 1.3 });
  parts.add(LOOK.trim, box(x - 5, top, x + 3, floor, BACK, FRONT), { outline: 1.3 });
  parts.add(LOOK.trim, box(right - 3, top, right + 5, floor, BACK, FRONT), { outline: 1.3 });
  parts.add(LOOK.trim, box(x, floor - 6, right, floor, WALL - 1, WALL + 2, 0.8), { outline: 0.8 });
  parts.add(LOOK.floor, box(x - 3, floor - 1.5, right + 3, floor + 4, BACK, FRONT + 2, 1), { outline: 1.2 });
  parts.add(LOOK.trim, box(windowX - 3, top + 15, windowX + 47, top + 57, WALL, WALL + 2, 1), { outline: 1 });
  parts.add(LOOK.glass, box(windowX, top + 18, windowX + 44, top + 54, WALL + 1, WALL + 2.4, 0.4));
  parts.add(LOOK.trim, box(windowX + 20, top + 18, windowX + 24, top + 54, WALL + 2, WALL + 4, 0.6), { outline: 0.6 });
  parts.add(LOOK.trim, box(windowX, top + 34, windowX + 44, top + 38, WALL + 2, WALL + 4, 0.6), { outline: 0.6 });
  parts.add(LOOK.woodDark, placed(cylinder, windowX + 22, -(top + 11), WALL + 7, { sx: 1.2, sy: 60, sz: 1.2, rz: Math.PI / 2 }), { outline: 0.6 });
  for (const [edge, dir] of [[windowX - 4, 1], [windowX + 48, -1]]) {
    const outline = [[edge, top + 12], [edge + dir * 16, top + 12], ...Array.from({ length: 6 }, (_, k) => {
      const t = (k + 1) / 6, u = 1 - t;
      return [u * u * (edge + dir * 16) + 2 * u * t * (edge + dir * 4) + t * t * (edge + dir * 10), u * u * (top + 12) + 2 * u * t * (top + 36) + t * t * (top + 60)];
    }), [edge, top + 60]];
    parts.add(LOOK.curtain, placed(cutout(outline, 2, 0.6), 0, 0, WALL + 7), { outline: 0.9, weld: true });
  }
  parts.add(LOOK.trim, box(mid - 15, top + 14, mid + 15, top + 38, WALL, WALL + 2.5, 1), { outline: 1 });
  parts.add(LOOK.sky, box(mid - 12, top + 17, mid + 12, top + 35, WALL + 1, WALL + 3, 0.3));
  parts.add(LOOK.hill, placed(cutout([[mid - 12, top + 35], [mid - 3, top + 22], [mid + 3, top + 28], [mid + 7, top + 24], [mid + 12, top + 35]], 0.6, 0), 0, 0, WALL + 3.2));
  parts.add(LOOK.woodDark, placed(cylinder, mid, -(top + 23), -16, { sx: 0.7, sy: 38, sz: 0.7 }));
  parts.add(LOOK.curtain, placed(new THREE.CylinderGeometry(5, 10, 8, 16, 1, true), mid, -(top + 46), -16), { outline: 1 });
  parts.add(LOOK.rug, placed(cylinder, mid, -floor + 2, -18, { sx: 52, sy: 1.6, sz: 14 }), { outline: 1 });
  parts.add(LOOK.rugInner, placed(cylinder, mid, -floor + 2.6, -18, { sx: 38, sy: 1.4, sz: 9 }));
}

function wardrobe({ x, y, w, h }, parts) {
  const face = -18, cx = x + w / 2;
  parts.add(LOOK.woodDark, box(x - 4, y - 7, x + w + 4, y + 2, -38, face + 3, 3), { outline: 1.3 });
  parts.add(LOOK.woodDark, box(x + 3, y + h - 5, x + 8, y + h, -34, face - 2, 1), { outline: 1 });
  parts.add(LOOK.woodDark, box(x + w - 8, y + h - 5, x + w - 3, y + h, -34, face - 2, 1), { outline: 1 });
  parts.add(LOOK.wood, box(x, y, x + w, y + h - 4, -36, face, 3), { outline: 1.3 });
  parts.add(LOOK.woodDark, box(cx - 0.75, y + 3, cx + 0.75, y + h - 7, face - 1, face + 0.8, 0.3));
  parts.add(LOOK.wood, box(cx + 4, y + 6, x + w - 4, y + h - 10, face - 1, face + 1.4, 1), { outline: 0.6 });
  const oval = [x + w / 4, -(y + h * 0.42)];
  parts.add(LOOK.trim, placed(cylinder, ...oval, face + 0.8, { sx: w / 4 - 2, sy: 1.6, sz: h * 0.32, rx: Math.PI / 2 }), { outline: 0.7 });
  parts.add(LOOK.mirror, placed(cylinder, ...oval, face + 1.4, { sx: w / 4 - 4.5, sy: 1.2, sz: h * 0.32 - 2.5, rx: Math.PI / 2 }));
  for (const [x0, y0, x1, y1] of [[x + 6, y + h * 0.36, x + 12, y + h * 0.24], [x + 7, y + h * 0.46, x + 14, y + h * 0.32]]) parts.add(LOOK.shine, rod([x0, -y0, face + 2.2], [x1, -y1, face + 2.2], 0.7));
  for (const dx of [-4, 4]) parts.add(LOOK.brass, placed(sphere, cx + dx, -(y + h * 0.5), face + 1, { sx: 1.8, sy: 1.8, sz: 1.4 }), { outline: 0.5 });
}

function bubble() {
  return painting('dress-up', 76, 20, ctx => {
    roundRect(ctx, 0, 0, 76, 20, 10);
    ctx.fillStyle = LOOK.bubble;
    ctx.fill();
    ctx.fillStyle = LOOK.label;
    ctx.font = font(700, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F  dress up', 38, 10);
  });
}

function halo({ x, y, w, h }) {
  const outer = new THREE.Shape(), inner = new THREE.Path();
  const rounded = (path, x0, y0, x1, y1, r) => {
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  };
  rounded(outer, x - 7, -(y + h + 3), x + w + 7, -(y - 11), 7);
  rounded(inner, x - 5, -(y + h + 1), x + w + 5, -(y - 9), 5);
  outer.holes.push(inner);
  const ring = new THREE.Mesh(new THREE.ShapeGeometry(outer, 6), glowing(LOOK.ring));
  ring.position.z = -4;
  return ring;
}

export function buildHome(level) {
  const home = homeOf(level), group = new THREE.Group();
  if (!home) return { group, update() {} };
  const parts = createPainter(), mid = (home.x + home.right) / 2, chimney = home.right - 52;
  roof(home, parts);
  room(home, parts);
  wardrobe(home.wardrobe, parts);
  parts.build(group);
  const bulb = mesh(sphere, glowing(LOOK.lamp), 0);
  bulb.scale.setScalar(3);
  bulb.position.set(mid, -(home.top + 51), -16);
  const lampGlow = glow(LOOK.glow, 34, mid, -(home.top + 50), WALL + 8);
  const puffs = Array.from({ length: 3 }, () => mesh(sphere, toon(LOOK.smoke, { opacity: 0.45, emissive: 0.3 }).clone(), 0));
  const ring = halo(home.wardrobe), tip = bubble();
  tip.position.set(home.wardrobe.x + home.wardrobe.w / 2, -(home.wardrobe.y - 26), 4);
  group.add(shining(bulb, LOOK.lamp, { power: 1, reach: 170 }), lampGlow, ring, tip, ...puffs);
  return {
    group,
    update(state, time, level, view, current) {
      lampGlow.scale.setScalar(34 * (1 + 0.06 * Math.sin(time / 260)));
      puffs.forEach((puff, i) => {
        const t = (time / 2400 + i / 3) % 1;
        puff.position.set(chimney + 8 + t * 14 + Math.sin(t * Math.PI * 2) * 3, -(home.top - ROOF_H - t * 44), -26);
        puff.scale.setScalar(4 + t * 7);
        puff.material.opacity = (1 - t) * 0.45;
      });
      const near = current && !view.wardrobe && atWardrobe(home, level, state);
      ring.visible = tip.visible = near;
      ring.material.opacity = 0.55 + 0.45 * Math.sin(time / 220);
    },
  };
}
