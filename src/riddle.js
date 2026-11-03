import { lockPowered } from './level.js?v=025552d';

export const EXIT = -1;

const NOBODY = -1;
const FUSE = 128;
const PLATE_SITE = 16;
const LINK_SITE = 32;
const CELL_BITS = 3, HELD_BITS = 2, CRATE_BITS = 6;
const STATE_LIMIT = 20000;
const MIN_INPUTS = 2;
const MAX_INPUTS = 4;
const TUNING_STEPS = 60;
const MOVE_LEVER_SHARE = 0.25;
const ADD_LEVER_SHARE = 0.1;
const CONFLICT_TENSION = 6;
const UNDO_TENSION = 3;

const MAX_CRATES = 3;
const RECENT_BIAS = 0.7;
const CRATE_REUSE = 0.65;

const SIDE_KINDS = ['open', 'step', 'door', 'beam', 'plug', 'portal', 'fuse'];
const WIDE_KINDS = ['pit', 'bridge'];
const UP_KINDS = ['ladder', 'spring', 'hatch'];
const DOWN_KINDS = ['drop', 'ladder', 'hatch'];
const EXIT_KINDS = ['hatch', 'ladder', 'spring'];
const SIGNALLED = new Set(['door', 'shutter', 'bridge', 'hatch', 'trapdoor']);
const SHAFTS = new Set(['ladder', 'hatch', 'trapdoor', 'drop']);
const LOBBED_OVER = new Set(['beam', 'plug', 'portal']);
const TWISTS = { open: 'shutter', ladder: 'trapdoor' };
const QUIET_WORDS = new Set(['open', 'step', 'ladder', 'drop', 'spring']);
const WORK = new Set(['lift', 'press', 'plug', 'stone', 'lob', 'chute', 'launch', 'take', 'pull', 'set']);
const GATED_KINDS = { door: 'door', hatch: 'hatch', bridge: 'bridge', open: 'door', ladder: 'hatch' };
const PURPOSES = new Set(['press', 'plug', 'stone', 'lob', 'chute', 'launch']);

function signalOf(riddle, s) {
  let bits = s.flags;
  riddle.plates.forEach((plate, p) => { if (s.at.some((site, k) => k !== s.held && site === PLATE_SITE + p)) bits |= plate.bit; });
  return bits;
}

const canHop = (riddle, s) => s.held === NOBODY || riddle.crates[s.held].kind !== 'steel';
const empty = s => s.held === NOBODY;
const lit = (riddle, s, link) => lockPowered(link, signalOf(riddle, s));
const filled = (riddle, s, link) => s.at.some((site, k) => k !== s.held && site === LINK_SITE + riddle.links.indexOf(link));

const CROSSING = {
  open: () => true,
  portal: () => true,
  step: (riddle, s, link, up) => !up || canHop(riddle, s),
  door: lit,
  bridge: lit,
  shutter: (riddle, s, link) => !lit(riddle, s, link),
  fuse: (riddle, s) => (s.flags & FUSE) !== 0,
  beam: (riddle, s) => !empty(s),
  plug: (riddle, s, link) => filled(riddle, s, link) && canHop(riddle, s),
  pit: (riddle, s, link) => filled(riddle, s, link) && empty(s),
  ladder: (riddle, s) => empty(s),
  hatch: (riddle, s, link) => empty(s) && lit(riddle, s, link),
  trapdoor: (riddle, s, link) => empty(s) && !lit(riddle, s, link),
  drop: (riddle, s, link, up) => !up,
  spring: (riddle, s, link, up) => up,
};

function encode(s) {
  let key = s.cell | ((s.held + 1) << CELL_BITS);
  let shift = CELL_BITS + HELD_BITS;
  for (let k = 0; k < s.at.length; k++, shift += CRATE_BITS) key |= (k === s.held ? 0 : s.at[k]) << shift;
  return key * 256 + s.flags;
}

