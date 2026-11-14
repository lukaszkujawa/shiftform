import { objectRect, crushed, phaseOn, cycleAt } from '../world/level.js';
import { FUSE_CHARGE, FUSE_BURN, fuseBurning } from '../world/physics.js';
import { tint } from '../art/themes.js';
import { THREE, toon, glowing, hull, mesh, shape, roundBox, placed, merged, sphere, cone, cylinder, shining } from './toon.js';
import { at, sized } from './kit.js';
import { createFire } from './fire.js';

const LINK_GAP = 4.5;
const STEEL = 'hsl(210 12% 78% / 1)';

const quantized = (value, steps = 8) => Math.round(Math.max(0, Math.min(1, value)) * steps) / steps;

function squashed(o, p) {
  const bar = mesh(roundBox(o.w, 4, 20, 1.5), toon(p.hazard, { opacity: 0.6 }), 0);
  bar.visible = false;
  return bar;
}

function bladeShape(w, h) {
  return new THREE.Shape()
    .moveTo(-w / 2 - 3, 5)
    .quadraticCurveTo(0, h / 2 - 2, w / 2 + 3, 5)
    .quadraticCurveTo(w / 3, -h / 2 - 3, 0, -h / 2 - 5)
    .quadraticCurveTo(-w / 3, -h / 2 - 3, -w / 2 - 3, 5);
}

function pendulum(o, p, level) {
  const node = new THREE.Group(), blade = new THREE.Group(), px = o.x + o.w / 2, py = o.y + o.h / 2;
  const rod = mesh(cylinder, toon(p.ink), 1);
  const geometry = shape(`axe:${o.w}:${o.h}`, () => new THREE.ExtrudeGeometry(bladeShape(o.w, o.h), { depth: 5, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -2.5));
  blade.add(mesh(geometry, toon(p.hazard), 1.2));
  const sheen = new THREE.Shape().moveTo(0, 3).lineTo(o.w / 3, -2).lineTo(0, -o.h / 2 - 3);
  blade.add(at(new THREE.Mesh(shape(`axe-sheen:${o.w}:${o.h}`, () => new THREE.ShapeGeometry(sheen)), toon(tint(p.hazard, 0, 28))), 0, 0, 4.1));
  blade.add(at(sized(mesh(new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2), toon(STEEL), 1), 4, 4, 12), 0, 2));
  const pivot = at(sized(mesh(new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2), toon(p.ink), 1), 4.5, 4.5, 8), px, -py);
  const bar = squashed(o, p);
  node.add(rod, blade, pivot, bar);
  return {
    node,
    update(state) {
      const rect = objectRect(o, state.clock), cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, dx = cx - px, dy = cy - py, angle = Math.atan2(dx, dy);
      const flat = crushed(level, state, o);
      rod.visible = blade.visible = !flat;
      bar.visible = flat;
      bar.position.set(cx, -(rect.y + rect.h - 2), 0);
      rod.position.set((px + cx) / 2, -(py + cy) / 2, -1);
      rod.scale.set(1.6, Math.hypot(dx, dy), 1.6);
      rod.rotation.z = angle;
      blade.position.set(cx, -cy, 0);
      blade.rotation.z = angle;
    },
  };
}

function crusher(o, p, level) {
  const node = new THREE.Group(), block = new THREE.Group(), cx = o.x + o.w / 2, n = Math.round(o.w / 8), body = o.h - 8;
  block.add(at(mesh(roundBox(o.w, body, 26, 3), toon(tint(p.rockEdge, 0, -10)), 1.4), 0, -body / 2));
  block.add(at(mesh(roundBox(o.w + 1, 3.5, 27, 1.2), toon(p.ink), 0), 0, -1.75));
  const teeth = [];
  for (const z of [-7, 6]) for (let i = 0; i < n; i++) teeth.push(placed(cone, -o.w / 2 + ((i + 0.5) * o.w) / n, -body - 4, z, { sx: o.w / n / 2, sy: 8, sz: o.w / n / 2, rz: Math.PI }));
  block.add(mesh(merged(teeth), toon(p.hazard), 1));
  block.add(mesh(merged([-1, 1].map(side => placed(sphere, side * (o.w / 2 - 5), -body / 2, 13, { sx: 2.2, sy: 2.2, sz: 1.2 }))), toon(p.ink), 0));
  const links = Array.from({ length: Math.ceil((Math.abs(o.dy) + o.h) / LINK_GAP) + 1 }, (_, k) => {
    const link = mesh(shape('link', () => new THREE.TorusGeometry(2.6, 0.95, 6, 12).scale(0.8, 1.25, 1)), toon(p.ink), 0.7);
    link.rotation.y = k % 2 ? Math.PI / 2 : 0;
    node.add(link);
    return link;
  });
  node.add(at(mesh(roundBox(14, 4, 16, 1.5), toon(p.ink), 1), cx, -(o.y + 2), -2));
  const bar = squashed(o, p);
  node.add(block, bar);
  return {
    node,
    update(state) {
      const rect = objectRect(o, state.clock), flat = crushed(level, state, o);
      block.visible = !flat;
      bar.visible = flat;
      bar.position.set(cx, -(rect.y + rect.h - 2), 0);
      block.position.set(rect.x + rect.w / 2, -rect.y, 0);
      links.forEach((link, k) => {
        const y = o.y + 3 + k * LINK_GAP;
        link.visible = !flat && y < rect.y;
        link.position.set(cx, -y, -2);
      });
    },
  };
}


