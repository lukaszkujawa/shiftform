import { levelIndex } from '../world/level.js?v=7aa3937';
import { afloat, swellPhase } from '../world/bodies.js?v=7aa3937';
import { TOMB } from '../world/tombs.js?v=7aa3937';
import { THREE, toon, mesh, shape, roundBox, placed, merged, sphere, cylinder } from './toon.js?v=7aa3937';
import { dashedFrame } from './mech-kit.js?v=7aa3937';
import { at, sized } from './kit.js?v=7aa3937';

const CRATE_LOOKS = {
  wood: { fill: 'hsl(32 55% 46% / 1)', ink: 'hsl(28 50% 26% / 1)' },
  steel: { fill: 'hsl(210 12% 64% / 1)', ink: 'hsl(212 16% 34% / 1)' },
  stone: { fill: 'hsl(30 6% 38% / 1)', ink: 'hsl(30 8% 20% / 1)' },
};
const CRATE_DEPTH = 26;
const ROCK = 0.05;
const TOMB_FALL = 0.55;
const TOMB_SPIN = 0.3;
const PLACED_Z = -14;
const SHEEN = 'hsl(0 0% 100% / 1)';

function strokes(lines, z, width = 2) {
  return lines.flatMap(line => line.slice(1).map(([x1, y1], k) => {
    const [x0, y0] = line[k];
    return placed(roundBox(Math.hypot(x1 - x0, y1 - y0) + width, width, 1.4, width * 0.4), (x0 + x1) / 2, -(y0 + y1) / 2, z, { rz: -Math.atan2(y1 - y0, x1 - x0) });
  }));
}

function crateDetail(kind, s) {
  const h = s / 2, faces = [CRATE_DEPTH / 2 + 0.4, -CRATE_DEPTH / 2 - 0.4];
  return faces.flatMap(z => {
    if (kind === 'wood') return strokes([[[5 - h, 5 - h], [h - 5, h - 5]], [[3 - h, 5 - h], [h - 3, 5 - h]], [[3 - h, h - 5], [h - 3, h - 5]]], z);
    if (kind === 'steel') return [...[-1, 1].flatMap(sx => [-1, 1].map(sy => placed(sphere, sx * (h - 5), sy * (h - 5), z, { sx: 1.8, sy: 1.8, sz: 0.9 }))), placed(roundBox(s - 14, 2, 1.4, 0.5), 0, 0, z)];
    return strokes([[[0.3 * s - h, 3 - h], [0.45 * s - h, 0.45 * s - h], [0.25 * s - h, 0.7 * s - h]], [[0.45 * s - h, 0.45 * s - h], [0.8 * s - h, 0.6 * s - h]]], z);
  });
}

function crate(kind, s) {
  const look = CRATE_LOOKS[kind], node = new THREE.Group();
  node.add(mesh(shape(`crate:${kind}:${s}`, () => roundBox(s, s, CRATE_DEPTH, kind === 'stone' ? 6 : 3)), toon(look.fill), kind === 'stone' ? 1.6 : 1.3));
  node.add(new THREE.Mesh(shape(`crate-detail:${kind}:${s}`, () => merged(crateDetail(kind, s))), toon(look.ink)));
  if (kind === 'steel') node.add(new THREE.Mesh(shape(`crate-sheen:${s}`, () => merged([1, -1].map(side => placed(roundBox(s - 14, 1, 1, 0.4), 0, -1.6, side * (CRATE_DEPTH / 2 + 0.7))))), toon(SHEEN)));
  return node;
}

export function bodies(level) {
  const crates = levelIndex(level).crates, group = new THREE.Group();
  const models = crates.map(o => crate(o.kind, o.w));
  if (models.length) group.add(...models);
  return {
    group,
    update(state) {
      models.forEach((model, k) => {
        const b = state.bodies[k], crateObject = crates[k];
        model.visible = !!b && !b.gone;
        if (!model.visible) return;
        model.position.set(b.x + crateObject.w / 2, -(b.y + crateObject.w / 2), 0);
        model.rotation.z = k !== state.held && afloat(level, b, crateObject) ? -Math.cos(swellPhase(b, state.clock)) * ROCK : 0;
      });
    },
  };
}

function pool(make) {
  const group = new THREE.Group(), items = [];
  return {
    group,
    each(list, place) {
      while (items.length < list.length) { const item = make(); items.push(item); group.add(item.node ?? item); }
      items.forEach((item, k) => {
        const node = item.node ?? item;
        node.visible = k < list.length;
        if (node.visible) place(item, list[k], k);
      });
    },
  };
}

function tombModel(p) {
  const { w, h } = TOMB, node = new THREE.Group(), slab = w - 6, r = 5;
  const outline = new THREE.Shape().moveTo(-slab / 2, -h / 2).lineTo(slab / 2, -h / 2).lineTo(slab / 2, h / 2 - r).quadraticCurveTo(slab / 2, h / 2, slab / 2 - r, h / 2).lineTo(-slab / 2 + r, h / 2).quadraticCurveTo(-slab / 2, h / 2, -slab / 2, h / 2 - r).closePath();
  node.add(mesh(shape('tomb', () => new THREE.ExtrudeGeometry(outline, { depth: 10, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 2, curveSegments: 4 }).translate(0, 0, -5)), toon(p.edgeDeep), 1.2));
  node.add(at(mesh(shape('tomb-plinth', () => roundBox(w, 3, 16, 1)), toon(p.edgeLight), 1), 0, -h / 2 + 1.5));
  node.add(new THREE.Mesh(shape('tomb-cross', () => merged([placed(roundBox(2, 9, 1.4, 0.5), 0, h / 2 - 7.5, 6.3), placed(roundBox(8, 2, 1.4, 0.5), 0, h / 2 - 6, 6.3)])), toon(p.ink, { opacity: 0.55 })));
  return node;
}

