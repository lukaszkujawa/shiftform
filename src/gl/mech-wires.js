import { levelIndex, gateOutput, gatePins, erased } from '../world/level.js?v=3328ffe';
import { signalPalette } from '../art/object-art.js?v=3328ffe';
import { THREE, toon, glowing, hull, mesh, shape, roundBox, placed, merged, sphere, cylinder } from './toon.js?v=3328ffe';
import { bright } from './mech-kit.js?v=3328ffe';
import { modelled } from './props.js?v=3328ffe';
import { at, sized } from './kit.js?v=3328ffe';

const WIRE_Z = -20;
const DASH = 14;
const DASH_SPEED = 1 / 40;

const bitsOf = state => state.flags | state.pressed;

function wireLive(level, wire, state) {
  if (wire.gate) return gateOutput(wire.gate, bitsOf(state));
  return wire.bit ? (bitsOf(state) & wire.bit) !== 0 : state.timers[wire.timer] >= 0 && state.clock - state.timers[wire.timer] < levelIndex(level).timers[wire.timer].open;
}

function route(points) {
  const legs = points.slice(1).map(([x1, y1], k) => {
    const [x0, y0] = points[k];
    return { x0, y0, dx: x1 - x0, dy: y1 - y0, length: Math.hypot(x1 - x0, y1 - y0) };
  }).filter(leg => leg.length > 0);
  return { legs, length: legs.reduce((sum, leg) => sum + leg.length, 0) };
}

function wire(level, p, w) {
  const color = w.gate ? p.ink : w.bit ? signalPalette(p, w.bit).accent : p.accent, { legs, length } = route(w.points);
  const parts = [...legs.map(leg => placed(cylinder, leg.x0 + leg.dx / 2, -(leg.y0 + leg.dy / 2), WIRE_Z, { sx: 1.3, sy: leg.length, sz: 1.3, rz: Math.atan2(leg.dx, leg.dy) })), ...w.points.map(([x, y]) => placed(sphere, x, -y, WIRE_Z, { sx: 1.5, sy: 1.5, sz: 1.5 }))];
  const cable = mesh(merged(parts), toon(color, { opacity: 0.6 }), 0);
  const count = Math.max(1, Math.ceil(length / DASH)), beads = new THREE.InstancedMesh(shape('wire-dash', () => roundBox(8, 2.8, 2.8, 1.2)), glowing(color), count);
  beads.frustumCulled = false;
  const node = new THREE.Group(), pose = new THREE.Object3D();
  node.add(cable, beads);
  return {
    node,
    update(state, time) {
      const live = wireLive(level, w, state);
      cable.material = live ? toon(color, { emissive: 0.3 }) : toon(color, { opacity: 0.6 });
      beads.visible = live;
      if (!live) return;
      let k = 0;
      for (let s = (time * DASH_SPEED) % DASH; s < length && k < count; s += DASH, k++) {
        let along = s, leg = legs[0];
        for (leg of legs) { if (along <= leg.length) break; along -= leg.length; }
        const f = Math.min(1, along / leg.length);
        pose.position.set(leg.x0 + leg.dx * f, -(leg.y0 + leg.dy * f), WIRE_Z + 0.5);
        pose.rotation.z = -Math.atan2(leg.dy, leg.dx);
        pose.updateMatrix();
        beads.setMatrixAt(k, pose.matrix);
      }
      beads.count = k;
      beads.instanceMatrix.needsUpdate = true;
    },
  };
}

const OUTLINES = {
  and: () => new THREE.Shape().moveTo(-10, -8).lineTo(10, -8).lineTo(10, 0).absarc(0, 0, 10, 0, Math.PI, false).closePath(),
  or: () => new THREE.Shape().moveTo(-10, -8).quadraticCurveTo(0, -3, 10, -8).quadraticCurveTo(10, 3, 0, 10).quadraticCurveTo(-10, 3, -10, -8).closePath(),
};
OUTLINES.xor = OUTLINES.or;

function gateSymbol(p, o) {
  const { gate } = o;
  const node = new THREE.Group(), symbol = new THREE.Group();
  const geometry = shape(`gate:${gate.op}`, () => new THREE.ExtrudeGeometry(OUTLINES[gate.op](), { depth: 4, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -2));
  const body = new THREE.Mesh(geometry, toon(p.rockEdge));
  body.add(new THREE.Mesh(geometry, hull(p.ink, 1.4)));
  symbol.add(body);
  if (gate.op === 'xor') symbol.add(mesh(shape('xor-arc', () => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-10, -12.5, 0), new THREE.Vector3(0, -7, 0), new THREE.Vector3(10, -12.5, 0)), 12, 1.1, 6)), toon(p.ink), 0.6));
  symbol.position.set(gate.x, -gate.y, 2);
  symbol.scale.y = -gate.dir;
  node.add(symbol);
  const pins = gatePins(gate).map(pin => {
    const color = signalPalette(p, pin.bit).accent, holder = at(new THREE.Group(), pin.at[0], -pin.at[1], 2);
    const bead = pin.negated ? mesh(shape('pin-ring', () => new THREE.TorusGeometry(3.5, 1, 6, 16)), toon(color), 0.6) : sized(mesh(sphere, toon(color), 0.6), 2.5);
    holder.add(bead);
    if (pin.negated) holder.add(sized(mesh(shape('pin-disc', () => new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2)), toon(p.rockEdge), 0), 2.8, 2.8, 1.5));
    node.add(holder);
    return { pin, bead, color };
  });
  return {
    node,
    update(state) {
      node.visible = !erased(state, o);
      const bits = bitsOf(state);
      body.material = gateOutput(gate, bits) ? toon(p.ink) : toon(p.rockEdge);
      for (const { pin, bead, color } of pins) bead.material = (bits & pin.bit) !== 0 ? bright(color) : toon(color, { opacity: pin.negated ? 1 : 0.4 });
    },
  };
}

export function wires(level, p, theme) {
  const group = new THREE.Group();
  const parts = [...(level.wires ?? []).filter(w => w.points.length > 1).map(w => wire(level, p, w)), ...level.objects.filter(o => o.gate && modelled(o, theme)).map(o => gateSymbol(p, o))];
  for (const part of parts) group.add(part.node);
  return { group, update: (state, time) => { for (const part of parts) part.update(state, time); } };
}
