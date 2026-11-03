import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { tileAt, TILE, EMPTY } from '../../src/level.js';
import { step } from '../../src/physics.js';
import { assertChains } from './helpers.js';

test('timed gates guard a landing edge across a gap and open briefly', () => {
  let gates = 0;
  for (const seed of ['gates-a', 'gates-c', 'gates-d']) {
    [1, 3].forEach(index => {
      const biome = generateBiome(seed, index, null, [], 'timing');
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

test('now and then a stretch is flooded: tight water passages through rock, with water monsters, proven swimmable', () => {
  const level = generateBiome('wd', 3, null);
  const sunken = level.segments.find(segment => segment.sunken);
  assert.ok(sunken, 'this seed floods a stretch');
  const water = sunken.added.filter(o => o.type === 'water');
  assert.ok(water.length >= 2 && water.some(o => o.surface), 'the water has a top somewhere');
  assert.ok(water.every(o => Math.min(o.w, o.h) <= 2 * TILE), 'every passage is tight');
  assert.ok(sunken.added.some(o => o.kind === 'eel' || o.kind === 'jelly'));
  let s = sunken.start;
  for (const input of sunken.inputs) { s = step(level, s, input); assert.equal(s.dead, false); }
  const { roof, band } = sunken.sunken;
  const strayed = level.objects.filter(o => o.type === 'spikes' && !sunken.added.includes(o) && o.y + o.h >= (roof - 1) * TILE && o.y <= (band + 1) * TILE);
  assert.deepEqual(strayed, [], 'the dressing leaves the rock and its passages alone');
});

test('flooded stretches stay occasional and never start the climb', () => {
  const flooded = ['fa', 'fb', 'fc', 'fd'].map(seed => generateBiome(seed, 0, null));
  assert.ok(flooded.every(level => !level.segments.some(segment => segment.sunken)), 'not in the first biome');
});

test('flooded stretches grow with the level: more bends, more dangers, a longer swim', () => {
  const measure = index => {
    const stretches = [];
    for (let i = 0; i < 24 && stretches.length < 3; i++) {
      const sunken = generateBiome(`grow-${i}`, index, null).segments.find(segment => segment.sunken);
      if (sunken) stretches.push(sunken);
    }
    assert.equal(stretches.length, 3, `level ${index} floods often enough to compare`);
    const total = pick => stretches.reduce((sum, stretch) => sum + pick(stretch), 0);
    return {
      bends: total(s => s.added.filter(o => o.type === 'water').length),
      dangers: total(s => s.added.filter(o => o.kind === 'eel' || o.kind === 'jelly' || o.type === 'spikes').length),
      frames: total(s => s.inputs.length),
    };
  };
  const early = measure(1), late = measure(6);
  assert.ok(late.bends > early.bends, JSON.stringify({ early, late }));
  assert.ok(late.dangers > early.dangers, JSON.stringify({ early, late }));
  assert.ok(late.frames > early.frames * 1.2, JSON.stringify({ early, late }));
});
