import { WIDTH, TILE, floodLevel } from '../world/level.js?v=92c407e';
import { alpha } from '../art/themes.js?v=92c407e';
import { THREE, colorOf, opacityOf, toon, glowing, mesh, shape, sphere, cone } from './toon.js?v=92c407e';
import { flexible, bendInto } from './mech-kit.js?v=92c407e';
import { sized } from './kit.js?v=92c407e';

const FRONT_Z = 32;
const BACK_Z = -50;
const MARGIN = 120;
const COLUMNS = 96;
const SMOKE = 'hsl(20 30% 4% / 0.92)';
const VOID = 'hsl(260 45% 4% / 0.94)';
const mist = a => `hsl(200 30% 92% / ${a})`;
const flat = () => 0;

const CHASERS = {
  water: p => ({ stops: [[0, p.hazardGlow]], line: p.hazard, wave: (x, t) => Math.sin(x / 18 + t / 180) * 3 }),
  ash: p => ({
    stops: [[0, alpha(p.accent, 0.6)], [42, alpha(p.hazard, 0.6)], [120, SMOKE]], line: p.accentLight, wave: (x, t) => Math.sin(x / 11 + t / 90) * 4 + Math.sin(x / 3.7 - t / 60) * 2,
    motes: { count: 28, colour: i => (i % 3 ? p.hazard : p.accent), size: 2.4, at: (i, t) => { const rise = (t / 14 + i * 53) % 90; return [(i * 97 + Math.sin(t / 500 + i) * 12 + WIDTH) % WIDTH, -rise, Math.max(0, 0.9 - rise / 100)]; } },
  }),
  fog: p => ({
    stops: [[-40, mist(0)], [0, mist(0.55)], [60, mist(0.85)]], wave: flat, spikes: p.accentLight,
    motes: { count: 20, colour: () => mist(0.6), size: 2.2, at: (i, t) => [(i * 113 + (t / 40) * (1 + (i % 3))) % WIDTH, -((i * 29) % 50) - Math.sin(t / 300 + i) * 4, 1] },
  }),
  void: p => ({
    stops: [[-50, alpha(p.accent, 0)], [0, alpha(p.accent, 0.35)], [1, VOID]], wave: flat, tendrils: p.accent,
    motes: { count: 16, colour: () => p.accent, size: 2.2, at: (i, t) => { const fall = (t / 10 + i * 41) % 70; return [(i * 131 + 40) % WIDTH, fall - 70, fall / 70]; } },
  }),
  growth: p => ({ stops: [[0, alpha(p.rockEdge, 0.7)], [100, alpha(p.edgeDeep, 0.9)]], wave: flat, domes: p.rockEdge, sprouts: p.accent }),
  sand: p => ({
    stops: [[-30, alpha(p.rockDeep, 0)], [40, alpha(p.rockDeep, 0.9)]], line: alpha(p.rockEdge, 0.9), wave: (x, t) => Math.sin(x / 40 + t / 600) * 5,
    motes: { count: 30, colour: () => alpha(p.rockEdge, 0.7), size: 1.6, at: (i, t) => [(i * 89 + (t / 6) * (1 + (i % 4))) % WIDTH, -((i * 23) % 45), 1] },
  }),
};

const columnX = k => -MARGIN + (k / COLUMNS) * (WIDTH + 2 * MARGIN);

