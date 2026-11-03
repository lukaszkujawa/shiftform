import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, addObject, SOLID, COLS, TILE } from '../src/world/level.js';
import { buildRules, isBane } from '../src/world/rules.js';
import { step, initialState, shieldsUp, shoot, grant, JETPACK_FUEL, SHIELD_RECHARGE } from '../src/world/physics.js';
import { respawn, enterBiome } from '../src/world/climb.js';
import { createRun, advance as play_, train, stallOf, shopOffer, wantedChain, skillsOnOffer } from '../src/world/run.js';
import { REROLL_COST } from '../src/world/tricks.js';
import { SKILL_IDS, SKILLS, MAX_SKILL, withSkills, priceOf, lightOf, luckyStart, skillOffer } from '../src/world/skills.js';

const FLOOR = 71;
const STOCK = ['dash', 'jump', 'teleport', 'shield', 'heart', 'torch'];
const pick = id => STOCK.indexOf(id) + 1;
const advance = (run, biomes, input) => {
  if (input?.skill) run.skillStock = STOCK;
  return play_(run, biomes, input);
};

function biome(index, mutators = []) {
  const level = createLevel(buildRules(mutators), mutators, FLOOR + 1);
  fillTiles(level, 0, FLOOR, COLS, 1, SOLID);
  Object.assign(level, { index, theme: 0, palette: 40, title: '', segments: [], entryCol: 4, exitCol: 4, provenMutators: mutators });
  level.start = { x: 150, y: FLOOR * TILE - 26 };
  level.exit = { x: 120, y: -30, w: 60, h: 30 };
  return level;
}

function generator() {
  const built = new Map(), asked = [];
  const biomes = want => {
    asked.push(want);
    return built.get(want.index) ?? built.set(want.index, biome(want.index, want.rules)).get(want.index);
  };
  return Object.assign(biomes, { asked });
}

const climb = (run, biomes) => { run.s = { ...run.s, x: 140, y: -40, vy: -9 }; return advance(run, biomes, {}); };
const walkTo = (run, biomes, stall, key = 'left') => { for (let i = 0; i < 900 && stallOf(run) !== stall; i++) advance(run, biomes, { [key]: true }); };
const surface = (run, biomes) => { for (let i = 0; i < 900 && run.hall; i++) advance(run, biomes, { left: true }); };
const skilledLevel = skills => {
  const level = biome(0);
  return { ...level, rules: withSkills(level.rules, skills) };
};
const settled = level => { let s = initialState(level); for (let i = 0; i < 5; i++) s = step(level, s, {}); return s; };
function play(level, s, inputs) {
  const seen = [];
  for (const input of inputs) { s = step(level, s, input); seen.push(s); }
  return { s, seen };
}
const peak = seen => Math.min(...seen.map(s => s.y));

test('every skill has a title, an icon, words for its level, and five levels at rising prices', () => {
  for (const id of SKILL_IDS) {
    assert.ok(SKILLS[id].title && SKILLS[id].icon && SKILLS[id].about);
    for (let n = 1; n <= MAX_SKILL; n++) assert.ok(SKILLS[id].now(n));
  }
  assert.equal(MAX_SKILL, 5);
  assert.deepEqual([1, 2, 3, 4].map(n => priceOf({ dash: n }, 'dash')), [2, 3, 4, 5]);
  assert.equal(priceOf({}, 'dash'), 1);
});

test('Jump gives one more air jump per level, each smaller than the last', () => {
  const level = skilledLevel({ jump: 3 });
  assert.equal(level.rules.jumps, 4);
  let s = settled(level);
  const velocities = [];
  for (let k = 0; k < 5; k++) {
    s = step(level, s, { jump: true });
    velocities.push(s.vy);
    ({ s } = play(level, s, Array(3).fill({})));
  }
  assert.ok(velocities[1] > velocities[0] && velocities[2] > velocities[1] && velocities[3] > velocities[2], `${velocities} each jump is weaker`);
  assert.equal(s.jumpsLeft, 0);
  assert.ok(velocities[4] > velocities[3] + 3 * level.rules.gravity * level.rules.holdBoost, 'the fifth press has nothing left');
});

