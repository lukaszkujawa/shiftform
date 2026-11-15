import { THREE, sphere, cone, cylinder, roundBox, tube, extrude } from './toon.js?v=1c29e2a';
import { HUE, PETALS, CROWN, part, cluster, mirrored, horn, star, band, daisy } from './hero-kit.js?v=1c29e2a';

const dome = (color, rx, ry, rz, y = 0) => part(sphere, color, { scale: [rx, ry, rz], at: [0, y, 0], weld: true });
const disc = (color, rx, h, rz, y = 0) => part(cylinder, color, { scale: [rx, h, rz], at: [0, y, 0] });
const ball = (color, r, at, outline = 1) => part(sphere, color, { scale: [r, r, r], at, outline });

export const HATS = {
  cap: () => cluster([
    dome('accent', 10.4, 7, 9, 0.5),
    part(roundBox(12, 1.6, 10, 0.8), 'accent', { at: [2.4, 0.4, 7.6], rot: [0.3, 0.45, 0] }),
    ball('accent', 1.4, [0, 7.4, 0]),
  ]),
  beanie: () => cluster([
    dome('accent', 10.6, 9.5, 9),
    disc('ink', 10.9, 3, 9.3, -1.2),
    ball('player', 3.5, [0, 9.8, 0]),
  ]),
  tophat: () => cluster([
    disc('ink', 12.5, 1.6, 10.5, 0.5),
    disc('ink', 8, 15, 7, 8),
    disc('accent', 8.3, 3, 7.3, 3),
  ]),
  crown: () => cluster([
    disc(HUE.gold, 8.4, 4.5, 7.4, 2.2),
    ...[0, 1, 2, 3, 4].map(k => {
      const a = Math.PI / 2 + (k * Math.PI * 2) / 5, tall = k ? 5 : 7;
      return part(cone, HUE.gold, { scale: [2.6, tall, 2.6], at: [Math.cos(a) * 7.4, 4.4 + tall / 2, Math.sin(a) * 6.4] });
    }),
    ...[-4, 0, 4].map(x => ball(HUE.red, 1.3, [x, 2.2, 7.6 - Math.abs(x) * 0.25], 0.6)),
  ]),
  party: () => cluster([
    part(cone, 'accent', { scale: [7, 18, 7], at: [0, 9, 0] }),
    ...[[-2.4, 3.5], [2.6, 6], [-0.8, 9.5]].map(([x, y]) => ball('player', 1.2, [x, y, 6.4 - y * 0.34], 0)),
    ball('player', 3, [0, 18, 0]),
  ]),
  cowboy: () => cluster([
    part(roundBox(14, 11, 11, 4.5), HUE.brown, { at: [0, 5.5, 0] }),
    part(roundBox(14.4, 2.6, 11.4, 1.2), 'ink', { at: [0, 1.8, 0], outline: 0 }),
    part(sphere, HUE.brown, { scale: [18, 1.6, 14.5], at: [0, 0.4, 0] }),
    ...mirrored(side => part(sphere, HUE.brown, { scale: [5, 1.6, 9], at: [side * 15, 2.4, 0], rot: [0, 0, side * 0.55] })),
    part(roundBox(1.4, 3, 4, 0.6), HUE.brown, { at: [0, 10.4, 3], outline: 0.8 }),
  ]),
  wizard: () => cluster([
    part(sphere, HUE.purple, { scale: [13, 2.4, 11] }),
    cluster([
      part(horn([[0, 0], [0, 12], [-3, 21], [-7.5, 25]], 8.4, 0.08), HUE.purple, { weld: true }),
      part(extrude(path => star(path, 0, 0, 3.4), 0.8, { bevel: 0.3 }), HUE.gold, { at: [0, 7.5, 5.6], rot: [-0.32, 0, 0], outline: 0.8 }),
    ], { rot: [-0.2, 0, 0] }),
  ]),
  viking: () => cluster([
    ...mirrored(side => part(horn([[side * 7, 2], [side * 13, 4], [side * 15.5, 9], [side * 14, 15]], 2.8, 0.12), HUE.ivory, { weld: true })),
    dome(HUE.steel, 9.6, 8.6, 8.8),
    disc(HUE.gold, 9.8, 3, 9, -0.8),
  ]),
  chef: () => cluster([
    disc(HUE.white, 6.2, 7.5, 6, 3.6),
    ...[[-4.5, 10, 0, 4.5], [4.5, 10, 0, 4.5], [0, 13, 0, 5.2], [0, 10, 3, 4], [0, 10, -3, 4]].map(([x, y, z, r]) => ball(HUE.white, r, [x, y, z])),
  ]),
  beret: () => cluster([
    part(sphere, HUE.red, { scale: [10.5, 3.6, 9.6], at: [2, 2.2, 0], rot: [0, 0, 0.18], weld: true }),
    part(cylinder, 'ink', { scale: [0.7, 3, 0.7], at: [2.8, 6.4, 0], outline: 0 }),
  ]),
  bowler: () => cluster([
    part(sphere, 'ink', { scale: [11.5, 1.6, 10], at: [0, 0.3, 0] }),
    dome('ink', 7.5, 8, 7, 0.5),
    disc('accent', 7.8, 2.4, 7.3, 2.8),
  ]),
  halo: () => cluster([part(new THREE.TorusGeometry(8.5, 1.3, 8, 40), HUE.gold, { at: [0, 9.5, 0], rot: [Math.PI / 2 - 0.3, 0, 0], outline: 0, glow: true })]),
  propeller: () => cluster([
    dome('accent', 10.4, 9.2, 9, -1),
    part(sphere, HUE.gold, { scale: [10.6, 9.4, 2.4], at: [0, -1, 0], outline: 0 }),
    part(sphere, HUE.gold, { scale: [2.4, 9.4, 9.2], at: [0, -1, 0], outline: 0 }),
    part(cylinder, 'ink', { scale: [0.7, 4, 0.7], at: [0, 9.6, 0], outline: 0 }),
    cluster([
      ...mirrored(side => part(sphere, HUE.red, { scale: [6, 1, 2.2], at: [side * 6, 0, 0], rot: [side * 0.3, 0, 0] })),
      ball(HUE.red, 1.4, [0, 0, 0], 0.8),
    ], { at: [0, 12, 0], name: 'spin' }),
  ]),
  bunny: () => cluster(mirrored(side => cluster([
    part(sphere, HUE.white, { scale: [3, 10.5, 2.4], weld: true }),
    part(sphere, HUE.pink, { scale: [1.4, 7.4, 1], at: [0, 0.5, 1.8], outline: 0 }),
  ], { at: [side * 3.8, 10.5, 0], rot: [0, 0, -side * 0.15] }))),
  cat: () => cluster(mirrored(side => cluster([
    part(cone, 'base', { scale: [4.2, 9.5, 2.6] }),
    part(cone, HUE.pink, { scale: [2.2, 6, 1], at: [0, -0.8, 1.9], outline: 0 }),
  ], { at: [side * 5.8, 3.4, 0], rot: [0, 0, -side * 0.25] }))),
  flowers: () => cluster([
    part(tube([[-8.6, 0, 1], [-6, 1, 5.4], [0, 1.6, 6.6], [6, 1, 5.4], [8.6, 0, 1]], 0.7), HUE.stem, { outline: 0 }),
    ...[-1.1, -0.36, 0.36, 1.1].map((a, i) => cluster([daisy(PETALS[i], 2)], { at: [Math.sin(a) * 8.2, 1.8 + (i % 2) * 2, Math.cos(a) * 6.6], rot: [0, a, 0] })),
  ]),
  pirate: () => cluster([
    part(extrude(path => {
      path.moveTo(-12.5, 0);
      path.quadraticCurveTo(0, 4.5, 12.5, 0);
      path.lineTo(8.5, 10.5);
      path.quadraticCurveTo(0, 14.5, -8.5, 10.5);
      path.closePath();
    }, 12, { bevel: 1 }), 'ink', { weld: true }),
    part(tube([[-12.2, 0.6, 7.2], [-6, 2.7, 7.4], [0, 3.4, 7.4], [6, 2.7, 7.4], [12.2, 0.6, 7.2]], 0.6), HUE.gold, { outline: 0 }),
    ball(HUE.white, 2.4, [0, 7.2, 7.1], 0),
    ...mirrored(side => ball('ink', 0.6, [side * 0.8, 7.4, 9.1], 0)),
  ]),
  headphones: () => cluster([
    part(new THREE.TorusGeometry(10.8, 1.2, 6, 24, Math.PI), 'ink', { at: [0, -7.7, 0], outline: 0.8 }),
    ...mirrored(side => part(cylinder, 'accent', { scale: [3.8, 3, 3.8], at: [side * 11, -7.9, 0], rot: [0, 0, Math.PI / 2] })),
  ]),
  headband: () => cluster([
    part(band(-3.4 + CROWN, 4.5, 0.7).translate(0, -CROWN, 0), HUE.red, { outline: 0.8 }),
    part(band(-3.4 + CROWN, 1.2, 1.2).translate(0, -CROWN, 0), HUE.white, { outline: 0 }),
    cluster([
      part(sphere, HUE.red, { scale: [5, 1.6, 1.2], at: [-4, 0.4, 0], rot: [0, 0, 0.2] }),
      part(sphere, HUE.red, { scale: [4.5, 1.6, 1.2], at: [-3.6, -1.8, 0], rot: [0, 0, -0.35] }),
    ], { at: [-6.4, -3.2, -3.6], rot: [0, 0.6, 0], name: 'flutter' }),
  ]),
  mohawk: () => cluster([-2, -1, 0, 1, 2].map(i => part(cone, 'accent', { scale: [3, 13 - Math.abs(i) * 2.4, 3.6], at: [0, 5.5 - Math.abs(i) * 1.5, i * 2.8], rot: [i * 0.25, 0, 0] }))),
  fez: () => cluster([
    part(new THREE.CylinderGeometry(4.2, 5.5, 10.5, 16), HUE.red, { at: [0, 5.25, 0] }),
    part(tube([[0, 10.6, 0], [-3.5, 10.8, 0], [-5.2, 8.5, 0], [-5.4, 4.6, 0]], 0.5), HUE.gold, { outline: 0 }),
    ball(HUE.gold, 1.4, [-5.4, 4, 0], 0.6),
  ]),
  hardhat: () => cluster([
    dome(HUE.hardhat, 9.2, 8.2, 8.6),
    part(sphere, HUE.hardhat, { scale: [1.8, 8.8, 9.2], outline: 0.8 }),
    part(sphere, HUE.hardhat, { scale: [11.5, 1.8, 10.5], at: [0, -0.8, 0.6] }),
  ]),
  mortarboard: () => cluster([
    disc('ink', 6.4, 5, 6, 2.4),
    part(roundBox(17, 1.4, 17, 0.5), 'ink', { at: [0, 5.4, 0], rot: [0.5, Math.PI / 4, 0] }),
    part(tube([[0, 6.4, 0], [5, 6.6, 1.2], [10, 5.6, 2.2], [10.6, -1.5, 2.6]], 0.45), HUE.gold, { outline: 0 }),
    ball(HUE.gold, 1.4, [10.6, -2.3, 2.6], 0.6),
  ]),
  santa: () => cluster([
    part(horn([[0, 0], [0, 8], [-4, 14], [-12, 9]], 9.4, 0.12), HUE.red, { weld: true }),
    part(new THREE.TorusGeometry(9.2, 2.1, 8, 28), HUE.white, { at: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0], scale: [1.05, 0.92, 1] }),
    ball(HUE.white, 2.6, [-12.6, 8.4, 0]),
  ]),
  sombrero: () => cluster([
    part(sphere, HUE.straw, { scale: [20, 1.7, 17] }),
    part(new THREE.TorusGeometry(18.5, 1.4, 6, 40), HUE.straw, { at: [0, 1, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.85, 1] }),
    dome(HUE.straw, 6.4, 9.5, 6.2, 1.2),
    disc(HUE.red, 6.4, 2.2, 6.2, 3.4),
  ]),
  bubble: () => cluster([
    part(sphere, 'hsl(200 90% 88% / 0.22)', { scale: [15, 15, 15], at: [0, -9.6, 0], outline: 0 }),
    part(new THREE.TorusGeometry(11.7, 0.7, 6, 16, Math.PI * 0.3), 'hsl(0 0% 100% / 0.75)', { at: [0, -9.6, 10], rot: [0, 0, Math.PI * 0.55], outline: 0, glow: true }),
  ]),
};

