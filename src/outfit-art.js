import { alpha } from './themes.js?v=4a2bde0';
import { TAU, roundRect } from './paint.js?v=4a2bde0';

const GOLD = 'hsl(48 95% 60%)';
const WHITE = 'hsl(0 0% 98%)';
const RED = 'hsl(355 80% 55%)';
const PINK = 'hsl(340 85% 78%)';
const BROWN = 'hsl(28 50% 38%)';
const STRAW = 'hsl(42 70% 66%)';
const STEEL = 'hsl(210 10% 70%)';
const IVORY = 'hsl(40 40% 92%)';
const PURPLE = 'hsl(270 55% 45%)';
const BLUE = 'hsl(215 70% 50%)';
const HAIR = 'hsl(25 45% 30%)';
const PETALS = ['hsl(340 85% 70%)', 'hsl(48 95% 65%)', 'hsl(200 85% 70%)', 'hsl(280 70% 75%)'];

const fillStroke = ctx => { ctx.fill(); ctx.stroke(); };
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
const dome = (ctx, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, Math.PI, TAU); ctx.closePath(); };

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
}

function daisy(ctx, x, y, r, petal) {
  ctx.fillStyle = petal;
  for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75); ctx.fill(); }
  ctx.fillStyle = GOLD;
  circle(ctx, x, y, r * 0.6); ctx.fill();
}

