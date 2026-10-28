import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome, demandsMomentum } from '../src/generator.js';
import { replay, kicked } from '../src/solver.js';
import { playerSize } from '../src/physics.js';
import { standAt } from '../src/climb.js';
import { overlaps, serializeLevel, deserializeLevel, tileAt, COLS, TILE, EMPTY } from '../src/level.js';

const climb = (seed, count) => {
  const biomes = [];
  let entryCol = null;
  for (let index = 0; index < count; index++) {
    const biome = generateBiome(seed, index, entryCol);
    biomes.push(biome);
    entryCol = biome.exitCol;
  }
  return biomes;
};

function assertChains(level, label) {
  const { w, h } = playerSize(level.rules);
  const checkpoints = level.objects.filter(o => o.type === 'checkpoint');
  assert.equal(checkpoints.length, level.segments.length - 1, `${label} has a checkpoint per segment boundary`);
  level.segments.forEach((segment, k) => {
    const end = replay(level, segment.inputs, segment.start).at(-1);
    if (k === level.segments.length - 1) {
      assert.equal(end.won, true, `${label} last segment reaches the exit`);
      return;
    }
    const checkpoint = checkpoints[k];
    assert.ok(overlaps(end.x, end.y, w, h, checkpoint), `${label} segment ${k} reaches its checkpoint`);
    const next = level.segments[k + 1].start;
    const stood = standAt(level, end, checkpoint);
    assert.equal(next.x, stood.x, `${label} segment ${k + 1} starts on checkpoint ${k}`);
    assert.equal(next.y, stood.y);
  });
}

test('biomes are tall levels whose segments chain to the exit', () => {
  for (const seed of ['one', 'two', 'three']) {
    climb(seed, 2).forEach((biome, index) => {
      assert.equal(biome.rows, 72);
      assertChains(biome, `${seed}/${index}`);
    });
  }
});

test('each biome opens where the next one has its hatch', () => {
  const [a, b] = climb('gates', 2);
  assert.ok(a.exitCol >= 0 && a.exitCol < COLS - 1);
  assert.equal(b.entryCol, a.exitCol);
});

test('biome generation is deterministic and survives serialization', () => {
  const a = generateBiome('hello', 0, null);
  const b = generateBiome('hello', 0, null);
  assert.deepEqual(serializeLevel(a), serializeLevel(b));
  const copy = deserializeLevel(JSON.parse(JSON.stringify(serializeLevel(a))));
  assertChains(copy, 'copy');
});

const SIGNATURES = { crates: ['crate'], phase: ['phase'], movers: ['mover'], crumbles: ['crumble'], swing: ['hook'], timing: ['laser', 'gate'], locks: ['key', 'switch'], saws: ['saw'] };

test('biomes are built around a focus whose elements appear', () => {
  for (const seed of ['focus-a', 'focus-b']) {
    climb(seed, 3).forEach((biome, index) => {
      assert.ok(SIGNATURES[biome.focus], `${seed}/${index} has a focus`);
      assert.ok(biome.objects.some(o => SIGNATURES[biome.focus].includes(o.type)), `${seed}/${index} ${biome.focus} shows its elements`);
      assert.ok(biome.title.length > 0);
      assertChains(biome, `${seed}/${index}`);
    });
  }
});

test('items sit off the proven route and each has its own proof', () => {
  let seen = 0;
  for (const seed of ['items-a', 'items-b']) {
    climb(seed, 3).forEach((biome, index) => {
      const { w, h } = playerSize(biome.rules);
      const items = biome.objects.filter(o => o.type === 'item');
      const checkpoints = biome.objects.filter(o => o.type === 'checkpoint');
      assert.equal(biome.itemProofs.length, items.length, `${seed}/${index} proves every item`);
      for (const proof of biome.itemProofs) {
        const item = biome.objects[proof.item];
        const end = replay(biome, proof.inputs, proof.start).at(-1);
        assert.ok(end.taken & (1 << item.slot), `${seed}/${index} proof collects the ${item.kind}`);
        const goal = checkpoints[proof.segment];
        assert.ok(goal ? overlaps(end.x, end.y, w, h, goal) : end.won, `${seed}/${index} proof still reaches the goal`);
      }
      assert.ok(biome.segments.every(s => s.start.taken === (1 << items.length) - 1), `${seed}/${index} chain is proven without items`);
      seen += items.length;
    });
  }
  assert.ok(seen >= 4);
});