test('Spider counts kicks off the same wall, and landing or another wall starts again', () => {
  const level = biome(0);
  const worn = { ...level, rules: withSkills(level.rules, { spider: 2 }) };
  fillTiles(worn, 20, 0, 2, FLOOR, SOLID);
  fillTiles(worn, 10, 0, 2, FLOOR, SOLID);
  const atWall = { ...initialState(worn), x: 20 * TILE - 20, y: 40 * TILE, vy: 1, grounded: false, jumpsLeft: 0 };
  const kick = s => step(worn, s, { jump: true });
  const once = kick(atWall);
  assert.equal(once.wallKicks, 1);
  const back = { ...once, x: atWall.x, vx: 0, vy: 1, jumpHeld: false };
  const twice = kick(back);
  assert.equal(twice.wallKicks, 2);
  const spent = kick({ ...twice, x: atWall.x, vx: 0, vy: 1, jumpHeld: false, lastKick: 1 });
  assert.ok(spent.vy > 0, 'the third kick off that wall does nothing');
  const other = kick({ ...twice, x: 12 * TILE, vx: 0, vy: 1, jumpHeld: false, lastKick: -1 });
  assert.deepEqual([other.wallSide, other.wallKicks], [-1, 1], 'another wall starts the count again');
});

test('Jumper lifts every jump a little more each level', () => {
  const heights = [0, 1, 3, 5].map(n => {
    const level = skilledLevel(n ? { jumper: n } : {}), s = settled(level);
    return s.y - peak(play(level, s, Array(60).fill({ jump: true })).seen);
  });
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2] && heights[2] < heights[3], `${heights}`);
  assert.ok(heights[1] < heights[0] * 1.2, 'slightly, not suddenly');
});

test('Dash enables the dash and goes further each level', () => {
  const unskilled = skilledLevel({});
  assert.equal(play(unskilled, settled(unskilled), [{ dash: true }]).s.dashTimer, 0);
  const reach = [1, 3, 5].map(n => {
    const level = skilledLevel({ dash: n }), s = settled(level);
    return play(level, s, [{ dash: true, right: true }, ...Array(40).fill({ dash: true })]).s.x - s.x;
  });
  assert.ok(reach[0] > 40 && reach[0] < reach[1] && reach[1] < reach[2], `${reach}`);
});

test('A dash covers what its card says when held to the end', () => {
  for (const n of [1, 3, 5]) {
    const level = skilledLevel({ dash: n }), s = settled(level);
    const px = play(level, s, [{ dash: true, right: true }, ...Array(40).fill({ dash: true })]).s.x - s.x;
    assert.equal(px, level.rules.dashFrames * level.rules.dashSpeed, `level ${n}`);
  }
});

test('Letting go of dash stops it at once, on the ground and in the air', () => {
  const level = skilledLevel({ dash: 5 }), grounded = settled(level);
  const held = frames => [{ dash: true, right: true }, ...Array(frames - 1).fill({ dash: true })];
  const reach = frames => play(level, grounded, [...held(frames), ...Array(40).fill({})]).s.x - grounded.x;
  assert.ok(reach(2) < reach(6) && reach(6) < reach(12), 'the longer you hold the further you go');
  assert.equal(reach(6), 6 * level.rules.dashSpeed, 'no slide after letting go');

  const midAir = { ...grounded, y: grounded.y - 300, grounded: false };
  const dashed = play(level, midAir, held(4)).s;
  assert.equal(dashed.dashTimer > 0, true);
  const released = step(level, dashed, {});
  assert.deepEqual([released.dashTimer, released.vx], [0, 0], 'nothing carries you on');
  const running = step(level, dashed, { right: true });
  assert.deepEqual([running.dashTimer, running.vx], [0, level.rules.moveSpeed], 'holding the direction drops to a run');
  assert.equal(step(level, released, { dash: true }).dashTimer, 0, 'one dash per landing');
});

