import { TILE, COLS, SOLID, ONE_WAY, EMPTY, tileAt, setTile, addObject, objectRect, phaseOn, overlaps, levelIndex, HAZARD_TYPES } from '../world/level.js?v=c6cd642';
import { step, playerSize } from '../world/physics.js?v=c6cd642';
import { SHOP_ROWS } from '../world/tunnel.js?v=c6cd642';
import { reachedBy, replay } from './solver.js?v=c6cd642';
import { LURKERS, lurkerOf, dangersOf } from '../world/lurkers.js?v=c6cd642';
import { plainNode, clamp } from './features.js?v=c6cd642';

const TOLERANCE = [0, 7, 5, 4, 3, 3, 2];
const SPIKE_H = 14;
const REST_MARGIN = 6;
const LANDING_SLACK = 30;
const SILL_DROP = 3;
const LID_SCAN = 6;
const LOW_SCAN = 5;
const ANCHOR_SCAN = 7;
const GROUND_SCAN = 5;
const TURRET_SCAN = 6;
const MAX_MONSTERS = 14;
const MAX_SAWS = 24;
const SWEEP_SAMPLES = 24;
const PHASE_TRIES = 16;
const KILLER_TRIES = 3;
const HURDLE_SPACING = 3;
const MONSTER_W = 22, MONSTER_H = 20;
const SAW_SIZE = 26;
const MINE_SIZE = 24;
const LEDGE_HEADROOM = 3;
const LURKER_TRIES = 14;
const LURKER_SPAWN_GAP = 8 * TILE;
const OPEN_TO_HAZARDS = new Set(['wind', 'laser', 'coin', 'removed', ...HAZARD_TYPES]);

const ramp = (index, from, rate, top = 1) => clamp((index - from + 1) * rate, 0, top);

export function gauntletOf(index) {
  if (!index) return null;
  return {
    tolerance: TOLERANCE[Math.min(index, TOLERANCE.length - 1)],
    cover: ramp(index, 1, 0.15, 0.5),
    ceilings: ramp(index, 2, 0.1, 0.35),
    sills: ramp(index, 1, 0.15, 0.6),
    mines: ramp(index, 1, 0.25, 2),
    killers: ramp(index, 1, 0.4, 4),
    lurkers: Math.min(index + 1, 8),
    cast: Math.min(1 + index, KILLER_IDS.length),
    periods: index < 4 ? [120, 240] : index < 6 ? [120] : [60, 120],
  };
}

const secure = s => s.grounded || s.climbing || s.rope >= 0 || s.barrel >= 0;

const sameFooting = (s, target) => {
  if (target.rope >= 0 || target.barrel >= 0) return s.rope === target.rope && s.barrel === target.barrel;
  if (target.climbing) return s.climbing;
  return s.grounded && s.groundId === target.groundId && Math.abs(s.y - target.y) <= 1;
};

function timingsOf(states, inputs, i, land, tolerance) {
  const flight = inputs.slice(i, land + tolerance + LANDING_SLACK);
  const release = flight.findIndex(input => !input.jump);
  const held = release < 0 ? flight.length : release;
  const before = inputs[i - 1] ?? {};
  const timings = [{ from: i, inputs: flight.map(input => ({ ...input, jump: true })) }];
  for (let d = tolerance; d > 0; d = d > 2 ? Math.ceil(d / 2) : d - 1) {
    if (i >= d && states[i - d].grounded) timings.push({ from: i - d, inputs: flight });
    timings.push({ from: i, inputs: [...Array(d).fill(before), ...flight] });
    if (held > d) timings.push({ from: i, inputs: flight.map((input, k) => (k >= held - d && k < held ? { ...input, jump: false } : input)) });
    timings.push({ from: i, inputs: flight.map((input, k) => (k >= held && k < held + d ? { ...input, jump: true } : input)) });
  }
  return timings;
}

