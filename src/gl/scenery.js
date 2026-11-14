import { WIDTH, HEIGHT } from '../world/level.js';
import { shade } from '../art/themes.js';
import { THREE, colorOf, toon, glowing, mesh, shape, createPainter, placed, merged, roundBox, box, sphere, pebble, cone, cylinder, seeded } from './toon.js';
import { kitOf } from './kits.js';

export const EYE = HEIGHT / 2 / Math.tan((15 * Math.PI) / 180);
const LOOK = {
  cloud: 'hsl(0 0% 100% / 1)', trunk: 'hsl(25 45% 32% / 1)', earth: 'hsl(26 46% 42% / 1)', grass: 'hsl(100 55% 46% / 1)',
  crowns: ['hsl(105 55% 40% / 1)', 'hsl(90 55% 46% / 1)', 'hsl(130 45% 36% / 1)'], blossom: ['hsl(340 70% 82% / 1)', 'hsl(330 60% 74% / 1)', 'hsl(350 80% 88% / 1)'],
  autumn: ['hsl(26 85% 55% / 1)', 'hsl(10 75% 48% / 1)', 'hsl(42 85% 55% / 1)'], acacia: ['hsl(85 40% 38% / 1)', 'hsl(70 40% 42% / 1)'],
  pine: 'hsl(150 35% 30% / 1)', snow: 'hsl(205 40% 96% / 1)', sand: 'hsl(36 60% 70% / 1)', water: 'hsl(200 65% 45% / 1)', dead: 'hsl(260 10% 22% / 1)',
  window: 'hsl(48 90% 70% / 1)', glass: 'hsl(190 70% 75% / 1)', candy: ['hsl(350 85% 70% / 1)', 'hsl(190 80% 70% / 1)', 'hsl(48 95% 68% / 1)', 'hsl(280 70% 78% / 1)', 'hsl(120 55% 65% / 1)'],
  stained: ['hsl(350 80% 55% / 1)', 'hsl(210 80% 55% / 1)', 'hsl(48 90% 60% / 1)', 'hsl(140 60% 45% / 1)', 'hsl(280 60% 55% / 1)'],
  spines: ['hsl(5 55% 40% / 1)', 'hsl(210 45% 38% / 1)', 'hsl(140 35% 32% / 1)', 'hsl(40 60% 45% / 1)', 'hsl(280 30% 38% / 1)'],
  lantern: 'hsl(5 85% 55% / 1)', lanternGold: 'hsl(38 95% 60% / 1)', paperLine: 'hsl(210 60% 70% / 1)', margin: 'hsl(355 70% 65% / 1)',
};
const WALL_Z = -780;
const gem = new THREE.OctahedronGeometry(1);
const blob = new THREE.SphereGeometry(1, 12, 8);
const hex = new THREE.CylinderGeometry(1, 1, 1, 6);
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

const spread = z => (EYE - z) / EYE;

function frame(level, rand) {
  const eye = HEIGHT / 2 - level.height;
  const floor = z => eye + (-level.height - eye) * spread(z);
  return {
    x: z => WIDTH / 2 + (rand() - 0.5) * WIDTH * spread(z) * 1.15,
    y: z => -(HEIGHT / 2 - (spread(z) * HEIGHT) / 2 + rand() * (level.height - HEIGHT + spread(z) * HEIGHT)),
    floor,
    ground: (y, z) => floor(z) + (y + level.height) * spread(z),
    top: z => -(HEIGHT / 2 - (spread(z) * HEIGHT) / 2),
    width: z => WIDTH * spread(z) * 1.2,
    count: per => Math.ceil((level.height / HEIGHT) * per),
  };
}

const cloudShape = () => shape('scenery-cloud', () => merged([[-1.6, 0, 0.6], [-0.8, 0.35, 0.8], [0, 0.55, 1.05], [0.85, 0.3, 0.8], [1.6, 0, 0.6]].map(([x, y, r]) => placed(sphere, x, y, 0, { sx: r, sy: r * 0.8, sz: r * 0.7 }))));

function drifter(s, node, z, drift) {
  node.userData = { x: node.position.x, reach: WIDTH * spread(z) * 1.4, drift };
  s.drifting.add(node);
}

function clouds(s, per, css = LOOK.cloud, near = -300, far = -1200) {
  for (let i = 0; i < s.at.count(per); i++) {
    const z = near - s.rand() * (near - far), size = 22 + s.rand() * 28, puff = mesh(cloudShape(), toon(css, { emissive: 0.55 }), 0);
    puff.scale.setScalar(size);
    puff.position.set(s.at.x(z), s.at.y(z), z);
    drifter(s, puff, z, 0.002 + s.rand() * 0.004);
  }
}

