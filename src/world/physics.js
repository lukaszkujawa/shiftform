import { TILE, COLS, WIDTH, SPRING_VEL, BUMPER_VEL, ONE_WAY, tileAt, levelIndex, nearbyTriggers, phaseOn, crushed, objectRect, isSolidObject, overlaps, floodLevel, slain, erased, playerSize } from './level.js';
import { blockedBy, resolveX, resolveY } from './collision.js';
import { tether, reel, followGrip, grabHook } from './rope.js';
import { flyArrows } from './arrows.js';
import { CHARGE_FRAMES, SPEED_BONUS, JUMP_BONUS, boostOf } from './rules.js';
import { advanceLurkers, lurkerOf, bodyOf, strikesOf, dangersOf, stompable, slayLurker } from './lurkers.js';
import { mix } from './rng.js';
import { PUSH_STRENGTH, DASH_STRENGTH, massOf, initialBodies, cloneBodies, bodyRects, stepBodies, pushBodies, carryFrom, carryHeld, lift, release, laserBeam, pressedPlates } from './bodies.js';

const COYOTE_FRAMES = 6;
const ROPE_PUMP = 0.17;
const RUNNING = 0.5;
const JET_STEER = 0.45;
const REVERSE_BRAKE = 3.4;
const AIR_BUILD = 0.75;
const AIR_BRAKE = 1.5;
const AIR_COAST = 0.97;
const AIR_NUDGE_FADE = 0.85;
const NUDGE_SHARE = 0.5;
const LANDING_FRAMES = 10;
const STOP_GRIP = 0.77;
const TURN_COMMIT_FRAMES = 6;
const ICE_FRICTION = 0.9;
const START_GRIP = 0.5;
const PUSH_LEAN = 1.9;
export const TURN_WINDOW = 15;
const START_BAND = 0.6;
const HURT_INSET = 2;
const FLOOD_WAKE = TILE;
const JUMP_BUFFER_FRAMES = 8;
const STOMP_GRACE = 8;
const COMET_STEP = 1.35;
const COMET_MAX = 6;
const COMET_WINDOW = 8;
const COMET_MIN_WINDOW = 4;
const EARLY_LOOKBACK = 30;
export const NO_COMET = { comet: 0, cometWait: 0, cometMissed: false, cometEarly: false, cometPressAt: -1e9, cometBounces: 0 };
const STOMP_BOUNCE = 0.8;
const WALL_SLIDE_SPEED = 2.2;
const NEVER_FLIPPED = -100;
const WATER_GRAVITY = 0.35;
const WATER_DRAG = 0.93;
const WATER_JUMP = 0.65;
const SURFACE_POP = 3.9;
const STROKE_SPEED_LIMIT = 1.2;
export const AIMS = 16;
const BLINK = { range: 126, step: 12 };
export const FALL_DAMAGE_SPEED = 13;
export const CRUMBLE_RESPAWN = 180;
export { JETPACK_FUEL, ARROWS } from './rules.js';
export { playerSize } from './level.js';
export { GRIP_HANG, hookAnchor } from './rope.js';
export { shoot } from './arrows.js';
export const BOOT_JUMPS = 5;
const JET_THRUST = 0.9 / 0.55;
const JET_SPEED = 6;
const SHIELD_FRAMES = 60;
export const SHIELD_RECHARGE = 420;
const KICK_PUSH = 1.2;
export const LONG_JUMP_RANGE = 1.25;
const KICK_LIFT = 0.9;
const LEGS = 0.45;
const LEDGE_ASSIST = 8;
const CHARGE_SPEED = 0.95;
const CORNER_SLIP = 6;
const EDGE_CATCH_SPEED = 0.6;
const EDGE_FOOT_INSET = 0.45;
const SLIPPERY_FRICTION = 0.9;
const CLIMB_SPEED = 3;
const CLIMB_SNAP = 0.5;
const CLIMB_GRIP = 2;
const JUMP_CUT = 3;
const TRAMPOLINE_ROWS = 5;
const COAST = 0.995;
export const CANNON_SWEEP = 96;
const CANNON_FUSE = 18;
const placedSolids = placed => placed.filter(p => p.kind !== 'ladder');

export function initialState(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    gravDir: level.rules.baseGravDir,
    grounded: false,
    groundId: -1,
    coyote: 0,
    jumpsLeft: 0,
    dashLeft: 1,
    teleports: level.rules.teleports,
    dashTimer: 0,
    dashDir: 1,
    bumpX: 0,
    bumpY: 0,
    longJump: false,
    jumpHeld: false,
    jumpBuffer: 0,
    cuttable: false,
    dashHeld: false,
    interactHeld: false,
    inPortal: false,
    flags: 0,
    pressed: 0,
    crushed: 0,
    crumbled: levelIndex(level).crumbles.map(() => 0),
    taken: 0,
    slain: 0,
    lurkers: [],
    coins: 0,
    placed: [],
    erased: [],
    ...NO_COMET,
    fuel: 0,
    boots: 0,
    arrows: 0,
    flying: [],
    shield: false,
    shieldsLost: 0,
    shieldsBack: 0,
    jetting: false,
    invuln: 0,
    lastKick: 0,
    wallSide: 0,
    wallKicks: 0,
    spent: 0,
    armed: -1,
    teeter: 0,
    timers: levelIndex(level).timers.map(() => -1),
    flipFrame: NEVER_FLIPPED,
    flipLeft: 0,
    flippedRows: [],
    jumpsUsed: 0,
    clock: 0,
    tide: -1,
    pushing: false,
    runDir: 0,
    ran: TURN_WINDOW + 1,
    landedAt: -LANDING_FRAMES,
    heldDir: 0,
    heldFor: 0,
    frame: 0,
    dead: false,
    won: false,
    facing: 1,
    bodies: initialBodies(level),
    held: -1,
    rope: -1,
    ropeLen: 0,
    climbing: false,
    charge: 0,
    chargeDir: 0,
    barrel: -1,
    barrelAge: 0,
    inBarrel: false,
    flung: false,
  };
}