export const HATS = {
  cap: (ctx, p, { w, facing }) => {
    ctx.fillStyle = p.accent;
    dome(ctx, 0, w, w * 0.62); fillStroke(ctx);
    ctx.beginPath(); ctx.roundRect(facing > 0 ? 0 : -w * 1.5, -2, w * 1.5, 4, 2); fillStroke(ctx);
  },
  beanie: (ctx, p, { w }) => {
    ctx.fillStyle = p.accent;
    dome(ctx, -1, w, w * 0.9); fillStroke(ctx);
    ctx.fillStyle = p.playerInk; ctx.fillRect(-w, -3, w * 2, 4);
    ctx.fillStyle = p.player; circle(ctx, 0, -w * 0.95, 3.5); fillStroke(ctx);
  },
  tophat: (ctx, p, { w }) => {
    ctx.fillStyle = p.playerInk;
    ctx.fillRect(-w * 1.2, -2, w * 2.4, 3);
    ctx.fillRect(-w * 0.8, -w * 1.5, w * 1.6, w * 1.5);
    ctx.fillStyle = p.accent; ctx.fillRect(-w * 0.8, -5, w * 1.6, 3);
  },
  crown: (ctx, p, { w }) => {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, 0); ctx.lineTo(-w * 0.8, -w * 0.8); ctx.lineTo(-w * 0.35, -w * 0.35); ctx.lineTo(0, -w); ctx.lineTo(w * 0.35, -w * 0.35); ctx.lineTo(w * 0.8, -w * 0.8); ctx.lineTo(w * 0.8, 0); ctx.closePath();
    fillStroke(ctx);
  },
  party: (ctx, p, { w }) => {
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(-w * 0.7, 0); ctx.lineTo(0, -w * 1.8); ctx.lineTo(w * 0.7, 0); ctx.closePath(); fillStroke(ctx);
    ctx.fillStyle = p.player; circle(ctx, 0, -w * 1.8, 3); fillStroke(ctx);
  },
  cowboy: (ctx, p, { w }) => {
    ctx.fillStyle = BROWN;
    ctx.beginPath(); ctx.roundRect(-w * 0.7, -w * 1.05, w * 1.4, w * 1.05, 4); fillStroke(ctx);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 1.75, w * 0.3, 0, 0, TAU); fillStroke(ctx);
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -w * 1.05); ctx.lineTo(0, -w * 0.8); ctx.lineTo(w * 0.2, -w * 1.05); ctx.stroke();
    ctx.fillStyle = p.playerInk; ctx.fillRect(-w * 0.7, -4, w * 1.4, 2.5);
  },
  wizard: (ctx, p, { w, facing }) => {
    ctx.fillStyle = PURPLE;
    ctx.beginPath(); ctx.moveTo(-w * 0.85, 0); ctx.quadraticCurveTo(-w * 0.2, -w * 1.4, -facing * w * 0.6, -w * 2.6); ctx.lineTo(w * 0.85, 0); ctx.closePath(); fillStroke(ctx);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 1.3, w * 0.25, 0, 0, TAU); fillStroke(ctx);
    ctx.fillStyle = GOLD; star(ctx, 0, -w * 0.85, w * 0.32); ctx.fill();
  },
  viking: (ctx, p, { w }) => {
    ctx.fillStyle = IVORY;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * w * 0.75, -w * 0.3); ctx.quadraticCurveTo(side * w * 1.7, -w * 0.4, side * w * 1.4, -w * 1.5); ctx.lineTo(side * w * 1.0, -w * 0.6); ctx.closePath(); fillStroke(ctx);
    }
    ctx.fillStyle = STEEL;
    dome(ctx, 0, w * 0.95, w * 0.85); fillStroke(ctx);
    ctx.fillStyle = GOLD; ctx.fillRect(-w * 0.95, -3, w * 1.9, 3);
  },
  chef: (ctx, p, { w }) => {
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.rect(-w * 0.62, -w * 0.75, w * 1.24, w * 0.75); fillStroke(ctx);
    for (const [x, y, r] of [[-w * 0.45, -w * 1.0, w * 0.45], [w * 0.45, -w * 1.0, w * 0.45], [0, -w * 1.3, w * 0.52]]) { circle(ctx, x, y, r); fillStroke(ctx); }
  },
  beret: (ctx, p, { w, facing }) => {
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.ellipse(facing * w * 0.2, -w * 0.2, w * 1.05, w * 0.42, -facing * 0.18, 0, TAU); fillStroke(ctx);
    ctx.beginPath(); ctx.moveTo(facing * w * 0.2, -w * 0.6); ctx.lineTo(facing * w * 0.3, -w * 0.9); ctx.stroke();
  },
  bowler: (ctx, p, { w }) => {
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 1.15, w * 0.22, 0, 0, TAU); ctx.fill();
    dome(ctx, -w * 0.05, w * 0.75, w * 0.8); ctx.fill();
    ctx.fillStyle = p.accent; ctx.fillRect(-w * 0.75, -w * 0.3, w * 1.5, 2.5);
  },
  halo: (ctx, p, { w }) => {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = GOLD; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(0, -w * 1.2, w * 0.85, w * 0.25, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  },
  propeller: (ctx, p, { w, frame }) => {
    ctx.fillStyle = p.accent;
    dome(ctx, -1, w, w * 0.9); fillStroke(ctx);
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(0, -1); ctx.ellipse(0, -1, w, w * 0.9, 0, Math.PI * 1.5, TAU); ctx.closePath(); fillStroke(ctx);
    ctx.beginPath(); ctx.moveTo(0, -w * 0.9); ctx.lineTo(0, -w * 1.25); ctx.stroke();
    const spin = Math.cos(frame * 0.5);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.ellipse(0, -w * 1.3, w * 1.2 * Math.abs(spin) + 1, 2, 0, 0, TAU); fillStroke(ctx);
  },
  bunny: (ctx, p, { w }) => {
    for (const side of [-1, 1]) {
      ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.ellipse(side * w * 0.38, -w * 1.05, w * 0.3, w * 1.05, side * 0.15, 0, TAU); fillStroke(ctx);
      ctx.fillStyle = PINK;
      ctx.beginPath(); ctx.ellipse(side * w * 0.38, -w * 1.0, w * 0.13, w * 0.7, side * 0.15, 0, TAU); ctx.fill();
    }
  },
  cat: (ctx, p, { w, base }) => {
    for (const side of [-1, 1]) {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.moveTo(side * w * 0.95, 2); ctx.lineTo(side * w * 0.7, -w * 0.95); ctx.lineTo(side * w * 0.15, 0); ctx.closePath(); fillStroke(ctx);
      ctx.fillStyle = PINK;
      ctx.beginPath(); ctx.moveTo(side * w * 0.78, -1); ctx.lineTo(side * w * 0.68, -w * 0.6); ctx.lineTo(side * w * 0.4, -1); ctx.closePath(); ctx.fill();
    }
  },
  flowers: (ctx, p, { w }) => {
    ctx.strokeStyle = 'hsl(120 45% 35%)';
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -w * 0.35, w, 0); ctx.stroke();
    [-0.7, -0.24, 0.24, 0.7].forEach((x, i) => daisy(ctx, x * w, -w * 0.18 - (i % 2) * 2, w * 0.2, PETALS[i]));
  },
  pirate: (ctx, p, { w }) => {
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.moveTo(-w * 1.25, 0); ctx.quadraticCurveTo(0, -w * 0.45, w * 1.25, 0); ctx.lineTo(w * 0.85, -w * 1.05); ctx.quadraticCurveTo(0, -w * 1.45, -w * 0.85, -w * 1.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.stroke();
    ctx.fillStyle = WHITE; circle(ctx, 0, -w * 0.7, w * 0.22); ctx.fill();
    ctx.fillStyle = p.playerInk; circle(ctx, -w * 0.08, -w * 0.72, w * 0.06); ctx.fill(); circle(ctx, w * 0.08, -w * 0.72, w * 0.06); ctx.fill();
  },
  headphones: (ctx, p, { w, dh }) => {
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, dh * 0.32, w * 1.08, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.fillStyle = p.accent;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.roundRect(side * w * 1.08 - 3.5, dh * 0.2, 7, dh * 0.26, 3); fillStroke(ctx); }
  },
  headband: (ctx, p, { w, dh, facing }) => {
    ctx.fillStyle = RED;
    ctx.fillRect(-w, dh * 0.05, w * 2, 4.5);
    ctx.fillStyle = WHITE; ctx.fillRect(-w, dh * 0.05 + 1.7, w * 2, 1.2);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(-facing * w, dh * 0.07); ctx.lineTo(-facing * w * 1.6, dh * 0.02); ctx.lineTo(-facing * w * 1.5, dh * 0.2); ctx.closePath(); ctx.fill();
  },
  mohawk: (ctx, p, { w }) => {
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(-w * 0.55, 1);
    for (let i = -2; i <= 2; i++) { ctx.lineTo(i * w * 0.24, -w * (1.15 - Math.abs(i) * 0.2)); ctx.lineTo(i * w * 0.24 + w * 0.12, -w * 0.3); }
    ctx.lineTo(w * 0.55, 1); ctx.closePath(); fillStroke(ctx);
  },
  fez: (ctx, p, { w, facing }) => {
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(-w * 0.55, 0); ctx.lineTo(w * 0.55, 0); ctx.lineTo(w * 0.42, -w * 1.05); ctx.lineTo(-w * 0.42, -w * 1.05); ctx.closePath(); fillStroke(ctx);
    ctx.strokeStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(0, -w * 1.05); ctx.quadraticCurveTo(-facing * w * 0.5, -w * 1.0, -facing * w * 0.5, -w * 0.45); ctx.stroke();
  },
  hardhat: (ctx, p, { w }) => {
    ctx.fillStyle = 'hsl(48 100% 55%)';
    dome(ctx, 0, w * 0.92, w * 0.82); fillStroke(ctx);
    ctx.beginPath(); ctx.roundRect(-w * 1.15, -2.5, w * 2.3, 3.5, 1.5); fillStroke(ctx);
    ctx.beginPath(); ctx.moveTo(0, -w * 0.82); ctx.lineTo(0, -2); ctx.stroke();
  },
  mortarboard: (ctx, p, { w, facing }) => {
    ctx.fillStyle = p.playerInk;
    ctx.fillRect(-w * 0.62, -w * 0.45, w * 1.24, w * 0.47);
    ctx.beginPath(); ctx.moveTo(-w * 1.25, -w * 0.55); ctx.lineTo(0, -w * 0.85); ctx.lineTo(w * 1.25, -w * 0.55); ctx.lineTo(0, -w * 0.25); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(0, -w * 0.55); ctx.lineTo(facing * w * 1.0, -w * 0.5); ctx.lineTo(facing * w * 1.05, w * 0.2); ctx.stroke();
  },
  santa: (ctx, p, { w, facing }) => {
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(-w * 0.9, -w * 0.1); ctx.quadraticCurveTo(0, -w * 1.9, -facing * w * 1.25, -w * 0.55); ctx.lineTo(w * 0.9, -w * 0.1); ctx.closePath(); fillStroke(ctx);
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.roundRect(-w * 1.0, -w * 0.32, w * 2.0, w * 0.4, w * 0.2); fillStroke(ctx);
    circle(ctx, -facing * w * 1.25, -w * 0.55, w * 0.25); fillStroke(ctx);
  },
  sombrero: (ctx, p, { w }) => {
    ctx.fillStyle = STRAW;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 2.0, w * 0.34, 0, 0, TAU); fillStroke(ctx);
    dome(ctx, -w * 0.15, w * 0.62, w * 0.85); fillStroke(ctx);
    ctx.strokeStyle = RED;
    ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(-w * 0.6 + i * w * 0.2, -w * 0.3 - (i % 2) * 2.5); ctx.stroke();
  },
  bubble: (ctx, p, { w, dh }) => {
    const r = Math.max(w * 1.25, dh * 0.62);
    ctx.fillStyle = 'hsl(200 90% 88% / 0.22)';
    ctx.strokeStyle = 'hsl(200 40% 92% / 0.9)';
    circle(ctx, 0, dh * 0.4, r); fillStroke(ctx);
    ctx.strokeStyle = 'hsl(0 0% 100% / 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, dh * 0.4, r * 0.78, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  },
};

