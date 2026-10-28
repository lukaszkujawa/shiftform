import { TILE, COLS, PLAYER_W, PLAYER_H, SPRING_VEL, BUMPER_VEL, levelIndex, crushed, objectRect, isSolidObject, overlaps, floodLevel } from './level.js';
import { blockedBy, resolveX, resolveY } from './collision.js';
import { PUSH_STRENGTH, DASH_STRENGTH, massOf, initialBodies, cloneBodies, bodyRects, stepBodies, pushBodies, carryFrom, carryHeld, lift, release, laserBeam, pressedPlates } from './bodies.js';

const COYOTE_FRAMES = 6;
const JUMP_BUFFER_FRAMES = 8;
const WALL_SLIDE_SPEED = 2.2;
const GLIDE_SPEED = 1.6;
const WATER_GRAVITY = 0.35;
const WATER_DRAG = 0.93;
const WATER_JUMP = 0.65;
const BLINK_HEIGHTS = [75, 60, 45, 30];
const FALL_DAMAGE_SPEED = 12;
const ROPE_MIN = 40;
export const CRUMBLE_RESPAWN = 180;
export const JETPACK_FUEL = 180;
export const BOOT_JUMPS = 5;
const JET_ACCEL = 0.9;
const JET_SPEED = 6;
const SHIELD_FRAMES = 60;

export function playerSize(rules) {
  return { w: PLAYER_W * rules.size, h: PLAYER_H * rules.size };
}

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
    dashTimer: 0,
    dashDir: 1,
    jumpHeld: false,
    jumpBuffer: 0,
    dashHeld: false,
    interactHeld: false,
    inPortal: false,
    flags: 0,
    pressed: 0,
    crushed: 0,
    crumbled: levelIndex(level).crumbles.map(() => 0),
    taken: 0,
    fuel: 0,
    boots: 0,
    shield: false,
    jetting: false,
    invuln: 0,
    jumpsUsed: 0,
    clock: 0,
    frame: 0,
    dead: false,
    won: false,
    facing: 1,
    bodies: initialBodies(level),
    held: -1,
    rope: -1,
    ropeLen: 0,
  };
}

function approach(value, target, rate) {
  if (Math.abs(target - value) <= rate) return target;
  return value + Math.sign(target - value) * rate;
}

function activeRects(level, prev, clock) {
  const rects = [];
  for (const object of levelIndex(level).dynamic) {
    if (isSolidObject(object, prev, clock)) rects.push(objectRect(object, clock));
  }
  return rects;
}

function collisionBox(level, s, g, pw, ph) {
  if (s.held < 0) return { dx: 0, dy: 0, w: pw, h: ph };
  const crate = levelIndex(level).crates[s.held];
  const w = Math.max(pw, crate.w);
  return { dx: (pw - w) / 2, dy: g > 0 ? -crate.h : 0, w, h: ph + crate.h };
}

export function hookAnchor(hook) {
  return { x: hook.x + hook.w / 2, y: hook.y + hook.h / 2 };
}

function tether(level, n, pw, ph, move) {
  const anchor = hookAnchor(level.objects[n.rope]);
  const cx = n.x + pw / 2 + move.x - anchor.x, cy = n.y + ph / 2 + move.y - anchor.y;
  const d = Math.hypot(cx, cy);
  if (d <= n.ropeLen) return move;
  const k = n.ropeLen / d;
  return { x: anchor.x + cx * k - n.x - pw / 2, y: anchor.y + cy * k - n.y - ph / 2 };
}

function grabHook(level, n, pw, ph) {
  const cx = n.x + pw / 2, cy = n.y + ph / 2;
  let best = null, bestDistance = Infinity;
  for (const hook of levelIndex(level).hooks) {
    const anchor = hookAnchor(hook);
    const d = Math.hypot(anchor.x - cx, anchor.y - cy);
    if (d <= hook.reach && d < bestDistance) { best = hook; bestDistance = d; }
  }
  if (!best) return;
  n.rope = best.id;
  n.ropeLen = Math.max(ROPE_MIN, bestDistance);
}