function flown(level, start, inputs, arrived) {
  const trail = [];
  let s = start, left = false;
  for (const input of inputs) {
    s = step(level, s, input);
    if (s.dead) return null;
    trail.push(s);
    left ||= !secure(s);
    if (left && arrived(s)) return trail;
    if (left && secure(s)) return null;
  }
  return null;
}

class Tube {
  constructor(level) {
    const { w, h } = playerSize(level.rules);
    Object.assign(this, { w, h, rows: Array.from({ length: level.rows + 1 }, () => []), rests: [] });
  }
  rowsOf(y, h) {
    return [clamp(Math.floor(y / TILE), 0, this.rows.length - 1), clamp(Math.floor((y + h) / TILE), 0, this.rows.length - 1)];
  }
  addState(s) {
    const box = { x: s.x, y: s.y, clock: s.clock };
    const [r0, r1] = this.rowsOf(s.y, this.h);
    for (let r = r0; r <= r1; r++) this.rows[r].push(box);
  }
  addRest(x0, x1, y) {
    this.rests.push({ x: x0 - REST_MARGIN, y: y - REST_MARGIN, w: x1 - x0 + this.w + 2 * REST_MARGIN, h: this.h + 2 * REST_MARGIN });
  }
  boxesNear(rect, margin) {
    const [r0, r1] = this.rowsOf(rect.y - margin - this.h, rect.h + 2 * margin + this.h);
    const seen = new Set();
    for (let r = r0; r <= r1; r++) for (const box of this.rows[r]) seen.add(box);
    return seen;
  }
  clearOf(rect, margin) {
    if (this.rests.some(rest => overlaps(rest.x, rest.y, rest.w, rest.h, rect))) return false;
    for (const box of this.boxesNear(rect, margin)) if (overlaps(box.x - margin, box.y - margin, this.w + 2 * margin, this.h + 2 * margin, rect)) return false;
    return true;
  }
}

function layStretch(level, tube, segment, tolerance) {
  const states = replay(level, segment.inputs, segment.start);
  const reached = reachedBy(segment.goal, tube.w, tube.h);
  states.forEach(s => tube.addState(s));
  let run = null;
  for (const s of states) {
    if (s.grounded && s.groundId < 0) {
      if (run && Math.abs(run.y - s.y) <= 1) { run.x0 = Math.min(run.x0, s.x); run.x1 = Math.max(run.x1, s.x); }
      else { if (run) tube.addRest(run.x0, run.x1, run.y); run = { x0: s.x, x1: s.x, y: s.y }; }
    } else if (run) { tube.addRest(run.x0, run.x1, run.y); run = null; }
  }
  if (run) tube.addRest(run.x0, run.x1, run.y);
  for (let i = 0; i + 1 < states.length; i++) {
    if (!secure(states[i]) || secure(states[i + 1])) continue;
    let land = i + 1;
    while (land < states.length - 1 && !secure(states[land])) land++;
    const target = states[land], arrived = secure(target) ? s => sameFooting(s, target) : reached;
    for (const timing of timingsOf(states, segment.inputs, i, land, tolerance)) {
      const trail = flown(level, states[timing.from], timing.inputs, arrived);
      if (!trail) continue;
      trail.forEach(s => tube.addState(s));
      const end = trail.at(-1);
      if (end.grounded && end.groundId < 0 && target.grounded) tube.addRest(Math.min(end.x, target.x), Math.max(end.x, target.x), target.y);
    }
  }
}