test('Jetpack holds 1.2x fuel at level 1, up to 2x at level 5, and buying a level fills the tank', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(n => withSkills(buildRules([]), { jetpack: n }).jetFuel), [216, 252, 288, 324, 360]);
  assert.equal(withSkills(buildRules([]), {}).jetFuel, JETPACK_FUEL);
  const level = skilledLevel({ jetpack: 5 });
  assert.equal(grant({ fuel: 0 }, 'jetpack', level.rules).fuel, JETPACK_FUEL * 2);
  const biomes = generator(), run = createRun(5, 'j');
  advance(run, biomes);
  train(run, 'jetpack');
  assert.equal(run.s.fuel, 216);
  run.s = { ...run.s, fuel: 5 };
  train(run, 'jetpack');
  assert.equal(run.s.fuel, 252);
});

test('Bow holds more arrows each level, and buying a level fills the quiver without taking any', () => {
  const quiver = n => withSkills(buildRules([]), { bow: n }).quiver;
  assert.deepEqual([1, 2, 3, 4, 5].map(quiver), [7, 9, 11, 13, 15]);
  assert.equal(grant({ arrows: 2 }, 'bow', skilledLevel({ bow: 1 }).rules).arrows, 9);
  const biomes = generator(), run = createRun(5, 'b');
  advance(run, biomes);
  train(run, 'bow');
  assert.equal(run.s.arrows, 7);
  run.s = { ...run.s, arrows: 30 };
  train(run, 'bow');
  assert.equal(run.s.arrows, 30);
});

test('each Bow level fires more ways at once for the price of one arrow', () => {
  const aims = n => {
    const level = skilledLevel(n ? { bow: n } : {});
    const s = shoot(level, { ...settled(level), arrows: 3, facing: 1 });
    assert.equal(s.arrows, 2, 'one arrow spent');
    return s.flying.map(a => `${Math.sign(Math.round(a.vx))},${Math.sign(Math.round(a.vy))}`);
  };
  assert.deepEqual(aims(0), ['1,0']);
  assert.deepEqual(aims(1), ['1,0', '-1,0']);
  assert.deepEqual(aims(2), ['1,0', '-1,0', '0,-1']);
  assert.deepEqual(aims(3).slice(3), ['1,-1', '-1,-1']);
  assert.deepEqual(aims(4).slice(5), ['1,1', '-1,1']);
  assert.deepEqual(aims(5).slice(7), ['0,1']);
  assert.equal(new Set(aims(5)).size, 8, 'every way round by the top level');
});

test('a volley follows your facing and gravity, and every arrow flies at the same speed', () => {
  const level = skilledLevel({ bow: 3 });
  const left = shoot(level, { ...settled(level), arrows: 1, facing: -1 }).flying;
  assert.ok(left[0].vx < 0 && left[1].vx > 0, 'front is the way you face');
  const flipped = shoot(level, { ...settled(level), arrows: 1, facing: 1, gravDir: -1 }).flying;
  assert.ok(flipped[2].vy > 0, 'up is away from the floor');
  for (const a of left) assert.ok(Math.abs(Math.hypot(a.vx, a.vy) - left[0].vx * -1) < 1e-9);
});

test('an arrow shot upward kills what is above you, and a wall above stops it', () => {
  const level = skilledLevel({ bow: 2 });
  const s = { ...settled(level), arrows: 1, facing: 1 };
  const m = addObject(level, { type: 'monster', kind: 'patroller', x: s.x - 1, y: s.y - 120, w: 22, h: 20, dx: 0, dy: 0, period: 240, phase: 0 });
  const after = play(level, shoot(level, s), Array(30).fill({})).s;
  assert.ok(after.slain & (1 << m.slot), 'hit');
  const roofed = skilledLevel({ bow: 2 });
  fillTiles(roofed, 0, FLOOR - 4, COLS, 1, SOLID);
  const top = { ...settled(roofed), arrows: 1, facing: 1 };
  const m2 = addObject(roofed, { type: 'monster', kind: 'patroller', x: top.x - 1, y: top.y - 220, w: 22, h: 20, dx: 0, dy: 0, period: 240, phase: 0 });
  const blocked = play(roofed, shoot(roofed, top), Array(40).fill({})).s;
  assert.ok(!(blocked.slain & (1 << m2.slot)));
  assert.equal(blocked.flying.filter(a => a.vy < 0).length, 0);
});