export const ACCESSORIES = {
  leaf: () => cluster([
    part(tube([[0, 0], [1, 5], [0, 8]], 0.6), 'ink', { outline: 0 }),
    part(sphere, 'accent', { scale: [5, 2.5, 1.3], at: [4, 9, 0], rot: [0, 0, 0.5] }),
  ]),
  antenna: () => cluster([
    part(cylinder, 'ink', { scale: [0.7, 10, 0.7], at: [0, 5, 0], outline: 0 }),
    ball('accent', 3, [0, 12, 0]),
  ]),
  tuft: () => cluster([
    part(tube([[-3, -1], [-4.6, 5], [-1, 8]], 0.9), 'ink', { outline: 0 }),
    part(tube([[1, -1], [3, 6], [6, 6]], 0.9), 'ink', { outline: 0 }),
  ]),
  bow: () => cluster([
    ...mirrored(side => part(cone, 'accent', { scale: [4.2, 7, 2.4], at: [side * 3.6, 1, 0], rot: [0, 0, side * Math.PI / 2] })),
    ball('accent', 2, [0, 1, 0.4]),
  ]),
  sprout: () => cluster([
    part(cylinder, 'ink', { scale: [0.6, 7, 0.6], at: [0, 3.5, 0], outline: 0 }),
    ...mirrored(side => part(sphere, HUE.sprout, { scale: [4, 2.2, 1.3], at: [side * 3.5, 8, 0], rot: [0, 0, -side * 0.5] })),
  ]),
  horns: () => cluster(mirrored(side => part(horn([[side * 4, -0.5], [side * 7.5, 3], [side * 8.5, 8]], 2.4, 0.1), HUE.red, { weld: true }))),
  unicorn: () => cluster([
    part(cone, HUE.ivory, { scale: [3.2, 15, 3.2], at: [0, 7, 0] }),
    part(tube(Array.from({ length: 25 }, (_, k) => {
      const t = k / 24, a = t * Math.PI * 5, r = 3.1 * (1 - t * 0.85) + 0.2;
      return [Math.cos(a) * r, 0.5 + t * 12, Math.sin(a) * r];
    }), 0.45, { segments: 60 }), HUE.pink, { outline: 0 }),
  ]),
  feather: () => cluster([
    part(sphere, 'accent', { scale: [2.6, 8, 1.3], at: [4, 9, 0], rot: [0, 0, -0.45] }),
    part(tube([[0, 0], [3, 8], [8, 15]], 0.45), 'ink', { outline: 0 }),
  ]),
  flower: () => cluster([
    part(cylinder, HUE.stem, { scale: [0.6, 8, 0.6], at: [0, 4, 0], outline: 0 }),
    cluster([daisy(HUE.white, 2.4)], { at: [0, 11, 0.5] }),
  ]),
  bulb: () => cluster([
    part(sphere, HUE.bulb, { scale: [4.2, 4.2, 4.2], at: [0, 11, 0], glow: true, outline: 0.9 }),
    disc(HUE.steel, 2, 3, 2, 5.6),
  ]),
};

export const HEADWEAR_MOTION = {
  propeller: (node, { frame }) => { node.getObjectByName('spin').rotation.y = frame * 0.5; },
  headband: (node, { frame, sway }) => { node.getObjectByName('flutter').rotation.z = Math.sin(frame / 8) * 0.15 - sway * 0.4; },
};
