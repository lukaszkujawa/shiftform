import { THREE, sphere, cone, cylinder, roundBox, tube, extrude } from './toon.js?v=cb728ba';
import { BODY, HUE, PETALS, EYES, MOUTH, NECK, part, cluster, mirrored, onSkin, hug, bezier, horn, rim, roundedRect, star, heart, band } from './hero-kit.js?v=cb728ba';

const LENS = 3.2, FRONT = EYES.z + 1.7, SIDES = [-EYES.x, EYES.x];
const PALE = 'hsl(200 80% 90% / 0.25)';

const lens = (color, x, draw = path => path.absarc(x, EYES.y, LENS, 0, Math.PI * 2)) => part(extrude(draw, 0.3, { bevel: 0 }), color, { at: [0, 0, FRONT], outline: 0 });
const ring = (color, x, draw, radius = 0.55) => part(rim(draw, radius), color, { at: [0, 0, FRONT], outline: 0 });
const circle = (x, r = LENS) => path => path.absarc(x, EYES.y, r, 0, Math.PI * 2);
const box = (x, w, h, r = 1) => path => roundedRect(path, x - w / 2, EYES.y - h / 2, w, h, r);
const bridge = (color, y = EYES.y) => part(tube([[-EYES.x + LENS, y], [0, y + 0.6], [EYES.x - LENS, y]], 0.5), color, { at: [0, 0, FRONT], outline: 0 });
const temples = color => mirrored(side => part(tube([[side * (EYES.x + LENS), EYES.y, FRONT], [side * 9.3, EYES.y + 0.6, 4], [side * 10.2, EYES.y + 1, -1]], 0.45), color, { outline: 0 }));
const pair = (frame, fill, draw, { radius, link = 'ink' } = {}) => cluster([
  ...SIDES.map(x => lens(fill, x, draw(x))),
  ...SIDES.map(x => ring(frame, x, draw(x), radius)),
  link && bridge(link),
  ...temples(frame),
]);
const strokeOf = (points, color, radius, lift = 0.8) => part(tube(points.map(([x, y]) => onSkin(x, y, lift)), radius), color, { outline: 0 });

