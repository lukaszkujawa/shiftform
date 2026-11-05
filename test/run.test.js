import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedBiomes } from './fixed-biomes.js';
import { generateBiome } from '../src/generation/generator.js';
import { addObject, createLevel, fillTiles, SOLID, TILE, COLS } from '../src/world/level.js';
import { buildRules } from '../src/world/rules.js';
import { PLACEABLE } from '../src/world/tricks.js';
import { stepCombo } from '../src/world/combo.js';
import { impX } from '../src/world/imp.js';
import { createRun, advance, wantedChain, takesInput, stallOf, shopOffer, outpaced, paceOf, restful } from '../src/world/run.js';
import { codeOf, inputOf, encodeGhost, decodeGhost } from '../src/game/ghost.js';
import { dailyOn, today } from '../src/game/daily.js';
import { shareText, climbLine } from '../src/game/share.js';

test('inputs and acts survive the trip through a ghost link', async () => {
  const codes = Array.from({ length: 5000 }, (_, i) => (i % 97 < 60 ? 2 : i % 7 === 0 ? 4 | 2 : 0) | (i === 4321 ? 128 : 0));
  const acts = [{ at: 0, type: 'pick', value: 2 }, { at: 1200, type: 'place', kind: 1, x: 345, y: 1890 }, { at: 1200, type: 'erase', id: 37 }, { at: 1300, type: 'flag' }, { at: 1400, type: 'swap', from: 4, to: 11 }, { at: 1500, type: 'equip', value: 2, giving: 2 }, { at: 1600, type: 'reset' }, { at: 5000, type: 'pick', value: 0 }];
  const text = await encodeGhost({ codes, acts });
  assert.match(text, /^[A-Za-z0-9_-]+$/, 'url-safe');
  assert.ok(text.length < codes.length / 4, `${text.length} characters for ${codes.length} frames`);
  assert.deepEqual(await decodeGhost(text), { codes, acts });
  assert.deepEqual(await decodeGhost(await encodeGhost({ codes: [1, 1, 3] })), { codes: [1, 1, 3], acts: [] });
  assert.deepEqual(inputOf(codeOf({ left: true, jump: true, restart: true })), { left: true, right: false, jump: true, dash: false, interact: false, up: false, down: false, restart: true });
  await assert.rejects(decodeGhost('not-a-ghost'));
});

test('a recorded climb replays as a ghost that ends exactly where the player did', async () => {
  const level = generateBiome('ghost-race', 0, null);
  const { x, y } = level.start;
  for (const dx of [-90, 70]) addObject(level, { type: 'spikes', x: x + dx, y: y + 12, w: 40, h: 14, dir: -1 });
  const biomes = fixedBiomes([[0, level]]);
  const inputs = [...level.solution.slice(0, 120), { restart: true }, ...Array(200).fill({ right: true }), ...Array(200).fill({ left: true }), ...level.solution.slice(0, 600)];
  const player = createRun(3), recording = [];
  for (let t = 0; t < 3000; t++) {
    if (takesInput(player) && recording.length < inputs.length) {
      const input = inputs[recording.length];
      recording.push(codeOf(input));
      advance(player, biomes, inputOf(codeOf(input)));
    } else if (!takesInput(player)) {
      advance(player, biomes);
    }
  }
  const { codes } = await decodeGhost(await encodeGhost({ codes: recording }));
  const ghost = createRun(3);
  let at = 0;
  for (let t = 0; t < 3000; t++) {
    if (!takesInput(ghost)) advance(ghost, biomes);
    else if (at < codes.length) advance(ghost, biomes, inputOf(codes[at++]));
  }
  const pick = run => ({ phase: run.phase, index: run.index, lives: run.lives, deaths: run.deaths, peak: run.peak, x: run.s.x, y: run.s.y, frame: run.s.frame, taken: run.s.taken, placed: run.s.placed, tombs: run.s.tombs });
  assert.deepEqual(pick(ghost), pick(player));
  assert.ok(player.peak > 0, 'the climb went somewhere');
  assert.ok(player.deaths >= 2, `died ${player.deaths} times on the way`);
  assert.equal(player.s.tombs.length, player.deaths, 'every death on the floor left a tombstone that the ghost drops too');
});

