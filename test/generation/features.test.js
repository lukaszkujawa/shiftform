import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { tileAt, TILE, EMPTY } from '../../src/level.js';
import { assertChains } from './helpers.js';

test('timed gates guard a landing edge across a gap and open briefly', () => {
  let gates = 0;
  for (const seed of ['gates-a', 'gates-b', 'gates-c']) {
    [1, 3].forEach(index => {
      const biome = generateBiome(seed, index, null, null, 'timing');
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

test('keys and switches sit on a guarded side ledge across a gap', () => {
  let pickups = 0;
  for (const seed of ['lock-1', 'lock-3']) {
    const biome = generateBiome(seed, 1, null, [], 'locks');
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

test('climbs mix in ladders and trampolines between platforms', () => {
  let climbs = 0, springs = 0;
  for (const seed of ['conn-a', 'conn-b', 'conn-c', 'conn-d']) {
    const biome = generateBiome(seed, 1, null);
    assertChains(biome, seed);
    climbs += biome.objects.filter(o => o.type === 'climb').length;
    springs += biome.objects.filter(o => o.type === 'spring' && o.y > 4 * TILE).length;
  }
  assert.ok(climbs >= 2, `${climbs} ladders`);
  assert.ok(springs >= 1, `${springs} trampolines`);
});
