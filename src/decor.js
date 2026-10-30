import { TILE, HEIGHT, SOLID, tileAt } from './level.js?v=a3cd24e';
import { levelRng } from './rng.js?v=a3cd24e';
import { TAU, spans } from './life-kit.js?v=a3cd24e';
import { alpha } from './themes.js?v=a3cd24e';

const ANIMATED_PER_SCREEN = 2;
const DETAIL_CHANCE = 0.75;
const CHIP_CHANCE = 0.3;
const STALACTITE_CHANCE = 0.35;
const VIEW_MARGIN = 80;
const PUPIL = 'hsl(240 30% 10%)';
export const ANIMATED_KINDS = ['eyes', 'bug', 'glint', 'drip'];
const FACE_KINDS = ['pebbles', 'tuft', 'band', 'patch', 'crack'];

function runs(level) {
  const found = [];
  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  for (const side of ['top', 'bottom']) {
    const below = side === 'top' ? -1 : 1;
    for (let row = side === 'top' ? 1 : 0; row < level.rows - (side === 'top' ? 0 : 1); row++) {
      for (const [start, end] of spans(col => solid(col, row) && !solid(col, row + below))) found.push({ side, row, x0: start * TILE, x1: end * TILE, y: side === 'top' ? row * TILE : (row + 1) * TILE, leftOpen: !solid(start - 1, row), rightOpen: !solid(end, row) });
    }
  }
  return found;
}

const DETAILS = {
  pebbles: (rng, run) => ({ dots: Array.from({ length: rng.int(3, 6) }, () => ({ x: rng.float(run.x0 + 4, run.x1 - 4), y: run.y + rng.float(5, 24), r: rng.float(1, 2.4) })) }),
  tuft: (rng, run) => {
    const x = rng.float(run.x0 + 6, run.x1 - 6);
    return { blades: Array.from({ length: rng.int(2, 4) }, (_, i) => ({ x: x + i * 3 - 3, y: run.y, lean: rng.float(-4, 4), len: rng.float(5, 10) })) };
  },
  band: (rng, run) => ({ x0: run.x0 + 2, x1: run.x1 - 2, y: run.y + rng.float(12, 20) }),
  patch: (rng, run) => ({ x: rng.float(run.x0 + 8, run.x1 - 8), y: run.y + rng.float(10, 20), rx: rng.float(6, 12), ry: rng.float(3, 6) }),
  crack: (rng, run) => {
    const x = rng.float(run.x0 + 6, run.x1 - 12);
    return { points: Array.from({ length: 4 }, (_, i) => [x + i * rng.float(1, 4), run.y + 3 + i * 7 + rng.float(-2, 2)]) };
  },
};

function chips(rng, run) {
  const corner = run.side === 'top' ? 't' : 'b';
  return [['l', run.leftOpen, run.x0], ['r', run.rightOpen, run.x1]].filter(([, open]) => open && rng.chance(CHIP_CHANCE))
    .map(([edge, , x]) => ({ kind: 'chip', x, y: run.y, size: rng.float(run.side === 'top' ? 4 : 6, run.side === 'top' ? 6 : 10), corner: corner + edge }));
}

function stalactites(rng, run) {
  const length = run.x1 - run.x0;
  return { kind: 'stalactites', y: run.y, spikes: Array.from({ length: rng.int(1, Math.max(1, Math.min(4, length / 40))) }, () => ({ x: rng.float(run.x0 + 5, run.x1 - 5), w: rng.float(3, 6), len: rng.float(5, 12) })) };
}

function animate(rng, kind, run) {
  const x = rng.float(run.x0 + 10, run.x1 - 10);
  const phase = rng.float(0, 100);
  switch (kind) {
    case 'eyes': return { kind, x, y: run.y + 15, phase, cycle: rng.float(2.5, 5) };
    case 'bug': return { kind, x0: run.x0 + 6, x1: run.x1 - 6, x, y: run.y, phase, speed: rng.float(9, 16) };
    case 'glint': return { kind, x: rng.chance(0.5) ? run.x0 + 3 : run.x1 - 3, y: run.y + 3, phase, rate: rng.float(0.9, 1.6) };
    default: return { kind, x, y: run.y, phase, cycle: rng.float(2.4, 4.2) };
  }
}

export function growDecor(level) {
  const rng = levelRng(level, 'decor', 17, 5);
  const statics = [], animated = [];
  const all = runs(level);
  for (const run of all) {
    statics.push(...chips(rng, run));
    if (run.side === 'bottom') {
      if (rng.chance(STALACTITE_CHANCE)) statics.push(stalactites(rng, run));
      continue;
    }
    if (!rng.chance(DETAIL_CHANCE)) continue;
    for (const kind of rng.shuffle(FACE_KINDS).slice(0, rng.int(1, 2))) statics.push({ kind, ...DETAILS[kind](rng, run) });
  }
  const wide = rng.shuffle(all.filter(run => run.x1 - run.x0 >= 2 * TILE));
  const count = Math.min(wide.length, Math.round((level.height / HEIGHT) * ANIMATED_PER_SCREEN));
  for (const run of wide.slice(0, count)) {
    const kinds = run.side === 'top' ? ['eyes', 'bug', 'glint', 'eyes'] : ['drip', 'drip', 'glint'];
    animated.push(animate(rng, rng.pick(kinds), run));
  }
  return { statics, animated };
}

