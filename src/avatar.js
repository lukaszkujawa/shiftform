import { playerSize } from './physics.js?v=3166742';
import { levelIndex, objectRect, slain } from './level.js?v=3166742';
import { Rng, hashString } from './rng.js?v=3166742';
import { OUTFIT_KINDS } from './outfit-art.js?v=3166742';

const { hats: HATS, accessories: ACCESSORIES, glasses: GLASSES, patterns: PATTERNS, faces: FACES, necks: NECKS, backs: BACKS } = OUTFIT_KINDS;
export const TINTS = [
  ['Peach', 'hsl(35 90% 82% / 1)'], ['Mint', 'hsl(150 55% 80% / 1)'], ['Lilac', 'hsl(265 60% 86% / 1)'], ['Lemon', 'hsl(55 90% 80% / 1)'],
  ['Sky', 'hsl(200 80% 84% / 1)'], ['Rose', 'hsl(340 75% 85% / 1)'], ['Apricot', 'hsl(20 70% 80% / 1)'], ['Coral', 'hsl(5 80% 72% / 1)'],
  ['Teal', 'hsl(175 55% 62% / 1)'], ['Snow', 'hsl(0 0% 97% / 1)'], ['Slate', 'hsl(220 18% 66% / 1)'], ['Moss', 'hsl(95 40% 58% / 1)'],
  ['Cherry', 'hsl(355 75% 64% / 1)'], ['Gold', 'hsl(45 90% 62% / 1)'], ['Bubblegum', 'hsl(310 75% 78% / 1)'], ['Cocoa', 'hsl(25 40% 62% / 1)'],
  ['Ocean', 'hsl(215 70% 66% / 1)'], ['Lime', 'hsl(80 75% 62% / 1)'],
];
const BARE = { accessory: null, hat: null, glasses: null, pattern: null, tint: null, face: null, neck: null, back: null, spots: [] };
const SQUASH_SPRING = 0.22;
const SQUASH_DAMPING = 0.72;
const SWAY_SPRING = 0.1;
const SWAY_DAMPING = 0.86;
const LOOK_RANGE = 170;
const LOOK_EASE = 0.15;
const BLINK_FRAMES = 7;
const JOY_FRAMES = 50;
const SCARED_SPEED = 9;
const STRIDE = 9;
const RUN_SPEED = 2.5;
const SKID_SPEED = 3;
export const DROWSY_FRAMES = 360;
export const ASLEEP_FRAMES = 900;
const CHEERS = new Set(['item', 'stomp', 'cometPerfect', 'key', 'switch']);

export const RESTING = Object.freeze(createAvatar(''));

export const OUTFIT_ROWS = [
  { key: 'tint', title: 'Colour', options: [null, ...TINTS.map(([, tint]) => tint)] },
  { key: 'pattern', title: 'Pattern', options: [null, ...PATTERNS] },
  { key: 'top', title: 'Headwear', options: [null, ...HATS, ...ACCESSORIES] },
  { key: 'glasses', title: 'Glasses', options: [null, ...GLASSES] },
  { key: 'face', title: 'Face', options: [null, ...FACES] },
  { key: 'neck', title: 'Neck', options: [null, ...NECKS] },
  { key: 'back', title: 'Back', options: [null, ...BACKS] },
];

const spotsFrom = rng => Array.from({ length: 4 }, () => ({ x: rng.float(-0.3, 0.3), y: rng.float(0.12, 0.29), r: rng.float(0.05, 0.075) }));
const WARDROBE_SPOTS = spotsFrom(new Rng(hashString('wardrobe')));

function dressUp(seed) {
  if (!seed) return BARE;
  const rng = new Rng(hashString(seed));
  const hat = rng.chance(0.45) ? rng.pick(HATS) : null;
  return {
    hat,
    accessory: hat ? null : rng.pick(ACCESSORIES),
    glasses: rng.chance(0.4) ? rng.pick(GLASSES) : null,
    pattern: rng.chance(0.55) ? rng.pick(PATTERNS) : null,
    tint: rng.chance(0.6) ? rng.pick(TINTS)[1] : null,
    spots: spotsFrom(rng),
    face: rng.chance(0.2) ? rng.pick(FACES) : null,
    neck: rng.chance(0.25) ? rng.pick(NECKS) : null,
    back: rng.chance(0.15) ? rng.pick(BACKS) : null,
  };
}

export function wear(outfit) {
  return {
    hat: HATS.includes(outfit.top) ? outfit.top : null,
    accessory: ACCESSORIES.includes(outfit.top) ? outfit.top : null,
    glasses: outfit.glasses ?? null,
    pattern: outfit.pattern ?? null,
    tint: outfit.tint ?? null,
    face: outfit.face ?? null,
    neck: outfit.neck ?? null,
    back: outfit.back ?? null,
    spots: WARDROBE_SPOTS,
  };
}

export const outfitOf = avatar => ({ tint: avatar.tint, pattern: avatar.pattern, top: avatar.hat ?? avatar.accessory, glasses: avatar.glasses, face: avatar.face, neck: avatar.neck, back: avatar.back });