const atLadderTop = (s, ladder, ph) => s.y + ph <= ladder.y + CLIMB_GRIP + 0.5;

function leavesClimb(s, input, dir, jumpPressed, ladder, ph) {
  return (jumpPressed && !input.up) || (dir !== 0 && (atLadderTop(s, ladder, ph) || (!input.up && !input.down)));
}

function approach(value, target, rate) {
  if (Math.abs(target - value) <= rate) return target;
  return value + Math.sign(target - value) * rate;
}

const APPEARING = new Set(['phase', 'gate', 'door', 'toggle']);

function activeRects(level, prev, clock) {
  const rects = placedSolids(prev.placed);
  const { w, h } = playerSize(level.rules), box = collisionBox(level, prev, prev.gravDir, w, h);
  for (const object of levelIndex(level).dynamic) {
    if (!isSolidObject(object, prev, clock)) continue;
    const rect = objectRect(object, clock);
    if (!APPEARING.has(object.type) || !overlaps(prev.x + box.dx, prev.y + box.dy, box.w, box.h, rect)) rects.push(rect);
  }
  return rects;
}

function deadlyAt(level, s, x, y, w, h) {
  const clock = s.clock;
  for (const o of levelIndex(level).triggers) {
    if (erased(s, o)) continue;
    let zone = null;
    if (o.type === 'spikes' || o.type === 'saw') zone = objectRect(o, clock);
    else if (o.type === 'monster' && !slain(s, o)) zone = objectRect(o, clock);
    else if (o.type === 'shot' && !slain(s, level.objects[o.source])) zone = objectRect(o, clock);
    else if (o.type === 'laser' && phaseOn(o, clock)) zone = laserBeam(level, o, s.bodies);
    if (zone && overlaps(x, y, w, h, zone)) return true;
  }
  return levelIndex(level).lurkers.some(o => !erased(s, o) && dangersOf(o, lurkerOf(o, s)).some(zone => overlaps(x, y, w, h, zone)));
}

export const aimOf = (dx, dy) => (Math.round(Math.atan2(dy, dx) / (2 * Math.PI / AIMS)) + AIMS) % AIMS;

export function blinkDestination(level, s, aim, solids = activeRects(level, s, s.clock).concat(bodyRects(level, s.bodies, k => k === s.held))) {
  const { w: pw, h: ph } = playerSize(level.rules);
  const box = collisionBox(level, s, s.gravDir, pw, ph), angle = (aim * 2 * Math.PI) / AIMS;
  const inside = (x, y) => x + box.dx >= 0 && x + box.dx + box.w <= WIDTH && y + box.dy >= 0 && y + box.dy + box.h <= level.height;
  const free = (x, y) => inside(x, y) && !blockedBy(level, x + box.dx, y + box.dy, box.w, box.h, solids) && !deadlyAt(level, s, x + box.dx, y + box.dy, box.w, box.h);
  for (let d = BLINK.range; d >= BLINK.step; d -= BLINK.step) {
    const x = s.x + Math.cos(angle) * d, y = s.y + Math.sin(angle) * d;
    if (free(x, y)) return { x, y };
  }
  return null;
}

function teleport(level, s, n, aim, solids) {
  const to = blinkDestination(level, s, aim, solids);
  if (!to) return;
  Object.assign(n, { x: to.x, y: to.y, vx: 0, vy: 0, rope: -1, coyote: 0, teleports: s.teleports - 1, flipFrame: n.frame });
  airborne(n);
}

function collisionBox(level, s, g, pw, ph) {
  if (s.held < 0) return { dx: 0, dy: 0, w: pw, h: ph };
  const crate = levelIndex(level).crates[s.held];
  const w = Math.max(pw, crate.w);
  return { dx: (pw - w) / 2, dy: g > 0 ? -crate.h : 0, w, h: ph + crate.h };
}

export const cannonAim = (cannon, age) => cannon.angle + cannon.arc * Math.sin((age / CANNON_SWEEP) * Math.PI * 2);

function pullLever(level, n, pw, ph) {
  const lever = levelIndex(level).levers.find(o => overlaps(n.x, n.y, pw, ph, o));
  if (lever) n.flags ^= lever.bit;
  return !!lever;
}

function interact(level, n, pw, ph, dir, rects) {
  if (n.held >= 0) release(level, n, dir, pw, ph, rects);
  else if (n.rope >= 0) { n.flung = true; n.rope = -1; }
  else if (!pullLever(level, n, pw, ph) && !grabHook(level, n, pw, ph, n.grounded)) lift(level, n, pw, ph, rects);
}

function tickCrumbles(level, s, n, pw, ph) {
  const crumbles = levelIndex(level).crumbles;
  if (!crumbles.length) return s.crumbled;
  return crumbles.map((o, k) => {
    if (s.groundId === o.id && n.groundId !== o.id) return CRUMBLE_RESPAWN;
    const left = s.crumbled[k];
    if (left > 1) return left - 1;
    return left === 1 && overlaps(n.x, n.y, pw, ph, o) ? 1 : 0;
  });
}

function stomps(s, before, ph, g) {
  return g > 0 ? s.y + ph <= before.y + STOMP_GRACE : s.y >= before.y + before.h - STOMP_GRACE;
}

function stomp(n, monster, r, g) {
  n.slain |= 1 << monster.slot;
  bounceOff(n, r, g);
}

