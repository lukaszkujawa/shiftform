import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXIT, appraise, compose, rewire, twist } from '../src/generation/riddle.js';
import { Rng } from '../src/world/rng.js';
import { gateOutput } from '../src/world/level.js';

const room = (cells, parts) => ({ cells, entry: 0, crates: [], pickups: [], plates: [], ...parts });
const walk = (riddle, kind, low, high, extra = {}) => ({ low, high, kind, geometry: {}, ...extra });
const typesOf = appraisal => appraisal.solution.map(a => a.type);

test('a beam only lets a carried crate through, and the crate then weighs the plate', () => {
  const riddle = room(3, {
    crates: [{ kind: 'wood', cell: 0 }],
    plates: [{ bit: 1, cell: 1 }],
    links: [walk(null, 'beam', 0, 1), walk(null, 'ladder', 1, 2), walk(null, 'hatch', 2, EXIT, { bit: 1 })],
  });
  const look = appraise(riddle);
  assert.deepEqual(typesOf(look), ['lift', 'cross', 'press', 'cross', 'cross']);
  assert.equal(look.signature, 'lift>beam>press>hatch');
  assert.equal(look.idle, 0);
  assert.equal(look.reuse, 1);
});

test('without its crate a chamber behind a beam cannot be solved', () => {
  assert.equal(appraise(room(2, { links: [walk(null, 'beam', 0, 1), walk(null, 'ladder', 1, EXIT)] })), null);
});

test('steel cannot be carried up a step but wood can', () => {
  const build = kind => room(2, { crates: [{ kind, cell: 0 }], plates: [{ bit: 1, cell: 1 }], links: [walk(null, 'step', 0, 1), walk(null, 'door', 1, EXIT, { bit: 1 })] });
  assert.ok(appraise(build('wood')));
  assert.equal(appraise(build('steel')), null);
});

test('a crate cannot ride a ladder but falls down the shaft', () => {
  const riddle = room(2, {
    crates: [{ kind: 'steel', cell: 1 }],
    plates: [{ bit: 1, cell: 0 }],
    links: [walk(null, 'ladder', 0, 1), walk(null, 'door', 0, EXIT, { bit: 1 })],
  });
  assert.deepEqual(typesOf(appraise(riddle)), ['cross', 'lift', 'chute', 'cross', 'lift', 'press', 'cross']);
});

test('a plug needs the crate left on the emitter, and it can be fetched from the far side', () => {
  const riddle = room(2, {
    crates: [{ kind: 'wood', cell: 0 }],
    plates: [{ bit: 1, cell: 1 }],
    links: [walk(null, 'plug', 0, 1), walk(null, 'door', 1, EXIT, { bit: 1 })],
  });
  assert.deepEqual(typesOf(appraise(riddle)), ['lift', 'plug', 'cross', 'lift', 'press', 'cross']);
});

test('a stone is spent: the pit stays crossable and the crate cannot be lifted again', () => {
  const riddle = room(2, {
    crates: [{ kind: 'wood', cell: 0 }],
    plates: [{ bit: 1, cell: 1 }],
    links: [walk(null, 'pit', 0, 1), walk(null, 'door', 1, EXIT, { bit: 1 })],
  });
  assert.equal(appraise(riddle), null);
});

test('a shutter must be passed before the plate shuts it', () => {
  const riddle = room(3, {
    pickups: [{ type: 'key', bit: 2, cell: 1 }],
    crates: [{ kind: 'wood', cell: 0 }],
    plates: [{ bit: 1, cell: 0 }],
    links: [walk(null, 'shutter', 0, 1, { bit: 1 }), walk(null, 'door', 0, 2, { bit: 1 }), walk(null, 'door', 2, EXIT, { bit: 2 })],
  });
  const look = appraise(riddle);
  assert.deepEqual(look.signature.split('>').slice(0, 2), ['shutter', 'key']);
});

test('a fuse dies when the hands do anything but run', () => {
  const riddle = room(2, {
    pickups: [{ type: 'timer', bit: 128, cell: 0 }],
    crates: [{ kind: 'wood', cell: 0 }],
    plates: [{ bit: 1, cell: 1 }],
    links: [walk(null, 'fuse', 0, 1), walk(null, 'door', 1, EXIT, { bit: 1 })],
  });
  assert.deepEqual(typesOf(appraise(riddle)).slice(0, 3), ['lift', 'take', 'cross']);
});

test('temptations count the moves on the way that doom the room', () => {
  const riddle = room(2, {
    crates: [{ kind: 'wood', cell: 0 }],
    links: [walk(null, 'pit', 0, 1), walk(null, 'ladder', 1, EXIT)],
    plates: [],
  });
  assert.ok(appraise(riddle).temptations === 0);
  const lured = room(3, {
    crates: [{ kind: 'wood', cell: 1 }],
    links: [walk(null, 'ladder', 0, 1), walk(null, 'beam', 1, 2), walk(null, 'ladder', 2, EXIT)],
  });
  assert.ok(appraise(lured).temptations >= 1);
});

const gate = (op, mask, not = 0) => ({ bit: mask, gate: { op, mask, not } });
const lever = (bit, cell) => ({ type: 'lever', bit, cell });

test('an and gate wants both of its inputs', () => {
  const riddle = room(1, { pickups: [lever(1, 0), lever(2, 0)], links: [walk(null, 'door', 0, EXIT, gate('and', 3))] });
  const look = appraise(riddle);
  assert.deepEqual(typesOf(look), ['pull', 'pull', 'cross']);
  assert.equal(look.signature, 'lever>lever>and');
});

