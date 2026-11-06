import { TILE } from '../world/level.js?v=9b09a76';
import { step } from '../world/physics.js?v=9b09a76';
import { replay } from './solver.js?v=9b09a76';

const JUMP_OFF_BY = 3;
const TIGHT_WINDOW = 2;
const FLIGHT_FRAMES = 90;
const STEER_FRAMES = 4;
const STEER_SEARCH = 4000;
const LANDED_CLOSE = 8;
const STEERS = [-1, 0, 1].flatMap(dir => [true, false].map(jump => ({ left: dir < 0, right: dir > 0, jump, longJump: false })));
const arrived = (a, b, t = 4) => (t > 3 && b.grounded && !a.grounded) || b.rope >= 0 || b.barrel >= 0 || b.climbing;

function flightOf(level, from, inputs) {
  let s = from;
  for (let t = 0; t < inputs.length && t < FLIGHT_FRAMES; t++) {
    const a = s;
    s = step(level, s, inputs[t]);
    if (s.dead) return null;
    if (arrived(a, s, t)) return s;
  }
  return s;
}

function steersHome(level, from, reaches) {
  const seen = new Set(), stack = [from];
  for (let nodes = 0; stack.length && nodes < STEER_SEARCH; nodes++) {
    const at = stack.pop();
    for (const input of STEERS) {
      let s = at, ended = false;
      for (let k = 0; k < STEER_FRAMES && !s.dead && !ended; k++) {
        const a = s;
        s = step(level, s, input);
        ended = arrived(a, s);
      }
      if (s.dead) continue;
      if (ended) { if (reaches(s)) return true; continue; }
      const key = `${Math.round(s.x / 4)},${Math.round(s.y / 4)},${Math.round(s.vx)},${Math.round(s.vy)},${s.jumpsLeft}`;
      if (!seen.has(key)) { seen.add(key); stack.push(s); }
    }
  }
  return false;
}

export function unsaveableJumps(level, inputs, start) {
  const states = replay(level, inputs, start);
  let found = 0;
  inputs.forEach((input, at) => {
    const before = states[at];
    if (!input.jump || inputs[at - 1]?.jump || !before || !(before.grounded || before.coyote > 0)) return;
    const tail = inputs.slice(at), planned = flightOf(level, before, tail);
    if (!planned || !(planned.grounded || planned.rope >= 0 || planned.barrel >= 0 || planned.climbing)) return;
    const rising = planned.y < before.y - LANDED_CLOSE, across = Math.abs(before.x - planned.x);
    const reaches = s => s.y <= planned.y + LANDED_CLOSE && (rising || Math.abs(s.x - planned.x) <= Math.max(TILE, across / 2));
    const walkOn = input.left || input.right ? inputs[at - 1] ?? {} : {};
    const late = frames => {
      let s = before;
      for (let n = 0; n < frames && s && !s.dead; n++) s = step(level, s, { ...walkOn, jump: false });
      return s && !s.dead ? s : null;
    };
    const holds = from => { const end = from && flightOf(level, from, tail); return !!end && reaches(end); };
    const width = 1 + [states[at - 1], states[at - 2], late(1), late(2)].filter(holds).length;
    if (width > TIGHT_WINDOW) return;
    const off = [states[at - JUMP_OFF_BY], late(JUMP_OFF_BY)].some(from => {
      let s = from;
      for (let n = 0; n < 2 && s && !s.dead; n++) s = step(level, s, { ...input, jump: true });
      return s && !s.dead && steersHome(level, s, reaches);
    });
    if (!off) found++;
  });
  return found;
}
