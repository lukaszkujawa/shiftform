import { CLOCK_PERIOD, TILE, COLS, SOLID, CRATE_SIZE, tileAt, levelIndex, overlaps } from './level.js?v=751319b';
import { jumpProfile } from './rules.js?v=751319b';
import { step, initialState, playerSize } from './physics.js?v=751319b';

const MACRO_FRAMES = 4;
const HEURISTIC_WEIGHT = 3;
const POS_Q = 4;
const VEL_Q = 2;
const PHASE_Q = 4;

const PUSH_WEIGHT = 2;
const CRATE_TOLERANCE = 14;

const inputFor = (dir, jump = false, dash = false, interact = false) => ({ left: dir < 0, right: dir > 0, jump, dash, interact });

function buildMacros(level) {
  const index = levelIndex(level);
  const interactive = index.hooks.length > 0 || index.crates.length > 0;
  const tap = (dir, first) => ({ frames: [first, ...Array(MACRO_FRAMES - 1).fill(inputFor(dir))] });
  const macros = [];
  for (const dir of [1, 0, -1]) {
    macros.push({ frames: Array(MACRO_FRAMES).fill(inputFor(dir)) });
    macros.push({ frames: Array(MACRO_FRAMES).fill(inputFor(dir, true)) });
    if (level.rules.dash) macros.push(tap(dir, inputFor(dir, false, true)));
    if (interactive) macros.push(tap(dir, inputFor(dir, false, false, true)));
    if (index.climbs.length) macros.push({ frames: Array(MACRO_FRAMES).fill({ ...inputFor(dir, true), up: true }) });
  }
  if (index.climbs.length) macros.push({ frames: Array(MACRO_FRAMES).fill({ ...inputFor(0), down: true }) });
  return macros;
}

function bodiesKey(s) {
  if (!s.bodies.length && s.rope < 0) return '';
  const bodies = s.bodies.map(b => b.gone ? 'x' : `${Math.round(b.x / POS_Q)},${Math.round(b.y / POS_Q)},${Math.round(b.vx)},${Math.round(b.vy / VEL_Q)}`);
  return `:${s.held}:${s.held >= 0 ? s.facing : 0}:${s.rope}:${Math.round(s.ropeLen / POS_Q)}:${s.pressed}:${s.crushed}:${bodies.join(';')}`;
}

function chargeKey(level, s) {
  return level.rules.flywheel ? `:${Math.round(s.charge * 3)}:${s.chargeDir}` : '';
}

export function stateKey(level, s) {
  const phase = level.timed ? Math.floor((s.clock % CLOCK_PERIOD) / PHASE_Q) : level.rules.flood ? Math.min(255, s.clock >> 4) : 0;
  const a = ((Math.round(s.x / POS_Q) & 1023) << 20) | ((Math.round(s.y / POS_Q) + 64 & 1023) << 10) | ((Math.round(s.vx / VEL_Q) + 32 & 63) << 4) | (s.gravDir > 0 ? 1 : 0) | (s.grounded ? 2 : 0) | (s.jumpHeld ? 4 : 0) | (s.inPortal ? 8 : 0) | (s.climbing ? 16 : 0) | (s.cuttable ? 32 : 0);
  const b = ((Math.round(s.vy / VEL_Q) + 64 & 127) << 24) | ((phase & 255) << 16) | ((s.jumpsLeft & 3) << 14) | ((s.dashLeft & 1) << 13) | ((s.dashTimer > 0 ? 1 : 0) << 12) | ((s.coyote > 0 ? 1 : 0) << 11) | (s.groundId + 1 & 255);
  return `${a}:${b}:${s.flags}:${s.jumpsUsed}:${s.jumpBuffer}:${s.crumbled.map(t => Math.ceil(t / 30)).join('')}:${s.taken}:${s.slain}:${s.comet}:${s.cometWait}:${s.cometMissed ? 1 : 0}:${Math.min(s.cometBounces, 2)}:${s.fuel >> 3}:${s.boots}:${s.shield ? 1 : 0}:${s.invuln > 0 ? 1 : 0}:${s.jetting ? 1 : 0}:${s.lastKick}${bodiesKey(s)}${chargeKey(level, s)}`;
}

const UNREACHABLE = 1e5;

