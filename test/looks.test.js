import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookOf, tint } from '../src/monsters.js';

test('each monster gets a stable look of its own', () => {
  const a = { kind: 'patroller', id: 3, x: 60, y: 900 }, b = { kind: 'patroller', id: 4, x: 400, y: 900 };
  assert.deepEqual(lookOf(a), lookOf(a));
  assert.ok(JSON.stringify(lookOf(a)) !== JSON.stringify(lookOf(b)));
  const look = lookOf(a);
  assert.ok(look.eyes >= 1 && look.eyes <= 3 && look.fangs >= 0 && look.fangs <= 2 && Math.abs(look.hue) <= 30);
});

test('tint shifts hue and lightness inside the hsl string', () => {
  assert.equal(tint('hsl(350 95% 60% / 1)', 20, -10), 'hsl(10 95% 50% / 1)');
  assert.equal(tint('hsl(10 50% 95% / 0.3)', -30, 20), 'hsl(340 50% 100% / 0.3)');
});