test('Teleport gives more teleports per level, at once and in every biome after', () => {
  assert.deepEqual([1, 3, 5].map(n => withSkills(buildRules([]), { teleport: n }).teleports), [2, 4, 6]);
  const biomes = generator(), run = createRun(5, 't');
  advance(run, biomes);
  run.runes = 10;
  walkTo(run, biomes, 'trainer', 'right');
  advance(run, biomes, { skill: pick('teleport') });
  assert.equal(run.s.teleports, 2);
  advance(run, biomes, { skill: pick('teleport') });
  assert.equal(run.s.teleports, 3);
  surface(run, biomes);
  climb(run, biomes);
  assert.equal(run.s.teleports, 3);
});

test('Torch widens the light and Lucky Charm shields more often per level', () => {
  assert.deepEqual([lightOf({}), lightOf({ torch: 1 }), lightOf({ torch: 5 })], [1, 1.5, 3.5]);
  const share = skills => Array.from({ length: 600 }, (_, i) => luckyStart(skills, 'luck', i)).filter(Boolean).length;
  assert.equal(share({}), 0);
  assert.ok(share({ charm: 1 }) < share({ charm: 3 }) && share({ charm: 3 }) < share({ charm: 5 }));
  assert.equal(share({ charm: 5 }), 600);
});

test('the Umbrella falls slower and Flywheel charges harder each level', () => {
  assert.ok(withSkills(buildRules([]), { umbrella: 1 }).glideSpeed > withSkills(buildRules([]), { umbrella: 5 }).glideSpeed);
  assert.ok(withSkills(buildRules([]), { flywheel: 1 }).chargePower < withSkills(buildRules([]), { flywheel: 5 }).chargePower);
});

test('the trainer sells levels for runes, the first level free, up to the maximum', () => {
  const biomes = generator(), run = createRun(5, 'shop');
  advance(run, biomes);
  assert.equal(advance(run, biomes, { skill: pick('dash') }), null, 'only at the trainer');
  walkTo(run, biomes, 'trainer', 'right');
  assert.deepEqual(advance(run, biomes, { skill: pick('dash') }), { type: 'learned', id: 'dash', level: 1 });
  assert.deepEqual([run.skills, run.runes], [{ dash: 1 }, 0], 'the first one is free');
  assert.equal(run.level.rules.dash, true);
  assert.equal(advance(run, biomes, { skill: pick('dash') }), null, 'then it costs runes');
  run.runes = 2;
  advance(run, biomes, { skill: pick('dash') });
  assert.deepEqual([run.skills.dash, run.runes], [2, 0]);
  run.runes = 100;
  for (let i = 0; i < 6; i++) advance(run, biomes, { skill: pick('dash') });
  assert.equal(run.skills.dash, MAX_SKILL);
  assert.equal(run.runes, 100 - 3 - 4 - 5);
});

test('a purchase never rebuilds a biome: everything is proven bare and skills go on top', () => {
  const biomes = generator(), run = createRun(5, 'bare');
  advance(run, biomes);
  const chain = JSON.stringify(wantedChain(run, 2)), tiles = run.level.tiles;
  walkTo(run, biomes, 'trainer', 'right');
  advance(run, biomes, { skill: pick('jump') });
  surface(run, biomes);
  assert.equal(run.level.tiles, tiles, 'the same climb');
  assert.equal(run.level.rules.jumps, 2, 'with the skill');
  assert.equal(JSON.stringify(wantedChain(run, 2)), chain);
  climb(run, biomes);
  assert.equal(run.level.rules.jumps, 2, 'the next biome too');
  assert.ok(biomes.asked.every(want => want.rules.length === 0));
});

