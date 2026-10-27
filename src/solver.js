import { CLOCK_PERIOD } from './level.js';
import { step, initialState, playerSize } from './physics.js';

const MACRO_FRAMES = 4;
const HEURISTIC_WEIGHT = 2.5;

const inputFor = (dir, jump, dash) => ({ left: dir < 0, right: dir > 0, jump, dash });

function buildMacros(rules) {
  const macros = [];
  for (const dir of [1, 0, -1]) {
    macros.push({ frames: Array(MACRO_FRAMES).fill(inputFor(dir, false, false)) });
    macros.push({ frames: Array(MACRO_FRAMES).fill(inputFor(dir, true, false)) });
    macros.push({ frames: [inputFor(dir, true, false), ...Array(MACRO_FRAMES - 1).fill(inputFor(dir, false, false))] });
    if (rules.dash) macros.push({ frames: [inputFor(dir, false, true), ...Array(MACRO_FRAMES - 1).fill(inputFor(dir, false, false))] });
  }
  return macros;
}

function stateKey(level, s) {
  const phase = level.timed ? s.clock % CLOCK_PERIOD : 0;
  const a = ((Math.round(s.x / 2) & 1023) << 20) | ((Math.round(s.y / 2) + 64 & 1023) << 10) | ((Math.round(s.vx) + 32 & 63) << 4) | (s.gravDir > 0 ? 1 : 0) | (s.grounded ? 2 : 0) | (s.jumpHeld ? 4 : 0) | (s.inPortal ? 8 : 0);
  const b = ((Math.round(s.vy) + 64 & 127) << 24) | ((phase & 255) << 16) | ((s.jumpsLeft & 3) << 14) | ((s.dashLeft & 1) << 13) | ((s.dashTimer > 0 ? 1 : 0) << 12) | ((s.coyote > 0 ? 1 : 0) << 11) | (s.groundId + 1 & 255);
  return `${a}:${b}:${s.flags}`;
}

function targetsOf(level) {
  const required = level.objects.filter(o => o.type === 'key' || o.type === 'switch' || (o.type === 'orb' && (level.exitNeeds & o.bit)));
  return { required, exit: level.exit };
}

function centerDistance(ax, ay, b) {
  return Math.abs(b.x + b.w / 2 - ax) + Math.abs(b.y + b.h / 2 - ay) * 0.5;
}

function heuristic(level, targets, s, pw, ph) {
  let cx = s.x + pw / 2, cy = s.y + ph / 2;
  let total = 0;
  const remaining = targets.required.filter(t => !(s.flags & t.bit));
  while (remaining.length) {
    let bestIndex = 0, best = Infinity;
    remaining.forEach((t, i) => {
      const d = centerDistance(cx, cy, t);
      if (d < best) { best = d; bestIndex = i; }
    });
    const next = remaining.splice(bestIndex, 1)[0];
    total += best;
    cx = next.x + next.w / 2;
    cy = next.y + next.h / 2;
  }
  return (total + centerDistance(cx, cy, targets.exit)) / level.rules.moveSpeed;
}

class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

function reconstruct(node) {
  const inputs = [];
  for (let cur = node; cur.parent; cur = cur.parent) inputs.push(cur.macro.frames);
  return inputs.reverse().flat();
}

export function solve(level, { maxNodes = 150000, maxFrames = 60 * 40 } = {}) {
  const macros = buildMacros(level.rules);
  const targets = targetsOf(level);
  const { w: pw, h: ph } = playerSize(level.rules);
  const start = initialState(level);
  const open = new Heap();
  const seen = new Set();
  open.push({ state: start, parent: null, macro: null, f: 0 });
  seen.add(stateKey(level, start));
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const node = open.pop();
    expanded++;
    for (const macro of macros) {
      let s = node.state;
      let outcome = null;
      for (const input of macro.frames) {
        s = step(level, s, input);
        if (s.dead) { outcome = 'dead'; break; }
        if (s.won) { outcome = 'won'; break; }
      }
      if (outcome === 'dead') continue;
      const child = { state: s, parent: node, macro, f: 0 };
      if (outcome === 'won') return { inputs: reconstruct(child), frames: s.frame, expanded };
      if (s.frame > maxFrames) continue;
      const key = stateKey(level, s);
      if (seen.has(key)) continue;
      seen.add(key);
      child.f = s.frame + HEURISTIC_WEIGHT * heuristic(level, targets, s, pw, ph);
      open.push(child);
    }
  }
  return null;
}

export function replay(level, inputs) {
  let s = initialState(level);
  const states = [s];
  for (const input of inputs) {
    s = step(level, s, input);
    states.push(s);
    if (s.dead || s.won) break;
  }
  return states;
}