function bounceOff(n, r, g) {
  if (n.comet) { cometPerfect(n, r, g); n.cometMissed = false; return; }
  n.vy = -r.jumpVel * STOMP_BOUNCE * g;
  n.jumpsLeft = r.jumps;
  airborne(n);
}

export const shieldsUp = (r, s) => (s.frame < s.shieldsBack ? 0 : Math.max(0, r.shields - s.shieldsLost));

function hurt(n, r, g) {
  if (n.invuln > 0) return false;
  if (shieldsUp(r, n) > 0) Object.assign(n, { shieldsLost: n.shieldsLost + 1, shieldsBack: n.frame + SHIELD_RECHARGE });
  else if (n.shield) n.shield = false;
  else {
    n.dead = true;
    return true;
  }
  n.invuln = SHIELD_FRAMES;
  n.vy = -r.jumpVel * g;
  airborne(n);
  return false;
}

export function grant(n, kind, rules) {
  if (kind === 'jetpack') n.fuel = Math.max(n.fuel, rules.jetFuel);
  if (kind === 'boots') n.boots += BOOT_JUMPS;
  if (kind === 'shield') n.shield = true;
  if (kind === 'bow') n.arrows += rules.quiver;
  if (kind === 'comet') Object.assign(n, NO_COMET, { comet: 1 });
  return n;
}

function collect(n, item, rules) {
  n.taken |= 1 << item.slot;
  grant(n, item.kind, rules);
}

export const cometWindow = combo => Math.max(COMET_MIN_WINDOW, COMET_WINDOW - (combo - 1));
export function cometLift(combo) {
  let lift = 1;
  for (let k = 1; k < combo && lift < COMET_MAX; k++) lift *= COMET_STEP;
  return Math.min(COMET_MAX, lift);
}
const cometSpeed = (r, combo) => r.jumpVel * Math.sqrt(cometLift(combo));

function cometPerfect(n, r, g) {
  n.comet += 1;
  n.cometWait = 0;
  n.cometEarly = false;
  n.jumpBuffer = 0;
  n.vy = -cometSpeed(r, n.comet) * g;
}

function cometTiming(s, n) {
  if (s.cometWait <= 0) return;
  n.cometWait = s.cometWait - 1;
  if (n.cometWait === 0) n.cometMissed = s.cometBounces > 1;
}

function cometLand(n, r, g) {
  if (n.cometMissed) {
    n.comet = 0;
    return false;
  }
  n.cometBounces += 1;
  airborne(n);
  refill(n, r);
  if (n.jumpBuffer > Math.max(0, JUMP_BUFFER_FRAMES - cometWindow(n.comet))) cometPerfect(n, r, g);
  else {
    n.cometEarly = n.frame - n.cometPressAt < EARLY_LOOKBACK;
    n.cometWait = cometWindow(n.comet);
    n.vy = -cometSpeed(r, n.comet) * g;
  }
  return true;
}

function updateCharge(r, s, n, dir) {
  if (!r.flywheel) return;
  const fast = Math.abs(s.vx) >= r.moveSpeed * CHARGE_SPEED;
  const moving = fast ? Math.sign(s.vx) : 0;
  if ((dir !== 0 && dir === -s.chargeDir) || (s.grounded && !fast)) loseCharge(n);
  else if (dir !== 0 && dir === moving) {
    n.chargeDir = dir;
    n.charge = Math.min(1, s.charge + 1 / CHARGE_FRAMES);
  }
}

function loseCharge(n) {
  n.charge = 0;
  n.chargeDir = 0;
}

function airborne(n) {
  n.grounded = false;
  n.groundId = -1;
}

export const airJumps = r => r.jumps - 1;

function refill(n, r, jumps = airJumps(r)) {
  n.jumpsLeft = jumps;
  n.dashLeft = 1;
  n.spent = 0;
  n.armed = -1;
}

function launch(n, r) {
  n.cuttable = false;
  refill(n, r, r.jumps);
  airborne(n);
}

function readButtons(r, s, n, input, jumpPressed) {
  n.jumpHeld = !!input.jump;
  n.jumpBuffer = jumpPressed ? JUMP_BUFFER_FRAMES : Math.max(0, s.jumpBuffer - 1);
  n.invuln = Math.max(0, s.invuln - 1);
  if (s.comet && jumpPressed) n.cometPressAt = n.frame;
  if (s.comet && s.cometWait > 0 && jumpPressed) cometPerfect(n, r, s.gravDir);
  else cometTiming(s, n);
  n.dashHeld = !!input.dash;
  n.interactHeld = !!input.interact;
}

function riseFlood(level, s, n, ph) {
  const climbing = s.tide >= 0 || ((s.grounded || s.climbing) && s.y + ph <= (level.rows - 1) * TILE - FLOOD_WAKE);
  if (climbing) n.tide = Math.max(0, s.tide) + n.clock - s.clock;
}

function tickClock(r, s, n, dir, input) {
  const active = dir !== 0 || !!input.jump || !!input.dash || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || !s.grounded || s.dashTimer > 0;
  const slowed = r.slowAir && !s.grounded && s.frame % 2 === 1;
  if ((!r.superhot || active) && !slowed) n.clock = s.clock + r.clockRate;
  if (s.flipLeft > 0) {
    n.flipLeft = s.flipLeft - 1;
    if (n.flipLeft === 0) turnGravity(n);
  }
}

const roll = s => mix(s.clock * 2 + 1, Math.round(s.x) * 4099 + Math.round(s.y)) / 4294967296;

function turnGravity(n) {
  n.gravDir = -n.gravDir;
  n.flipFrame = n.frame;
}

function flipFor(n, r) {
  turnGravity(n);
  n.flipLeft = r.flipFrames;
}

