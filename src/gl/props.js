import { objectRect, phaseOn, cycleAt, overlaps, slain, crushed, erased } from '../world/level.js?v=3328ffe';
import { playerSize, cannonAim } from '../world/physics.js?v=3328ffe';
import { laserBeam } from '../world/bodies.js?v=3328ffe';
import { COIN_COLOR, REFILL_COLOR } from '../art/icons.js?v=3328ffe';
import { tint, shade } from '../art/themes.js?v=3328ffe';
import { spikeLook } from '../art/hazard-art.js?v=3328ffe';
import { THREE, colorOf, toon, glowing, mesh, shape, roundBox, box, placed, merged, sphere, pebble, cone, cylinder, gem, shining, extrude, featured } from './toon.js?v=3328ffe';
import { createMonster, CREATURES } from './critters.js?v=3328ffe';
import { MECHANISMS } from './mechanisms.js?v=3328ffe';
import { PICKUPS } from './pickups.js?v=3328ffe';
import { still, centre, at, sized } from './kit.js?v=3328ffe';
import { waterMaterial, lavaMaterial, shimmerMaterial } from './surfaces.js?v=3328ffe';

const LOOK = {
  wood: 'hsl(32 58% 52% / 1)', earth: 'hsl(26 46% 42% / 1)', crack: 'hsl(24 42% 24% / 1)',
  steel: 'hsl(210 12% 78% / 1)', steelDark: 'hsl(215 14% 45% / 1)', bramble: 'hsl(110 45% 26% / 1)', pole: 'hsl(28 30% 30% / 1)',
  white: 'hsl(0 0% 100% / 1)', coinEdge: 'hsl(40 90% 42% / 1)',
};


function coin(o) {
  const node = new THREE.Group();
  const face = mesh(shape('coin', () => new THREE.CylinderGeometry(7, 7, 2.6, 24).rotateX(Math.PI / 2)), toon(COIN_COLOR, { emissive: 0.25 }), 1);
  const ring = mesh(shape('coin-ring', () => new THREE.TorusGeometry(4, 0.8, 6, 18).translate(0, 0, 1.4)), toon(LOOK.coinEdge), 0);
  node.add(face, ring);
  node.position.set(...centre(o));
  return {
    node,
    update(state, time) {
      node.visible = !(state.coins & (1 << o.slot));
      node.rotation.y = time / 180 + o.x / 40;
      node.position.y = -(o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 2);
    },
  };
}

const pyramid = new THREE.ConeGeometry(1, 1, 4);

