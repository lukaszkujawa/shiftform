import { TILE, EMPTY, SOLID, SHOP_ROWS, tileAt, levelIndex, erased } from './level.js';

const GRAVITY = 0.5;
const MAX_FALL = 9;
const HOP_VEL = 7.5;
const BLAST_RADIUS = 46;
const BLAST_FRAMES = 10;
const BITE_RISE = 34;
const BOLT_SIZE = 10;
const BOLT_SPEED = 4.5;
const BOLT_RANGE = 14 * TILE;
const SIGHT_STEP = TILE / 2;

export const LURKERS = {
  faller: { w: 22, h: 20, stomp: false, from: 1, site: 'ceiling', wake: 9 * TILE },
  hound: { w: 26, h: 18, stomp: true, from: 1, site: 'ledge', wake: 6 * TILE },
  swooper: { w: 24, h: 18, stomp: true, from: 2, site: 'ceiling', wake: 6 * TILE },
  snapper: { w: 26, h: 14, stomp: false, from: 2, site: 'ledge', wake: 2 * TILE },
  bomber: { w: 20, h: 20, stomp: true, from: 3, site: 'ledge', wake: 6 * TILE },
  charger: { w: 30, h: 22, stomp: true, from: 3, site: 'ledge', wake: 9 * TILE },
  sniper: { w: 22, h: 22, stomp: true, from: 4, site: 'ledge', wake: 11 * TILE },
  wraith: { w: 22, h: 26, stomp: false, from: 4, site: 'air', wake: 10 * TILE },
};

const rested = o => ({ x: o.x, y: o.y, vx: 0, vy: 0, mode: 'idle', age: 0, dir: o.dir ?? 1, aim: null, bolt: null, dead: false });

export const lurkerOf = (o, s) => s.lurkers[o.slot] ?? rested(o);

const solidAt = (level, x, y) => tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === SOLID;
const groundAt = (level, x, y) => tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) !== EMPTY;

function sees(level, ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / SIGHT_STEP);
  for (let k = 1; k < steps; k++) if (solidAt(level, ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps)) return false;
  return true;
}

const centreOf = (o, m) => ({ cx: m.x + o.w / 2, cy: m.y + o.h / 2 });
const change = (m, mode, extra = {}) => ({ ...m, mode, age: 0, ...extra });
const distance = (o, m, player) => { const { cx, cy } = centreOf(o, m); return Math.hypot(player.cx - cx, player.cy - cy); };
const spotted = (level, o, m, player) => {
  const { cx, cy } = centreOf(o, m);
  return player.free && Math.hypot(player.cx - cx, player.cy - cy) < LURKERS[o.kind].wake && sees(level, cx, cy, player.cx, player.cy);
};

function walk(level, o, m, dir, speed) {
  const x = m.x + dir * speed, lead = dir > 0 ? x + o.w : x, feet = m.y + o.h;
  if (lead < 0 || solidAt(level, lead, feet - 2) || !groundAt(level, lead, feet + 1)) return { ...m, dir, stuck: true };
  return { ...m, x, dir, stuck: false };
}

function fall(level, o, m) {
  const vy = Math.min(MAX_FALL, m.vy + GRAVITY), y = m.y + vy, feet = y + o.h;
  if (vy > 0 && groundAt(level, m.x + o.w / 2, feet)) return { ...m, y: Math.floor(feet / TILE) * TILE - o.h, vy: 0, landed: true };
  return { ...m, y, vy, landed: false };
}

const homeward = (level, o, m, speed) => (Math.abs(m.x - o.x) <= speed ? { ...m, x: o.x } : walk(level, o, m, Math.sign(o.x - m.x), speed));
const towards = (o, m, player) => Math.sign(player.cx - (m.x + o.w / 2)) || m.dir;
const atHome = (o, m) => m.x === o.x && m.y === o.y;

function flyTo(m, x, y, speed) {
  const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy);
  return d <= speed ? { ...m, x, y } : { ...m, x: m.x + (dx / d) * speed, y: m.y + (dy / d) * speed, dir: Math.sign(dx) || m.dir };
}

