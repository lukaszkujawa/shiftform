import { COLS } from './level.js';

export const TAU = Math.PI * 2;

export function spans(isExposed) {
  const found = [];
  let start = -1;
  for (let col = 0; col <= COLS; col++) {
    const exposed = col < COLS && isExposed(col);
    if (exposed && start < 0) start = col;
    if (!exposed && start >= 0) {
      found.push([start, col]);
      start = -1;
    }
  }
  return found;
}

export function branch(segments, x, y, len, angle, depth, rng, spread) {
  const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
  segments.push([x, y, ex, ey]);
  if (depth <= 0) return segments;
  const forks = rng.int(2, 3);
  for (let i = 0; i < forks; i++) branch(segments, ex, ey, len * rng.float(0.55, 0.75), angle + rng.float(-spread, spread), depth - 1, rng, spread);
  return segments;
}

export const strokeSegments = segments => p => { for (const [x0, y0, x1, y1] of segments) { p.moveTo(x0, y0); p.lineTo(x1, y1); } };

export function stemPoint(len, lean, t) {
  const u = 1 - t;
  return [2 * u * t * lean * len * 0.5 + t * t * lean * len, 2 * u * t * -len * 0.5 + t * t * -len];
}

export function frond(p, len, leaflets, lean) {
  p.moveTo(0, 0);
  p.quadraticCurveTo(lean * len * 0.5, -len * 0.5, lean * len, -len);
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1), [sx, sy] = stemPoint(len, lean, t), w = len * 0.22 * (1 - t);
    for (const side of [-1, 1]) {
      p.moveTo(sx, sy);
      p.quadraticCurveTo(sx + side * w * 0.5, sy - w * 0.3, sx + side * w, sy - w * 0.1);
    }
  }
}

export function blobPoints(cx, cy, r, wobble, rng, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU, rr = r * (1 + rng.float(-wobble, wobble));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
}

export function blob(p, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  p.moveTo(...mid(pts[n - 1], pts[0]));
  for (let i = 0; i < n; i++) p.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
  p.closePath();
}

export function polygon(p, cx, cy, r, sides, rot = 0, stretch = 1) {
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * stretch;
    if (i) p.lineTo(x, y);
    else p.moveTo(x, y);
  }
  p.closePath();
}

export function segmented(g, count, spacing, radius, wave, t) {
  for (let i = 0; i < count; i++) {
    g.beginPath();
    g.arc(-i * spacing, Math.sin(t * 3 + i * 0.6) * wave, radius * (1 - i / (count + 2)), 0, TAU);
    g.fill();
  }
}

export function wings(g, x, y, span, flap) {
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + side * span * 0.5, y - span * 0.6 * flap, x + side * span, y - span * 0.25 * flap);
    g.quadraticCurveTo(x + side * span * 0.5, y + span * 0.15, x, y);
    g.fill();
  }
}

const SHINE = { from: 1.4, size: 0.38, colour: 'hsl(0 0% 100% / 0.9)' };

export function eye(g, x, y, r, open, ink) {
  g.fillStyle = ink;
  oval(g, x, y, r, Math.max(0.2, r * open));
  if (open < 1 || r < SHINE.from) return;
  g.fillStyle = SHINE.colour;
  dot(g, x + r * 0.35, y - r * 0.35, r * SHINE.size);
  g.fillStyle = ink;
}

export const blink = (t, phase) => (Math.sin(t * 2.3 + phase) > 0.93 ? 0.1 : 1);
export const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
export const oval = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); };
export const poly = (g, x, y, ...rest) => {
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i < rest.length; i += 2) g.lineTo(rest[i], rest[i + 1]);
  g.closePath();
  g.fill();
};
export const part = (build, mode, color, width = 1.5, extra = {}) => ({ build, mode, color, width, ...extra });

export function boundsOf(build, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const see = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const round = (x, y, rx, ry = rx) => { see(x - rx, y - ry); see(x + rx, y + ry); };
  build({
    moveTo: see, lineTo: see, closePath() {},
    quadraticCurveTo: (cx, cy, x, y) => { see(cx, cy); see(x, y); },
    bezierCurveTo: (ax, ay, bx, by, x, y) => { see(ax, ay); see(bx, by); see(x, y); },
    arc: (x, y, r) => round(x, y, r), ellipse: (x, y, rx, ry) => round(x, y, Math.max(rx, ry)),
    rect: (x, y, w, h) => { see(x, y); see(x + w, y + h); },
  });
  return x0 === Infinity ? { x: -pad, y: -pad, w: 2 * pad, h: 2 * pad } : { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}
export const members = (rng, count, spread) => Array.from({ length: count }, (_, i) => ({ dx: i * spread * 0.9 + rng.float(-spread * 0.3, spread * 0.3), dy: Math.sin(i * 1.3) * spread * 0.5 + rng.float(-6, 6), phase: rng.float(0, TAU) }));
