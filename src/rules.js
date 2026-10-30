import { Rng, hashString, mix } from './rng.js';

const BASE_RULES = Object.freeze({
  gravity: 0.55,
  jumpVel: 8.5,
  holdBoost: 0.6,
  moveSpeed: 4.2,
  groundAccel: 0.9,
  airAccel: 0.55,
  friction: 0.78,
  maxFall: 14,
  jumps: 1,
  wallJump: false,
  bounce: 0,
  mirror: false,
  flipChance: 0,
  jumpFlipChance: 0,
  flipFrames: 0,
  baseGravDir: 1,
  dash: false,
  dashSpeed: 11,
  dashFrames: 8,
  wrapY: false,
  superhot: false,
  glide: false,
  size: 1,
  darkness: false,
  jumpBudget: 0,
  slowAir: false,
  blinkJump: false,
  rubberWalls: false,
  fallDamage: false,
  flood: 0,
  clockRate: 1,
  flywheel: false,
  committed: false,
});

export const CHARGE_FRAMES = 60;
export const SPEED_BONUS = 0.5;
export const JUMP_BONUS = 0.25;
export const CHARGE_GATE = 0.5;

export const boostOf = charge => Math.max(0, (charge - CHARGE_GATE) / (1 - CHARGE_GATE));

export const MUTATORS = [
  { id: 'moon', effect: 'boon', title: 'Moon Shoes', about: 'Low gravity. You jump higher and fall slowly.', tags: ['gravity'], weight: 3,
    apply: r => { r.gravity = 0.2; r.jumpVel = 5.2; r.maxFall = 7; } },
  { id: 'heavy', effect: 'bane', title: 'Lead Boots', about: 'Heavy gravity. Jumps are short and falls are fast.', tags: ['gravity'], weight: 2,
    apply: r => { r.gravity = 1.15; r.jumpVel = 12.3; r.maxFall = 20; } },
  { id: 'ceiling', effect: 'bane', title: 'Upside Down', about: 'Now and then, while you climb, gravity turns upside down for a few seconds.', tags: ['gravdir'], weight: 2,
    apply: r => { r.flipChance = 0.004; r.flipFrames = 150; } },
  { id: 'flipjump', effect: 'bane', title: 'Flip Jumps', about: 'A running jump can turn gravity upside down for a moment.', tags: ['gravdir', 'jump'], weight: 3,
    apply: r => { r.jumpFlipChance = 0.5; r.flipFrames = 70; } },
  { id: 'tide', effect: 'bane', title: 'The Tide', about: 'While you climb, gravity often flips for a second.', tags: ['gravdir'], weight: 2,
    apply: r => { r.flipChance = 0.012; r.flipFrames = 60; } },
  { id: 'bouncy', effect: 'bane', title: 'Trampoline World', about: 'Every landing bounces you back up.', tags: ['landing'], weight: 2,
    apply: r => { r.bounce = 0.72; } },
  { id: 'ice', effect: 'bane', title: 'Black Ice', about: 'Floors are slippery. You keep sliding after you let go.', tags: ['ground'], weight: 2,
    apply: r => { r.friction = 0.985; r.groundAccel = 0.22; } },
  { id: 'mirror', effect: 'bane', title: 'Mirror Hands', about: 'Left and right are swapped.', tags: ['input'], weight: 2,
    apply: r => { r.mirror = true; } },
  { id: 'double', effect: 'boon', title: 'Second Wind', about: 'Jump once more in mid-air.', tags: ['jump'], weight: 3,
    apply: r => { r.jumps = 2; } },
  { id: 'triple', effect: 'boon', title: 'Hummingbird', about: 'Jump three times before landing. Each jump is a little smaller.', tags: ['jump'], weight: 2,
    apply: r => { r.jumps = 3; r.jumpVel *= 0.9; } },
  { id: 'walls', effect: 'boon', title: 'Spider', about: 'Jump off walls: touch one in mid-air and press jump.', tags: ['jump'], weight: 3,
    apply: r => { r.wallJump = true; } },
  { id: 'momentum', effect: 'bane', title: 'No Takebacks', about: 'Every jump is all or nothing: hold a direction to leap at full speed, or nothing to go straight up. No steering in the air.', tags: ['air'], weight: 2,
    apply: r => { r.airAccel = 0; r.committed = true; } },
  { id: 'dash', effect: 'boon', title: 'Blink', about: 'Press X to dash sideways, once per landing.', tags: ['dash'], weight: 3,
    apply: r => { r.dash = true; } },
  { id: 'superhot', effect: 'boon', title: 'Time Is Yours', about: 'Hazards and moving platforms only move while you move.', tags: ['time'], weight: 2, needs: 'timed',
    apply: r => { r.superhot = true; } },
  { id: 'wrap', effect: 'bane', title: 'Pac-Fall', about: 'Fall off the bottom of the screen and you come back in at the top.', tags: ['bounds', 'layout'], weight: 2,
    apply: r => { r.wrapY = true; } },
  { id: 'tiny', effect: 'bane', title: 'Ant', about: 'You are tiny. Jumps cover less ground.', tags: ['size'], weight: 2,
    apply: r => { r.size = 0.55; } },
  { id: 'giant', effect: 'bane', title: 'Colossus', about: 'You are huge. Mind your head in tight gaps.', tags: ['size', 'layout'], weight: 1,
    apply: r => { r.size = 1.5; } },
  { id: 'glide', effect: 'boon', title: 'Umbrella', about: 'Hold jump while falling to float down slowly.', tags: ['air'], weight: 2,
    apply: r => { r.glide = true; } },
  { id: 'dark', effect: 'bane', title: 'Lights Out', about: 'The biome is dark. Only the area around you is lit.', tags: ['vision'], weight: 2,
    apply: r => { r.darkness = true; } },
  { id: 'sprint', effect: 'bane', title: 'Caffeine', about: 'You run and steer much faster. Harder to control.', tags: ['speed'], weight: 2,
    apply: r => { r.moveSpeed = 6.5; r.groundAccel = 1.4; r.airAccel = 0.9; } },
  { id: 'rationed', effect: 'bane', title: 'Seven Jumps', about: 'You only get seven jumps in this biome.', tags: ['jump'], weight: 2,
    apply: r => { r.jumpBudget = 7; } },
  { id: 'slowair', effect: 'boon', title: 'Bullet Time', about: 'Everything else slows down while you are in the air.', tags: ['time'], weight: 2, needs: 'timed',
    apply: r => { r.slowAir = true; } },
  { id: 'blink', effect: 'boon', title: 'Teleport Hop', about: 'Jumping teleports you far upward, through platforms. Hold a direction to aim; the outline shows where you land.', tags: ['jump', 'gravdir'], weight: 2,
    apply: r => { r.blinkJump = true; } },
  { id: 'rubber', effect: 'bane', title: 'Rubber Walls', about: 'Running into a wall throws you back the other way.', tags: ['walls'], weight: 2,
    apply: r => { r.rubberWalls = true; } },
  { id: 'glass', effect: 'bane', title: 'Glass Bones', about: 'Falling too far hurts. When you glow red, you are falling too fast.', tags: ['landing', 'gravity'], weight: 2,
    apply: r => { r.fallDamage = true; } },
  { id: 'flood', effect: 'bane', title: 'The Flood', about: 'Once you start to climb, water rises from below. Keep going.', tags: ['bounds', 'layout', 'time'], weight: 2,
    apply: r => { r.flood = 0.33; } },
  { id: 'hyper', effect: 'bane', title: 'Overclocked', about: 'Everything on a timer runs at double speed.', tags: ['time'], weight: 1.5, needs: 'timed',
    apply: r => { r.clockRate = 2; } },
  { id: 'spare', effect: 'boon', perk: true, title: 'Spare Heart', about: 'One more life for as long as you wear it.', tags: [], weight: 2,
    apply: () => {} },
  { id: 'charm', effect: 'boon', perk: true, title: 'Lucky Charm', about: 'Every new biome, a fifty-fifty chance you start it with a shield.', tags: [], weight: 2,
    apply: () => {} },
  { id: 'torch', effect: 'boon', perk: true, title: 'Torch', about: 'In the dark, you see twice as far.', tags: [], weight: 2,
    apply: () => {} },
  { id: 'grip', effect: 'boon', title: 'Grip Boots', about: 'Floors never feel slippery, not even ice.', tags: [], weight: 2,
    apply: r => { r.friction = Math.min(r.friction, BASE_RULES.friction); r.groundAccel = Math.max(r.groundAccel, BASE_RULES.groundAccel); } },
  { id: 'flywheel', effect: 'boon', title: 'Flywheel', about: 'Run one way to charge up. A full charge makes you faster and your jumps higher. Stopping or turning loses it.', tags: ['speed', 'dash'], weight: 2.5,
    apply: r => { r.flywheel = true; } },
];

