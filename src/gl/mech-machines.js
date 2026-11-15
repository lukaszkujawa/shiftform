import { doorOpen, lockPowered } from '../world/level.js?v=1c29e2a';
import { THREE, toon, mesh, shape, roundBox, placed, merged, sphere, cylinder } from './toon.js?v=1c29e2a';
import { bright, dashedFrame } from './mech-kit.js?v=1c29e2a';
import { at, sized } from './kit.js?v=1c29e2a';

const BEADS = 24;
const TAU = Math.PI * 2;
const LEVER_TILT = Math.atan2(9, 15);
const LEVER_ARM = Math.hypot(9, 15);

const powered = (o, state) => lockPowered(o, state.flags | state.pressed);

function shutDoor(o, p) {
  const w = o.w - 6, node = new THREE.Group();
  node.add(mesh(roundBox(w, o.h, 20, o.plate ? 3 : 4), toon(p.accentLight), 1.4));
  node.add(mesh(merged([-1, 1].map(side => placed(roundBox(3.5, o.h - 2, 22, 1.4), side * (w / 2 - 1.75), 0, 0))), toon(p.accent), 0));
  if (o.plate) {
    const slats = [];
    for (let y = 10; y < o.h; y += 12) slats.push(placed(roundBox(w - 6, 2.6, 2.4, 1), 0, o.h / 2 - y, 10.5));
    if (slats.length) node.add(mesh(merged(slats), toon(p.accent), 0.7));
  } else {
    node.add(mesh(shape('keyhole', () => merged([placed(new THREE.CylinderGeometry(5.5, 5.5, 2.4, 16).rotateX(Math.PI / 2), 0, 4, 10.6), placed(roundBox(4.4, 12, 2.4, 1), 0, -5, 10.6)])), toon(p.accentDeep), 0));
  }
  return node;
}

function door(o, p) {
  const node = new THREE.Group(), shut = shutDoor(o, p), cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  shut.position.set(cx, -cy, 0);
  node.add(shut);
  if (o.timer === undefined) return { node, update(state) { shut.visible = !powered(o, state); } };
  const beads = Array.from({ length: BEADS }, (_, k) => {
    const a = -Math.PI / 2 + ((k + 0.5) / BEADS) * TAU;
    return at(sized(mesh(sphere, bright(p.accent), 0.7), 1.9), cx + Math.cos(a) * 9, -(cy + Math.sin(a) * 9), 0);
  });
  node.add(...beads);
  return {
    node,
    update(state) {
      const open = doorOpen(o, state, state.clock), left = open ? o.open - (state.clock - state.timers[o.timer]) : 0;
      shut.visible = !open;
      beads.forEach((bead, k) => { bead.visible = open && k < Math.ceil((BEADS * left) / o.open); });
    },
  };
}

function toggle(o, p) {
  const node = new THREE.Group(), solid = new THREE.Group(), cell = Math.min(o.w, o.h), cols = Math.max(1, Math.round(o.w / cell)), rows = Math.max(1, Math.round(o.h / cell));
  solid.add(mesh(roundBox(o.w, o.h, 22, 4), toon(p.accentLight), 1.4));
  const braces = [], cw = o.w / cols, ch = o.h / rows, span = Math.hypot(cw - 7, ch - 7), lean = Math.atan2(ch - 7, cw - 7);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -o.w / 2 + (c + 0.5) * cw, y = -o.h / 2 + (r + 0.5) * ch;
    for (const side of [-1, 1]) braces.push(placed(roundBox(span, 3, 2.4, 1.2), x, y, 11, { rz: side * lean }));
  }
  const bolts = [-1, 1].flatMap(sx => [-1, 1].map(sy => placed(sphere, sx * (o.w / 2 - 4), sy * (o.h / 2 - 4), 11, { sx: 2, sy: 2, sz: 1.2 })));
  solid.add(mesh(merged(braces), toon(p.accent), 0.7));
  solid.add(mesh(merged(bolts), toon(p.accentDeep), 0));
  const ghost = new THREE.Mesh(dashedFrame(o.w - 2, o.h - 2, 3, 7), toon(p.ink, { opacity: 0.35 }));
  node.add(solid, ghost);
  node.position.set(o.x + o.w / 2, -(o.y + o.h / 2), 0);
  return { node, update(state) { solid.visible = powered(o, state) === o.on; ghost.visible = !solid.visible; } };
}

function lever(o, p) {
  const node = new THREE.Group(), stick = new THREE.Group(), cx = o.x + o.w / 2, base = o.y + o.h;
  node.add(at(mesh(roundBox(20, 7, 14, 2), toon(p.rockEdge), 1.2), cx, -(base - 3.5)));
  node.add(at(mesh(roundBox(12, 2, 2, 0.8), toon(p.ink), 0), cx, -(base - 4), 7.2));
  stick.add(at(sized(mesh(cylinder, toon(p.ink), 1), 1.6, LEVER_ARM, 1.6), 0, LEVER_ARM / 2));
  const knob = at(sized(mesh(sphere, toon(p.dim), 1.2), 5), 0, LEVER_ARM);
  stick.add(knob);
  stick.position.set(cx, -(base - 6), 0);
  node.add(stick);
  let tilt = null;
  return {
    node,
    update(state) {
      const on = (state.flags & o.bit) !== 0, target = on ? -LEVER_TILT : LEVER_TILT;
      tilt = tilt === null ? target : tilt + (target - tilt) * 0.3;
      stick.rotation.z = tilt;
      knob.material = on ? bright(p.accent) : toon(p.dim);
    },
  };
}

function button(o, p) {
  const node = new THREE.Group(), cap = new THREE.Group(), tall = o.h - 8, r = o.w / 2;
  node.add(at(mesh(roundBox(o.w + 8, 6, 18, 2), toon(p.rockEdge), 1.2), o.x + o.w / 2, -(o.y + o.h - 3)));
  const body = at(mesh(new THREE.CylinderGeometry(r, r, tall, 18), toon(p.accent), 1.2), 0, -tall / 2);
  const top = at(sized(mesh(sphere, toon(p.accent), 0), r * 0.92, 2.6, r * 0.92), 0, 0);
  cap.add(body, top);
  cap.position.set(o.x + o.w / 2, -(o.y + 2), 0);
  node.add(cap);
  return {
    node,
    update(state) {
      const pressed = (state.flags & o.bit) !== 0, colour = pressed ? toon(p.dim) : bright(p.accent);
      cap.scale.y = pressed ? (o.h - 14) / tall : 1;
      cap.position.y = -(o.y + (pressed ? 8 : 2));
      body.material = top.material = colour;
    },
  };
}

function plate(o, p) {
  const node = new THREE.Group(), pad = mesh(roundBox(o.w, o.h - 2, 20, 2), toon(p.accentLight), 1.1);
  node.add(at(mesh(roundBox(o.w + 6, 2.5, 22, 1), toon(p.rockEdge), 1), o.x + o.w / 2, -(o.y + o.h - 1.25)));
  node.add(pad);
  return {
    node,
    update(state) {
      const down = (state.pressed & o.bit) !== 0, tall = o.h - (down ? 4 : 2);
      pad.scale.y = tall / (o.h - 2);
      pad.position.set(o.x + o.w / 2, -(o.y + (down ? 3 : 0) + tall / 2), 0);
      pad.material = down ? toon(p.accent, { emissive: 0.5 }) : toon(p.accentLight);
    },
  };
}

const always = build => () => build;

export const MACHINES = { door: always(door), toggle: always(toggle), lever: always(lever), switch: always(button), plate: always(plate) };
