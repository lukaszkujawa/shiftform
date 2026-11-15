import { WIDTH, HEIGHT, TILE, COLS, SOLID, tileAt } from '../world/level.js?v=0a1f4db';
import { THREE, colorOf, toon, glowing, shape, sphere, pebble, cylinder, gem, seeded, PUPIL } from './toon.js?v=0a1f4db';
import { part } from './kit.js?v=0a1f4db';

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
  snow: { vx: [0.2, 0.2], vy: [0.6, 1.4], size: [2, 4], swirl: 12, near: 12, settle: true }, embers: { vx: [0, 0], vy: [-1.5, -0.6], size: [2, 4], glow: true, flicker: true, swirl: 9, near: 8 },
  motes: { vx: [0.1, 0.3], vy: [-0.05, -0.05], size: [1.5, 3], opacity: 0.5 }, sparks: { vx: [0, 0], vy: [0, 0], size: [1, 3], glow: true, twinkle: true },
  stars: { vx: [-0.15, -0.15], vy: [0, 0], size: [1, 2.5], glow: true, twinkle: true }, spores: { vx: [0, 0], vy: [-0.5, -0.2], size: [1.5, 3], twinkle: true },
  dust: { vx: [0.8, 1.7], vy: [0.05, 0.05], size: [1, 2.5], opacity: 0.55 }, bubbles: { vx: [0, 0], vy: [-1.1, -0.4], size: [1.5, 4], opacity: 0.55, wobble: true, near: 8 },
  rain: { vx: [-1.5, -1.5], vy: [9, 13], size: [1, 1], streak: 14, opacity: 0.4, count: 70, near: 14, splash: true }, sprinkles: { vx: [0.2, 0.2], vy: [0.8, 1.4], size: [2, 2], streak: 5, colors: CANDY },
  code: { vx: [0, 0], vy: [1.5, 4], size: [5, 5], glow: true, opacity: 0.7 }, fog: { banks: 9 },
  petals: { vx: [0.3, 0.7], vy: [0.4, 0.9], size: [2.5, 3.5], flat: true, colors: [PETAL], swirl: 22, near: 10 }, leaves: { vx: [0.4, 0.9], vy: [0.5, 1.1], size: [3, 5], flat: true, colors: AUTUMN, swirl: 22, near: 10 },
  lanterns: { vx: [0.1, 0.3], vy: [-0.6, -0.25], size: [2.5, 4.5], glow: true, twinkle: true },
};
const WEATHER = { film: ['rain'], bayou: ['spores', 'fog'] };
const FAR = [-60, 30];
const NEAR = [70, 260];
const roll = (rand, [a, b]) => a + rand() * (b - a);
const wrap = (v, lo, span) => lo + ((((v - lo) % span) + span) % span);
const hashed = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

function topsOf(level) {
  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  const tops = [];
  for (let r = 1; r < level.rows; r++) for (let c = 0; c < COLS; c++) if (solid(c, r) && !solid(c, r - 1)) tops.push({ x: c * TILE, y: r * TILE });
  return tops;
}

function within(tops, camera) {
  const first = y => { let lo = 0, hi = tops.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (tops[mid].y < y) lo = mid + 1; else hi = mid; } return lo; };
  return [first(camera), first(camera + HEIGHT)];
}

