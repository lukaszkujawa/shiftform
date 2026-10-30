import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, COLS, TILE } from '../src/level.js';
import { buildRules, biomeRules, biomeKey, mutatorById, MUTATORS, isBane } from '../src/rules.js';
import { createRun, advance, currentRules, stallOf, rulesFor } from '../src/run.js';
import { swapOptions, SWAP_COST } from '../src/rulesmith.js';
import { TIERS, tierOf, priceOf, equip, activeGear, gearOffer, luckyStart, lightOf } from '../src/outfitter.js';

function biome(index, mutators) {
  const level = createLevel(buildRules(mutators), mutators, 36);
  fillTiles(level, 0, 35, COLS, 1, SOLID);
  Object.assign(level, { index, theme: 0, palette: 40, title: '', segments: [], entryCol: 4, exitCol: 4 });
  level.start = { x: 150, y: 35 * TILE - 26 };
  level.exit = { x: 120, y: -30, w: 60, h: 30 };
  return level;
}

function generator() {
  const built = new Map(), asked = [];
  const biomes = want => {
    const key = biomeKey(want.index, want.entryCol, want.rules);
    asked.push(want);
    if (biomes.held) return null;
    if (!built.has(key)) built.set(key, biome(want.index, want.rules));
    return built.get(key);
  };
  return Object.assign(biomes, { asked, held: false });
}

const seedWith = test => Array.from({ length: 200 }, (_, i) => `rules-${i}`).find(seed => test(biomeRules(seed, 1)));
const climb = (run, biomes) => { run.s = { ...run.s, x: 140, y: -40, vy: -9 }; return advance(run, biomes, {}); };
const walkTo = (run, biomes, stall, key = 'left') => { for (let i = 0; i < 600 && stallOf(run) !== stall; i++) advance(run, biomes, { [key]: true }); };
const surface = (run, biomes) => { for (let i = 0; i < 600 && run.hall; i++) advance(run, biomes, { left: true }); };

test('the world only rolls banes, the same ones for a seed', () => {
  assert.deepEqual(biomeRules('abc', 0), []);
  assert.deepEqual(biomeRules('abc', 3), biomeRules('abc', 3));
  for (let i = 0; i < 200; i++) assert.ok(biomeRules(`seed-${i}`, 1 + (i % 12)).every(isBane));
});

test('the rulesmith swaps a beaten bane for another, and the biome is rebuilt for it when you come up', () => {
  const seed = seedWith(rules => rules.length === 1);
  const [from] = biomeRules(seed, 1);
  const bane = MUTATORS.find(m => isBane(m.id) && m.id !== from && swapOptions([from], [from, m.id], from).includes(m.id)).id;
  const biomes = generator(), run = createRun(5, seed);
  advance(run, biomes);
  climb(run, biomes);
  assert.equal(run.index, 1);
  assert.deepEqual(currentRules(run), [from]);
  const first = run.level;
  run.collected = [from, bane];
  run.runes = SWAP_COST;
  assert.equal(advance(run, biomes, { swap: { from, to: bane } }), null, 'only at the rulesmith');
  walkTo(run, biomes, 'rulesmith');
  run.collected = [bane];
  assert.equal(advance(run, biomes, { swap: { from, to: bane } }), null, 'a bane you have not beaten stays');
  run.collected = [from, bane];
  run.runes = 0;
  assert.equal(advance(run, biomes, { swap: { from, to: bane } }), null, 'a swap costs runes');
  run.runes = SWAP_COST;
  assert.equal(advance(run, biomes, { swap: { from, to: bane } }).type, 'rewritten');
  assert.equal(run.runes, 0, 'the swap is paid for');
  assert.equal(run.hall.level, first, 'the biome waits while you are underground');
  advance(run, biomes, { swap: { from, to: from } });
  assert.equal(run.runes, SWAP_COST, 'undoing during the same visit refunds');
  advance(run, biomes, { swap: { from, to: bane } });
  biomes.held = true;
  surface(run, biomes);
  assert.equal(run.phase, 'rebuild', 'waits at the mouth while the biome is rebuilt');
  biomes.held = false;
  advance(run, biomes);
  assert.equal(run.phase, 'play');
  assert.ok(!run.hall && run.level !== first, 'came up into a rebuilt biome');
  assert.deepEqual(run.level.mutators, [bane]);
  assert.deepEqual(biomes.asked.at(-1), { index: 1, entryCol: first.entryCol, rules: [bane] }, 'proven for the rules you play under');
  walkTo(run, biomes, 'rulesmith');
  advance(run, biomes, { swap: { from, to: from } });
  assert.equal(run.runes, 0, 'a later visit undoes the swap without a refund');
});

