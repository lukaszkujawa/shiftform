import { ITEM_COLORS } from '../art/icons.js';
import { signalPalette } from '../art/object-art.js';
import { tint } from '../art/themes.js';
import { THREE, toon, glowing, mesh, shape, roundBox, placed, merged, sphere, pebble, cone, cylinder, faded } from './toon.js';
import { extruded } from './cast-kit.js';
import { sized } from './kit.js';

const WHITE = 'hsl(0 0% 100% / 1)';
const FLAME = 'hsl(45 100% 60% / 1)';
const STEEL = 'hsl(215 14% 45% / 1)';

const heartOutline = path => {
  path.moveTo(0, -9);
  path.bezierCurveTo(-12, 0, -8, 11, 0, 4);
  path.bezierCurveTo(8, 11, 12, 0, 0, -9);
};

const shieldOutline = path => {
  path.moveTo(0, 10);
  for (const [x, y] of [[8, 6], [7, -3], [0, -10], [-7, -3], [-8, 6]]) path.lineTo(x, y);
  path.closePath();
};

const solid = (geometry, css, outline = 1, at = [0, 0, 0]) => {
  const piece = mesh(geometry, toon(css, { emissive: 0.15 }), outline);
  piece.position.set(...at);
  return piece;
};

const ITEM_MODELS = {
  jetpack(color) {
    const node = new THREE.Group(), flames = [];
    node.add(solid(shape('jet-tanks', () => merged([-4.5, 4.5].map(x => placed(roundBox(7, 15, 7, 3.3), x, 1.5, 0)))), color));
    node.add(solid(shape('jet-strap', () => roundBox(18, 3, 8.6, 1.2)), tint(color, 0, -22), 0.8, [0, 4, 0]));
    node.add(solid(shape('jet-nozzles', () => merged([-4.5, 4.5].map(x => placed(new THREE.CylinderGeometry(2.4, 1.6, 2.6, 10), x, -7, 0)))), STEEL, 0.8));
    for (const x of [-4.5, 4.5]) {
      const flame = sized(new THREE.Mesh(cone, glowing(FLAME)), 1.8, 5, 1.8);
      flame.rotation.z = Math.PI;
      flame.position.set(x, -10.5, 0);
      flames.push(flame);
      node.add(flame);
    }
    return { node, animate(time) { flames.forEach((flame, k) => { flame.scale.y = 4.5 + Math.sin(time / 45 + k * 2) * 1.2; }); } };
  },
  boots(color) {
    const node = new THREE.Group();
    node.add(solid(shape('boot', () => merged([placed(roundBox(7, 11, 8, 2.6), -2.5, 3.5, 0), placed(roundBox(14.5, 5.5, 8, 2.6), 0.8, -3.5, 0)])), color));
    node.add(solid(shape('boot-cuff', () => roundBox(8.6, 2.6, 9.4, 1.2)), WHITE, 0.8, [-2.5, 8.6, 0]));
    node.add(solid(shape('boot-treads', () => merged([-8.2, -10.4, -12.6].map(y => placed(roundBox(12, 1.3, 6, 0.6), 1, y, 0)))), WHITE, 0.6));
    return { node };
  },
  shield(color) {
    const node = new THREE.Group(), plate = extruded('shield', shieldOutline, 3, 1.2);
    node.add(solid(plate, color), sized(solid(plate, WHITE, 0.6, [0, 0, 2.4]), 0.45, 0.45, 0.6));
    return { node };
  },
  heart(color) {
    const node = new THREE.Group();
    node.add(solid(extruded('heart', heartOutline, 4, 2.2), color, 1.1), sized(new THREE.Mesh(pebble, faded(WHITE, 0.7)), 1.8, 1.4, 0.6).translateX(-4.5).translateY(3.5).translateZ(4.6));
    return { node };
  },
  bow(color) {
    const node = new THREE.Group();
    node.add(solid(shape('bow-limbs', () => merged([placed(new THREE.TorusGeometry(10, 1.4, 6, 20, Math.PI), -4, 0, 0, { rz: -Math.PI / 2 }), ...[-10, 10].map(y => placed(pebble, -4, y, 0, { sx: 2, sy: 2, sz: 2 }))])), color, 1.1));
    node.add(solid(shape('bow-grip', () => placed(cylinder, 6, 0, 0, { sx: 2.2, sy: 4.5, sz: 2.2 })), tint(color, 0, -24), 0.8));
    node.add(solid(shape('bow-arrow', () => merged([
      placed(cylinder, -4, 0, 0, { sx: 0.45, sy: 20, sz: 0.45 }),
      placed(cylinder, 0.5, 0, 0, { sx: 0.7, sy: 15, sz: 0.7, rz: Math.PI / 2 }),
      placed(cone, 8, 0, 0, { sx: 2.6, sy: 5, sz: 2.6, rz: -Math.PI / 2 }),
      ...[-1, 1].map(side => placed(cone, -6.5, side * 1.6, 0, { sx: 1.2, sy: 3.5, sz: 0.6, rz: Math.PI / 2 - side * 0.6 })),
    ])), WHITE, 0.6));
    return { node };
  },
};