function flipOncePerRow(s, n, r) {
  const row = Math.round((s.gravDir > 0 ? s.y + playerSize(r).h : s.y) / TILE);
  if (s.flippedRows.includes(row)) return;
  n.flippedRows = [...s.flippedRows, row];
  flipFor(n, r);
}

const withBodies = (level, rects, n) => n.bodies.length ? rects.concat(bodyRects(level, n.bodies, k => k === n.held)) : rects;

function climbing(s, n, input, dir, jumpPressed, ladder, pw, ph) {
  const steppingOff = !!ladder && dir !== 0 && atLadderTop(s, ladder, ph);
  if (steppingOff && s.climbing) n.y = ladder.y - ph;
  return !!ladder && !steppingOff && !s.comet && s.dashTimer === 0 && s.rope < 0 && s.held < 0 && (s.climbing ? !leavesClimb(s, input, dir, jumpPressed, ladder, ph) : !!input.up || (!!input.down && !s.grounded));
}

function climb(r, s, n, input, dir, ladder, pw, ph) {
  n.vx = 0;
  n.vy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * CLIMB_SPEED;
  if (s.y + n.vy + ph < ladder.y + CLIMB_GRIP) n.vy = ladder.y + CLIMB_GRIP - ph - s.y;
  n.x = s.x + (ladder.x + ladder.w / 2 - s.x - pw / 2) * CLIMB_SNAP;
  refill(n, r);
  n.jumpBuffer = 0;
  n.jetting = false;
  if (dir !== 0) n.facing = dir;
}

function rideCannon(level, s, n, jumpPressed) {
  const cannon = level.objects[s.barrel], { w, h } = playerSize(level.rules);
  n.x = cannon.x + cannon.w / 2 - w / 2;
  n.y = cannon.y + cannon.h / 2 - h / 2;
  n.vx = 0;
  n.vy = 0;
  n.barrelAge = s.barrelAge + 1;
  if (!jumpPressed && !(cannon.auto && n.barrelAge >= CANNON_FUSE)) return;
  const aim = cannonAim(cannon, n.barrelAge);
  n.vx = Math.cos(aim) * cannon.vel;
  n.vy = Math.sin(aim) * cannon.vel;
  n.barrel = -1;
  n.flung = true;
  n.jumpBuffer = 0;
  n.cuttable = false;
  refill(n, level.rules);
}

function keepDashing(r, s, n, input, dir) {
  n.dashTimer = input.dash ? s.dashTimer - 1 : 0;
  n.vx = n.dashTimer > 0 ? s.dashDir * r.dashSpeed : dir === s.dashDir ? s.dashDir * r.moveSpeed : 0;
  n.vy = 0;
}

function startDash(r, s, n, dir) {
  n.longJump = false;
  n.dashTimer = r.dashFrames;
  n.dashLeft = s.dashLeft - 1;
  n.dashDir = dir || s.facing;
  n.facing = n.dashDir;
  n.vx = n.dashDir * r.dashSpeed;
  n.vy = 0;
}

function groundSteer(r, s, dir, committed, settling) {
  const slow = Math.abs(s.vx) < r.moveSpeed * START_BAND;
  if (s.vx * dir < 0 || (slow && dir === -s.runDir && s.ran <= TURN_WINDOW && !settling && committed)) return REVERSE_BRAKE;
  if (s.pushing) return PUSH_LEAN;
  return slow ? START_GRIP : 1;
}

function steer(r, s, n, dir, load, boost, wind, water) {
  const reversing = s.grounded && s.vx * dir < 0;
  const slow = Math.abs(s.vx) < r.moveSpeed * START_BAND;
  const settling = s.grounded && s.frame - s.landedAt < LANDING_FRAMES && r.friction < ICE_FRICTION;
  n.heldFor = dir !== 0 && dir === s.heldDir ? s.heldFor + 1 : 1;
  n.heldDir = dir;
  const committed = n.heldFor >= TURN_COMMIT_FRAMES;
  const steeringInAir = !s.grounded && !s.climbing && !s.jetting && !water && !s.lastKick && !s.wallKicks;
  const grip = s.climbing ? Infinity : s.grounded ? r.groundAccel : s.jetting ? Math.max(r.airAccel, JET_STEER) : r.airAccel;
  const airShare = !steeringInAir ? 1 : s.vx * dir < 0 ? AIR_BRAKE : AIR_BUILD;
  const accel = grip * (s.grounded ? groundSteer(r, s, dir, committed, settling) : airShare * (s.pushing ? PUSH_LEAN : 1));
  const speed = r.moveSpeed * Math.min(1, 1.4 / Math.max(1, load)) * (1 + SPEED_BONUS * boost) * (s.longJump ? LONG_JUMP_RANGE : 1);
  const coasting = s.flung && s.vx * dir > 0 && Math.abs(s.vx) > speed;
  if (s.rope >= 0 && !s.grounded) {
    n.vx = s.vx + dir * ROPE_PUMP;
    if (dir !== 0) n.facing = dir;
  } else if (dir !== 0) {
    n.vx = coasting ? s.vx * COAST : approach(s.vx, dir * speed, accel);
    if (reversing && !committed && n.vx * s.vx < 0) n.vx = 0;
    n.facing = dir;
  } else if (s.grounded) {
    n.vx = s.vx * r.friction * (settling || (slow && r.friction < ICE_FRICTION) ? STOP_GRIP : 1);
  } else if (steeringInAir && r.airAccel > 0 && !s.flung && Math.abs(s.vx) <= speed) {
    n.vx = s.vx * (Math.abs(s.vx) > speed * NUDGE_SHARE ? AIR_COAST : AIR_NUDGE_FADE);
  }
  if (wind) { n.vx += wind.ax; n.vy += wind.ay; }
}

