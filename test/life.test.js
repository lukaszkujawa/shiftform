import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/rng.js';
import { THEMES } from '../src/themes.js';
import { FAMILIES } from '../src/life-shapes.js';

export function recorder() {
  const ops = [];
  const noop = name => (...args) => ops.push([name, ...args]);
  const g = {
    ops, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt',
    beginPath: noop('beginPath'), closePath: noop('closePath'), moveTo: noop('moveTo'), lineTo: noop('lineTo'),
    quadraticCurveTo: noop('quadraticCurveTo'), bezierCurveTo: noop('bezierCurveTo'), arc: noop('arc'), ellipse: noop('ellipse'),
    rect: noop('rect'), fill: noop('fill'), stroke: noop('stroke'), save: noop('save'), restore: noop('restore'),
    translate: noop('translate'), rotate: noop('rotate'), scale: noop('scale'), drawImage: noop('drawImage'), clip: noop('clip'),
  };
  return g;
}

const pathOps = new Set(['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect']);
const countPathOps = g => g.ops.filter(([name]) => pathOps.has(name)).length;
const colors = { primary: 'red', secondary: 'blue', ink: 'black' };
const SLOTS = ['rockEdge', 'rockDeep', 'ink', 'accent', 'accentDeep', 'accentLight', 'edgeDeep', 'edgeLight', 'inkSoft'];

test('every theme has a family whose plants, creatures and drifters all draw', () => {
  for (const theme of THEMES) {
    const family = FAMILIES[theme.id];
    assert.ok(family, `${theme.id} has a family`);
    assert.ok(family.plants.length >= 3 && family.flyers.length >= 1 && family.drifters.length >= 1, `${theme.id} family is populated`);
    assert.equal(new Set(family.plants).size, family.plants.length, `${theme.id} plants are all different`);
    for (const grow of family.plants) {
      const plant = grow(new Rng(7));
      assert.ok(plant.kind && plant.parts.length > 0 && plant.flex >= 0, `${theme.id} plant ${plant.kind}`);
      for (const part of plant.parts) {
        const g = recorder();
        part.build(g);
        assert.ok(countPathOps(g) > 0, `${theme.id} ${plant.kind} part draws`);
        assert.ok(['fill', 'stroke'].includes(part.mode) && SLOTS.includes(part.color) && (!part.outline || SLOTS.includes(part.outline)) && (!part.glow || SLOTS.includes(part.glow)), `${theme.id} ${plant.kind} uses palette slots`);
      }
    }
    for (const grow of [...family.flyers, ...family.walkers]) {
      const creature = grow(new Rng(7));
      for (const t of [0, 0.37, 2.1]) {
        const g = recorder();
        creature.draw(g, t, colors);
        assert.ok(countPathOps(g) > 0, `${theme.id} ${creature.kind} draws at ${t}`);
      }
    }
    for (const grow of family.drifters) {
      const drifter = grow(new Rng(7));
      const g = recorder();
      drifter.draw(g, 1.5, colors);
      assert.ok(countPathOps(g) > 0 && drifter.speed > 0 && drifter.members.length >= 1, `${theme.id} ${drifter.kind} drifts`);
    }
  }
});

import { createLevel, fillTiles, SOLID, WIDTH } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { themeFor } from '../src/themes.js';
import { DEPTHS, growLife, drawLife, surfaces, flightPath, walkPath } from '../src/life.js';

function biome(theme, palette = 120, index = 2) {
  const level = createLevel(buildRules([]), [], 72);
  level.theme = theme;
  level.palette = palette;
  level.index = index;
  fillTiles(level, 0, 70, 32, 2, SOLID);
  for (let row = 8; row < 70; row += 3) fillTiles(level, (row * 7) % 26, row, 6, 1, SOLID);
  return level;
}

const signature = life => life.plants.map(p => [p.kind, p.x, p.y]);

test('life grows the same for the same biome and differs by palette', () => {
  const a = growLife(biome(0), themeFor(biome(0))), b = growLife(biome(0), themeFor(biome(0)));
  assert.deepEqual(signature(a), signature(b));
  assert.notDeepEqual(signature(a), signature(growLife(biome(0, 200), themeFor(biome(0)))));
});

test('plants root on platform tops and neighbours vary', () => {
  let grown = 0;
  THEMES.forEach((theme, i) => {
    const level = biome(i);
    const tops = surfaces(level);
    const life = growLife(level, theme);
    grown += life.plants.length;
    assert.ok(life.plants.length >= 5, `${theme.id} grows ${life.plants.length} plants`);
    for (const p of life.plants) assert.ok(tops.some(r => p.x >= r.x0 && p.x <= r.x1 && p.y - r.y === 4), `${theme.id} ${p.kind} is rooted`);
    assert.ok(new Set(life.plants.map(p => p.kind)).size >= 3, `${theme.id} mixes plant kinds`);
    assert.ok(life.plants.every((p, k) => k === 0 || p.kind !== life.plants[k - 1].kind), `${theme.id} never repeats a plant next to itself`);
    for (const w of life.walkers) assert.ok(tops.some(r => w.y === r.y && w.x0 >= r.x0 && w.x1 <= r.x1), `${theme.id} ${w.kind} walks on a platform`);
  });
  assert.ok(grown / THEMES.length >= 8, `${grown / THEMES.length} plants per theme`);
});

test('flyers cross the screen and walkers patrol their platform', () => {
  const life = growLife(biome(5), THEMES[5]);
  assert.ok(life.flyers.length >= 4 && life.flyers.every(f => DEPTHS.includes(f.depth)));
  for (const f of life.flyers) {
    const xs = Array.from({ length: 200 }, (_, k) => flightPath(f, k).x);
    assert.ok(Math.max(...xs) > WIDTH - 50 && Math.min(...xs) < 50, `${f.kind} ${f.pattern} crosses`);
  }
  const frost = growLife(biome(4), THEMES[4]);
  assert.ok(frost.walkers.length >= 1, 'frost has walkers');
  for (const w of frost.walkers) {
    const steps = Array.from({ length: 400 }, (_, k) => walkPath(w, k / 4));
    assert.ok(steps.every(s => s.x >= w.x0 - 0.01 && s.x <= w.x1 + 0.01 && s.lift >= 0));
    assert.ok(new Set(steps.map(s => s.dir)).size === 2, 'turns around');
  }
});

test('drawLife draws what is on screen through a stub', () => {
  const level = biome(4);
  const theme = themeFor(level);
  const life = growLife(level, theme);
  const g = recorder();
  drawLife(g, life, theme.palette(level.palette), 0, 600, 12.5, () => recorder());
  const translates = g.ops.filter(([name]) => name === 'translate').length;
  assert.ok(translates > 2, `drew ${translates} things`);
  assert.ok(translates < life.plants.length + life.walkers.length + life.flyers.length, 'culled the rest');
});