function halo(color) {
  const disc = shape('halo', () => new THREE.CircleGeometry(1, 28)), group = new THREE.Group();
  group.add(sized(new THREE.Mesh(disc, glowing(color, 0.18)), 15), sized(new THREE.Mesh(disc, glowing(color, 0.28)), 10).translateZ(0.5));
  group.position.z = -9;
  return group;
}

function item(o) {
  const color = ITEM_COLORS[o.kind], model = ITEM_MODELS[o.kind](color), node = new THREE.Group(), turn = new THREE.Group();
  turn.add(model.node);
  node.add(halo(color), turn);
  return {
    node,
    update(state, time) {
      node.visible = !(state.taken & (1 << o.slot));
      node.position.set(o.x + o.w / 2, -(o.y + o.h / 2 + Math.sin(time / 280 + o.x) * 3), 0);
      turn.rotation.y = Math.sin(time / 520 + o.x) * 0.5;
      model.animate?.(time);
    },
  };
}

const TOKEN_MODELS = {
  orb(p, ink) {
    const node = new THREE.Group();
    node.add(sized(mesh(sphere, toon(p.accent, { emissive: 0.3 }), 1.2, { ink }), 7));
    node.add(mesh(shape('orb-shade', () => new THREE.SphereGeometry(7.15, 16, 6, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42)), toon(p.accentDeep), 0));
    node.add(sized(new THREE.Mesh(pebble, faded(WHITE, 0.8)), 1.6, 1.6, 0.7).translateX(-2.4).translateY(2.6).translateZ(6.4));
    const ring = mesh(shape('orb-ring', () => new THREE.TorusGeometry(12, 0.9, 6, 36)), toon(p.accent, { emissive: 0.3 }), 0.8, { ink });
    ring.rotation.set(Math.acos(0.3), 0, 0.35, 'ZXY');
    node.add(ring);
    return node;
  },
  timer(p, ink) {
    const node = new THREE.Group();
    node.add(mesh(shape('hourglass-frame', () => merged([
      ...[-9.25, 9.25].map(y => placed(new THREE.CylinderGeometry(8, 8, 2.5, 18), 0, y, 0)),
      ...[0, 1, 2].map(k => placed(cylinder, Math.sin(k * 2.1 + 0.6) * 6.6, 0, Math.cos(k * 2.1 + 0.6) * 6.6, { sx: 0.8, sy: 16, sz: 0.8 })),
    ])), toon(p.accent, { emissive: 0.3 }), 1, { ink }));
    node.add(mesh(shape('hourglass-glass', () => merged([placed(new THREE.CylinderGeometry(6, 1.2, 8, 14), 0, 4, 0), placed(new THREE.CylinderGeometry(1.2, 6, 8, 14), 0, -4, 0)])), toon(p.accentLight, { opacity: 0.45 }), 0));
    node.add(mesh(shape('hourglass-sand', () => placed(new THREE.CylinderGeometry(0.3, 4.6, 4.5, 14), 0, -5.5, 0)), toon(p.accentDeep), 0));
    return node;
  },
  key(p, ink) {
    const node = new THREE.Group();
    node.add(mesh(shape('key', () => merged([
      placed(new THREE.TorusGeometry(3.85, 1.65, 8, 20), 0, 5, 0),
      placed(roundBox(3.2, 11.5, 3.2, 1), 0, -5.25, 0),
      placed(roundBox(3.5, 2.2, 3.2, 0.8), 3.35, -6.6, 0),
      placed(roundBox(2.6, 2.2, 3.2, 0.8), 2.9, -9.9, 0),
    ])), toon(p.accent, { emissive: 0.3 }), 1, { ink }));
    node.add(sized(new THREE.Mesh(pebble, faded(WHITE, 0.8)), 1.3, 1.3, 0.6).translateX(-2.8).translateY(7.2).translateZ(1.8));
    return node;
  },
};

const token = (o, palette, level, theme) => {
  const p = o.bit ? signalPalette(palette, o.bit) : palette, node = TOKEN_MODELS[o.type](p, theme.outline ? p.ink : p.accentDeep);
  return {
    node,
    update(state, time) {
      node.visible = !(state.flags & o.bit);
      node.position.set(o.x + o.w / 2, -(o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3), 0);
      node.rotation.y = Math.sin(time / 640 + o.x) * 0.6;
    },
  };
};

export const PICKUPS = { item: () => item, key: () => token, orb: () => token, timer: () => token };
