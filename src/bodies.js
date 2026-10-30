import { WIDTH, CRATE_KINDS, SPRING_VEL, BUMPER_VEL, levelIndex, crushed, overlaps, objectRect, moverOffset } from './level.js?v=129676c';
import { blockedBy, resolveX, resolveY } from './collision.js?v=129676c';

export const PUSH_STRENGTH = 2;
export const DASH_STRENGTH = 4;
const THROW_VX = 7.5;
export const THROW_VY = 8;
const WATER_DRAG = 0.85;
const GROUND_FRICTION = 0.6;
const ICE_FRICTION = 0.98;
const STILL = { dx: 0, dy: 0 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const massOf = (level, k) => CRATE_KINDS[levelIndex(level).crates[k].kind].mass;

export function initialBodies(level) {
  return levelIndex(level).crates.map(o => ({ x: o.x, y: o.y, vx: 0, vy: 0, grounded: false, ground: -1, inPortal: false, gone: false, asleep: 0 }));
}

export function cloneBodies(bodies) {
  return bodies.length ? bodies.map(b => ({ ...b })) : bodies;
}

const rectOf = (b, crate) => ({ x: b.x, y: b.y, w: crate.w, h: crate.h, id: crate.id });
const bodyRect = (level, bodies, k) => rectOf(bodies[k], levelIndex(level).crates[k]);

export function bodyRects(level, bodies, skip = () => false) {
  const crates = levelIndex(level).crates, rects = [];
  for (let k = 0; k < bodies.length; k++) if (!bodies[k].gone && !skip(k)) rects.push(rectOf(bodies[k], crates[k]));
  return rects;
}

const TILE_GROUND = -1;
const PLAYER_ID = -2;

const settled = (level, b, crate, g) => b.grounded && b.ground === TILE_GROUND && b.vx === 0 && blockedBy(level, b.x, b.y + g, crate.w, crate.h, []);

const restsOn = (top, base, g) => top.x < base.x + base.w && top.x + top.w > base.x && Math.abs(g > 0 ? top.y + top.h - base.y : base.y + base.h - top.y) < 1;

export function carryFrom(level, id, prevBodies, bodies, prevClock, clock) {
  if (id < 0) return STILL;
  const object = level.objects[id];
  switch (object.type) {
    case 'mover': {
      const a = moverOffset(object, prevClock), b = moverOffset(object, clock);
      return { dx: b.dx - a.dx, dy: b.dy - a.dy };
    }
    case 'conveyor':
      return { dx: clock === prevClock ? 0 : object.speed, dy: 0 };
    case 'crate': {
      const a = prevBodies[object.slot], b = bodies[object.slot];
      return { dx: b.x - a.x, dy: b.y - a.y };
    }
    default:
      return STILL;
  }
}

function buoyancy(level, b, crate, g) {
  const water = levelIndex(level).water.find(o => overlaps(b.x, b.y, crate.w, crate.h, o));
  if (!water) return 1;
  b.vx *= WATER_DRAG;
  b.vy *= WATER_DRAG;
  if (!CRATE_KINDS[crate.kind].floats) return 0.4;
  const surface = g > 0 ? water.y : water.y + water.h;
  const submerged = clamp(((g > 0 ? b.y + crate.h : surface) - (g > 0 ? surface : b.y)) / crate.h, 0, 1);
  return 1 - 2 * submerged;
}

function bodyTriggers(level, n, b, crate) {
  const index = levelIndex(level), mass = CRATE_KINDS[crate.kind].mass, g = n.gravDir;
  let touchingPortal = false;
  for (const o of index.bodyTriggers) {
    if (!overlaps(b.x, b.y, crate.w, crate.h, objectRect(o, n.clock)) || crushed(level, n, o)) continue;
    switch (o.type) {
      case 'saw':
        if (mass > PUSH_STRENGTH) n.crushed |= index.crushBit.get(o);
        break;
      case 'spring':
        if (mass > PUSH_STRENGTH) n.crushed |= index.crushBit.get(o);
        else { b.vy = (o.dir * (o.vel ?? SPRING_VEL)) / Math.sqrt(mass); b.grounded = false; }
        break;
      case 'bumper':
        b.vx = (o.dir * BUMPER_VEL) / mass;
        b.vy = (-6 * g) / mass;
        b.grounded = false;
        break;
      case 'switch':
        n.flags |= o.bit;
        break;
      case 'portal':
        touchingPortal = true;
        if (!b.inPortal) {
          const target = level.objects[o.target];
          b.x = target.x + target.w / 2 - crate.w / 2;
          b.y = target.y + target.h / 2 - crate.h / 2;
        }
        break;
    }
  }
  b.inPortal = touchingPortal;
}

export function stepBodies(level, s, n, rects, player) {
  if (!n.bodies.length) return;
  const r = level.rules, g = n.gravDir, index = levelIndex(level);
  const awake = [];
  for (let k = 0; k < n.bodies.length; k++) {
    const b = n.bodies[k];
    if (b.gone || k === n.held) continue;
    if (b.asleep !== g) awake.push(k);
    else if (index.bodyTriggers.length) bodyTriggers(level, n, b, index.crates[k]);
  }
  if (awake.length > 1) awake.sort((a, b) => (n.bodies[b].y - n.bodies[a].y) * g);
  let statics = null;
  for (const k of awake) {
    const crate = index.crates[k], b = n.bodies[k], mass = CRATE_KINDS[crate.kind].mass;
    const wind = index.wind.find(o => overlaps(b.x, b.y, crate.w, crate.h, o));
    const weight = buoyancy(level, b, crate, g);
    b.vy += r.gravity * weight * g;
    if (wind) { b.vx += wind.ax / mass; b.vy += wind.ay / mass; }
    b.vy = clamp(b.vy, -r.maxFall, r.maxFall);
    if (b.grounded) b.vx *= r.friction > 0.9 ? ICE_FRICTION : GROUND_FRICTION;
    if (Math.abs(b.vx) < 0.05) b.vx = 0;

    const moved = carryFrom(level, b.grounded ? b.ground : -1, s.bodies, n.bodies, s.clock, n.clock);
    statics ??= rects.concat(index.spikes, { ...player, id: PLAYER_ID });
    const obstacles = statics.concat(bodyRects(level, n.bodies, j => j === k));
    b.x += moved.dx;
    b.y += moved.dy;
    const moveX = b.vx;
    b.x += moveX;
    if (resolveX(level, b, crate.w, crate.h, moveX, obstacles) !== 0) b.vx = 0;
    b.x = clamp(b.x, 0, WIDTH - crate.w);
    const moveY = b.vy, prevY = b.y;
    b.y += moveY;
    const hit = resolveY(level, b, crate.w, crate.h, moveY, prevY, obstacles, g);
    b.grounded = hit?.dir === g;
    b.ground = b.grounded ? hit.id : -1;
    if (hit) b.vy = 0;

    if (r.wrapY) {
      if (b.y > level.height) b.y -= level.height + crate.h;
      else if (b.y < -crate.h) b.y += level.height + crate.h;
    } else if (b.y > level.height + 40 || b.y < -crate.h - 40) {
      b.gone = true;
      continue;
    }
    bodyTriggers(level, n, b, crate);
    b.asleep = !wind && settled(level, b, crate, g) ? g : 0;
  }
}

export function pushBodies(level, n, box, moveX, strength, rects) {
  const index = levelIndex(level), bodies = n.bodies, g = n.gravDir, dir = Math.sign(moveX);
  const all = bodies.map((_, k) => k).filter(k => !bodies[k].gone && k !== n.held);
  const rect = k => rectOf(bodies[k], index.crates[k]);
  const chain = all.filter(k => overlaps(box.x, box.y + 2, box.w, box.h - 4, rect(k)));
  if (!chain.length) return 0;
  const depth = Math.max(...chain.map(k => { const b = rect(k); return dir > 0 ? box.x + box.w - b.x : b.x + b.w - box.x; }));
  for (let i = 0; i < chain.length; i++) {
    const m = rect(chain[i]);
    for (const k of all) if (!chain.includes(k) && overlaps(m.x + dir * depth, m.y + 1, m.w, m.h - 2, rect(k))) chain.push(k);
  }
  const group = [...chain];
  for (let i = 0; i < group.length; i++) {
    const base = rect(group[i]);
    for (const k of all) if (!group.includes(k) && restsOn(rect(k), base, g)) group.push(k);
  }
  const mass = group.reduce((sum, k) => sum + massOf(level, k), 0);
  if (mass > strength) return 0;

  const obstacles = rects.concat(index.spikes, bodyRects(level, bodies, k => group.includes(k)));
  let shift = dir * depth * (mass > 1 ? 0.6 : 1);
  for (const k of chain) {
    const b = bodies[k], crate = index.crates[k];
    const probe = { x: b.x + shift, y: b.y };
    resolveX(level, probe, crate.w, crate.h, shift, obstacles);
    probe.x = clamp(probe.x, 0, WIDTH - crate.w);
    shift = dir > 0 ? Math.min(shift, probe.x - b.x) : Math.max(shift, probe.x - b.x);
  }
  if (shift * dir <= 0) return 0;
  const slide = level.rules.friction > 0.9;
  for (const k of group) {
    const b = bodies[k], crate = index.crates[k];
    b.x += shift;
    b.asleep = 0;
    if (chain.includes(k)) b.vx = slide ? shift : 0;
    else resolveX(level, b, crate.w, crate.h, shift, obstacles);
  }
  return shift;
}

function holdSpot(level, n, k, pw, ph) {
  const crate = levelIndex(level).crates[k];
  return { x: n.x + pw / 2 - crate.w / 2, y: n.gravDir > 0 ? n.y - crate.h : n.y + ph };
}

export function carryHeld(level, n, pw, ph) {
  if (n.held < 0) return;
  Object.assign(n.bodies[n.held], holdSpot(level, n, n.held, pw, ph), { vx: n.vx, vy: n.vy, grounded: false, ground: -1 });
}

export function lift(level, n, pw, ph, rects) {
  const g = n.gravDir, feet = g > 0 ? n.y + ph : n.y;
  for (let k = 0; k < n.bodies.length; k++) {
    const b = n.bodies[k];
    if (b.gone || massOf(level, k) > PUSH_STRENGTH) continue;
    const crate = bodyRect(level, n.bodies, k);
    const base = g > 0 ? crate.y + crate.h : crate.y;
    if (Math.abs(base - feet) > 8 || !overlaps(n.x - 4, n.y, pw + 8, ph, crate)) continue;
    const others = bodyRects(level, n.bodies, j => j === k);
    if (others.some(o => restsOn(o, crate, g))) continue;
    const spot = holdSpot(level, n, k, pw, ph);
    if (blockedBy(level, spot.x, spot.y, crate.w, crate.h, rects.concat(others))) continue;
    n.held = k;
    Object.assign(b, spot, { vx: 0, vy: 0, grounded: false, ground: -1, asleep: 0 });
    return;
  }
}

export function release(level, n, dir, pw, ph, rects) {
  const k = n.held, b = n.bodies[k], crate = bodyRect(level, n.bodies, k), mass = massOf(level, k);
  n.held = -1;
  b.asleep = 0;
  if (dir !== 0) {
    b.vx = (dir * THROW_VX) / mass;
    b.vy = n.vy - (THROW_VY / mass) * n.gravDir;
    return;
  }
  const others = bodyRects(level, n.bodies, j => j === k), obstacles = rects.concat(others);
  const spot = { x: n.facing > 0 ? n.x + pw + 1 : n.x - crate.w - 1, y: n.gravDir > 0 ? n.y + ph - crate.h : n.y };
  const base = others.find(o => overlaps(spot.x, spot.y, crate.w, crate.h, o));
  const stacked = base && { x: base.x, y: n.gravDir > 0 ? base.y - crate.h : base.y + base.h };
  const free = [spot, stacked].find(p => p && !blockedBy(level, p.x, p.y, crate.w, crate.h, obstacles));
  if (free) Object.assign(b, free);
  b.vx = 0;
  b.vy = 0;
}

export function laserBeam(level, laser, bodies) {
  const down = (laser.dir ?? 1) > 0;
  let y0 = laser.y, y1 = laser.y + laser.h;
  for (const rect of bodyRects(level, bodies)) {
    if (rect.x >= laser.x + laser.w || rect.x + rect.w <= laser.x || rect.y >= y1 || rect.y + rect.h <= y0) continue;
    if (down) y1 = Math.max(y0, rect.y);
    else y0 = Math.min(y1, rect.y + rect.h);
  }
  return { x: laser.x, y: y0, w: laser.w, h: y1 - y0 };
}

export function pressedPlates(level, n, pw, ph) {
  const plates = levelIndex(level).plates;
  if (!plates.length) return 0;
  const weights = bodyRects(level, n.bodies, k => k === n.held);
  weights.push({ x: n.x, y: n.y, w: pw, h: ph });
  let pressed = 0;
  for (const plate of plates) if (weights.some(w => overlaps(w.x, w.y, w.w, w.h, plate))) pressed |= plate.bit;
  return pressed;
}
