import { writeFileSync } from 'node:fs';
import { generateBiome } from '../../src/generator.js';
import { replay, solve } from '../../src/solver.js';
import { levelIndex, overlaps } from '../../src/level.js';
import { playerSize } from '../../src/physics.js';

const WINDOW = 8;
const KNOCKOUT_TYPES = new Set(['key', 'switch', 'crate', 'timer', 'plate']);
const KNOCKOUT_SEARCHES = [{ grain: 4, maxNodes: 4000 }];

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const seedCount = +flag('--seeds', 6);
const length = +flag('--climb', 8);
const knockouts = flag('--knockouts', 'off') !== 'off';
const out = flag('--json');

function traceOf(level, segment) {
  const states = replay(level, segment.inputs, segment.start);
  const { w, h } = playerSize(level.rules);
  const { crates } = levelIndex(level);
  const gates = level.objects.filter(o => o.type === 'door' || o.type === 'toggle');
  const beams = level.objects.filter(o => o.type === 'laser' && o.steady);
  const passed = new Set();
  const trace = [];
  const note = event => { if (trace.at(-1) !== event) trace.push(event); };
  for (let i = 1; i < states.length; i++) {
    const a = states[i - 1], b = states[i];
    const gained = b.flags & ~a.flags;
    if (gained) note(level.objects.find(o => (o.type === 'key' || o.type === 'switch') && o.bit & gained)?.type ?? 'flag');
    if (b.timers.some((t, k) => t !== a.timers[k])) note('timer');
    if (a.held < 0 && b.held >= 0) note(`lift-${crates[b.held].kind}`);
    if (a.held >= 0 && b.held < 0) note(b.bodies[a.held].vx !== 0 ? 'throw' : 'drop');
    const pressed = b.pressed & ~a.pressed;
    if (pressed) {
      const plates = level.objects.filter(o => o.type === 'plate' && o.bit & pressed);
      const byPlayer = plates.some(p => overlaps(b.x, b.y, w, h, p));
      if (!byPlayer) note('press');
    }
    if (a.rope < 0 && b.rope >= 0) note('swing');
    for (const gate of gates) if (!passed.has(gate) && overlaps(b.x, b.y, w, h, gate)) { passed.add(gate); note(gate.type === 'toggle' && gate.on ? 'bridge' : 'gate'); }
    for (const beam of beams) if (!passed.has(beam) && overlaps(b.x, b.y, w, h, beam)) { passed.add(beam); note(b.held >= 0 ? 'shield' : 'plugged'); }
  }
  return trace;
}

const INTERACTIONS = /^(key|switch|timer|lift|throw|drop|press|shield|plugged|gate|bridge)/;

function backtrackRows(states) {
  let total = 0;
  const landed = states.filter(s => s.grounded);
  for (let i = 1; i < landed.length; i++) total += Math.max(0, landed[i].y - landed[i - 1].y);
  return total / 30;
}

function needed(level, segment, object) {
  const goal = level.objects.filter(o => o.type === 'checkpoint')[level.segments.indexOf(segment)] ?? null;
  const bare = { ...level, objects: level.objects.map(o => o === object && o.type !== 'crate' ? { ...o, type: 'removed' } : o) };
  const crates = levelIndex(level).crates, slot = crates.indexOf(object);
  const start = { ...segment.start, flags: object.bit ? segment.start.flags & ~object.bit : segment.start.flags, bodies: segment.start.bodies.map((b, k) => k === slot ? { ...b, gone: true } : b) };
  const route = segment.route.filter(p => p.body === undefined && !p.bit && p.timer === undefined && p.hold === undefined);
  return !KNOCKOUT_SEARCHES.some(search => solve(bare, { start, goal, route, ...search }));
}

function essentialShare(level, segment) {
  const owned = (segment.owned ?? []).map(id => level.objects[id]).filter(o => KNOCKOUT_TYPES.has(o.type) && o.type !== 'plate');
  if (!owned.length) return null;
  return owned.filter(o => needed(level, segment, o)).length / owned.length;
}

function stretchRow(level, segment) {
  const states = replay(level, segment.inputs, segment.start);
  const trace = traceOf(level, segment);
  const steps = trace.filter(e => INTERACTIONS.test(e)).length;
  return { signature: trace.join('>') || 'none', steps, frames: states.length, backtrack: +backtrackRows(states).toFixed(1), puzzle: segment.puzzle, essential: knockouts ? essentialShare(level, segment) : null };
}

const rows = [], climbs = [], times = [];
const started = Date.now();
for (let i = 0; i < seedCount; i++) {
  let entry = null, history = [];
  const signatures = [];
  for (let index = 0; index < length; index++) {
    const t = Date.now();
    let level;
    try { level = generateBiome(`census-${i}`, index, entry, null, null, () => {}, history); } catch { rows.push({ failed: true, seed: i, index }); continue; }
    times.push(Date.now() - t);
    entry = level.exitCol;
    history = level.profiles ?? [];
    level.segments.forEach((segment, k) => {
      const row = { seed: i, index, stretch: k, focus: level.focus, ...stretchRow(level, segment) };
      rows.push(row);
      if (row.steps >= 2) signatures.push(row.signature);
    });
  }
  climbs.push(signatures);
}

const ok = rows.filter(r => !r.failed);
const logic = ok.filter(r => r.steps >= 2);
const median = values => values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : 0;
const counts = {};
for (const r of logic) counts[r.signature] = (counts[r.signature] ?? 0) + 1;
const ranked = Object.entries(counts).sort(([, a], [, b]) => b - a);
const entropy = -ranked.reduce((sum, [, n]) => sum + (n / logic.length) * Math.log2(n / logic.length), 0);
let repeats = 0, windowed = 0;
for (const list of climbs) list.forEach((signature, i) => {
  if (i === 0) return;
  windowed++;
  if (list.slice(Math.max(0, i - WINDOW), i).includes(signature)) repeats++;
});
const essential = logic.map(r => r.essential).filter(v => v !== null);
const percent = (a, b) => b ? +((100 * a) / b).toFixed(1) : 0;
const summary = {
  biomes: times.length, failures: rows.length - ok.length, stretches: ok.length,
  logicStretches: logic.length, logicShare: percent(logic.length, ok.length),
  distinctSignatures: ranked.length, signatureEntropyBits: +entropy.toFixed(2),
  topSignatureShare: percent(ranked[0]?.[1] ?? 0, logic.length), topThreeShare: percent(ranked.slice(0, 3).reduce((s, [, n]) => s + n, 0), logic.length),
  repeatWithinWindow: percent(repeats, windowed),
  medianSteps: median(logic.map(r => r.steps)), p90Steps: [...logic.map(r => r.steps)].sort((a, b) => a - b)[Math.floor(logic.length * 0.9)] ?? 0, maxSteps: Math.max(0, ...logic.map(r => r.steps)),
  medianFrames: median(logic.map(r => r.frames)), medianBacktrackRows: median(logic.map(r => r.backtrack)),
  essentialShare: essential.length ? +(essential.reduce((s, v) => s + v, 0) / essential.length).toFixed(2) : null,
  medianBiomeMs: median(times), p90BiomeMs: [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.9)], totalSeconds: Math.round((Date.now() - started) / 1000),
  topSignatures: ranked.slice(0, 12),
};
console.log(JSON.stringify(summary, null, 1));
if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
