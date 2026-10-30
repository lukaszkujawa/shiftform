import { levelRng } from './rng.js?v=129676c';
import { grant, playerSize } from './physics.js?v=129676c';
import { TILE, WIDTH, overlaps } from './level.js?v=129676c';
import { blockedBy } from './collision.js?v=129676c';

export const TRICK_COST = 300;
export const REROLL_COST = 300;
export const TRICKS_FROM = 1;
export const PLACEABLE = ['plank', 'trampoline', 'ladder'];
export const TRICKS = {
  jetpack: { title: 'Jetpack', text: 'Out of jumps? Keep holding jump in mid-air to fly.', weight: 3 },
  boots: { title: 'Spring boots', text: 'Five extra mid-air jumps.', weight: 3 },
  shield: { title: 'Shield', text: 'The next hazard bounces you to safety.', weight: 2 },
  bow: { title: 'Bow', text: 'Five arrows. V shoots the way you face.', weight: 2.5 },
  heart: { title: 'Heart', text: 'Refills your lives.', weight: 1.5 },
  comet: { title: 'Comet', text: 'Fly up through platforms and bounce. Tap jump as you land to go higher.', weight: 1 },
  extraHeart: { title: 'Extra heart', text: 'One more life, now and every time you refill.', weight: 1.5 },
  double: { title: 'Double points', text: 'Every point in this biome counts twice.', weight: 2 },
  flag: { title: 'Flag', text: 'Click to plant a checkpoint where you stand. Once.', weight: 2, held: true },
  plank: { title: 'Plank', text: 'Click anywhere to build a platform. Once.', weight: 3, held: true },
  trampoline: { title: 'Trampoline', text: 'Click anywhere to build a trampoline that launches you five rows up. Once.', weight: 2, held: true },
  ladder: { title: 'Ladder', text: 'Click anywhere to hang a six-tile ladder. Once.', weight: 2, held: true },
  erase: { title: 'Eraser', text: 'Click any saw, laser, spikes or monster to remove it. Once.', weight: 2, held: true },
};

export function offerFor(level, roll = 0) {
  const rng = levelRng(level, 'tricks', 977, 3 + roll * 7919);
  const pool = Object.keys(TRICKS);
  const offer = [];
  while (offer.length < 3) {
    const kind = rng.weighted(pool, k => TRICKS[k].weight);
    offer.push(kind);
    pool.splice(pool.indexOf(kind), 1);
  }
  return offer;
}

export function takeTrick(run, kind) {
  run.points -= TRICK_COST;
  if (TRICKS[kind].held) run.tricks = [...run.tricks, kind];
  else if (kind === 'heart') run.lives = run.maxLives;
  else if (kind === 'extraHeart') { run.maxLives++; run.lives++; }
  else if (kind === 'double') run.doubled = run.index;
  else if (kind === 'comet' && run.hall) run.hall.comet = true;
  else run.s = grant({ ...run.s }, kind);
}

export function placedAt(kind, x, y) {
  const col = Math.round(x / TILE), row = Math.round(y / TILE);
  if (kind === 'plank') return { kind, x: col * TILE - 1.5 * TILE, y: row * TILE, w: 3 * TILE, h: TILE, id: -1 };
  if (kind === 'trampoline') return { kind, x: col * TILE - TILE, y: row * TILE, w: 2 * TILE, h: 12, id: -1 };
  return { kind, x: Math.floor(x / TILE) * TILE + 5, y: Math.max(TILE, row * TILE - 6 * TILE), w: TILE - 10, h: 0, id: -1 };
}

export function buildAt(level, state, kind, x, y) {
  const rect = placedAt(kind, x, y);
  if (kind === 'ladder') rect.h = Math.round(y / TILE) * TILE - rect.y;
  rect.x = Math.max(0, Math.min(WIDTH - rect.w, rect.x));
  if (rect.y < TILE || rect.y + rect.h > level.height - TILE || rect.h <= 0) return null;
  const { w, h } = playerSize(level.rules);
  if (kind !== 'ladder' && (overlaps(state.x, state.y, w, h, rect) || blockedBy(level, rect.x, rect.y, rect.w, rect.h, state.placed))) return null;
  return rect;
}