test('Heart adds a life per level', () => {
  const biomes = generator(), run = createRun(5, 'heart');
  advance(run, biomes);
  run.runes = 10;
  walkTo(run, biomes, 'trainer', 'right');
  advance(run, biomes, { skill: pick('heart') });
  advance(run, biomes, { skill: pick('heart') });
  assert.deepEqual([run.lives, run.maxLives], [7, 7]);
});

test('the shady dice seller re-rolls the merchant for gold', () => {
  const biomes = generator(), run = createRun(5, 'dice');
  advance(run, biomes);
  climb(run, biomes);
  walkTo(run, biomes, 'dicer', 'right');
  assert.equal(stallOf(run), 'dicer');
  const cards = shopOffer(run);
  run.points = REROLL_COST - 1;
  assert.equal(advance(run, biomes, { reroll: true }), null, 'it costs gold');
  run.points = 2 * REROLL_COST;
  run.bought = [cards[0]];
  assert.equal(advance(run, biomes, { reroll: true }).type, 'rerolled');
  assert.equal(run.points, REROLL_COST);
  assert.notDeepEqual(shopOffer(run), cards);
  assert.deepEqual(run.bought, []);
  surface(run, biomes);
  climb(run, biomes);
  assert.equal(run.rolls, 0, 'a new biome starts fresh');
});

test('finishing a biome collects its banes as experience and reports only the new ones', () => {
  const biomes = generator(), run = createRun(5, 'collect');
  run.difficulty = 1;
  run.skills = { dash: 1 };
  advance(run, biomes);
  const first = run.level.mutators.filter(isBane);
  assert.deepEqual(climb(run, biomes).entered.unlocked, first);
  const second = run.level.mutators.filter(id => isBane(id) && !first.includes(id));
  assert.deepEqual(climb(run, biomes).entered.unlocked, second, 'a bane already collected is not experience');
  assert.deepEqual(run.collected, [...first, ...second]);
});

function spiked(skills) {
  const level = skilledLevel(skills);
  addObject(level, { type: 'spikes', x: 200, y: FLOOR * TILE - 14, w: 24, h: 14, dir: -1 });
  return level;
}

const onSpikes = s => ({ ...s, x: 200, y: FLOOR * TILE - 26, vx: 0, vy: 0, invuln: 0 });

test('a hit costs one shield until the next biome and leaves you unprotected for seven seconds', () => {
  const level = spiked({ shield: 5 });
  let s = settled(level);
  assert.equal(shieldsUp(level.rules, s), 5);
  s = step(level, onSpikes(s), {});
  assert.deepEqual([s.dead, s.shieldsLost, shieldsUp(level.rules, s)], [false, 1, 0], 'none up straight after a hit');
  const away = { ...s, x: 400 };
  ({ s } = play(level, away, Array(SHIELD_RECHARGE - 2).fill({})));
  assert.equal(shieldsUp(level.rules, s), 0, 'still down just before the seven seconds are up');
  ({ s } = play(level, s, Array(4).fill({})));
  assert.equal(shieldsUp(level.rules, s), 4, 'four come back, the fifth stays lost');
  ({ s } = play(level, s, Array(SHIELD_RECHARGE * 2).fill({})));
  assert.equal(shieldsUp(level.rules, s), 4, 'and it never returns by waiting');
});

test('a second hit while the shields are down kills', () => {
  const level = spiked({ shield: 5 });
  const hit = step(level, onSpikes(settled(level)), {});
  const later = play(level, { ...hit, x: 400 }, Array(100).fill({})).s;
  assert.equal(step(level, onSpikes(later), {}).dead, true);
});

