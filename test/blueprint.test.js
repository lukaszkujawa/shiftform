import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, COLS, SOLID, EMPTY, ONE_WAY, tileAt, levelIndex } from '../src/level.js';
import { initialState, step } from '../src/physics.js';
import { BLOCKS, blockById, blankBlueprint, levelFrom, encodeBlueprint, decodeBlueprint, checkBlueprint } from '../src/blueprint.js';
import { createEditor, rectFrom } from '../src/editor.js';

const place = (editor, id, c, r, w = 1, h = 1) => editor.place(blockById(id), { c, r, w, h });
const run = (level, s, inputs) => inputs.reduce((state, input) => step(level, state, input), s);

test('a blank blueprint is a floor, a start and a goal', () => {
  const level = levelFrom(blankBlueprint());
  assert.equal(tileAt(level, 5, level.rows - 1), SOLID);
  assert.equal(tileAt(level, 5, 3), EMPTY);
  assert.equal(level.start.y + 26, (level.rows - 1) * TILE);
  assert.ok(level.exit.x > 0, 'the goal is the exit');
  assert.equal(level.custom, true);
});

test('every block builds into a level the physics can run', () => {
  const editor = createEditor(blankBlueprint(72));
  BLOCKS.forEach((block, i) => {
    const [w, h] = block.size ?? [1, 1];
    editor.place(block, { c: 2 + (i % 12) * 2, r: 5 + Math.floor(i / 12) * 10, w, h });
  });
  const level = editor.level();
  let s = initialState(level);
  s = run(level, s, Array.from({ length: 200 }, (_, i) => ({ right: i % 40 < 20, jump: i % 30 === 0 })));
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
  assert.ok(levelIndex(level).crates.length === 3);
});

test('walking onto the goal wins', () => {
  const editor = createEditor(blankBlueprint(18));
  const level = editor.level();
  const s = run(level, initialState(level), Array(400).fill({ right: true }));
  assert.equal(s.won, true);
});

test('a plate opens its door when wired, and placing a door after a plate wires them', () => {
  const editor = createEditor(blankBlueprint(18));
  place(editor, 'plate', 8, 16, 2, 1);
  place(editor, 'door', 14, 14, 1, 3);
  const level = editor.level();
  const door = level.objects.find(o => o.type === 'door'), plate = level.objects.find(o => o.type === 'plate');
  assert.ok(door.bit && door.bit === plate.bit, 'share a signal');
  assert.equal(level.wires.length, 1);
  assert.equal(door.plate, true);
  const blocked = run(level, { ...initialState(level), x: 11 * TILE }, Array(80).fill({ right: true }));
  assert.ok(blocked.x < 14 * TILE, 'the shut door stops you');
});

test('a door nobody wired stays shut and removing a source unwires it', () => {
  const editor = createEditor(blankBlueprint(18));
  place(editor, 'door', 14, 14, 1, 3);
  const level = editor.level();
  assert.ok(level.objects.find(o => o.type === 'door').bit);
  const key = place(editor, 'key', 8, 16);
  assert.deepEqual(key.to?.length, 1, 'a fresh source wires to the free door');
  assert.equal(editor.eraseAt(8, 16), true);
  assert.equal(editor.level().wires.length, 0);
});

test('two portals pair up and a third waits', () => {
  const editor = createEditor(blankBlueprint(18));
  place(editor, 'portal', 5, 16);
  place(editor, 'portal', 20, 16);
  place(editor, 'portal', 25, 16);
  const [a, b, c] = editor.level().objects.filter(o => o.type === 'portal');
  assert.equal(a.target, b.id);
  assert.equal(b.target, a.id);
  assert.equal(c.target, c.id);
});

test('a laser reaches from rock to rock', () => {
  const editor = createEditor(blankBlueprint(18));
  editor.place(blockById('rock'), { c: 0, r: 10, w: COLS, h: 1 });
  place(editor, 'lasertop', 12, 14);
  const laser = editor.level().objects.find(o => o.type === 'laser');
  assert.equal(laser.y, 11 * TILE);
  assert.equal(laser.y + laser.h, 17 * TILE);
  assert.equal(laser.steady, true);
});

test('start and goal are unique and cannot be erased', () => {
  const editor = createEditor(blankBlueprint(18));
  place(editor, 'start', 10, 16);
  assert.equal(editor.blueprint.items.filter(i => i.b === 'start').length, 1);
  assert.equal(editor.eraseAt(10, 16), false);
});