function flame(o, p) {
  const node = new THREE.Group(), fire = new THREE.Group(), cx = o.x + o.w / 2, nozzle = o.dir < 0 ? o.y + o.h : o.y, reach = o.dir < 0 ? -1 : 1;
  const burner = new THREE.Group();
  burner.add(at(mesh(roundBox(18, 5, 16, 1.5), toon(p.ink), 1.2), 0, 2.5));
  burner.add(at(mesh(new THREE.CylinderGeometry(4, 5, 2, 14), toon(tint(p.ink, 0, -14)), 0), 0, 5.5));
  burner.position.set(cx, -nozzle, 0);
  burner.scale.y = -reach;
  fire.add(createFire(o.w * 2.4, o.h * 1.15));
  fire.position.set(cx, -(nozzle + reach * 4), 0);
  fire.scale.y = -reach;
  const sparks = Array.from({ length: 3 }, () => sized(mesh(sphere, glowing(p.hazard, 0.6), 0), 2));
  node.add(burner, shining(fire, p.hazard, { power: 1.6, reach: 190 }), ...sparks);
  return {
    node,
    update(state, time) {
      const on = phaseOn(o, state.clock), warming = !on && o.period - cycleAt(o, state.clock) < 30;
      fire.visible = on;
      sparks.forEach((spark, k) => {
        spark.visible = warming;
        spark.position.set(cx + Math.sin(time / 60 + k) * 4, -(nozzle + reach * (8 + k * 5)), 0);
      });
    },
  };
}

function fuse(o, p) {
  const node = new THREE.Group(), cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const block = mesh(roundBox(o.w, o.h, 24, 3), toon(p.rockDeep), 1.4);
  const rim = new THREE.Mesh(block.geometry, hull(p.hazard, 2.6));
  block.add(rim);
  const cracks = [[[5, 6], [o.w / 2 - 3, o.h / 2], [7, o.h - 5]], [[o.w - 5, 7], [o.w / 2 + 3, o.h / 2 + 1], [o.w - 8, o.h - 4]]].flatMap(line => line.slice(1).map(([x1, y1], k) => {
    const [x0, y0] = line[k], length = Math.hypot(x1 - x0, y1 - y0);
    return placed(roundBox(length + 1.6, 1.8, 1.4, 0.6), (x0 + x1) / 2 - o.w / 2, -((y0 + y1) / 2 - o.h / 2), 12.3, { rz: -Math.atan2(y1 - y0, x1 - x0) });
  }));
  const crack = new THREE.Mesh(merged(cracks), glowing(p.hazard));
  const core = at(sized(new THREE.Mesh(sphere, glowing(p.hazard, 0.5)), o.w * 0.32, o.h * 0.32, 1), 0, 0, 11.5);
  block.add(crack, core);
  block.position.set(cx, -cy, 0);
  const flames = at(createFire(o.w * 1.25, 26), cx, -o.y - 3, 4);
  node.add(block, flames);
  return {
    node,
    update(state, time) {
      const left = state.crumbled[o.slot], burning = fuseBurning(left), heat = left > FUSE_BURN ? (FUSE_CHARGE + FUSE_BURN - left) / FUSE_CHARGE : burning ? 1 : 0;
      const breath = 0.5 + 0.5 * Math.sin(time / (900 - 760 * heat) + o.x * 0.7);
      core.material = glowing(p.hazard, quantized(0.35 + 0.65 * Math.max(heat, breath * 0.5), 10) * 0.75);
      core.scale.set(o.w * (0.24 + 0.14 * Math.max(heat, breath * 0.5)), o.h * (0.24 + 0.14 * Math.max(heat, breath * 0.5)), 1);
      crack.material = glowing(p.hazard, quantized(0.45 + 0.55 * heat, 6));
      rim.visible = heat > 0;
      if (rim.visible) rim.material = hull(p.hazard, 1.6 + quantized(breath, 4) * 1.6);
      flames.visible = burning;
    },
  };
}

export const HAZARDS = {
  saw: o => (o.kind === 'pendulum' ? pendulum : o.kind === 'crusher' ? crusher : null),
  laser: o => (o.kind === 'flame' ? flame : null),
  crumble: o => (o.kind === 'fuse' ? fuse : null),
};
