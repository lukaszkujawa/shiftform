import { overlaps, wrap } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { bodyRects } from '../world/bodies.js';
import { hashString } from '../world/rng.js';
import { tint } from '../art/themes.js';
import { THREE, colorOf, toon, glowing, mesh, shape, roundBox, placed, merged, sphere, cone, cylinder } from './toon.js';
import { inked } from './mech-kit.js';
import { still, at, sized, centre } from './kit.js';
import { MACHINES } from './mech-machines.js';
import { HAZARDS } from './mech-hazards.js';
import { RIGGING } from './mech-rigging.js';

const WHITE = 'hsl(0 0% 100% / 1)';
const SHADOW = 'hsl(240 35% 8% / 1)';
const WIND_COLOR = 'hsl(190 85% 88% / 1)';
const WIND_LANE = 20;
const WIND_GAP = 36;
const BELT = 5;
const CLEAT_GAP = 9;
const TAU = Math.PI * 2;

const variant = (o, n) => hashString(`${o.id}:${Math.round(o.x)}:${Math.round(o.y)}`) % n;

function touchClock(o, pad) {
  let last = -1e9;
  return (level, state, time) => {
    const { w, h } = playerSize(level.rules), zone = { x: o.x - pad, y: o.y - pad, w: o.w + pad * 2, h: o.h + pad * 2 };
    if (overlaps(state.x, state.y, w, h, zone) || bodyRects(level, state.bodies).some(b => overlaps(b.x, b.y, b.w, b.h, zone))) last = time;
    const since = (time - last) / 1000;
    return since < 0.7 ? Math.exp(-since * 5) * Math.cos(since * 28) : 0;
  };
}

const quantized = (value, steps = 8) => Math.round(Math.max(0, Math.min(1, value)) * steps) / steps;

const chevron = () => merged([-1, 1].map(side => placed(roundBox(7, 2.4, 2.4, 1), -1.2, side * 2.4, 0, { rz: side * -0.72 })));

function beltPoint(left, right, cy, radius, along) {
  const run = right - left, bend = Math.PI * radius;
  if (along < run) return [left + along, cy - radius, -Math.PI / 2];
  if (along < run + bend) { const a = -Math.PI / 2 + (along - run) / radius; return [right + Math.cos(a) * radius, cy + Math.sin(a) * radius, a]; }
  if (along < 2 * run + bend) return [right - (along - run - bend), cy + radius, Math.PI / 2];
  const a = Math.PI / 2 + (along - 2 * run - bend) / radius;
  return [left + Math.cos(a) * radius, cy + Math.sin(a) * radius, a];
}

function conveyor(o, p) {
  const r = o.h / 2, cy = o.y + r, left = o.x + r, right = o.x + o.w - r, radius = r - BELT / 2, loop = 2 * (right - left) + TAU * radius;
  const node = new THREE.Group();
  node.add(at(mesh(roundBox(o.w, o.h, 22, r, 4), toon(tint(p.rockDeep, 0, -8)), 1.3), o.x + o.w / 2, -cy));
  const rivets = [];
  for (let x = left + 18; x < right - 9; x += 36) rivets.push(placed(sphere, x, -cy, 11.4, { sx: 1.8, sy: 1.8, sz: 0.8 }));
  node.add(mesh(merged([placed(roundBox(right - left, o.h - 2 * BELT, 2, 1), (left + right) / 2, -cy, 11), ...rivets]), toon(p.rock), 0));
  const rollers = [left, right].map(x => {
    const roller = new THREE.Group();
    roller.add(mesh(shape(`roller:${r}`, () => new THREE.CylinderGeometry(r - BELT, r - BELT, 24, 16).rotateX(Math.PI / 2)), toon(p.rockDeep), 1));
    roller.add(mesh(shape(`spokes:${r}`, () => merged([0, 1, 2].map(k => placed(roundBox((r - BELT) * 0.9, 1.6, 1.6, 0.6), Math.cos((k * TAU) / 3) * (r - BELT) * 0.45, Math.sin((k * TAU) / 3) * (r - BELT) * 0.45, 12.4, { rz: (k * TAU) / 3 })).concat(placed(sphere, 0, 0, 12.4, { sx: 2.5, sy: 2.5, sz: 1 })))), toon(p.rockEdge), 0));
    node.add(at(roller, x, -cy));
    return roller;
  });
  const count = Math.ceil(loop / CLEAT_GAP) + 1, cleats = new THREE.InstancedMesh(shape('cleat', () => roundBox(1.8, 3.6, 23, 0.7)), toon(p.rockEdge), count);
  cleats.frustumCulled = false;
  node.add(cleats);
  const pose = new THREE.Object3D();
  return {
    node,
    update(state) {
      const travel = state.clock * o.speed;
      for (const roller of rollers) roller.rotation.z = -travel / radius;
      let k = 0;
      for (let along = wrap(travel, CLEAT_GAP); along < loop && k < count; along += CLEAT_GAP, k++) {
        const [x, y, a] = beltPoint(left, right, cy, radius + 1, along);
        pose.position.set(x, -y, 0);
        pose.rotation.z = -a - Math.PI / 2;
        pose.updateMatrix();
        cleats.setMatrixAt(k, pose.matrix);
      }
      cleats.count = k;
      cleats.instanceMatrix.needsUpdate = true;
    },
  };
}