function distanceField(level, target) {
  const rows = level.rows;
  const field = new Float64Array(COLS * rows).fill(UNREACHABLE);
  const queue = [];
  const c0 = Math.max(0, Math.floor(target.x / TILE)), c1 = Math.min(COLS - 1, Math.floor((target.x + target.w - 1) / TILE));
  const r0 = Math.max(0, Math.floor(target.y / TILE)), r1 = Math.min(rows - 1, Math.floor((target.y + target.h - 1) / TILE));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { field[r * COLS + c] = 0; queue.push(c, r); }
  for (let head = 0; head < queue.length; head += 2) {
    const c = queue[head], r = queue[head + 1];
    const d = field[r * COLS + c] + 1;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nc = c + dc, nr = r + dr;
      if (level.rules.wrapY) nr = (nr + rows) % rows;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= rows) continue;
      const i = nr * COLS + nc;
      if (tileAt(level, nc, nr) === SOLID || field[i] <= d) continue;
      field[i] = d;
      queue.push(nc, nr);
    }
  }
  return field;
}

const VERTICAL_WEIGHT = 2;

function routeTargets(level, points) {
  const remaining = new Float64Array(points.length);
  for (let i = points.length - 2; i >= 0; i--) {
    remaining[i] = remaining[i + 1] + Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y) * VERTICAL_WEIGHT;
  }
  return { route: points, remaining, maxRise: jumpProfile(level.rules).height + 40 };
}

const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by) * VERTICAL_WEIGHT;

function crateCenter(s, point) {
  const b = s.bodies[point.body];
  return b.gone ? null : { x: b.x + CRATE_SIZE / 2, y: b.y + CRATE_SIZE / 2 };
}

function fetched(point, s) {
  if (s.held === point.fetch) return true;
  const b = s.bodies[point.fetch];
  return !b.gone && (Math.abs(b.x + CRATE_SIZE / 2 - point.x) > TILE || Math.abs(b.y + CRATE_SIZE / 2 - point.y) > TILE);
}

function satisfied(point, s) {
  if (point.item) return (s.taken & point.item) !== 0;
  if (point.bit) return (s.flags & point.bit) !== 0;
  if (point.fetch !== undefined) return fetched(point, s);
  if (point.body === undefined) return true;
  const c = crateCenter(s, point);
  const within = point.within ?? CRATE_TOLERANCE;
  return !!c && s.held !== point.body && Math.abs(c.x - point.tx) < within && Math.abs(c.y - point.ty) < within;
}

function crateCost(s, point, cx, cy) {
  const c = crateCenter(s, point);
  if (!c) return UNREACHABLE;
  const reach = s.held === point.body ? 0 : manhattan(c.x, c.y, cx, cy) * 0.5;
  return reach + PUSH_WEIGHT * manhattan(c.x, c.y, point.tx, point.ty);
}

function routeHeuristic(level, targets, s, pw, ph) {
  const cx = s.x + pw / 2, cy = s.y + ph / 2;
  const { route, remaining, maxRise } = targets;
  let limit = route.length - 1;
  for (let i = 0; i < route.length; i++) {
    if (!satisfied(route[i], s)) { limit = i; break; }
  }
  let best = Infinity;
  for (let i = 0; i <= limit; i++) {
    if (cy - route[i].y > maxRise) continue;
    const d = manhattan(route[i].x, route[i].y, cx, cy) + remaining[i];
    if (d < best) best = d;
  }
  if (best === Infinity) return UNREACHABLE;
  const goal = route[limit];
  const extra = goal.body !== undefined && !satisfied(goal, s) ? crateCost(s, goal, cx, cy) : 0;
  return (best + extra) / level.rules.moveSpeed;
}

function targetsOf(level, route, goal) {
  if (route) return routeTargets(level, route);
  const required = level.objects
    .filter(o => o.type === 'key' || o.type === 'switch' || (o.type === 'orb' && (level.exitNeeds & o.bit)))
    .map(o => ({ bit: o.bit, x: o.x, y: o.y, w: o.w, h: o.h, field: distanceField(level, o) }));
  return { required, exitField: distanceField(level, goal ?? level.exit) };
}

function cellOf(level, x, y) {
  const c = Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE)));
  const r = Math.max(0, Math.min(level.rows - 1, Math.floor(y / TILE)));
  return r * COLS + c;
}