function paintChip(ctx, p, theme, chip) {
  const sx = chip.corner[1] === 'l' ? 1 : -1, sy = chip.corner[0] === 't' ? 1 : -1;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(chip.x, chip.y);
  ctx.lineTo(chip.x + sx * chip.size, chip.y);
  ctx.lineTo(chip.x, chip.y + sy * chip.size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = theme.outline ? p.ink : p.rockEdge;
  ctx.lineWidth = theme.outline || 2;
  ctx.beginPath();
  ctx.moveTo(chip.x + sx * chip.size, chip.y);
  ctx.lineTo(chip.x, chip.y + sy * chip.size);
  ctx.stroke();
}

const PAINTERS = {
  pebbles(ctx, p, d) {
    ctx.fillStyle = p.rockDeep;
    for (const dot of d.dots) { ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, TAU); ctx.fill(); }
  },
  tuft(ctx, p, d) {
    ctx.strokeStyle = p.rockEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const b of d.blades) { ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + b.lean * 0.3, b.y - b.len * 0.6, b.x + b.lean, b.y - b.len); }
    ctx.stroke();
  },
  band(ctx, p, d) {
    ctx.fillStyle = alpha(p.rockDeep, 0.35);
    ctx.fillRect(d.x0, d.y, d.x1 - d.x0, 3);
  },
  patch(ctx, p, d) {
    ctx.fillStyle = alpha(p.rockEdge, 0.2);
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, TAU); ctx.fill();
  },
  crack(ctx, p, d) {
    ctx.strokeStyle = p.rockDeep;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    d.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  },
  stalactites(ctx, p, d) {
    ctx.fillStyle = p.rockDeep;
    for (const s of d.spikes) { ctx.beginPath(); ctx.moveTo(s.x - s.w / 2, d.y); ctx.lineTo(s.x + s.w / 2, d.y); ctx.lineTo(s.x, d.y + s.len); ctx.closePath(); ctx.fill(); }
  },
};

export function paintDecor(ctx, decor, p, theme) {
  for (const d of decor.statics) {
    if (d.kind === 'chip') paintChip(ctx, p, theme, d);
    else PAINTERS[d.kind](ctx, p, d);
  }
}

const triangle = t => { const u = t % 2; return u < 1 ? u : 2 - u; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ANIMATORS = {
  eyes(ctx, p, d, t, view) {
    const closed = ((t + d.phase) % d.cycle) < 0.13;
    const gx = clamp((view.playerX - d.x) / 150, -1, 1) * 1.6, gy = clamp((view.playerY - d.y) / 150, -1, 1) * 1.2;
    for (const side of [-1, 1]) {
      const ex = d.x + side * 5;
      if (closed) {
        ctx.strokeStyle = PUPIL;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ex - 3.5, d.y); ctx.lineTo(ex + 3.5, d.y); ctx.stroke();
        continue;
      }
      ctx.fillStyle = p.text;
      ctx.beginPath(); ctx.ellipse(ex, d.y, 3.6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = PUPIL;
      ctx.beginPath(); ctx.arc(ex + gx, d.y + gy, 1.6, 0, TAU); ctx.fill();
    }
  },
  bug(ctx, p, d, t) {
    const span = d.x1 - d.x0, u = t * d.speed / span + d.phase;
    const x = d.x0 + span * triangle(u), dir = u % 2 < 1 ? 1 : -1, y = d.y - 2.5;
    ctx.fillStyle = ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const wiggle = Math.sin(t * 22 + i * 2) * 1.5, lx = x - 2.5 + i * 2.5;
      ctx.moveTo(lx, y); ctx.lineTo(lx - 1.5 + wiggle, d.y);
    }
    ctx.moveTo(x + dir * 3, y - 1); ctx.lineTo(x + dir * 7, y - 4);
    ctx.moveTo(x + dir * 3, y - 1); ctx.lineTo(x + dir * 6, y - 5);
    ctx.stroke();
  },
  glint(ctx, p, d, t) {
    const a = Math.max(0, Math.sin(t * d.rate + d.phase)) ** 8;
    if (a < 0.03) return;
    const r = 3 + a * 4;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.text;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - r); ctx.quadraticCurveTo(d.x, d.y, d.x + r, d.y); ctx.quadraticCurveTo(d.x, d.y, d.x, d.y + r); ctx.quadraticCurveTo(d.x, d.y, d.x - r, d.y); ctx.quadraticCurveTo(d.x, d.y, d.x, d.y - r);
    ctx.fill();
    ctx.restore();
  },
  drip(ctx, p, d, t) {
    const u = ((t + d.phase) % d.cycle) / d.cycle;
    const falling = u > 0.65, k = falling ? (u - 0.65) / 0.35 : u / 0.65;
    const r = falling ? 2.4 : 0.8 + k * 1.6, y = d.y + r + (falling ? k * k * 70 : 0);
    ctx.save();
    ctx.globalAlpha = falling ? 1 - k * 0.6 : 1;
    ctx.fillStyle = p.waterLine;
    ctx.beginPath(); ctx.ellipse(d.x, y, r * 0.8, r, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

export function drawDecor(ctx, decor, p, view) {
  const t = view.time / 1000;
  for (const d of decor.animated) {
    if (d.y < view.top - VIEW_MARGIN || d.y > view.bottom + VIEW_MARGIN) continue;
    ANIMATORS[d.kind](ctx, p, d, t, view);
  }
}
