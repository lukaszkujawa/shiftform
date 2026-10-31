import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../src/generator.js';
import { createRun, advance } from '../src/run.js';
import { isBane } from '../src/rules.js';
import { GIFTS, GOD_PAGES, godX, nearGod } from '../src/god.js';
import { BOONS } from '../src/rules.js';
import { WIDTH } from '../src/level.js';

test('the god merchant hands out everything and lifts you to the top', () => {
  const level = generateBiome('god', 1, null);
  const run = createRun(5, 'god');
  advance(run, () => level);
  const [runes, points, life, items, banes, top] = GIFTS;
  runes.give(run); points.give(run); life.give(run); items.give(run); banes.give(run);
  assert.deepEqual([run.runes, run.points, run.maxLives, run.lives], [10, 5000, 6, 6]);
  assert.ok(run.s.fuel > 0 && run.s.boots > 0 && run.s.shield && run.s.arrows > 0 && run.tricks.length >= 15);
  assert.ok(run.collected.length > 10 && run.collected.every(isBane));
  top.give(run);
  for (let i = 0; i < 5; i++) advance(run, () => level, {});
  assert.ok(run.s.grounded && run.s.y < 6 * 30, `standing near the top at y ${Math.round(run.s.y)}`);
  assert.ok(godX(level) > 0 && godX(level) < WIDTH);
  assert.equal(nearGod(level, { ...run.s, x: godX(level) - 10, grounded: true }), true);
});

test('the god merchant pages through every piece of gear and dresses you for free', () => {
  const level = generateBiome('god', 1, null);
  const run = createRun(5, 'god');
  advance(run, () => level);
  const gear = GOD_PAGES.flat().filter(gift => gift.rule).map(gift => gift.rule);
  assert.deepEqual([...gear].sort(), [...BOONS].sort(), 'every piece is on offer');
  assert.ok(GOD_PAGES.every(page => page.at(-1).more && page.length <= 7), 'each page ends with More');
  const grip = GOD_PAGES.flat().find(gift => gift.rule === 'grip');
  grip.give(run);
  assert.deepEqual([run.gear, run.runes], [['grip'], 0], 'worn, not paid for');
  assert.ok(run.level.mutators.includes('grip'), 'and working in the biome you are in');
});