function surface(level, r, n, pw, ph) {
  const rising = -n.vy * n.gravDir;
  if (rising <= 0 || rising > r.jumpVel * STROKE_SPEED_LIMIT || n.jetting || n.rope >= 0 || levelIndex(level).water.some(o => overlaps(n.x, n.y, pw, ph, o))) return;
  n.vy = -Math.min(rising, SURFACE_POP) * n.gravDir;
  n.jumpsLeft = 0;
}

function trackRun(r, s, n) {
  const running = n.grounded && Math.abs(n.vx) >= r.moveSpeed * START_BAND;
  n.ran = running ? 0 : s.ran + 1;
  if (n.grounded && !s.grounded) n.landedAt = n.frame;
  if (running) n.runDir = Math.sign(n.vx);
}

function leap(r, s, n, boost, water, kicked, fade) {
  const g = n.gravDir;
  n.jumpsUsed = s.jumpsUsed + 1;
  n.jumpBuffer = 0;
  airborne(n);
  n.rope = -1;
  n.cuttable = true;
  n.vy = -r.jumpVel * (1 + JUMP_BONUS * boost) * (water ? WATER_JUMP : 1) * (kicked ? KICK_LIFT : 1) * fade * g;
  if (r.jumpFlipChance && !kicked && !s.flipLeft && Math.abs(s.vx) > RUNNING && roll(s) < r.jumpFlipChance) flipOncePerRow(s, n, r);
}

const wallsOf = (s, solids) => (s.placed.length ? solids.filter(rect => !rect.oneWay) : solids);

function jump(level, s, n, { dir, box, wall, fresh, solids, load, boost, water, longJump }) {
  const r = level.rules, walls = wallsOf(s, solids);
  const legsH = box.h * LEGS;
  const legsAt = offset => blockedBy(level, s.x + box.dx + offset, n.gravDir > 0 ? s.y + box.dy + box.h - legsH : s.y + box.dy, box.w, legsH, walls);
  let kicked = false;
  let fade = 1;
  const side = fresh || wall !== 0 || water ? 0 : legsAt(1) ? 1 : legsAt(-1) ? -1 : 0;
  const kick = side !== s.lastKick ? side : 0;
  if (!fresh && wall === 0 && kick === 0 && s.jumpsLeft <= 0 && s.boots <= 0) {
    if (s.fuel > 0) n.jetting = true;
    return;
  }
  if ((r.jumpBudget && s.jumpsUsed >= r.jumpBudget) || load > 1) return;
  if (!fresh && wall !== 0) {
    n.vx = -wall * r.moveSpeed * 1.15;
    n.facing = -wall;
    n.wallSide = wall;
    n.wallKicks = (wall === s.wallSide ? s.wallKicks : 0) + 1;
  } else if (!fresh && kick !== 0) {
    n.vx = -kick * r.moveSpeed * KICK_PUSH;
    n.facing = -kick;
    n.lastKick = kick;
    n.flipFrame = n.frame;
    kicked = true;
  } else if (!fresh && s.jumpsLeft > 0) {
    n.jumpsLeft = s.jumpsLeft - 1;
    fade = r.airFade ** Math.max(1, airJumps(r) - s.jumpsLeft + 1);
    if (s.armed >= 0) {
      n.spent |= 1 << s.armed;
      n.armed = -1;
    }
    n.flipFrame = n.frame;
  } else if (!fresh) {
    n.boots = s.boots - 1;
    n.flipFrame = n.frame;
  }
  const gripped = s.rope >= 0 && level.objects[s.rope].grip;
  if (r.committed && wall === 0 && !kicked && !gripped) n.vx = dir * r.moveSpeed * (1 + SPEED_BONUS * boost);
  if (fresh || wall !== 0) n.jumpsLeft = airJumps(r);
  else if (kicked) n.jumpsLeft = s.jumpsLeft;
  n.longJump = fresh && !!longJump;
  if (n.longJump) n.vx *= LONG_JUMP_RANGE;
  leap(r, s, n, boost, water, kicked, fade);
  if (s.rope >= 0) {
    n.vy += Math.min(0, s.vy);
    n.flung = true;
  }
}

function fall(r, s, n, input, jumpPressed, wall, water) {
  const g = n.gravDir;
  if (n.cuttable && !input.jump) {
    n.cuttable = false;
    if (n.vy * g < -JUMP_CUT) n.vy = -JUMP_CUT * g;
  }
  if (n.vy * g >= 0) n.cuttable = false;
  let gravity = r.gravity * (water ? WATER_GRAVITY : 1);
  if (n.vy * g < 0 && (input.jump || n.comet) && !water) gravity *= r.holdBoost;
  n.vy += gravity * g;
  if (water) { n.vx *= WATER_DRAG; n.vy *= WATER_DRAG; }

  let maxFall = r.maxFall;
  if (r.glide && input.jump && n.vy * g > 0) maxFall = r.glideSpeed;
  if (wall !== 0 && n.vy * g > 0) maxFall = WALL_SLIDE_SPEED;
  if (n.vy * g > maxFall) n.vy = maxFall * g;
  if (input.jump && !s.grounded && s.jumpsLeft <= 0 && s.fuel > 0 && n.vy * g > 0 && wall === 0) n.jetting = true;
  n.jetting = n.jetting && !!input.jump && s.fuel > 0 && !(s.grounded && !jumpPressed);
  if (n.jetting) {
    n.vy = Math.max(n.vy * g - r.gravity * JET_THRUST, -JET_SPEED) * g;
    n.fuel = s.fuel - 1;
  }
}