function bumper(o, p, level) {
  const node = new THREE.Group(), body = new THREE.Group(), n = 2 + variant(o, 2);
  body.add(sized(mesh(sphere, toon(p.accent, { emissive: 0.15 }), 1.3), 11, 11, 9));
  body.add(mesh(shape('bumper-rim', () => new THREE.TorusGeometry(11.5, 2.2, 8, 28)), toon(p.accentDeep), 1));
  body.add(at(sized(mesh(sphere, glowing(WHITE, 0.7), 0), 2.2, 1.6, 1), -5, 5.5, 8));
  const arrows = Array.from({ length: n }, () => {
    const arrow = mesh(shape('chevron', chevron), toon(WHITE), 0.9);
    arrow.scale.x = o.dir;
    body.add(arrow);
    return arrow;
  });
  const ring = mesh(shape('bumper-ring', () => new THREE.TorusGeometry(1, 0.08, 6, 32)), glowing(p.accent), 0);
  node.add(body, ring);
  node.position.set(...centre(o));
  const kicked = touchClock(o, 4);
  return {
    node,
    update(state, time) {
      const hit = kicked(level, state, time);
      body.scale.setScalar(1 + 0.06 * Math.sin(time / 300 + o.x) + Math.max(0, hit) * 0.25);
      const slide = ((time / 160) % 6) * o.dir;
      arrows.forEach((arrow, k) => {
        const x = -6 + ((k * 6 + slide + 60) % (n * 6)) - 3;
        arrow.position.set(x + 2 * o.dir, 0, 9.5);
        arrow.scale.setScalar(0.55 + 0.45 * (1 - Math.min(1, Math.abs(x + 2) / 9)));
        arrow.scale.x *= o.dir;
      });
      ring.visible = hit > 0.05;
      if (ring.visible) {
        ring.material = glowing(p.accent, quantized(hit, 6) || 0.15);
        ring.scale.setScalar(14 + (1 - hit) * 14);
      }
    },
  };
}

function gravpad(o, p) {
  const node = new THREE.Group(), magnet = new THREE.Group(), cx = o.x + o.w / 2;
  node.add(at(mesh(roundBox(o.w + 6, o.h, 22, 2), toon(p.accentDeep), 1.2), cx, -(o.y + o.h / 2)));
  const horseshoe = shape('magnet', () => merged([
    placed(new THREE.TorusGeometry(6.5, 2.6, 8, 16, Math.PI), 0, 12, 0, { rz: Math.PI }),
    ...[-1, 1].map(side => placed(cylinder, side * 6.5, 15, 0, { sx: 2.6, sy: 6, sz: 2.6 })),
  ]));
  const tips = shape('magnet-tips', () => merged([-1, 1].map(side => placed(cylinder, side * 6.5, 20, 0, { sx: 2.9, sy: 4, sz: 2.9 }))));
  magnet.add(mesh(horseshoe, toon(p.accent, { emissive: 0.25 }), 1.2), mesh(tips, toon(WHITE), 1.2));
  const waves = Array.from({ length: 3 }, () => {
    const wave = mesh(shape('wave', () => chevron().rotateZ(Math.PI / 2)), glowing(p.accent), 0);
    magnet.add(wave);
    return wave;
  });
  magnet.position.set(cx, -(o.dir < 0 ? o.y : o.y + o.h), 0);
  magnet.scale.y = -o.dir;
  node.add(magnet);
  return {
    node,
    update(state, time) {
      waves.forEach((wave, k) => {
        const away = (time / 30 + k * 10) % 30;
        wave.position.y = 25 + away;
        wave.material = glowing(p.accent, quantized(0.9 - away / 36, 6) || 0.1);
      });
    },
  };
}

