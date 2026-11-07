import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, tileAt, SOLID, ONE_WAY, EMPTY, TILE, COLS } from '../../src/world/level.js';
import { buildRules } from '../../src/world/rules.js';
import { playerSize } from '../../src/world/physics.js';
import { blankBlueprint, levelFrom, blockById } from '../../src/builder/blueprint.js';
import { chunkFrom, stampChunk } from '../../src/generation/chunk.js';
import { CHUNKS } from '../../src/generation/chunks.js';
import { IDEAS } from '../../src/generation/ideas.js';
import { DEFAULT_DESIGN } from '../../src/generation/design.js';

const ROWS = 18;
function drawn() {
  const bp = blankBlueprint(ROWS);
  bp.items = [];
  let next = 0;
  const put = (b, c, r, w = 1, h = 1) => bp.items.push({ b, c, r, w, h, u: next++ });
  const rock = (c, r, w) => { for (let col = c; col < c + w; col++) bp.tiles[r * COLS + col] = SOLID; };
  put('start', 10, 16);
  rock(14, 13, 3);
  put('step', 15, 12);
  rock(20, 10, 4);
  put('spikeu', 22, 9);
  put('goal', 20, 9);
  put('coin', 5, 17);
  return bp;
}

const bare = (cave = false) => {
  const rules = buildRules([]), size = playerSize(rules), level = createLevel(rules, [], 36);
  Object.assign(level, { segments: [], wires: [], rooms: [] });
  if (cave) level.tiles.fill(SOLID);
  const entry = { col: 4, row: 30, w: 3, kind: 'tiles' };
  fillTiles(level, entry.col, entry.row, entry.w, 1, SOLID);
  fillTiles(level, entry.col, entry.row - 3, entry.w, 3, EMPTY);
  return { ctx: { level, rules, size, design: DEFAULT_DESIGN, cave, clearance: 4, nextBit: 1 }, entry };
};

test('a drawn blueprint becomes a chunk from its Start up to its highest mark, keeping footsteps in order and dropping what lies below', () => {
  const chunk = chunkFrom(drawn(), 'sample');
  assert.equal(chunk.rows, 8);
  assert.deepEqual(chunk.start, { c: 10, r: 7 });
  assert.deepEqual(chunk.goal, { c: 20, r: 0 });
  assert.deepEqual(chunk.steps, [{ c: 15, r: 3 }]);
  assert.equal(chunk.tiles.length, 8);
  assert.equal(chunk.tiles[1][21], String(SOLID));
  assert.deepEqual(chunk.items.map(item => [item.b, item.r]), [['spikeu', 0]]);
  assert.equal(chunk.dropped, 1);
});

test('a chunk refuses a missing Goal, a Goal below the Start, a floating Goal and a drawing taller than a stretch', () => {
  const without = (...ids) => ({ ...drawn(), items: drawn().items.filter(item => !ids.includes(item.b)) });
  assert.throws(() => chunkFrom(without('goal'), 'x'), /Goal/);
  const low = drawn();
  low.items.find(item => item.b === 'goal').r = 16;
  assert.throws(() => chunkFrom(low, 'x'), /above/);
  const floating = drawn();
  floating.items.find(item => item.b === 'goal').c = 2;
  assert.throws(() => chunkFrom(floating, 'x'), /ground/);
  const tall = { ...blankBlueprint(36), items: drawn().items.map(item => ({ ...item, r: item.r + 18 })) };
  for (const c of [20, 21]) tall.tiles[11 * COLS + c] = SOLID;
  tall.items.find(item => item.b === 'goal').r = 10;
  assert.throws(() => chunkFrom(tall, 'x'), /at most 18 rows/);
  assert.equal(chunkFrom(drawn(), 'x').rows, 8);
});

test('stamping lays the chunk above the entry, walks in over one-way tiles and routes through firm footsteps', () => {
  const chunk = chunkFrom(drawn(), 'sample'), { ctx, entry } = bare();
  const raised = stampChunk(chunk, ctx, entry, entry.row - 18);
  const roof = entry.row - chunk.rows;
  assert.equal(tileAt(ctx.level, 14, 4 + roof), SOLID);
  assert.equal(tileAt(ctx.level, 21, 1 + roof), SOLID);
  assert.equal(tileAt(ctx.level, 14, 4 + roof - 1), EMPTY);
  for (let c = entry.col + entry.w; c <= 10; c++) assert.equal(tileAt(ctx.level, c, entry.row), ONE_WAY);
  assert.equal(ctx.level.objects.filter(o => o.type === 'spikes').length, 1);
  assert.deepEqual(raised.top, { col: 20, row: 1 + roof, w: 2, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: -1 });
  assert.deepEqual(raised.route.map(point => [point.x / TILE, point.firm]), [[10.5, true], [15.5, true], [21, true]]);
  assert.equal(raised.extent.roof, roof);
});

test('stamping refuses a chunk that cannot fit under the roof or that walls in the entry', () => {
  const chunk = chunkFrom(drawn(), 'sample'), { ctx, entry } = bare();
  assert.equal(stampChunk(chunk, ctx, entry, entry.row - 5), null);
  const walled = drawn();
  walled.tiles[15 * COLS + 7] = SOLID;
  assert.equal(stampChunk(chunkFrom(walled, 'x'), ctx, entry, entry.row - 18), null);
  assert.equal(ctx.level.objects.length, 0);
});

test('a cave is opened for the chunk and its headroom', () => {
  const chunk = chunkFrom(drawn(), 'sample'), { ctx, entry } = bare(true);
  stampChunk(chunk, ctx, entry, entry.row - 18);
  const roof = entry.row - chunk.rows;
  assert.equal(tileAt(ctx.level, 2, roof - 1), EMPTY);
  assert.equal(tileAt(ctx.level, 2, 7 + roof), EMPTY);
  assert.equal(tileAt(ctx.level, 2, entry.row), SOLID);
});

test('footsteps are markers only: they build no object and the library chunks are set pieces', () => {
  assert.equal(levelFrom(drawn()).objects.some(o => o.type === undefined), false);
  assert.ok(blockById('step').marker);
  assert.equal(levelFrom(drawn()).objects.filter(o => o.type === 'spikes').length, 1);
  for (const chunk of CHUNKS) assert.ok(IDEAS.find(idea => idea.id === chunk.id)?.once, `${chunk.id} is a set piece tried once`);
});
