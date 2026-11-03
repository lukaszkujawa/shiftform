import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, TILE, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { growStructure } from '../src/art/structures.js';
import { THEMES } from '../src/art/themes.js';
import { KITS } from '../src/art/structure-kits.js';
import { MATERIALS } from '../src/art/structure-materials.js';
import { BAYS } from '../src/art/structure-bays.js';
import { ORNAMENTS } from '../src/art/structure-ornaments.js';

function tower(style = 'open', ledges = [[3, 60, 4], [12, 54, 3], [22, 48, 5], [6, 40, 4], [16, 30, 3], [26, 20, 3], [8, 12, 6]]) {
  const level = createLevel(buildRules([]), [], 72);
  Object.assign(level, { index: 3, palette: 120, style });
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  fillTiles(level, 0, 0, COLS, 1, SOLID);
  for (const [c, r, w] of ledges) fillTiles(level, c, r, w, 1, SOLID);
  return level;
}

test('a structure is the same every time for a level and leaves the tiles alone', () => {
  const level = tower(), before = level.tiles.slice();
  assert.deepEqual(growStructure(level), growStructure(level));
  assert.deepEqual(level.tiles, before);
});

test('every member stays inside the biome and runs from top to bottom', () => {
  const level = tower();
  const s = growStructure(level);
  for (const m of [...s.masts, ...s.props, ...s.hangers]) {
    assert.ok(m.x >= 0 && m.x <= COLS * TILE);
    assert.ok(m.top >= 0 && m.bottom <= level.height && m.top < m.bottom, JSON.stringify(m));
  }
});

test('a held ledge gets a load path and only a small share float free', () => {
  let held = 0, free = 0;
  for (let palette = 0; palette < 40; palette++) {
    const level = tower();
    level.palette = palette;
    const s = growStructure(level);
    held += s.held;
    free += s.free;
    assert.ok(s.props.length + s.beams.length + s.struts.length + s.trestles.length + s.hangers.length >= s.held * 0.8, `palette ${palette}`);
  }
  assert.ok(free > 0, 'some ledges float');
  assert.ok(free / (free + held) < 0.25, `${free} free of ${free + held}`);
});

test('tall levels raise tied masts with bays between them', () => {
  const s = growStructure(tower());
  assert.ok(s.masts.length >= 2);
  assert.ok(s.ties.length >= 1);
  assert.ok(s.bays.length + s.crosses.length >= s.ties.length);
});

test('movers run on a rail between their extremes', () => {
  const level = tower();
  addObject(level, { type: 'mover', x: 300, y: 600, w: 90, h: 30, dx: 120, dy: 0, period: 240, phase: 0 });
  const [rail] = growStructure(level).rails;
  assert.deepEqual(rail, { x0: 345, y0: 615, x1: 465, y1: 615 });
});

test('every theme has its own kit with real variety', () => {
  const seen = new Set();
  for (const theme of THEMES) {
    const kit = KITS[theme.id];
    assert.ok(kit, `${theme.id} has a kit`);
    assert.ok(kit.mast.length >= 2 && kit.prop.length >= 2, `${theme.id} structural variety`);
    assert.ok(kit.bays.length >= 3, `${theme.id} bays`);
    assert.ok(kit.ornaments.length >= 4 && kit.tops.length >= 2, `${theme.id} ornaments`);
    for (const id of kit.mast.concat(kit.prop, kit.beam, kit.hang)) assert.ok(MATERIALS[id], id);
    for (const id of kit.bays) assert.ok(BAYS[id], id);
    for (const id of kit.ornaments.concat(kit.tops)) assert.ok(ORNAMENTS[id], id);
    seen.add(JSON.stringify(kit));
  }
  assert.equal(seen.size, THEMES.length, 'no two themes share a kit');
});