test('erase removes the top object first, then the tile', () => {
  const editor = createEditor(blankBlueprint(18));
  editor.place(blockById('oneway'), { c: 9, r: 9, w: 1, h: 1 });
  place(editor, 'coin', 9, 9);
  assert.equal(editor.eraseAt(9, 9), true);
  assert.equal(editor.blueprint.items.some(i => i.b === 'coin'), false);
  assert.equal(editor.blueprint.tiles[9 * COLS + 9], ONE_WAY);
  assert.equal(editor.eraseAt(9, 9), true);
  assert.equal(editor.blueprint.tiles[9 * COLS + 9], EMPTY);
  assert.equal(editor.eraseAt(9, 9), false);
});

test('undo and redo walk through edits', () => {
  const editor = createEditor(blankBlueprint(18));
  editor.remember();
  place(editor, 'coin', 9, 9);
  editor.undo();
  assert.equal(editor.blueprint.items.some(i => i.b === 'coin'), false);
  editor.redo();
  assert.equal(editor.blueprint.items.some(i => i.b === 'coin'), true);
});

test('a drag stretches blocks that stretch and a click uses their size', () => {
  const door = blockById('door'), rock = blockById('rock'), coin = blockById('coin'), ladder = blockById('ladder');
  assert.deepEqual(rectFrom(rock, { c: 3, r: 3 }, { c: 6, r: 5 }, 18), { c: 3, r: 3, w: 4, h: 3 });
  assert.deepEqual(rectFrom(door, { c: 8, r: 10 }, { c: 8, r: 10 }, 18), { c: 8, r: 8, w: 1, h: 3 });
  assert.deepEqual(rectFrom(coin, { c: 3, r: 3 }, { c: 9, r: 9 }, 18), { c: 9, r: 9, w: 1, h: 1 });
  assert.deepEqual(rectFrom(ladder, { c: 4, r: 12 }, { c: 4, r: 5 }, 18), { c: 4, r: 5, w: 1, h: 8 });
});

test('changing the tower height keeps what is built, measured from the floor', () => {
  const editor = createEditor(blankBlueprint(18));
  place(editor, 'coin', 9, 9);
  editor.set('rows', 36);
  assert.equal(editor.blueprint.rows, 36);
  assert.equal(editor.blueprint.items.find(i => i.b === 'coin').r, 27);
  assert.equal(tileAt(editor.level(), 5, 35), SOLID);
});

test('a level round-trips through a link and stays small', async () => {
  const editor = createEditor(blankBlueprint(72));
  editor.blueprint.title = 'Test tower';
  editor.blueprint.rules = ['moon'];
  for (let i = 0; i < 40; i++) editor.place(blockById(i % 2 ? 'rock' : 'oneway'), { c: i % 28, r: (i * 3) % 60, w: 4, h: 1 });
  place(editor, 'plate', 8, 60, 2, 1);
  place(editor, 'door', 14, 58, 1, 3);
  const code = await encodeBlueprint(editor.blueprint);
  assert.ok(/^[\w-]+$/.test(code), 'safe in a url');
  assert.ok(code.length < 1500, `${code.length} characters`);
  const back = await decodeBlueprint(code);
  assert.deepEqual(back, JSON.parse(JSON.stringify(editor.blueprint)));
});

test('a damaged or hostile link is refused', async () => {
  await assert.rejects(decodeBlueprint('not-a-level'));
  const good = { v: 1, t: 'x', h: 0, m: [], n: 18, g: `0*${COLS * 18};`, x: 0, i: [] };
  assert.ok(checkBlueprint(good));
  assert.throws(() => checkBlueprint({ ...good, v: 99 }));
  assert.throws(() => checkBlueprint({ ...good, n: 1000000 }));
  assert.throws(() => checkBlueprint({ ...good, m: ['constructor'] }));
  assert.throws(() => checkBlueprint({ ...good, g: '7' }));
  assert.throws(() => checkBlueprint({ ...good, i: [['__proto__', 1, 1, 1, 1, 1]] }));
  assert.throws(() => checkBlueprint({ ...good, i: [['coin', 999, 1, 1, 1, 1]] }));
  assert.equal(checkBlueprint({ ...good, t: 'y'.repeat(500) }).title.length, 40);
});