test('gear costs runes by tier, fills two slots, and every biome is built for the gear you wear', () => {
  const seed = seedWith(rules => rules.length === 1);
  const biomes = generator(), run = createRun(5, seed);
  advance(run, biomes);
  climb(run, biomes);
  walkTo(run, biomes, 'outfitter');
  assert.equal(stallOf(run), 'outfitter');
  const offer = gearOffer(seed, 1);
  assert.equal(offer.length, 3);
  assert.ok(offer.every(id => !isBane(id)));
  run.gearOffer = ['double', 'walls', 'dash'];
  run.runes = priceOf('double') - 1;
  assert.equal(advance(run, biomes, { equip: 1 }), null, 'gear costs runes');
  run.runes = priceOf('double') + priceOf('walls') + priceOf('dash');
  assert.deepEqual(advance(run, biomes, { equip: 1 }), { type: 'equipped', kind: 'double', replaced: null });
  assert.equal(advance(run, biomes, { equip: 1 }), null, 'already worn');
  advance(run, biomes, { equip: 2 });
  assert.deepEqual(run.gear, ['double', 'walls'], 'two pieces compose');
  assert.deepEqual(advance(run, biomes, { equip: 3, giving: 1 }).replaced, 'walls', 'a third replaces the piece you give up');
  assert.deepEqual([run.gear, run.runes], [['double', 'dash'], 0]);
  run.gear = ['walls', 'dash'];
  assert.deepEqual(rulesFor(run, 2), [...biomeRules(seed, 2), ...activeGear(run.gear, biomeRules(seed, 2))]);
  surface(run, biomes);
  assert.ok(run.level.mutators.includes('dash') || !activeGear(['dash'], biomeRules(seed, 1)).length, 'the biome you come up into wears your gear');
  climb(run, biomes);
  assert.equal(run.index, 2);
  assert.deepEqual(run.level.mutators, rulesFor(run, 2), "the next biome too");
});

test('the first biome offers three common pieces and the first one is free', () => {
  const biomes = generator(), run = createRun(5, 'starter');
  advance(run, biomes);
  walkTo(run, biomes, 'outfitter');
  assert.equal(run.index, 0);
  const offer = gearOffer('starter', 0);
  assert.ok(offer.every(id => tierOf(id) === 'common'));
  assert.equal(run.runes, 0);
  assert.equal(advance(run, biomes, { equip: 2 }).kind, offer[1]);
  assert.deepEqual([run.gear, run.runes], [[offer[1]], 0]);
  assert.equal(advance(run, biomes, { equip: 1 }), null, 'only the first is free');
});

test('every biome offers fresh gear, never a piece you already wear', () => {
  for (let i = 1; i < 12; i++) assert.ok(gearOffer('fresh', i, ['charm', 'walls']).every(id => id !== 'charm' && id !== 'walls'));
  const levels = new Map([0, 1, 2].map(i => [i, biome(i, [])])), biomes = want => levels.get(want.index);
  const run = createRun(5, 'fresh');
  advance(run, biomes);
  run.gear = ['charm'];
  climb(run, biomes);
  assert.ok(!run.gearOffer.includes('charm'));
  assert.deepEqual(run.gearOffer, gearOffer('fresh', 1, ['charm']));
});

test('rarer gear turns up the higher you climb', () => {
  const tiers = index => Array.from({ length: 300 }, (_, k) => gearOffer(`odds-${k}`, index)).flat().map(tierOf);
  const share = (index, tier) => tiers(index).filter(t => t === tier).length;
  assert.equal(share(1, 'epic'), 0, 'no epics early on');
  assert.ok(share(2, 'rare') > 0);
  assert.ok(share(9, 'epic') > share(5, 'epic'));
  assert.ok(TIERS.common.cost < TIERS.rare.cost && TIERS.rare.cost < TIERS.epic.cost);
});

