import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { solve, replay } from '../../src/solver.js';
import { levelIndex, TILE, COLS, SOLID, ONE_WAY, tileAt, gatePins } from '../../src/level.js';
import { assertChains, walkOf } from './helpers.js';
import { worthSolving } from '../../src/chamber.js';

const THEMES = { circuits: /\b(and|or|xor)\b/, crates: /press/, locks: /\b(and|or|xor)\b/, lights: /beam|plug/, stones: /stone/, wormholes: /portal/, stopwatch: /fuse/ };
const MECHANISMS = new Set(['crate', 'key', 'switch', 'lever', 'timer']);
const SEARCHES = [{ grain: 4, maxNodes: 6000 }, { grain: 2, maxNodes: 10000 }];

const chambers = biome => biome.segments.filter(s => s.bounds);

const forcedRooms = (focus, seeds, index = 4) => seeds.flatMap(seed => {
  const biome = generateBiome(seed, index, null, [], focus);
  assert.equal(biome.focus, focus);
  assertChains(biome, seed);
  const rooms = chambers(biome);
  assert.ok(rooms.length <= 1, `${seed} has ${rooms.length} rooms`);
  return rooms;
});

for (const [focus, star] of Object.entries(THEMES)) {
  test(`${focus} rooms are proven, show their theme and clear the bar`, () => {
    const rooms = forcedRooms(focus, [1, 2, 3, 4, 5, 6].map(i => `${focus}-${i}`));
    assert.ok(rooms.length >= 1, `no ${focus} room in six biomes`);
    for (const room of rooms) {
      assert.match(room.puzzle, star);
      assert.equal(room.logic.chore, false, room.puzzle);
      assert.ok(room.logic.undone >= 1 && room.logic.undone + room.logic.conflicts >= 2, `${room.puzzle} ${JSON.stringify(room.logic)}`);
    }
  });
}

test('a chamber cannot be passed without its mechanisms', () => {
  for (const seed of ['cut-1', 'cut-2', 'cut-3', 'cut-4']) {
    const biome = generateBiome(seed, 4, null, [], 'lab');
    const goals = biome.objects.filter(o => o.type === 'checkpoint');
    biome.segments.forEach((segment, k) => {
      if (!segment.bounds) return;
      const bare = { ...biome, objects: biome.objects.map(o => o.type !== 'crate' && MECHANISMS.has(o.type) && segment.owned.includes(o.id) ? { ...o, type: 'removed' } : o) };
      const start = { ...segment.start, bodies: segment.start.bodies.map((b, i) => segment.owned.includes(levelIndex(biome).crates[i].id) ? { ...b, gone: true } : b) };
      const route = segment.route.filter(p => p.body === undefined && p.hold === undefined && !p.bit && p.timer === undefined);
      assert.ok(!SEARCHES.some(search => solve(bare, { start, goal: goals[k] ?? null, route, ...search })), `${seed} stretch ${k} ${segment.puzzle}`);
    });
  }
});

test('a chamber is sealed: its floor and roof span the tower except for the hatches', () => {
  let rooms = 0;
  for (const seed of ['seal-1', 'seal-2', 'seal-3', 'seal-4']) {
    const biome = generateBiome(seed, 4, null, [], 'lab');
    for (const segment of chambers(biome)) {
      rooms++;
      const { roof, floor } = segment.bounds;
      for (const row of [roof, floor]) {
        const open = Array.from({ length: COLS }, (_, c) => tileAt(biome, c, row)).filter(t => t !== SOLID && t !== ONE_WAY).length;
        assert.ok(open <= 3, `${open} open tiles in row ${row}`);
      }
      assert.ok(replay(biome, segment.inputs, segment.start).every(s => !s.dead));
      assert.ok((floor - roof) * TILE <= 18 * TILE, 'a chamber fits one screen');
    }
  }
  assert.ok(rooms >= 1);
});

test('a climb does not repeat a chamber within two biomes', () => {
  let history = [], entry = null;
  const seen = [];
  for (let index = 1; index <= 4; index++) {
    const biome = generateBiome('novel', index + 2, entry, [], index % 2 ? 'circuits' : 'crates', () => {}, history);
    history = biome.profiles;
    entry = biome.exitCol;
    seen.push(...chambers(biome).map(s => s.puzzle));
  }
  assert.equal(new Set(seen).size, seen.length, seen.join(' | '));
});

test('chambers make you walk back and forth', () => {
  let rooms = 0, trivial = 0;
  for (const focus of ['crates', 'circuits', 'lab']) {
    for (const seed of [1, 2, 3, 4].map(i => `walk-${focus}-${i}`)) {
      const biome = generateBiome(seed, 5, null, [], focus);
      for (const segment of chambers(biome)) {
        rooms++;
        if (walkOf(biome, segment).trivial) trivial++;
      }
    }
  }
  assert.ok(rooms >= 4, `${rooms} rooms`);
  assert.ok(trivial * 5 <= rooms, `${trivial} of ${rooms} are a straight walk`);
});

test('wired rooms carry a gate with both inputs and an output wired', () => {
  let gates = 0;
  for (const seed of ['live-1', 'live-2', 'live-3', 'live-4']) {
    const biome = generateBiome(seed, 5, null, [], 'circuits');
    for (const lock of biome.objects.filter(o => o.gate)) {
      gates++;
      const feeds = biome.wires.filter(w => w.bit && lock.gate.mask & w.bit && gatePins(lock.gate).some(pin => pin.at[0] === w.points.at(-1)[0] && pin.at[1] === w.points.at(-1)[1]));
      assert.equal(feeds.length, 2, `${seed} lock ${lock.id} has both inputs wired`);
      assert.ok(biome.wires.some(w => w.gate === lock.gate), `${seed} lock ${lock.id} has an output wire`);
    }
  }
  assert.ok(gates >= 1);
});

test('early biomes ask for one undo and later ones for a conflict as well', () => {
  const room = { chore: false, idle: 0, crossings: 6, signature: 'lever>or', undone: 1, conflicts: 0 };
  assert.equal(worthSolving(room, 1, null), true);
  assert.equal(worthSolving(room, 4, null), false);
  assert.equal(worthSolving({ ...room, conflicts: 1 }, 4, null), true);
  assert.equal(worthSolving({ ...room, chore: true }, 1, null), false);
  assert.equal(worthSolving({ ...room, idle: 1 }, 1, null), false);
  assert.equal(worthSolving({ ...room, crossings: 20 }, 1, null), false);
  assert.equal(worthSolving(room, 1, ['beam']), false);
});

test('puzzle rooms are switched off: a climb left to itself never builds one', () => {
  for (const seed of ['no-rooms-a', 'no-rooms-b']) {
    let entry = null;
    for (const index of [1, 3]) {
      const biome = generateBiome(seed, index, entry);
      entry = biome.exitCol;
      assert.deepEqual(biome.rooms, [], `${seed}/${index} ${biome.focus}`);
      assert.ok(biome.segments.every(segment => !segment.bounds), `${seed}/${index} ${biome.focus}`);
    }
  }
});
