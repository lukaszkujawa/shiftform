import { objectRect, slain, cycleAt, WIDTH, HEIGHT, TILE } from '../world/level.js';
import { impX } from '../world/imp.js';
import { playerSize } from '../world/physics.js';
import { lookOf } from '../art/monsters.js';
import { blink } from '../art/life-kit.js';
import { tint } from '../art/themes.js';
import { THREE, glowing, roundBox, sphere, cone, cylinder, seeded } from './toon.js';
import { EYE_WHITE, INK, part } from './cast-kit.js';
import { lurker } from './cast-lurkers.js';

const GAZE_RANGE = 260;
const SHAPES = {
  eel: 'eel', jelly: 'jelly', urchin: 'spiky', puffer: 'spiky', flapper: 'winged', spider: 'spider',
};
const LEGGED = new Set(['patroller', 'crawler', 'hopper', 'leaper', 'spitter']);

function addEyes(head, look, r, front) {
  const n = look.eyes, size = r * 0.32 * look.eyeSize;
  return Array.from({ length: n }, (_, k) => {
    const eye = part(sphere, EYE_WHITE, [size, size, size * 0.6], [(k - (n - 1) / 2) * size * 2.3, r * 0.15 + (n === 3 && k === 1 ? size * 0.9 : 0), front], 0.6);
    const pupil = part(sphere, INK, [look.pupil, look.pupil, 0.5], [0, 0, 0.75]);
    eye.add(pupil);
    if (look.angry) eye.add(part(cylinder, INK, [0.2, 2.2, 0.2], [0, 1.25, 0.6]).rotateZ(((k < (n - 1) / 2 ? 1 : -1) * Math.PI) / 2.6));
    head.add(eye);
    return { eye, pupil, size };
  });
}

