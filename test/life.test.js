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
