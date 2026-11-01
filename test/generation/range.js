import { writeFileSync } from 'node:fs';
import { generateBiome } from '../../src/generator.js';
import { replay } from '../../src/solver.js';
import { TILE, COLS, HAZARD_TYPES } from '../../src/level.js';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
const seedCount = +(positional[0] ?? 12);
const depths = (positional[1] ?? '1,3,6').split(',').map(Number);

const MECHANICS = ['jump', 'kick', 'dash', 'climb', 'swing', 'carry', 'plate', 'bounce'];

function mechanicsOf(level, states) {
  const fired = new Set();
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    if (b.jumpsUsed > a.jumpsUsed) fired.add('jump');
    if (b.lastKick !== 0 && b.lastKick !== a.lastKick) fired.add('kick');
    if (b.dashTimer > 0 && a.dashTimer === 0) fired.add('dash');
    if (b.climbing) fired.add('climb');
    if (b.rope >= 0) fired.add('swing');
    if (b.held >= 0) fired.add('carry');
    if (b.pressed !== 0) fired.add('plate');
    if (b.vy < a.vy - 10 && a.vy > 0) fired.add('bounce');
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
  const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
  const hazards = level.objects.filter(o => HAZARD_TYPES.has(o.type) && o.y >= top - 3 * TILE && o.y <= bottom + TILE).length;
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
  let level;
  try { level = generateBiome(seed, depth, null); } catch { rows.push({ seed, depth, failed: true }); continue; }
  const ms = Date.now() - t;
  level.segments.forEach((segment, k) => rows.push({ seed, depth, focus: level.focus, style: level.style, mutators: level.mutators.join('+'), ms, stretch: k, ...stretchMetrics(level, segment) }));
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

const summary = {
  stretches: ok.length, failures: rows.length - ok.length, avgMs: Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length),
  meanRise: mean('meanRise'), flipRate: mean('flipRate'), linearity: mean('linearity'), framesPerJump: mean('framesPerJump'), idleShare: mean('idleShare'), hazards: mean('hazards'),
  riseHistogram: histogram('meanRise', v => Math.round(v * 2) / 2), flipHistogram: histogram('flipRate', v => Math.round(v * 10) / 10),
  mechanicsCoverage: coverage, puzzles, totalSeconds: Math.round((Date.now() - started) / 1000),
};
for (const r of ok) console.log(`${r.seed} d${r.depth} ${r.focus.padEnd(8)} s${r.stretch} rise ${r.meanRise} flips ${r.flipRate} lin ${r.linearity} f/j ${r.framesPerJump} idle ${r.idleShare} haz ${r.hazards} ${r.puzzle ?? '-'} [${r.mechanics.join(' ')}]`);
console.log(JSON.stringify(summary, null, 1));
const out = flag('--json');
if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