function sweepOf(o) {
  if (o.type === 'shot') return { x: o.dir > 0 ? o.x : o.x - o.range, y: o.y, w: o.range + o.w, h: o.h };
  if (!o.period || o.dx === undefined) return o;
  if (o.motion === 'puff') return { x: o.x - o.grow, y: o.y - o.grow, w: o.w + 2 * o.grow, h: o.h + 2 * o.grow };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < SWEEP_SAMPLES; k++) {
    const rect = objectRect(o, (k * o.period) / SWEEP_SAMPLES - o.phase);
    x0 = Math.min(x0, rect.x); y0 = Math.min(y0, rect.y); x1 = Math.max(x1, rect.x + rect.w); y1 = Math.max(y1, rect.y + rect.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const inRoom = (level, row) => level.rooms.some(room => row * TILE > room.top && row * TILE < room.bottom);

const lastRow = level => level.rows - 1 - SHOP_ROWS;

function openBox(level, rect) {
  const c0 = Math.floor(rect.x / TILE), c1 = Math.floor((rect.x + rect.w - 0.01) / TILE), r0 = Math.floor(rect.y / TILE), r1 = Math.floor((rect.y + rect.h - 0.01) / TILE);
  if (r0 < 1 || r1 >= lastRow(level) || c0 < 0 || c1 >= COLS) return false;
  for (let r = r0; r <= r1; r++) {
    if (inRoom(level, r)) return false;
    for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) !== EMPTY) return false;
  }
  return true;
}

const clearOfParts = (level, rect) => !level.objects.some(o => !OPEN_TO_HAZARDS.has(o.type) && (({ x, y, w, h }) => overlaps(x, y, w, h, rect))(sweepOf(o)));

function laySills(ctx, tube, gauntlet, margin) {
  const { level, rng } = ctx;
  for (const { nodes } of level.segments) {
    for (let i = 1; nodes && i < nodes.length; i++) {
      const node = nodes[i], prev = nodes[i - 1];
      if (node.connector || node.gap < 1 || !rng.chance(gauntlet.sills)) continue;
      const row = Math.max(prev.row, node.row) + SILL_DROP;
      const first = Math.min(prev.col + prev.w, node.col + node.w) - 1, last = Math.max(prev.col, node.col);
      for (let col = first; col <= last; col++) {
        const clearance = { x: col * TILE, y: (row - 1) * TILE, w: TILE, h: 2 * TILE };
        if (openBox(level, clearance) && clearOfParts(level, clearance) && tube.clearOf(clearance, margin)) setTile(level, col, row, SOLID);
      }
    }
  }
}

const flooded = (level, row) => level.segments.some(({ sunken }) => sunken && row >= sunken.roof - 1 && row <= sunken.band);

function layCarpet(ctx, tube, chance, margin, isFace, topOf, dir) {
  const { level, rng } = ctx;
  for (let row = 1; row <= lastRow(level); row++) {
    if (inRoom(level, row) || flooded(level, row)) continue;
    let first = -1;
    for (let col = 0; col <= COLS; col++) {
      const rect = { x: col * TILE, y: topOf(row), w: TILE, h: SPIKE_H };
      const clear = col < COLS && isFace(col, row) && clearOfParts(level, rect) && tube.clearOf(rect, margin);
      if (clear && first < 0) first = col;
      if (!clear && first >= 0) {
        if (rng.chance(chance)) addObject(level, { type: 'spikes', x: first * TILE + 2, y: topOf(row), w: (col - first) * TILE - 4, h: SPIKE_H, dir });
        first = -1;
      }
    }
  }
}

function layCarpets(ctx, tube, gauntlet, margin) {
  const { level, needsCeiling } = ctx;
  const ground = (col, row) => [SOLID, ONE_WAY].includes(tileAt(level, col, row)) && tileAt(level, col, row - 1) === EMPTY;
  const roof = (col, row) => row < lastRow(level) && tileAt(level, col, row) === SOLID && tileAt(level, col, row + 1) === EMPTY;
  layCarpet(ctx, tube, gauntlet.cover, margin, ground, row => row * TILE - SPIKE_H, -1);
  if (!needsCeiling) layCarpet(ctx, tube, gauntlet.ceilings, margin, roof, row => (row + 1) * TILE, 1);
}

const roll = (rng, count) => Math.floor(count) + (rng.chance(count % 1) ? 1 : 0);