function crateMoves(riddle, s, link, index, up, to, go, moved) {
  const kind = riddle.crates[s.held].kind;
  if (link.kind === 'plug') go({ type: 'plug', crate: s.held, link: index }, { held: NOBODY, at: moved(LINK_SITE + index) });
  if (link.kind === 'pit' && kind === 'wood') go({ type: 'stone', crate: s.held, link: index }, { held: NOBODY, at: moved(LINK_SITE + index) });
  if (to === EXIT) return;
  if (LOBBED_OVER.has(link.kind) && kind === 'wood') go({ type: 'lob', crate: s.held, link: index, to }, { held: NOBODY, at: moved(to) });
  if (!up && SHAFTS.has(link.kind)) go({ type: 'chute', crate: s.held, link: index, to }, { held: NOBODY, at: moved(to) });
  if (up && link.kind === 'spring' && kind === 'wood') go({ type: 'launch', crate: s.held, link: index, to }, { held: NOBODY, at: moved(to) });
}

function successors(riddle, s, oneWay) {
  const next = [];
  const go = (action, change) => {
    const state = { ...s, ...change };
    if (action.type !== 'cross' && action.type !== 'take') state.flags &= ~FUSE;
    next.push({ action, state });
  };
  const moved = site => s.at.map((v, k) => (k === s.held ? site : v));
  if (!empty(s)) go({ type: 'set', crate: s.held, cell: s.cell }, { held: NOBODY, at: moved(s.cell) });
  riddle.links.forEach((link, index) => {
    const up = link.low === s.cell;
    if (!up && link.high !== s.cell) return;
    const to = up ? link.high : link.low;
    if (CROSSING[link.kind](riddle, s, link, up)) go({ type: 'cross', link: index, from: s.cell, to, held: s.held }, { cell: to });
    if (!empty(s)) crateMoves(riddle, s, link, index, up, to, go, moved);
    else if (link.kind === 'plug') s.at.forEach((site, k) => { if (site === LINK_SITE + index) go({ type: 'lift', crate: k, link: index }, { held: k }); });
  });
  riddle.pickups.forEach((pickup, i) => {
    if (pickup.cell !== s.cell) return;
    const on = (s.flags & pickup.bit) !== 0;
    if (pickup.type === 'lever') {
      if (empty(s) && !(oneWay && on)) go({ type: 'pull', pickup: i }, { flags: s.flags ^ pickup.bit });
    } else if (!on) go({ type: 'take', pickup: i }, { flags: s.flags | pickup.bit });
  });
  if (empty(s)) {
    s.at.forEach((site, k) => {
      if (site === s.cell) go({ type: 'lift', crate: k }, { held: k });
      else if (!oneWay && site >= PLATE_SITE && site < LINK_SITE && riddle.plates[site - PLATE_SITE].cell === s.cell) go({ type: 'lift', crate: k, plate: site - PLATE_SITE }, { held: k });
    });
  } else {
    riddle.plates.forEach((plate, p) => {
      if (plate.cell === s.cell) go({ type: 'press', crate: s.held, plate: p }, { held: NOBODY, at: moved(PLATE_SITE + p) });
    });
  }
  return next;
}

function explore(riddle, oneWay = false) {
  const start = { cell: riddle.entry, held: NOBODY, at: riddle.crates.map(c => c.cell), flags: 0 };
  const ids = new Map([[encode(start), 0]]);
  const states = [start], parents = [-1], arrivals = [null], edges = [], incoming = [[]], goals = [];
  for (let i = 0; i < states.length && states.length < STATE_LIMIT; i++) {
    edges.push([]);
    for (const { action, state } of successors(riddle, states[i], oneWay)) {
      if (state.cell === EXIT) { goals.push({ from: i, action }); continue; }
      const key = encode(state);
      let id = ids.get(key);
      if (id === undefined) {
        id = states.length;
        ids.set(key, id);
        states.push(state); parents.push(i); arrivals.push(action); incoming.push([]);
      }
      incoming[id].push(i);
      edges[i].push({ action, to: id });
    }
  }
  return { states, parents, arrivals, edges, incoming, goals, capped: states.length >= STATE_LIMIT };
}