const ellipse = (rx, ry, tube) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, k) => new THREE.Vector3(Math.cos((k / 24) * TAU) * rx, Math.sin((k / 24) * TAU) * ry, 0)), true), 48, tube, 6, true);

function portal(o, p) {
  const node = new THREE.Group(), swirl = new THREE.Group();
  node.add(sized(mesh(shape('disc', () => new THREE.CircleGeometry(1, 28)), glowing(SHADOW, 0.6), 0), 9, 17, 1));
  node.add(mesh(shape('portal-rim', () => ellipse(9, 17, 2.4)), toon(p.accent, { emissive: 0.45 }), 1.2));
  node.add(at(sized(mesh(sphere, glowing(WHITE, 0.8), 0), 1.4), -6, 11, 2.6));
  swirl.add(at(mesh(shape('portal-core', () => ellipse(4, 10, 1.3)), glowing(p.accent), 0), 0, 0, 1));
  const arms = shape('portal-arms', () => merged([0, 1, 2].map(k => placed(new THREE.TorusGeometry(5.5, 0.8, 5, 12, Math.PI * 0.7), 0, 0, 0.6, { rz: (k * TAU) / 3 }))));
  swirl.add(sized(mesh(arms, glowing(p.accentLight, 0.85), 0), 1, 1.7, 1));
  node.add(swirl);
  node.position.set(...centre(o));
  return { node, update(state, time) { swirl.rotation.z = -time / 600; } };
}

function start(o, p) {
  const node = new THREE.Group();
  node.add(at(mesh(roundBox(o.w + 12, 6, 22, 3), toon(p.accent, { opacity: 0.5 }), 0), o.x + o.w / 2, -(o.y + 7)));
  node.add(at(sized(mesh(cone, toon(p.accent, { emissive: 0.2 }), 1.2), 7, 12, 4), o.x + o.w / 2, -(o.y - 6)));
  return still(node);
}

function goal(o, p) {
  const node = new THREE.Group(), cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.w / 2 - 4, legs = o.h / 2;
  const frame = merged([
    placed(new THREE.TorusGeometry(r, 2.4, 8, 24, Math.PI), cx, -cy, 0),
    ...[-1, 1].map(side => placed(cylinder, cx + side * r, -(cy + legs / 2), 0, { sx: 2.4, sy: legs, sz: 2.4 })),
    ...[-1, 1].map(side => placed(roundBox(9, 4, 12, 1.5), cx + side * r, -(o.y + o.h - 2), 0)),
  ]);
  node.add(mesh(frame, toon(p.accent, { emissive: 0.4 }), 1.3));
  const fill = new THREE.MeshBasicMaterial({ color: colorOf(p.accent), transparent: true, opacity: 0.2, depthWrite: false });
  const door = new THREE.Shape().moveTo(-r, 0).lineTo(-r, -legs).lineTo(r, -legs).lineTo(r, 0).absarc(0, 0, r, 0, Math.PI, false);
  node.add(at(new THREE.Mesh(new THREE.ShapeGeometry(door, 12), fill), cx, -cy, -2));
  return { node, update(state, time) { fill.opacity = 0.18 + 0.1 * Math.sin(time / 300); } };
}