export const ACCESSORIES = {
  leaf: (ctx, p) => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(1, -5, 0, -8); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4, -9, 5, 2.5, -0.5, 0, TAU); ctx.fill();
  },
  antenna: ctx => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
    circle(ctx, 0, -12, 3); ctx.fill();
  },
  tuft: ctx => {
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-5, -6, -1, -8);
    ctx.moveTo(1, 0); ctx.quadraticCurveTo(3, -7, 6, -6);
    ctx.stroke();
  },
  bow: ctx => {
    ctx.beginPath();
    ctx.moveTo(0, -1); ctx.lineTo(-7, -6); ctx.lineTo(-7, 3); ctx.closePath();
    ctx.moveTo(0, -1); ctx.lineTo(7, -6); ctx.lineTo(7, 3); ctx.closePath();
    ctx.fill();
    circle(ctx, 0, -1, 2); ctx.fill();
  },
  sprout: ctx => {
    ctx.fillStyle = 'hsl(110 60% 50%)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.stroke();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 3.5, -8, 4, 2.2, side * 0.5, 0, TAU); fillStroke(ctx); }
  },
  horns: (ctx, p, { w }) => {
    ctx.fillStyle = RED;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * w * 0.55, 1); ctx.quadraticCurveTo(side * w * 0.9, -3, side * w * 0.85, -8); ctx.lineTo(side * w * 0.2, 1); ctx.closePath(); fillStroke(ctx);
    }
  },
  unicorn: ctx => {
    ctx.fillStyle = IVORY;
    ctx.beginPath(); ctx.moveTo(-3, 1); ctx.lineTo(0, -14); ctx.lineTo(3, 1); ctx.closePath(); fillStroke(ctx);
    ctx.strokeStyle = PINK;
    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(2, -4); ctx.moveTo(-1.5, -6); ctx.lineTo(1.5, -8); ctx.stroke();
  },
  feather: (ctx, p) => {
    ctx.beginPath(); ctx.ellipse(4, -9, 2.6, 8, 0.45, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3, -8, 8, -15); ctx.stroke();
  },
  flower: ctx => {
    ctx.strokeStyle = 'hsl(120 45% 35%)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke();
    daisy(ctx, 0, -11, 2.4, WHITE);
  },
  bulb: ctx => {
    ctx.fillStyle = 'hsl(52 100% 68%)';
    ctx.shadowColor = 'hsl(52 100% 68%)'; ctx.shadowBlur = 10;
    circle(ctx, 0, -11, 4.2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.fillStyle = STEEL; ctx.fillRect(-2, -7, 4, 3);
  },
};