function trail(search) {
  const goal = search.goals[0], ids = [], actions = [goal.action];
  for (let i = goal.from; i >= 0; i = search.parents[i]) {
    ids.push(i);
    if (i > 0) actions.push(search.arrivals[i]);
  }
  return { ids: ids.reverse(), actions: actions.reverse() };
}

function stepsToGoal(search) {
  const dist = new Int32Array(search.states.length).fill(-1), queue = [];
  for (const goal of search.goals) if (dist[goal.from] < 0) { dist[goal.from] = 1; queue.push(goal.from); }
  for (let q = 0; q < queue.length; q++) for (const p of search.incoming[queue[q]]) if (dist[p] < 0) { dist[p] = dist[queue[q]] + 1; queue.push(p); }
  return dist;
}

const solvable = riddle => { const search = explore(riddle); return search.goals.length > 0 && !search.capped; };
const without = (riddle, part, item) => ({ ...riddle, [part]: riddle[part].filter(x => x !== item) });

function idleParts(riddle) {
  const parts = ['crates', 'pickups', 'plates'].flatMap(part => riddle[part].map(item => without(riddle, part, item)));
  return parts.filter(solvable).length;
}

const wordOf = link => link.gate?.op ?? link.kind;

const INVERTED = new Set(['shutter', 'trapdoor']);
const lockOpen = (riddle, s, link) => lit(riddle, s, link) !== INVERTED.has(link.kind);

function conflictsIn(riddle, states, ids, solution) {
  return solution.slice(0, -1).filter((action, i) => {
    if (action.type === 'cross') return false;
    const before = states[ids[i]], after = states[ids[i + 1]];
    const ahead = solution.slice(i + 1).filter(a => a.type === 'cross').map(a => riddle.links[a.link]);
    return ahead.some(link => link.bit && link.bit !== FUSE && lockOpen(riddle, before, link) && !lockOpen(riddle, after, link));
  }).length;
}

function undoneIn(solution) {
  const pulled = new Set();
  return solution.filter(a => {
    if (a.type === 'lift') return a.plate !== undefined;
    if (a.type !== 'pull') return false;
    const again = pulled.has(a.pickup);
    pulled.add(a.pickup);
    return again;
  }).length;
}

export function signatureOf(riddle, solution) {
  return solution.flatMap(a => {
    if (a.type === 'cross') { const word = wordOf(riddle.links[a.link]); return QUIET_WORDS.has(word) ? [] : [word]; }
    if (a.type === 'take' || a.type === 'pull') return [riddle.pickups[a.pickup].type];
    return a.type === 'set' ? [] : [a.type];
  }).join('>');
}

export function appraise(riddle) {
  const search = explore(riddle);
  if (!search.goals.length || search.capped) return null;
  const { ids, actions: solution } = trail(search);
  const dist = stepsToGoal(search);
  const crossings = solution.filter(a => a.type === 'cross');
  const seen = new Set([riddle.entry]);
  let revisits = 0;
  for (const a of crossings) { if (seen.has(a.to)) revisits++; seen.add(a.to); }
  const uses = new Map();
  const count = k => uses.set(k, (uses.get(k) ?? 0) + 1);
  for (const a of solution) {
    if (PURPOSES.has(a.type)) count(a.crate);
    if (a.type === 'cross' && riddle.links[a.link].kind === 'beam') count(a.held);
  }
  const temptations = ids.reduce((sum, id) => sum + search.edges[id].filter(e => WORK.has(e.action.type) && dist[e.to] < 0).length, 0);
  return {
    solution, cells: seen.size, revisits, temptations,
    work: solution.filter(a => WORK.has(a.type)).length,
    crossings: crossings.length,
    reuse: [...uses.values()].filter(n => n > 1).length,
    gates: new Set(crossings.map(a => wordOf(riddle.links[a.link])).filter(word => !QUIET_WORDS.has(word))).size,
    undone: undoneIn(solution),
    conflicts: conflictsIn(riddle, search.states, ids, solution),
    chore: temptations === 0 && explore(riddle, true).goals.length > 0,
    idle: idleParts(riddle),
    signature: signatureOf(riddle, solution),
  };
}

