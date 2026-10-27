import { TILE, COLS, HEIGHT, SOLID, ONE_WAY, PLAYER_W, PLAYER_H, tileAt, objectRect, isSolidObject, moverOffset, overlaps } from './level.js';

const COYOTE_FRAMES = 6;
export const SPRING_VEL = 15;
const WALL_SLIDE_SPEED = 2.2;
const GLIDE_SPEED = 1.6;
const WATER_GRAVITY = 0.35;
const WATER_DRAG = 0.93;
const WATER_JUMP = 0.65;

const DYNAMIC_TYPES = new Set(['mover', 'conveyor', 'phase', 'crumble', 'door', 'toggle']);
const TRIGGER_TYPES = new Set(['spikes', 'laser', 'key', 'orb', 'switch', 'spring', 'portal']);
const indexCache = new WeakMap();

function indexOf(level) {
  let index = indexCache.get(level);
  if (!index || index.count !== level.objects.length) {
    index = {
      count: level.objects.length,
      dynamic: level.objects.filter(o => DYNAMIC_TYPES.has(o.type)),
      triggers: level.objects.filter(o => TRIGGER_TYPES.has(o.type)),
      water: level.objects.filter(o => o.type === 'water'),
      wind: level.objects.filter(o => o.type === 'wind'),
    };
    indexCache.set(level, index);
  }
  return index;
}

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
    dashHeld: false,
    inPortal: false,
    flags: 0,
    clock: 0,
    frame: 0,
    dead: false,
    won: false,
    facing: 1,
  };
}

function approach(value, target, rate) {
  if (Math.abs(target - value) <= rate) return target;
  return value + Math.sign(target - value) * rate;
}

function activeRects(level, prev, clock) {
  const rects = [];
  for (const object of indexOf(level).dynamic) {
    if (isSolidObject(object, prev, clock)) rects.push(objectRect(object, clock));
  }
  return rects;
}

function blockedBy(level, x, y, w, h, rects) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.001) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) return true;
  return rects.some(rect => overlaps(x, y, w, h, rect));
}