test('losing the last shield leaves none to come back', () => {
  const level = spiked({ shield: 1 });
  const hit = step(level, onSpikes(settled(level)), {});
  const { s, seen } = play(level, { ...hit, x: 400 }, Array(SHIELD_RECHARGE + 20).fill({}));
  assert.equal(shieldsUp(level.rules, s), 0);
  assert.ok(seen.every(q => shieldsUp(level.rules, q) === 0));
});

test('a shield you found is spent after the ones that come back', () => {
  const level = spiked({ shield: 1 });
  let s = step(level, onSpikes({ ...settled(level), shield: true }), {});
  assert.deepEqual([s.shield, shieldsUp(level.rules, s)], [true, 0]);
  s = step(level, onSpikes(s), {});
  assert.deepEqual([s.dead, s.shield], [false, false]);
});

test('dying does not refill shields, and a new biome does', () => {
  const level = spiked({ shield: 2 });
  const hit = step(level, onSpikes(settled(level)), {});
  const reborn = respawn(level, { ...hit, dead: true }, []);
  assert.deepEqual([reborn.shieldsLost, shieldsUp(level.rules, reborn)], [1, 0]);
  assert.equal(shieldsUp(level.rules, enterBiome(level, hit, level)), 2);
});

test('the seven seconds keep running in the underpass, and a lost shield stays lost', () => {
  const biomes = generator(), run = createRun(5, 'hall');
  advance(run, biomes);
  run.runes = 5;
  walkTo(run, biomes, 'trainer', 'right');
  advance(run, biomes, { skill: pick('shield') });
  advance(run, biomes, { skill: pick('shield') });
  assert.equal(run.level.rules.shields, 2);
  run.s = { ...run.s, shieldsLost: 1, shieldsBack: run.s.frame + 5 };
  assert.equal(shieldsUp(run.level.rules, run.s), 0);
  for (let i = 0; i < 6; i++) advance(run, biomes, {});
  assert.equal(shieldsUp(run.level.rules, run.s), 1);
});

test('the trainer offers six skills per biome, the same for a seed, never a maxed one', () => {
  const offer = skillOffer('stock', 3, {});
  assert.equal(offer.length, 6);
  assert.equal(new Set(offer).size, 6);
  assert.ok(offer.every(id => SKILL_IDS.includes(id)));
  assert.deepEqual(skillOffer('stock', 3, {}), offer);
  assert.ok(Array.from({ length: 20 }, (_, i) => skillOffer('stock', i, {}).join()).some(other => other !== offer.join()), 'other biomes differ');
  assert.notDeepEqual(skillOffer('stock', 3, {}, 1), offer, 'a roll changes it');
  assert.ok(!skillOffer('stock', 3, { [offer[0]]: MAX_SKILL }).includes(offer[0]));
  assert.equal(skillOffer('stock', 3, Object.fromEntries(SKILL_IDS.slice(3).map(id => [id, MAX_SKILL]))).length, 3);
});

test('the offer stays put through a visit and turns over with the biome and the dice', () => {
  const biomes = generator(), run = createRun(5, 'stock');
  play_(run, biomes);
  walkTo(run, biomes, 'trainer', 'right');
  const offer = skillsOnOffer(run);
  assert.deepEqual(offer, skillOffer('stock', 0, {}));
  assert.equal(play_(run, biomes, { skill: 1 }).id, offer[0], 'the card you pick is the one you get');
  assert.deepEqual(skillsOnOffer(run), offer, 'buying does not reshuffle the shelf');
  assert.equal(play_(run, biomes, { skill: 7 }), null);
  run.points = REROLL_COST;
  walkTo(run, biomes, 'dicer', 'right');
  play_(run, biomes, { reroll: true });
  assert.deepEqual(skillsOnOffer(run), skillOffer('stock', 0, run.skills, 1));
  surface(run, biomes);
  climb(run, biomes);
  assert.deepEqual(skillsOnOffer(run), skillOffer('stock', 1, run.skills));
});