export function tombs(p) {
  const tombPool = pool(() => tombModel(p));
  return {
    group: tombPool.group,
    update(state) {
      tombPool.each(state.tombs, (node, rect) => {
        const age = Math.max(0, state.frame - rect.born), flying = rect.path?.[age];
        const y = rect.path ? (flying?.[1] ?? rect.y) : Math.min(rect.y, rect.from + (TOMB_FALL * age * age) / 2);
        node.position.set((flying?.[0] ?? rect.x) + rect.w / 2, -(y + rect.h / 2), 0);
        node.rotation.z = flying ? -age * TOMB_SPIN : 0;
      });
    },
  };
}

function plank(p, rect) {
  const node = new THREE.Group();
  node.add(mesh(shape(`plank:${rect.w}:${rect.h}`, () => roundBox(rect.w, rect.h, 24, 5)), toon(p.accentLight, { emissive: 0.12 }), 1.3));
  node.add(at(new THREE.Mesh(shape(`plank-dash:${rect.w}:${rect.h}`, () => dashedFrame(rect.w - 4, rect.h - 4, 6, 4)), toon(p.accent)), 0, 0, 12.4));
  return node;
}

function trampoline(p, rect) {
  const node = new THREE.Group(), coils = new THREE.Group();
  for (let k = 0; k < 4; k++) coils.add(mesh(shape(`coil:${rect.w}`, () => new THREE.TorusGeometry(rect.w * 0.32, 1.6, 6, 16).rotateX(Math.PI / 2)), toon(p.accentDeep), 0.8));
  const pad = mesh(shape(`pad:${rect.w}`, () => roundBox(rect.w + 4, 5, 18, 2)), toon(p.accent), 1.2);
  node.add(coils, pad);
  return {
    node,
    place(time) {
      const tall = rect.h * (1 - 0.03 * Math.sin(time / 400 + rect.x));
      coils.children.forEach((coil, k) => { coil.position.y = ((k + 0.5) / coils.children.length) * tall; });
      pad.position.y = tall + 1.5;
    },
  };
}

function ladderGeometry(w, h) {
  return shape(`placed-ladder:${w}:${h}`, () => {
    const parts = [2, w - 2].map(x => placed(cylinder, x - w / 2, -(h - 6) / 2, 0, { sx: 1.6, sy: h + 6, sz: 1.6 }));
    for (let y = 4; y < h; y += 12) parts.push(placed(cylinder, 0, -y, 0, { sx: 1.2, sy: w - 4, sz: 1.2, rz: Math.PI / 2 }));
    return merged(parts);
  });
}

export function placedBlocks(p) {
  const group = new THREE.Group(), made = new Map();
  const model = rect => {
    const key = `${rect.kind}:${rect.x}:${rect.y}:${rect.w}:${rect.h}`;
    if (!made.has(key)) {
      const built = rect.kind === 'ladder' ? { node: at(mesh(ladderGeometry(rect.w, rect.h), toon(p.accent), 1), rect.x + rect.w / 2, -rect.y, PLACED_Z) }
        : rect.kind === 'trampoline' ? trampoline(p, rect) : { node: plank(p, rect) };
      if (rect.kind === 'trampoline') built.node.position.set(rect.x + rect.w / 2, -(rect.y + rect.h), 0);
      if (rect.kind === 'plank') built.node.position.set(rect.x + rect.w / 2, -(rect.y + rect.h / 2), 0);
      group.add(built.node);
      made.set(key, built);
    }
    return made.get(key);
  };
  return {
    group,
    update(state, time) {
      for (const built of made.values()) built.node.visible = false;
      for (const rect of state.placed) {
        const built = model(rect);
        built.node.visible = true;
        built.place?.(time);
      }
    },
  };
}

function flagModel(p) {
  const node = new THREE.Group(), pole = 36;
  node.add(at(sized(mesh(cylinder, toon(p.ink), 1), 1.2, pole, 1.2), 0, -pole / 2));
  node.add(sized(mesh(sphere, toon(p.ink), 0.8), 2.2));
  const cloths = [p.accent, p.accentDeep].map(css => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(Float32Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1), 3));
    const material = toon(css).clone();
    material.side = THREE.DoubleSide;
    const cloth = new THREE.Mesh(geometry, material);
    cloth.frustumCulled = false;
    node.add(cloth);
    return geometry;
  });
  return {
    node,
    wave(w) {
      const [upper, lower] = cloths.map(geometry => geometry.attributes.position);
      upper.array.set([0, 0, 0, 16, -6 - w, 0, 0, -13, 0]);
      lower.array.set([0, -6.5 - w / 2, 0.3, 16, -6 - w, 0.3, 0, -13, 0.3]);
      upper.needsUpdate = lower.needsUpdate = true;
    },
  };
}

export function flags(p) {
  const flagPool = pool(() => flagModel(p));
  return {
    group: flagPool.group,
    update(state, time, level, view, current) {
      flagPool.each(current ? view.planted ?? [] : [], (flag, o) => {
        flag.node.position.set(o.x + 5, -(o.y + 4), 0);
        flag.wave(Math.sin(time / 180 + o.x) * 2);
      });
    },
  };
}
