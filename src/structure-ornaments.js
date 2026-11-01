import { TAU } from './life-kit.js';
import { box, line, dot, blob } from './structure-materials.js';
import { alpha } from './themes.js';

const hook = (ctx, c, L) => line(ctx, 0, 0, 0, L, 1.5, c.lo);
const glow = (c, x, y, r, color, a = 0.5) => c.lit.push(g => {
  const fade = g.createRadialGradient(x, y, 0, x, y, r);
  fade.addColorStop(0, alpha(color, a));
  fade.addColorStop(1, alpha(color, 0));
  g.fillStyle = fade;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
});
const lamp = (c, x, y, r, color) => { glow(c, x, y, r * 3, color, 0.32); c.lit.push(g => { g.fillStyle = alpha(color, 0.85); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); };
const spin = (c, kind, x, y, r) => c.spinning.push({ kind, x, y, r });

export const ORNAMENTS = {
  lantern(ctx, c) {
    hook(ctx, c, 14);
    box(ctx, -6, 14, 12, 3, c.lo); box(ctx, -5, 30, 10, 3, c.lo);
    line(ctx, -5, 17, -5, 30, 1.5, c.lo); line(ctx, 5, 17, 5, 30, 1.5, c.lo);
    lamp(c, 0, 23, 4, c.window);
  },
  paperLantern(ctx, c) {
    hook(ctx, c, 12);
    blob(ctx, 0, 26, 11, 14, c.trim);
    for (const x of [-5, 0, 5]) line(ctx, x, 13, x * 1.3, 39, 0.8, c.lo);
    box(ctx, -5, 11, 10, 3, c.ink); box(ctx, -5, 39, 10, 3, c.ink);
    line(ctx, 0, 42, 0, 54, 2, c.trim);
    glow(c, 0, 26, 28, c.window, 0.36);
  },
  pulley(ctx, c) {
    box(ctx, -1.5, 0, 3, 9, c.lo);
    dot(ctx, 0, 15, 8, c.body); dot(ctx, 0, 15, 3, c.hi);
    line(ctx, -8, 15, -8, 62, 1.5, c.rope); line(ctx, 8, 15, 8, 40, 1.5, c.rope);
    box(ctx, 3, 40, 10, 11, c.lo);
  },
  bucket(ctx, c) {
    hook(ctx, c, 16);
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.moveTo(-9, 16); ctx.lineTo(9, 16); ctx.lineTo(6, 32); ctx.lineTo(-6, 32); ctx.closePath(); ctx.fill();
    box(ctx, -9, 20, 18, 2, c.lo); box(ctx, -7, 27, 14, 2, c.lo);
  },
  sack(ctx, c) {
    hook(ctx, c, 12);
    blob(ctx, 0, 27, 10, 15, c.body);
    line(ctx, -4, 14, 4, 14, 2, c.rope);
  },
  anchor(ctx, c) {
    line(ctx, 0, 0, 0, 40, 3, c.lo);
    dot(ctx, 0, 6, 3, c.hi);
    line(ctx, -9, 12, 9, 12, 2, c.lo);
    ctx.strokeStyle = c.lo; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 26, 14, 0.2, Math.PI - 0.2); ctx.stroke();
  },
  lifering(ctx, c) {
    hook(ctx, c, 6);
    ctx.strokeStyle = c.trim; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 19, 11, 0, TAU); ctx.stroke();
    ctx.strokeStyle = c.hi;
    for (const a of [0, 1.6, 3.2, 4.8]) { ctx.beginPath(); ctx.arc(0, 19, 11, a, a + 0.5); ctx.stroke(); }
  },
  skullFlag(ctx, c) {
    box(ctx, -1, -44, 2, 44, c.lo);
    ctx.fillStyle = c.ink; ctx.fillRect(1, -44, 28, 18);
    dot(ctx, 15, -36, 4.5, c.hi);
    line(ctx, 8, -30, 22, -28, 1.5, c.hi);
  },
  gear(ctx, c) { spin(c, 'gear', 0, 0, 20); dot(ctx, 0, 0, 5, c.lo); },
  bigGear(ctx, c) { spin(c, 'gear', 0, 0, 34); dot(ctx, 0, 0, 7, c.lo); },
  fan(ctx, c) {
    ctx.strokeStyle = c.lo; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
    spin(c, 'fan', 0, 0, 17);
  },
  floodlight(ctx, c) {
    line(ctx, 0, 0, 12, -8, 3, c.lo);
    box(ctx, 8, -18, 13, 11, c.body);
    glow(c, 16, -12, 30, c.window, 0.4);
  },
  bracketLamp(ctx, c) {
    line(ctx, 0, 0, 16, 0, 2.5, c.lo);
    line(ctx, 16, 0, 16, 7, 1.5, c.lo);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(24, 12); ctx.lineTo(19, 6); ctx.lineTo(13, 6); ctx.closePath(); ctx.fill();
    lamp(c, 16, 14, 3, c.window);
  },
  valve(ctx, c) {
    line(ctx, 0, 0, 0, 12, 4, c.lo);
    ctx.strokeStyle = c.trim; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 18, 8, 0, TAU); ctx.stroke();
    line(ctx, -8, 18, 8, 18, 2, c.trim); line(ctx, 0, 10, 0, 26, 2, c.trim);
  },
  hook(ctx, c) {
    line(ctx, 0, 0, 0, 44, 2, c.lo);
    box(ctx, -7, 44, 14, 8, c.body);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 60, 7, -1.3, Math.PI * 1.1); ctx.stroke();
  },
  sign(ctx, c) {
    hook(ctx, c, 9);
    box(ctx, -18, 9, 36, 16, c.trim);
    box(ctx, -14, 13, 28, 2, c.ink); box(ctx, -14, 18, 18, 2, c.ink);
  },
  blinker(ctx, c) {
    line(ctx, 0, 0, 0, -18, 2, c.lo);
    spin(c, 'blink', 0, -21, 3.5);
  },
  dish(ctx, c) {
    line(ctx, 0, 0, 0, -18, 3, c.lo);
    ctx.fillStyle = c.hi;
    ctx.beginPath(); ctx.arc(2, -24, 15, 0.6, 0.6 + Math.PI); ctx.closePath(); ctx.fill();
    line(ctx, 2, -24, 14, -35, 1.5, c.lo);
    dot(ctx, 14, -35, 2, c.trim);
  },
  antenna(ctx, c) {
    line(ctx, 0, 0, 0, -46, 2, c.lo);
    for (let k = 0; k < 4; k++) line(ctx, -9 + k * 2, -14 - k * 9, 9 - k * 2, -14 - k * 9, 1.5, c.lo);
    spin(c, 'blink', 0, -48, 2.5);
  },
  solarWing(ctx, c) {
    line(ctx, 0, 0, 26, 0, 2, c.lo);
    for (const x of [14, 26]) { box(ctx, x, -14, 11, 28, c.ink); line(ctx, x, 0, x + 11, 0, 1, c.wire); line(ctx, x + 5, -14, x + 5, 14, 1, c.wire); }
  },
  pod(ctx, c) {
    hook(ctx, c, 8);
    blob(ctx, 0, 22, 11, 14, c.hi);
    glow(c, 0, 22, 22, c.window, 0.28);
    box(ctx, -4, 18, 8, 6, c.ink);
  },
  neonRing(ctx, c) {
    c.lit.push(g => { g.strokeStyle = alpha(c.wire, 0.85); g.lineWidth = 2; g.beginPath(); g.arc(0, 22, 13, 0, TAU); g.stroke(); });
    glow(c, 0, 22, 26, c.wire, 0.2);
    hook(ctx, c, 9);
  },
  neonBar(ctx, c) {
    c.lit.push(g => { g.fillStyle = alpha(c.wire, 0.8); g.fillRect(-16, 12, 32, 3); g.fillRect(-10, 19, 20, 3); });
    hook(ctx, c, 12);
  },
  neonTriangle(ctx, c) {
    hook(ctx, c, 8);
    c.lit.push(g => { g.strokeStyle = alpha(c.wire, 0.85); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 8); g.lineTo(14, 32); g.lineTo(-14, 32); g.closePath(); g.stroke(); });
  },
  glyphBox(ctx, c, rng) {
    hook(ctx, c, 8);
    box(ctx, -12, 8, 24, 24, c.body);
    for (let y = 12; y < 28; y += 5) c.lit.push(g => { g.fillStyle = alpha(c.wire, 0.7); g.fillRect(-9, y, rng.float(6, 18), 2); });
  },
  gargoyle(ctx, c) {
    ctx.fillStyle = c.lo;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(18, -10); ctx.lineTo(30, -4); ctx.lineTo(25, 2); ctx.lineTo(28, 9); ctx.lineTo(17, 6); ctx.lineTo(10, 14); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(4, -24); ctx.lineTo(16, -9); ctx.closePath(); ctx.fill();
    dot(ctx, 22, -4, 1.5, c.hi);
  },
  shield(ctx, c) {
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.moveTo(-11, -9); ctx.lineTo(11, -9); ctx.lineTo(11, 3); ctx.quadraticCurveTo(9, 13, 0, 17); ctx.quadraticCurveTo(-9, 13, -11, 3); ctx.closePath(); ctx.fill();
    line(ctx, 0, -9, 0, 17, 2, c.hi); line(ctx, -11, -1, 11, -1, 2, c.hi);
  },
  candle(ctx, c) {
    line(ctx, 0, 0, 13, 0, 2, c.lo);
    box(ctx, 9, -2, 8, 3, c.lo);
    box(ctx, 11, -13, 4, 11, c.hi);
    lamp(c, 13, -16, 2.5, c.window);
  },
  bell(ctx, c) {
    hook(ctx, c, 6);
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.moveTo(-5, 7); ctx.quadraticCurveTo(-7, 20, -13, 26); ctx.lineTo(13, 26); ctx.quadraticCurveTo(7, 20, 5, 7); ctx.closePath(); ctx.fill();
    dot(ctx, 0, 28, 3, c.lo);
  },
  spire(ctx, c) {
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.moveTo(-11, 2); ctx.lineTo(0, -46); ctx.lineTo(11, 2); ctx.closePath(); ctx.fill();
    line(ctx, -3, 0, -1, -36, 1.5, c.hi);
    dot(ctx, 0, -48, 3, c.trim);
  },
  skull(ctx, c) {
    hook(ctx, c, 8);
    dot(ctx, 0, 18, 9, c.hi);
    box(ctx, -5, 24, 10, 6, c.hi);
    dot(ctx, -3.5, 18, 2.2, c.ink); dot(ctx, 3.5, 18, 2.2, c.ink);
  },
  cage(ctx, c) {
    hook(ctx, c, 10);
    ctx.strokeStyle = c.lo; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const k of [-1, -0.4, 0.4, 1]) { ctx.moveTo(0, 10); ctx.quadraticCurveTo(k * 16, 16, k * 12, 44); }
    ctx.moveTo(-12, 44); ctx.lineTo(12, 44); ctx.moveTo(-14, 26); ctx.lineTo(14, 26);
    ctx.stroke();
  },
  ghostLamp(ctx, c) {
    hook(ctx, c, 13);
    blob(ctx, 0, 22, 6, 9, c.lo);
    lamp(c, 0, 22, 3.5, c.wire);
  },
  bookOpen(ctx, c) {
    hook(ctx, c, 12);
    ctx.fillStyle = c.hi;
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(-12, 12, -20, 16); ctx.lineTo(-20, 30); ctx.quadraticCurveTo(-12, 26, 0, 32); ctx.quadraticCurveTo(12, 26, 20, 30); ctx.lineTo(20, 16); ctx.quadraticCurveTo(12, 12, 0, 18); ctx.fill();
    line(ctx, 0, 18, 0, 32, 1, c.lo);
  },
  globe(ctx, c) {
    line(ctx, 0, 0, 0, 10, 2, c.lo);
    dot(ctx, 0, 24, 13, c.body);
    ctx.strokeStyle = c.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 24, 16, -1.2, 1.9); ctx.stroke();
    blob(ctx, -3, 22, 5, 3, c.hi);
  },
  clock(ctx, c) {
    dot(ctx, 0, 0, 22, c.body);
    dot(ctx, 0, 0, 18, c.hi);
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; line(ctx, Math.cos(a) * 14, Math.sin(a) * 14, Math.cos(a) * 17, Math.sin(a) * 17, 1, c.ink); }
    line(ctx, 0, 0, 7, -7, 2, c.ink); line(ctx, 0, 0, -2, -13, 1.5, c.ink);
  },
  monitor(ctx, c) {
    hook(ctx, c, 8);
    box(ctx, -17, 8, 34, 22, c.ink);
    c.lit.push(g => { g.fillStyle = alpha(c.window, 0.28); g.fillRect(-14, 11, 28, 16); });
  },
  flask(ctx, c) {
    hook(ctx, c, 10);
    ctx.strokeStyle = c.hi; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 10); ctx.lineTo(-3, 20); ctx.lineTo(-11, 36); ctx.lineTo(11, 36); ctx.lineTo(3, 20); ctx.lineTo(3, 10); ctx.stroke();
    c.lit.push(g => { g.fillStyle = alpha(c.trim, 0.65); g.beginPath(); g.moveTo(-7, 28); g.lineTo(7, 28); g.lineTo(10, 35); g.lineTo(-10, 35); g.closePath(); g.fill(); });
  },
  beehive(ctx, c) {
    hook(ctx, c, 8);
    for (let k = 0; k < 5; k++) { const y = 12 + k * 8, half = 8 + Math.sin((k + 0.6) / 5 * Math.PI) * 11; box(ctx, -half, y, 2 * half, 7, k % 2 ? c.body : c.trim); }
    dot(ctx, 0, 34, 3, c.ink);
  },
  honeyDrip(ctx, c) {
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.quadraticCurveTo(10, 14, 6, 12); ctx.quadraticCurveTo(3, 34, 0, 36); ctx.quadraticCurveTo(-4, 26, -6, 16); ctx.quadraticCurveTo(-10, 12, -14, 0); ctx.fill();
  },
  coralFan(ctx, c, rng) {
    ctx.strokeStyle = c.trim; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) { ctx.moveTo(0, 0); ctx.quadraticCurveTo(k * 3, -14, k * 8, -rng.float(22, 34)); }
    ctx.stroke();
  },
  shell(ctx, c) {
    ctx.fillStyle = c.hi;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.arc(0, 2, 14, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill();
    for (const k of [-0.5, 0, 0.5]) line(ctx, 0, 12, Math.sin(k) * 14, 2 - Math.cos(k) * 12, 1, c.lo);
  },
  jelly(ctx, c) {
    hook(ctx, c, 6);
    ctx.fillStyle = alpha(c.trim, 0.75);
    ctx.beginPath(); ctx.arc(0, 18, 12, Math.PI, 0); ctx.closePath(); ctx.fill();
    for (const x of [-8, -3, 3, 8]) line(ctx, x, 18, x + 2, 34, 1, c.trim);
    glow(c, 0, 16, 24, c.window, 0.25);
  },
  balloon(ctx, c) {
    line(ctx, 0, 0, 0, -30, 1, c.lo);
    blob(ctx, 0, -50, 19, 23, c.trim);
    blob(ctx, -6, -58, 5, 7, c.hi);
    for (const x of [-4, 4]) line(ctx, x, -29, x * 0.5, -22, 1, c.lo);
  },
  windsock(ctx, c) {
    line(ctx, 0, 0, 0, -28, 2, c.lo);
    for (let k = 0; k < 4; k++) box(ctx, 1 + k * 8, -28 + k, 8, 10 - k * 2, k % 2 ? c.hi : c.trim);
  },
  cloudlet(ctx, c) {
    for (const [x, y, r] of [[-12, 2, 9], [0, -3, 12], [12, 3, 8]]) dot(ctx, x, y, r, c.hi);
  },
  sketchNote(ctx, c, rng) {
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, 12); ctx.moveTo(-18, 8); ctx.lineTo(-18, 16); ctx.moveTo(18, 8); ctx.lineTo(18, 16); ctx.stroke();
    for (let x = -12; x < 12; x += 5) line(ctx, x, 20, x + 3, 20 + rng.float(-1, 1), 1, c.ink);
  },
  paperclip(ctx, c) {
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-3, 22); ctx.arc(0, 22, 3, Math.PI, 0, true); ctx.lineTo(3, 6); ctx.arc(0, 6, 3, 0, Math.PI, true); ctx.lineTo(-3, 18); ctx.stroke();
  },
  tape(ctx, c) {
    ctx.save(); ctx.rotate(-0.5);
    ctx.fillStyle = alpha(c.trim, 0.55); ctx.fillRect(-14, -5, 28, 10);
    ctx.restore();
  },
  crystalCluster(ctx, c, rng) {
    for (let k = -2; k <= 2; k++) {
      const len = rng.float(14, 30), s = k * 5;
      ctx.fillStyle = k % 2 ? c.hi : c.body;
      ctx.beginPath(); ctx.moveTo(s - 4, 0); ctx.lineTo(s + k * 3, -len); ctx.lineTo(s + 4, 0); ctx.closePath(); ctx.fill();
    }
    glow(c, 0, -10, 24, c.window, 0.24);
  },
  icicles(ctx, c, rng) {
    for (let k = -2; k <= 2; k++) { const len = rng.float(12, 30); ctx.fillStyle = c.hi; ctx.beginPath(); ctx.moveTo(k * 6 - 3, 0); ctx.lineTo(k * 6, len); ctx.lineTo(k * 6 + 3, 0); ctx.closePath(); ctx.fill(); }
  },
  snowCap(ctx, c) {
    blob(ctx, 0, -2, 18, 6, c.hi);
    blob(ctx, 9, -6, 7, 4, c.hi);
  },
  brazier(ctx, c) {
    line(ctx, 0, 0, 0, -14, 3, c.lo);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(10, -22); ctx.lineTo(6, -13); ctx.lineTo(-6, -13); ctx.closePath(); ctx.fill();
    glow(c, 0, -26, 28, c.window, 0.5);
    c.lit.push(g => { g.fillStyle = alpha(c.window, 0.85); g.beginPath(); g.moveTo(-6, -22); g.quadraticCurveTo(-5, -32, 0, -38); g.quadraticCurveTo(5, -32, 6, -22); g.closePath(); g.fill(); });
  },
  lavaDrip(ctx, c) {
    c.lit.push(g => { g.fillStyle = alpha(c.window, 0.75); g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.quadraticCurveTo(3, 18, 0, 24); g.quadraticCurveTo(-3, 18, -5, 0); g.fill(); });
    glow(c, 0, 8, 18, c.window, 0.3);
  },
  horns(ctx, c) {
    ctx.strokeStyle = c.hi; ctx.lineWidth = 3;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 3, 0); ctx.quadraticCurveTo(s * 22, 0, s * 22, -22); ctx.stroke(); }
    dot(ctx, 0, 3, 7, c.hi);
    dot(ctx, -2.5, 2, 1.5, c.ink); dot(ctx, 2.5, 2, 1.5, c.ink);
  },
  nest(ctx, c, rng) {
    ctx.strokeStyle = c.lo; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 14; k++) { const x = rng.float(-16, 16); ctx.moveTo(x, rng.float(-4, 6)); ctx.lineTo(x + rng.float(-8, 8), rng.float(-4, 6)); }
    ctx.stroke();
    dot(ctx, -4, -3, 3, c.hi); dot(ctx, 3, -3, 3, c.hi);
  },
  birdhouse(ctx, c) {
    box(ctx, -8, -16, 16, 16, c.body);
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(0, -27); ctx.lineTo(12, -16); ctx.closePath(); ctx.fill();
    dot(ctx, 0, -9, 3, c.ink);
  },
  vineDrape(ctx, c, rng) {
    for (let k = -2; k <= 2; k++) {
      const L = rng.float(20, 50);
      ctx.strokeStyle = c.leaf; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(k * 7, 0); ctx.quadraticCurveTo(k * 7 + 5, L * 0.5, k * 7 - 2, L); ctx.stroke();
      for (let y = 10; y < L; y += 9) { ctx.fillStyle = c.leaf; ctx.beginPath(); ctx.ellipse(k * 7 + (y % 2 ? 3 : -2), y, 3.5, 1.8, 0.5, 0, TAU); ctx.fill(); }
    }
  },
  fungusShelf(ctx, c) {
    for (const [x, y, r] of [[8, -8, 11], [12, 2, 8], [7, 10, 6]]) { ctx.fillStyle = c.trim; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); ctx.fill(); }
    glow(c, 8, -4, 20, c.window, 0.28);
  },
  mushroomCap(ctx, c) {
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0); ctx.quadraticCurveTo(0, 7, -26, 0); ctx.fill();
    for (const [x, y, r] of [[-10, -11, 3.5], [6, -16, 4], [15, -7, 2.5]]) dot(ctx, x, y, r, c.hi);
    glow(c, 0, 2, 32, c.window, 0.28);
  },
  blossomSprig(ctx, c, rng) {
    line(ctx, 0, 0, 24, -14, 1.5, c.lo);
    for (let k = 0; k < 9; k++) dot(ctx, rng.float(4, 30), -rng.float(0, 20), rng.float(2.5, 4.5), rng.chance(0.5) ? c.trim : c.hi);
  },
  leafTuft(ctx, c, rng) {
    for (let k = 0; k < 7; k++) { const a = rng.float(-2.6, -0.5), len = rng.float(10, 24); ctx.fillStyle = c.leaf; ctx.beginPath(); ctx.ellipse(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, len * 0.5, 3, a, 0, TAU); ctx.fill(); }
  },
  acorn(ctx, c) {
    hook(ctx, c, 6);
    blob(ctx, 0, 16, 6, 8, c.trim);
    ctx.fillStyle = c.lo; ctx.beginPath(); ctx.arc(0, 11, 7, Math.PI, 0); ctx.closePath(); ctx.fill();
  },
  tasselKnot(ctx, c) {
    hook(ctx, c, 6);
    ctx.save(); ctx.translate(0, 14); ctx.rotate(Math.PI / 4); ctx.fillStyle = c.trim; ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    for (const x of [-3, 0, 3]) line(ctx, x, 21, x, 44, 1.5, c.trim);
  },
  bracketSet(ctx, c) {
    box(ctx, 0, -5, 12, 5, c.trim); box(ctx, 0, 0, 22, 5, c.body); box(ctx, 8, 5, 22, 5, c.trim);
  },
  pinwheel(ctx, c) {
    line(ctx, 0, 0, 0, -20, 2, c.lo);
    spin(c, 'pinwheel', 0, -24, 12);
  },
  lollipop(ctx, c) {
    box(ctx, -1.5, -26, 3, 26, c.hi);
    dot(ctx, 0, -38, 14, c.trim);
    ctx.strokeStyle = c.hi; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -38, 9, 0, 5); ctx.arc(0, -38, 4, 5, 0, true); ctx.stroke();
  },
  gumdrop(ctx, c) {
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.arc(0, 2, 12, Math.PI, 0); ctx.closePath(); ctx.fill();
    dot(ctx, -3, -4, 2, c.hi); dot(ctx, 4, -2, 1.5, c.hi);
  },
  bulbs(ctx, c) {
    for (let k = 0; k < 6; k++) { const x = -25 + k * 10, y = 4 + Math.sin((k + 0.5) / 6 * Math.PI) * 10; lamp(c, x, y, 2.2, k % 2 ? c.window : c.trim); }
    ctx.strokeStyle = c.lo; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(0, 26, 28, 0); ctx.stroke();
  },
  star(ctx, c) {
    hook(ctx, c, 6);
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 12, a = k * TAU / 10 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, 18 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  },
  minecart(ctx, c) {
    hook(ctx, c, 8);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(-15, 8); ctx.lineTo(15, 8); ctx.lineTo(11, 24); ctx.lineTo(-11, 24); ctx.closePath(); ctx.fill();
    dot(ctx, -7, 26, 3, c.ink); dot(ctx, 7, 26, 3, c.ink);
    blob(ctx, 0, 7, 10, 4, c.trim);
  },
  flag(ctx, c) {
    box(ctx, -1, -36, 2, 36, c.lo);
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.moveTo(1, -36); ctx.lineTo(24, -29); ctx.lineTo(1, -22); ctx.closePath(); ctx.fill();
  },
  scarecrow(ctx, c) {
    box(ctx, -1.5, -34, 3, 34, c.lo);
    line(ctx, -14, -24, 14, -24, 2.5, c.lo);
    dot(ctx, 0, -36, 5, c.hi);
    line(ctx, -8, -41, 8, -41, 2, c.ink);
  },
  windmill(ctx, c) {
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-5, -24); ctx.lineTo(5, -24); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
    spin(c, 'pinwheel', 0, -24, 15);
  },
  horseshoeSun(ctx, c) {
    ctx.strokeStyle = c.trim; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.moveTo(Math.cos(a) * 8, -18 + Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 14, -18 + Math.sin(a) * 14); }
    ctx.stroke();
    dot(ctx, 0, -18, 6, c.trim);
    box(ctx, -1, -8, 2, 8, c.lo);
  },
  gourd(ctx, c) {
    hook(ctx, c, 8);
    blob(ctx, 0, 15, 5, 7, c.trim); blob(ctx, 0, 27, 8, 8, c.trim);
  },
  mossClump(ctx, c, rng) {
    for (let k = 0; k < 6; k++) { const L = rng.float(10, 34), x = -12 + k * 5; line(ctx, x, 0, x + rng.float(-2, 2), L, 1.5, c.leaf); }
  },
  firefly(ctx, c) {
    hook(ctx, c, 10);
    ctx.strokeStyle = c.hi; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 19, 8, 0, TAU); ctx.stroke();
    lamp(c, 0, 19, 2.5, c.window);
  },
};