function arcOver(states, prev, node, w) {
  const left = Math.min(prev.col + prev.w, node.col + node.w) * TILE, right = Math.max(prev.col, node.col) * TILE;
  const top = Math.min(prev.row, node.row) * TILE;
  return states.filter(s => s.x + w / 2 >= left && s.x + w / 2 <= right && s.y < top + TILE);
}

const sawsIn = level => level.objects.filter(o => o.type === 'saw').length;

function layMine(ctx, tube, col, row, margin) {
  const { level } = ctx;
  if (sawsIn(level) >= MAX_SAWS) return true;
  const mine = { type: 'saw', kind: 'mine', x: col * TILE + (TILE - MINE_SIZE) / 2, y: row * TILE + (TILE - MINE_SIZE) / 2, w: MINE_SIZE, h: MINE_SIZE };
  if (!openBox(level, mine) || !clearOfParts(level, mine) || !tube.clearOf(mine, margin)) return false;
  addObject(level, mine);
  return true;
}

function layLid(ctx, tube, arc, margin) {
  const apex = arc.reduce((top, s) => (s.y < top.y ? s : top));
  const col = Math.floor((apex.x + tube.w / 2) / TILE), from = Math.floor(apex.y / TILE) - 1;
  for (let row = from; row > from - LID_SCAN; row--) if (layMine(ctx, tube, col, row, margin)) return;
}

function layLow(ctx, tube, arc, margin) {
  const mid = arc[arc.length >> 1];
  const col = Math.floor((mid.x + tube.w / 2) / TILE), from = Math.ceil((mid.y + tube.h) / TILE);
  for (let row = from; row < from + LOW_SCAN; row++) if (layMine(ctx, tube, col, row, margin)) return;
}

function anchorAbove(level, col, row) {
  for (let r = row - 1; r > Math.max(0, row - ANCHOR_SCAN); r--) if (tileAt(level, col, r) === SOLID) return r + 1;
  return null;
}

function groundBelow(level, col, row) {
  for (let r = row + 1; r <= Math.min(lastRow(level), row + GROUND_SCAN); r++) if (tileAt(level, col, r) === SOLID && tileAt(level, col, r - 1) === EMPTY) return r;
  return null;
}

function dropper(level, col, row, shape) {
  const top = anchorAbove(level, col, row);
  if (top === null) return null;
  const y = top * TILE;
  return { ...shape, x: col * TILE + (TILE - shape.w) / 2, y, dx: 0, dy: Math.max(2 * TILE, (row + 2) * TILE - y - shape.h), motion: 'drop' };
}

