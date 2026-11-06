import { TILE, WIDTH, HAZARD_TYPES, levelIndex, objectRect, overlaps, phaseOn, playerSize } from '../world/level.js?v=85658ef';
import { dangersOf, lurkerOf } from '../world/lurkers.js?v=85658ef';
import { replay } from './solver.js?v=85658ef';

const STALL_FRAMES = 60;
const STALL_REACH = 1.5 * TILE;
const CLOSE_REACH = 0.6 * TILE;
const CLOSE_SATURATES = 0.2;
const WAIT_SATURATES = 0.1;
const RHYTHM_SATURATES = 2.2;
const CHAINS_PER_STRETCH = 2;
const MOVE_KINDS = 8;

export const FUN_FLAVORS = {
  balanced: { variety: 3, rhythm: 2, waiting: 3, chains: 2, closeCalls: 2, spikes: 2, space: 2 },
  flowing: { variety: 2, rhythm: 4, waiting: 5, chains: 2, closeCalls: 1, spikes: 2, space: 3 },
  acrobatic: { variety: 5, rhythm: 1, waiting: 2, chains: 5, closeCalls: 1, spikes: 1, space: 2 },
  dangerous: { variety: 2, rhythm: 1, waiting: 2, chains: 1, closeCalls: 6, spikes: 1, space: 1 },
};

function moveOf(level, s, w, h, waters) {
  if (s.barrel >= 0) return 'cannon';
  if (s.rope >= 0) return 'swing';
  if (s.climbing) return 'climb';
  if (s.dashTimer > 0) return 'dash';
  if (waters.some(o => overlaps(s.x, s.y, w, h, o))) return 'swim';
  if (s.lastKick || s.wallKicks) return 'kick';
  return s.grounded ? 'walk' : 'air';
}

const entropy = counts => {
  const total = counts.reduce((sum, n) => sum + n, 0);
  return total ? -counts.reduce((sum, n) => sum + (n ? (n / total) * Math.log(n / total) : 0), 0) / Math.log(MOVE_KINDS) : 0;
};

function spread(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.min(1, Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) / ((mean || 1) * RHYTHM_SATURATES));
}

export function funSignals(level) {
  const { w, h } = playerSize(level.rules);
  const waters = level.objects.filter(o => o.type === 'water');
  const dangers = level.objects.filter(o => (HAZARD_TYPES.has(o.type) && o.type !== 'lurker') || o.type === 'shot');
  const lurkers = levelIndex(level).lurkers;
  const bouts = {}, rests = [];
  let frames = 0, stalled = 0, close = 0, chains = 0, covered = 0;
  for (const { inputs, start } of level.segments) {
    const states = replay(level, inputs, start);
    let move = null, rest = 0, device = -1, left = Infinity, right = -Infinity;
    states.forEach((s, i) => {
      frames++;
      left = Math.min(left, s.x);
      right = Math.max(right, s.x);
      const now = moveOf(level, s, w, h, waters);
      if (now !== move) { bouts[now] = (bouts[now] ?? 0) + 1; move = now; }
      if (s.grounded) { rest++; device = -1; }
      else { if (rest) rests.push(rest); rest = 0; }
      const gripped = s.rope >= 0 ? s.rope : s.barrel;
      if (gripped >= 0 && gripped !== device) { if (device >= 0) chains++; device = gripped; }
      const before = states[i - STALL_FRAMES];
      if (before && Math.hypot(s.x - before.x, s.y - before.y) < STALL_REACH) stalled++;
      const near = r => overlaps(s.x - CLOSE_REACH, s.y - CLOSE_REACH, w + 2 * CLOSE_REACH, h + 2 * CLOSE_REACH, r);
      if (dangers.some(o => (o.type !== 'laser' || phaseOn(o, s.clock)) && near(objectRect(o, s.clock))) || lurkers.some(o => dangersOf(o, lurkerOf(o, s)).some(near))) close++;
    });
    covered += (right - left) / (WIDTH - w);
  }
  const spikes = dangers.filter(o => o.type === 'spikes').length, stretches = Math.max(1, level.segments.length);
  return {
    variety: entropy(Object.values(bouts)),
    rhythm: spread(rests),
    waiting: 1 - Math.min(1, stalled / (frames * WAIT_SATURATES || 1)),
    chains: Math.min(1, chains / (stretches * CHAINS_PER_STRETCH)),
    closeCalls: Math.min(1, close / (frames * CLOSE_SATURATES || 1)),
    spikes: dangers.length ? 1 - spikes / dangers.length : 0.5,
    space: Math.min(1, covered / stretches),
  };
}

export function funScore(signals, flavor = 'balanced') {
  const weights = FUN_FLAVORS[flavor], total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return Math.round((100 * Object.entries(weights).reduce((sum, [name, weight]) => sum + weight * signals[name], 0)) / total);
}