const BEHAVIOURS = {
  faller(level, o, m, player) {
    if (m.mode === 'idle') {
      const under = player.free && player.cy > m.y && Math.abs(player.cx - (m.x + o.w / 2)) < TILE * 1.5 && spotted(level, o, m, player);
      return under ? change(m, 'shake') : m;
    }
    if (m.mode === 'shake') return m.age >= 16 ? change(m, 'fall') : m;
    if (m.mode === 'fall') {
      const next = fall(level, o, m);
      return next.landed || next.y > level.height ? change(next, 'splat') : next;
    }
    if (m.mode === 'splat') return m.age >= 90 ? change(rested(o), 'regrow') : m;
    return m.age >= 120 ? rested(o) : m;
  },
  hound(level, o, m, player) {
    let next = m;
    if (m.vy !== 0 || !groundAt(level, m.x + o.w / 2, m.y + o.h + 1)) {
      next = fall(level, o, m);
      if (next.y > player.corridor) return { ...rested(o) };
    }
    if (m.mode === 'idle') return spotted(level, o, m, player) && Math.abs(player.cy - m.y) < 3 * TILE ? change(next, 'chase') : next;
    if (m.mode === 'home') {
      if (spotted(level, o, m, player)) return change(next, 'chase');
      const back = homeward(level, o, next, 1.4);
      return atHome(o, back) ? rested(o) : back;
    }
    if (!player.free || distance(o, m, player) > 10 * TILE) return change(next, 'home');
    const dir = towards(o, m, player), stepped = walk(level, o, next, dir, 2.7);
    const leap = next.vy === 0 && player.feet < m.y && Math.abs(player.cx - (m.x + o.w / 2)) < 2.5 * TILE;
    return leap ? { ...stepped, vy: -HOP_VEL } : stepped;
  },
  swooper(level, o, m, player) {
    if (m.mode === 'idle') return m.age > 40 && spotted(level, o, m, player) && player.cy > m.y ? change(m, 'aim') : m;
    if (m.mode === 'aim') {
      if (m.age < 20) return { ...m, aim: { x: player.cx - o.w / 2, y: player.cy - o.h / 2 } };
      return m.age >= 28 ? change(m, 'dive', { start: { x: m.x, y: m.y } }) : m;
    }
    if (m.mode === 'dive') {
      const dx = m.aim.x - m.start.x, dy = m.aim.y - m.start.y, d = Math.hypot(dx, dy) || 1;
      const next = { ...m, x: m.x + (dx / d) * 5.5, y: m.y + (dy / d) * 5.5, dir: Math.sign(dx) || m.dir };
      const { cx, cy } = centreOf(o, next);
      return solidAt(level, cx, cy) || cy > player.corridor || m.age > 54 ? change(m, 'return') : next;
    }
    const back = flyTo(m, o.x, o.y, 2.2);
    return atHome(o, back) ? { ...rested(o) } : back;
  },
  snapper(level, o, m, player) {
    if (m.mode === 'idle') return player.free && Math.abs(player.cx - (m.x + o.w / 2)) < LURKERS.snapper.wake && Math.abs(player.feet - (m.y + o.h)) < TILE ? change(m, 'tell') : m;
    if (m.mode === 'tell') return m.age >= 14 ? change(m, 'bite') : m;
    if (m.mode === 'bite') return m.age >= 22 ? change(m, 'sink') : m;
    return m.age >= 50 ? rested(o) : m;
  },
  bomber(level, o, m, player) {
    if (m.mode === 'blast') return m.age >= BLAST_FRAMES ? change(m, 'gone') : m;
    if (m.mode === 'gone') return m.age >= 240 ? rested(o) : m;
    if (m.mode === 'fuse') return m.age >= 42 ? change(m, 'blast') : m;
    if (m.mode === 'idle') return spotted(level, o, m, player) ? change(m, 'walk') : m;
    if (!player.free) return m;
    if (distance(o, m, player) < 1.7 * TILE) return change(m, 'fuse');
    return walk(level, o, m, towards(o, m, player), 1.7);
  },
  charger(level, o, m, player) {
    if (m.mode === 'idle') return spotted(level, o, m, player) && Math.abs(player.feet - (m.y + o.h)) < TILE ? change(m, 'paw', { dir: towards(o, m, player) }) : m;
    if (m.mode === 'paw') return m.age >= 28 ? change(m, 'charge') : m;
    if (m.mode === 'charge') {
      const next = walk(level, o, m, m.dir, 5.4);
      return next.stuck ? change(next, 'stun') : next;
    }
    if (m.mode === 'stun') return m.age >= 70 ? change(m, 'home') : m;
    const back = homeward(level, o, m, 1.2);
    return atHome(o, back) ? rested(o) : back.stuck ? rested(o) : back;
  },
  sniper(level, o, m, player) {
    const bolt = m.bolt && flyBolt(level, m.bolt);
    if (m.mode === 'idle') return { ...m, bolt, ...(m.age > 90 && spotted(level, o, m, player) ? { mode: 'aim', age: 0 } : {}) };
    if (m.age < 40 && !spotted(level, o, m, player)) return { ...rested(o), age: 60, bolt };
    if (m.age < 40) return { ...m, bolt, aim: { x: player.cx, y: player.cy } };
    if (m.age < 55) return { ...m, bolt };
    const { cx, cy } = centreOf(o, m), dx = m.aim.x - cx, dy = m.aim.y - cy, d = Math.hypot(dx, dy) || 1;
    return { ...rested(o), bolt: { x: cx - BOLT_SIZE / 2, y: cy - BOLT_SIZE / 2, vx: (dx / d) * BOLT_SPEED, vy: (dy / d) * BOLT_SPEED, left: BOLT_RANGE } };
  },
  wraith(level, o, m, player) {
    if (m.mode === 'idle') return spotted(level, o, m, player) || (player.free && distance(o, m, player) < LURKERS.wraith.wake) ? change(m, 'hunt') : m;
    if (m.mode === 'home' || !player.free || distance(o, m, player) > 16 * TILE) {
      const back = flyTo(m, o.x, o.y, 2);
      return atHome(o, back) ? rested(o) : { ...back, mode: 'home' };
    }
    const { cx } = centreOf(o, m), watched = player.facing * (cx - player.cx) > 0;
    if (watched) return m.mode === 'shy' ? m : change(m, 'shy');
    const next = flyTo(m, player.cx - o.w / 2, player.cy - o.h / 2, 1.3);
    return m.mode === 'hunt' ? next : change(next, 'hunt');
  },
};