function resolveX(level, n, pw, ph, moveX, rects) {
  let hit = 0;
  const push = (rx, rw) => {
    const leftPen = n.x + pw - rx;
    const rightPen = rx + rw - n.x;
    if (moveX > 0 || (moveX === 0 && leftPen < rightPen)) { n.x = rx - pw; hit = 1; } else { n.x = rx + rw; hit = -1; }
  };
  const c0 = Math.floor(n.x / TILE), c1 = Math.floor((n.x + pw - 0.001) / TILE);
  const r0 = Math.floor(n.y / TILE), r1 = Math.floor((n.y + ph - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === SOLID) push(c * TILE, TILE);
  for (const rect of rects) if (overlaps(n.x, n.y, pw, ph, rect)) push(rect.x, rect.w);
  return hit;
}

function resolveY(level, n, pw, ph, moveY, prevY, rects, g) {
  let hit = null;
  const land = (ry, rh, id) => {
    const topPen = n.y + ph - ry;
    const bottomPen = ry + rh - n.y;
    if (moveY > 0 || (moveY === 0 && topPen < bottomPen)) { n.y = ry - ph; hit = { dir: 1, id }; } else { n.y = ry + rh; hit = { dir: -1, id }; }
  };
  const passesOneWay = (ry, rh) => {
    if (moveY * g <= 0) return true;
    return g > 0 ? prevY + ph > ry + 0.01 : prevY < ry + rh - 0.01;
  };
  const c0 = Math.floor(n.x / TILE), c1 = Math.floor((n.x + pw - 0.001) / TILE);
  const r0 = Math.floor(n.y / TILE), r1 = Math.floor((n.y + ph - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = tileAt(level, c, r);
      if (tile === SOLID || (tile === ONE_WAY && !passesOneWay(r * TILE, TILE))) land(r * TILE, TILE, -1);
    }
  }
  for (const rect of rects) if (overlaps(n.x, n.y, pw, ph, rect)) land(rect.y, rect.h, rect.id);
  return hit;
}

function carry(level, s, prevClock, clock) {
  if (s.groundId < 0) return { dx: 0, dy: 0 };
  const object = level.objects[s.groundId];
  if (object.type === 'mover') {
    const a = moverOffset(object, prevClock);
    const b = moverOffset(object, clock);
    return { dx: b.dx - a.dx, dy: b.dy - a.dy };
  }
  if (object.type === 'conveyor') return { dx: clock === prevClock ? 0 : object.speed, dy: 0 };
  return { dx: 0, dy: 0 };
}

export function laserOn(object, clock) {
  return (((clock + object.phase) % object.period) + object.period) % object.period < object.on;
}

export function step(level, s, input) {
  const r = level.rules;
  const { w: pw, h: ph } = playerSize(r);
  const n = { ...s };
  n.frame = s.frame + 1;
  if (s.dead || s.won) return n;

  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (r.mirror) dir = -dir;
  const jumpPressed = !!input.jump && !s.jumpHeld;
  const dashPressed = !!input.dash && !s.dashHeld;
  n.jumpHeld = !!input.jump;
  n.dashHeld = !!input.dash;

  const active = dir !== 0 || !!input.jump || !!input.dash || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || !s.grounded || s.dashTimer > 0;
  if (!r.superhot || active) n.clock = s.clock + 1;
  if (r.flipPeriod) n.gravDir = r.baseGravDir * (Math.floor(n.clock / r.flipPeriod) % 2 === 0 ? 1 : -1);
  let g = n.gravDir;

  const index = indexOf(level);
  const water = index.water.find(o => overlaps(s.x, s.y, pw, ph, o));
  const wind = index.wind.find(o => overlaps(s.x, s.y, pw, ph, o));
  const rects = activeRects(level, s, n.clock);

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
    if (dir !== 0) {
      n.vx = approach(s.vx, dir * r.moveSpeed, accel);
      n.facing = dir;
    } else if (s.grounded) {
      n.vx = s.vx * r.friction;
    }
    if (wind) { n.vx += wind.ax; n.vy += wind.ay; }

    const wall = r.wallJump && !s.grounded ? (blockedBy(level, s.x + 1, s.y, pw, ph, rects) ? 1 : blockedBy(level, s.x - 1, s.y, pw, ph, rects) ? -1 : 0) : 0;
    if (jumpPressed) {
      let jumped = false;
      if (s.grounded || s.coyote > 0) {
        jumped = true;
      } else if (wall !== 0) {
        n.vx = -wall * r.moveSpeed * 1.15;
        n.facing = -wall;
        jumped = true;
      } else if (s.jumpsLeft > 0) {
        n.jumpsLeft = s.jumpsLeft - 1;
        jumped = true;
      }
      if (jumped) {
        if (s.grounded || s.coyote > 0 || wall !== 0) n.jumpsLeft = r.jumps - 1;
        n.vy = -r.jumpVel * (water ? WATER_JUMP : 1) * g;
        n.coyote = 0;
        n.grounded = false;
        n.groundId = -1;
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
  }

  const moved = carry(level, s, s.clock, n.clock);
  const moveX = n.vx + moved.dx;
  const moveY = n.vy + moved.dy;
  n.x += moveX;
  const wallHit = resolveX(level, n, pw, ph, moveX, rects);
  if (wallHit !== 0 && Math.sign(n.vx) === wallHit) { n.vx = 0; n.dashTimer = 0; }
  if (n.x < 0) { n.x = 0; if (n.vx < 0) n.vx = 0; }
  if (n.x > COLS * TILE - pw) { n.x = COLS * TILE - pw; if (n.vx > 0) n.vx = 0; }

  const prevY = n.y;
  n.y += moveY;
  const floorHit = resolveY(level, n, pw, ph, moveY, prevY, rects, g);
  n.grounded = false;
  n.groundId = -1;
  if (floorHit) {
    if (floorHit.dir === g) {
      const landingSpeed = n.vy * g;
      n.grounded = true;
      n.groundId = floorHit.id;
      n.jumpsLeft = r.jumps;
      n.dashLeft = 1;
      n.vy = r.bounce > 0 && landingSpeed > 3 ? -landingSpeed * r.bounce * g : 0;
    } else if (n.vy * g < 0) {
      n.vy = 0;
    }
  }
  n.coyote = n.grounded ? COYOTE_FRAMES : Math.max(0, s.coyote - 1);
  if (n.grounded && n.groundId >= 0 && level.objects[n.groundId].type === 'crumble') n.flags |= level.objects[n.groundId].bit;

  if (r.wrapY) {
    if (n.y > HEIGHT) n.y -= HEIGHT + ph;
    else if (n.y < -ph) n.y += HEIGHT + ph;
  } else if (n.y > HEIGHT + 40 || n.y < -ph - 40) {
    n.dead = true;
    return n;
  }

  let touchingPortal = false;
  for (const o of index.triggers) {
    if (!overlaps(n.x, n.y, pw, ph, o)) continue;
    switch (o.type) {
      case 'spikes':
        n.dead = true;
        return n;
      case 'laser':
        if (laserOn(o, n.clock)) { n.dead = true; return n; }
        break;
      case 'key':
      case 'orb':
      case 'switch':
        n.flags |= o.bit;
        break;
      case 'spring':
        n.vy = o.dir * SPRING_VEL;
        n.jumpsLeft = r.jumps;
        n.dashLeft = 1;
        n.grounded = false;
        n.groundId = -1;
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

  if (overlaps(n.x, n.y, pw, ph, level.exit) && (n.flags & level.exitNeeds) === level.exitNeeds) n.won = true;
  return n;
}
