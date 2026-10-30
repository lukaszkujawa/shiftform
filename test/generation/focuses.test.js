import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { assertChains } from './helpers.js';
import { tileAt, SOLID, TILE, COLS } from '../../src/level.js';

const FOCUS_SIGNS = {
  bouncer: { seeds: ['bounce-1', 'bounce-2', 'bounce-3'], has: b => b.objects.filter(o => o.type === 'bumper').length >= 1 && b.objects.some(o => o.type === 'spring' && o.y > 120), label: 'a bumper gap and a trampoline' },
  wind: { seeds: ['gust-1', 'gust-2', 'gust-3'], has: b => b.objects.some(o => o.type === 'wind' && o.ay < 0) && b.objects.some(o => o.type === 'wind' && o.ax !== 0), label: 'an updraft and a gust' },
  water: { seeds: ['pool-1', 'pool-2', 'pool-3'], has: b => b.objects.filter(o => o.type === 'water').length >= 2, label: 'pools and a swim shaft' },
};

for (const [focus, { seeds, has, label }] of Object.entries(FOCUS_SIGNS)) {
  test(`${focus} biomes are proven and show ${label}`, () => {
    let shown = 0;
    for (const seed of seeds) {
      const biome = generateBiome(seed, 2, null, [], focus);
      assert.equal(biome.focus, focus);
      assertChains(biome, seed);
      if (has(biome)) shown++;
    }
    assert.ok(shown >= 2, `${shown} of ${seeds.length} ${focus} biomes show ${label}`);
  });
}

test('trampolines have clear air above them up to their apex', () => {
  for (let i = 0; i < 8; i++) {
    const biome = generateBiome(`bounce-${i}`, 2, null, [], 'bouncer');
    for (const o of biome.objects) {
      if (o.type !== 'spring' || o.dir !== -1 || o.y <= 4 * TILE) continue;
      const col = Math.floor((o.x + o.w / 2) / TILE), row = Math.round((o.y + o.h) / TILE);
      const apex = Math.ceil((o.vel * o.vel) / (2 * biome.rules.gravity) / TILE);
      for (let r = Math.max(1, row - apex - 1); r < row; r++) {
        for (let c = Math.max(1, col - 1); c <= Math.min(COLS - 2, col + 1); c++) {
          assert.notEqual(tileAt(biome, c, r), SOLID, `bounce-${i}: solid at ${c},${r} above the trampoline at ${col},${row}`);
        }
      }
    }
  }
});
