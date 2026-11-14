import { hookAnchor } from '../world/physics.js';
import { createStrand, stepStrand, handOf, visibleRope, swayOf } from '../art/rigging.js';
import { shade, tint } from '../art/themes.js';
import { THREE, toon, glowing, mesh, shape, roundBox, placed, merged, sphere } from './toon.js';
import { at, sized, tube, smoothInto, bendInto } from './mech-kit.js';

const IDLE_ROPE = 22;
const GRIP_GLOW = 60;
const ARM_BEND = 1.5;
const CLIMB_Z = -14;
const KNOT_GAP = 22;
const WHITE = 'hsl(0 0% 100% / 1)';
const TAU = Math.PI * 2;

const disc = () => new THREE.CylinderGeometry(1, 1, 1, 18).rotateX(Math.PI / 2);

function eyelet(p) {
  const node = new THREE.Group();
  const ring = mesh(shape('eyelet', () => new THREE.TorusGeometry(6, 1.7, 8, 22)), toon(p.accent, { emissive: 0.15 }), 1);
  const halo = sized(mesh(shape('halo', () => new THREE.TorusGeometry(1, 0.32, 6, 24)), glowing(p.accent, 0.3), 0), 7.5);
  const shine = at(sized(mesh(sphere, glowing(WHITE, 0.8), 0), 1.2), -4.2, 4.2, 1.6);
  node.add(halo, ring, shine);
  return {
    node,
    glow(near) {
      ring.material = toon(p.accent, { emissive: near ? 0.55 : 0.15 });
      halo.visible = near;
    },
  };
}

function reachRing(reach, p) {
  const dots = Math.max(12, Math.round((TAU * reach) / 9));
  const geometry = shape(`reach:${reach}`, () => merged(Array.from({ length: dots }, (_, k) => {
    const a = (k / dots) * TAU;
    return placed(roundBox(3, 1.2, 1.2, 0.5), Math.cos(a) * reach, Math.sin(a) * reach, 0, { rz: a + Math.PI / 2 });
  })));
  return new THREE.Mesh(geometry, toon(p.accent, { opacity: 0.35 }));
}

function rope(o, p, level) {
  const node = new THREE.Group(), ring = eyelet(p), reach = reachRing(o.reach, p);
  const line = tube(21, 1.3, toon(shade(p.rockEdge, 10)), 1);
  const knot = sized(mesh(sphere, toon(p.ink), 0.8), 2.6);
  node.add(line.node, knot, reach, ring.node);
  let strand = null;
  return {
    node,
    update(state, time, level, view) {
      const anchor = hookAnchor(o, state.clock), held = state.rope === o.id;
      strand ??= createStrand(anchor.x, anchor.y, IDLE_ROPE);
      if (strand.frame !== state.frame) {
        strand.frame = state.frame;
        stepStrand(strand, anchor.x, anchor.y, held ? handOf(level, state) : null, held ? visibleRope(level, state.ropeLen) : IDLE_ROPE, state.gravDir ?? 1);
      }
      smoothInto(line, strand.points);
      line.trace(-1);
      const end = strand.points.at(-1);
      knot.visible = !held;
      knot.position.set(end.x, -end.y, -1);
      const near = state.rope < 0 && Math.hypot(view.player.x - anchor.x, view.player.y - anchor.y) <= o.reach;
      ring.glow(near);
      ring.node.position.set(anchor.x, -anchor.y, 0);
      reach.visible = near;
      reach.position.copy(ring.node.position);
    },
  };
}

function grip(o, p) {
  const node = new THREE.Group(), ring = eyelet(p), px = o.x + o.w / 2, py = o.y + o.h / 2;
  const hub = (x, y) => {
    const part = new THREE.Group();
    part.add(sized(mesh(shape('disc', disc), toon(p.rockDeep), 1), 6, 6, 5));
    part.add(at(sized(mesh(sphere, glowing(WHITE, 0.7), 0), 1.2), -2, 2, 3));
    return at(part, x, -y, -3);
  };
  if (o.motion === 'orbit') node.add(at(mesh(new THREE.TorusGeometry(Math.abs(o.dx), 1, 6, 64), toon(p.ink, { opacity: 0.35 }), 0), px, -py, -6));
  const arm = tube(o.motion ? 13 : 3, o.motion ? 2.1 : 1.6, toon(o.motion ? p.rockEdge : p.ink), 1.1);
  node.add(arm.node, hub(px, py), ring.node);
  if (!o.motion) node.add(hub(px + o.dx, py + o.dy));
  return {
    node,
    update(state, time, level, view) {
      const anchor = hookAnchor(o, state.clock), sway = swayOf(o, state), x = anchor.x + sway.x, y = anchor.y + sway.y;
      if (o.motion) bendInto(arm, px, py, (px + x) / 2 - sway.x * ARM_BEND, (py + y) / 2 - sway.y * ARM_BEND, x, y);
      else [[px, py], [x, y], [px + o.dx, py + o.dy]].forEach(([ax, ay], k) => { arm.xs[k] = ax; arm.ys[k] = -ay; });
      arm.trace(-2);
      ring.node.position.set(x, -y, 0);
      ring.glow(state.rope < 0 && Math.hypot(view.player.x - anchor.x, view.player.y - anchor.y) <= GRIP_GLOW);
    },
  };
}