const lenses = ({ eyeX, eyeY, r }) => ({ y: eyeY, lens: r * 1.9, xs: [eyeX - r * 1.45, eyeX + r * 1.45] });

function bridge(ctx, { y, lens, xs }) {
  ctx.beginPath(); ctx.moveTo(xs[0] + lens, y); ctx.lineTo(xs[1] - lens, y); ctx.stroke();
}

export const GLASSES = {
  round: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(200 80% 90% / 0.25)';
    for (const x of g.xs) { circle(ctx, x, g.y, g.lens); fillStroke(ctx); }
    bridge(ctx, g);
  },
  square: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(200 80% 90% / 0.25)';
    for (const x of g.xs) { ctx.beginPath(); ctx.roundRect(x - g.lens, g.y - g.lens * 0.8, g.lens * 2, g.lens * 1.6, 2); fillStroke(ctx); }
    bridge(ctx, g);
  },
  shades: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(240 30% 10% / 0.85)';
    for (const x of g.xs) { circle(ctx, x, g.y, g.lens); fillStroke(ctx); }
    bridge(ctx, g);
  },
  monocle: (ctx, p, { eyes, facing }) => {
    const g = lenses(eyes), x = g.xs[facing > 0 ? 1 : 0];
    ctx.fillStyle = 'hsl(200 80% 90% / 0.25)';
    circle(ctx, x, g.y, g.lens); fillStroke(ctx);
    ctx.strokeStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(x + facing * g.lens * 0.7, g.y + g.lens * 0.7); ctx.lineTo(x + facing * g.lens * 1.2, g.y + g.lens * 2.2); ctx.stroke();
  },
  hearts: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(340 90% 65% / 0.75)';
    for (const x of g.xs) { heart(ctx, x, g.y + 0.5, g.lens * 1.05); fillStroke(ctx); }
    bridge(ctx, g);
  },
  stars: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(48 100% 60% / 0.8)';
    for (const x of g.xs) { star(ctx, x, g.y, g.lens * 1.35); fillStroke(ctx); }
  },
  threed: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.strokeStyle = WHITE;
    ['hsl(0 90% 55% / 0.7)', 'hsl(190 90% 55% / 0.7)'].forEach((tint, i) => {
      ctx.fillStyle = tint;
      ctx.beginPath(); ctx.rect(g.xs[i] - g.lens, g.y - g.lens * 0.75, g.lens * 2, g.lens * 1.5); fillStroke(ctx);
    });
    bridge(ctx, g);
  },
  visor: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(185 95% 60% / 0.55)';
    ctx.beginPath(); ctx.roundRect(g.xs[0] - g.lens * 1.2, g.y - g.lens * 0.7, g.xs[1] - g.xs[0] + g.lens * 2.4, g.lens * 1.4, g.lens * 0.7); fillStroke(ctx);
  },
  nerd: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.lineWidth = 2.6;
    ctx.fillStyle = 'hsl(200 80% 90% / 0.2)';
    for (const x of g.xs) { ctx.beginPath(); ctx.rect(x - g.lens, g.y - g.lens * 0.85, g.lens * 2, g.lens * 1.7); fillStroke(ctx); }
    bridge(ctx, g);
    ctx.fillStyle = WHITE; ctx.fillRect((g.xs[0] + g.xs[1]) / 2 - 1.5, g.y - 1.5, 3, 3);
  },
  aviators: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.strokeStyle = GOLD;
    ctx.fillStyle = 'hsl(25 40% 18% / 0.85)';
    for (const x of g.xs) { ctx.beginPath(); ctx.ellipse(x, g.y + g.lens * 0.2, g.lens * 1.05, g.lens * 0.9, 0, 0, TAU); fillStroke(ctx); }
    bridge(ctx, { ...g, y: g.y - g.lens * 0.4 });
  },
  cateye: (ctx, p, { eyes }) => {
    const g = lenses(eyes);
    ctx.strokeStyle = 'hsl(320 80% 50%)';
    ctx.fillStyle = 'hsl(320 80% 85% / 0.3)';
    g.xs.forEach((x, i) => {
      const out = i ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x - out * g.lens, g.y); ctx.quadraticCurveTo(x, g.y + g.lens * 1.3, x + out * g.lens, g.y); ctx.lineTo(x + out * g.lens * 1.5, g.y - g.lens * 0.9); ctx.quadraticCurveTo(x, g.y - g.lens * 0.9, x - out * g.lens, g.y); ctx.closePath(); fillStroke(ctx);
    });
  },
  eyepatch: (ctx, p, { eyes, facing, dw, dh }) => {
    const g = lenses(eyes), x = g.xs[facing > 0 ? 1 : 0];
    ctx.beginPath(); ctx.moveTo(-dw / 2, -dh * 0.38); ctx.lineTo(dw / 2, g.y + g.lens); ctx.stroke();
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.ellipse(x, g.y, g.lens * 1.05, g.lens * 0.95, 0, 0, TAU); ctx.fill();
  },
  goggles: (ctx, p, { eyes, dw }) => {
    const g = lenses(eyes);
    ctx.fillStyle = 'hsl(25 90% 55%)';
    ctx.fillRect(-dw / 2, g.y - 2, dw, 4);
    ctx.fillStyle = 'hsl(190 80% 80% / 0.6)';
    ctx.lineWidth = 2.2;
    for (const x of g.xs) { circle(ctx, x, g.y, g.lens * 1.1); fillStroke(ctx); }
  },
  masquerade: (ctx, p, { eyes }) => {
    const g = lenses(eyes), [a, b] = g.xs, l = g.lens;
    ctx.fillStyle = PURPLE;
    ctx.beginPath();
    ctx.moveTo(a - l * 1.7, g.y - l * 1.2); ctx.quadraticCurveTo((a + b) / 2, g.y - l * 0.4, b + l * 1.7, g.y - l * 1.2);
    ctx.quadraticCurveTo(b + l * 1.4, g.y + l * 1.3, (a + b) / 2, g.y + l * 0.6); ctx.quadraticCurveTo(a - l * 1.4, g.y + l * 1.3, a - l * 1.7, g.y - l * 1.2);
    ctx.closePath();
    for (const x of g.xs) { ctx.moveTo(x + l * 0.75, g.y); ctx.arc(x, g.y, l * 0.75, 0, TAU, true); }
    ctx.fill('evenodd'); ctx.stroke();
    ctx.fillStyle = GOLD; circle(ctx, b + l * 1.7, g.y - l * 1.2, 1.6); ctx.fill();
  },
};

