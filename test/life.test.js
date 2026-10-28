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
    translate: noop('translate'), rotate: noop('rotate'), scale: noop('scale'), drawImage: noop('drawImage'),
  };
  return g;
}

const pathOps = new Set(['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect']);
const countPathOps = g => g.ops.filter(([name]) => pathOps.has(name)).length;
const colors = { primary: 'red', secondary: 'blue', ink: 'black' };

test('every theme has a family whose plants, creatures and drifters all draw', () => {
  for (const theme of THEMES) {
    const family = FAMILIES[theme.id];
    assert.ok(family, `${theme.id} has a family`);
    assert.ok(family.plants.length >= 2 && family.creatures.length >= 1 && family.drifters.length >= 1, `${theme.id} family is populated`);
    for (const grow of family.plants) {
      const plant = grow(new Rng(7));
      assert.ok(plant.kind && plant.parts.length > 0 && plant.flex >= 0, `${theme.id} plant ${plant.kind}`);
      for (const part of plant.parts) {
        const g = recorder();
        part.build(g);
        assert.ok(countPathOps(g) > 0, `${theme.id} ${plant.kind} part draws`);
        assert.ok(['fill', 'stroke'].includes(part.mode) && ['rockEdge', 'ink', 'accent'].includes(part.color));
      }
    }
    for (const grow of family.creatures) {
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

import { createLevel, HEIGHT, WIDTH } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { themeFor } from '../src/themes.js';
import { DEPTHS, growLife, drawLife } from '../src/life.js';

function biome(theme, palette = 120, index = 2) {
  const level = createLevel(buildRules([]), [], 72);
  level.theme = theme;
  level.palette = palette;
  level.index = index;
  return level;
}

test('life grows the same for the same biome and differs by palette', () => {
  const a = growLife(biome(0), themeFor(biome(0))), b = growLife(biome(0), themeFor(biome(0)));
  assert.deepEqual(a.specimens.map(s => [s.kind, s.x, s.y, s.depth]), b.specimens.map(s => [s.kind, s.x, s.y, s.depth]));
  const c = growLife(biome(0, 200), themeFor(biome(0)));
  assert.notDeepEqual(a.specimens.map(s => s.x), c.specimens.map(s => s.x));
});

test('every biome grows a full population from its family within the parallax band', () => {
  THEMES.forEach((theme, i) => {
    const level = biome(i);
    const life = growLife(level, theme);
    const plants = life.specimens.filter(s => s.plant), creatures = life.specimens.filter(s => !s.plant);
    assert.equal(plants.length, 80, `${theme.id} plants`);
    assert.equal(creatures.length, 30, `${theme.id} creatures`);
    assert.ok(life.drifters.length >= 1 && life.drifters.length <= 3, `${theme.id} drifters`);
    const kinds = new Set([...FAMILIES[theme.id].plants, ...FAMILIES[theme.id].creatures].map(grow => grow(new Rng(1)).kind));
    for (const s of life.specimens) {
      assert.ok(kinds.has(s.kind), `${theme.id} grows ${s.kind}`);
      assert.ok(DEPTHS.includes(s.depth));
      assert.ok(s.x >= 0 && s.x <= WIDTH);
      const reach = HEIGHT / (2 * s.depth);
      assert.ok(s.y >= HEIGHT / 2 - reach - 1 && s.y <= level.height - HEIGHT / 2 + reach + 1, `${theme.id} ${s.kind} y ${s.y} within band`);
    }
  });
});

test('drawLife draws the visible band of specimens and every drifter through a stub', () => {
  const level = biome(4);
  const theme = themeFor(level);
  const life = growLife(level, theme);
  const g = recorder();
  drawLife(g, life, theme.palette(level.palette), 0, 600, 12.5, () => recorder());
  const translates = g.ops.filter(([name]) => name === 'translate').length;
  assert.ok(translates > 10, `drew ${translates} things`);
  assert.ok(translates < life.specimens.length, 'culled the rest');
});