export const GLASSES = {
  round: () => pair('ink', PALE, x => circle(x)),
  square: () => pair('ink', PALE, x => box(x, LENS * 2, LENS * 1.6)),
  shades: () => pair('ink', 'hsl(240 30% 10% / 0.85)', x => circle(x)),
  monocle: () => cluster([
    lens(PALE, EYES.x),
    ring('ink', EYES.x, circle(EYES.x)),
    part(tube([[EYES.x + LENS * 0.7, EYES.y - LENS * 0.7, FRONT], [EYES.x + LENS * 1.3, EYES.y - LENS * 2.2, FRONT - 0.5], [EYES.x + LENS * 1.1, -9, FRONT - 1.8]], 0.4), HUE.gold, { outline: 0 }),
  ]),
  hearts: () => cluster([...SIDES.map(x => part(extrude(path => heart(path, x, EYES.y - 0.5, LENS * 1.05), 0.8, { bevel: 0.3 }), 'hsl(340 90% 65% / 0.75)', { at: [0, 0, FRONT], outline: 0.8, weld: true })), bridge('ink'), ...temples('ink')]),
  stars: () => cluster([...SIDES.map(x => part(extrude(path => star(path, x, EYES.y, LENS * 1.35), 0.8, { bevel: 0.3 }), 'hsl(48 100% 60% / 0.8)', { at: [0, 0, FRONT], outline: 0.8, weld: true })), ...temples('ink')]),
  threed: () => cluster([
    lens('hsl(0 90% 55% / 0.7)', -EYES.x, box(-EYES.x, LENS * 2, LENS * 1.5, 0.3)),
    lens('hsl(190 90% 55% / 0.7)', EYES.x, box(EYES.x, LENS * 2, LENS * 1.5, 0.3)),
    ...SIDES.map(x => ring(HUE.white, x, box(x, LENS * 2, LENS * 1.5, 0.3), 0.6)),
    bridge(HUE.white),
    ...temples(HUE.white),
  ]),
  visor: () => cluster([part(hug(roundBox(EYES.x * 2 + LENS * 2.6, LENS * 1.5, 1.6, 0.7), 1.6), 'hsl(185 95% 60% / 0.55)', { at: [0, EYES.y, 0], outline: 0.9 })]),
  nerd: () => pair('ink', 'hsl(200 80% 90% / 0.2)', x => box(x, LENS * 2, LENS * 1.7, 0.4), { radius: 0.85 }).add(part(roundBox(2.4, 2.4, 1.6, 0.4), HUE.white, { at: [0, EYES.y + 0.4, FRONT + 0.4], outline: 0.6 })),
  aviators: () => pair(HUE.gold, 'hsl(25 40% 18% / 0.85)', x => path => path.absellipse(x, EYES.y - LENS * 0.2, LENS * 1.05, LENS * 0.9, 0, Math.PI * 2), { link: null }).add(bridge(HUE.gold, EYES.y + LENS * 0.4)),
  cateye: () => {
    const wing = (x, out) => path => {
      path.moveTo(x - out * LENS, EYES.y);
      path.quadraticCurveTo(x, EYES.y - LENS * 1.3, x + out * LENS, EYES.y);
      path.lineTo(x + out * LENS * 1.5, EYES.y + LENS * 0.9);
      path.quadraticCurveTo(x, EYES.y + LENS * 0.9, x - out * LENS, EYES.y);
    };
    return cluster([
      ...SIDES.map((x, i) => lens('hsl(320 80% 85% / 0.3)', x, wing(x, i ? 1 : -1))),
      ...SIDES.map((x, i) => ring('hsl(320 80% 50% / 1)', x, wing(x, i ? 1 : -1), 0.6)),
      bridge('hsl(320 80% 50% / 1)'),
      ...temples('hsl(320 80% 50% / 1)'),
    ]);
  },
  eyepatch: () => cluster([
    part(sphere, 'ink', { scale: [LENS * 1.1, LENS, 0.9], at: [EYES.x, EYES.y, FRONT - 0.6], outline: 0 }),
    strokeOf(Array.from({ length: 9 }, (_, k) => [-10.4 + k * 2.6, 9.1 - k * 1.16]), 'ink', 0.5),
  ]),
  goggles: () => cluster([
    part(band(EYES.y, 4, 0.5), 'hsl(25 90% 55% / 1)', { outline: 0.8 }),
    ...SIDES.map(x => lens('hsl(190 80% 80% / 0.6)', x, circle(x, LENS * 1.1))),
    ...SIDES.map(x => ring('ink', x, circle(x, LENS * 1.1), 0.95)),
  ]),
  masquerade: () => {
    const [a, b] = SIDES, l = LENS, y = EYES.y;
    const mask = extrude(path => {
      path.moveTo(a - l * 1.7, y + l * 1.2);
      path.quadraticCurveTo(0, y + l * 0.4, b + l * 1.7, y + l * 1.2);
      path.quadraticCurveTo(b + l * 1.4, y - l * 1.3, 0, y - l * 0.6);
      path.quadraticCurveTo(a - l * 1.4, y - l * 1.3, a - l * 1.7, y + l * 1.2);
      path.holes = SIDES.map(x => new THREE.Path().absarc(x, y, l * 0.75, 0, Math.PI * 2, true));
    }, 0.8, { bevel: 0.3 });
    return cluster([part(hug(mask, 1.6), HUE.purple, { outline: 0.8, weld: true }), part(sphere, HUE.gold, { scale: [1.6, 1.6, 1.6], at: onSkin(b + l * 1.7, y + l * 1.2, 2), outline: 0.6 })]);
  },
};

const mouthAt = (dx, dy, lift = 0.8) => onSkin(MOUTH.x + dx, MOUTH.y + dy, lift);

export const FACES = {
  moustache: () => cluster(mirrored(side => part(sphere, HUE.hair, { scale: [3.6, 1.9, 1.2], at: mouthAt(side * 3, 1.6, 1.2), rot: [0, 0, -side * 0.35], outline: 0.8, weld: true }))),
  handlebar: () => cluster([strokeOf([...bezier([-7, 4], [-4, -1], [0, 1]), ...bezier([0, 1], [4, -1], [7, 4]).slice(1)].map(([x, y]) => [MOUTH.x + x, MOUTH.y + y]), HUE.hair, 1.1, 1)]),
  beard: () => cluster([part(hug(extrude(path => {
    path.moveTo(-6.8, 4);
    path.quadraticCurveTo(0, -13, 6.8, 4);
    path.quadraticCurveTo(0, -2, -6.8, 4);
  }, 1.6, { bevel: 0.5 }).translate(MOUTH.x, MOUTH.y, 0), 1), HUE.hair, { outline: 0.8, weld: true })]),
  goatee: () => cluster([part(cone, HUE.hair, { scale: [2.6, 5, 1.4], at: mouthAt(0, -4.5, 0.7), rot: [0, 0, Math.PI], outline: 0.7 })]),
  whiskers: () => cluster(mirrored(side => [-2, 0, 2].map(dy => strokeOf([[side * 4, 2 - dy * 0.4], [side * 7.5, 2 - dy * 0.7], [side * 11, 2 - dy]].map(([x, y]) => [MOUTH.x + x, MOUTH.y + y]), 'ink', 0.4, 0.9))).flat()),
  freckles: () => cluster(mirrored(side => [[0, 0], [2.4, 1.2], [1, 2.6]].map(([dx, dy]) => part(sphere, 'hsl(25 60% 45% / 0.8)', { scale: [0.75, 0.75, 0.4], at: onSkin(side * (4.4 + dx), EYES.y - 2.4 - dy, 0.15), outline: 0 }))).flat()),
  fangs: () => cluster(mirrored(side => part(cone, HUE.white, { scale: [1.2, 3, 0.9], at: mouthAt(side * 2.4, -2, 1), rot: [0, 0, Math.PI], outline: 0.6 }))),
  bandana: () => cluster([
    part(hug(extrude(path => {
      path.moveTo(-10.4, 5);
      path.lineTo(10.4, 5);
      path.lineTo(0, -6.7);
      path.closePath();
    }, 0.8, { bevel: 0.3 }).translate(MOUTH.x, MOUTH.y, 0), 1.2), HUE.red, { outline: 0.8, weld: true }),
    ...[[-3, 2], [3, 2], [0, -2]].map(([dx, dy]) => part(sphere, HUE.white, { scale: [0.9, 0.9, 0.4], at: mouthAt(dx, dy, 1.9), outline: 0 })),
  ]),
};

