import { WIDTH, HEIGHT } from '../world/level.js';
import { THREE, toon, glowing, shape, sphere, pebble, cylinder, seeded, PUPIL } from './toon.js';
import { part } from './kit.js';

const FRAME_MS = 1000 / 60;
const WINGS = ['hsl(48 98% 62% / 1)', 'hsl(330 85% 72% / 1)', 'hsl(200 90% 70% / 1)', 'hsl(20 95% 62% / 1)'];
const CANDY = ['hsl(350 85% 62% / 1)', 'hsl(48 95% 62% / 1)', 'hsl(190 80% 60% / 1)', 'hsl(120 60% 55% / 1)', 'hsl(280 70% 70% / 1)'];
const AUTUMN = ['hsl(26 90% 55% / 1)', 'hsl(10 75% 48% / 1)', 'hsl(42 85% 55% / 1)'];
const PETAL = 'hsl(340 80% 85% / 1)';
const CRITTERS = {
  country: 'butterflies', blossom: 'butterflies', jungle: 'butterflies', autumn: 'butterflies', candy: 'butterflies', ruins: 'butterflies',
  deep: 'fish', pirate: 'birds', sky: 'birds', harbor: 'birds', savanna: 'birds', dunes: 'birds', haunted: 'bats', mine: 'bats', cathedral: 'bats',
};
const MOTION = {
  snow: { vx: [0.2, 0.2], vy: [0.6, 1.4], size: [2, 4] }, embers: { vx: [0, 0], vy: [-1.5, -0.6], size: [2, 4], glow: true },
  motes: { vx: [0.1, 0.3], vy: [-0.05, -0.05], size: [1.5, 3], opacity: 0.5 }, sparks: { vx: [0, 0], vy: [0, 0], size: [1, 3], glow: true, twinkle: true },
  stars: { vx: [-0.15, -0.15], vy: [0, 0], size: [1, 2.5], glow: true, twinkle: true }, spores: { vx: [0, 0], vy: [-0.5, -0.2], size: [1.5, 3], twinkle: true },
  dust: { vx: [0.8, 1.7], vy: [0.05, 0.05], size: [1, 2.5], opacity: 0.55 }, bubbles: { vx: [0, 0], vy: [-1.1, -0.4], size: [1.5, 4], opacity: 0.55 },
  rain: { vx: [-1.5, -1.5], vy: [9, 13], size: [1, 1], streak: 14, opacity: 0.4, count: 70 }, sprinkles: { vx: [0.2, 0.2], vy: [0.8, 1.4], size: [2, 2], streak: 5, colors: CANDY },
  code: { vx: [0, 0], vy: [1.5, 4], size: [5, 5], glow: true, opacity: 0.7 }, fog: { vx: [0.25, 0.55], vy: [0, 0], size: [30, 70], opacity: 0.08, count: 12, smooth: true },
  petals: { vx: [0.3, 0.7], vy: [0.4, 0.9], size: [2.5, 3.5], flat: true, colors: [PETAL] }, leaves: { vx: [0.4, 0.9], vy: [0.5, 1.1], size: [3, 5], flat: true, colors: AUTUMN },
  lanterns: { vx: [0.1, 0.3], vy: [-0.6, -0.25], size: [2.5, 4.5], glow: true, twinkle: true },
};
const roll = (rand, [a, b]) => a + rand() * (b - a);
const wrap = (v, lo, span) => lo + ((((v - lo) % span) + span) % span);

function particles(kind, color, glows, rand) {
  const motion = MOTION[kind];
  if (!motion) return null;
  const count = motion.count ?? 45, geometry = motion.streak ? shape('streak', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5)) : motion.flat ? shape('petal', () => new THREE.SphereGeometry(1, 6, 4).scale(1, 0.45, 0.25)) : motion.smooth ? sphere : pebble;
  const glow = motion.glow || (kind === 'spores' && glows);
  const material = glow ? glowing(color, motion.opacity ?? 0.9) : toon(color, { opacity: motion.opacity ?? 0.9, emissive: 0.4 });
  const swarm = new THREE.InstancedMesh(geometry, motion.colors ? new THREE.MeshBasicMaterial({ transparent: true, opacity: motion.opacity ?? 0.9 }) : material, count);
  const seeds = Array.from({ length: count }, (_, i) => {
    if (motion.colors) swarm.setColorAt(i, new THREE.Color(motion.colors[i % motion.colors.length]));
    return { x: rand() * WIDTH, y: rand() * HEIGHT, z: -60 + rand() * 90, vx: roll(rand, motion.vx), vy: roll(rand, motion.vy), size: roll(rand, motion.size), sway: rand() * Math.PI * 2 };
  });
  const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
  return {
    node: swarm,
    update(time, camera) {
      const frames = time / FRAME_MS;
      seeds.forEach((p, i) => {
        const x = wrap(p.x + p.vx * frames + Math.sin(time / 900 + p.sway) * 6, -30, WIDTH + 60), y = wrap(p.y + p.vy * frames, camera - 40, HEIGHT + 80);
        const pulse = motion.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + p.sway)) : 1;
        place.set(x, -y, p.z);
        if (motion.streak) {
          turn.setFromAxisAngle(axis, Math.atan2(p.vx, p.vy));
          size.set(p.size, motion.streak, p.size);
        } else {
          turn.setFromAxisAngle(axis, motion.flat ? time / 500 + p.sway : 0);
          size.setScalar(p.size * pulse);
        }
        swarm.setMatrixAt(i, matrix.compose(place, turn, size));
      });
      swarm.instanceMatrix.needsUpdate = true;
    },
  };
}