export function createAvatar(seed, outfit = null) {
  return {
    ...(outfit ? wear(outfit) : dressUp(seed)),
    squash: 0, squashV: 0, sway: 0, swayV: 0, lean: 0, stride: 0,
    lookX: 0, lookY: 0, blink: 0, nextBlink: 90, joy: 0, still: 0,
  };
}

export const cheer = avatar => { avatar.joy = JOY_FRAMES; };

export function moodOf(avatar, s) {
  if (avatar.joy > 0 || s.comet) return 'joy';
  if (s.dashTimer > 0 || s.charge >= 1) return 'focus';
  if (!s.grounded && s.rope < 0 && !s.climbing && s.vy * s.gravDir > SCARED_SPEED) return 'scared';
  if (avatar.still > ASLEEP_FRAMES) return 'asleep';
  if (avatar.still > DROWSY_FRAMES) return 'drowsy';
  return 'calm';
}

function puff(x, y, size, vx = 0, vy = -0.3) {
  return { x, y, size, vx, vy };
}

function interestOf(level, s, cx, cy) {
  let best = null, bestDist = LOOK_RANGE * LOOK_RANGE;
  const consider = rect => {
    const dx = rect.x + rect.w / 2 - cx, dy = rect.y + rect.h / 2 - cy, d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = { dx, dy, d }; }
  };
  const { monsters, items } = levelIndex(level);
  for (const o of monsters) if (!slain(s, o)) consider(objectRect(o, s.clock));
  for (const o of items) if (!(s.taken & (1 << o.slot))) consider(o);
  return best;
}

function look(avatar, level, s, cx, cy) {
  const thing = interestOf(level, s, cx, cy);
  let tx = Math.max(-1, Math.min(1, s.vx * 0.2)), ty = Math.max(-1, Math.min(1, s.vy * 0.08));
  if (thing) { const d = Math.sqrt(thing.d) || 1; tx = thing.dx / d; ty = thing.dy / d; }
  else if (avatar.still > 120) { tx = Math.sin(avatar.still / 45); ty = -0.3; }
  avatar.lookX += (tx - avatar.lookX) * LOOK_EASE;
  avatar.lookY += (ty - avatar.lookY) * LOOK_EASE;
}

function blink(avatar, rand) {
  if (avatar.blink > 0) { avatar.blink--; return; }
  if (--avatar.nextBlink > 0) return;
  avatar.blink = BLINK_FRAMES;
  avatar.nextBlink = rand() < 0.2 ? BLINK_FRAMES + 6 : 120 + rand() * 220;
}

export function stepAvatar(avatar, level, prev, s, events, rand = Math.random) {
  const { w, h } = playerSize(level.rules);
  const g = s.gravDir;
  const fx = s.x + w / 2, fy = g > 0 ? s.y + h : s.y;
  const puffs = [];
  for (const event of events) {
    if (event.type === 'land') {
      avatar.squashV -= Math.min(0.36, event.speed * 0.03);
      if (event.speed > 4) for (const side of [-1, 1]) puffs.push(puff(fx + side * w * 0.4, fy, 3 + event.speed * 0.3, side * (0.6 + event.speed * 0.08), -0.2 * g));
    }
    if (event.type === 'jump') { avatar.squashV += 0.16; puffs.push(puff(fx, fy, 5, 0, 0.2 * g)); }
    if (event.type === 'airJump') { avatar.squashV += 0.2; for (const side of [-1, 1]) puffs.push(puff(fx + side * 4, fy, 4, side * 0.8, 0.6 * g)); }
    if (CHEERS.has(event.type)) cheer(avatar);
  }
  avatar.squashV = (avatar.squashV - avatar.squash * SQUASH_SPRING) * SQUASH_DAMPING;
  avatar.squash += avatar.squashV;
  avatar.swayV = (avatar.swayV - avatar.sway * SWAY_SPRING - (s.vx - prev.vx) * 0.06 - s.vx * 0.004) * SWAY_DAMPING;
  avatar.sway = Math.max(-1.2, Math.min(1.2, avatar.sway + avatar.swayV));
  avatar.lean += ((s.grounded ? 0.03 : 0.015) * s.vx - avatar.lean) * 0.2;
  const before = Math.floor(avatar.stride / Math.PI);
  if (s.grounded) avatar.stride += Math.abs(s.x - prev.x) / STRIDE;
  else if (s.climbing) avatar.stride += Math.abs(s.y - prev.y) / STRIDE;
  if (s.grounded && Math.abs(s.vx) > RUN_SPEED && Math.floor(avatar.stride / Math.PI) !== before) puffs.push(puff(fx - Math.sign(s.vx) * w * 0.3, fy, 2.5, -s.vx * 0.15));
  if (s.grounded && prev.grounded && Math.abs(prev.vx) > SKID_SPEED && Math.sign(s.vx) !== Math.sign(prev.vx)) puffs.push(puff(fx, fy, 6, prev.vx * 0.3, -0.4 * g));
  const resting = s.grounded && Math.abs(s.vx) < 0.05 && s.x === prev.x && s.y === prev.y;
  avatar.still = resting ? avatar.still + 1 : 0;
  avatar.joy = Math.max(0, avatar.joy - 1);
  look(avatar, level, s, fx, s.y + h / 2);
  blink(avatar, rand);
  return puffs;
}
