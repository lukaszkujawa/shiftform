import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/rng.js';
import { buildRules } from '../src/rules.js';
import { MOVES, MOVE_IDS, realise, writeScript } from '../src/moves.js';
import { actionBudget } from '../src/focus.js';

const ctxOf = (seed = 1, extra = {}) => ({
  rng: new Rng(seed), rules: buildRules([]), maxUp: 2, maxGap: 3, slippery: false, level: { rows: 72 }, puzzle: null,
  connectors: null, connectorsLeft: Infinity, needsCeiling: false, placed: [], clearings: [], budget: 8, profile: { reach: 192 }, ...extra,
});
const from = { col: 10, row: 40, w: 3, dir: 1, kind: 'tiles', thick: 1 };
const free = () => false;

test('every move id has a cost and nominal rows', () => {
  for (const id of MOVE_IDS) assert.ok(MOVES[id].cost >= 0 && typeof MOVES[id].rows === 'number', id);
});

test('hop lays one ledge within jump range', () => {
  const [node] = MOVES.hop.lay(ctxOf(), from, 30, free);
  assert.ok(node.row >= from.row - 2 && node.row < from.row);
  assert.ok(node.gap >= 1 && node.gap <= 3);
});

test('stair lays three rising ledges in one direction', () => {
  const nodes = MOVES.stair.lay(ctxOf(), from, 30, free);
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes.map(n => from.row - n.row), [1, 2, 3]);
  assert.ok(nodes.every(n => n.dir === 1 && n.move === 'stair'));
});

test('leap crosses more than the hop limit', () => {
  const [node] = MOVES.leap.lay(ctxOf(), from, 30, free);
  assert.ok(node.gap === 3 && node.row === from.row && node.move === 'leap');
});

test('run lays a long thick ledge', () => {
  const [node] = MOVES.run.lay(ctxOf(), from, 30, free);
  assert.ok(node.w >= 6 && node.thick === 2 && node.move === 'run');
});

test('drop lays a lower ledge and refuses near the top or under flood', () => {
  const [node] = MOVES.drop.lay(ctxOf(), from, 30, free);
  assert.ok(node.row > from.row && node.move === 'drop');
  assert.equal(MOVES.drop.lay(ctxOf(), from, 4, free), null);
  assert.equal(MOVES.drop.allowed(ctxOf(1, { rules: buildRules(['flood']) })), false);
});

test('a turn climbs a connector back the other way, or a short switchback when none is allowed', () => {
  const [shaft] = MOVES.turn.lay(ctxOf(), from, 30, free);
  assert.ok(shaft.connector && shaft.dir === -1);
  const [ledge] = MOVES.turn.lay(ctxOf(1, { connectorsLeft: 0 }), from, 30, free);
  assert.ok(!ledge.connector && ledge.dir === -1 && ledge.move === 'turn');
});

test('forward placement refuses to flip back over the previous gap', () => {
  const edge = { ...from, col: 27, w: 3 };
  assert.equal(MOVES.run.lay(ctxOf(), edge, 30, free), null);
  assert.equal(MOVES.leap.lay(ctxOf(), edge, 30, free), null);
});

test('pocket and wide reserve puzzle geometry', () => {
  const ctx = ctxOf(1, { puzzle: { room: 9 } });
  const [pocket] = MOVES.pocket.lay(ctx, from, 30, free);
  assert.ok(pocket.pocket && pocket.w === 9);
  const [wide] = MOVES.wide.lay(ctxOf(), from, 30, free);
  assert.ok(wide.wide && wide.gap >= 8);
});

test('a blocked move returns null and realise does too', () => {
  assert.equal(MOVES.stair.lay(ctxOf(), from, 30, () => true), null);
  assert.equal(realise(ctxOf(), 'stair', from, 30, () => true), null);
});

test('moves never leave the grid', () => {
  const edge = { ...from, col: 28, w: 3 };
  for (const id of MOVE_IDS) {
    const nodes = MOVES[id].lay(ctxOf(7), edge, 30, free);
    if (nodes) for (const n of nodes) assert.ok(n.col >= 0 && n.col + n.w <= 32, `${id} stays inside`);
  }
});