function swarm(motion, geometry, material, count, [back, front], scale, rand) {
  const flock = new THREE.InstancedMesh(geometry, material, count);
  flock.frustumCulled = false;
  const seeds = Array.from({ length: count }, (_, i) => {
    if (motion.colors) flock.setColorAt(i, colorOf(motion.colors[i % motion.colors.length]));
    return { x: rand() * WIDTH, y: rand() * HEIGHT, z: back + rand() * (front - back), vx: roll(rand, motion.vx), vy: roll(rand, motion.vy), size: roll(rand, motion.size) * scale, sway: rand() * Math.PI * 2 };
  });
  const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), tumble = new THREE.Euler(), size = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
  const swirl = motion.swirl ?? 6;
  return {
    node: flock,
    update(time, camera) {
      const frames = time / FRAME_MS;
      seeds.forEach((p, i) => {
        const bob = motion.wobble ? Math.sin(time / 260 + p.sway * 3) : 0;
        const x = wrap(p.x + p.vx * frames + Math.sin(time / 900 + p.sway) * swirl + bob * 2.5, -30, WIDTH + 60), y = wrap(p.y + p.vy * frames + (motion.swirl ? Math.cos(time / 1100 + p.sway) * swirl * 0.5 : 0), camera - 40, HEIGHT + 80);
        const pulse = motion.flicker ? 0.5 + 0.5 * Math.abs(Math.sin(time / 70 + p.sway * 13) * Math.sin(time / 190 + p.sway * 5)) : motion.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + p.sway)) : 1;
        place.set(x, -y, p.z);
        if (motion.streak) {
          turn.setFromAxisAngle(axis, Math.atan2(p.vx, p.vy));
          size.set(p.size, motion.streak * scale, p.size);
        } else if (motion.flat) {
          turn.setFromEuler(tumble.set(time / 700 + p.sway * 2, time / 900 + p.sway, time / 500 + p.sway));
          size.setScalar(p.size);
        } else {
          turn.identity();
          size.set(p.size * pulse * (1 + bob * 0.12), p.size * pulse * (1 - bob * 0.12), p.size * pulse);
        }
        flock.setMatrixAt(i, matrix.compose(place, turn, size));
      });
      flock.instanceMatrix.needsUpdate = true;
    },
  };
}

function particles(motion, color, glow, rand) {
  const geometry = motion.streak ? shape('streak', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5)) : motion.flat ? shape('petal', () => new THREE.SphereGeometry(1, 6, 4).scale(1, 0.45, 0.25)) : pebble;
  const tinted = opacity => (motion.colors ? new THREE.MeshBasicMaterial({ transparent: true, opacity }) : glow ? glowing(color, opacity) : toon(color, { opacity, emissive: 0.4 }));
  const opacity = motion.opacity ?? 0.9, layers = [swarm(motion, geometry, tinted(opacity), motion.count ?? 45, FAR, 1, rand)];
  if (motion.near) {
    const near = swarm(motion, geometry, tinted(Math.round(opacity * 11) / 20), motion.near, NEAR, 1.5, rand);
    near.node.userData.overlay = true;
    layers.push(near);
  }
  return { nodes: layers.map(layer => layer.node), update: (time, camera) => { for (const layer of layers) layer.update(time, camera); } };
}

function splashes(tops, rand) {
  const count = 16, period = 520, rings = new THREE.InstancedMesh(shape('splash', () => new THREE.TorusGeometry(1, 0.09, 4, 18).rotateX(Math.PI / 2 - 0.45)), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), count);
  const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), size = new THREE.Vector3(), still = new THREE.Quaternion(), fade = new THREE.Color(0, 0, 0), lean = rand();
  rings.userData.overlay = true;
  rings.frustumCulled = false;
  for (let i = 0; i < count; i++) rings.setColorAt(i, fade);
  return {
    nodes: [rings],
    update(time, camera) {
      const [lo, hi] = within(tops, camera);
      for (let i = 0; i < count; i++) {
        const beat = time / period + i / count + lean, cycle = Math.floor(beat), age = beat - cycle, seed = cycle * 61 + i * 7;
        const top = hi > lo ? tops[lo + Math.floor(hashed(seed) * (hi - lo))] : null;
        place.set(top ? top.x + hashed(seed + 1) * TILE : -1e4, -(top?.y ?? 0) + 1.8, -34 + hashed(seed + 2) * 46);
        size.setScalar(1.5 + age * 6);
        rings.setMatrixAt(i, matrix.compose(place, still, size));
        rings.setColorAt(i, fade.setScalar((1 - age) * 0.55));
      }
      rings.instanceMatrix.needsUpdate = true;
      rings.instanceColor.needsUpdate = true;
    },
  };
}

