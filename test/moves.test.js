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
  assert.ok(script.reduce((s, id) => s + MOVES[id].rows, 0) >= 18);
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