const BY_ID = new Map(MUTATORS.map(m => [m.id, m]));

export function mutatorById(id) {
  return BY_ID.get(id);
}

export const isBane = id => BY_ID.get(id).effect === 'bane';
export const isPerk = id => !!BY_ID.get(id).perk;
export const BOONS = MUTATORS.filter(m => m.effect === 'boon').map(m => m.id);

export const biomeKey = (index, entryCol, rules) => `${index}:${entryCol ?? ''}:${rules.join(',')}`;

export function compatible(chosen, candidate) {
  return chosen.every(m => !m.tags.some(tag => candidate.tags.includes(tag)));
}

const EXCLUDED_FROM_ROLLS = new Set(['ceiling', 'wrap', 'rationed']);
const RULES_SALT = 0x52554c45;

export function biomeRules(seedText, index) {
  if (index === 0) return [];
  const rng = new Rng(mix(mix(hashString(seedText), index * 7919 + 1), RULES_SALT));
  const difficulty = Math.min(1, index / 8);
  let count = 1;
  if (rng.chance(0.2 + 0.45 * difficulty)) count++;
  if (difficulty > 0.5 && rng.chance(0.35)) count++;
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const pool = MUTATORS.filter(m => m.effect === 'bane' && !EXCLUDED_FROM_ROLLS.has(m.id) && compatible(chosen, m));
    if (!pool.length) break;
    chosen.push(rng.weighted(pool, m => m.weight));
  }
  return chosen.map(m => m.id);
}

