import { writeFileSync } from 'node:fs';
import { generateBiome } from '../../src/generator.js';
import { replay } from '../../src/solver.js';
import { TILE, COLS, HAZARD_TYPES } from '../../src/level.js';
import { playerSize } from '../../src/physics.js';

const AREA_OF_INTEREST = 3 * TILE;

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
const seedCount = +(positional[0] ?? 12);
const depths = (positional[1] ?? '1,3,6').split(',').map(Number);

const MECHANICS = ['jump', 'kick', 'walljump', 'dash', 'climb', 'swing', 'grip', 'cannon', 'carry', 'plate', 'bounce', 'refill', 'timer'];

function mechanicsOf(level, states) {
  const fired = new Set();
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    if (b.jumpsUsed > a.jumpsUsed) fired.add('jump');
    if (b.lastKick !== 0 && b.lastKick !== a.lastKick) fired.add('kick');
    if (b.dashTimer > 0 && a.dashTimer === 0) fired.add('dash');
    if (b.climbing) fired.add('climb');
    if (b.rope >= 0) fired.add(level.objects[b.rope].grip ? 'grip' : 'swing');
    if (b.barrel >= 0) fired.add('cannon');
    if (b.held >= 0) fired.add('carry');
    if (b.pressed !== 0) fired.add('plate');
    if (a.vy > 0 && b.vy < -1 && !a.grounded && b.jumpsUsed === a.jumpsUsed && b.rope < 0 && !b.climbing) fired.add('bounce');
    if (b.spent & ~a.spent) fired.add('refill');
    if (b.timers.some((t, k) => t !== a.timers[k])) fired.add('timer');
    if (b.jumpsUsed > a.jumpsUsed && !a.grounded && a.coyote === 0 && a.rope < 0 && !a.climbing && a.jumpsLeft === 0 && !(b.spent & ~a.spent)) fired.add('walljump');
  }
  return MECHANICS.filter(m => fired.has(m));
}

function linearity(points) {
  const n = points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / n, mx = points.reduce((s, p) => s + p.x, 0) / n;
  const sxy = points.reduce((s, p) => s + (p.y - my) * (p.x - mx), 0), syy = points.reduce((s, p) => s + (p.y - my) ** 2, 0) || 1;
  const slope = sxy / syy;
  const rms = Math.sqrt(points.reduce((s, p) => s + (p.x - (mx + slope * (p.y - my))) ** 2, 0) / n);
  return 1 - Math.min(1, rms / (COLS * TILE / 4));
}

function nearPath(level, s, o) {
  const { w, h } = playerSize(level.rules);
  const x = Math.min(o.x, o.x + (o.dx ?? 0)), y = Math.min(o.y, o.y + (o.dy ?? 0)), ow = o.w + Math.abs(o.dx ?? 0), oh = o.h + Math.abs(o.dy ?? 0);
  return s.x < x + ow + AREA_OF_INTEREST && s.x + w > x - AREA_OF_INTEREST && s.y < y + oh + AREA_OF_INTEREST && s.y + h > y - AREA_OF_INTEREST;
}

function stretchMetrics(level, segment) {
  const states = replay(level, segment.inputs, segment.start);
  const points = segment.route.filter(p => p.w !== undefined);
  let jumps = 0, idle = 0, flips = 0, rise = 0;
  for (let i = 1; i < states.length; i++) {
    if (states[i].jumpsUsed > states[i - 1].jumpsUsed) jumps++;
    if (Math.abs(states[i].x - states[i - 1].x) < 0.01 && Math.abs(states[i].y - states[i - 1].y) < 0.01) idle++;
  }
  for (let i = 1; i < points.length; i++) {
    rise += (points[i - 1].y - points[i].y) / TILE;
    if (i > 1 && Math.sign(points[i].x - points[i - 1].x) !== Math.sign(points[i - 1].x - points[i - 2].x)) flips++;
  }
  const hazards = level.objects.filter(o => HAZARD_TYPES.has(o.type) && states.some(s => nearPath(level, s, o))).length;
  const legs = Math.max(1, points.length - 1);
  return {
    puzzle: segment.puzzle, frames: states.length, jumps, framesPerJump: +(states.length / Math.max(1, jumps)).toFixed(1),
    idleShare: +(idle / states.length).toFixed(2), legs, meanRise: +(rise / legs).toFixed(2), flipRate: +(flips / legs).toFixed(2),
    linearity: +linearity(points).toFixed(2), hazards, mechanics: mechanicsOf(level, states),
  };
}