test('a Spare Heart is one more life while worn, and its loss takes it back', () => {
  const biomes = generator(), run = createRun(5, 'spare');
  advance(run, biomes);
  walkTo(run, biomes, 'outfitter');
  run.runes = 10;
  run.gearOffer = ['spare', 'walls', 'dash'];
  advance(run, biomes, { equip: 1 });
  assert.deepEqual([run.lives, run.maxLives], [6, 6]);
  assert.equal(rulesFor(run, 0).includes('spare'), false, 'no physics, no rebuild');
  advance(run, biomes, { equip: 2 });
  advance(run, biomes, { equip: 3 });
  assert.deepEqual(run.gear, ['walls', 'dash']);
  assert.deepEqual([run.lives, run.maxLives], [5, 5]);
});

test('a Lucky Charm shields about half the biomes you enter, the same ones every time', () => {
  const lucky = Array.from({ length: 400 }, (_, i) => luckyStart(['charm'], 'luck', i));
  assert.ok(lucky.filter(Boolean).length > 160 && lucky.filter(Boolean).length < 240);
  assert.deepEqual(lucky, Array.from({ length: 400 }, (_, i) => luckyStart(['charm'], 'luck', i)));
  assert.equal(luckyStart(['dash'], 'luck', lucky.indexOf(true)), false);
  const index = lucky.indexOf(true, 1), levels = new Map(Array.from({ length: index + 1 }, (_, i) => [i, biome(i, [])]));
  const run = createRun(5, 'luck');
  advance(run, want => levels.get(want.index));
  run.gear = ['charm'];
  while (run.index < index) climb(run, want => levels.get(want.index));
  assert.equal(run.s.shield, true);
});

test('a Torch doubles how far you see in the dark, and is common', () => {
  assert.deepEqual([lightOf([]), lightOf(['torch', 'walls'])], [1, 2]);
  assert.equal(tierOf('torch'), 'common');
  assert.deepEqual(activeGear(['torch'], ['dark']), [], 'it never changes how the biome is built');
});

test('Grip Boots take the slip out of Black Ice', () => {
  const ice = buildRules(['ice']), grip = buildRules(['ice', 'grip']), plain = buildRules([]);
  assert.ok(ice.friction > plain.friction);
  assert.deepEqual([grip.friction, grip.groundAccel], [plain.friction, plain.groundAccel]);
  assert.deepEqual(activeGear(['grip'], ['ice']), ['grip'], 'they work on the ice they are for');
});

test('gear that changes the same physics replaces, and gear that clashes with a bane rests', () => {
  assert.deepEqual(equip(['double'], 'triple'), { gear: ['triple'], replaced: 'double' });
  assert.deepEqual(equip(['walls', 'dash'], 'glide', 'dash'), { gear: ['walls', 'glide'], replaced: 'dash' }, 'you choose which piece to give up');
  assert.deepEqual(equip(['double', 'dash'], 'triple', 'dash'), { gear: ['dash', 'triple'], replaced: 'double' }, 'but a clash always wins');
  assert.deepEqual(equip(['moon', 'dash'], 'glide'), { gear: ['dash', 'glide'], replaced: 'moon' });
  assert.deepEqual(activeGear(['moon', 'dash'], ['heavy']), ['dash'], 'Moon Shoes rest under Lead Boots');
});

test('finishing a biome collects its banes as experience and reports only the new ones', () => {
  const levels = new Map([[0, biome(0, ['heavy'])], [1, biome(1, ['heavy', 'ice', 'dash'])], [2, biome(2, [])]]);
  const run = createRun(5, 'collect');
  const biomes = want => levels.get(want.index);
  advance(run, biomes);
  assert.deepEqual(climb(run, biomes).entered.unlocked, ['heavy']);
  assert.deepEqual(climb(run, biomes).entered.unlocked, ['ice'], 'heavy was already collected and gear is not experience');
  assert.deepEqual(run.collected, ['heavy', 'ice']);
  assert.ok(mutatorById('dash'));
});
