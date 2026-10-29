import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, TILE, HEIGHT } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { growDecor, paintDecor, drawDecor, ANIMATED_KINDS } from '../src/decor.js';
import { recorder } from './life.test.js';

function sample(palette = 200) {
  const level = createLevel(buildRules([]), [], 36);
  Object.assign(level, { index: 1, palette });
  fillTiles(level, 0, 0, 32, 1, SOLID);
  fillTiles(level, 0, 34, 32, 2, SOLID);
  for (const [c, r, w] of [[2, 30, 6], [11, 27, 4], [18, 24, 5], [25, 21, 5], [6, 21, 4], [13, 18, 6], [22, 14, 4], [2, 15, 5], [9, 10, 5], [20, 7, 6]]) fillTiles(level, c, r, w, 1, SOLID);
  return level;
}

const palette = { rock: 'hsl(0 0% 50% / 1)', rockEdge: 'hsl(0 0% 70% / 1)', rockDeep: 'hsl(0 0% 30% / 1)', ink: 'hsl(0 0% 10% / 1)', text: 'hsl(0 0% 97% / 1)', accent: 'hsl(120 80% 60% / 1)', waterLine: 'hsl(200 80% 80% / 1)' };

test('platform decor grows the same from the same seed and varies with the palette', () => {
  const a = growDecor(sample()), b = growDecor(sample()), c = growDecor(sample(37));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.statics, c.statics);
  assert.ok(a.statics.length >= 8, `${a.statics.length} static details`);
  assert.ok(new Set(a.statics.map(s => s.kind)).size >= 4, 'several kinds of detail');
  assert.ok(a.animated.length >= 2 && a.animated.length <= 8, `${a.animated.length} animated details`);
  assert.ok(a.animated.every(d => ANIMATED_KINDS.includes(d.kind)));
});

test('animated details sit on platform faces and bugs stay on their platform', () => {
  const level = sample();
  const { animated } = growDecor(level);
  for (const d of animated) {
    const col = Math.floor(d.x / TILE);
    const row = Math.floor((d.y + (d.kind === 'drip' ? 1 : d.kind === 'bug' ? -1 : 0)) / TILE);
    const solid = (c, r) => level.tiles[r * 32 + c] === SOLID;
    assert.ok(solid(col, row) || solid(col, row - 1) || solid(col, row + 1), `${d.kind} at ${d.x},${d.y} touches a block`);
    if (d.kind === 'bug') assert.ok(d.x0 < d.x1 && d.x0 >= 0 && d.x1 <= 32 * TILE);
  }
});

test('static details paint into the tile layer and animated ones only draw when on screen', () => {
  const level = sample();
  const decor = growDecor(level);
  const baked = recorder();
  baked.fillRect = (...a) => baked.ops.push(['fillRect', ...a]);
  paintDecor(baked, decor, palette, { outline: 0 });
  assert.ok(baked.ops.filter(([n]) => n === 'fill' || n === 'stroke').length >= decor.statics.length);
  const live = recorder();
  drawDecor(live, decor, palette, { time: 1234, playerX: 100, playerY: 900, top: 0, bottom: level.height });
  assert.ok(live.ops.length > 0, 'draws when visible');
  const hidden = recorder();
  drawDecor(hidden, decor, palette, { time: 1234, playerX: 100, playerY: 900, top: -HEIGHT * 4, bottom: -HEIGHT * 3 });
  assert.equal(hidden.ops.length, 0, 'draws nothing off screen');
});