test('timed gates guard a landing edge across a gap and open briefly', () => {
  let gates = 0;
  for (const seed of ['gates-a', 'gates-b', 'gates-c']) {
    climb(seed, 4).forEach(biome => {
      for (const gate of biome.objects.filter(o => o.type === 'gate')) {
        gates++;
        assert.ok(gate.on / gate.period >= 0.65, 'open for at most about a third of the cycle');
        const col = Math.floor((gate.x + gate.w / 2) / TILE);
        const row = Math.floor((gate.y + gate.h) / TILE);
        const before = [col - 1, col - 2].map(c => tileAt(biome, c, row));
        const after = [col, col + 1].map(c => tileAt(biome, c, row));
        assert.ok(before.every(t => t === EMPTY) || after.every(t => t === EMPTY), 'no ground to wait on in front of the gate');
      }
    });
  }
  assert.ok(gates > 0);
});

test('flywheel biomes contain sprint gaps that a standing jump cannot cross', () => {
  let sprints = 0;
  for (const seed of ['fly-0', 'fly-8', 'fly-15']) {
    const biome = generateBiome(seed, 2, null, ['flywheel']);
    if (!biome.rules.flywheel) continue;
    assertChains(biome, seed);
    assert.ok(biome.segments.some(s => s.sprint), `${seed} lays a sprint gap`);
    biome.segments.forEach((segment, k) => {
      if (!segment.sprint) return;
      sprints += segment.sprint.length;
      assert.ok(demandsMomentum(biome, segment), `${seed} segment ${k} needs momentum`);
    });
  }
  assert.ok(sprints >= 2, 'sprint gaps were laid');
});

test('keys and switches sit on a guarded side ledge across a gap', () => {
  let pickups = 0;
  for (const seed of ['lock-1', 'lock-3']) {
    const biome = generateBiome(seed, 0, null);
    for (const pickup of biome.objects.filter(o => o.type === 'key' || o.type === 'switch')) {
      pickups++;
      const col = Math.floor((pickup.x + 8) / TILE) - 1, row = Math.ceil((pickup.y + pickup.h) / TILE);
      const sideEmpty = cols => cols.every(c => tileAt(biome, c, row) === EMPTY);
      assert.ok(sideEmpty([col - 1, col - 2]) || sideEmpty([col + 2, col + 3]), `${seed} ${pickup.type} ledge stands apart`);
      const guarded = biome.objects.some(o => ['laser', 'saw', 'crumble'].includes(o.type) && Math.abs(o.x - pickup.x) < 8 * TILE && Math.abs(o.y - pickup.y) < 6 * TILE);
      assert.ok(guarded, `${seed} ${pickup.type} is guarded`);
    }
  }
  assert.ok(pickups >= 3);
});

test('every segment is proven without wall kicks', () => {
  for (const [seed, forced] of [['kickless-a', ['momentum']], ['kickless-b', ['ice']], ['kickless-c', undefined]]) {
    const biome = generateBiome(seed, 2, null, forced);
    assertChains(biome, seed);
    for (const segment of biome.segments) {
      const states = replay(biome, segment.inputs, segment.start);
      assert.ok(states.every((s, i) => i === 0 || !kicked(states[i - 1], s)), `${seed} proof never kicks`);
    }
  }
});

test('climbs mix in ladders and trampolines between platforms', () => {
  let climbs = 0, springs = 0;
  for (const seed of ['conn-a', 'conn-b']) {
    const biome = generateBiome(seed, 1, null);
    assertChains(biome, seed);
    climbs += biome.objects.filter(o => o.type === 'climb').length;
    springs += biome.objects.filter(o => o.type === 'spring' && o.y > 4 * TILE).length;
  }
  assert.ok(climbs >= 2, `${climbs} ladders`);
  assert.ok(springs >= 1, `${springs} trampolines`);
});
