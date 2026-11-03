import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, fillTiles, SOLID, COLS, TILE } from '../src/level.js';
import { buildRules, isBane } from '../src/rules.js';
import { step, initialState } from '../src/physics.js';
import { createRun, advance, stallOf, shopOffer, wantedChain } from '../src/run.js';
import { REROLL_COST } from '../src/tricks.js';
import { SKILL_IDS, SKILLS, MAX_SKILL, withSkills, priceOf, lightOf, luckyStart } from '../src/skills.js';

const FLOOR = 71;
const pick = id => SKILL_IDS.indexOf(id) + 1;

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
    return play(level, s, [{ dash: true, right: true }, ...Array(40).fill({})]).s.x - s.x;
  });
  assert.ok(reach[0] > 40 && reach[0] < reach[1] && reach[1] < reach[2], `${reach}`);
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
