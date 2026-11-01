import { alpha } from './themes.js?v=b79de16';
import { TAU } from './life-kit.js?v=b79de16';

const box = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
const line = (ctx, x0, y0, x1, y1, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const dot = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const blob = (ctx, x, y, rx, ry, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
const every = (L, step, fn) => { for (let y = step / 2; y < L; y += step) fn(y); };

function rounded(ctx, L, w, c) {
  box(ctx, -w / 2, 0, w, L, c.body);
  box(ctx, -w / 2, 0, w * 0.28, L, c.hi);
  box(ctx, w * 0.22, 0, w * 0.28, L, c.lo);
}

export const MATERIALS = {
  timber(ctx, L, w, c, rng) {
    rounded(ctx, L, w, c);
    every(L, 22, y => line(ctx, -w * 0.3, y, -w * 0.3 + rng.float(-1, 1), y + rng.float(6, 14), 1, c.lo));
    every(L, 64, y => box(ctx, -w / 2 - 1, y, w + 2, 4, c.ink));
  },
  beam(ctx, L, w, c) {
    box(ctx, -w / 2, 0, w, L, c.body);
    box(ctx, -w / 2, 0, 2, L, c.hi);
    every(L, 46, y => { box(ctx, -w / 2 - 2, y, w + 4, 8, c.lo); dot(ctx, 0, y + 4, 1.6, c.hi); });
  },
  bamboo(ctx, L, w, c) {
    rounded(ctx, L, w * 0.8, c);
    every(L, 34, y => { box(ctx, -w * 0.45, y, w * 0.9, 3, c.ink); box(ctx, -w * 0.45, y + 3, w * 0.9, 1, c.hi); });
  },
  spar(ctx, L, w, c) {
    rounded(ctx, L, w * 0.75, c);
    every(L, 70, y => { for (let i = 0; i < 4; i++) line(ctx, -w * 0.45, y + i * 3, w * 0.45, y + i * 3 + 2, 1.5, c.rope); });
  },
  girder(ctx, L, w, c) {
    const half = w / 2, step = w * 0.9;
    ctx.strokeStyle = c.body;
    ctx.lineWidth = Math.max(1.5, w * 0.12);
    ctx.beginPath();
    let side = -1;
    for (let y = 0; y < L; y += step) { ctx.moveTo(side * half, y); ctx.lineTo(-side * half, Math.min(L, y + step)); side = -side; }
    ctx.stroke();
    box(ctx, -half - 2, 0, 4, L, c.hi);
    box(ctx, half - 2, 0, 4, L, c.lo);
    every(L, step, y => { dot(ctx, -half, y, 1.3, c.ink); dot(ctx, half, y, 1.3, c.ink); });
  },
  ibeam(ctx, L, w, c) {
    box(ctx, -w * 0.5, 0, w * 0.22, L, c.hi);
    box(ctx, -w * 0.15, 0, w * 0.3, L, c.lo);
    box(ctx, w * 0.28, 0, w * 0.22, L, c.body);
    every(L, 16, y => { dot(ctx, -w * 0.39, y, 1.1, c.ink); dot(ctx, w * 0.39, y, 1.1, c.ink); });
  },
  pipe(ctx, L, w, c) {
    rounded(ctx, L, w * 0.7, c);
    every(L, 84, y => { box(ctx, -w * 0.5, y, w, 6, c.lo); box(ctx, -w * 0.5, y, w, 2, c.hi); dot(ctx, -w * 0.3, y + 3, 1, c.ink); dot(ctx, w * 0.3, y + 3, 1, c.ink); });
  },
  column(ctx, L, w, c) {
    rounded(ctx, L, w * 0.82, c);
    for (const x of [-0.2, 0, 0.2]) line(ctx, x * w, 8, x * w, L - 8, 1, c.lo);
    every(L, 52, y => box(ctx, -w * 0.41, y, w * 0.82, 1.5, c.lo));
    box(ctx, -w * 0.62, 0, w * 1.24, 6, c.hi);
    box(ctx, -w * 0.52, 6, w * 1.04, 4, c.lo);
    box(ctx, -w * 0.6, L - 6, w * 1.2, 6, c.lo);
  },
  pier(ctx, L, w, c) {
    box(ctx, -w / 2, 0, w, L, c.body);
    for (let y = 0, row = 0; y < L; y += 9, row++) {
      box(ctx, -w / 2, y, w, 1, c.lo);
      for (let x = -w / 2 + (row % 2 ? w / 4 : 0); x < w / 2; x += w / 2) box(ctx, x, y, 1, Math.min(9, L - y), c.lo);
    }
    box(ctx, -w / 2, 0, 2, L, c.hi);
  },
  cluster(ctx, L, w, c) {
    for (const [x, tone] of [[-0.3, c.hi], [0.3, c.lo], [0, c.body]]) box(ctx, x * w - w * 0.18, 0, w * 0.36, L, tone);
    every(L, 78, y => { box(ctx, -w * 0.55, y, w * 1.1, 5, c.hi); box(ctx, -w * 0.55, y + 5, w * 1.1, 2, c.lo); });
  },
  bones(ctx, L, w, c) {
    box(ctx, -w * 0.12, 0, w * 0.24, L, c.lo);
    every(L, 16, y => { blob(ctx, 0, y, w * 0.36, 5, c.hi); line(ctx, -w * 0.5, y + 1, w * 0.5, y + 1, 2, c.body); });
  },
  trunk(ctx, L, w, c, rng) {
    const wobble = rng.float(-5, 5);
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, 0);
    ctx.bezierCurveTo(-w * 0.4 + wobble, L * 0.35, -w * 0.3 - wobble, L * 0.7, -w * 0.8, L);
    ctx.lineTo(w * 0.8, L);
    ctx.bezierCurveTo(w * 0.34 - wobble, L * 0.7, w * 0.42 + wobble, L * 0.35, w * 0.34, 0);
    ctx.closePath();
    ctx.fill();
    every(L, 15, y => { const x = rng.float(-w * 0.25, w * 0.25); line(ctx, x, y, x + rng.float(-1.5, 1.5), y + rng.float(5, 11), 1, c.lo); });
    if (L > 90) { blob(ctx, rng.float(-3, 3), L * rng.float(0.3, 0.7), 2.5, 4, c.lo); }
  },
  roots(ctx, L, w, c, rng) {
    for (let k = -1; k <= 1; k++) {
      const a = rng.float(-8, 8), b = rng.float(-8, 8);
      ctx.strokeStyle = k ? c.lo : c.body;
      ctx.lineWidth = w * (k ? 0.28 : 0.4);
      ctx.beginPath();
      ctx.moveTo(k * w * 0.22, 0);
      ctx.bezierCurveTo(k * w * 0.2 + a, L * 0.33, k * w * 0.2 + b, L * 0.66, k * w * 0.55, L);
      ctx.stroke();
    }
  },
  stalk(ctx, L, w, c) {
    rounded(ctx, L, w * 0.5, c);
    every(L, 58, y => { blob(ctx, 0, y, w * 0.36, 3, c.hi); });
    blob(ctx, 0, L, w * 0.6, 7, c.lo);
  },
  shard(ctx, L, w, c, rng) {
    for (let y = 0; y < L;) {
      const h = Math.min(L - y, rng.float(34, 64)), lean = rng.float(-3, 3);
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.moveTo(-w * 0.32, y); ctx.lineTo(w * 0.32, y); ctx.lineTo(w * 0.42 + lean, y + h); ctx.lineTo(-w * 0.42 + lean, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.hi;
      ctx.beginPath(); ctx.moveTo(-w * 0.32, y); ctx.lineTo(0, y); ctx.lineTo(lean - w * 0.08, y + h); ctx.lineTo(-w * 0.42 + lean, y + h); ctx.closePath(); ctx.fill();
      y += h;
    }
  },
  icicle(ctx, L, w, c, rng) {
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, 0);
    for (let y = 16; y < L; y += 16) ctx.lineTo(-w * 0.3 + rng.float(-3, 3), y);
    ctx.lineTo(-w * 0.55, L); ctx.lineTo(w * 0.55, L);
    for (let y = L - 16; y > 0; y -= 16) ctx.lineTo(w * 0.3 + rng.float(-3, 3), y);
    ctx.lineTo(w * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    line(ctx, -w * 0.1, 6, -w * 0.14, L - 6, 2, c.hi);
  },
  wire(ctx, L, w, c) {
    const step = w * 1.1;
    ctx.strokeStyle = c.wire;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-w / 2, 0, w, L);
    ctx.beginPath();
    for (let y = 0; y < L; y += step) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, Math.min(L, y + step)); ctx.moveTo(w / 2, y); ctx.lineTo(-w / 2, Math.min(L, y + step)); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); }
    ctx.stroke();
  },
  conduit(ctx, L, w, c) {
    for (const x of [-0.32, 0, 0.32]) { box(ctx, x * w - 1, 0, 2, L, c.wire); }
    every(L, 40, y => { box(ctx, -w * 0.42, y, w * 0.84, 7, c.body); box(ctx, -w * 0.3, y + 2, 4, 3, c.wire); });
  },
  glyphs(ctx, L, w, c, rng) {
    box(ctx, -w * 0.34, 0, w * 0.68, L, c.body);
    every(L, 11, y => { if (rng.chance(0.7)) box(ctx, rng.float(-w * 0.26, w * 0.1), y, rng.float(3, w * 0.3), 5, c.wire); });
  },
  strata(ctx, L, w, c, rng) {
    for (let y = 0; y < L;) {
      const h = Math.min(L - y, rng.float(9, 20)), half = w * rng.float(0.34, 0.6), lean = rng.float(-2.5, 2.5);
      ctx.fillStyle = rng.chance(0.5) ? c.body : c.lo;
      ctx.beginPath(); ctx.roundRect(lean - half, y, half * 2, h, 4); ctx.fill();
      y += h;
    }
  },
  basalt(ctx, L, w, c, rng) {
    const n = 3;
    for (let k = 0; k < n; k++) {
      const x = (k - 1) * w * 0.32, top = rng.float(0, Math.min(14, L * 0.2));
      box(ctx, x - w * 0.16, top, w * 0.32, L - top, k === 0 ? c.hi : k === 1 ? c.body : c.lo);
      for (let y = top + rng.float(12, 40); y < L; y += rng.float(24, 60)) line(ctx, x - w * 0.16, y, x + w * 0.16, y + rng.float(-3, 3), 1, c.ink);
    }
  },
  cane(ctx, L, w, c) {
    box(ctx, -w * 0.36, 0, w * 0.72, L, c.hi);
    ctx.save();
    ctx.beginPath(); ctx.rect(-w * 0.36, 0, w * 0.72, L); ctx.clip();
    for (let y = -w; y < L + w; y += 18) { ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y - w * 0.7); ctx.lineTo(w, y - w * 0.7 + 8); ctx.lineTo(-w, y + 8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  },
  wafer(ctx, L, w, c) {
    for (let y = 0, k = 0; y < L; y += 9, k++) box(ctx, -w * 0.5, y, w, Math.min(9, L - y), k % 2 ? c.hi : c.trim);
    every(L, 36, y => box(ctx, -w * 0.5, y, w, 1, c.lo));
  },
  marquee(ctx, L, w, c) {
    box(ctx, -w * 0.42, 0, w * 0.84, L, c.body);
    box(ctx, -w * 0.42, 0, 2, L, c.hi);
    every(L, 15, y => dot(ctx, 0, y, 2.4, c.bulb));
  },
  lacquer(ctx, L, w, c) {
    rounded(ctx, L, w * 0.72, c);
    every(L, 76, y => { box(ctx, -w * 0.48, y, w * 0.96, 5, c.trim); box(ctx, -w * 0.48, y + 5, w * 0.96, 1, c.ink); });
  },
  comb(ctx, L, w, c) {
    const r = w * 0.32;
    for (let y = r, k = 0; y < L; y += r * 1.6, k++) {
      const x = k % 2 ? r * 0.9 : -r * 0.9;
      ctx.fillStyle = k % 3 ? c.body : c.trim;
      ctx.strokeStyle = c.lo;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) ctx.lineTo(x + Math.cos(a * TAU / 6) * r, y + Math.sin(a * TAU / 6) * r);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },
  wax(ctx, L, w, c, rng) {
    rounded(ctx, L, w * 0.55, c);
    every(L, 40, y => blob(ctx, rng.chance(0.5) ? -w * 0.3 : w * 0.3, y, 4, rng.float(7, 14), c.hi));
  },
  coral(ctx, L, w, c, rng) {
    rounded(ctx, L, w * 0.5, c);
    every(L, 18, y => { const side = rng.chance(0.5) ? -1 : 1; blob(ctx, side * w * 0.3, y, rng.float(3, 6), rng.float(3, 5), rng.chance(0.3) ? c.trim : c.body); });
  },
  kelp(ctx, L, w, c) {
    ctx.strokeStyle = c.body;
    ctx.lineWidth = w * 0.26;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y < L; y += 12) ctx.lineTo(Math.sin(y / 18) * w * 0.28, y);
    ctx.stroke();
    every(L, 26, y => { const x = Math.sin(y / 18) * w * 0.28, side = Math.round(y / 26) % 2 ? 1 : -1; ctx.fillStyle = c.hi; ctx.beginPath(); ctx.ellipse(x + side * w * 0.32, y, w * 0.32, 4, side * 0.5, 0, TAU); ctx.fill(); });
  },
  puffs(ctx, L, w, c, rng) {
    box(ctx, -1, 0, 2, L, c.lo);
    for (let y = rng.float(10, 40); y < L; y += rng.float(40, 90)) {
      for (let k = 0; k < 3; k++) dot(ctx, (k - 1) * w * 0.5, y + (k === 1 ? -4 : 2), w * rng.float(0.4, 0.6), c.mist);
    }
  },
  sketch(ctx, L, w, c, rng) {
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [-w / 2, w / 2]) for (let k = 0; k < 2; k++) { ctx.moveTo(x + rng.float(-1, 1), -2); ctx.lineTo(x + rng.float(-1, 1), L + 2); }
    for (let y = 8; y < L; y += 11) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y - 7); }
    ctx.stroke();
  },
  ruled(ctx, L, w, c, rng) {
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    for (const x of [-w / 2, w / 2]) { ctx.moveTo(x, 0); ctx.lineTo(x + rng.float(-1, 1), L); }
    ctx.stroke();
    ctx.setLineDash([]);
    every(L, 30, y => line(ctx, -w / 2 - 3, y, w / 2 + 3, y, 1, c.ink));
  },
  books(ctx, L, w, c, rng) {
    for (let y = 0; y < L;) {
      const h = Math.min(L - y, rng.float(7, 14)), half = w * rng.float(0.42, 0.62), hue = rng.pick(c.spines);
      box(ctx, -half + rng.float(-2, 2), y, half * 2, h, hue);
      box(ctx, -half * 0.5, y + h * 0.35, half, 1, c.hi);
      y += h;
    }
  },
  cabinets(ctx, L, w, c) {
    for (let y = 0; y < L; y += 26) {
      box(ctx, -w / 2, y, w, Math.min(25, L - y), c.body);
      box(ctx, -w / 2, y, w, 2, c.hi);
      if (y + 16 < L) box(ctx, -5, y + 12, 10, 3, c.lo);
    }
  },
  rope(ctx, L, w, c) {
    line(ctx, 0, 0, 0, L, Math.max(2, w * 0.35), c.rope);
    every(L, 6, y => line(ctx, -1.2, y, 1.2, y + 3, 0.8, c.lo));
  },
  chain(ctx, L, w, c) {
    ctx.strokeStyle = c.lo;
    ctx.lineWidth = 1.5;
    for (let y = 0, k = 0; y < L; y += 7, k++) { ctx.beginPath(); ctx.ellipse(0, y + 3.5, k % 2 ? 1 : 2.4, 4.2, 0, 0, TAU); ctx.stroke(); }
  },
  rod(ctx, L, w, c) {
    box(ctx, -1, 0, 2, L, c.lo);
    if (L > 30) { box(ctx, -2.5, L * 0.5 - 7, 5, 14, c.body); box(ctx, -1, L * 0.5 - 4, 2, 8, c.hi); }
  },
  vine(ctx, L, w, c) {
    ctx.strokeStyle = c.leaf;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y < L; y += 8) ctx.lineTo(Math.sin(y / 10) * 3, y);
    ctx.stroke();
    every(L, 15, y => { const side = Math.round(y / 15) % 2 ? 1 : -1; ctx.fillStyle = c.leaf; ctx.beginPath(); ctx.ellipse(Math.sin(y / 10) * 3 + side * 4, y, 4, 2, side * 0.6, 0, TAU); ctx.fill(); });
  },
  web(ctx, L, w, c) {
    ctx.strokeStyle = alpha(c.hi, 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const x of [-1.5, 0, 1.5]) { ctx.moveTo(x, 0); ctx.lineTo(x * 0.3, L); }
    ctx.stroke();
  },
  silk(ctx, L, w, c) {
    line(ctx, 0, 0, 0, L, 1.5, c.trim);
    every(L, 22, y => dot(ctx, 0, y, 2, c.trim));
  },
};

export { box, line, dot, blob };