test('every day has its own numbered daily tower', () => {
  assert.deepEqual(dailyOn('2026-10-29'), { key: '2026-10-29', number: 1, seed: 'daily-2026-10-29' });
  assert.equal(dailyOn('2026-11-29').number, 32);
  assert.equal(dailyOn('nonsense'), null);
  assert.equal(today(new Date(Date.UTC(2026, 10, 2, 23, 30))).key, '2026-11-02');
});

test('the share card reads at a glance', () => {
  const path = [{ theme: 'country', comet: false }, { theme: 'candy', comet: true }, { theme: 'factory', comet: false }];
  assert.equal(climbLine(path), '🌻🍭☄️🏭💀');
  const text = shareText({ daily: dailyOn('2026-10-31'), seed: 'daily-2026-10-31', metres: 1284, best: 1402, deaths: 3, points: 41, path }, 'https://example.com/#daily=2026-10-31');
  assert.equal(text, 'Shiftform Daily #3 — 1,284 m\n🌻🍭☄️🏭💀\n3 deaths · 41 gold · 1 comet skip · best 1,402 m\nhttps://example.com/#daily=2026-10-31');
  assert.match(shareText({ daily: null, seed: 'amber-1', metres: 10, best: 10, deaths: 1, path: path.slice(0, 1) }, 'u'), /^Shiftform · seed "amber-1" — 10 m\n🌻💀\n1 death\nu$/);
});

test('the merchant sells to whoever stands at the stall, walking on needs no exit, and tricks are one-shot acts', async () => {
  const { createLevel, fillTiles, SOLID, TILE: T, COLS } = await import('../src/world/level.js');
  const { buildRules } = await import('../src/world/rules.js');
  const { TRICK_COST } = await import('../src/world/tricks.js');
  const tower = (palette) => {
    const level = createLevel(buildRules([]), [], 36);
    Object.assign(level, { index: 1, palette, entryCol: 4, exitCol: 4, segments: [] });
    fillTiles(level, 0, 35, COLS, 1, SOLID);
    level.start = { x: 150, y: 35 * T - 26 };
    level.exit = { x: 120, y: -30, w: 60, h: 30 };
    addObject(level, { type: 'spikes', x: 400, y: 35 * T - 14, w: 24, h: 14, dir: -1 });
    return level;
  };
  const a = tower(10), b = tower(20), biomes = fixedBiomes([[0, a], [1, b]]);
  const run = createRun(5);
  advance(run, biomes);
  run.s = { ...run.s, y: -40, vy: -9 };
  advance(run, biomes, {});
  assert.equal(run.index, 1);
  run.points = 5;
  assert.equal(run.phase, 'play', 'no shop at the gate');
  for (let i = 0; i < 600 && stallOf(run) !== 'merchant'; i++) advance(run, biomes, { left: true });
  assert.ok(run.hall, 'walked into the underpass');
  assert.equal(stallOf(run), 'merchant');
  const offer = shopOffer(run);
  assert.equal(offer.length, 3);
  assert.equal(advance(run, biomes, { pick: 1 }), null, 'cannot buy what you cannot afford');
  assert.equal(run.points, 5);
  for (let i = 0; i < 60 && stallOf(run); i++) advance(run, biomes, { left: true });
  assert.equal(stallOf(run), null, 'walked on past the merchant without stopping');
  run.points = 2 * TRICK_COST + 1;
  assert.equal(advance(run, biomes, { pick: 1 }), null, 'nothing sells away from the stall');
  for (let i = 0; i < 200 && stallOf(run) !== 'merchant'; i++) advance(run, biomes, { right: true });
  assert.deepEqual(shopOffer(run), offer, 'the same cards when you come back');
  run.offer = ['plank', 'erase', 'extraHeart'];
  assert.equal(advance(run, biomes, { pick: 1 }).kind, 'plank');
  assert.equal(advance(run, biomes, { pick: 1 }), null, 'each card sells once');
  assert.equal(advance(run, biomes, { pick: 3 }).kind, 'extraHeart');
  assert.deepEqual([run.points, run.maxLives, run.lives, run.tricks], [1, 6, 6, ['plank']]);
  assert.equal(advance(run, biomes, { pick: 2 }), null, 'out of points now');
  for (let i = 0; i < 20; i++) advance(run, biomes, {});
  advance(run, biomes, { restart: true });
  assert.equal(run.level.tiles, b.tiles, 'R leaves the underpass for the last flag');
  assert.equal(advance(run, biomes, { place: { kind: 0, x: 150, y: 35 * T - 26 } }), null, 'cannot build a plank on top of yourself');
  assert.equal(advance(run, biomes, { place: { kind: 1, x: 300, y: 30 * T } }), null, 'cannot build what you do not hold');
  const placed = advance(run, biomes, { place: { kind: 0, x: 300, y: 30 * T } });
  assert.equal(placed.type, 'placed');
  assert.deepEqual([run.s.placed.length, run.tricks], [1, []]);
  run.tricks = ['erase', 'flag', 'trampoline', 'ladder'];
  const spikes = b.objects.find(o => o.type === 'spikes');
  assert.equal(advance(run, biomes, { erase: spikes.id }).type, 'erased');
  assert.deepEqual(run.s.erased, [spikes.id]);
  assert.equal(advance(run, biomes, { flag: true }), null, 'a flag needs solid ground under you');
  run.s = { ...run.s, grounded: true };
  assert.equal(advance(run, biomes, { flag: true }).type, 'planted');
  assert.equal(run.touched.length, 1);
  assert.equal(advance(run, biomes, { place: { kind: 1, x: 600, y: 30 * T } }).rect.kind, 'trampoline');
  assert.equal(advance(run, biomes, { place: { kind: 2, x: 700, y: 30 * T } }).rect.kind, 'ladder');
  assert.deepEqual(run.tricks, []);
  assert.equal(run.s.placed.length, 3);
});