const rows = [];
const started = Date.now();
for (const depth of depths) for (let i = 0; i < seedCount; i++) {
  const seed = `range-${i}`, t = Date.now();
  let level, restarts = 0;
  try { level = generateBiome(seed, depth, null, [], null, (_, stage) => { if (stage.startsWith('starting')) restarts++; }); } catch { rows.push({ seed, depth, failed: true }); continue; }
  const ms = Date.now() - t;
  level.segments.forEach((segment, k) => rows.push({ seed, depth, focus: level.focus, style: level.style, mutators: level.mutators.join('+'), ms, restarts, stretch: k, ...stretchMetrics(level, segment) }));
}

const ok = rows.filter(r => !r.failed);
const mean = key => +(ok.reduce((s, r) => s + r[key], 0) / ok.length).toFixed(2);
const histogram = (key, bucket) => {
  const h = {};
  for (const r of ok) { const b = bucket(r[key]); h[b] = (h[b] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(h).sort(([a], [b]) => +a - +b));
};
const coverage = {};
for (const r of ok) { const key = r.mechanics.join('+') || 'none'; coverage[key] = (coverage[key] ?? 0) + 1; }
const puzzles = {};
for (const r of ok) if (r.puzzle) puzzles[r.puzzle] = (puzzles[r.puzzle] ?? 0) + 1;

const biomesOf = list => [...new Map(list.map(r => [`${r.seed}/${r.depth}`, r])).values()];
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
const curve = key => {
  const groups = {};
  for (const r of ok) (groups[r[key]] ??= []).push(r);
  return Object.fromEntries(Object.entries(groups).map(([k, list]) => [k, { framesPerJump: median(list.map(r => r.framesPerJump)), hazards: +(list.reduce((s, r) => s + r.hazards, 0) / list.length).toFixed(2), puzzles: +(list.filter(r => r.puzzle).length / list.length).toFixed(2) }]));
};
const times = biomesOf(ok).map(r => r.ms);

const summary = {
  stretches: ok.length, failures: rows.length - ok.length, avgMs: Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length), medianMs: median(times), p90Ms: [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.9)], restartedBiomes: biomesOf(ok).filter(r => r.restarts > 0).length, byDepth: curve('depth'), byStretch: curve('stretch'),
  meanRise: mean('meanRise'), flipRate: mean('flipRate'), linearity: mean('linearity'), framesPerJump: mean('framesPerJump'), idleShare: mean('idleShare'), hazards: mean('hazards'),
  riseHistogram: histogram('meanRise', v => Math.round(v * 2) / 2), flipHistogram: histogram('flipRate', v => Math.round(v * 10) / 10),
  mechanicsCoverage: coverage, puzzles, totalSeconds: Math.round((Date.now() - started) / 1000),
};
for (const r of ok) console.log(`${r.seed} d${r.depth} ${r.focus.padEnd(8)} s${r.stretch} rise ${r.meanRise} flips ${r.flipRate} lin ${r.linearity} f/j ${r.framesPerJump} idle ${r.idleShare} haz ${r.hazards} ${r.puzzle ?? '-'} [${r.mechanics.join(' ')}]`);
console.log(JSON.stringify(summary, null, 1));
const out = flag('--json');
if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