const KILLERS = {
  saw: (level, col, row, period) => ({ type: 'saw', w: SAW_SIZE, h: SAW_SIZE, x: col * TILE + 2, y: (row - 2) * TILE, dx: 0, dy: 4 * TILE, period }),
  flapper: (level, col, row, period) => ({ type: 'monster', kind: 'flapper', w: MONSTER_W, h: MONSTER_H, x: col * TILE + 4, y: (row - 2) * TILE, dx: 0, dy: 3 * TILE, period }),
  urchin: (level, col, row, period) => ({ type: 'monster', kind: 'urchin', motion: 'orbit', w: MONSTER_W, h: MONSTER_H, x: col * TILE + 4, y: (row - 1) * TILE, dx: TILE, dy: TILE, period }),
  spider: (level, col, row, period) => dropper(level, col, row, { type: 'monster', kind: 'spider', w: MONSTER_W, h: MONSTER_H, period: Math.max(120, period) }),
  crusher: (level, col, row, period) => dropper(level, col, row, { type: 'saw', kind: 'crusher', w: 40, h: 30, period: Math.max(120, period) }),
  pendulum(level, col, row, period) {
    const top = anchorAbove(level, col, row);
    if (top === null) return null;
    const pivot = top * TILE, reach = Math.max(2 * TILE, row * TILE - pivot);
    return { type: 'saw', kind: 'pendulum', motion: 'swing', arc: 1, w: SAW_SIZE, h: SAW_SIZE, x: (col + 0.5) * TILE - SAW_SIZE / 2, y: pivot - SAW_SIZE / 2, dx: reach, dy: reach, period: Math.max(120, period) };
  },
  puffer: (level, col, row, period) => ({ type: 'monster', kind: 'puffer', motion: 'puff', w: MONSTER_W, h: MONSTER_W, x: col * TILE + 4, y: (row - 1) * TILE, dx: 0, dy: 0, grow: 16, period: Math.max(120, period) }),
  leaper: (level, col, row, period) => ({ type: 'monster', kind: 'leaper', motion: 'leap', w: MONSTER_W, h: MONSTER_H, x: col * TILE + 4, y: (row + 3) * TILE, dx: 0, dy: 0, lift: 5 * TILE, period: Math.max(120, period) }),
  beam: (level, col, row, period) => ({ type: 'laser', x: col * TILE + 11, y: (row - 3) * TILE, w: 8, h: 6 * TILE, period, on: Math.floor(period * 0.45), dir: 1 }),
  flame(level, col, row, period) {
    const ground = groundBelow(level, col, row);
    if (ground === null) return null;
    return { type: 'laser', kind: 'flame', x: col * TILE + 6, y: (ground - 3) * TILE, w: 18, h: 3 * TILE, period, on: Math.floor(period * 0.45), dir: -1 };
  },
  turret(level, col, row, period) {
    for (let far = 1; far <= TURRET_SCAN; far++) {
      for (const side of [-1, 1]) {
        const at = col + side * far, ground = at >= 0 && at < COLS ? groundBelow(level, at, row - 2) : null;
        if (ground === null) continue;
        const dir = -side, x = at * TILE + (TILE - MONSTER_W) / 2;
        return { type: 'monster', kind: 'spitter', x, y: ground * TILE - MONSTER_H, w: MONSTER_W, h: MONSTER_H, dir, shot: { type: 'shot', x: x + (dir > 0 ? MONSTER_W : -10), y: ground * TILE - 22, w: 10, h: 10, dir, speed: 3.5, range: (far + 3) * TILE, period: Math.max(120, period) } };
      }
    }
    return null;
  },
};

const KILLER_IDS = Object.keys(KILLERS);

const dangerAt = (o, clock) => (o.type === 'laser' ? (phaseOn(o, clock) ? o : null) : objectRect(o, clock));

function missesTube(tube, killer, sweep, margin, drift) {
  for (const box of tube.boxesNear(sweep, margin)) {
    for (const off of [-drift, 0, drift]) {
      const rect = dangerAt(killer, box.clock + off);
      if (rect && overlaps(box.x - margin, box.y - margin, tube.w + 2 * margin, tube.h + 2 * margin, rect)) return false;
    }
  }
  return true;
}

function layKiller(ctx, tube, gauntlet, at, margin, kind) {
  const { level, rng } = ctx;
  const col = Math.floor((at.x + tube.w / 2) / TILE), row = Math.floor(at.y / TILE);
  const built = KILLERS[kind](level, col, row, rng.pick(gauntlet.periods));
  if (!built) return false;
  const { shot, ...body } = built;
  const moving = shot ?? body;
  moving.phase = 0;
  const sweep = sweepOf(moving);
  for (const rect of shot ? [sweep, body] : [sweep]) {
    if (!openBox(level, rect) || !clearOfParts(level, rect) || tube.rests.some(rest => overlaps(rest.x, rest.y, rest.w, rest.h, rect))) return false;
  }
  if (shot && !tube.clearOf(body, margin)) return false;
  for (const k of rng.shuffle(Array.from({ length: PHASE_TRIES }, (_, n) => n))) {
    moving.phase = Math.round((k * moving.period) / PHASE_TRIES);
    if (!missesTube(tube, moving, sweep, margin, gauntlet.tolerance)) continue;
    const placed = addObject(level, body);
    if (shot) addObject(level, { ...shot, source: placed.id });
    return true;
  }
  return false;
}