function cling(o, p) {
  const node = new THREE.Group(), ridges = [];
  node.add(at(mesh(roundBox(o.w, o.h, 38, 2), toon(p.accent, { emissive: 0.15 }), 1), o.x + o.w / 2, -(o.y + o.h / 2), 1));
  for (let y = o.y + 8; y < o.y + o.h - 4; y += 14) ridges.push(placed(roundBox(o.w * 1.25, 2.2, 39.5, 0.8), o.x + o.w / 2, -(y + 3), 1, { rz: -0.75 }));
  if (ridges.length) node.add(mesh(merged(ridges), toon(p.accentDeep), 0));
  return still(node);
}

function wind(o, p) {
  const vertical = o.ay !== 0, flow = vertical ? Math.sign(o.ay) : Math.sign(o.ax);
  const along = vertical ? o.h : o.w, across = vertical ? o.w : o.h, lanes = Math.ceil(across / WIND_LANE), perLane = Math.ceil((along + WIND_GAP) / WIND_GAP) + 1;
  const node = new THREE.Group();
  node.add(at(new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 30), glowing(WIND_COLOR, 0.07)), ...centre(o, -8)));
  const dashes = [];
  for (const side of [0, 1]) for (let a = 0; a < along; a += 12) {
    const c = side ? across - 1 : 1, length = Math.min(6, along - a);
    dashes.push(vertical ? placed(roundBox(1.5, length, 1.5, 0.5), o.x + c, -(o.y + a + length / 2), 0) : placed(roundBox(length, 1.5, 1.5, 0.5), o.x + a + length / 2, -(o.y + c), 0));
  }
  if (dashes.length) node.add(new THREE.Mesh(merged(dashes), glowing(WIND_COLOR, 0.6)));
  const arrow = shape('wind-arrow', () => merged([-1, 1].map(side => placed(roundBox(8, 2.2, 2.2, 1), -2.4, side * 2.6, 0, { rz: side * -0.7 }))));
  const backing = shape('wind-arrow-back', () => merged([-1, 1].map(side => placed(roundBox(9.5, 4.2, 1, 2), -2.4, side * 2.6, -1.4, { rz: side * -0.7 }))));
  const count = lanes * perLane, streaks = [toon(WIND_COLOR, { emissive: 0.6 }), toon(p.ink, { opacity: 0.35 })].map((material, k) => {
    const instanced = new THREE.InstancedMesh(k ? backing : arrow, material, count);
    instanced.frustumCulled = false;
    node.add(instanced);
    return instanced;
  });
  const pose = new THREE.Object3D(), heading = vertical ? (flow < 0 ? Math.PI / 2 : -Math.PI / 2) : flow < 0 ? Math.PI : 0;
  const point = (a, c) => (vertical ? [o.x + c, flow < 0 ? o.y + o.h - a : o.y + a] : [flow < 0 ? o.x + o.w - a : o.x + a, o.y + c]);
  return {
    node,
    update(state, time) {
      let k = 0;
      for (let lane = 0; lane < lanes; lane++) {
        const c = WIND_LANE / 2 + lane * WIND_LANE;
        for (let n = 0; n < perLane; n++) {
          const a = ((time / 4 + lane * 23 + n * WIND_GAP) % (along + WIND_GAP)) - WIND_GAP / 2, fade = Math.min(1, a / 8, (along - a + 2) / 8);
          if (fade <= 0 || c > across) continue;
          const [x, y] = point(a, c);
          pose.position.set(x, -y, -2);
          pose.rotation.z = heading;
          pose.scale.setScalar(fade);
          pose.updateMatrix();
          for (const streak of streaks) streak.setMatrixAt(k, pose.matrix);
          k++;
        }
      }
      for (const streak of streaks) { streak.count = k; streak.instanceMatrix.needsUpdate = true; }
    },
  };
}

const always = build => () => build;
const signalled = build => (o, p, level, theme) => build(o, inked(p, o), level, theme);

export const MECHANISMS = Object.fromEntries(Object.entries({
  conveyor: always(conveyor), bumper: always(bumper), gravpad: always(gravpad), portal: always(portal), start: always(start), goal: always(goal),
  cling: always(cling), wind: always(wind), ...MACHINES, ...HAZARDS, ...RIGGING,
}).map(([type, pick]) => [type, (o, theme) => { const build = pick(o, theme); return build && signalled(build); }]));