export function createMonster(o, palette) {
  const look = lookOf(o), fill = tint(palette.hazard, look.hue, look.light), dark = tint(fill, 0, -18);
  const shape = SHAPES[o.kind] ?? (LEGGED.has(o.kind) ? 'legged' : 'blob');
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const r = Math.min(o.w, o.h) / 2 * look.size;
  const skin = shape === 'eel' ? [o.w / 2, r * 0.55, r * 0.6] : shape === 'jelly' ? [r, r * 0.9, r] : [o.w / 2 * look.size, o.h / 2 * look.size, r];
  body.add(part(sphere, fill, skin, [0, shape === 'jelly' ? r * 0.2 : 0, 0], 1.2));
  const extras = [];
  if (look.spots) for (const m of look.marks) body.add(part(sphere, dark, [m.r * 1.2, m.r * 1.2, 0.6], [m.x * skin[0], -m.y * skin[1], skin[2] * 0.92]));
  if (shape === 'spiky') {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, spine = part(cone, dark, [2.4, r * 0.7, 2.4], [Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, (k % 2 ? 1 : -1) * r * 0.3], 0.6);
      spine.rotation.z = a - Math.PI / 2;
      body.add(spine);
    }
  }
  if (shape === 'jelly') {
    for (let k = 0; k < 5; k++) {
      const tentacle = part(cylinder, dark, [1.2, r * 0.9, 1.2], [(k - 2) * r * 0.38, -r * 0.8, 0]);
      body.add(tentacle);
      extras.push(tentacle);
    }
  }
  if (shape === 'winged') {
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.add(part(sphere, dark, [r * 0.9, r * 0.35, r * 0.15], [side * r * 0.85, 0, 0], 1));
      wing.position.set(side * r * 0.6, r * 0.2, -r * 0.2);
      wing.userData.side = side;
      body.add(wing);
      extras.push(wing);
    }
  }
  if (shape === 'spider' || shape === 'legged') {
    const count = shape === 'spider' ? 8 : 2;
    for (let k = 0; k < count; k++) {
      const side = k % 2 ? 1 : -1, row = Math.floor(k / 2);
      const leg = shape === 'spider'
        ? part(cylinder, INK, [0.9, r * 1.1, 0.9], [side * r * 1.1, -r * 0.2, (row - 1.5) * r * 0.35])
        : part(sphere, dark, [r * 0.32, r * 0.24, r * 0.4], [side * r * 0.5, -skin[1] * 0.95, 0], 0.8);
      if (shape === 'spider') leg.rotation.z = side * 1.1;
      leg.userData.side = side;
      body.add(leg);
      extras.push(leg);
    }
  }
  if (look.horns) for (const side of [-1, 1]) body.add(part(cone, 'hsl(40 40% 92% / 1)', [2.2, r * 0.6, 2.2], [side * r * 0.45, skin[1] * 0.95, 0], 0.7).rotateZ(-side * 0.35));
  if (look.antenna) {
    body.add(part(cylinder, INK, [0.6, r * 0.6, 0.6], [0, skin[1] + r * 0.25, 0]));
    body.add(part(sphere, 'hsl(48 100% 60% / 1)', [2, 2, 2], [0, skin[1] + r * 0.6, 0], 0.6));
  }
  const face = new THREE.Group();
  face.position.set(shape === 'eel' ? skin[0] * 0.55 : 0, shape === 'jelly' ? r * 0.25 : 0, 0);
  body.add(face);
  const eyes = addEyes(face, shape === 'eel' ? { ...look, eyes: 1 } : look, Math.min(skin[0], skin[1]), skin[2] * 0.85);
  if (look.fangs && shape !== 'jelly') for (let k = 0; k < look.fangs; k++) face.add(part(cone, EYE_WHITE, [1.4, 3.2, 1.4], [(k - (look.fangs - 1) / 2) * 4, -skin[1] * 0.45, skin[2] * 0.85]).rotateZ(Math.PI));
  const thread = shape === 'spider' ? part(cylinder, 'hsl(0 0% 92% / 1)', [0.4, 1, 0.4]) : null;
  if (thread) root.add(thread);

  function update(state, time, player, level) {
    const gone = slain(state, o);
    const still = !o.motion && !o.dx && !o.dy;
    root.visible = !gone || still;
    if (!root.visible) return;
    const rect = gone ? o : objectRect(o, state.clock), before = objectRect(o, state.clock - 1);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, t = (time / 1000) * look.tempo + look.phase;
    root.position.set(cx, -cy, 0);
    if (gone) {
      body.scale.set(1.3, 0.25, 1.3);
      body.position.y = -rect.h * 0.38;
      return;
    }
    const vx = rect.x - before.x, vy = rect.y - before.y;
    const facing = o.period ? Math.sign(o.dx || 1) * (cycleAt(o, state.clock) < o.period / 2 ? 1 : -1) : o.dir ?? 1;
    const heading = vx ? Math.sign(vx) : facing;
    const breath = 1 + 0.04 * Math.sin(t * 3), squash = Math.max(-0.25, Math.min(0.25, -vy * 0.06));
    body.scale.set(breath * (1 - squash), breath * (1 + squash), breath);
    body.rotation.y = heading * 0.45;
    if (shape === 'eel') body.rotation.z = Math.sin(t * 9) * 0.12;
    const dx = player.x - cx, dy = player.y - cy, dist = Math.hypot(dx, dy);
    const aim = dist < GAZE_RANGE && dist > 1 ? { x: dx / dist, y: dy / dist } : { x: heading, y: 0.1 };
    const open = blink(t, look.phase);
    for (const { eye, pupil } of eyes) {
      eye.scale.y = eye.scale.x * Math.max(0.15, open);
      pupil.position.set(aim.x * 0.45, -aim.y * 0.35, 0.75);
    }
    for (const extra of extras) {
      if (shape === 'winged') extra.rotation.z = extra.userData.side * Math.sin(t * 16) * 0.6;
      else if (shape === 'jelly') extra.rotation.z = Math.sin(t * 6 + extra.position.x) * 0.3;
      else if (shape === 'legged') extra.position.y = -skin[1] * 0.95 + Math.max(0, Math.sin(t * 14 + (extra.userData.side > 0 ? Math.PI : 0))) * (vx ? 2.5 : 0);
      else if (shape === 'spider') extra.rotation.z = extra.userData.side * (1.1 + Math.sin(t * 8 + extra.position.z) * 0.15);
    }
    if (thread) {
      const span = Math.max(1, rect.y - o.y + rect.h / 2 + 40);
      thread.scale.y = span;
      thread.position.y = span / 2;
    }
  }

  return { group: root, update };
}

const WINGS = ['hsl(48 98% 62% / 1)', 'hsl(330 85% 72% / 1)', 'hsl(200 90% 70% / 1)', 'hsl(20 95% 62% / 1)'];

function createButterfly(rand) {
  const root = new THREE.Group(), color = WINGS[Math.floor(rand() * WINGS.length)];
  root.add(part(cylinder, INK, [0.8, 6, 0.8]));
  const wings = [-1, 1].map(side => {
    const wing = new THREE.Group();
    wing.add(part(sphere, color, [4.5, 3.5, 0.5], [side * 4, 1.5, 0], 0.6));
    wing.add(part(sphere, color, [3, 2.4, 0.5], [side * 3, -2.2, 0], 0.6));
    root.add(wing);
    return wing;
  });
  return { group: root, wings, seed: rand() * 1000, speed: 0.4 + rand() * 0.6 };
}