function affordable(level, kinds) {
  const monsters = levelIndex(level).monsters.length, saws = sawsIn(level);
  return kinds.filter(kind => {
    if (['flapper', 'urchin', 'spider', 'turret', 'puffer', 'leaper'].includes(kind)) return monsters < MAX_MONSTERS;
    return !['saw', 'crusher', 'pendulum'].includes(kind) || saws < MAX_SAWS;
  });
}

function layAir(ctx, tube, gauntlet, margin) {
  const { level, rng, needsCeiling } = ctx;
  if (needsCeiling) return;
  const cast = rng.shuffle([...KILLER_IDS]).slice(0, gauntlet.cast);
  for (const segment of level.segments) {
    if (segment.bounds || segment.sunken || !segment.nodes) continue;
    const states = replay(level, segment.inputs, segment.start);
    for (let i = 1; i < segment.nodes.length; i++) {
      const node = segment.nodes[i], prev = segment.nodes[i - 1];
      if (node.connector || node.rig || node.gap < 1) continue;
      const arc = arcOver(states, prev, node, tube.w);
      if (!arc.length) continue;
      for (let n = roll(rng, gauntlet.mines); n > 0; n--) (rng.chance(0.5) ? layLid : layLow)(ctx, tube, arc, margin);
      for (let n = roll(rng, gauntlet.killers); n > 0; n--) {
        const kinds = affordable(level, cast);
        for (let tries = 0; kinds.length && tries < KILLER_TRIES; tries++) if (layKiller(ctx, tube, gauntlet, rng.pick(arc), margin, rng.pick(kinds))) break;
      }
    }
  }
}

function ledgeSite(ctx, tube, spec, arc) {
  const { level, rng } = ctx;
  if (rng.chance(0.6)) {
    const at = rng.pick(arc), col = clamp(Math.floor(at.x / TILE) + (rng.chance(0.5) ? 1 : -1) * rng.int(3, 9), 0, COLS - 1);
    const ground = groundBelow(level, col, Math.floor(at.y / TILE) - 2);
    return ground === null ? null : { x: col * TILE + (TILE - spec.w) / 2, y: ground * TILE - spec.h };
  }
  const segment = rng.pick(level.segments.filter(({ nodes }) => nodes));
  const inner = segment?.nodes.slice(1, -1).filter(node => node.kind === 'tiles' && !node.connector && node.w >= 3 && node.row < lastRow(level));
  if (!inner?.length) return null;
  const node = rng.pick(inner), left = rng.chance(0.5);
  return { x: left ? node.col * TILE + 1 : (node.col + node.w) * TILE - spec.w - 1, y: node.row * TILE - spec.h };
}

function ceilingSite(ctx, tube, spec, arc) {
  const col = Math.floor((ctx.rng.pick(arc).x + tube.w / 2) / TILE), row = Math.floor(arc[0].y / TILE);
  const top = anchorAbove(ctx.level, col, row);
  return top === null ? null : { x: col * TILE + (TILE - spec.w) / 2, y: top * TILE };
}

function airSite(ctx, tube, spec, arc) {
  const { rng } = ctx, at = rng.pick(arc), side = rng.chance(0.5) ? 1 : -1;
  return { x: clamp(at.x + side * rng.int(5, 8) * TILE, 0, COLS * TILE - spec.w), y: at.y + rng.int(-3, 3) * TILE };
}

const LURKER_SITES = { ledge: ledgeSite, ceiling: ceilingSite, air: airSite };

function clearsProofs(level, o, proofs, margin, w, h) {
  return proofs.every(({ start, inputs }) => replay(level, inputs, start).every(s => !s.dead && !dangersOf(o, lurkerOf(o, s)).some(zone => overlaps(s.x - margin, s.y - margin, w + 2 * margin, h + 2 * margin, zone))));
}