function heuristic(level, targets, s, pw, ph) {
  if (targets.route) return routeHeuristic(level, targets, s, pw, ph);
  let cell = cellOf(level, s.x + pw / 2, s.y + ph / 2);
  let total = 0;
  const remaining = targets.required.filter(t => !(s.flags & t.bit));
  while (remaining.length) {
    let bestIndex = 0, best = Infinity;
    remaining.forEach((t, i) => {
      const d = t.field[cell];
      if (d < best) { best = d; bestIndex = i; }
    });
    const next = remaining.splice(bestIndex, 1)[0];
    total += best;
    cell = cellOf(level, next.x + next.w / 2, next.y + next.h / 2);
  }
  return ((total + targets.exitField[cell]) * TILE) / level.rules.moveSpeed;
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
  for (let cur = node; cur.parent; cur = cur.parent) inputs.push(cur.frames);
  return inputs.reverse().flat();
}

function reachedBy(goal, pw, ph) {
  if (typeof goal === 'function') return goal;
  if (goal) return s => overlaps(s.x, s.y, pw, ph, goal);
  return s => s.won;
}

function standingNear(point, pw, ph) {
  return s => Math.abs(s.x + pw / 2 - point.x) <= point.w / 2 && Math.abs(s.y + ph / 2 - point.y) <= ph / 2 + 4;
}

const lasting = point => !!point.item || !!point.bit || point.body !== undefined;

export function solveRoute(level, route, { start = initialState(level), goal = null, maxNodes, kicks } = {}) {
  const { w: pw, h: ph } = playerSize(level.rules);
  const target = goal ?? level.exit;
  const points = [...route, { x: target.x + target.w / 2, y: target.y + target.h / 2, goal: true }];
  const legs = points.map((point, i) => {
    const own = point.goal ? reachedBy(goal, pw, ph) : point.rope ? s => s.rope >= 0 : lasting(point) || point.fetch !== undefined ? s => satisfied(point, s) : standingNear(point, pw, ph);
    const kept = route.slice(0, i).filter(lasting);
    const placed = kept.filter(p => p.body !== undefined && !p.bit);
    return { route: [...placed, point], reached: kept.length ? s => own(s) && kept.every(p => satisfied(p, s)) : own };
  });
  let state = start, inputs = [];
  let previous = { state: start, inputs: [], route: [] };
  for (const leg of legs) {
    if (leg.reached(state)) continue;
    let base = { state, inputs, route: leg.route };
    let result = solve(level, { start: state, goal: leg.reached, route: leg.route, maxNodes, kicks });
    if (!result) {
      base = { ...previous, route: [...previous.route, ...leg.route] };
      result = solve(level, { start: base.state, goal: leg.reached, route: base.route, maxNodes: maxNodes * 2, kicks });
      if (!result) return null;
    }
    previous = { state: base.state, inputs: base.inputs, route: leg.route };
    inputs = [...base.inputs, ...result.inputs];
    state = result.end;
  }
  return { inputs, end: state };
}

export const kicked = (before, after) => after.lastKick !== 0 && after.lastKick !== before.lastKick;

export function solve(level, { maxNodes = 150000, maxFrames = 60 * 40, start = initialState(level), goal = null, route = level.route, kicks = true } = {}) {
  const macros = buildMacros(level);
  const targets = targetsOf(level, route, goal);
  const { w: pw, h: ph } = playerSize(level.rules);
  const reached = reachedBy(goal, pw, ph);
  const open = new Heap();
  const seen = new Set();
  open.push({ state: start, parent: null, frames: null, f: 0 });
  seen.add(stateKey(level, start));
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const node = open.pop();
    expanded++;
    for (const macro of macros) {
      let s = node.state;
      let used = 0, outcome = null;
      for (const input of macro.frames) {
        const before = s;
        s = step(level, s, input);
        used++;
        if (s.dead || (!kicks && kicked(before, s))) { outcome = 'dead'; break; }
        if (reached(s)) { outcome = 'won'; break; }
      }
      if (outcome === 'dead') continue;
      const child = { state: s, parent: node, frames: macro.frames.slice(0, used), f: 0 };
      if (outcome === 'won') return { inputs: reconstruct(child), frames: s.frame - start.frame, expanded, end: s };
      if (s.frame - start.frame > maxFrames) continue;
      const key = stateKey(level, s);
      if (seen.has(key)) continue;
      seen.add(key);
      child.f = s.frame - start.frame + HEURISTIC_WEIGHT * heuristic(level, targets, s, pw, ph);
      open.push(child);
    }
  }
  return null;
}

export function replay(level, inputs, start = initialState(level)) {
  let s = start;
  const states = [s];
  for (const input of inputs) {
    s = step(level, s, input);
    states.push(s);
    if (s.dead || s.won) break;
  }
  return states;
}
