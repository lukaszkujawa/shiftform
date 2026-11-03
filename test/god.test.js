import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../src/generator.js';
import { createRun, advance } from '../src/run.js';
import { isBane } from '../src/rules.js';
import { GIFTS, GOD_PAGES, godX, nearGod } from '../src/god.js';
import { SKILL_IDS } from '../src/skills.js';
import { WIDTH } from '../src/level.js';
import { playerSize } from '../src/physics.js';

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
  const floor = { ...run.s, x: godX(level) - 10, y: (level.rows - 1) * 30 - playerSize(level.rules).h, grounded: true };
  assert.equal(nearGod(level, floor), true);
  assert.equal(nearGod(level, { ...floor, y: floor.y - 90 }), false, 'standing on a ledge above him is not a visit');
});

test('the god merchant pages through every skill and levels it for free', () => {
  const level = generateBiome('god', 1, null);
  const run = createRun(5, 'god');
  advance(run, () => level);
  const skills = GOD_PAGES.flat().filter(gift => gift.skill).map(gift => gift.skill);
  assert.deepEqual(skills, SKILL_IDS, 'every skill is on offer');
  assert.ok(GOD_PAGES.every(page => page.at(-1).more && page.length <= 7), 'each page ends with More');
  const dash = GOD_PAGES.flat().find(gift => gift.skill === 'dash');
  dash.give(run);
  assert.deepEqual([run.skills, run.runes], [{ dash: 1 }, 0], 'learned, not paid for');
  assert.equal(run.level.rules.dash, true, 'and working in the biome you are in');
});