test('the pace clock waits until the climber is ten metres up, runs through deaths and pays for matching the proof', () => {
  const level = generateBiome('ghost-race', 0, null);
  const biomes = fixedBiomes([[0, level], [1, level]]);
  const climb = late => {
    const run = createRun(3);
    let head = 0;
    advance(run, biomes);
    for (let i = 0; i < 30; i++) advance(run, biomes, { right: true });
    assert.equal(run.elapsed, 0, 'walking the floor costs nothing');
    level.segments.forEach((segment, k) => {
      for (let i = 0; i < 300 && !restful(run); i++) advance(run, biomes, {});
      advance(run, biomes, { restart: true });
      if (k === level.segments.length - 1) run.elapsed = paceOf(level) - segment.inputs.length + late;
      for (const input of segment.inputs) advance(run, biomes, input);
      if (k === 0) { head = segment.inputs.length - run.elapsed; assert.ok(head > 0 && run.elapsed > 0, `the clock started part way up the first stretch, ${head} frames in`); }
    });
    assert.equal(run.index, 1, 'the proof reaches the gate');
    assert.equal(run.elapsed, 0, 'and the clock resets for the next biome');
    return run;
  };
  const exact = climb(0), slow = climb(1);
  assert.equal(exact.points - slow.points, 100, 'reaching the gate as the architect does doubles the gold, one frame after it does not');
  assert.equal(exact.runes - slow.runes, 1, 'and the runes');
  assert.ok(paceOf(level) > 0 && outpaced({ ...exact, level, elapsed: paceOf(level) }) && !outpaced({ ...exact, level, elapsed: paceOf(level) + 1 }));
});

test('R and the biome reset only work with your feet on the ground, and a reset starts the race again', () => {
  const level = generateBiome('ghost-race', 0, null);
  const biomes = fixedBiomes([[0, level], [1, level]]);
  const run = createRun(3);
  advance(run, biomes);
  const startY = run.s.y;
  let airborne = 0, ignored = 0;
  for (const input of level.segments[0].inputs) {
    advance(run, biomes, input);
    if (!run.s.grounded && airborne++ < 3) {
      const before = run.s;
      assert.equal(advance(run, biomes, { restart: true }), null, 'R in the air does nothing');
      assert.equal(run.s, before);
      ignored++;
    }
  }
  assert.equal(ignored, 3);
  assert.equal(run.touched.length, 1, 'the first flag is touched');
  for (let i = 0; i < 300 && !restful(run); i++) advance(run, biomes, {});
  assert.ok(run.elapsed > 0 && restful(run));
  assert.equal(advance(run, biomes, { reset: true }).type, 'reset');
  assert.deepEqual([run.s.y, run.touched.length, run.elapsed, run.lives], [startY, 0, 0, 3], 'back at the floor with the clock and flags cleared and no life lost');
});