function strandClimb(o, p, level, theme) {
  const vine = theme.climb === 'vine', colour = vine ? p.rockEdge : p.ink, cx = o.x + o.w / 2, bottom = o.y + o.h;
  const steps = Math.max(2, Math.ceil((o.h + 6) / 6)), line = tube(steps + 1, vine ? 1.8 : 2, toon(colour), 1.1);
  const node = new THREE.Group();
  node.add(line.node);
  const knots = [];
  for (let y = o.y + 10, k = 0; y < bottom; y += KNOT_GAP, k++) {
    const knot = vine
      ? mesh(shape('leaf', () => sphere.clone().scale(6, 3, 1.6)), toon(tint(colour, 0, -6)), 0.8)
      : sized(mesh(sphere, toon(colour), 0.9), 3.2, 3.6, 3.2);
    if (vine) knot.rotation.z = k % 2 ? -0.5 : 0.5;
    knot.userData = { y, side: vine ? (k % 2 ? 6 : -6) : 0 };
    node.add(knot);
    knots.push(knot);
  }
  const sway = (y, time) => Math.sin(time / 700 + y / 40) * 2.5 * ((y - o.y) / o.h);
  return {
    node,
    update(state, time) {
      for (let r = 0; r <= steps; r++) {
        const y = r ? Math.min(bottom, o.y + (r - 1) * ((bottom - o.y) / (steps - 1))) : o.y - 6;
        line.xs[r] = cx + sway(y, time);
        line.ys[r] = -y;
      }
      line.trace(CLIMB_Z);
      for (const knot of knots) knot.position.set(cx + sway(knot.userData.y, time) + knot.userData.side, -knot.userData.y, CLIMB_Z + (vine ? 1.5 : 0));
    },
  };
}

function glue(o, p) {
  const node = new THREE.Group(), inner = o.side > 0 ? o.x : o.x + o.w, out = -o.side, goo = toon(p.accent, { opacity: 0.85, emissive: 0.2 });
  node.add(at(mesh(roundBox(5, o.h + 8, 30, 2.4), goo, 1.1), inner + out * 2.5, -(o.y + o.h / 2), 2));
  const blobs = [];
  for (let y = o.y; y <= o.y + o.h; y += 16) {
    const blob = mesh(sphere, goo, 0);
    blob.userData.y = y;
    node.add(blob);
    blobs.push(blob);
  }
  const drips = [0.3, 0.75].map(f => placed(sphere, inner + out * (2 + f * 4), -(o.y + o.h + 4 + f * 6), 4, { sx: 2.2, sy: 4 + f * 4, sz: 2.2 }));
  node.add(mesh(merged(drips), goo, 0.8));
  const shine = [];
  for (let y = o.y + 10; y < o.y + o.h; y += 32) shine.push(placed(sphere, inner + out * 3, -y, 15, { sx: 1.6, sy: 1.6, sz: 1 }));
  if (shine.length) node.add(new THREE.Mesh(merged(shine), glowing(WHITE, 0.6)));
  return {
    node,
    update(state, time) {
      for (const blob of blobs) {
        const bulge = 4 + 3 * Math.sin(time / 900 + blob.userData.y / 23);
        blob.scale.set((bulge + 5) / 2 + 1, 10, 14);
        blob.position.set(inner + out * (bulge + 5) / 3, -(blob.userData.y + 8), 2);
      }
    },
  };
}

export const RIGGING = {
  hook: o => (o.grip ? grip : rope),
  climb: (o, theme) => (o.kind === 'glue' ? glue : theme.climb === 'ladder' ? null : strandClimb),
};