const SPIKE_LOOKS = {
  thorns(node, p, along, reach, n, pitch) {
    const thorns = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) thorns.push(placed(cone, (i + 0.5) * pitch - along / 2 + (row ? pitch * 0.25 : 0), reach / 2, row ? -8 : 6, { sx: pitch * 0.42, sy: reach * (row ? 0.85 : 1), sz: pitch * 0.42 }));
    node.add(mesh(merged(thorns), toon(p.hazard), 1), mesh(merged([0, -8].map(z => placed(cylinder, 0, 1.5, z, { sx: 3, sy: along, sz: 3, rz: Math.PI / 2 }))), toon(LOOK.bramble), 1));
  },
  blades(node, p, along, reach, n, pitch) {
    const blades = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) blades.push(placed(pyramid, (i + 0.5) * pitch - along / 2 + (row ? pitch * 0.25 : 0), reach / 2, row ? -8 : 6, { sx: pitch * 0.55, sy: reach, sz: pitch * 0.3, ry: Math.PI / 4 }));
    node.add(mesh(merged(blades), toon(p.hazard), 1), mesh(placed(roundBox(along, 3, 20, 1, 1), 0, 1.5, -1), toon(LOOK.steelDark), 1));
  },
  shards(node, p, along, reach, n, pitch) {
    const shards = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
      const tall = reach * (0.65 + 0.35 * Math.abs(Math.sin(along + i * 2.4 + row))), lean = Math.sin(along * 0.7 + i * 1.7 + row) * 0.3;
      shards.push(placed(gem, (i + 0.5) * pitch - along / 2 + (row ? pitch * 0.3 : 0), tall * 0.45, row ? -8 : 5, { sx: pitch * 0.32, sy: tall * 0.6, sz: pitch * 0.32, rz: lean }));
    }
    node.add(mesh(merged(shards), toon(p.hazard, { emissive: 0.25 }), 1));
  },
  lava(node, p, along, reach) {
    node.add(shining(mesh(placed(roundBox(along, reach * 0.55, 22, 4, 2), 0, reach * 0.27, -2), lavaMaterial(p.hazard, tint(p.hazard, 25, 22), shade(p.hazard, -45)), 1), p.hazard, { power: 1.2, reach: 130 }));
    const haze = new THREE.Mesh(shape(`haze:${along}:${reach}`, () => new THREE.PlaneGeometry(along, reach * 2.6).translate(0, reach * 1.85, 6)), shimmerMaterial(tint(p.hazard, 20, 15)));
    haze.userData.overlay = true;
    node.add(haze);
    const bubbles = Array.from({ length: Math.max(1, Math.round(along / 22)) }, (_, k) => {
      const bubble = new THREE.Mesh(pebble, glowing(tint(p.hazard, 25, 22)));
      bubble.position.set(-along / 2 + 6 + k * 22, 0, 4);
      node.add(bubble);
      return bubble;
    });
    return time => bubbles.forEach((bubble, k) => {
      const age = (time / 900 + k * 0.37) % 1;
      bubble.position.y = reach * 0.4 + age * 9;
      bubble.scale.setScalar(2.6 * (1 - age));
    });
  },
  ooze(node, p, along, reach, n, pitch) {
    const blobs = new THREE.Group();
    for (let i = 0; i <= n * 2; i++) blobs.add(mesh(pebble, toon(p.hazard, { emissive: 0.15 }), i % 2 ? 0 : 1).translateX(-along / 2 + (i * pitch) / 2).translateZ(-3 + (i % 3) * 3));
    node.add(blobs);
    for (let i = 0; i < n; i += 2) {
      const shine = new THREE.Mesh(pebble, glowing(LOOK.white, 0.5));
      shine.position.set(-along / 2 + (i + 0.5) * pitch, reach * 0.55, 8);
      shine.scale.setScalar(1.6);
      node.add(shine);
    }
    return time => blobs.children.forEach((blob, i) => {
      const swell = Math.sin(time / 350 + i * 1.9 + along) * 0.18;
      blob.scale.set(pitch * 0.55, reach * (i % 2 ? 0.75 : 0.5) * (1 + swell), 9);
    });
  },
  arcs(node, p, along, reach, n, pitch) {
    node.add(mesh(placed(roundBox(along, 4, 20, 1, 1), 0, 2, -1), toon(tint(p.hazard, 0, -20)), 1));
    for (let i = 0; i < n; i++) node.add(mesh(placed(cylinder, (i + 0.5) * pitch - along / 2, 5, -1, { sx: 1.4, sy: 6, sz: 1.4 }), toon(LOOK.steel), 0.8));
    const points = new Float32Array(n * 6 * 3), bolt = new THREE.BufferGeometry();
    bolt.setAttribute('position', new THREE.BufferAttribute(points, 3));
    node.add(new THREE.LineSegments(bolt, new THREE.LineBasicMaterial({ color: colorOf(p.hazard) })));
    let shown = -1;
    return time => {
      const tick = Math.floor(time / 70);
      if (tick === shown) return;
      shown = tick;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * pitch - along / 2, jag = k => Math.sin((tick + i * 7) * 12.9898 + k * 78.2) * 4;
        const path = [[x, 0], ...[1, 2, 3].map(k => [x + jag(k), (reach * k) / 3])];
        for (let k = 0; k < 3; k++) points.set([...path[k], 0, ...path[k + 1], 0], (i * 6 + k * 2) * 3);
      }
      bolt.attributes.position.needsUpdate = true;
    };
  },
};

function spikes(o, p, level, theme) {
  const along = o.side ? o.h : o.w, reach = o.side ? o.w : o.h, n = Math.max(1, Math.round(along / 12)), pitch = along / n;
  const node = new THREE.Group(), animate = SPIKE_LOOKS[spikeLook(theme)](node, p, along, reach, n, pitch);
  node.rotation.z = o.side ? -o.side * Math.PI / 2 : o.dir > 0 ? Math.PI : 0;
  const base = o.side ? { x: o.side > 0 ? o.x : o.x + o.w, y: o.y + o.h / 2 } : { x: o.x + o.w / 2, y: o.dir > 0 ? o.y : o.y + o.h };
  node.position.set(base.x, -base.y, 0);
  return { node, update: animate ? (state, time) => animate(time) : null };
}