function interact(level, n, pw, ph, dir, rects) {
  if (n.held >= 0) release(level, n, dir, pw, ph, rects);
  else if (n.rope >= 0) n.rope = -1;
  else if (!n.grounded) grabHook(level, n, pw, ph);
  else lift(level, n, pw, ph, rects);
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

function hurt(n, r, g) {
  if (n.invuln > 0) return false;
  if (!n.shield) {
    n.dead = true;
    return true;
  }
  n.shield = false;
  n.invuln = SHIELD_FRAMES;
  n.vy = -r.jumpVel * g;
  n.grounded = false;
  n.groundId = -1;
  return false;
}

function collect(n, item) {
  n.taken |= 1 << item.slot;
  if (item.kind === 'jetpack') n.fuel = Math.max(n.fuel, JETPACK_FUEL);
  if (item.kind === 'boots') n.boots += BOOT_JUMPS;
  if (item.kind === 'shield') n.shield = true;
}

export function laserOn(object, clock) {
  return (((clock + object.phase) % object.period) + object.period) % object.period < object.on;
}

export function step(level, s, input) {
  const r = level.rules;
  const { w: pw, h: ph } = playerSize(r);
  const n = { ...s, bodies: cloneBodies(s.bodies) };
  n.frame = s.frame + 1;
  if (s.dead || s.won) return n;

  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (r.mirror) dir = -dir;
  const jumpPressed = !!input.jump && !s.jumpHeld;
  const dashPressed = !!input.dash && !s.dashHeld;
  const interactPressed = !!input.interact && !s.interactHeld;
  n.jumpHeld = !!input.jump;
  n.jumpBuffer = jumpPressed ? JUMP_BUFFER_FRAMES : Math.max(0, s.jumpBuffer - 1);
  n.invuln = Math.max(0, s.invuln - 1);
  n.dashHeld = !!input.dash;
  n.interactHeld = !!input.interact;

  const active = dir !== 0 || !!input.jump || !!input.dash || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || !s.grounded || s.dashTimer > 0;
  const slowed = r.slowAir && !s.grounded && s.frame % 2 === 1;
  if ((!r.superhot || active) && !slowed) n.clock = s.clock + r.clockRate;
  if (r.flipPeriod) n.gravDir = r.baseGravDir * (Math.floor(n.clock / r.flipPeriod) % 2 === 0 ? 1 : -1);
  let g = n.gravDir;

  const index = levelIndex(level);
  const water = index.water.find(o => overlaps(s.x, s.y, pw, ph, o));
  const wind = index.wind.find(o => overlaps(s.x, s.y, pw, ph, o));
  const rects = activeRects(level, s, n.clock);
  stepBodies(level, s, n, rects, { x: s.x, y: s.y, w: pw, h: ph });
  const solidsWith = bodies => bodies.length ? rects.concat(bodyRects(level, bodies, k => k === n.held)) : rects;
  let solids = solidsWith(n.bodies);
  const load = s.held >= 0 ? massOf(level, s.held) : 0;

  if (water) { n.jumpsLeft = r.jumps; n.dashLeft = 1; }

  if (s.dashTimer > 0) {
    n.dashTimer = s.dashTimer - 1;
    n.vx = s.dashDir * r.dashSpeed;
    n.vy = 0;
  } else if (r.dash && dashPressed && s.dashLeft > 0) {
    n.dashTimer = r.dashFrames;
    n.dashLeft = s.dashLeft - 1;
    n.dashDir = dir || s.facing;
    n.facing = n.dashDir;
    n.vx = n.dashDir * r.dashSpeed;
    n.vy = 0;
  } else {
    const accel = s.grounded ? r.groundAccel : r.airAccel;
    const speed = r.moveSpeed * Math.min(1, 1.4 / Math.max(1, load));
    if (dir !== 0) {
      n.vx = approach(s.vx, dir * speed, accel);
      n.facing = dir;
    } else if (s.grounded) {
      n.vx = s.vx * r.friction;
    }
    if (wind) { n.vx += wind.ax; n.vy += wind.ay; }

    const box = collisionBox(level, s, g, pw, ph);
    const wallAt = offset => blockedBy(level, s.x + box.dx + offset, s.y + box.dy, box.w, box.h, solids);
    const wall = r.wallJump && !s.grounded ? (wallAt(1) ? 1 : wallAt(-1) ? -1 : 0) : 0;
    const fresh = s.grounded || s.coyote > 0 || s.rope >= 0;
    if (jumpPressed || (fresh && s.jumpBuffer > 0)) {
      let jumped = false;
      if (fresh) {
        jumped = true;
      } else if (wall !== 0) {
        n.vx = -wall * r.moveSpeed * 1.15;
        n.facing = -wall;
        jumped = true;
      } else if (s.jumpsLeft > 0) {
        n.jumpsLeft = s.jumpsLeft - 1;
        jumped = true;
      } else if (s.boots > 0) {
        n.boots = s.boots - 1;
        jumped = true;
      } else if (s.fuel > 0) {
        n.jetting = true;
      }
      if (jumped && ((r.jumpBudget && s.jumpsUsed >= r.jumpBudget) || load > 1)) jumped = false;
      if (jumped) {
        if (fresh || wall !== 0) n.jumpsLeft = r.jumps - 1;
        n.jumpsUsed = s.jumpsUsed + 1;
        n.jumpBuffer = 0;
        n.coyote = 0;
        n.grounded = false;
        n.groundId = -1;
        n.rope = -1;
        if (r.blinkJump) {
          const rise = BLINK_HEIGHTS.find(h => !blockedBy(level, s.x + box.dx, s.y + box.dy - h * g, box.w, box.h, solids));
          if (rise) n.y = s.y - rise * g;
          n.vy = 0;
        } else {
          n.vy = -r.jumpVel * (water ? WATER_JUMP : 1) * g;
        }
        if (r.flipOnJump) { n.gravDir = -g; g = n.gravDir; }
      }
    }

    let gravity = r.gravity * (water ? WATER_GRAVITY : 1);
    if (n.vy * g < 0 && input.jump && !water) gravity *= r.holdBoost;
    n.vy += gravity * g;
    if (water) { n.vx *= WATER_DRAG; n.vy *= WATER_DRAG; }

    let maxFall = r.maxFall;
    if (r.glide && input.jump && n.vy * g > 0) maxFall = GLIDE_SPEED;
    if (wall !== 0 && n.vy * g > 0) maxFall = WALL_SLIDE_SPEED;
    if (n.vy * g > maxFall) n.vy = maxFall * g;
    n.jetting = n.jetting && !!input.jump && s.fuel > 0 && !(s.grounded && !jumpPressed);
    if (n.jetting) {
      n.vy = Math.max(n.vy * g - JET_ACCEL, -JET_SPEED) * g;
      n.fuel = s.fuel - 1;
    }
  }

  const moved = carryFrom(level, s.groundId, s.bodies, n.bodies, s.clock, n.clock);
  n.x += moved.dx;
  n.y += moved.dy;
  let move = { x: n.vx, y: n.vy };
  if (n.rope >= 0) {
    move = tether(level, n, pw, ph, move);
    n.vx = move.x;
    n.vy = move.y;
  }

  const box = collisionBox(level, n, g, pw, ph);
  const body = { x: n.x + box.dx + move.x, y: n.y + box.dy };
  const strength = n.dashTimer > 0 ? DASH_STRENGTH : PUSH_STRENGTH;
  const pushed = move.x !== 0 && n.bodies.length ? pushBodies(level, n, { ...body, w: box.w, h: box.h }, move.x, strength, rects) : 0;
  if (pushed) solids = solidsWith(n.bodies);
  const wallHit = resolveX(level, body, box.w, box.h, move.x, solids);
  n.x = body.x - box.dx;
  if (pushed) n.vx = pushed;
  else if (wallHit !== 0 && Math.sign(n.vx) === wallHit) { n.vx = r.rubberWalls ? -n.vx * 0.9 : 0; n.dashTimer = 0; }
  const minX = -box.dx, maxX = COLS * TILE - box.w - box.dx;
  if (n.x < minX) { n.x = minX; if (n.vx < 0) n.vx = 0; }
  if (n.x > maxX) { n.x = maxX; if (n.vx > 0) n.vx = 0; }

  const prevY = n.y + box.dy;
  body.x = n.x + box.dx;
  body.y = prevY + move.y;
  const floorHit = resolveY(level, body, box.w, box.h, move.y, prevY, solids, g);
  n.y = body.y - box.dy;
  n.grounded = false;
  n.groundId = -1;
  if (floorHit) {
    if (floorHit.dir === g) {
      const landingSpeed = n.vy * g;
      if (r.fallDamage && landingSpeed >= FALL_DAMAGE_SPEED) { n.dead = true; return n; }
      n.grounded = true;
      n.jetting = false;
      n.groundId = floorHit.id;
      n.jumpsLeft = r.jumps;
      n.dashLeft = 1;
      n.vy = r.bounce > 0 && landingSpeed > 3 ? -landingSpeed * r.bounce * g : 0;
    } else if (n.vy * g < 0) {
      n.vy = 0;
    }
  }
  n.coyote = n.grounded ? COYOTE_FRAMES : Math.max(0, s.coyote - 1);
  n.crumbled = tickCrumbles(level, s, n, pw, ph);

  if (r.wrapY) {
    if (n.y > level.height) n.y -= level.height + ph;
    else if (n.y < -ph) n.y += level.height + ph;
  } else if (n.y > level.height + 40 || n.y < -ph - 40) {
    n.dead = true;
    return n;
  }
  if (n.y + ph > floodLevel(level, n.clock)) { n.dead = true; return n; }

  let touchingPortal = false;
  const px = n.x, py = n.y, clock = n.clock;
  for (const o of index.triggers) {
    if (!overlaps(px, py, pw, ph, objectRect(o, clock)) || crushed(level, n, o)) continue;
    switch (o.type) {
      case 'spikes':
      case 'saw':
        if (hurt(n, r, g)) return n;
        break;
      case 'laser':
        if (laserOn(o, n.clock) && overlaps(n.x, n.y, pw, ph, laserBeam(level, o, n.bodies)) && hurt(n, r, g)) return n;
        break;
      case 'item':
        if (!(n.taken & (1 << o.slot))) collect(n, o);
        break;
      case 'key':
      case 'orb':
      case 'switch':
        n.flags |= o.bit;
        break;
      case 'spring':
        n.vy = o.dir * (o.vel ?? SPRING_VEL);
        n.jumpsLeft = r.jumps;
        n.dashLeft = 1;
        n.grounded = false;
        n.groundId = -1;
        break;
      case 'bumper':
        n.vx = o.dir * BUMPER_VEL;
        n.vy = -6 * g;
        n.facing = o.dir;
        n.jumpsLeft = r.jumps;
        n.dashLeft = 1;
        n.grounded = false;
        n.groundId = -1;
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
  carryHeld(level, n, pw, ph);
  if (interactPressed) interact(level, n, pw, ph, dir, rects);
  n.pressed = pressedPlates(level, n, pw, ph);

  if (overlaps(n.x, n.y, pw, ph, level.exit) && (n.flags & level.exitNeeds) === level.exitNeeds) n.won = true;
  return n;
}