const mouthOf = ({ eyes, dh }) => ({ x: eyes.eyeX, y: eyes.eyeY + dh * 0.17 });

export const FACES = {
  moustache: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.fillStyle = HAIR;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(m.x + side * 2.8, m.y - 1.2, 3.2, 1.6, side * 0.35, 0, TAU); ctx.fill(); }
  },
  handlebar: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(m.x - 7, m.y - 4); ctx.quadraticCurveTo(m.x - 4, m.y + 1, m.x, m.y - 1); ctx.quadraticCurveTo(m.x + 4, m.y + 1, m.x + 7, m.y - 4); ctx.stroke();
  },
  beard: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.moveTo(m.x - o.dw * 0.34, m.y - 4); ctx.quadraticCurveTo(m.x, m.y + o.dh * 0.38, m.x + o.dw * 0.34, m.y - 4); ctx.quadraticCurveTo(m.x, m.y + 2, m.x - o.dw * 0.34, m.y - 4); ctx.fill();
  },
  goatee: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.moveTo(m.x - 2.5, m.y + 2); ctx.lineTo(m.x + 2.5, m.y + 2); ctx.lineTo(m.x, m.y + 7); ctx.closePath(); ctx.fill();
  },
  whiskers: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const side of [-1, 1]) for (const dy of [-2, 0, 2]) { ctx.moveTo(m.x + side * 4, m.y - 2 + dy * 0.4); ctx.lineTo(m.x + side * 11, m.y - 2 + dy); }
    ctx.stroke();
  },
  freckles: (ctx, p, o) => {
    ctx.fillStyle = 'hsl(25 60% 45% / 0.8)';
    for (const side of [-1, 1]) for (const [dx, dy] of [[0, 0], [2.4, 1.2], [1, 2.6]]) { circle(ctx, o.eyes.eyeX + side * (o.dw * 0.22 + dx), o.eyes.eyeY + o.dh * 0.1 + dy, 0.8); ctx.fill(); }
  },
  fangs: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.fillStyle = WHITE;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(m.x + side * 1.2, m.y - 1); ctx.lineTo(m.x + side * 3.6, m.y - 1); ctx.lineTo(m.x + side * 2.4, m.y + 3); ctx.closePath(); ctx.fill(); }
  },
  bandana: (ctx, p, o) => {
    const m = mouthOf(o);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(-o.dw / 2, m.y - 5); ctx.lineTo(o.dw / 2, m.y - 5); ctx.lineTo(m.x, m.y + o.dh * 0.28); ctx.closePath(); fillStroke(ctx);
    ctx.fillStyle = WHITE;
    for (const [dx, dy] of [[-3, -2], [3, -2], [0, 2]]) { circle(ctx, m.x + dx, m.y + dy, 0.9); ctx.fill(); }
  },
};