function layLurkers(ctx, tube, gauntlet, margin, extraProofs) {
  const { level, rng, needsCeiling } = ctx;
  if (needsCeiling) return;
  const proofs = [...level.segments.map(({ start, inputs }) => ({ start, inputs })), ...extraProofs];
  const spawns = level.segments.map(({ start }) => start);
  const cast = rng.shuffle(Object.keys(LURKERS).filter(kind => LURKERS[kind].from <= ctx.index));
  const arcs = level.segments.filter(({ nodes }) => nodes).flatMap(segment => {
    const states = replay(level, segment.inputs, segment.start);
    return segment.nodes.slice(1).map((node, i) => arcOver(states, segment.nodes[i], node, tube.w)).filter(arc => arc.length);
  });
  if (!arcs.length) return;
  for (let n = 0; n < gauntlet.lurkers; n++) {
    const kind = cast[n % cast.length], spec = LURKERS[kind];
    for (let tries = 0; tries < LURKER_TRIES; tries++) {
      const site = LURKER_SITES[spec.site](ctx, tube, spec, rng.pick(arcs));
      if (!site) continue;
      const rect = { ...site, w: spec.w, h: spec.h };
      if (!openBox(level, rect) || !clearOfParts(level, rect) || tube.rests.some(rest => overlaps(rest.x, rest.y, rest.w, rest.h, rect))) continue;
      if (spawns.some(s => Math.hypot(s.x - rect.x, s.y - rect.y) < LURKER_SPAWN_GAP)) continue;
      const placed = addObject(level, { type: 'lurker', kind, ...rect });
      if (clearsProofs(level, placed, proofs, margin, tube.w, tube.h)) break;
      level.objects.pop();
    }
  }
}

export function layHurdles(ctx) {
  const { nodes, level, rng } = ctx;
  const gauntlet = gauntletOf(ctx.index);
  if (!gauntlet || ctx.index < 2) return;
  nodes.forEach((node, i) => {
    if (i < 2 || !plainNode(ctx, i) || node.w < HURDLE_SPACING + 1 || !rng.chance(gauntlet.cover)) return;
    node.reserved = true;
    for (let col = node.col + 1; col < node.col + node.w - 1; col += HURDLE_SPACING) {
      addObject(level, { type: 'spikes', x: col * TILE + 3, y: node.row * TILE - SPIKE_H, w: TILE - 6, h: SPIKE_H, dir: -1 });
    }
  });
}

function guardLedges(level, tube) {
  for (const { nodes } of level.segments) {
    const top = nodes?.at(-1);
    if (top) tube.rests.push({ x: top.col * TILE - REST_MARGIN, y: (top.row - LEDGE_HEADROOM) * TILE, w: top.w * TILE + 2 * REST_MARGIN, h: (LEDGE_HEADROOM + 1) * TILE });
  }
  for (const spring of level.objects.filter(o => o.type === 'spring' && o.dir === -1)) {
    const rise = Math.ceil((spring.vel * spring.vel) / (2 * level.rules.gravity) / TILE) + 2;
    tube.rests.push({ x: spring.x - TILE - 4, y: spring.y + spring.h - rise * TILE, w: spring.w + 2 * TILE + 8, h: rise * TILE });
  }
}

export function runGauntlet(ctx, extraProofs) {
  const { level } = ctx;
  const gauntlet = gauntletOf(ctx.index);
  if (!gauntlet) return;
  const tube = new Tube(level);
  level.dressedFrom = level.objects.length;
  const margin = 2 + gauntlet.tolerance;
  for (const segment of level.segments) layStretch(level, tube, segment, gauntlet.tolerance);
  for (const { start, inputs } of extraProofs) replay(level, inputs, start).forEach(s => tube.addState(s));
  guardLedges(level, tube);
  laySills(ctx, tube, gauntlet, margin);
  layCarpets(ctx, tube, gauntlet, margin);
  layAir(ctx, tube, gauntlet, margin);
  layLurkers(ctx, tube, gauntlet, margin, extraProofs);
}