test('an or gate wants either input, so the second lever is idle', () => {
  const riddle = room(1, { pickups: [lever(1, 0), lever(2, 0)], links: [walk(null, 'door', 0, EXIT, gate('or', 3))] });
  const look = appraise(riddle);
  assert.deepEqual(typesOf(look), ['pull', 'cross']);
  assert.equal(look.idle, 2);
});

test('gates compute and, or and xor, with an input negated', () => {
  const table = gate => [0, 1, 2, 3].map(bits => +gateOutput(gate, bits));
  assert.deepEqual(table({ op: 'and', mask: 3, not: 0 }), [0, 0, 0, 1]);
  assert.deepEqual(table({ op: 'or', mask: 3, not: 0 }), [0, 1, 1, 1]);
  assert.deepEqual(table({ op: 'xor', mask: 3, not: 0 }), [0, 1, 1, 0]);
  assert.deepEqual(table({ op: 'and', mask: 3, not: 1 }), [0, 0, 1, 0]);
  assert.deepEqual(table({ op: 'or', mask: 3, not: 2 }), [1, 1, 0, 1]);
});

test('an xor door can trap you on the far side: the only way on shuts the way back', () => {
  const riddle = room(2, {
    pickups: [lever(1, 0), lever(2, 1)],
    links: [walk(null, 'door', 0, 1, gate('xor', 3)), walk(null, 'door', 1, EXIT, gate('and', 3, 1))],
  });
  assert.equal(appraise(riddle), null);
});

test('a negated input opens only while its signal is off', () => {
  const missing = room(1, { pickups: [lever(1, 0)], links: [walk(null, 'door', 0, EXIT, gate('and', 3, 1))] });
  assert.equal(appraise(missing), null);
  const passable = room(1, { pickups: [lever(2, 0)], links: [walk(null, 'door', 0, EXIT, gate('and', 3, 1))] });
  assert.deepEqual(typesOf(appraise(passable)), ['pull', 'cross']);
});

test('a room finished without undoing anything is a chore, and one that makes you pull a lever back is not', () => {
  const chore = room(2, { pickups: [{ type: 'key', bit: 1, cell: 0 }], links: [walk(null, 'door', 0, 1, { bit: 1 }), walk(null, 'ladder', 1, EXIT)] });
  const look = appraise(chore);
  assert.equal(look.chore, true);
  assert.equal(look.undone, 0);
  const airlock = room(2, {
    pickups: [lever(1, 0), lever(2, 1)],
    links: [walk(null, 'door', 0, 1, gate('or', 3)), walk(null, 'door', 0, EXIT, gate('and', 3, 1))],
  });
  const solved = appraise(airlock);
  assert.deepEqual(typesOf(solved), ['pull', 'cross', 'pull', 'cross', 'pull', 'cross']);
  assert.equal(solved.undone, 1);
  assert.equal(solved.chore, false);
});

test('a conflict is a move that shuts a lock the solution still has to cross', () => {
  const none = room(2, {
    pickups: [lever(1, 0), lever(2, 1)],
    links: [walk(null, 'door', 0, 1, gate('or', 3)), walk(null, 'door', 0, EXIT, gate('and', 3, 1))],
  });
  assert.equal(appraise(none).conflicts, 0);
  const shuts = room(3, {
    pickups: [lever(1, 0), lever(2, 1), lever(4, 2)],
    links: [walk(null, 'door', 0, 1, gate('xor', 3)), walk(null, 'door', 1, 2, { bit: 2 }), walk(null, 'door', 0, EXIT, { bit: 4 })],
  });
  const look = appraise(shuts);
  assert.equal(look.signature, 'lever>xor>lever>door>lever>door>lever>xor>door');
  assert.equal(look.conflicts, 1);
  assert.equal(look.undone, 1);
});

test('rewiring puts gates on locks and adds a lever when a room has too few signals', () => {
  const plain = room(2, { pickups: [{ type: 'key', bit: 1, cell: 0 }], links: [walk(null, 'door', 0, 1, { bit: 1 }), walk(null, 'ladder', 1, EXIT)], signals: 1 });
  const wired = rewire(plain, new Rng(3), { ops: ['and'], locks: [1, 1], negate: 0 });
  const gated = wired.links.filter(l => l.gate);
  assert.equal(gated.length, 1);
  assert.equal(gated[0].gate.op, 'and');
  assert.equal(gated[0].bit, gated[0].gate.mask);
  assert.ok(wired.pickups.some(p => p.type === 'lever'));
  assert.equal(plain.links.filter(l => l.gate).length, 0);
});

test('composed riddles are solvable often enough, deterministic and twist without breaking the graph', () => {
  const graph = { cells: 4, entry: 0, tops: [2, 3], sides: [{ side: true, a: 0, b: 1, wide: false }, { side: true, a: 2, b: 3, wide: false }], lifts: [{ low: 0, high: 2 }, { low: 1, high: 3 }] };
  const style = { sources: { plate: 2, key: 1, switch: 1 }, gates: { open: 1, door: 2, beam: 2, plug: 2, ladder: 2, hatch: 2, spring: 1, drop: 1 } };
  const sample = seed => compose(graph, new Rng(seed), style);
  assert.deepEqual(JSON.stringify(sample(7)), JSON.stringify(sample(7)));
  const solved = Array.from({ length: 200 }, (_, i) => sample(i)).filter(r => r && appraise(r));
  assert.ok(solved.length >= 40, `${solved.length} of 200 solved`);
  assert.ok(new Set(solved.map(r => appraise(r).signature)).size >= 15);
  const twisted = solved.map(r => twist(r, new Rng(1))).filter(Boolean);
  assert.ok(twisted.every(r => r.links.every(l => l.kind)));
});