const neckOf = ({ dh }) => dh * 0.2;

export const NECKS = {
  scarf: (ctx, p, o) => {
    const y = neckOf(o);
    ctx.fillStyle = p.accent;
    ctx.save(); ctx.translate(-o.facing * o.dw * 0.3, y); ctx.rotate(o.sway * 0.8);
    ctx.beginPath(); ctx.roundRect(-2, 0, 4.5, o.dh * 0.3, 2); fillStroke(ctx);
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(-o.dw / 2 - 1, y - 2.5, o.dw + 2, 5, 2.5); fillStroke(ctx);
  },
  bowtie: (ctx, p, o) => {
    const y = neckOf(o), x = o.eyes.eyeX * 0.6;
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x - 5, y + 3); ctx.closePath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 3); ctx.lineTo(x + 5, y + 3); ctx.closePath(); fillStroke(ctx);
    circle(ctx, x, y, 1.6); fillStroke(ctx);
  },
  tie: (ctx, p, o) => {
    const y = neckOf(o), x = o.eyes.eyeX * 0.6;
    ctx.fillStyle = BLUE;
    ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x + 3, o.dh * 0.42); ctx.lineTo(x, o.dh * 0.48); ctx.lineTo(x - 3, o.dh * 0.42); ctx.closePath(); fillStroke(ctx);
  },
  pearls: (ctx, p, o) => {
    const y = neckOf(o);
    ctx.fillStyle = IVORY;
    for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5; circle(ctx, t * o.dw * 0.8, y + (0.25 - t * t) * 8 - 2, 1.4); ctx.fill(); }
  },
  neckerchief: (ctx, p, o) => {
    const y = neckOf(o), x = o.eyes.eyeX * 0.5;
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(-o.dw * 0.4, y - 2); ctx.lineTo(o.dw * 0.4, y - 2); ctx.lineTo(x, y + 7); ctx.closePath(); fillStroke(ctx);
  },
  medal: (ctx, p, o) => {
    const y = neckOf(o), x = o.eyes.eyeX * 0.6;
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x, y + 4); ctx.lineTo(x + 5, y - 3); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = p.playerInk;
    ctx.fillStyle = GOLD; circle(ctx, x, y + 6, 3); fillStroke(ctx);
  },
  bell: (ctx, p, o) => {
    const y = neckOf(o), x = o.eyes.eyeX * 0.6;
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.roundRect(-o.dw / 2, y - 2, o.dw, 3.5, 1.5); ctx.fill();
    ctx.fillStyle = GOLD; circle(ctx, x, y + 3.5, 2.8); fillStroke(ctx);
  },
  chain: (ctx, p, o) => {
    const y = neckOf(o);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-o.dw * 0.38, y - 2); ctx.quadraticCurveTo(0, y + 7, o.dw * 0.38, y - 2); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.strokeStyle = p.playerInk; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-2.5, y + 2, 5, 5, 1); fillStroke(ctx);
  },
  lei: (ctx, p, o) => {
    const y = neckOf(o);
    for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5; ctx.fillStyle = PETALS[i % PETALS.length]; circle(ctx, t * o.dw * 0.9, y + (0.25 - t * t) * 9 - 2, 2.2); ctx.fill(); }
  },
};