function tree(s, kind, x, ground, z, size) {
  const { paint, rand } = s;
  if (kind === 'palm') {
    for (let k = 0; k < 5; k++) paint.add(LOOK.trunk, placed(cylinder, x + k * size * 0.06, ground + (k + 0.5) * size * 0.32, z, { sx: size * 0.09, sy: size * 0.34, sz: size * 0.09, rz: -0.12 }), { outline: 1 });
    for (let k = 0; k < 6; k++) paint.add(LOOK.crowns[1], placed(pebble, x + size * 0.3 + Math.cos((k / 6) * Math.PI * 2) * size * 0.45, ground + size * 1.6 - Math.abs(Math.sin((k / 6) * Math.PI * 2)) * size * 0.15, z, { sx: size * 0.5, sy: size * 0.1, sz: size * 0.18, rz: (k / 6) * Math.PI * 2 }), { outline: 1 });
    return;
  }
  if (kind === 'dead') {
    paint.add(LOOK.dead, placed(cylinder, x, ground + size * 0.6, z, { sx: size * 0.1, sy: size * 1.2, sz: size * 0.1 }), { outline: 1 });
    for (const side of [-1, 1]) paint.add(LOOK.dead, placed(cylinder, x + side * size * 0.22, ground + size * (0.9 + rand() * 0.3), z, { sx: size * 0.05, sy: size * 0.6, sz: size * 0.05, rz: -side * 0.8 }), { outline: 1 });
    return;
  }
  paint.add(LOOK.trunk, placed(cylinder, x, ground + size * 0.6, z, { sx: size * 0.14, sy: size * 1.2, sz: size * 0.14 }), { outline: 1 });
  if (kind === 'pine' || kind === 'snowpine') {
    for (let k = 0; k < 3; k++) paint.add(LOOK.pine, placed(cone, x, ground + size * (1.1 + k * 0.5), z, { sx: size * (0.75 - k * 0.18), sy: size * 0.8, sz: size * (0.75 - k * 0.18) }), { outline: 1 });
    if (kind === 'snowpine') paint.add(LOOK.snow, placed(cone, x, ground + size * 2.15, z, { sx: size * 0.3, sy: size * 0.4, sz: size * 0.3 }));
    return;
  }
  if (kind === 'acacia') {
    paint.add(pick(rand, LOOK.acacia), placed(pebble, x, ground + size * 1.3, z, { sx: size * 1.1, sy: size * 0.22, sz: size * 0.6 }), { outline: 1 });
    return;
  }
  if (kind === 'willow') {
    paint.add('hsl(95 30% 32% / 1)', placed(sphere, x, ground + size * 1.3, z, { sx: size * 0.8, sy: size * 0.9, sz: size * 0.7 }), { outline: 1 });
    for (let k = -2; k <= 2; k++) paint.add('hsl(95 30% 28% / 1)', placed(cone, x + k * size * 0.3, ground + size * 0.8, z + size * 0.3, { sx: size * 0.16, sy: size * 1.1, sz: size * 0.12, rx: Math.PI }));
    return;
  }
  const crowns = { blossom: LOOK.blossom, autumn: LOOK.autumn }[kind] ?? LOOK.crowns;
  paint.add(pick(rand, crowns), placed(sphere, x, ground + size * 1.5, z, { sx: size * 0.8, sy: size * 0.75, sz: size * 0.8 }), { outline: 1 });
}

function islands(s, per, trees, { earth = LOOK.earth, top = LOOK.grass, near = -650, far = -1300 } = {}) {
  for (let i = 0; i < s.at.count(per); i++) {
    const z = near - s.rand() * (near - far), x = s.at.x(z), y = s.at.y(z), w = 70 + s.rand() * 100;
    s.paint.add(earth, placed(cone, x, y - w * 0.45, z, { sx: w * 0.5, sy: w * 0.9, sz: w * 0.35, rx: Math.PI }), { outline: 1.2 });
    s.paint.add(top, placed(cylinder, x, y, z, { sx: w * 0.53, sy: 8, sz: w * 0.38 }), { outline: 1.2 });
    if (trees) for (let t = 0; t < 1 + s.rand() * 3; t++) tree(s, pick(s.rand, [].concat(trees)), x + (s.rand() - 0.5) * w * 0.7, y + 4, z + (s.rand() - 0.5) * w * 0.3, 10 + s.rand() * 10);
  }
}

function horizon(s, css, { tall = 50, wide = 260, trees = null } = {}) {
  if (s.level.index !== 0) return;
  const ground = -s.level.height + 20;
  for (let i = 0; i < 9; i++) {
    const z = -420 - i * 60, w = wide + s.rand() * wide, x = s.at.x(z), height = tall + s.rand() * tall;
    s.paint.add(css, placed(sphere, x, s.at.ground(ground + height, z) - height - 80, z, { sx: w, sy: height + 80, sz: 90 }));
    if (trees) for (let t = 0; t < 3; t++) tree(s, trees, x + (s.rand() - 0.5) * w * 0.8, s.at.ground(ground + height * 0.6, z) - 12, z + 70, 18 + s.rand() * 12);
  }
}

