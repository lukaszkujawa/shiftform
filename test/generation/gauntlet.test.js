import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { gauntletOf } from '../../src/generation/gauntlet.js';
import { replay } from '../../src/generation/solver.js';
import { step, playerSize } from '../../src/world/physics.js';
import { TILE, COLS, EMPTY, HAZARD_TYPES, objectRect, overlaps, tileAt } from '../../src/world/level.js';
import { SHOP_ROWS } from '../../src/world/tunnel.js';
import { summit } from '../../src/world/god.js';
import { assertChains } from './helpers.js';
import { stumbles } from '../../src/generation/stumble.js';

const hazardsOf = biome => biome.objects.filter(o => HAZARD_TYPES.has(o.type));
const killersOf = biome => hazardsOf(biome).filter(o => o.type !== 'spikes').length;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const SEEDS = ['hell-a', 'hell-b', 'hell-c'];

test('the first level only tastes the gauntlet, which starts in earnest on the second', () => {
  assert.equal(gauntletOf(0).picks, 2);
  assert.ok(gauntletOf(0).tolerance > gauntletOf(1).tolerance);
  for (let index = 1; index < 8; index++) assert.ok(gauntletOf(index).tolerance <= gauntletOf(index - 1).tolerance);
  assert.ok(gauntletOf(8).tolerance >= 2, 'never frame perfect');
  assert.ok(gauntletOf(8).killers > gauntletOf(4).killers, 'it keeps getting worse after level four');
});

test('every level is deadlier than the one before, whatever its banes', () => {
  const counts = [1, 2, 4, 6].map(index => mean(SEEDS.map(seed => {
    const biome = generateBiome(seed, index, null, []);
    assertChains(biome, `${seed}/${index}`);
    assert.ok(biome.segments.every(s => !replay(biome, s.inputs, s.start).at(-1).dead), `${seed}/${index} proof survives`);
    return killersOf(biome);
  })));
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2] && counts[2] <= counts[3], `killers by level ${counts}`);
  assert.ok(counts[2] >= 2 * counts[0], `level four carries ${counts[2]}, level one ${counts[0]}`);
});

test('no moving hazard the gauntlet adds ever reaches a spot the proof stands still on', () => {
  for (const seed of SEEDS) {
    const biome = generateBiome(seed, 4, null, []);
    const { w, h } = playerSize(biome.rules);
    const moving = hazardsOf(biome).filter(o => o.id >= biome.dressedFrom && o.period && o.dx !== undefined);
    for (const segment of biome.segments) {
      const states = replay(biome, segment.inputs, segment.start).filter(s => s.grounded && s.groundId < 0);
      for (const s of states) for (const o of moving) for (let clock = 0; clock < o.period; clock += 6) {
        assert.ok(!overlaps(s.x, s.y, w, h, objectRect(o, clock)), `${seed} ${o.type} ${o.id} sweeps a rest at ${s.x},${s.y}`);
      }
    }
  }
});

test('a jump pressed within the level tolerance still lands when the proof does', () => {
  for (const seed of SEEDS) {
    const biome = generateBiome(seed, 4, null, []);
    const { tolerance } = gauntletOf(4);
    let late = 0, survived = 0;
    for (const segment of biome.segments.filter(s => !s.bounds)) {
      const states = replay(biome, segment.inputs, segment.start);
      for (let i = 1; i + 1 < states.length; i++) {
        if (!states[i].grounded || states[i + 1].grounded || !segment.inputs[i]?.jump) continue;
        let s = states[i], ok = true;
        for (const input of [...Array(tolerance).fill(segment.inputs[i - 1]), ...segment.inputs.slice(i, i + 60)]) {
          s = step(biome, s, input);
          if (s.dead) { ok = false; break; }
        }
        late++;
        if (ok) survived++;
      }
    }
    assert.ok(late > 5, `${seed} has ${late} jumps`);
    assert.ok(survived / late >= 0.5, `${seed}: ${survived} of ${late} late jumps survive`);
  }
});

test('nothing is built in the shop corridor above the floor', () => {
  for (const seed of SEEDS) {
    for (const index of [2, 5]) {
      const biome = generateBiome(seed, index, null, []);
      const floor = biome.rows - 1, top = (floor - SHOP_ROWS + 1) * TILE;
      if (biome.style === 'open') for (let row = floor - SHOP_ROWS + 1; row < floor; row++) for (let col = 0; col < COLS; col++) assert.equal(tileAt(biome, col, row), EMPTY, `${seed}/${index} tile at ${col},${row}`);
      for (const o of hazardsOf(biome)) assert.ok(o.y + o.h + Math.abs(o.dy ?? 0) <= top, `${seed}/${index} ${o.type} ${o.id} reaches the corridor`);
    }
  }
});

test('the top ledge is clean, so a lift to the summit never kills', () => {
  for (const seed of SEEDS) {
    for (const index of [1, 4, 7]) {
      const biome = generateBiome(seed, index, null, []);
      let s = summit(biome, biome.segments.at(-1).start);
      for (let i = 0; i < 300 && !s.dead && !s.won; i++) s = step(biome, s, {});
      assert.equal(s.dead, false, `${seed}/${index} dies standing at the summit`);
    }
  }
});

test('a biome kills in several ways and they differ between biomes', () => {
  const casts = SEEDS.flatMap(seed => [4, 5, 6].map(index => {
    const kinds = new Set(hazardsOf(generateBiome(seed, index, null, [])).map(o => o.kind ?? o.type));
    kinds.delete('spikes');
    return [...kinds].sort().join();
  }));
  assert.ok(casts.every(cast => cast.split(',').length >= 3), casts.join(' | '));
  assert.ok(new Set(casts).size >= casts.length - 2, casts.join(' | '));
});

test('killers keep their distance: none stacked on another, and no two of a kind side by side', () => {
  const middle = o => { const r = objectRect(o, 0); return { x: r.x + r.w / 2, y: r.y + r.h / 2, kind: o.kind ?? o.type }; };
  for (const seed of SEEDS) {
    const biome = generateBiome(seed, 4, null, []);
    const killers = hazardsOf(biome).filter(o => o.id >= biome.dressedFrom && o.type !== 'spikes' && o.type !== 'shot' && !o.period).map(middle);
    for (let a = 0; a < killers.length; a++) for (let b = a + 1; b < killers.length; b++) {
      const d = Math.hypot(killers[a].x - killers[b].x, killers[a].y - killers[b].y);
      assert.ok(d >= 3 * TILE - 1, `${seed}: ${killers[a].kind} and ${killers[b].kind} ${Math.round(d)} px apart`);
    }
  }
});

test('a slightly mistimed player dies within the level budget on every proven stretch', () => {
  for (const seed of SEEDS) {
    for (const index of [1, 4]) {
      const biome = generateBiome(seed, index, null, []);
      if (biome.simplified) continue;
      const { deaths, worst } = gauntletOf(index);
      for (const [k, segment] of biome.segments.entries()) {
        const stumble = stumbles(biome, segment);
        assert.ok(stumble.deaths <= deaths * 1.3 + 1e-9, `${seed}/${index} stretch ${k}: ${stumble.deaths.toFixed(2)} expected deaths, budget ${deaths}`);
        assert.ok(stumble.worst <= worst + 1e-9, `${seed}/${index} stretch ${k}: a jump kills ${Math.round(stumble.worst * 100)}% of mistimed presses`);
      }
    }
  }
});
