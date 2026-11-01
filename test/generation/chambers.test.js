import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { solve, replay } from '../../src/solver.js';
import { levelIndex, TILE, COLS, SOLID, ONE_WAY, tileAt } from '../../src/level.js';
import { assertChains, walkOf } from './helpers.js';

const THEMES = { crates: 'press', locks: /key|switch/, lights: /beam|plug/, stones: 'stone', wormholes: 'portal', stopwatch: 'fuse' };
const MECHANISMS = new Set(['crate', 'key', 'switch', 'timer']);
const SEARCHES = [{ grain: 4, maxNodes: 6000 }, { grain: 2, maxNodes: 10000 }];

const chambers = biome => biome.segments.filter(s => s.bounds);

for (const [focus, star] of Object.entries(THEMES)) {
  test(`${focus} chambers are proven and show their theme`, () => {
    const signatures = [];
    for (const seed of [`${focus}-1`, `${focus}-2`]) {
      const biome = generateBiome(seed, 4, null, [], focus);
      assert.equal(biome.focus, focus);
      assertChains(biome, seed);
      signatures.push(...chambers(biome).map(s => s.puzzle));
    }
    assert.ok(signatures.length >= 4, `${signatures.length} chambers`);
    const starred = signatures.filter(s => s.match(star)).length;
    assert.ok(starred * 2 >= signatures.length, `${starred} of ${signatures.length} star ${star}: ${signatures.join(' | ')}`);
    assert.ok(new Set(signatures).size >= signatures.length - 2, signatures.join(' | '));
  });
}

test('a chamber cannot be passed without its mechanisms', () => {
  for (const seed of ['cut-1', 'cut-2']) {
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
  const biome = generateBiome('seal-1', 4, null, [], 'lab');
  for (const segment of chambers(biome)) {
    const { roof, floor } = segment.bounds;
    for (const row of [roof, floor]) {
      const open = Array.from({ length: COLS }, (_, c) => tileAt(biome, c, row)).filter(t => t !== SOLID && t !== ONE_WAY).length;
      assert.ok(open <= 3, `${open} open tiles in row ${row}`);
    }
    assert.ok(replay(biome, segment.inputs, segment.start).every(s => !s.dead));
    assert.ok((floor - roof) * TILE <= 18 * TILE, 'a chamber fits one screen');
  }
});

test('a climb does not repeat a chamber within two biomes', () => {
  let history = [], entry = null;
  const seen = [];
  for (let index = 1; index <= 3; index++) {
    const biome = generateBiome('novel', index + 2, entry, [], index % 2 ? 'lights' : 'crates', () => {}, history);
    history = biome.profiles;
    entry = biome.exitCol;
    seen.push(...chambers(biome).map(s => s.puzzle));
  }
  assert.equal(new Set(seen).size, seen.length, seen.join(' | '));
});

test('chambers make you walk back and forth, and some make you jump', () => {
  let rooms = 0, trivial = 0, jumps = 0;
  for (const focus of ['crates', 'lights', 'lab']) {
    for (const seed of [`walk-${focus}-1`, `walk-${focus}-2`]) {
      const biome = generateBiome(seed, 5, null, [], focus);
      for (const segment of chambers(biome)) {
        rooms++;
        if (walkOf(biome, segment).trivial) trivial++;
        const { roof, floor } = segment.bounds;
        if (biome.objects.some(o => o.type === 'spikes' && o.h === 8 && o.w < 60 && o.y > roof * TILE && o.y < floor * TILE)) jumps++;
      }
    }
  }
  assert.ok(rooms >= 8, `${rooms} rooms`);
  assert.ok(trivial * 5 <= rooms, `${trivial} of ${rooms} are a straight walk`);
  assert.ok(jumps >= 1, `${jumps} rooms with spikes to jump`);
});