function walk(level, s, n, input, { dir, jumpPressed, solids, load, water, wind, pw, ph }) {
  const r = level.rules;
  updateCharge(r, s, n, dir);
  const boost = r.flywheel ? boostOf(n.charge) * r.chargePower : 0;
  steer(r, s, n, dir, load, boost, wind, water);

  const box = collisionBox(level, s, n.gravDir, pw, ph);
  const wallAt = offset => {
    const x = s.x + box.dx + offset;
    return x >= 0 && x + box.w <= WIDTH && blockedBy(level, x, s.y + box.dy, box.w, box.h, wallsOf(s, solids));
  };
  const clinging = !s.grounded && levelIndex(level).clings.some(o => overlaps(s.x - 1, s.y, pw + 2, ph, o));
  const touching = !s.grounded ? (wallAt(1) ? 1 : wallAt(-1) ? -1 : 0) : 0;
  const kicksLeft = !r.wallKicks || touching !== s.wallSide || s.wallKicks < r.wallKicks;
  const wall = clinging || (r.wallJump && kicksLeft) ? touching : 0;
  const fresh = s.grounded || s.coyote > 0 || s.rope >= 0 || s.climbing;
  if (!s.comet && (jumpPressed || (fresh && s.jumpBuffer > 0))) jump(level, s, n, { dir, box, wall, fresh, solids, load, boost, water, longJump: input.longJump });
  fall(r, s, n, input, jumpPressed, wall, water);
}

function assistLedge(level, n, body, box, wantX, g, solids) {
  for (let k = 1; k <= LEDGE_ASSIST; k++) {
    if (blockedBy(level, wantX, body.y - k * g, box.w, box.h, solids)) continue;
    body.x = wantX;
    body.y -= k * g;
    n.y = body.y - box.dy;
    return true;
  }
  return false;
}

function moveX(level, r, n, box, body, dx, solids, rects, g, ghost) {
  const strength = n.dashTimer > 0 ? DASH_STRENGTH : PUSH_STRENGTH;
  const pushed = !ghost && dx !== 0 && n.bodies.length ? pushBodies(level, n, { ...body, w: box.w, h: box.h }, dx, strength, rects) : 0;
  if (pushed) solids = withBodies(level, rects, n);
  const wantX = body.x;
  let wallHit = resolveX(level, body, box.w, box.h, dx, ghost ? [] : solids, ghost);
  if (wallHit !== 0 && !pushed && assistLedge(level, n, body, box, wantX, g, solids)) wallHit = 0;
  n.x = body.x - box.dx;
  n.pushing = pushed !== 0;
  if (pushed) n.vx = pushed;
  else if (wallHit !== 0 && Math.sign(n.vx) === wallHit) { n.bumpX = n.vx; n.vx = r.rubberWalls ? -n.vx * 0.9 : 0; n.dashTimer = 0; n.longJump = false; loseCharge(n); }
  const minX = -box.dx, maxX = COLS * TILE - box.w - box.dx;
  if (n.x < minX) { n.x = minX; if (n.vx < 0) { n.bumpX = n.vx; n.vx = 0; loseCharge(n); } }
  if (n.x > maxX) { n.x = maxX; if (n.vx > 0) { n.bumpX = n.vx; n.vx = 0; loseCharge(n); } }
  return solids;
}

function footing(level, x, y, box, solids, g) {
  const inset = box.w * EDGE_FOOT_INSET, left = x + box.dx + inset, w = box.w - 2 * inset, footY = g > 0 ? y + box.dy + box.h : y + box.dy - 1;
  if (blockedBy(level, left, footY, w, 1, solids)) return true;
  if (g < 0) return false;
  const row = Math.floor(footY / TILE);
  for (let c = Math.floor(left / TILE); c <= Math.floor((left + w - 0.001) / TILE); c++) if (tileAt(level, c, row) === ONE_WAY) return true;
  return false;
}

function scrambleBack(level, s, n, box, solids, g) {
  for (let k = 1; k <= box.w / 2; k++) {
    for (const side of [-1, 1]) {
      if (!footing(level, n.x + side * k, n.y, box, solids, g)) continue;
      n.x += side * k;
      n.vx = 0;
      n.teeter = -side;
      return;
    }
  }
}

function catchEdge(level, r, s, n, dir, jumpPressed, box, solids, g) {
  if (!s.grounded || jumpPressed || s.dashTimer > 0 || r.friction >= SLIPPERY_FRICTION || Math.abs(n.vx) > r.moveSpeed * EDGE_CATCH_SPEED) return;
  if (!footing(level, n.x, n.y, box, solids, g)) {
    if (dir === 0) scrambleBack(level, s, n, box, solids, g);
    return;
  }
  const side = Math.sign(n.vx);
  if (side === 0 || dir * side > 0 || footing(level, n.x + n.vx, n.y, box, solids, g)) return;
  let x = n.x;
  for (let k = 0; k < Math.abs(n.vx); k++) {
    if (!footing(level, x + side, n.y, box, solids, g)) break;
    x += side;
  }
  n.x = x;
  n.vx = 0;
  n.teeter = side;
}

function slipCorner(level, n, body, box, wantY, solids) {
  for (let dx = 1; dx <= CORNER_SLIP; dx++) {
    for (const side of [1, -1]) {
      if (blockedBy(level, body.x + side * dx, wantY, box.w, box.h, solids)) continue;
      body.x += side * dx;
      body.y = wantY;
      n.x = body.x - box.dx;
      return true;
    }
  }
  return false;
}

function moveY(level, n, box, body, dy, solids, g, ghost) {
  const prevY = n.y + box.dy;
  body.x = n.x + box.dx;
  body.y = prevY + dy;
  let floorHit = resolveY(level, body, box.w, box.h, dy, prevY, solids, g, ghost);
  if (floorHit && floorHit.dir === -g && dy * g < 0 && slipCorner(level, n, body, box, prevY + dy, solids)) floorHit = null;
  n.y = body.y - box.dy;
  return floorHit;
}