function flyBolt(level, bolt) {
  const x = bolt.x + bolt.vx, y = bolt.y + bolt.vy, left = bolt.left - BOLT_SPEED;
  return left <= 0 || solidAt(level, x + BOLT_SIZE / 2, y + BOLT_SIZE / 2) ? null : { ...bolt, x, y, left };
}

const SUMMIT_ROWS = 6;

export function advanceLurkers(level, s, n, w, h) {
  const { lurkers } = levelIndex(level);
  if (!lurkers.length) return;
  const corridor = (level.rows - 1 - SHOP_ROWS) * TILE;
  const player = { cx: n.x + w / 2, cy: n.y + h / 2, feet: n.y + h, facing: n.facing, corridor, free: n.y + h <= corridor && n.y + h >= SUMMIT_ROWS * TILE };
  n.lurkers = lurkers.map(o => {
    const m = lurkerOf(o, s);
    if (m.dead || erased(s, o)) return m;
    const aged = { ...m, age: m.age + 1 };
    return BEHAVIOURS[o.kind](level, o, aged, player);
  });
}

export function bodyOf(o, m) {
  if (m.dead) return null;
  if (['splat', 'regrow', 'gone', 'blast'].includes(m.mode)) return null;
  if (o.kind === 'snapper') return m.mode === 'bite' ? { x: m.x, y: m.y - BITE_RISE, w: o.w, h: o.h + BITE_RISE } : null;
  return { x: m.x, y: m.y, w: o.w, h: o.h };
}

export function strikesOf(o, m) {
  const strikes = [];
  if (m.dead) return strikes;
  if (m.bolt) strikes.push({ x: m.bolt.x, y: m.bolt.y, w: BOLT_SIZE, h: BOLT_SIZE });
  if (m.mode === 'blast') strikes.push({ x: m.x + o.w / 2 - BLAST_RADIUS, y: m.y + o.h / 2 - BLAST_RADIUS, w: 2 * BLAST_RADIUS, h: 2 * BLAST_RADIUS });
  return strikes;
}

export const dangersOf = (o, m) => { const body = bodyOf(o, m); return body ? [body, ...strikesOf(o, m)] : strikesOf(o, m); };

export const stompable = o => LURKERS[o.kind].stomp;

export function slayLurker(n, o) {
  n.lurkers = n.lurkers.map((m, k) => (k === o.slot ? { ...m, dead: true, bolt: null } : m));
}

export { BLAST_RADIUS, BITE_RISE };