const GEAR_TEETH = 10;

export function drawSpinning(ctx, s, c, time) {
  const t = time / 1000;
  if (s.kind === 'blink') {
    const on = Math.sin(t * 2.4 + s.x * 0.03) > 0.1;
    ctx.fillStyle = alpha(c.window, on ? 0.55 : 0.15);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate((s.kind === 'gear' ? 0.35 : 1.4) * t * (s.x % 2 ? 1 : -1));
  if (s.kind === 'gear') {
    ctx.fillStyle = c.far;
    ctx.beginPath();
    for (let k = 0; k < GEAR_TEETH * 2; k++) {
      const a0 = (k * TAU) / (GEAR_TEETH * 2), r = k % 2 ? s.r * 0.78 : s.r;
      ctx.lineTo(Math.cos(a0 - 0.1) * r, Math.sin(a0 - 0.1) * r);
      ctx.lineTo(Math.cos(a0 + 0.1) * r, Math.sin(a0 + 0.1) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * s.r * 0.46, Math.sin(a) * s.r * 0.46, s.r * 0.14, 0, TAU); ctx.fill(); }
  } else {
    const blades = s.kind === 'fan' ? 3 : 4;
    ctx.fillStyle = c.far;
    for (let k = 0; k < blades; k++) { ctx.rotate(TAU / blades); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s.r * 0.5, -s.r * 0.42, s.r, -s.r * 0.12); ctx.lineTo(s.r * 0.9, s.r * 0.14); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