export const BACKS = {
  cape: (ctx, p, o) => {
    const back = -o.facing, flutter = Math.sin(o.frame / 9) * 2.5 + o.sway * 6;
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(-o.dw * 0.42, -o.dh * 0.22); ctx.lineTo(o.dw * 0.42, -o.dh * 0.22);
    ctx.quadraticCurveTo(-back * o.dw * 0.4, o.dh * 0.2, -back * o.dw * 0.2, o.dh * 0.5);
    ctx.lineTo(back * (o.dw * 1.05 + flutter), o.dh * 0.42);
    ctx.quadraticCurveTo(back * o.dw * 0.8, o.dh * 0.05, -o.dw * 0.42, -o.dh * 0.22);
    ctx.closePath(); fillStroke(ctx);
  },
  wings: (ctx, p, o) => {
    const flap = Math.sin(o.frame / 6) * 2;
    ctx.fillStyle = WHITE;
    for (const side of [-1, 1]) for (const k of [2, 1, 0]) {
      ctx.beginPath(); ctx.ellipse(side * (o.dw * 0.5 + 3 + k * 3), -o.dh * 0.12 - k * 3.5 - flap * (k + 1) * 0.4, 6.5 - k, 3, side * -0.55, 0, TAU); fillStroke(ctx);
    }
  },
  batwings: (ctx, p, o) => {
    const flap = Math.sin(o.frame / 6) * 2.5;
    ctx.fillStyle = 'hsl(270 30% 22%)';
    for (const side of [-1, 1]) {
      const x0 = side * o.dw * 0.4, y0 = -o.dh * 0.15;
      ctx.beginPath(); ctx.moveTo(x0, y0 - 2); ctx.lineTo(x0 + side * 14, y0 - 8 - flap);
      ctx.quadraticCurveTo(x0 + side * 12, y0 - 1, x0 + side * 15, y0 + 4 - flap * 0.5); ctx.quadraticCurveTo(x0 + side * 10, y0 + 2, x0 + side * 9, y0 + 7);
      ctx.quadraticCurveTo(x0 + side * 5, y0 + 4, x0, y0 + 6); ctx.closePath(); fillStroke(ctx);
    }
  },
  butterfly: (ctx, p, o) => {
    const flap = 0.75 + Math.abs(Math.sin(o.frame / 8)) * 0.25;
    for (const side of [-1, 1]) {
      ctx.fillStyle = 'hsl(30 95% 60%)';
      ctx.beginPath(); ctx.ellipse(side * (o.dw * 0.45 + 5 * flap), -o.dh * 0.15, 7 * flap, 6, side * -0.5, 0, TAU); fillStroke(ctx);
      ctx.fillStyle = 'hsl(190 85% 60%)';
      ctx.beginPath(); ctx.ellipse(side * (o.dw * 0.45 + 3.5 * flap), o.dh * 0.15, 4.5 * flap, 4, side * 0.5, 0, TAU); fillStroke(ctx);
    }
  },
  backpack: (ctx, p, o) => {
    ctx.fillStyle = p.accent;
    const x = -o.facing * o.dw * 0.5;
    ctx.beginPath(); ctx.roundRect(x - o.dw * 0.25, -o.dh * 0.2, o.dw * 0.5, o.dh * 0.5, 3); fillStroke(ctx);
    ctx.fillStyle = alpha(p.playerInk, 0.3); ctx.fillRect(x - o.dw * 0.18, o.dh * 0.02, o.dw * 0.36, 2);
  },
  shell: (ctx, p, o) => {
    const x = -o.facing * o.dw * 0.42;
    ctx.fillStyle = 'hsl(95 45% 40%)';
    ctx.beginPath(); ctx.ellipse(x, o.dh * 0.05, o.dw * 0.38, o.dh * 0.36, 0, 0, TAU); fillStroke(ctx);
    ctx.strokeStyle = 'hsl(60 50% 70%)';
    ctx.beginPath(); ctx.moveTo(x - o.dw * 0.3, o.dh * 0.05); ctx.lineTo(x + o.dw * 0.3, o.dh * 0.05); ctx.moveTo(x, -o.dh * 0.28); ctx.lineTo(x, o.dh * 0.38); ctx.stroke();
  },
  quiver: (ctx, p, o) => {
    const x = -o.facing * o.dw * 0.45;
    ctx.save(); ctx.translate(x, 0); ctx.rotate(-o.facing * 0.35);
    ctx.fillStyle = 'hsl(15 70% 45%)';
    for (const dx of [-2, 1, 4]) { ctx.beginPath(); ctx.moveTo(dx - 1.5, -o.dh * 0.42); ctx.lineTo(dx, -o.dh * 0.55); ctx.lineTo(dx + 1.5, -o.dh * 0.42); ctx.fill(); }
    ctx.fillStyle = BROWN;
    ctx.beginPath(); ctx.roundRect(-4, -o.dh * 0.4, 9, o.dh * 0.6, 3); fillStroke(ctx);
    ctx.restore();
  },
  tail: (ctx, p, o) => {
    const back = -o.facing, wag = Math.sin(o.frame / 7) * 2;
    ctx.strokeStyle = p.playerInk;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(back * o.dw * 0.35, o.dh * 0.3); ctx.bezierCurveTo(back * o.dw * 0.9, o.dh * 0.35, back * o.dw * 0.95, o.dh * 0.0 + wag, back * o.dw * 0.7, -o.dh * 0.05 + wag); ctx.stroke();
    ctx.strokeStyle = o.base;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  },
};