function frosting(tops, rand) {
  const glints = tops.filter(() => rand() < 0.7).map(top => ({ x: top.x + rand() * TILE, y: top.y - 4 - rand() * 3, z: -30 + rand() * 46, size: 1.5 + rand() * 1.3, phase: rand() * Math.PI * 2 }));
  const sparkle = new THREE.InstancedMesh(gem, glowing('hsl(200 100% 97% / 1)'), Math.max(1, glints.length));
  const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
  sparkle.frustumCulled = false;
  return {
    nodes: [sparkle],
    update(time, camera) {
      const [lo, hi] = within(glints, camera);
      for (let i = lo; i < hi; i++) {
        const g = glints[i], shine = Math.max(0, Math.sin(time / 520 + g.phase * 3) * 1.6 - 0.6);
        sparkle.setMatrixAt(i - lo, matrix.compose(place.set(g.x, -g.y, g.z), turn.setFromAxisAngle(axis, time / 900 + g.phase), size.set(g.size * shine, g.size * shine * 1.8, g.size * shine)));
      }
      sparkle.count = hi - lo;
      sparkle.instanceMatrix.needsUpdate = true;
    },
  };
}

let haze = null;

const hazeTexture = () => (haze ??= blurredDisc());

function blurredDisc() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function banks(count, colour, rand) {
  const [far, close] = [0.24, 0.12].map(opacity => new THREE.MeshBasicMaterial({ map: hazeTexture(), color: colour, transparent: true, opacity, depthWrite: false }));
  const puffs = Array.from({ length: count }, (_, i) => {
    const near = i % 3 === 0, puff = new THREE.Mesh(shape('bank', () => new THREE.PlaneGeometry(1, 1)), near ? close : far);
    puff.userData = { overlay: true, x: rand() * WIDTH, y: rand() * HEIGHT, z: near ? 40 + rand() * 120 : -70 + rand() * 50, drift: 0.008 + rand() * 0.012, phase: rand() * Math.PI * 2 };
    puff.scale.set(260 + rand() * 200, 50 + rand() * 40, 1);
    return puff;
  });
  return {
    nodes: puffs,
    update(time, camera) {
      for (const puff of puffs) {
        const { x, y, z, drift, phase } = puff.userData;
        puff.position.set(wrap(x + time * drift, -240, WIDTH + 480), -wrap(y + Math.sin(time / 3000 + phase) * 12, camera - 60, HEIGHT + 120), z);
      }
    },
  };
}

function weather(kind, level, palette, theme, rand) {
  const motion = MOTION[kind];
  if (!motion) return [];
  if (motion.banks) return [banks(motion.banks, colorOf(palette.bgBottom).lerp(new THREE.Color(1, 1, 1), 0.45), rand)];
  const tops = motion.splash || motion.settle ? topsOf(level) : [];
  return [particles(motion, palette[theme.mote], motion.glow || (kind === 'spores' && theme.glow), rand), ...(motion.splash ? [splashes(tops, rand)] : []), ...(motion.settle ? [frosting(tops, rand)] : [])];
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
  const skies = (WEATHER[theme.id] ?? [theme.ambient]).flatMap(kind => weather(kind, level, palette, theme, rand)), sky = new THREE.Group();
  for (const part of skies) sky.add(...part.nodes);
  group.add(sky);
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
      sky.visible = current;
      if (current) for (const part of skies) part.update(time, camera);
      for (const critter of flock) {
        const t = (time / 1000) * critter.speed + critter.seed, [rx, ry] = maker.roam;
        critter.root.position.set(critter.home.x + Math.sin(t * 0.7) * rx, -(critter.home.y + Math.sin(t * 1.3) * ry), critter.home.z + Math.sin(t) * 10);
        critter.flap(t, Math.cos(t * 0.7));
      }
    },
  };
}