function curtain(stops) {
  const offsets = [...stops.map(([offset]) => offset), Infinity], rows = offsets.length, width = COLUMNS + 1;
  const position = new THREE.BufferAttribute(new Float32Array(rows * width * 3), 3), colour = new THREE.BufferAttribute(new Float32Array(rows * width * 4), 4), index = [];
  offsets.forEach((offset, r) => {
    const [, css] = stops[Math.min(r, stops.length - 1)], tone = colorOf(css), a = opacityOf(css);
    for (let k = 0; k < width; k++) {
      position.setXYZ(r * width + k, columnX(k), 0, FRONT_Z);
      colour.setXYZW(r * width + k, tone.r, tone.g, tone.b, a);
      if (r < rows - 1 && k < COLUMNS) { const i = r * width + k; index.push(i, i + width, i + 1, i + 1, i + width, i + width + 1); }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', colour);
  geometry.setIndex(index);
  const node = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  node.frustumCulled = false;
  return {
    node,
    shape(depth, wave, time) {
      offsets.forEach((offset, r) => {
        for (let k = 0; k < width; k++) position.setY(r * width + k, -(offset === Infinity ? depth : Math.min(offset, depth) + (offset <= 0 ? wave(columnX(k), time) : 0)));
      });
      position.needsUpdate = true;
    },
  };
}

function ribbon(css, depthwise) {
  const geometry = depthwise ? new THREE.PlaneGeometry(1, FRONT_Z - BACK_Z, COLUMNS, 1).rotateX(-Math.PI / 2).translate(0, 0, (FRONT_Z + BACK_Z) / 2) : new THREE.PlaneGeometry(1, 3, COLUMNS, 1).translate(0, 0, FRONT_Z + 0.5);
  const position = geometry.attributes.position, rest = position.array.slice();
  for (let i = 0; i < position.count; i++) position.setX(i, columnX(Math.round((rest[i * 3] + 0.5) * COLUMNS)));
  const node = new THREE.Mesh(geometry, depthwise ? toon(css, { opacity: Math.min(0.75, opacityOf(css) + 0.25) }) : toon(css, { opacity: opacityOf(css), emissive: 0.45 }));
  node.frustumCulled = false;
  return {
    node,
    shape(wave, time) {
      for (let i = 0; i < position.count; i++) position.setY(i, rest[i * 3 + 1] - wave(position.getX(i), time));
      position.needsUpdate = true;
    },
  };
}

function extras(look) {
  const group = new THREE.Group(), steps = [];
  if (look.motes) {
    const { count, colour, size, at } = look.motes;
    const motes = Array.from({ length: count }, (_, i) => mesh(shape('mote', () => new THREE.BoxGeometry(1, 1, 1)), glowing(colour(i)), 0));
    group.add(...motes);
    steps.push(time => motes.forEach((mote, i) => {
      const [x, y, fade] = at(i, time);
      mote.position.set(x, -y, FRONT_Z + 1);
      mote.scale.setScalar(size * Math.max(0.05, fade));
    }));
  }
  if (look.spikes) {
    const spikes = Array.from({ length: 14 }, () => mesh(cone, glowing(look.spikes, 0.8), 0));
    group.add(...spikes);
    steps.push(time => spikes.forEach((spike, i) => {
      const tall = 10 + ((i * 37) % 14) + Math.sin(time / 400 + i) * 2;
      spike.scale.set(6, tall + 4, 4);
      spike.position.set((i * 71 + 20) % WIDTH, (tall + 4) / 2 - 4, FRONT_Z - 2);
    }));
  }
  if (look.tendrils) {
    const strands = Array.from({ length: 9 }, () => flexible(7, 0.9, glowing(look.tendrils, 0.8), 0, 5));
    group.add(...strands.map(strand => strand.node));
    steps.push(time => strands.forEach((strand, i) => {
      const x = i * (WIDTH / 8) + Math.sin(time / 700 + i) * 20;
      for (let k = 0; k < 7; k++) { strand.xs[k] = x + Math.sin(time / 250 + i + k * 1.3) * k * 2.3; strand.ys[k] = k * 9 - 2; }
      strand.trace(FRONT_Z - 1);
    }));
  }
  if (look.domes) {
    const domes = Array.from({ length: Math.ceil(WIDTH / 18) }, () => mesh(sphere, toon(look.domes), 0));
    group.add(...domes);
    steps.push(time => domes.forEach((dome, k) => {
      const x = k * 18, r = 8 + ((x * 7) % 9);
      dome.scale.set(r, r, 6);
      dome.position.set(x + 9, -(4 + Math.sin(time / 350 + x / 30) * 2), FRONT_Z - 7);
    }));
  }
  if (look.sprouts) {
    const sprouts = Array.from({ length: 8 }, () => ({ stem: flexible(9, 1.1, toon(look.sprouts), 0.8, 5), bud: sized(mesh(sphere, toon(look.sprouts), 0.8), 2.5) }));
    for (const { stem, bud } of sprouts) group.add(stem.node, bud);
    steps.push(time => sprouts.forEach(({ stem, bud }, i) => {
      const x = i * (WIDTH / 7) + 30, sway = Math.sin(time / 420 + i) * 6, reach = 24 + ((i * 13) % 16);
      bendInto(stem, x, 2, x + sway, -reach / 2, x - sway, -reach);
      stem.trace(FRONT_Z - 3);
      bud.position.set(x - sway, reach, FRONT_Z - 3);
    }));
  }
  return { group, update: time => { for (const step of steps) step(time); } };
}

export function flood(level, p, theme) {
  const group = new THREE.Group();
  if (!level.rules.flood) return { group, update() {} };
  const look = CHASERS[theme.chaser](p), front = curtain(look.stops), line = look.line && ribbon(look.line, false), surface = look.line && ribbon(look.stops[0][1], true), more = extras(look);
  group.add(front.node, more.group, ...(line ? [line.node, surface.node] : []));
  return {
    group,
    update(state, time, lvl, view, current) {
      const y = floodLevel(level, state.tide);
      group.visible = current && y < level.height;
      if (!group.visible) return;
      group.position.y = -y;
      front.shape(level.height - y, look.wave, time);
      line?.shape(look.wave, time);
      surface?.shape(look.wave, time);
      more.update(time);
    },
  };
}

export function exitBeam(level, p) {
  const group = new THREE.Group();
  if (level.custom) return { group, update() {} };
  const e = level.exit, tall = 4 * TILE, geometry = new THREE.CylinderGeometry(1, 1, 1, 24, 4, true), heights = geometry.attributes.position;
  geometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({ length: heights.count * 4 }, (_, i) => (i % 4 === 3 ? heights.getY(i >> 2) + 0.5 : 1)), 4));
  const shaft = new THREE.MeshBasicMaterial({ color: colorOf(p.accent), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const core = new THREE.MeshBasicMaterial({ color: colorOf(p.accentLight), vertexColors: true, transparent: true, depthWrite: false });
  const outer = new THREE.Mesh(geometry, shaft), inner = new THREE.Mesh(geometry, core);
  outer.scale.set(Math.max(2, e.w - 8) / 2, tall, 16);
  inner.scale.set(Math.max(1, e.w - 8) / 5, tall, 6);
  const motes = Array.from({ length: 6 }, () => mesh(sphere, glowing(p.accentLight), 0));
  const beam = new THREE.Group();
  beam.add(outer, inner, ...motes);
  beam.position.set(e.x + e.w / 2, -(e.y + tall / 2), 0);
  group.add(beam);
  return {
    group,
    update(state, time) {
      shaft.opacity = 0.55 + Math.sin(time / 260) * 0.2;
      core.opacity = shaft.opacity * 0.6;
      motes.forEach((mote, k) => {
        const rise = (time / 2200 + k / motes.length) % 1;
        mote.position.set(Math.sin(time / 500 + k * 2.1) * (e.w / 2 - 10), (rise - 0.5) * tall, 4);
        mote.scale.setScalar(2.2 * (1 - rise));
      });
    },
  };
}
