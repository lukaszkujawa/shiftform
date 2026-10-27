export const BASE_RULES = Object.freeze({
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
  flipOnJump: false,
  flipPeriod: 0,
  baseGravDir: 1,
  dash: false,
  dashSpeed: 11,
  dashFrames: 8,
  wrapY: false,
  superhot: false,
  glide: false,
  size: 1,
  darkness: false,
  strobe: false,
  jumpBudget: 0,
  slowAir: false,
  blinkJump: false,
  rubberWalls: false,
  fallDamage: false,
  flood: 0,
  clockRate: 1,
});

export const MUTATORS = [
  { id: 'moon', title: 'Moon Shoes', hint: 'Gravity is weak. Float.', tags: ['gravity'], weight: 3,
    apply: r => { r.gravity = 0.2; r.jumpVel = 5.2; r.maxFall = 7; } },
  { id: 'heavy', title: 'Lead Boots', hint: 'Gravity is brutal. Commit.', tags: ['gravity'], weight: 2,
    apply: r => { r.gravity = 1.15; r.jumpVel = 12.3; r.maxFall = 20; } },
  { id: 'ceiling', title: 'Upside Down', hint: 'The ceiling is your floor.', tags: ['gravdir', 'layout'], weight: 2,
    apply: r => { r.baseGravDir = -1; } },
  { id: 'flipjump', title: 'Every Jump Flips', hint: 'Jumping turns gravity over.', tags: ['gravdir', 'jump', 'layout'], weight: 3,
    apply: r => { r.flipOnJump = true; r.jumpVel *= 0.55; } },
  { id: 'tide', title: 'The Tide', hint: 'Gravity turns over on the clock.', tags: ['gravdir', 'layout', 'timed'], weight: 2,
    apply: r => { r.flipPeriod = 120; } },
  { id: 'bouncy', title: 'Trampoline World', hint: 'Landing is temporary.', tags: ['landing'], weight: 2,
    apply: r => { r.bounce = 0.72; } },
  { id: 'ice', title: 'Black Ice', hint: 'Nothing stops.', tags: ['ground'], weight: 2,
    apply: r => { r.friction = 0.985; r.groundAccel = 0.22; } },
  { id: 'mirror', title: 'Mirror Hands', hint: 'Left is right.', tags: ['input'], weight: 2,
    apply: r => { r.mirror = true; } },
  { id: 'double', title: 'Second Wind', hint: 'Jump again in the air.', tags: ['jump'], weight: 3,
    apply: r => { r.jumps = 2; } },
  { id: 'triple', title: 'Hummingbird', hint: 'Three jumps. Small ones.', tags: ['jump'], weight: 2,
    apply: r => { r.jumps = 3; r.jumpVel *= 0.78; } },
  { id: 'walls', title: 'Spider', hint: 'Walls are launch pads.', tags: ['jump'], weight: 3,
    apply: r => { r.wallJump = true; } },
  { id: 'momentum', title: 'No Takebacks', hint: 'You cannot steer in the air.', tags: ['air'], weight: 2,
    apply: r => { r.airAccel = 0; } },
  { id: 'dash', title: 'Blink', hint: 'X to dash. Once per landing.', tags: ['dash'], weight: 3,
    apply: r => { r.dash = true; } },
  { id: 'superhot', title: 'Time Is Yours', hint: 'The world only moves when you do.', tags: ['time'], weight: 2, needs: 'timed',
    apply: r => { r.superhot = true; } },
  { id: 'wrap', title: 'Pac-Fall', hint: 'Fall off the bottom, arrive at the top.', tags: ['bounds', 'layout'], weight: 2,
    apply: r => { r.wrapY = true; } },
  { id: 'tiny', title: 'Ant', hint: 'You are small. Gaps are not.', tags: ['size'], weight: 2,
    apply: r => { r.size = 0.55; } },
  { id: 'giant', title: 'Colossus', hint: 'You are huge. Mind your head.', tags: ['size', 'layout'], weight: 1,
    apply: r => { r.size = 1.5; } },
  { id: 'glide', title: 'Umbrella', hint: 'Hold jump to fall slowly.', tags: ['air'], weight: 2,
    apply: r => { r.glide = true; } },
  { id: 'dark', title: 'Lights Out', hint: 'You carry the only light.', tags: ['vision'], weight: 2,
    apply: r => { r.darkness = true; } },
  { id: 'strobe', title: 'Strobe', hint: 'The world blinks. Remember it.', tags: ['vision'], weight: 1,
    apply: r => { r.strobe = true; } },
  { id: 'sprint', title: 'Caffeine', hint: 'Everything is faster.', tags: ['speed'], weight: 2,
    apply: r => { r.moveSpeed = 6.5; r.groundAccel = 1.4; r.airAccel = 0.9; } },
  { id: 'rationed', title: 'Seven Jumps', hint: 'You get seven. Spend them well.', tags: ['jump'], weight: 2,
    apply: r => { r.jumpBudget = 7; } },
  { id: 'slowair', title: 'Bullet Time', hint: 'The world slows while you are airborne.', tags: ['time'], weight: 2, needs: 'timed',
    apply: r => { r.slowAir = true; } },
  { id: 'blink', title: 'Teleport Hop', hint: 'Jumping moves you up instantly. No arc.', tags: ['jump', 'gravdir'], weight: 2,
    apply: r => { r.blinkJump = true; } },
  { id: 'rubber', title: 'Rubber Walls', hint: 'Walls throw you back.', tags: ['walls'], weight: 2,
    apply: r => { r.rubberWalls = true; } },
  { id: 'glass', title: 'Glass Bones', hint: 'Fall too far and you shatter.', tags: ['landing', 'gravity'], weight: 2,
    apply: r => { r.fallDamage = true; } },
  { id: 'flood', title: 'The Flood', hint: 'The water is rising. Hurry.', tags: ['bounds', 'layout', 'time'], weight: 2,
    apply: r => { r.flood = 0.55; } },
  { id: 'hyper', title: 'Overclocked', hint: 'Everything on a timer runs double speed.', tags: ['time'], weight: 1.5, needs: 'timed',
    apply: r => { r.clockRate = 2; } },
];

const BY_ID = new Map(MUTATORS.map(m => [m.id, m]));

export function mutatorById(id) {
  return BY_ID.get(id);
}

export function compatible(chosen, candidate) {
  return chosen.every(m => !m.tags.some(tag => candidate.tags.includes(tag)));
}

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