const chest = (dx, dy, lift = 0.8) => onSkin(dx, NECK + dy, lift);
const arc = (width, sag, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n - 0.5; return [t * width, NECK + 2 - (0.25 - t * t) * sag]; });

export const NECKS = {
  scarf: () => cluster([
    part(band(NECK, 5, 0.9), 'accent', { outline: 0.9 }),
    cluster([part(roundBox(4.5, 7.6, 2, 1), 'accent', { at: [0, -3.6, 0], outline: 0.9 })], { at: chest(-6, -1, 1.6), name: 'tail' }),
  ]),
  bowtie: () => cluster([
    ...mirrored(side => part(cone, HUE.red, { scale: [3, 5, 1.8], at: chest(side * 2.6, 0, 1.2), rot: [0, 0, side * Math.PI / 2] })),
    part(sphere, HUE.red, { scale: [1.6, 1.6, 1.2], at: chest(0, 0, 1.6) }),
  ]),
  tie: () => cluster([part(hug(extrude(path => {
    path.moveTo(-2, 2);
    path.lineTo(2, 2);
    path.lineTo(3, -5.3);
    path.lineTo(0, -6.7);
    path.lineTo(-3, -5.3);
    path.closePath();
  }, 0.8, { bevel: 0.3 }).translate(0, NECK, 0), 1), HUE.blue, { outline: 0.8, weld: true })]),
  pearls: () => cluster(arc(16, 8, 6).map(([x, y]) => part(sphere, HUE.ivory, { scale: [1.7, 1.7, 1.7], at: onSkin(x, y, 1.2), outline: 0.8 }))),
  neckerchief: () => cluster([part(hug(extrude(path => {
    path.moveTo(-8, 2.8);
    path.lineTo(8, 2.8);
    path.lineTo(0, -7);
    path.closePath();
  }, 0.8, { bevel: 0.3 }).translate(0, NECK - 0.8, 0), 1), 'accent', { outline: 0.8, weld: true })]),
  medal: () => cluster([
    strokeOf([[-5, NECK + 3], [-2.5, NECK - 0.5], [0, NECK - 4]], HUE.blue, 0.9),
    strokeOf([[5, NECK + 3], [2.5, NECK - 0.5], [0, NECK - 4]], HUE.blue, 0.9),
    part(cylinder, HUE.gold, { scale: [3, 1, 3], at: chest(0, -6, 1.2), rot: [Math.PI / 2, 0, 0], outline: 0.8 }),
  ]),
  bell: () => cluster([
    part(band(NECK + 0.3, 3.2, 0.6), HUE.red, { outline: 0.8 }),
    part(sphere, HUE.gold, { scale: [2.8, 2.8, 2.6], at: chest(0, -3.4, 2), outline: 0.8 }),
  ]),
  chain: () => cluster([
    strokeOf(bezier([-7.6, NECK + 2], [0, NECK - 7], [7.6, NECK + 2]), HUE.gold, 0.6, 0.8),
    part(roundBox(4.6, 4.6, 1.2, 0.6), HUE.gold, { at: chest(0, -4.6, 1.2), outline: 0.8 }),
  ]),
  lei: () => cluster(arc(18, 9, 6).map(([x, y], i) => part(sphere, PETALS[i % PETALS.length], { scale: [2.3, 2.3, 1.8], at: onSkin(x, y, 1.4), outline: 0.6 }))),
};

const SHOULDER = 5.3;