const ink = (ctx, p) => {
  ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
};

export function drawHat(ctx, p, kind, o) {
  ctx.save();
  ctx.translate(0, o.top);
  ctx.rotate(o.sway * 0.5);
  ink(ctx, p);
  HATS[kind](ctx, p, o);
  ctx.restore();
}

export function drawAccessory(ctx, p, kind, o) {
  ctx.save();
  ctx.translate(0, o.top);
  ctx.rotate(o.sway);
  ink(ctx, p);
  ctx.fillStyle = p.accent;
  ACCESSORIES[kind](ctx, p, o);
  ctx.restore();
}

export function drawWorn(ctx, p, table, kind, o) {
  ctx.save();
  ink(ctx, p);
  table[kind](ctx, p, o);
  ctx.restore();
}

const PATTERN_PAINTERS = {
  spots: (ctx, { spots }, dw, dh) => { for (const spot of spots) { ctx.moveTo(spot.x * dw + spot.r * dw, spot.y * dh); ctx.arc(spot.x * dw, spot.y * dh, spot.r * dw, 0, TAU); } },
  stripes: (ctx, a, dw, dh) => { for (const y of [0.13, 0.24]) ctx.rect(-dw / 2, y * dh, dw, dh * 0.045); },
  belly: (ctx, a, dw, dh) => { ctx.fillStyle = 'hsl(0 0% 100% / 0.35)'; ctx.ellipse(0, dh * 0.24, dw * 0.24, dh * 0.13, 0, 0, TAU); },
  checks: (ctx, a, dw, dh) => { const c = dw / 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) ctx.rect(-dw / 2 + i * c, -dh / 2 + j * c * 1.3, c, c * 1.3); },
  zigzag: (ctx, a, dw, dh) => { ctx.moveTo(-dw / 2, dh * 0.1); for (let i = 0; i <= 6; i++) ctx.lineTo(-dw / 2 + (i * dw) / 6, dh * (i % 2 ? 0.02 : 0.1)); ctx.lineTo(dw / 2, dh * 0.2); for (let i = 6; i >= 0; i--) ctx.lineTo(-dw / 2 + (i * dw) / 6, dh * (i % 2 ? 0.12 : 0.2)); ctx.closePath(); },
  stars: (ctx, { spots }, dw, dh) => { ctx.fillStyle = 'hsl(48 100% 70% / 0.55)'; for (const spot of spots) { star(ctx, spot.x * dw, spot.y * dh - dh * 0.05, spot.r * dw * 1.3); ctx.fill(); } ctx.beginPath(); },
  hearts: (ctx, { spots }, dw, dh) => { ctx.fillStyle = 'hsl(345 90% 65% / 0.5)'; for (const spot of spots) { heart(ctx, spot.x * dw, spot.y * dh - dh * 0.05, spot.r * dw); ctx.fill(); } ctx.beginPath(); },
  half: (ctx, a, dw, dh) => { ctx.rect(-dw / 2, dh * 0.08, dw, dh); },
  tiger: (ctx, a, dw, dh) => { for (const y of [-0.12, 0.05, 0.22]) for (const side of [-1, 1]) { ctx.moveTo(side * dw / 2, dh * y - 2); ctx.lineTo(side * dw * 0.18, dh * y); ctx.lineTo(side * dw / 2, dh * y + 2); } },
  diamonds: (ctx, a, dw, dh) => { for (let i = 0; i < 4; i++) { const x = -dw * 0.375 + (i * dw) / 4, y = dh * 0.2; ctx.moveTo(x, y - 4); ctx.lineTo(x + dw / 8, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - dw / 8, y); ctx.closePath(); } },
};

export function drawPattern(ctx, p, avatar, dw, dh) {
  ctx.save();
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh - 3, Math.min(8, dw / 3));
  ctx.clip();
  ctx.fillStyle = alpha(p.playerInk, 0.13);
  ctx.beginPath();
  PATTERN_PAINTERS[avatar.pattern](ctx, avatar, dw, dh);
  ctx.fill();
  ctx.restore();
}

export const OUTFIT_KINDS = {
  hats: Object.keys(HATS), accessories: Object.keys(ACCESSORIES), glasses: Object.keys(GLASSES), patterns: Object.keys(PATTERN_PAINTERS),
  faces: Object.keys(FACES), necks: Object.keys(NECKS), backs: Object.keys(BACKS),
};