function squeezed(level, n, box, rects) {
  const solid = rects.filter(rect => !rect.oneWay);
  return blockedBy(level, n.x + box.dx, n.y + box.dy, box.w, box.h, solid);
}

function land(n, r, floorHit, g, ghost) {
  if (floorHit.dir !== g) {
    if (n.vy * g < 0) { n.bumpY = n.vy; n.vy = 0; }
    return false;
  }
  if (ghost && cometLand(n, r, g)) return false;
  const landingSpeed = n.vy * g;
  if (r.fallDamage && landingSpeed >= FALL_DAMAGE_SPEED) {
    n.dead = true;
    return true;
  }
  n.grounded = true;
  n.jetting = false;
  n.groundId = floorHit.id;
  refill(n, r);
  n.vy = r.bounce > 0 && landingSpeed > 3 ? -landingSpeed * r.bounce * g : 0;
  return false;
}

const RIDDEN_TYPES = new Set(['mover', 'conveyor']);

function leaveRide(n, moved) {
  n.vx += moved.dx;
  n.vy += Math.min(0, moved.dy * n.gravDir) * n.gravDir;
  n.flung = moved.dx !== 0;
}

function leavesWorld(level, r, n, ph) {
  if (r.wrapY) {
    if (n.y > level.height) n.y -= level.height + ph;
    else if (n.y < -ph) n.y += level.height + ph;
  } else if (n.comet && n.y < -ph) {
    n.won = true;
    return true;
  } else if (n.y > level.height + 40 || n.y < -ph - 40) {
    n.dead = true;
    return true;
  }
  if (n.y + ph > floodLevel(level, n.tide)) {
    n.dead = true;
    return true;
  }
  return false;
}

function touchTriggers(level, s, n, g, pw, ph, px, py) {
  const r = level.rules;
  let touchingPortal = false, touchingCannon = false;
  const hits = (x, y, rect) => overlaps(x + HURT_INSET, y + HURT_INSET, pw - 2 * HURT_INSET, ph - 2 * HURT_INSET, rect);
  for (const o of nearbyTriggers(level, py)) {
    if (!overlaps(px, py, pw, ph, objectRect(o, n.clock)) || crushed(level, n, o) || erased(n, o)) continue;
    switch (o.type) {
      case 'cannon':
        touchingCannon = true;
        if (!s.inBarrel && s.barrel < 0 && n.barrel < 0 && s.held < 0 && !n.comet) Object.assign(n, { barrel: o.id, barrelAge: 0, rope: -1, vx: 0, vy: 0, flung: false });
        break;
      case 'spikes':
      case 'saw':
        if (hits(px, py, objectRect(o, n.clock)) && hurt(n, r, g)) return true;
        break;
      case 'monster':
        if (slain(n, o)) break;
        if (o.kind !== 'urchin' && o.kind !== 'puffer' && stomps(s, objectRect(o, s.clock), ph, g)) stomp(n, o, r, g);
        else if (hits(px, py, objectRect(o, n.clock)) && hurt(n, r, g)) return true;
        break;
      case 'shot':
        if (!slain(n, level.objects[o.source]) && !erased(n, level.objects[o.source]) && hits(px, py, objectRect(o, n.clock)) && hurt(n, r, g)) return true;
        break;
      case 'coin':
        n.coins |= 1 << o.slot;
        break;
      case 'laser':
        if (phaseOn(o, n.clock) && hits(n.x, n.y, laserBeam(level, o, n.bodies)) && hurt(n, r, g)) return true;
        break;
      case 'item':
        if (!(n.taken & (1 << o.slot))) collect(n, o, level.rules);
        break;
      case 'key':
      case 'orb':
      case 'switch':
        n.flags |= o.bit;
        break;
      case 'refill':
        if (!s.grounded && !(n.spent & (1 << o.slot)) && n.armed !== o.slot) {
          n.armed = o.slot;
          n.jumpsLeft = Math.max(n.jumpsLeft, 1);
          n.dashLeft = 1;
        }
        break;
      case 'timer': {
        const last = n.timers[o.slot];
        if (last < 0 || n.clock - last >= o.open) n.timers = n.timers.map((t, k) => (k === o.slot ? n.clock : t));
        break;
      }
      case 'spring':
        n.vy = o.dir * (o.vel ?? SPRING_VEL);
        launch(n, r);
        break;
      case 'bumper':
        n.vx = o.dir * BUMPER_VEL;
        n.vy = -6 * g;
        n.facing = o.dir;
        launch(n, r);
        break;
      case 'gravpad':
        n.gravDir = o.dir;
        break;
      case 'portal':
        touchingPortal = true;
        if (!s.inPortal) {
          const target = level.objects[o.target];
          n.x = target.x + target.w / 2 - pw / 2;
          n.y = target.y + target.h / 2 - ph / 2;
        }
        break;
    }
  }
  n.inPortal = touchingPortal;
  n.inBarrel = touchingCannon;
  return false;
}

function touchLurkers(level, s, n, g, pw, ph, px, py) {
  const r = level.rules;
  const hits = rect => overlaps(px + HURT_INSET, py + HURT_INSET, pw - 2 * HURT_INSET, ph - 2 * HURT_INSET, rect);
  for (const o of levelIndex(level).lurkers) {
    if (erased(n, o)) continue;
    const m = lurkerOf(o, n), body = bodyOf(o, m);
    if (body && overlaps(px, py, pw, ph, body)) {
      if (stompable(o) && stomps(s, bodyOf(o, lurkerOf(o, s)) ?? body, ph, g)) { slayLurker(n, o); bounceOff(n, r, g); continue; }
      if (hits(body) && hurt(n, r, g)) return true;
    }
    if (strikesOf(o, m).some(hits) && hurt(n, r, g)) return true;
  }
  return false;
}

