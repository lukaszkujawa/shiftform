import { WIDTH, HEIGHT } from '../world/level.js';
import { THREE, toon, mesh, placed, merged, sphere, cone, cylinder, seeded } from './toon.js';

export const EYE = HEIGHT / 2 / Math.tan((15 * Math.PI) / 180);
const LOOK = {
  cloud: 'hsl(0 0% 100% / 1)', hill: 'hsl(105 48% 52% / 1)', hillFar: 'hsl(140 30% 62% / 1)',
  earth: 'hsl(26 46% 42% / 1)', grass: 'hsl(100 62% 48% / 1)', trunk: 'hsl(25 45% 32% / 1)',
  crowns: ['hsl(105 55% 40% / 1)', 'hsl(90 55% 46% / 1)', 'hsl(130 45% 36% / 1)'], post: 'hsl(28 40% 38% / 1)',
};

const spread = z => (EYE - z) / EYE;

function span(level, z, rand) {
  const k = spread(z);
  return {
    x: WIDTH / 2 + (rand() - 0.5) * WIDTH * k * 1.1,
    y: -(HEIGHT / 2 - (k * HEIGHT) / 2 + rand() * (level.height - HEIGHT + k * HEIGHT)),
  };
}

function cloud(rand, x, y, z, size) {
  return Array.from({ length: 5 }, (_, k) => {
    const r = size * (0.55 + rand() * 0.45) * (k === 2 ? 1.3 : 1);
    return placed(sphere, x + (k - 2) * size * 0.75, y + (k === 2 ? size * 0.3 : 0) + rand() * size * 0.2, z, { sx: r, sy: r * 0.8, sz: r * 0.7 });
  });
}

function tree(rand, x, ground, z, size, trunks, crowns) {
  trunks.push(placed(cylinder, x, ground + size * 0.6, z, { sx: size * 0.16, sy: size * 1.2, sz: size * 0.16 }));
  const color = Math.floor(rand() * LOOK.crowns.length);
  if (rand() < 0.5) crowns[color].push(placed(cone, x, ground + size * 1.7, z, { sx: size * 0.7, sy: size * 1.8, sz: size * 0.7 }));
  else crowns[color].push(placed(sphere, x, ground + size * 1.55, z, { sx: size * 0.8, sy: size * 0.75, sz: size * 0.8 }));
}

export function buildScenery(level) {
  const rand = seeded(level.palette * 104729 + (level.index ?? 0) * 31 + level.rows);
  const group = new THREE.Group(), clouds = new THREE.Group();
  const islands = [], caps = [], trunks = [], crowns = LOOK.crowns.map(() => []), hills = [], far = [];
  const count = Math.ceil(level.height / HEIGHT);
  for (let i = 0; i < count * 5; i++) {
    const z = -300 - rand() * 900, at = span(level, z, rand), size = 26 + rand() * 30;
    const puff = mesh(merged(cloud(rand, 0, 0, 0, size)), toon(LOOK.cloud, { emissive: 0.55 }), 0);
    puff.position.set(at.x, at.y, z);
    puff.userData = { x: at.x, reach: WIDTH * spread(z) * 1.4, drift: 0.002 + rand() * 0.004 };
    clouds.add(puff);
  }
  for (let i = 0; i < count * 2; i++) {
    const z = -650 - rand() * 650, at = span(level, z, rand), w = 70 + rand() * 100;
    islands.push(placed(cone, at.x, at.y - w * 0.45, z, { sx: w * 0.5, sy: w * 0.9, sz: w * 0.35, rx: Math.PI }));
    caps.push(placed(cylinder, at.x, at.y, z, { sx: w * 0.53, sy: 8, sz: w * 0.38 }));
    for (let t = 0; t < 1 + rand() * 3; t++) tree(rand, at.x + (rand() - 0.5) * w * 0.7, at.y + 4, z + (rand() - 0.5) * w * 0.3, 10 + rand() * 10, trunks, crowns);
  }
  if (level.index === 0) {
    const ground = -level.height + 20, eye = HEIGHT / 2 - level.height, sink = (y, z) => eye + (y - eye) * spread(z);
    for (let i = 0; i < 9; i++) {
      const z = -420 - i * 60, w = 260 + rand() * 260, k = spread(z), x = WIDTH / 2 + (rand() - 0.5) * WIDTH * k, tall = 50 + rand() * 50;
      hills.push(placed(sphere, x, sink(ground + tall, z) - tall - 80, z, { sx: w, sy: tall + 80, sz: 90 }));
      for (let t = 0; t < 3; t++) tree(rand, x + (rand() - 0.5) * w * 0.8, sink(ground + tall * 0.6, z) - 12, z + 70, 18 + rand() * 12, trunks, crowns);
    }
    for (let i = 0; i < 6; i++) far.push(placed(sphere, WIDTH / 2 + (i - 2.5) * 800, sink(ground + 150, -1500) - 300, -1500, { sx: 560, sy: 300, sz: 120 }));
  }
  const add = (parts, css, outline = 1.2) => { if (parts.length) group.add(mesh(merged(parts), toon(css), outline)); };
  add(islands, LOOK.earth);
  add(caps, LOOK.grass);
  add(trunks, LOOK.trunk);
  crowns.forEach((parts, k) => add(parts, LOOK.crowns[k]));
  add(hills, LOOK.hill, 0);
  add(far, LOOK.hillFar, 0);
  group.add(clouds);
  return {
    group,
    update(time) {
      for (const puff of clouds.children) {
        const { x, reach, drift } = puff.userData;
        puff.position.x = WIDTH / 2 - reach / 2 + ((((x - WIDTH / 2 + reach / 2 + time * drift) % reach) + reach) % reach);
      }
    },
  };
}
