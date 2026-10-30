import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, ONE_WAY, EMPTY, TILE, COLS, tileAt, overlaps } from '../src/level.js';
import { buildRules } from '../src/rules.js';
import { initialState } from '../src/physics.js';
import { homeOf, atWardrobe } from '../src/home.js';
import { browse, openWardrobe, loadOutfit, shuffle } from '../src/wardrobe.js';
import { createAvatar, wear, OUTFIT_ROWS } from '../src/avatar.js';

function ground(index, platforms = []) {
  const level = createLevel(buildRules([]), [], 72);
  level.index = index;
  fillTiles(level, 0, 71, COLS, 1, SOLID);
  fillTiles(level, 12, 71, 2, 1, ONE_WAY);
  for (const [col, row, w] of platforms) fillTiles(level, col, row, w, 1, SOLID);
  level.start = { x: 12 * TILE + 5, y: 71 * TILE - 26 };
  return level;
}

const clearOfTiles = (level, { x, y, w, h }) => {
  for (let row = Math.floor(y / TILE); row * TILE < y + h; row++) for (let col = Math.floor(x / TILE); col * TILE < x + w; col++) if (tileAt(level, col, row) !== EMPTY) return false;
  return true;
};

test('only the first biome has a home, with the wardrobe on clear floor beside the start', () => {
  assert.equal(homeOf(ground(1)), null);
  for (const platforms of [[], [[8, 69, 3]], [[8, 69, 3], [15, 69, 3]]]) {
    const level = ground(0, platforms), { wardrobe } = homeOf(level);
    assert.ok(clearOfTiles(level, wardrobe), JSON.stringify(platforms));
    assert.ok(!overlaps(level.start.x, level.start.y, 20, 26, wardrobe));
    assert.equal(wardrobe.y + wardrobe.h, 71 * TILE);
  }
});

test('the wardrobe answers only to a grounded player standing at it', () => {
  const level = ground(0), home = homeOf(level), { wardrobe } = home;
  const standing = { ...initialState(level), x: wardrobe.x + 10, y: 71 * TILE - 26, grounded: true };
  assert.ok(atWardrobe(home, level, standing));
  assert.ok(!atWardrobe(home, level, { ...standing, grounded: false }));
  assert.ok(!atWardrobe(home, level, { ...standing, x: wardrobe.x + 200 }));
});

test('browsing wraps rows and options and the outfit dresses the climber', () => {
  let dressing = openWardrobe(createAvatar(''));
  assert.deepEqual(dressing.outfit, { tint: null, pattern: null, top: null, glasses: null, face: null, neck: null, back: null });
  dressing = browse(dressing, -1, -1);
  assert.equal(dressing.row, OUTFIT_ROWS.length - 1);
  assert.equal(dressing.outfit.back, OUTFIT_ROWS.at(-1).options.at(-1));
  dressing = browse(browse(dressing, -1, 0), -1, 3);
  const look = wear(dressing.outfit);
  assert.equal(look.hat ?? look.accessory, dressing.outfit.top);
  assert.ok(look.hat === null || look.accessory === null);
  assert.deepEqual(createAvatar('any-seed', dressing.outfit).glasses, dressing.outfit.glasses);
  assert.equal(loadOutfit(), null);
});

test('every piece in the wardrobe can be worn and drawn, and a shuffle is always a valid outfit', async () => {
  const { drawPlayer } = await import('../src/player-art.js');
  const level = ground(0), state = { ...initialState(level), frame: 37 };
  const p = { accent: '#f80', player: '#fff', playerInk: '#123', hazard: '#f00', ink: '#000', text: '#fff' };
  const calls = [];
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : (calls.push(key), () => {}), set: (target, key, value) => { target[key] = value; return true; } });
  for (const { key, options } of OUTFIT_ROWS) for (const option of options) {
    calls.length = 0;
    drawPlayer(ctx, p, { outline: false }, level, state, 1, createAvatar('', { [key]: option }));
    assert.ok(calls.length > 10, `${key} ${option}`);
  }
  assert.ok(OUTFIT_ROWS.reduce((n, row) => n + row.options.length - 1, 0) >= 100, 'plenty to choose from');
  for (let i = 0; i < 50; i++) {
    const { outfit } = shuffle(openWardrobe(createAvatar('')));
    assert.ok(OUTFIT_ROWS.every(({ key, options }) => options.includes(outfit[key])));
  }
});

test('an outfit saved before the new rows still loads', () => {
  const saved = { tint: null, pattern: 'spots', top: 'crown', glasses: 'round' };
  globalThis.localStorage = { getItem: () => JSON.stringify(saved) };
  assert.deepEqual(loadOutfit(), { ...saved, face: null, neck: null, back: null });
  delete globalThis.localStorage;
});