function nearbyCell(rng, reach) {
  return rng.chance(RECENT_BIAS) ? reach.at(-1) : rng.pick(reach);
}

function crateFor(draft, rng, reach, kinds) {
  const usable = draft.crates.filter(c => kinds.includes(c.kind) && reach.includes(c.cell));
  if (usable.length && (rng.chance(CRATE_REUSE) || draft.crates.length >= MAX_CRATES)) return usable[0];
  if (draft.crates.length >= MAX_CRATES) return null;
  const crate = { kind: rng.pick(kinds), cell: nearbyCell(rng, reach) };
  draft.crates.push(crate);
  return crate;
}

function signalFor(draft, rng, reach, style) {
  const options = Object.entries(style.sources);
  const source = rng.weighted(options, ([, weight]) => weight)[0];
  const bit = 1 << draft.signals++;
  if (source === 'plate') {
    if (!crateFor(draft, rng, reach, ['wood', 'steel'])) return null;
    draft.plates.push({ bit, cell: nearbyCell(rng, reach) });
  } else {
    draft.pickups.push({ type: source, bit, cell: nearbyCell(rng, reach) });
  }
  return bit;
}

function gateFor(draft, rng, reach, style, kinds, link) {
  const options = kinds.map(kind => [kind, style.gates[kind] ?? 0]).filter(([, weight]) => weight > 0);
  if (!options.length) return false;
  const kind = rng.weighted(options, ([, weight]) => weight)[0];
  link.kind = kind;
  if (SIGNALLED.has(kind)) {
    link.bit = signalFor(draft, rng, reach, style);
    return !!link.bit;
  }
  if (kind === 'beam' || kind === 'plug') return !!crateFor(draft, rng, reach, ['wood', 'steel']);
  if (kind === 'pit') return !!crateFor(draft, rng, reach, ['wood']);
  if (kind === 'fuse') {
    if (draft.pickups.some(p => p.type === 'timer')) return false;
    draft.pickups.push({ type: 'timer', bit: FUSE, cell: nearbyCell(rng, reach) });
  }
  return true;
}

export function compose(graph, rng, style) {
  const draft = { cells: graph.cells, entry: graph.entry, crates: [], pickups: [], plates: [], links: [], signals: 0 };
  const reach = [graph.entry];
  const edges = rng.shuffle([...graph.sides, ...graph.lifts]);
  const ends = e => (e.side ? [e.a, e.b] : [e.low, e.high]);
  for (;;) {
    const at = edges.findIndex(e => { const [a, b] = ends(e); return reach.includes(a) !== reach.includes(b); });
    if (at < 0) break;
    const [edge] = edges.splice(at, 1);
    const [a, b] = ends(edge);
    const rising = reach.includes(a);
    const kinds = edge.side ? (edge.wide ? WIDE_KINDS : SIDE_KINDS) : rising ? UP_KINDS : DOWN_KINDS;
    const link = { low: edge.side && !rising ? b : a, high: edge.side && !rising ? a : b, geometry: edge };
    if (!gateFor(draft, rng, reach, style, kinds, link)) return null;
    draft.links.push(link);
    reach.push(rising ? b : a);
  }
  const tops = reach.filter(cell => graph.tops.includes(cell));
  if (!tops.length) return null;
  const last = tops.includes(reach.at(-1)) && rng.chance(RECENT_BIAS) ? reach.at(-1) : rng.pick(tops);
  const exit = { low: last, high: EXIT, geometry: { exit: true } };
  if (!gateFor(draft, rng, reach, style, EXIT_KINDS, exit)) return null;
  draft.links.push(exit);
  return draft;
}