function butterfly(rand) {
  const root = new THREE.Group(), color = WINGS[Math.floor(rand() * WINGS.length)];
  root.add(part(cylinder, PUPIL, [0.8, 6, 0.8]));
  const wings = [-1, 1].map(side => {
    const wing = new THREE.Group();
    wing.add(part(sphere, color, [4.5, 3.5, 0.5], [side * 4, 1.5, 0], 0.6), part(sphere, color, [3, 2.4, 0.5], [side * 3, -2.2, 0], 0.6));
    root.add(wing);
    return wing;
  });
  return { root, flap: (t, heading) => { root.rotation.y = heading > 0 ? 0.6 : -0.6; wings.forEach((wing, k) => { wing.rotation.y = (k ? -1 : 1) * Math.abs(Math.sin(t * 14)) * 1.2; }); } };
}

function flyer(rand, css, span) {
  const root = new THREE.Group();
  root.add(part(pebble, css, [2.6, 2, 2], [0, 0, 0], 0.6));
  const wings = [-1, 1].map(side => {
    const wing = new THREE.Group();
    wing.add(part(pebble, css, [span, 1, 2.6], [side * span, 0, 0], 0.6));
    root.add(wing);
    return wing;
  });
  return { root, flap: (t, heading) => { root.rotation.y = heading > 0 ? 0.3 : -0.3; wings.forEach((wing, k) => { wing.rotation.z = (k ? -1 : 1) * Math.sin(t * 10) * 0.6; }); } };
}

function fish(rand) {
  const root = new THREE.Group(), color = WINGS[Math.floor(rand() * WINGS.length)];
  const body = new THREE.Group();
  body.add(part(pebble, color, [6, 3.6, 2.4], [0, 0, 0], 0.8), part(shape('fin', () => new THREE.ConeGeometry(1, 1, 4)), color, [2.6, 4, 1], [-6.5, 0, 0], 0.6).rotateZ(Math.PI / 2), part(pebble, PUPIL, [0.8, 0.8, 0.6], [3.5, 0.8, 2]));
  root.add(body);
  return { root, flap: (t, heading) => { body.scale.x = heading > 0 ? 1 : -1; body.rotation.y = Math.sin(t * 8) * 0.25; } };
}

const MAKERS = {
  butterflies: { make: butterfly, depth: [-30, -80], roam: [60, 25] },
  birds: { make: rand => flyer(rand, 'hsl(220 15% 30% / 1)', 4.5), depth: [-200, -500], roam: [300, 30] },
  bats: { make: rand => flyer(rand, 'hsl(270 20% 14% / 1)', 4), depth: [-60, -200], roam: [120, 40] },
  fish: { make: fish, depth: [-40, -160], roam: [200, 20] },
};

export function createLife(level, palette, theme) {
  const rand = seeded(level.palette * 613 + level.rows), group = new THREE.Group();
  const swarm = particles(theme.ambient, palette[theme.mote], theme.glow, rand);
  if (swarm) group.add(swarm.node);
  const maker = MAKERS[CRITTERS[theme.id]];
  const flock = maker ? Array.from({ length: Math.ceil(level.height / HEIGHT) * 3 }, () => {
    const critter = maker.make(rand);
    critter.home = { x: rand() * WIDTH, y: rand() * level.height, z: maker.depth[0] + rand() * (maker.depth[1] - maker.depth[0]) };
    critter.seed = rand() * 1000;
    critter.speed = 0.4 + rand() * 0.6;
    group.add(critter.root);
    return critter;
  }) : [];
  return {
    group,
    update(time, camera, current) {
      if (swarm) swarm.node.visible = current;
      if (current) swarm?.update(time, camera);
      for (const critter of flock) {
        const t = (time / 1000) * critter.speed + critter.seed, [rx, ry] = maker.roam;
        critter.root.position.set(critter.home.x + Math.sin(t * 0.7) * rx, -(critter.home.y + Math.sin(t * 1.3) * ry), critter.home.z + Math.sin(t) * 10);
        critter.flap(t, Math.cos(t * 0.7));
      }
    },
  };
}