export const BACKS = {
  cape: () => cluster([
    cluster([part(extrude(path => {
      path.moveTo(-8.5, 0);
      path.lineTo(8.5, 0);
      path.quadraticCurveTo(11, -10, 13, -17.5);
      path.lineTo(-13, -17.5);
      path.quadraticCurveTo(-11, -10, -8.5, 0);
    }, 0.9, { bevel: 0.4 }), HUE.red, { weld: true })], { at: [0, SHOULDER, -BODY.d / 2 - 1], name: 'flap' }),
  ]),
  wings: () => cluster(mirrored(side => cluster([2, 1, 0].map(k => {
    const a = side * (0.75 - k * 0.5), reach = 7.5 - k * 1.2;
    return part(sphere, HUE.white, { scale: [reach, 3.2 - k * 0.3, 1.6], at: [side * Math.cos(a * side) * reach * 0.9, Math.sin(a * side) * reach * 0.9, -k * 0.5], rot: [0, 0, a] });
  }), { at: [side * 8, 3.4, -4.5], rot: [0, -side * 0.25, 0], name: `wing${side}` }))),
  batwings: () => cluster(mirrored(side => cluster([part(extrude(path => {
    path.moveTo(0, 2);
    path.lineTo(14, 8);
    path.quadraticCurveTo(12, 1, 15, -4);
    path.quadraticCurveTo(10, -2, 9, -7);
    path.quadraticCurveTo(5, -4, 0, -6);
    path.closePath();
  }, 0.8, { bevel: 0.3 }), 'hsl(270 30% 22% / 1)', { scale: [side, 1, 1], weld: true })], { at: [side * 7, 3.6, -5], rot: [0, -side * 0.45, 0], name: `wing${side}` }))),
  butterfly: () => cluster(mirrored(side => cluster([
    part(sphere, 'hsl(30 95% 60% / 1)', { scale: [7, 6, 1.2], at: [side * 5, 3.6, 0], rot: [0, 0, side * 0.5] }),
    part(sphere, 'hsl(190 85% 60% / 1)', { scale: [4.5, 4, 1.2], at: [side * 3.5, -3.6, 0], rot: [0, 0, -side * 0.5] }),
  ], { at: [side * 8.5, 0, -5], name: `wing${side}` }))),
  backpack: () => cluster([
    part(roundBox(10, 12, 7, 2.6), 'accent', { at: [-5.5, 0.6, -9] }),
    part(roundBox(6.4, 4.2, 2.4, 1), 'accent', { at: [-7.5, -1.6, -12.4], rot: [0, -0.5, 0], outline: 0.8 }),
  ]),
  shell: () => cluster([
    part(sphere, 'hsl(95 45% 40% / 1)', { scale: [8, 9.4, 5] }),
    part(sphere, 'hsl(60 50% 70% / 1)', { scale: [8.15, 0.8, 5.15], outline: 0 }),
    part(sphere, 'hsl(60 50% 70% / 1)', { scale: [0.8, 9.55, 5.15], outline: 0 }),
  ], { at: [-7, -1.2, -6], rot: [0, -1, 0] }),
  quiver: () => cluster([
    part(cylinder, HUE.brown, { scale: [4.4, 14.4, 4.4], at: [0, 0.6, 0] }),
    ...[-2, 0.6, 3].map(dx => cluster([
      part(cylinder, 'ink', { scale: [0.45, 4, 0.45], at: [0, -1.5, 0], outline: 0 }),
      part(cone, 'hsl(15 70% 45% / 1)', { scale: [2, 3.2, 0.8], outline: 0.6 }),
    ], { at: [dx, 10, 0] })),
  ], { at: [-6.2, 0, -7.5], rot: [0, 0, 0.35] }),
  tail: () => cluster([part(horn([[0, 0], [-8, -0.3], [-10, 5.2], [-7, 8.4]], 1.7, 0.75), 'base', { weld: true })], { at: [-6, -7.2, -5], name: 'wag' }),
};

export const WEAR_MOTION = {
  scarf: (node, { sway }) => { node.getObjectByName('tail').rotation.z = -sway * 0.8; },
  cape: (node, { frame, sway }) => { const flap = node.getObjectByName('flap'); flap.rotation.x = 0.3; flap.rotation.z = -(0.22 + Math.sin(frame / 9) * 0.08 + sway * 0.25); },
  wings: (node, { frame }) => { for (const side of [-1, 1]) node.getObjectByName(`wing${side}`).rotation.z = side * Math.sin(frame / 6) * 0.14; },
  batwings: (node, { frame }) => { for (const side of [-1, 1]) node.getObjectByName(`wing${side}`).rotation.z = side * Math.sin(frame / 6) * 0.2; },
  butterfly: (node, { frame }) => { const flap = 0.75 + Math.abs(Math.sin(frame / 8)) * 0.25; for (const side of [-1, 1]) { const wing = node.getObjectByName(`wing${side}`); wing.scale.x = flap; wing.rotation.y = -side * (1 - flap) * 2.4; } },
  tail: (node, { frame }) => { node.getObjectByName('wag').rotation.z = Math.sin(frame / 7) * 0.14; },
};