function randomGate(rng, inputs, { ops, negate }) {
  const [a, b] = rng.shuffle(inputs);
  const op = rng.pick(ops);
  return { op, mask: a | b, not: op !== 'xor' && rng.chance(negate) ? rng.pick([a, b]) : 0 };
}

const inputsOf = riddle => [...riddle.plates, ...riddle.pickups.filter(p => p.type !== 'timer')].map(source => source.bit);

function withLever(riddle, rng) {
  const bit = inputsOf(riddle).reduce((high, b) => Math.max(high, b), 0) * 2 || 1;
  if (bit >= FUSE) return riddle;
  return { ...riddle, pickups: [...riddle.pickups, { type: 'lever', bit, cell: rng.int(0, riddle.cells - 1) }] };
}

function regated(riddle, rng, circuit) {
  const gated = riddle.links.filter(l => l.gate);
  const pool = gated.length < circuit.locks[1] ? riddle.links.filter(l => GATED_KINDS[l.kind]) : gated;
  const target = rng.pick(pool), gate = randomGate(rng, inputsOf(riddle), circuit);
  return { ...riddle, links: riddle.links.map(l => (l === target ? { ...l, kind: GATED_KINDS[l.kind], gate, bit: gate.mask } : l)) };
}

function leverMoved(riddle, rng) {
  const levers = riddle.pickups.filter(p => p.type === 'lever');
  if (!levers.length) return riddle;
  const lever = rng.pick(levers), cell = rng.int(0, riddle.cells - 1);
  return { ...riddle, pickups: riddle.pickups.map(p => (p === lever ? { ...p, cell } : p)) };
}

function mutated(riddle, rng, circuit) {
  const roll = rng.float(0, 1);
  if (roll < MOVE_LEVER_SHARE) return leverMoved(riddle, rng);
  if (roll < MOVE_LEVER_SHARE + ADD_LEVER_SHARE && inputsOf(riddle).length < MAX_INPUTS) return withLever(riddle, rng);
  return regated(riddle, rng, circuit);
}

function tension(riddle, stars) {
  const search = explore(riddle);
  if (!search.goals.length || search.capped) return -1;
  const { ids, actions } = trail(search);
  if (stars && !signatureOf(riddle, actions).split('>').some(word => stars.includes(word))) return -1;
  const crossed = new Set(actions.filter(a => a.type === 'cross').map(a => a.link)).size;
  return CONFLICT_TENSION * Math.min(conflictsIn(riddle, search.states, ids, actions), 3) + UNDO_TENSION * Math.min(undoneIn(actions), 3) + crossed;
}

const withoutUnused = riddle => {
  const used = riddle.links.reduce((bits, l) => bits | (l.bit ?? 0), 0);
  return { ...riddle, plates: riddle.plates.filter(p => p.bit & used), pickups: riddle.pickups.filter(p => p.type === 'timer' || p.bit & used) };
};

export function rewire(riddle, rng, circuit, stars = null) {
  let best = riddle;
  while (inputsOf(best).length < MIN_INPUTS) best = withLever(best, rng);
  if (inputsOf(best).length < MIN_INPUTS) return null;
  for (let n = rng.int(...circuit.locks); n > 0; n--) best = regated(best, rng, circuit);
  let score = tension(best, stars);
  for (let step = 0; step < TUNING_STEPS; step++) {
    const next = mutated(best, rng, circuit), value = tension(next, stars);
    if (value >= score) { best = next; score = value; }
  }
  if (score < 0) return null;
  const tidy = withoutUnused(best);
  return tension(tidy, stars) >= score ? tidy : best;
}

export function twist(riddle, rng) {
  const signals = [...riddle.plates, ...riddle.pickups.filter(p => p.type !== 'timer')].map(source => source.bit);
  const links = riddle.links.filter(l => TWISTS[l.kind] && l.high !== EXIT);
  if (!signals.length || !links.length) return null;
  const link = rng.pick(links), bit = rng.pick(signals);
  return { ...riddle, links: riddle.links.map(l => (l === link ? { ...l, kind: TWISTS[l.kind], bit } : l)) };
}