const SAW_TEETH = 14;

const sawBlade = r => shape(`saw-blade:${r}`, () => extrude(outline => {
  for (let k = 0; k < SAW_TEETH; k++) {
    const a = (k / SAW_TEETH) * Math.PI * 2, step = (Math.PI * 2) / SAW_TEETH, at = (radius, angle) => [Math.cos(angle) * radius, Math.sin(angle) * radius];
    outline[k ? 'lineTo' : 'moveTo'](...at(r * 0.78, a));
    outline.lineTo(...at(r, a + step * 0.62));
    outline.lineTo(...at(r * 0.84, a + step * 0.7));
  }
  outline.closePath();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, hole = new THREE.Path();
    hole.absarc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.11, 0, Math.PI * 2, true);
    outline.holes.push(hole);
  }
}, 4, { bevel: 1.3, curveSegments: 6 }));

function sawTrack(o) {
  const from = [o.x + o.w / 2, -(o.y + o.h / 2)], length = Math.hypot(o.dx, o.dy), angle = Math.atan2(-o.dy, o.dx);
  const track = new THREE.Group();
  track.add(mesh(roundBox(length + 8, 5, 5, 2.4), toon(LOOK.steelDark), 1.2));
  for (const end of [-1, 1]) track.add(at(mesh(shape('saw-mount', () => new THREE.CylinderGeometry(5, 5, 6, 16).rotateX(Math.PI / 2)), toon(LOOK.steel), 1.2), (end * (length + 8)) / 2, 0, 0));
  track.position.set(from[0] + o.dx / 2, from[1] - o.dy / 2, -12);
  track.rotation.z = angle;
  return track;
}

function saw(o, p) {
  const node = new THREE.Group(), blade = new THREE.Group(), r = o.w / 2;
  blade.add(mesh(sawBlade(r), toon(LOOK.steel), 1.2));
  blade.add(mesh(shape(`saw-ring:${r}`, () => new THREE.TorusGeometry(r * 0.66, r * 0.05, 6, 32)), toon(LOOK.steelDark), 0).translateZ(2.4));
  blade.add(mesh(shape(`saw-hub:${r}`, () => new THREE.CylinderGeometry(r * 0.28, r * 0.32, 6, 18).rotateX(Math.PI / 2)), toon(p.hazard), 1.1));
  blade.add(sized(at(mesh(sphere, toon(LOOK.steel), 0.8), 0, 0, 3.4), r * 0.13, r * 0.13, r * 0.07));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    blade.add(sized(at(mesh(pebble, toon(LOOK.steelDark), 0), Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, 3.2), 1.1, 1.1, 0.8));
  }
  node.add(blade);
  if (o.dx || o.dy) node.add(sawTrack(o));
  return {
    node,
    update(state, time, level) {
      blade.position.set(...centre(objectRect(o, state.clock)));
      blade.rotation.z = -state.clock * 0.25;
      blade.scale.y = crushed(level, state, o) ? 0.2 : 1;
    },
  };
}

function mine(o, p) {
  const node = new THREE.Group(), r = o.w / 2;
  const spines = Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2;
    return placed(cone, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, (k % 2 ? 0.5 : -0.5) * r, { sx: r * 0.22, sy: r * 0.55, sz: r * 0.22, rz: a - Math.PI / 2 });
  });
  const ball = mesh(sphere, toon(tint(p.hazard, 0, -20)), 1.2);
  ball.scale.setScalar(r * 0.75);
  const light = mesh(sphere, glowing(p.hazard), 0);
  light.scale.setScalar(r * 0.22);
  light.position.set(0, 0, r * 0.72);
  node.add(ball, mesh(merged(spines), toon(LOOK.steelDark), 1), light);
  return {
    node,
    update(state) {
      node.position.set(...centre(objectRect(o, state.clock)));
      node.rotation.y = state.clock * 0.02;
      light.visible = Math.floor(state.clock / 20) % 2 === 0;
    },
  };
}

