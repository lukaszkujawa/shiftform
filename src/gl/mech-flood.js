import { WIDTH, TILE, floodLevel } from '../world/level.js';
import { alpha } from '../art/themes.js';
import { THREE, colorOf, opacityOf, toon, glowing, mesh, shape, sphere, cone, clock, shining } from './toon.js';
import { flexible, bendInto } from './mech-kit.js';
import { sized } from './kit.js';
import { edgeMaterial, floodBody } from './surfaces.js';

const FRONT_Z = 32;
const BACK_Z = -50;
const MARGIN = 120;
const COLUMNS = 96;
const BAND = 12;
const SPAN = WIDTH + 2 * MARGIN;
const SMOKE = 'hsl(20 30% 4% / 0.92)';
const VOID = 'hsl(260 45% 4% / 0.94)';
const mist = a => `hsl(200 30% 92% / ${a})`;
const flat = () => 0;

const CHASERS = {
  water: p => ({ stops: [[0, p.hazardGlow]], edge: [p.hazard, 'hsl(190 100% 94% / 1)'], sheen: 'hsl(190 100% 90% / 1)', wave: (x, t) => Math.sin(x / 18 + t / 180) * 3 }),
  ash: p => ({
    stops: [[0, alpha(p.accent, 0.6)], [42, alpha(p.hazard, 0.6)], [120, SMOKE]], edge: [p.hazard, 'hsl(45 100% 75% / 1)'], sheen: p.accent, wave: (x, t) => Math.sin(x / 11 + t / 90) * 4 + Math.sin(x / 3.7 - t / 60) * 2,
    motes: { count: 28, colour: i => (i % 3 ? p.hazard : p.accent), size: 2.4, at: (i, t) => { const rise = (t / 14 + i * 53) % 90; return [(i * 97 + Math.sin(t / 500 + i) * 12 + WIDTH) % WIDTH, -rise, Math.max(0, 0.9 - rise / 100)]; } },
  }),
  fog: p => ({
    stops: [[-40, mist(0)], [0, mist(0.55)], [60, mist(0.85)]], edge: [mist(1), 'hsl(0 0% 100% / 1)'], sheen: 'hsl(0 0% 100% / 1)', wave: flat, spikes: p.accentLight,
    motes: { count: 20, colour: () => mist(0.6), size: 2.2, at: (i, t) => [(i * 113 + (t / 40) * (1 + (i % 3))) % WIDTH, -((i * 29) % 50) - Math.sin(t / 300 + i) * 4, 1] },
  }),
  void: p => ({
    stops: [[-50, alpha(p.accent, 0)], [0, alpha(p.accent, 0.35)], [1, VOID]], edge: [p.accent, p.accentLight], sheen: p.accentLight, wave: flat, tendrils: p.accent,
    motes: { count: 16, colour: () => p.accent, size: 2.2, at: (i, t) => { const fall = (t / 10 + i * 41) % 70; return [(i * 131 + 40) % WIDTH, fall - 70, fall / 70]; } },
  }),
  growth: p => ({ stops: [[0, alpha(p.rockEdge, 0.7)], [100, alpha(p.edgeDeep, 0.9)]], edge: [p.edgeDeep, p.accentLight], sheen: p.edgeLight, wave: flat, domes: p.rockEdge, sprouts: p.accent }),
  sand: p => ({
    stops: [[-30, alpha(p.rockDeep, 0)], [40, alpha(p.rockDeep, 0.9)]], edge: [p.rockEdge, p.edgeLight], sheen: p.edgeLight, wave: (x, t) => Math.sin(x / 40 + t / 600) * 5,
    motes: { count: 30, colour: () => alpha(p.rockEdge, 0.7), size: 1.6, at: (i, t) => [(i * 89 + (t / 6) * (1 + (i % 4))) % WIDTH, -((i * 23) % 45), 1] },
  }),
};

const columnX = k => -MARGIN + (k / COLUMNS) * SPAN;

function curtain(stops, kind, sheen) {
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
  const node = new THREE.Mesh(geometry, floodBody(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }), kind, sheen));
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

