import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, waterRects, SOLID, COLS, TILE, WATER_TILE } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { soundEvents } from '../src/sounds.js';
import { withSkills } from '../src/skills.js';
import { blankBlueprint, levelFrom, blockById, checkBlueprint, encodeBlueprint, decodeBlueprint } from '../src/blueprint.js';
import { createEditor } from '../src/editor.js';

const FLOOR = 40;

function pool(rules = buildRules(['double'])) {
  const level = createLevel(rules, [], FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  level.start = { x: 400, y: FLOOR * TILE - 26 };
  level.exit = { x: 0, y: -300, w: 0, h: 0 };
  addObject(level, { type: 'water', x: 300, y: (FLOOR - 6) * TILE, w: 300, h: 6 * TILE, surface: true });
  return level;
}

const settled = level => { let s = initialState(level); for (let i = 0; i < 8; i++) s = step(level, s, {}); return s; };

function swimUp(level, s, frames, record = () => {}) {
  for (let i = 0; i < frames; i++) { s = step(level, s, { jump: i % 6 < 3 }); record(s); }
  return s;
}

test('swimming strokes never spin the climber, and arriving in water ends a spin', () => {
  const level = pool();
  const spins = [];
  swimUp(level, settled(level), 60, s => spins.push(s.flipFrame));
  assert.ok(spins.every(f => f < 0), 'no stroke starts a flip');
  const flipping = { ...settled(level), y: (FLOOR - 4) * TILE, grounded: false, flipFrame: 5, frame: 6 };
  assert.ok(step(level, flipping, {}).flipFrame < 0);
});

test('you cannot leap out of water like a dolphin: strokes only lift you a little past the surface', () => {
  const level = pool(), surface = (FLOOR - 6) * TILE;
  let highest = Infinity;
  swimUp(level, settled(level), 240, s => { highest = Math.min(highest, s.y + 26); });
  assert.ok(highest <= surface, 'you do reach the top');
  assert.ok(surface - highest < 20, `feet rise only ${surface - highest} px above the surface`);
});

test('leaving the water spends your jumps, even with air jumps', () => {
  const level = pool(), rules = withSkills(level.rules, { jump: 5 }), skilled = { ...level, rules };
  const surface = (FLOOR - 6) * TILE;
  let s = settled(skilled), out = null;
  for (let i = 0; i < 240 && !out; i++) { s = step(skilled, s, { jump: i % 6 < 3 }); if (s.y + 26 < surface - 2) out = s; }
  assert.ok(out, 'surfaced');
  assert.equal(out.jumpsLeft, 0);
  const pressed = step(skilled, { ...out, jumpHeld: false }, { jump: true });
  assert.ok(pressed.vy > out.vy, 'pressing jump does nothing up there');
});

test('a low stone ledge at the surface can still be climbed out onto', () => {
  const level = pool();
  fillTiles(level, 20, FLOOR - 6, 6, 6, SOLID);
  let s = { ...settled(level), x: 20 * TILE - 40 };
  for (let i = 0; i < 300 && !(s.grounded && s.x > 20 * TILE); i++) s = step(level, s, { jump: i % 6 < 3, right: true });
  assert.ok(s.grounded && s.x > 20 * TILE && s.y + 26 <= (FLOOR - 6) * TILE + 1, `${s.x},${s.y}`);
});

test('a spring or a jetpack still carries you out of water at full power', () => {
  const level = pool();
  const fast = { ...settled(level), y: (FLOOR - 6) * TILE - 24, vy: -15, grounded: false };
  assert.ok(step(level, fast, {}).vy < -13, 'a launch is not clipped');
});

test('water cells merge into blocks, with a surface only where air is above', () => {
  const cells = new Set(['2,5', '3,5', '2,6', '3,6', '4,6', '2,3', '2,4']);
  const rects = waterRects((c, r) => cells.has(`${c},${r}`), (c, r) => r < 3, 10, 10);
  assert.deepEqual(rects, [
    { x: 2 * TILE, y: 3 * TILE, w: TILE, h: 4 * TILE, surface: true },
    { x: 3 * TILE, y: 5 * TILE, w: TILE, h: 2 * TILE, surface: false },
    { x: 4 * TILE, y: 6 * TILE, w: TILE, h: TILE, surface: false },
  ]);
});

test('the builder paints water square by square and works out the top', async () => {
  const bp = blankBlueprint(), editor = createEditor(bp), floor = bp.rows - 1;
  editor.place(blockById('water'), { c: 10, r: floor - 2, w: 4, h: 2 });
  editor.place(blockById('rock'), { c: 11, r: floor - 3, w: 2, h: 1 });
  editor.place(blockById('water'), { c: 11, r: floor - 2, w: 2, h: 1 });
  assert.equal(bp.tiles[(floor - 1) * COLS + 10], WATER_TILE);
  const level = levelFrom(bp);
  const water = level.objects.filter(o => o.type === 'water');
  assert.deepEqual(water.map(o => [o.x / TILE, o.y / TILE, o.w / TILE, o.h / TILE, o.surface]), [[10, floor - 2, 1, 2, true], [11, floor - 2, 2, 2, false], [13, floor - 2, 1, 2, true]]);
  assert.equal(level.tiles[(floor - 1) * COLS + 10], 0, 'water is not solid');
  const back = await decodeBlueprint(await encodeBlueprint(bp));
  assert.deepEqual(levelFrom(back).objects.filter(o => o.type === 'water').map(o => o.w), [TILE, 2 * TILE, TILE]);
  assert.equal(editor.eraseAt(10, floor - 1), true, 'erasing takes out one square');
  assert.equal(bp.tiles[(floor - 1) * COLS + 10], 0);
});

test('an old share link with a water block still loads as painted water', () => {
  const bp = blankBlueprint();
  const raw = { v: bp.v, t: '', h: bp.theme, m: [], n: bp.rows, g: bp.tiles.join(''), x: 9, i: [['start', 3, bp.rows - 2, 1, 1, 0], ['goal', 12, bp.rows - 2, 1, 1, 1], ['water', 8, 5, 4, 3, 2]] };
  const loaded = checkBlueprint(raw);
  assert.ok(!loaded.items.some(i => i.b === 'water'));
  assert.equal(loaded.tiles[6 * COLS + 9], WATER_TILE);
  assert.equal(levelFrom(loaded).objects.filter(o => o.type === 'water').length, 1);
});

test('entering water is still a splash', () => {
  const level = pool();
  const above = { ...settled(level), y: (FLOOR - 6) * TILE - 28, vy: 4, grounded: false };
  let s = above, splashed = false;
  for (let i = 0; i < 12; i++) { const n = step(level, s, {}); splashed ||= soundEvents(level, s, n).some(e => e.type === 'splash'); s = n; }
  assert.ok(splashed);
});