function spring(o, p, level) {
  const up = (o.dir ?? -1) < 0, node = new THREE.Group(), coils = new THREE.Group();
  for (let k = 0; k < 4; k++) coils.add(mesh(shape(`coil:${o.w}`, () => new THREE.TorusGeometry(o.w * 0.32, 1.6, 6, 16).rotateX(Math.PI / 2)), toon(LOOK.steel), 0.8));
  const pad = mesh(shape(`pad:${o.w}`, () => roundBox(o.w + 4, 5, 18, 2)), toon(p.accent), 1.2);
  node.add(coils, pad);
  node.position.set(o.x + o.w / 2, -(up ? o.y + o.h : o.y), 0);
  node.scale.y = up ? 1 : -1;
  let kicked = -1e9;
  return {
    node,
    update(state, time) {
      const { w, h } = playerSize(level.rules);
      if (overlaps(state.x, state.y, w, h, { x: o.x - 4, y: o.y - 4, w: o.w + 8, h: o.h + 8 })) kicked = time;
      const since = (time - kicked) / 1000, kick = since < 0.7 ? Math.exp(-since * 5) * Math.cos(since * 28) : 0;
      const tall = o.h * (1 - Math.max(0, kick) * 0.5 - 0.03 * Math.sin(time / 400 + o.x));
      coils.children.forEach((coil, k) => { coil.position.y = ((k + 0.5) / coils.children.length) * tall; });
      pad.position.y = tall + 2.5;
    },
  };
}

function checkpoint(o, p) {
  const node = new THREE.Group(), x = o.x + 5, top = o.y + 4, tall = o.y + o.h - top;
  const pole = mesh(cylinder, toon(LOOK.pole), 1);
  pole.scale.set(1.3, tall, 1.3);
  pole.position.set(x, -(top + tall / 2), 0);
  const knob = mesh(sphere, toon(COIN_COLOR), 0.8);
  knob.scale.setScalar(2.4);
  knob.position.set(x, -top, 0);
  const cloth = new THREE.PlaneGeometry(16, 12, 8, 1).translate(8, -6, 0), rest = cloth.attributes.position.array.slice();
  const colours = [p.dim, p.accent].map(css => { const m = toon(css).clone(); m.side = THREE.DoubleSide; return m; });
  const flag = new THREE.Mesh(cloth, colours[0]);
  flag.position.set(x, -top, 0);
  node.add(pole, knob, flag);
  return {
    node,
    update(state, time, level, view) {
      const touched = !!view.touched?.includes(o.id), pos = cloth.attributes.position;
      flag.material = colours[+touched];
      for (let i = 0; i < pos.count; i++) {
        const x0 = rest[i * 3];
        pos.array[i * 3 + 1] = rest[i * 3 + 1] - (touched ? 0 : x0 * 0.12);
        pos.array[i * 3 + 2] = Math.sin(time / 180 + o.x + x0 * 0.35) * x0 * 0.18;
      }
      pos.needsUpdate = true;
      cloth.computeVertexNormals();
    },
  };
}

function crumble(o) {
  const node = new THREE.Group(), cracks = [];
  for (let x = 10; x < o.w; x += 22) cracks.push(placed(roundBox(2, o.h * 0.7, 2, 0.8), x - o.w / 2, 0, 11, { rz: 0.4 }));
  node.add(mesh(shape(`crumble:${o.w}:${o.h}`, () => roundBox(o.w, o.h, 22, 4)), toon(LOOK.earth), 1.3));
  if (cracks.length) node.add(mesh(merged(cracks), toon(LOOK.crack), 0));
  node.position.set(...centre(o));
  return { node, update(state) { node.visible = !state.crumbled[o.slot]; } };
}

function mover(o) {
  const node = mesh(shape(`mover:${o.w}:${o.h}`, () => roundBox(o.w, o.h, 26, 4)), toon(LOOK.wood), 1.3);
  return { node, update(state) { node.position.set(...centre(objectRect(o, state.clock))); } };
}