const FLOOD_EASE = 0.6;

export function playRules(mutatorIds) {
  const rules = buildRules(mutatorIds);
  if (rules.flood) rules.flood *= FLOOD_EASE;
  return rules;
}

export const withRules = (level, mutatorIds) => ({ ...level, rules: playRules(mutatorIds), mutators: mutatorIds });

export function buildRules(mutatorIds) {
  const rules = { ...BASE_RULES };
  for (const id of mutatorIds) BY_ID.get(id).apply(rules);
  return rules;
}

export function jumpProfile(rules) {
  const riseGravity = rules.gravity * rules.holdBoost;
  const height = (rules.jumpVel * rules.jumpVel) / (2 * riseGravity);
  const riseFrames = rules.jumpVel / riseGravity;
  const fallFrames = Math.sqrt((2 * height) / rules.gravity);
  const airFrames = riseFrames + fallFrames;
  return {
    height: height * (rules.jumps > 1 ? 1 + 0.75 * (rules.jumps - 1) : 1),
    reach: rules.moveSpeed * airFrames * (rules.jumps > 1 ? 1 + 0.6 * (rules.jumps - 1) : 1) + (rules.dash ? rules.dashSpeed * rules.dashFrames : 0),
    airFrames,
  };
}

export function chargedProfile(rules, charge = 1) {
  const boost = boostOf(charge);
  return jumpProfile({ ...rules, jumpVel: rules.jumpVel * (1 + JUMP_BONUS * boost), moveSpeed: rules.moveSpeed * (1 + SPEED_BONUS * boost) });
}