function sea(s, css) {
  if (s.level.index !== 0) return;
  const z = -900;
  s.paint.add(css, placed(box, WIDTH / 2, s.at.floor(z) + 20, z + 300, { sx: s.at.width(z) * 2, sy: 10, sz: 1400 }));
}

function orb(s, css, x, y, z, r, { rings = false, glow = true } = {}) {
  const disc = new THREE.Mesh(sphere, glow ? new THREE.MeshBasicMaterial({ color: colorOf(css), fog: false }) : toon(css));
  disc.scale.setScalar(r);
  disc.position.set(x, y, z);
  s.group.add(disc);
  if (rings) s.paint.add(shade(css, -15), placed(new THREE.TorusGeometry(1.6, 0.12, 6, 40), x, y, z, { sx: r, sy: r, sz: r, rx: 1.25 }), glow ? { glow: true } : {});
}

function stars(s, count, css = 'hsl(0 0% 100% / 1)') {
  const z = -1600, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set([s.at.x(z), s.at.y(z), z - s.rand() * 300], i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  s.group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: new THREE.Color(css), size: 2, sizeAttenuation: false, fog: false })));
}

function towers(s, per, build, { near = -350, far = -900 } = {}) {
  for (let i = 0; i < Math.max(3, s.at.count(per)); i++) {
    const z = near - s.rand() * (near - far);
    build(s.at.x(z), s.at.floor(z) - 40, s.at.top(z) + s.rand() * 300, z);
  }
}

const hushed = (css, toward, k) => `#${colorOf(css).lerp(colorOf(toward), k).getHexString()}`;

function wall(s, cell, [stepX, stepY]) {
  const z = WALL_Z, w = s.at.width(z), bottom = s.at.floor(z) - 60, top = s.at.top(z) + 60, haze = s.p.bgBottom;
  const paint = { add: (css, part, { outline = 0, glow = false, opacity = 1 } = {}) => s.paint.add(hushed(css, haze, 0.65), part, { outline: outline && 0.8, glow, opacity: glow ? opacity * 0.5 : opacity }) };
  paint.add(s.p.rockDeep, placed(box, WIDTH / 2, (top + bottom) / 2, z - 12, { sx: w, sy: top - bottom, sz: 20 }));
  for (let y = bottom + stepY / 2; y < top; y += stepY) for (let x = WIDTH / 2 - w / 2 + stepX / 2; x < WIDTH / 2 + w / 2; x += stepX) cell(x, y, z, paint);
}

function floaters(s, per, place, { near = -350, far = -1100 } = {}) {
  for (let i = 0; i < s.at.count(per); i++) {
    const z = near - s.rand() * (near - far);
    place(s.at.x(z), s.at.y(z), z, s.rand);
  }
}

function spinner(s, node, spin) {
  node.userData.spin = spin;
  s.spinning.push(node);
  s.group.add(node);
}

