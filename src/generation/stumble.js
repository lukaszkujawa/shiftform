import { HAZARD_TYPES, objectRect, overlaps, phaseOn, playerSize } from '../world/level.js?v=9b09a76';
import { step } from '../world/physics.js?v=9b09a76';
import { dangersOf, lurkerOf } from '../world/lurkers.js?v=9b09a76';
import { replay } from './solver.js?v=9b09a76';

const TIMING_SIGMA = 2;
const TIMING_REACH = 3;
const WAIT_STEP = 12;
const LONGEST_WAIT = 120;
const ADVANCES = [0, 3, 6, 9];
const HOLD_SHIFTS = [-2, 0, 2];
const LANDING_SLACK = 30;
const FLIGHT_FRAMES = 90;
const TOUCH = 6;
export const FALL = -1;

const secure = s => s.grounded || s.climbing || s.rope >= 0 || s.barrel >= 0;
const gaussian = d => Math.exp(-(d * d) / (2 * TIMING_SIGMA * TIMING_SIGMA));
const TIMINGS = Array.from({ length: 2 * TIMING_REACH + 1 }, (_, k) => k - TIMING_REACH);
const WAITS = Array.from({ length: LONGEST_WAIT / WAIT_STEP + 1 }, (_, k) => k * WAIT_STEP);

function holdShifted(flight, shift) {
  const release = flight.findIndex(input => !input.jump);
  const held = release < 0 ? flight.length : release;
  if (shift < 0) return flight.map((input, k) => (k >= held + shift && k < held ? { ...input, jump: false } : input));
  return flight.map((input, k) => (k >= held && k < held + shift ? { ...input, jump: true } : input));
}

function fly(level, from, inputs) {
  let s = from, left = false;
  for (let k = 0; k < inputs.length && k < FLIGHT_FRAMES; k++) {
    s = step(level, s, inputs[k]);
    if (s.dead) return s;
    left ||= !secure(s);
    if (left && secure(s)) return s;
  }
  return s;
}

function killerOf(level, s, w, h) {
  const box = { x: s.x - TOUCH, y: s.y - TOUCH, w: w + 2 * TOUCH, h: h + 2 * TOUCH };
  for (const o of level.objects) {
    if (o.type === 'lurker') {
      if (dangersOf(o, lurkerOf(o, s)).some(zone => overlaps(box.x, box.y, box.w, box.h, zone))) return o.id;
    } else if (HAZARD_TYPES.has(o.type) || o.type === 'shot') {
      if (o.type === 'laser' && !phaseOn(o, s.clock)) continue;
      const rect = objectRect(o, s.clock);
      if (overlaps(box.x, box.y, box.w, box.h, rect)) return o.id;
    }
  }
  return FALL;
}

const walkedTo = (states, from, to) => from >= 0 && states.slice(from, to + 1).every(secure);

function jitteredJump(level, states, inputs, i, wait, advance, w, h) {
  const takeoff = i - advance;
  if (!walkedTo(states, takeoff, i)) return null;
  let land = i + 1;
  while (land < states.length - 1 && !secure(states[land])) land++;
  const flight = inputs.slice(i, land + LANDING_SLACK), before = inputs[takeoff - 1] ?? {};
  const blame = new Map();
  let died = 0, tried = 0;
  for (const d of TIMINGS) {
    const at = d < 0 ? states[takeoff + d] : states[takeoff];
    if (!at || !secure(at)) continue;
    const from = wait ? { ...at, clock: at.clock + wait } : at;
    const weight = gaussian(d);
    for (const shift of HOLD_SHIFTS) {
      const end = fly(level, from, d > 0 ? [...Array(d).fill(before), ...holdShifted(flight, shift)] : holdShifted(flight, shift));
      tried += weight;
      if (!end.dead) continue;
      died += weight;
      const killer = killerOf(level, end, w, h);
      blame.set(killer, (blame.get(killer) ?? 0) + weight);
    }
  }
  return { rate: tried ? died / tried : 0, blame };
}

export function stumbles(level, segment) {
  const { w, h } = playerSize(level.rules);
  const states = replay(level, segment.inputs, segment.start), { inputs } = segment;
  const blame = new Map();
  let deaths = 0, jumps = 0, worst = 0;
  for (let i = 0; i + 1 < states.length; i++) {
    if (!secure(states[i]) || secure(states[i + 1])) continue;
    let best = null;
    for (const wait of WAITS) {
      for (const advance of ADVANCES) {
        const jump = jitteredJump(level, states, inputs, i, wait, advance, w, h);
        if (jump && (!best || jump.rate < best.rate)) best = jump;
      }
      if (best?.rate === 0) break;
    }
    if (!best) continue;
    jumps++;
    deaths += best.rate;
    worst = Math.max(worst, best.rate);
    for (const [killer, weight] of best.blame) blame.set(killer, (blame.get(killer) ?? 0) + weight);
  }
  return { deaths, jumps, worst, blame };
}

export const stumbleRate = (level, segment) => {
  const { deaths, jumps } = stumbles(level, segment);
  return jumps ? deaths / jumps : 0;
};