test('the wanted chain names the stretches its first biome must differ from', () => {
  const run = createRun(3, 'chain');
  assert.deepEqual(wantedChain(run, 2).history, []);
  run.level = { exitCol: 4, profiles: [{ rise: 2 }], mutators: [] };
  assert.deepEqual(wantedChain(run, 2).history, [{ rise: 2 }]);
});

test('the combo line stays where it was through a biome restart and a change of difficulty, so a climb pays once', () => {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  Object.assign(level, { index: 0, theme: 0, palette: 120, title: '', segments: [], exit: { x: 0, y: -300, w: 0, h: 0 }, start: { x: 300, y: 35 * TILE - 26 } });
  const biomes = fixedBiomes([[0, level]]);
  const run = createRun(3, 'line');
  for (let i = 0; i < 60; i++) advance(run, biomes, {});
  assert.equal(run.phase, 'play');
  const line = 20 * TILE;
  run.combo = { ...run.combo, links: 4, floor: line };
  assert.equal(advance(run, biomes, { reset: true })?.type, 'reset');
  assert.equal(run.combo.floor, line, 'restart keeps the line');
  assert.equal(run.combo.links, 0, 'but the chain itself starts over');
  run.s = { ...run.s, x: impX(level) - 10 };
  for (let i = 0; i < 5; i++) advance(run, biomes, {});
  assert.equal(advance(run, biomes, { difficulty: 1 })?.type, 'difficulty');
  assert.equal(run.combo.floor, line, 'difficulty keeps the line');
  const landing = feet => stepCombo(level, { ...run.s, grounded: false }, { ...run.s, grounded: true, y: feet - 26 }, run.combo);
  for (const feet of [30, 28, 26].map(row => row * TILE)) {
    run.combo = landing(feet);
    assert.equal(run.combo.gained, 0, `row ${feet / TILE} below the line pays nothing`);
  }
});

function shopWalk(tricks = []) {
  const level = createLevel(buildRules([]), [], 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  Object.assign(level, { index: 0, theme: 0, palette: 120, title: '', segments: [], exit: { x: 0, y: -300, w: 0, h: 0 }, start: { x: 300, y: 35 * TILE - 26 } });
  const biomes = fixedBiomes([[0, level]]);
  const run = createRun(3, 'shop');
  for (let i = 0; i < 40; i++) advance(run, biomes, {});
  run.tricks = tricks;
  run.s = { ...run.s, x: 2 };
  for (let i = 0; i < 300 && !run.hall; i++) advance(run, biomes, { left: true });
  assert.ok(run.hall, 'walked into the shops');
  for (let i = 0; i < 20; i++) advance(run, biomes, {});
  return { run, biomes };
}

test('nothing can be planted or built in the shops, and the trick is kept', () => {
  const { run, biomes } = shopWalk(['flag', 'plank']);
  assert.equal(advance(run, biomes, { flag: true }), null);
  assert.equal(advance(run, biomes, { place: { kind: PLACEABLE.indexOf('plank'), x: 400, y: 300 } }), null);
  assert.deepEqual(run.tricks, ['flag', 'plank']);
  assert.equal(run.touched.length, 0);
});

test('pressing R in the shops keeps everything you bought there', () => {
  const { run, biomes } = shopWalk();
  run.s = { ...run.s, arrows: 5, boots: 5 };
  run.hall = { ...run.hall, comet: true };
  assert.equal(advance(run, biomes, { restart: true })?.type, 'restore');
  assert.deepEqual([run.hall, run.s.arrows, run.s.boots, run.s.comet], [null, 5, 5, 1]);
});