function ribbon(material, depthwise) {
  const geometry = depthwise ? new THREE.PlaneGeometry(1, FRONT_Z - BACK_Z, COLUMNS, 1).rotateX(-Math.PI / 2).translate(0, 0, (FRONT_Z + BACK_Z) / 2) : new THREE.PlaneGeometry(1, BAND, COLUMNS, 1).translate(0, 0, FRONT_Z + 0.5);
  const position = geometry.attributes.position, rest = position.array.slice();
  for (let i = 0; i < position.count; i++) position.setX(i, columnX(Math.round((rest[i * 3] + 0.5) * COLUMNS)));
  const node = new THREE.Mesh(geometry, material);
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
  const look = CHASERS[theme.chaser](p), [, top] = look.stops[0], front = curtain(look.stops, theme.chaser, look.sheen), more = extras(look);
  const edge = ribbon(edgeMaterial(theme.chaser, ...look.edge, SPAN), false), surface = look.wave === flat ? null : ribbon(toon(top, { opacity: Math.min(0.75, opacityOf(top) + 0.25) }), true);
  group.add(front.node, more.group, edge.node, ...(surface ? [surface.node] : []));
  return {
    group,
    update(state, time, lvl, view, current) {
      const y = floodLevel(level, state.tide);
      group.visible = current && y < level.height;
      if (!group.visible) return;
      group.position.y = -y;
      front.shape(level.height - y, look.wave, time);
      edge.shape(look.wave, time);
      surface?.shape(look.wave, time);
      more.update(time);
    },
  };
}

const PILLAR = {
  vertexShader: 'varying vec3 vNormalView; varying vec3 vView; varying vec2 vUv; void main() { vec4 seen = modelViewMatrix * vec4(position, 1.0); vNormalView = normalize(normalMatrix * normal); vView = -seen.xyz; vUv = uv; gl_Position = projectionMatrix * seen; }',
  fragmentShader: `uniform float clock;
uniform vec3 tint;
uniform vec3 core;
uniform float strength;
varying vec3 vNormalView;
varying vec3 vView;
varying vec2 vUv;
void main() {
  float rim = pow(clamp(1.0 - abs(dot(normalize(vNormalView), normalize(vView))), 0.0, 1.0), 1.6);
  float spiral = smoothstep(0.55, 1.0, sin((vUv.x * 3.0 + vUv.y * 4.0 - clock * 1.6) * 6.2831) * 0.5 + 0.5);
  float pulse = smoothstep(0.75, 1.0, sin((vUv.y * 3.0 - clock * 1.2) * 6.2831) * 0.5 + 0.5);
  float height = pow(clamp(vUv.y, 0.0, 1.0), 1.6);
  vec3 colour = mix(tint, core, clamp(spiral * 0.7 + pulse * 0.5 + rim * 0.4, 0.0, 1.0));
  gl_FragColor = vec4(colour, (0.1 + rim * 0.5 + spiral * 0.3 + pulse * 0.2) * height * strength);
}`,
};

export function exitBeam(level, p) {
  const group = new THREE.Group();
  if (level.custom) return { group, update() {} };
  const e = level.exit, tall = 5 * TILE, radius = Math.max(12, e.w / 2 - 2);
  const light = (inner, strength) => Object.assign(new THREE.ShaderMaterial({ ...PILLAR, uniforms: { clock, tint: { value: colorOf(inner ? p.accentLight : p.accent) }, core: { value: colorOf('hsl(55 100% 96% / 1)') }, strength: { value: strength } }, transparent: true, depthWrite: false, side: inner ? THREE.FrontSide : THREE.DoubleSide }), { userData: { bloom: true } });
  const column = new THREE.CylinderGeometry(1, 1, 1, 36, 1, true).translate(0, -0.5, 0);
  const outer = new THREE.Mesh(column, light(false, 0.9)), inner = new THREE.Mesh(column, light(true, 0.7));
  outer.scale.set(radius, tall, radius);
  inner.scale.set(radius * 0.45, tall, radius * 0.45);
  const mouth = mesh(new THREE.TorusGeometry(radius, 2.2, 10, 40).rotateX(Math.PI / 2), glowing(p.accentLight), 0);
  const motes = Array.from({ length: 14 }, () => mesh(sphere, glowing('hsl(55 100% 92% / 1)'), 0));
  const beam = new THREE.Group();
  beam.add(outer, inner, mouth, ...motes);
  beam.position.set(e.x + e.w / 2, -e.y, 0);
  group.add(shining(beam, p.accent, { power: 1.4, reach: 200 }));
  return {
    group,
    update(state, time) {
      mouth.scale.setScalar(1 + Math.sin(time / 300) * 0.05);
      motes.forEach((mote, k) => {
        const rise = (time / 1800 + k / motes.length) % 1, angle = k * 2.4 + time / 700;
        mote.position.set(Math.cos(angle) * radius * 0.75, -tall * (1 - rise), Math.sin(angle) * radius * 0.75);
        mote.scale.setScalar(1.8 * Math.sin(Math.PI * rise));
      });
    },
  };
}