test('writeScript spends the budget on costly moves and fills the height', () => {
  const ctx = ctxOf(3, { budget: 6 });
  const script = writeScript(ctx, { moves: { hop: 1, stair: 3, leap: 3 } }, 18);
  const spent = script.reduce((s, id) => s + MOVES[id].cost, 0);
  assert.ok(spent <= 6 + script.filter(id => id === 'hop').length, 'only hops exceed the budget');
  assert.ok(script.includes('stair') || script.includes('leap'));
  assert.ok(script.reduce((s, id) => s + MOVES[id].rows, 0) >= 18 * 0.75, 'leaves room for the rows connectors overshoot');
});

test('writeScript inserts puzzle pockets before wide gaps and after the first move', () => {
  const ctx = ctxOf(5, { budget: 8, puzzle: { pockets: 1, wideGap: true } });
  const script = writeScript(ctx, { moves: { hop: 1 } }, 18);
  assert.ok(script.indexOf('pocket') >= 1);
  assert.ok(script.indexOf('pocket') < script.indexOf('wide'));
});

test('writeScript skips moves the rules forbid', () => {
  const ctx = ctxOf(5, { budget: 20, rules: buildRules(['momentum']) });
  const script = writeScript(ctx, { moves: { leap: 5, hop: 1 } }, 18);
  assert.ok(!script.includes('leap'));
});

test('action budget grows with difficulty', () => {
  assert.ok(actionBudget(0) < actionBudget(1));
  assert.equal(actionBudget(0), 6);
  assert.equal(actionBudget(1), 14);
});

test('fork lays a safe step and a join reachable by one leap', () => {
  const [safe, join] = MOVES.fork.lay(ctxOf(), from, 30, free);
  assert.ok(safe.safe && join.move === 'fork');
  assert.equal(join.col - (from.col + from.w), 4);
  assert.equal(from.row - join.row, 2);
});

test('soar lays a wide gap with a refill hovering over it', () => {
  const [node] = MOVES.soar.lay(ctxOf(), from, 30, free);
  assert.ok(node.gap >= 6 && node.move === 'soar');
  assert.ok(node.refill.col > from.col + from.w && node.refill.col < node.col);
  assert.equal(node.refill.row, Math.min(from.row, node.row) - 1);
});

test('writeScript repeats motifs in phrases split by rests', () => {
  const script = writeScript(ctxOf(4, { budget: 14 }), { moves: { hop: 1, leap: 1, run: 1 } }, 18);
  const phrases = script.join(' ').split('run').map(p => p.trim().split(' '));
  assert.ok(phrases.length >= 2, 'at least one rest');
  assert.ok(phrases.every(p => p.length >= 2), 'no motif plays only once');
});

test('writeScript warms up on its cheapest phrase, then peaks and winds down', () => {
  const script = writeScript(ctxOf(9, { budget: 9 }), { moves: { hop: 1, leap: 3, run: 1 } }, 18);
  const [warmUp, ...rest] = script.join(' ').split('run').map(p => p.trim().split(' ').reduce((s, id) => s + MOVES[id].cost, 0));
  assert.deepEqual(rest, [...rest].sort((a, b) => b - a));
  assert.ok(rest.every(cost => cost >= warmUp));
});

test('writeScript reserves puzzle moves early enough to be reached', () => {
  for (let seed = 1; seed < 30; seed++) {
    const script = writeScript(ctxOf(seed, { puzzle: { pockets: 1 } }), { moves: { hop: 2, shaft: 2, run: 1 } }, 18);
    const before = script.slice(0, script.indexOf('pocket')).reduce((s, id) => s + Math.max(0.5, MOVES[id].rows), 0);
    assert.ok(before <= 18 * 0.75, `seed ${seed}: ${before} rows before the pocket`);
  }
});

test('writeScript lays a span for each feature that needs a gap', () => {
  const script = writeScript(ctxOf(2), { moves: { hop: 1 }, features: { laser: 2, phase: 1 } }, 18);
  assert.equal(script.filter(id => id === 'span').length, 2);
});

test('a span is wide enough for a gap feature and within a jump', () => {
  for (let seed = 1; seed < 20; seed++) {
    const [node] = MOVES.span.lay(ctxOf(seed), from, 30, free);
    assert.ok(node.gap >= 3 && node.gap <= 192 / 30, `gap ${node.gap}`);
    assert.ok(node.span);
  }
});