function bounceOnTrampolines(n, r, g, pw, ph, px, py) {
  for (const pad of n.placed) {
    if (pad.kind !== 'trampoline' || !overlaps(px, py, pw, ph, { x: pad.x, y: pad.y - 4, w: pad.w, h: pad.h + 4 })) continue;
    n.vy = -Math.sqrt(2 * r.gravity * (TRAMPOLINE_ROWS * TILE + ph + 24)) * g;
    launch(n, r);
  }
}

export function step(level, s, input) {
  const r = level.rules;
  const { w: pw, h: ph } = playerSize(r);
  const n = { ...s, bodies: cloneBodies(s.bodies), bumpX: 0, bumpY: 0 };
  n.frame = s.frame + 1;
  if (s.dead || s.won) return n;

  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (r.mirror) dir = -dir;
  const reeling = !!input.up && s.rope >= 0 && !level.objects[s.rope].grip;
  const jumpPressed = !!input.jump && !s.jumpHeld && !reeling;
  const dashPressed = !!input.dash && !s.dashHeld;
  const interactPressed = !!input.interact && !s.interactHeld;
  readButtons(r, s, n, input, jumpPressed);
  tickClock(r, s, n, dir, input);
  if (r.flood) riseFlood(level, s, n, ph);

  const index = levelIndex(level);
  const water = index.water.find(o => overlaps(s.x, s.y, pw, ph, o));
  const wind = index.wind.find(o => overlaps(s.x, s.y, pw, ph, o));
  const rects = activeRects(level, s, n.clock);
  stepBodies(level, s, n, rects, { x: s.x, y: s.y, w: pw, h: ph });
  let solids = withBodies(level, rects, n);
  const load = s.held >= 0 ? massOf(level, s.held) : 0;

  if (water) refill(n, r, r.jumps);

  const ladder = index.climbs.find(o => overlaps(s.x, s.y, pw, ph, o)) ?? s.placed.find(o => o.kind === 'ladder' && overlaps(s.x, s.y, pw, ph, o));
  n.climbing = climbing(s, n, input, dir, jumpPressed, ladder, pw, ph);

  if (s.barrel >= 0) {
    n.climbing = false;
    rideCannon(level, s, n, jumpPressed);
  } else if (n.climbing) climb(r, s, n, input, dir, ladder, pw, ph);
  else if (s.dashTimer > 0) keepDashing(r, s, n, input, dir);
  else if (r.blinkJump && input.blink !== undefined && s.teleports > 0) teleport(level, s, n, input.blink, solids);
  else if (r.dash && dashPressed && s.dashLeft > 0) startDash(r, s, n, dir);
  else walk(level, s, n, input, { dir, jumpPressed, solids, load, water, wind, pw, ph });
  if (water) n.flipFrame = NEVER_FLIPPED;
  const g = n.gravDir;

  const moved = carryFrom(level, s.groundId, s.bodies, n.bodies, s.clock, n.clock);
  n.x += moved.dx;
  n.y += moved.dy;
  if (n.rope >= 0 && level.objects[n.rope].grip) followGrip(level, s, n, pw, ph);
  let move = { x: n.vx, y: n.vy };
  if (n.rope >= 0 && !level.objects[n.rope].grip) {
    reel(level, n, input);
    move = tether(level, n, pw, ph);
  }

  const box = collisionBox(level, n, g, pw, ph);
  n.teeter = 0;
  if (n.rope < 0 && !n.climbing) catchEdge(level, r, s, n, dir, jumpPressed, box, solids, g);
  if (n.rope < 0) move.x = n.vx;
  const body = { x: n.x + box.dx + move.x, y: n.y + box.dy };
  const ghost = n.comet > 0;
  solids = moveX(level, r, n, box, body, move.x, solids, rects, g, ghost);
  const floorHit = moveY(level, n, box, body, move.y, solids, g, ghost);
  if (!ghost && squeezed(level, n, box, rects)) {
    n.dead = true;
    return n;
  }
  airborne(n);
  if (floorHit && land(n, r, floorHit, g, ghost)) return n;
  if (n.grounded) n.flung = false;
  else if (s.grounded && RIDDEN_TYPES.has(level.objects[s.groundId]?.type)) leaveRide(n, moved);
  trackRun(r, s, n);
  if (n.climbing && n.grounded && !input.up) n.climbing = false;
  n.coyote = n.grounded ? COYOTE_FRAMES : n.jumpsUsed > s.jumpsUsed ? 0 : Math.max(0, s.coyote - 1);
  if (n.grounded || n.rope >= 0) Object.assign(n, { lastKick: 0, wallSide: 0, wallKicks: 0 });
  if (n.grounded || n.rope >= 0 || n.climbing || n.barrel >= 0) n.longJump = false;
  n.crumbled = tickCrumbles(level, s, n, pw, ph);
  if (water) surface(level, r, n, pw, ph);
  if (leavesWorld(level, r, n, ph)) return n;

  const { x: px, y: py } = n;
  carryHeld(level, n, pw, ph);
  advanceLurkers(level, s, n, pw, ph);
  if (touchTriggers(level, s, n, g, pw, ph, px, py) || touchLurkers(level, s, n, g, pw, ph, px, py)) return n;
  bounceOnTrampolines(n, r, g, pw, ph, px, py);
  carryHeld(level, n, pw, ph);
  flyArrows(level, n, solids);
  if (interactPressed) interact(level, n, pw, ph, dir, rects);
  n.pressed = pressedPlates(level, n, pw, ph);

  if (overlaps(n.x, n.y, pw, ph, level.exit) && (n.flags & level.exitNeeds) === level.exitNeeds) n.won = true;
  return n;
}
