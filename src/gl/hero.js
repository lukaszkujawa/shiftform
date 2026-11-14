import { playerSize, FALL_DAMAGE_SPEED } from '../world/physics.js';
import { TILE, SOLID, ONE_WAY, tileAt } from '../world/level.js';
import { moodOf } from '../art/avatar.js';
import { THREE, toon, mesh, roundBox, sphere } from './toon.js';

const FLIP_FRAMES = 24;
const LOOK = { eye: 'hsl(28 45% 12% / 1)', shine: 'hsl(0 0% 100% / 1)', blush: 'hsl(350 90% 72% / 1)', feet: 'hsl(28 40% 22% / 1)', mouth: 'hsl(350 60% 35% / 1)' };
const BODY = { w: 20, h: 24, d: 16 };
const SHADOW_REACH = 10 * TILE;

function groundBelow(level, x, y, g) {
  const col = Math.floor(x / TILE);
  for (let row = Math.floor(y / TILE); Math.abs(row * TILE - y) <= SHADOW_REACH; row += g) {
    const tile = tileAt(level, col, row);
    if (tile === SOLID || (tile === ONE_WAY && g > 0)) return g > 0 ? row * TILE : (row + 1) * TILE;
  }
  return null;
}

function part(geometry, css, outline = 0, scale = [1, 1, 1], at = [0, 0, 0]) {
  const piece = mesh(geometry, toon(css), outline);
  piece.scale.set(...scale);
  piece.position.set(...at);
  return piece;
}

export function createHero() {
  const group = new THREE.Group(), root = new THREE.Group(), tilt = new THREE.Group(), body = new THREE.Group(), face = new THREE.Group();
  const blot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x2a1a0c, transparent: true, depthWrite: false }));
  group.add(root, blot);
  root.add(tilt);
  tilt.add(body);
  const torso = mesh(roundBox(BODY.w, BODY.h, BODY.d, 7), toon('hsl(45 55% 96% / 1)'), 1.3);
  body.add(torso, face);
  const eyes = [-1, 1].map(side => {
    const eye = part(sphere, LOOK.eye, 0, [2, 2.6, 1.2], [side * 3.6, 3, BODY.d / 2 + 0.2]);
    eye.add(part(sphere, LOOK.shine, 0, [0.35, 0.3, 0.4], [0.35, 0.35, 0.7]));
    face.add(eye);
    return eye;
  });
  for (const side of [-1, 1]) face.add(part(sphere, LOOK.blush, 0, [2.4, 1.2, 0.6], [side * 7, -1, BODY.d / 2 - 0.3]));
  const mouth = part(sphere, LOOK.mouth, 0, [1.6, 1, 0.6], [0, -2.5, BODY.d / 2 + 0.1]);
  face.add(mouth);
  const feet = [-1, 1].map(side => {
    const foot = part(sphere, LOOK.feet, 1, [3.4, 2.4, 4.4], [side * 5, -BODY.h / 2, 1]);
    tilt.add(foot);
    return foot;
  });
  const hands = [-1, 1].map(side => {
    const hand = part(sphere, 'hsl(45 55% 96% / 1)', 1, [2.6, 2.6, 2.6], [side * (BODY.w / 2 + 1.5), -2, 0]);
    body.add(hand);
    return hand;
  });

  function update(level, s, avatar, palette) {
    const { w, h } = playerSize(level.rules);
    group.visible = !s.dead && s.barrel < 0;
    if (!group.visible) return;
    const size = w / BODY.w, g = s.gravDir;
    const ground = groundBelow(level, s.x + w / 2, g > 0 ? s.y + h : s.y, g);
    blot.visible = ground !== null;
    if (blot.visible) {
      const near = 1 - Math.abs(ground - (g > 0 ? s.y + h : s.y)) / SHADOW_REACH;
      blot.position.set(s.x + w / 2, -ground + g * 0.6, 0);
      blot.rotation.x = -g * Math.PI / 2;
      blot.scale.set(w * (0.35 + 0.35 * near), 7 * (0.35 + 0.35 * near), 1);
      blot.material.opacity = 0.35 * near;
    }
    const stretch = Math.min(1.35, Math.max(0.6, 1 + Math.abs(s.vy) * 0.015 + avatar.squash));
    root.position.set(s.x + w / 2, -(s.y + h / 2), 0);
    root.scale.set(size, size * g, size);
    const flip = (s.frame - s.flipFrame) / FLIP_FRAMES;
    root.rotation.z = flip >= 0 && flip < 1 && !s.grounded ? -(1 - (1 - flip) ** 2) * Math.PI * 2 * s.facing : 0;
    tilt.rotation.z = -avatar.lean;
    tilt.rotation.y = s.climbing ? Math.PI : s.facing * 0.5 + avatar.lookX * 0.15;
    body.scale.set(1 / stretch, stretch, 1 / stretch);
    body.position.y = ((avatar.headBumped ? 1 : -1) * (h / size) * (stretch - 1)) / 2 + 1.5;
    const shattering = level.rules.fallDamage && s.vy * g >= FALL_DAMAGE_SPEED - 0.6;
    const base = shattering ? palette.hazard : avatar.tint ?? palette.player;
    torso.material = toon(base);
    for (const hand of hands) hand.material = torso.material;
    const mood = moodOf(avatar, s);
    const open = avatar.blink > 0 || mood === 'asleep' || mood === 'joy' ? 0.15 : mood === 'drowsy' ? 0.5 : 1;
    const wide = mood === 'scared' ? 1.35 : 1;
    eyes.forEach(eye => eye.scale.set(2 * wide, 2.6 * open * wide, 1.2));
    face.position.set(avatar.lookX * 1.2, avatar.lookY * g * 1.2, 0);
    mouth.scale.set(mood === 'joy' ? 2.4 : 1.6, mood === 'scared' || mood === 'joy' ? 1.8 : 0.9, 0.6);
    const walking = s.grounded || s.climbing;
    feet.forEach((foot, k) => {
      const side = k ? 1 : -1, lift = walking ? Math.max(0, Math.sin(avatar.stride + (side > 0 ? Math.PI : 0))) * 3 : 2;
      foot.position.set(side * (walking ? 5 : 3.5), -BODY.h / 2 + 1 + lift, 1);
    });
    hands.forEach((hand, k) => {
      const side = k ? 1 : -1, swing = walking ? Math.sin(avatar.stride + (side > 0 ? 0 : Math.PI)) * 2 : 0;
      hand.position.set(side * (BODY.w / 2 + 1.5), s.climbing || s.rope >= 0 ? 10 : !s.grounded ? 3 : -2 + swing * 0.5, swing);
    });
  }

  return { group, update };
}