function phaseBlocks(w, h) {
  const tall = h >= w, count = Math.max(1, Math.round((tall ? h : w) / 30)), step = (tall ? h : w) / count, cell = [tall ? w : step, tall ? step : h];
  return Array.from({ length: count }, (_, k) => [tall ? 0 : -w / 2 + step * (k + 0.5), tall ? h / 2 - step * (k + 0.5) : 0, ...cell]);
}

const corners = (w, h) => merged([-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [
  placed(box, sx * (w / 2 - 3), sy * (h / 2 - 1), 12, { sx: 6, sy: 2, sz: 2 }),
  placed(box, sx * (w / 2 - 1), sy * (h / 2 - 3), 12, { sx: 2, sy: 6, sz: 2 }),
])));

function phase(o, p) {
  const node = new THREE.Group(), cells = phaseBlocks(o.w, o.h);
  const solid = mesh(shape(`phase:${o.w}:${o.h}`, () => merged(cells.map(([x, y, w, h]) => placed(roundBox(w - 2, h - 2, 22, 4), x, y, 0)))), toon(p.accent), 1.3);
  const bolts = new THREE.Mesh(shape(`phase-bolts:${o.w}:${o.h}`, () => merged(cells.map(([x, y]) => placed(gem, x, y, 11.5, { sx: 4, sy: 4, sz: 2 })))), toon(p.accentDeep ?? p.ink));
  const ghost = new THREE.Mesh(solid.geometry, toon(p.accent, { opacity: 0.14 }));
  const brackets = new THREE.Mesh(shape(`phase-corners:${o.w}:${o.h}`, () => corners(o.w, o.h)), toon(p.accent, { opacity: 0.7 }));
  const live = new THREE.Group();
  live.add(solid, bolts);
  node.add(live, ghost, brackets);
  node.position.set(...centre(o));
  return {
    node,
    update(state, time) {
      const on = phaseOn(o, state.clock), t = cycleAt(o, state.clock), soon = on ? o.on - t < 30 : o.period - t < 30, flicker = soon && Math.floor(time / 90) % 2;
      live.visible = on && !flicker;
      live.scale.setScalar(on && soon ? 0.94 : 1);
      ghost.visible = !live.visible;
      brackets.visible = !on;
    },
  };
}

function refill(o) {
  const chevrons = shape('refill', () => merged([-4, 4].flatMap(y => [-1, 1].map(side => placed(roundBox(10, 3.6, 4, 1.6), side * 3.4, y, 0, { rz: side * -0.75 })))));
  const node = mesh(chevrons, toon(REFILL_COLOR, { emissive: 0.3 }), 1);
  node.position.set(...centre(o));
  return {
    node,
    update(state, time) {
      const spent = (state.spent & (1 << o.slot)) !== 0;
      node.material = toon(REFILL_COLOR, spent ? { opacity: 0.25 } : { emissive: 0.3 });
      node.children[0].visible = !spent;
      node.position.y = -(o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 3);
      node.rotation.y = Math.sin(time / 500 + o.x) * 0.5;
    },
  };
}

function ladder(o) {
  const parts = [-1, 1].map(side => placed(cylinder, o.x + o.w / 2 + side * (o.w / 2 - 3), -(o.y + o.h / 2), -14, { sx: 1.8, sy: o.h, sz: 1.8 }));
  for (let y = o.y + 8; y < o.y + o.h; y += 10) parts.push(placed(cylinder, o.x + o.w / 2, -y, -14, { sx: 1.3, sy: o.w - 6, sz: 1.3, rz: Math.PI / 2 }));
  return still(mesh(merged(parts), toon(LOOK.wood), 1));
}

const touching = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

function waterline(o, level) {
  const pools = level.objects.filter(w => w.type === 'water'), joined = new Set([o]);
  for (const a of joined) for (const b of pools) if (touching(a, b)) joined.add(b);
  return Math.min(...[...joined].map(w => w.y));
}

const besideWater = (o, level, side) => level.objects.some(w => w !== o && w.type === 'water' && w.y < o.y + o.h && w.y + w.h > o.y && (side < 0 ? w.x + w.w === o.x : w.x === o.x + o.w));

function water(o, p, level) {
  const open = [-1, 1].map(side => !besideWater(o, level, side));
  const node = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 62, Math.max(1, Math.round(o.w / 6)), 1, 1).translate(0, -o.h / 2, 0), waterMaterial(o.w, o.y - waterline(o, level), o.surface !== false, open));
  node.position.set(o.x + o.w / 2, -o.y, -11);
  return still(node);
}

