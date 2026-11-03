import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileOf, novelty, styleFit, score } from '../src/generation/critics.js';
import { MOVE_IDS } from '../src/generation/moves.js';

const chain = kinds => [{ col: 0, row: 50, w: 3, dir: 1 }, ...kinds.map((move, i) => ({ col: i * 4, row: 48 - i * 2, w: 2, dir: i % 3 === 2 ? -1 : 1, move }))];

test('profileOf counts move shares, flips and mean rise', () => {
  const p = profileOf(chain(['stair', 'stair', 'leap', undefined]));
  assert.equal(p.moves.length, MOVE_IDS.length);
  assert.ok(Math.abs(p.moves[1] - 0.5) < 1e-9);
  assert.ok(p.rise > 0);
  assert.ok(p.flips > 0);
});

test('novelty is 1 without history and 0 against an identical stretch', () => {
  const p = profileOf(chain(['leap', 'leap']));
  assert.equal(novelty(p, []), 1);
  assert.equal(novelty(p, [p]), 0);
  assert.ok(novelty(p, [profileOf(chain(['stair', 'stair', 'stair']))]) > 0.5);
  const near = profileOf(chain(['leap', 'leap', 'leap', 'stair']));
  assert.ok(novelty(near, [p]) < 1, 'a partly similar stretch scores below a wholly new one');
});

test('styleFit is zero when shares match the weights', () => {
  const p = profileOf(chain(['stair', 'stair', 'stair', undefined]));
  assert.ok(styleFit(p, { hop: 1, stair: 3 }) < 1e-9);
  assert.ok(styleFit(p, { leap: 1 }) > 1);
});

test('score prefers novel stretches that fit the style', () => {
  const fresh = profileOf(chain(['leap', 'run'])), stale = profileOf(chain(['stair', 'stair', 'stair']));
  const history = [profileOf(chain(['stair', 'stair', 'stair']))];
  assert.ok(score(fresh, history, { leap: 1, run: 1 }) > score(stale, history, { leap: 1, run: 1 }));
});