const RECIPES = {
  islands(s, kit) {
    const kind = kit.trees ?? ['round', 'pine'];
    clouds(s, 5);
    islands(s, 2, kind);
    horizon(s, shade(s.p.rockEdge, 5), { trees: [].concat(kind)[0] });
  },
  clouds(s) {
    clouds(s, 9, LOOK.cloud, -250, -1300);
    floaters(s, 1, (x, y, z) => { for (let k = 0; k < 4; k++) s.paint.add(LOOK.cloud, placed(sphere, x + k * 30, y + (k % 2) * 12, z, { sx: 34, sy: 22, sz: 30 }), { outline: 1 }); });
    horizon(s, LOOK.cloud, { tall: 40 });
  },
  mountains(s) {
    clouds(s, 2, LOOK.snow);
    floaters(s, 2, (x, y, z, rand) => {
      const w = 40 + rand() * 50;
      s.paint.add('hsl(200 35% 80% / 1)', placed(gem, x, y - w * 0.5, z, { sx: w * 0.6, sy: w, sz: w * 0.45 }), { outline: 1.2 });
      s.paint.add(LOOK.snow, placed(cylinder, x, y, z, { sx: w * 0.55, sy: 7, sz: w * 0.4 }), { outline: 1.2 });
      for (let t = 0; t < 2; t++) tree(s, 'snowpine', x + (rand() - 0.5) * w * 0.6, y + 3, z, 9 + rand() * 6);
    }, { near: -600, far: -1300 });
    if (s.level.index === 0) for (let i = 0; i < 7; i++) {
      const z = -800 - i * 90, x = s.at.x(z), tall = 260 + s.rand() * 200, base = s.at.floor(z) - 60;
      s.paint.add('hsl(215 25% 55% / 1)', placed(cone, x, base + tall / 2, z, { sx: tall * 0.7, sy: tall, sz: 120 }), { outline: 1.5 });
      s.paint.add(LOOK.snow, placed(cone, x, base + tall * 0.85, z + 1, { sx: tall * 0.21, sy: tall * 0.3, sz: 40 }));
    }
  },
  desert(s) {
    orb(s, 'hsl(40 100% 70% / 1)', WIDTH * 0.72, s.at.floor(-1500) + 900, -1500, 160);
    floaters(s, 1.5, (x, y, z, rand) => {
      const w = 60 + rand() * 70;
      for (let k = 0; k < 3; k++) s.paint.add(k % 2 ? 'hsl(28 50% 58% / 1)' : 'hsl(32 55% 66% / 1)', placed(cylinder, x, y - k * 12, z, { sx: w * (0.5 - k * 0.06), sy: 12, sz: w * 0.35 }), { outline: 1.2 });
      if (rand() < 0.6) s.paint.add('hsl(120 35% 40% / 1)', placed(roundBox(6, 22, 6, 3, 2), x + w * 0.1, y + 13, z), { outline: 1 });
    }, { near: -600, far: -1300 });
    horizon(s, LOOK.sand, { tall: 35, wide: 320 });
  },
  moon(s) {
    stars(s, 260);
    orb(s, 'hsl(205 70% 55% / 1)', WIDTH * 0.25, s.at.top(-1500) - 300, -1500, 120, { glow: false });
    floaters(s, 2.5, (x, y, z, rand) => s.paint.add(shade(s.p.rock, 6), placed(pebble, x, y, z, { sx: 20 + rand() * 30, sy: 16 + rand() * 20, sz: 20 + rand() * 20, rz: rand() * 3 }), { outline: 1.2 }), { near: -500, far: -1300 });
    horizon(s, shade(s.p.rock, 4), { tall: 30, wide: 360 });
  },
  space(s) {
    stars(s, 360);
    floaters(s, 0.6, (x, y, z, rand) => orb(s, pick(rand, ['hsl(280 45% 55% / 1)', 'hsl(20 60% 55% / 1)', 'hsl(190 50% 50% / 1)']), x, y, z, 40 + rand() * 50, { rings: rand() < 0.6, glow: false }), { near: -900, far: -1400 });
    floaters(s, 2, (x, y, z, rand) => s.paint.add(shade(s.p.rock, 8), placed(pebble, x, y, z, { sx: 10 + rand() * 18, sy: 8 + rand() * 12, sz: 10 + rand() * 12, rz: rand() * 3 }), { outline: 1 }), { near: -400, far: -1100 });
  },
  grid(s) {
    stars(s, 160);
    if (s.level.index === 0) {
      const z = -700, w = s.at.width(z) * 2;
      for (let k = -14; k <= 14; k++) s.paint.add(s.p.rockEdge, placed(box, WIDTH / 2 + k * 90, s.at.floor(z) + 10, z, { sx: 2, sy: 2, sz: 1600 }), { glow: true, opacity: 0.7 });
      for (let k = 0; k < 14; k++) s.paint.add(s.p.rockEdge, placed(box, WIDTH / 2, s.at.floor(z) + 10, z + 700 - k * 110, { sx: w, sy: 2, sz: 2 }), { glow: true, opacity: 0.7 });
      orb(s, s.p.accent, WIDTH / 2, s.at.floor(-1500) + 420, -1500, 260);
    }
    floaters(s, 2, (x, y, z, rand) => {
      const kind = rand() < 0.5 ? 'cube' : 'pyramid';
      const edges = new THREE.LineSegments(shape(`edges-${kind}`, () => new THREE.EdgesGeometry(kind === 'cube' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.ConeGeometry(0.7, 1, 4))), new THREE.LineBasicMaterial({ color: new THREE.Color(rand() < 0.5 ? s.p.rockEdge : s.p.accent) }));
      edges.scale.setScalar(14 + rand() * 24);
      edges.position.set(x, y, z);
      edges.rotation.set(rand() * 3, rand() * 3, 0);
      spinner(s, edges, 0.0004 + rand() * 0.0008);
    }, { near: -300, far: -1000 });
  },
  code(s) {
    for (let i = 0; i < 26; i++) {
      const z = -300 - s.rand() * 900, column = new THREE.Group(), length = 6 + Math.floor(s.rand() * 10);
      for (let k = 0; k < length; k++) column.add(new THREE.Mesh(shape('bit', () => new THREE.BoxGeometry(5, 7, 1)), glowing(s.p.rockEdge, Math.max(0.15, 1 - k / length))).translateY(k * 11));
      column.position.set(s.at.x(z), s.at.y(z), z);
      column.userData = { fall: 0.03 + s.rand() * 0.05, top: s.at.top(z) + 200, bottom: s.at.floor(z) - 200, start: column.position.y };
      s.falling.push(column);
      s.group.add(column);
    }
  },
  skyline(s) {
    clouds(s, 1.5, shade(s.p.bgBottom, 10), -600, -1300);
    towers(s, 2.5, (x, bottom, top, z) => {
      const w = 50 + s.rand() * 70, h = (top - bottom) * (0.35 + s.rand() * 0.75), color = shade(s.p.rock, -4 + s.rand() * 10);
      s.paint.add(color, placed(box, x, bottom + h / 2, z, { sx: w, sy: h, sz: 50 }), { outline: 1.2 });
      for (let wy = bottom + 30; wy < bottom + h - 16; wy += 22) for (let wx = -w / 2 + 10; wx < w / 2 - 6; wx += 14) if (s.rand() < 0.45) s.paint.add(LOOK.window, placed(box, x + wx + 3, wy, z + 25.5, { sx: 6, sy: 9, sz: 1 }), { glow: true, opacity: 0.9 });
      if (s.rand() < 0.4) s.paint.add(color, placed(cylinder, x, bottom + h + 20, z, { sx: 1.5, sy: 40, sz: 1.5 }));
    });
  },
  office(s) {
    wall(s, (x, y, z, paint) => {
      paint.add(shade(s.p.bgBottom, 12), placed(box, x, y, z, { sx: 140, sy: 100, sz: 2 }), { glow: true });
      for (let k = -4; k <= 4; k++) paint.add(shade(s.p.rock, 20), placed(box, x, y + k * 11, z + 2, { sx: 140, sy: 3, sz: 2 }));
      paint.add(shade(s.p.rock, 10), placed(box, x, y - 56, z + 4, { sx: 150, sy: 8, sz: 10 }), { outline: 1 });
    }, [220, 170]);
  },
  station(s) {
    stars(s, 200);
    wall(s, (x, y, z, paint) => {
      paint.add(shade(s.p.rock, 6), placed(box, x, y, z + 4, { sx: 150, sy: 110, sz: 6 }), { outline: 1.2 });
      paint.add('hsl(225 40% 8% / 1)', placed(cylinder, x, y, z + 7, { sx: 26, sy: 3, sz: 26, rx: Math.PI / 2 }), { outline: 2 });
      paint.add(s.p.rockEdge, placed(new THREE.TorusGeometry(27, 2.5, 4, 16), x, y, z + 8), { glow: true });
      for (const side of [-1, 1]) paint.add(shade(s.p.rock, 16), placed(cylinder, x + side * 60, y, z + 10, { sx: 4, sy: 110, sz: 4 }), { outline: 1 });
    }, [170, 130]);
  },
  factory(s) {
    towers(s, 2, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.3 + s.rand() * 0.5);
      s.paint.add(shade(s.p.rock, 6), placed(cylinder, x, bottom + tall / 2, z, { sx: 18, sy: tall, sz: 18 }), { outline: 1.2 });
      for (let y = bottom + 40; y < bottom + tall; y += 60) s.paint.add(s.p.rockEdge, placed(cylinder, x, y, z, { sx: 19.5, sy: 6, sz: 19.5 }));
    });
    floaters(s, 1.5, (x, y, z, rand) => {
      const r = 20 + rand() * 25, teeth = Array.from({ length: 10 }, (_, k) => placed(new THREE.BoxGeometry(9, 8, 8), Math.cos((k / 10) * Math.PI * 2) * r, Math.sin((k / 10) * Math.PI * 2) * r, 0, { rz: (k / 10) * Math.PI * 2 }));
      const gear = mesh(merged([placed(cylinder, 0, 0, 0, { sx: r, sy: 8, sz: r, rx: Math.PI / 2 }), ...teeth]), toon(shade(s.p.rock, 12)), 1.2);
      gear.position.set(x, y, z);
      spinner(s, gear, (rand() < 0.5 ? -1 : 1) * (0.0004 + rand() * 0.0006));
    }, { near: -400, far: -900 });
  },
  lab(s) {
    wall(s, (x, y, z, paint) => {
      paint.add(LOOK.glass, placed(cylinder, x, y, z + 30, { sx: 28, sy: 90, sz: 28 }), { opacity: 0.35 });
      paint.add(s.p.rockEdge, placed(cylinder, x, y - 12, z + 30, { sx: 25, sy: 62, sz: 25 }), { glow: true, opacity: 0.55 });
      for (const dy of [-48, 48]) paint.add(shade(s.p.rock, 10), placed(cylinder, x, y + dy, z + 30, { sx: 31, sy: 8, sz: 31 }), { outline: 1 });
    }, [160, 170]);
  },
  forest(s, kit) {
    if (kit.trees === 'mushroom') return floaters(s, 2.5, (x, y, z, rand) => {
      const tall = 60 + rand() * 120, girth = 6 + rand() * 6;
      s.paint.add('hsl(40 30% 82% / 1)', placed(cylinder, x, y - tall / 2, z, { sx: girth, sy: tall, sz: girth }), { outline: 1.2 });
      s.paint.add(s.p.rockEdge, placed(sphere, x, y, z, { sx: girth * 4.5, sy: girth * 1.8, sz: girth * 3.5 }), { glow: true, opacity: 0.85 });
    }, { near: -300, far: -1100 });
    towers(s, 1.3, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.5 + s.rand() * 0.6), girth = 14 + s.rand() * 12;
      s.paint.add(hushed(LOOK.trunk, s.p.bgBottom, 0.35), placed(cylinder, x, bottom + tall / 2, z, { sx: girth, sy: tall, sz: girth }), { outline: 1 });
      for (let y = bottom + 140 + s.rand() * 100; y < bottom + tall + 40; y += 160 + s.rand() * 120) s.paint.add(hushed(pick(s.rand, LOOK.crowns), s.p.bgBottom, 0.35), placed(blob, x + (s.rand() - 0.5) * 40, y, z, { sx: 60 + s.rand() * 40, sy: 40 + s.rand() * 30, sz: 50 }), { outline: 1.2 });
    }, { near: -500, far: -1200 });
  },
  swamp(s) {
    towers(s, 2, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.3 + s.rand() * 0.4);
      s.paint.add(LOOK.trunk, placed(cylinder, x, bottom + tall / 2, z, { sx: 12, sy: tall, sz: 12 }), { outline: 1.2 });
      tree(s, 'willow', x, bottom + tall - 60, z, 60);
    });
    floaters(s, 1, (x, y, z) => s.paint.add('hsl(160 25% 70% / 1)', placed(sphere, x, y, z, { sx: 120, sy: 18, sz: 60 }), { opacity: 0.25 }), { near: -300, far: -800 });
  },
  graveyard(s) {
    stars(s, 140);
    orb(s, 'hsl(55 70% 88% / 1)', WIDTH * 0.75, s.at.top(-1500) - 250, -1500, 110);
    islands(s, 1.6, 'dead', { earth: shade(s.p.rock, 4), top: shade(s.p.rockEdge, -10) });
    floaters(s, 1, (x, y, z) => { for (let k = 0; k < 3; k++) s.paint.add('hsl(250 8% 60% / 1)', placed(roundBox(14, 20, 6, 6, 2), x + k * 22, y + 10, z), { outline: 1 }); }, { near: -500, far: -1100 });
  },
  sea(s) {
    towers(s, 3, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.4 + s.rand() * 0.6);
      for (let y = bottom; y < bottom + tall; y += 26) s.paint.add('hsl(150 45% 32% / 1)', placed(pebble, x + Math.sin(y / 60) * 10, y, z, { sx: 9, sy: 18, sz: 4, rz: Math.sin(y / 60) * 0.5 }), { outline: 1 });
    }, { near: -300, far: -1000 });
    floaters(s, 1.2, (x, y, z) => s.paint.add('hsl(190 80% 80% / 1)', placed(box, x, y, z, { sx: 60, sy: 900, sz: 2, rz: 0.35 }), { glow: true, opacity: 0.07 }), { near: -400, far: -900 });
    floaters(s, 1.5, (x, y, z, rand) => s.paint.add(shade(s.p.rock, 8), placed(pebble, x, y, z, { sx: 30 + rand() * 30, sy: 20 + rand() * 20, sz: 30 }), { outline: 1.2 }), { near: -500, far: -1200 });
  },
  seaside(s) {
    clouds(s, 4);
    islands(s, 1.5, 'palm', { earth: 'hsl(30 40% 55% / 1)', top: LOOK.sand });
    sea(s, LOOK.water);
  },
  cove(s) {
    stars(s, 160);
    orb(s, 'hsl(50 60% 90% / 1)', WIDTH * 0.3, s.at.top(-1500) - 220, -1500, 90);
    islands(s, 1.8, 'palm', { earth: shade(s.p.rock, 6), top: 'hsl(36 45% 55% / 1)' });
    sea(s, 'hsl(215 45% 22% / 1)');
  },
  volcano(s) {
    towers(s, 2.5, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.3 + s.rand() * 0.7), w = 40 + s.rand() * 50;
      s.paint.add(shade(s.p.rock, 4), placed(cone, x, bottom + tall / 2, z, { sx: w, sy: tall, sz: w * 0.7 }), { outline: 1.2 });
      if (s.rand() < 0.6) s.paint.add(s.p.rockEdge, placed(box, x + w * 0.2, bottom + tall * 0.4, z + w * 0.5, { sx: 10, sy: tall * 0.7, sz: 4 }), { glow: true });
    }, { near: -350, far: -1100 });
  },
  cavern(s) {
    towers(s, 2.5, (x, bottom, top, z) => {
      const w = 30 + s.rand() * 40;
      for (let y = bottom + 100; y < top; y += 260 + s.rand() * 200) {
        s.paint.add(shade(s.p.rock, 6), placed(cone, x, y, z, { sx: w, sy: w * 2.2, sz: w * 0.8, rx: Math.PI }), { outline: 1.2 });
        s.paint.add(s.p.rockEdge, placed(gem, x + w * 0.6, y - 60, z + 10, { sx: 10, sy: 22, sz: 10 }), { glow: true, opacity: 0.85 });
      }
    }, { near: -350, far: -1100 });
  },
  mine(s) {
    towers(s, 1.6, (x, bottom, top, z) => {
      for (const side of [-1, 1]) s.paint.add(LOOK.trunk, placed(box, x + side * 50, (top + bottom) / 2, z, { sx: 10, sy: top - bottom, sz: 10 }), { outline: 1.2 });
      for (let y = bottom + 160; y < top; y += 200) {
        s.paint.add(LOOK.trunk, placed(box, x, y, z, { sx: 120, sy: 10, sz: 12 }), { outline: 1.2 });
        s.paint.add(LOOK.lanternGold, placed(sphere, x, y - 16, z + 6, { sx: 5, sy: 7, sz: 5 }), { glow: true });
      }
    }, { near: -300, far: -900 });
  },
  candyland(s) {
    clouds(s, 4, 'hsl(330 80% 90% / 1)');
    floaters(s, 2, (x, y, z, rand) => {
      const tall = 60 + rand() * 60;
      s.paint.add(LOOK.cloud, placed(cylinder, x, y, z, { sx: 3, sy: tall, sz: 3 }), { outline: 1 });
      s.paint.add(pick(rand, LOOK.candy), placed(cylinder, x, y + tall / 2 + 22, z, { sx: 24, sy: 7, sz: 24, rx: Math.PI / 2 }), { outline: 1.2 });
      s.paint.add(LOOK.cloud, placed(new THREE.TorusGeometry(14, 2.4, 6, 24), x, y + tall / 2 + 22, z + 3.6));
    }, { near: -450, far: -1100 });
    horizon(s, 'hsl(320 60% 78% / 1)', { tall: 60 });
  },
  colonnade(s) {
    towers(s, 3, (x, bottom, top, z) => {
      const tall = (top - bottom) * (0.4 + s.rand() * 0.6), color = shade(s.p.rockEdge, -10);
      s.paint.add(color, placed(cylinder, x, bottom + tall / 2, z, { sx: 18, sy: tall, sz: 18 }), { outline: 1.2 });
      s.paint.add(color, placed(box, x, bottom + tall, z, { sx: 52, sy: 12, sz: 52 }), { outline: 1.2 });
    }, { near: -350, far: -1000 });
  },
  honeycomb(s) {
    wall(s, (x, y, z, paint) => {
      const filled = s.rand() < 0.3;
      paint.add(filled ? s.p.rockEdge : shade(s.p.rock, 6), placed(hex, x, y, z, { sx: 34, sy: 14, sz: 34, rx: Math.PI / 2 }), filled ? { glow: true, opacity: 0.85 } : { outline: 1.5 });
    }, [62, 54]);
  },
  cathedral(s) {
    wall(s, (x, y, z, paint) => {
      paint.add(shade(s.p.rock, 4), placed(box, x - 100, y, z + 14, { sx: 24, sy: 200, sz: 24 }), { outline: 1.2 });
      paint.add(pick(s.rand, LOOK.stained), placed(roundBox(70, 120, 2, 30, 4), x, y, z + 2), { glow: true, opacity: 0.75 });
      paint.add(shade(s.p.rock, -10), placed(box, x, y, z + 4, { sx: 4, sy: 120, sz: 3 }));
      paint.add(shade(s.p.rock, -10), placed(box, x, y + 10, z + 4, { sx: 70, sy: 4, sz: 3 }));
    }, [200, 220]);
  },
  library(s) {
    wall(s, (x, y, z, paint) => {
      paint.add(LOOK.trunk, placed(box, x, y - 30, z + 14, { sx: 170, sy: 6, sz: 26 }), { outline: 1 });
      for (let bx = -80; bx < 80; bx += 7 + s.rand() * 3) {
        const tall = 40 + s.rand() * 14;
        paint.add(pick(s.rand, LOOK.spines), placed(box, x + bx, y - 27 + tall / 2, z + 12, { sx: 6, sy: tall, sz: 18 }));
      }
    }, [180, 72]);
  },
  lanterns(s) {
    stars(s, 120);
    floaters(s, 4, (x, y, z, rand) => {
      const lantern = new THREE.Group(), glow = new THREE.Mesh(sphere, glowing(rand() < 0.7 ? LOOK.lantern : LOOK.lanternGold)), cap = mesh(cylinder, toon('hsl(0 0% 15% / 1)'), 0);
      glow.scale.set(9, 11, 9);
      cap.scale.set(5, 2, 5);
      cap.position.y = 11.5;
      lantern.add(glow, cap);
      lantern.position.set(x, y, z);
      lantern.userData = { home: y, speed: 0.6 + rand() };
      s.bobbing.push(lantern);
      s.group.add(lantern);
    }, { near: -250, far: -1100 });
    if (s.level.index === 0) for (let i = 0; i < 4; i++) {
      const z = -700 - i * 120, x = s.at.x(z), base = s.at.floor(z) + 40;
      for (let k = 0; k < 3; k++) s.paint.add(shade(s.p.rock, -2), placed(cone, x, base + k * 70, z, { sx: 120 - k * 25, sy: 30, sz: 70 - k * 12, ry: Math.PI / 4 }), { outline: 1.2 });
    }
  },
  fairground(s) {
    stars(s, 100);
    if (s.level.index === 0) {
      const z = -800, r = 220, spokes = [], wheel = new THREE.Group();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        spokes.push(placed(cylinder, (Math.cos(a) * r) / 2, (Math.sin(a) * r) / 2, 0, { sx: 2, sy: r, sz: 2, rz: a - Math.PI / 2 }));
        const bulb = new THREE.Mesh(sphere, glowing(pick(s.rand, LOOK.candy)));
        bulb.scale.setScalar(9);
        bulb.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        wheel.add(bulb);
      }
      wheel.add(mesh(new THREE.TorusGeometry(r, 5, 8, 48), toon(s.p.rockEdge), 1.2), mesh(merged(spokes), toon(s.p.rockEdge), 0));
      wheel.position.set(WIDTH * 0.7, s.at.floor(z) + r + 60, z);
      spinner(s, wheel, 0.0002);
    }
    floaters(s, 2.5, (x, y, z, rand) => {
      s.paint.add(pick(rand, LOOK.candy), placed(sphere, x, y, z, { sx: 11, sy: 13, sz: 11 }), { outline: 1 });
      s.paint.add(LOOK.cloud, placed(cylinder, x, y - 30, z, { sx: 0.6, sy: 34, sz: 0.6 }));
    }, { near: -300, far: -1000 });
  },
  paper(s) {
    const z = WALL_Z, w = s.at.width(z), bottom = s.at.floor(z) - 60, top = s.at.top(z) + 60;
    s.paint.add(s.p.bgTop, placed(box, WIDTH / 2, (top + bottom) / 2, z - 8, { sx: w, sy: top - bottom, sz: 10 }));
    for (let y = bottom; y < top; y += 40) s.paint.add(LOOK.paperLine, placed(box, WIDTH / 2, y, z, { sx: w, sy: 2, sz: 1 }));
    s.paint.add(LOOK.margin, placed(box, WIDTH / 2 - w * 0.32, (top + bottom) / 2, z + 0.5, { sx: 3, sy: top - bottom, sz: 1 }));
    floaters(s, 2, (x, y, z, rand) => {
      const plane = mesh(shape('paper-plane', () => new THREE.ConeGeometry(1, 2.6, 3).rotateZ(-Math.PI / 2).scale(1, 0.25, 1)), toon('hsl(0 0% 98% / 1)'), 1);
      plane.scale.setScalar(10 + rand() * 6);
      plane.position.set(x, y, z);
      plane.rotation.set(0.3, rand() * 0.6 - 0.3, 0.1);
      drifter(s, plane, z, 0.01 + rand() * 0.01);
    }, { near: -250, far: -420 });
  },
};

export function buildScenery(level, palette, theme) {
  const rand = seeded(level.palette * 104729 + (level.index ?? 0) * 31 + level.rows);
  const group = new THREE.Group(), drifting = new THREE.Group(), kit = kitOf(theme);
  const s = { level, p: palette, rand, paint: createPainter(), group, drifting, at: frame(level, rand), spinning: [], falling: [], bobbing: [] };
  RECIPES[kit.scenery](s, kit);
  s.paint.build(group);
  group.add(drifting);
  return {
    group,
    update(time) {
      for (const node of drifting.children) {
        const { x, reach, drift } = node.userData;
        node.position.x = WIDTH / 2 - reach / 2 + ((((x - WIDTH / 2 + reach / 2 + time * drift) % reach) + reach) % reach);
      }
      for (const node of s.spinning) node.rotation.z = time * node.userData.spin;
      for (const node of s.bobbing) node.position.y = node.userData.home + Math.sin((time / 1000) * node.userData.speed) * 12;
      for (const node of s.falling) {
        const { fall, top, bottom, start } = node.userData, span = top - bottom;
        node.position.y = bottom + ((((start - bottom - time * fall) % span) + span) % span);
      }
    },
  };
}