function laser(o, p, level) {
  const node = new THREE.Group(), cx = o.x + o.w / 2;
  for (const y of o.steady ? [o.dir > 0 ? o.y + 2.5 : o.y + o.h - 2.5] : [o.y + 4, o.y + o.h - 4]) {
    const emitter = mesh(sphere, toon(p.hazard), 1);
    emitter.scale.setScalar(5);
    emitter.position.set(cx, -y, 0);
    node.add(emitter);
  }
  const beam = new THREE.Mesh(cylinder, glowing(p.hazard, 0.85)), core = new THREE.Mesh(cylinder, glowing(LOOK.white));
  node.add(shining(beam, p.hazard, { power: 1.2, reach: 120 }), core);
  return {
    node,
    update(state) {
      const on = phaseOn(o, state.clock);
      beam.visible = core.visible = on;
      if (!on) return;
      const b = laserBeam(level, o, state.bodies);
      beam.scale.set(b.w / 2, b.h, b.w / 2);
      core.scale.set(1, b.h, 1);
      beam.position.set(b.x + b.w / 2, -(b.y + b.h / 2), 0);
      core.position.copy(beam.position);
    },
  };
}

function cannon(o, p) {
  const node = new THREE.Group(), barrel = new THREE.Group();
  barrel.add(mesh(new THREE.CylinderGeometry(o.h / 2 - 1, o.h / 2 + 1, o.w + 6, 16).rotateZ(Math.PI / 2), toon(LOOK.steelDark), 1.3));
  barrel.add(mesh(new THREE.TorusGeometry(o.h / 2, 2, 8, 16).rotateY(Math.PI / 2).translate(o.w / 2 + 2, 0, 0), toon(p.accent), 0.8));
  node.add(barrel);
  node.position.set(...centre(o));
  return { node, update(state, time) { barrel.rotation.z = -cannonAim(o, state.barrel === o.id ? state.barrelAge : time / 16.67); } };
}

function shot(o, p) {
  const node = mesh(sphere, toon(p.hazard, { emissive: 0.5 }), 1);
  node.scale.setScalar(o.w / 2);
  return {
    node,
    update(state, time, level) {
      const rect = objectRect(o, state.clock);
      node.visible = rect.w > 0 && !slain(state, level.objects[o.source]);
      node.position.set(...centre(rect));
    },
  };
}

function monster(o, p) {
  const creature = createMonster(o, p);
  return { node: creature.group, update: (state, time, level, view) => creature.update(state, time, view.player) };
}

const always = build => () => build;

const BASIC = {
  coin: always(coin), spikes: always(spikes), spring: always(spring), checkpoint: always(checkpoint), mover: always(mover),
  phase: always(phase), gate: always(phase), refill: always(refill), water: always(water), cannon: always(cannon), shot: always(shot), monster: always(monster),
  saw: o => (o.kind === 'mine' ? mine : o.kind ? null : saw),
  crumble: o => (o.kind === 'fuse' ? null : crumble),
  climb: (o, theme) => (o.kind === 'glue' || theme.climb !== 'ladder' ? null : ladder),
  laser: o => (o.kind === 'flame' ? null : laser),
};

const REGISTRY = [BASIC, CREATURES, MECHANISMS, PICKUPS];

const builderOf = (o, theme) => {
  for (const builders of REGISTRY) {
    const build = builders[o.type]?.(o, theme);
    if (build) return build;
  }
  return null;
};

export const modelled = (o, theme) => !!builderOf(o, theme);

export function buildProps(level, palette, theme) {
  const group = new THREE.Group(), parts = [];
  for (const o of level.objects) {
    const build = builderOf(o, theme);
    if (!build) continue;
    const { node, update } = build(o, palette, level, theme);
    group.add(node);
    parts.push({ o, node, update });
  }
  return {
    group,
    update(state, time, view) {
      for (const { o, node, update } of parts) {
        node.visible = !erased(state, o);
        if (!node.visible || !update) continue;
        update(state, time, level, view);
        featured(node);
      }
    },
  };
}