export function createLife(level) {
  const rand = seeded(level.palette * 613 + level.rows);
  const group = new THREE.Group();
  const flock = Array.from({ length: Math.ceil(level.height / HEIGHT) * 3 }, () => {
    const fly = createButterfly(rand);
    fly.home = { x: rand() * WIDTH, y: rand() * level.height, z: -30 - rand() * 50 };
    group.add(fly.group);
    return fly;
  });
  return {
    group,
    update(time) {
      for (const fly of flock) {
        const t = (time / 1000) * fly.speed + fly.seed;
        fly.group.position.set(fly.home.x + Math.sin(t * 0.7) * 60, -(fly.home.y + Math.sin(t * 1.3) * 25), fly.home.z + Math.sin(t) * 10);
        fly.group.rotation.y = Math.cos(t * 0.7) > 0 ? 0.6 : -0.6;
        fly.wings.forEach((wing, k) => { wing.rotation.y = (k ? -1 : 1) * Math.abs(Math.sin(t * 14)) * 1.2; });
      }
    },
  };
}


export const CREATURES = { lurker: () => lurker };

const IMP = { body: 'hsl(358 74% 50% / 1)', line: 'hsl(350 66% 20% / 1)', horn: 'hsl(40 45% 84% / 1)', fork: 'hsl(235 16% 22% / 1)', flame: 'hsl(18 100% 54% / 1)', core: 'hsl(46 100% 64% / 1)' };

export function createImp() {
  const root = new THREE.Group(), turn = new THREE.Group(), body = new THREE.Group();
  root.add(turn);
  turn.add(body);
  body.add(part(roundBox(24, 32, 18, 9), IMP.body, [1, 1, 1], [0, 16, 0], 1.4));
  for (const side of [-1, 1]) {
    body.add(part(cone, IMP.horn, [3, 11, 3], [side * 7, 34, 0], 1).rotateZ(-side * 0.5));
    const eye = part(sphere, EYE_WHITE, [3.6, 3.6, 2], [side * 5 + 1, 21, 9], 0.6);
    eye.add(part(sphere, INK, [0.5, 0.5, 0.5], [0.3, 0, 0.7]));
    body.add(eye);
  }
  body.add(part(sphere, IMP.line, [4.5, 1.6, 1], [2, 12, 9]));
  body.add(part(cone, EYE_WHITE, [1.3, 3.5, 1.3], [4.5, 10.5, 9.3]).rotateZ(Math.PI));
  const tail = new THREE.Group();
  tail.add(part(cylinder, IMP.line, [1.2, 14, 1.2], [0, 7, 0]));
  tail.add(part(cone, IMP.line, [3, 6, 2], [0, 15, 0], 0.6));
  tail.position.set(-10, 6, -6);
  body.add(tail);
  const fork = new THREE.Group();
  fork.add(part(cylinder, IMP.fork, [1.1, 46, 1.1], [0, 23, 0]));
  for (const dx of [-5, 0, 5]) fork.add(part(cylinder, IMP.fork, [1, 9, 1], [dx, 46, 0]));
  fork.add(part(cylinder, IMP.fork, [1, 11, 1], [0, 41.5, 0]).rotateZ(Math.PI / 2));
  fork.position.set(17, 0, 4);
  turn.add(fork);
  const flames = Array.from({ length: 6 }, () => {
    const flame = new THREE.Group();
    flame.add(new THREE.Mesh(cone, glowing(IMP.flame, 0.9)).translateY(0.5));
    flame.add(new THREE.Mesh(cone, glowing(IMP.core)).translateY(0.3).translateZ(1));
    flame.children[1].scale.set(0.55, 0.55, 0.55);
    root.add(flame);
    return flame;
  });

  function update(level, state, time, difficulty) {
    const { w } = playerSize(level.rules), x = impX(level), toward = Math.sign(state.x + w / 2 - x) || 1;
    root.position.set(x, -(level.rows - 1) * TILE, -6);
    turn.scale.x = toward;
    turn.rotation.y = toward * 0.4;
    body.position.y = Math.abs(Math.sin(time / 420)) * 1.5;
    tail.rotation.z = 0.9 + Math.sin(time / 300) * 0.2;
    flames.forEach((flame, i) => {
      flame.visible = i < difficulty;
      flame.position.set((i - (difficulty - 1) / 2) * 15, 0, 10);
      flame.scale.set(6, 26 + 3 * Math.sin(time / 110 + i * 2), 6);
    });
  }

  return { group: root, update };
}
