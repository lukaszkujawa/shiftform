import { TILE, COLS, WIDTH, HEIGHT, SOLID, ONE_WAY, tileAt, objectRect, phaseOn, floodLevel, levelIndex, crushed, slain } from './level.js';
import { TRICKS, TRICK_COST, placedAt } from './tricks.js';
import { COMBO_FROM } from './combo.js';
import { playerSize, laserOn, hookAnchor, JETPACK_FUEL, FALL_DAMAGE_SPEED, cometLift } from './physics.js';
import { laserBeam } from './bodies.js';
import { MAX_LIVES } from './climb.js';
import { themeFor, alpha } from './themes.js';
import { growDecor, paintDecor, drawDecor } from './decor.js';
import { growLife, drawLife } from './life.js';
import { RESTING, moodOf } from './avatar.js';

const TAU = Math.PI * 2;
const CULL_MARGIN = 160;
const COIN_COLOR = 'hsl(48 95% 60% / 1)';
const CARD = { w: 250, h: 190, gap: 24, y: 140 };
const KEEP = { w: 300, h: 44, y: 370 };
const SHOP_TEXT = 'hsl(0 0% 97%)';
const SLOT = { size: 34, gap: 6, y: 62, right: WIDTH - 14 };
const SHOP_DIM = 'hsl(240 10% 72%)';
const PARALLAX = 0.3;
const HORIZONS = new Set(['mountains', 'dunes', 'hills', 'skyline', 'fields', 'candyland', 'lavafalls', 'moonscape', 'seaside', 'graveyard', 'retro', 'industry', 'glowwood', 'skyland', 'woodland', 'colonnade', 'cove']);
const FLIP_FRAMES = 24;
const BAR_H = 40;

function jumpExtras(rules) {
  return [
    rules.flipOnJump && 'flips gravity',
    rules.blinkJump && 'teleports up',
    rules.jumps > 1 && `${rules.jumps}× in air`,
    rules.wallJump && 'off walls',
    rules.glide && 'hold to glide',
    rules.jumpBudget && `${rules.jumpBudget} total`,
  ].filter(Boolean);
}

export function controlsFor(level, muted = false, state = null) {
  const r = level.rules, index = levelIndex(level);
  const jump = jumpExtras(r);
  const grab = [index.crates.length && 'lift · throw crate', index.hooks.length && 'grab hook'].filter(Boolean);
  return [
    { caps: ['←', '→'], label: r.mirror ? 'move (reversed!)' : 'move', input: ['left', 'right'], special: r.mirror },
    { caps: ['Z'], label: ['jump', ...jump].join(' · '), input: ['jump'], special: jump.length > 0 },
    r.dash && { caps: ['X'], label: 'dash', input: ['dash'], special: true },
    grab.length && { caps: ['F'], label: grab.join(' · '), input: ['interact'], special: true },
    index.climbs.length && { caps: ['↑', '↓'], label: 'climb', input: ['up', 'down'], special: true },
    state?.boots > 0 && { caps: ['Z'], label: `in air · boots ×${state.boots}`, input: ['jump'], special: true },
    state?.fuel > 0 && { caps: ['Z'], label: 'in air · jetpack', input: ['jump'], special: true },
    { caps: ['R'], label: 'back to checkpoint' },
    { caps: ['H'], label: 'hint' },
    { caps: ['M'], label: muted ? 'sound off' : 'sound' },
    { caps: ['Esc'], label: 'menu' },
  ].filter(Boolean);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function seededNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

const BACKGROUNDS = {
  grid(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.ink, 0.08);
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 20, WIDTH / 2, HEIGHT / 2, 700);
    glow.addColorStop(0, alpha(p.accent, 0.18));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  },
  ruled(ctx, p, rand) {
    ctx.strokeStyle = 'hsl(205 60% 70% / 0.35)';
    ctx.lineWidth = 1;
    for (let y = 36; y < HEIGHT; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    ctx.strokeStyle = 'hsl(0 70% 60% / 0.4)';
    ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, HEIGHT); ctx.stroke();
    ctx.fillStyle = 'hsl(40 40% 60% / 0.12)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), 1 + rand() * 2, 0, TAU); ctx.fill(); }
  },
  rays(ctx, p, rand) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = p.rockEdge;
    for (let i = 0; i < 9; i++) {
      const x = -200 + i * 170 + rand() * 60;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 330, HEIGHT); ctx.lineTo(x + 200, HEIGHT); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  blobs(ctx, p, rand) {
    for (let i = 0; i < 16; i++) {
      const r = 50 + rand() * 120;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, alpha(p.rockEdge, 0.12));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(WIDTH * rand(), HEIGHT * rand()); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
    }
  },
  mountains(ctx, p, rand) {
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(210 35% ${30 + layer * 12}% / 0.8)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(x, HEIGHT * (0.45 + layer * 0.15) - rand() * 90 - layer * 20);
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  stars(ctx, p, rand) {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `hsl(0 0% 100% / ${0.2 + rand() * 0.7})`;
      ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), rand() < 0.1 ? 2 : 1, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 10, WIDTH / 2, HEIGHT / 2, 600);
    g.addColorStop(0, alpha(p.accent, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  },
  vines(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.rockEdge, 0.22);
    ctx.fillStyle = alpha(p.rockEdge, 0.16);
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x = WIDTH * rand(), len = HEIGHT * (0.2 + rand() * 0.6), sway = 20 + rand() * 30;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + sway, len / 2, x, len); ctx.stroke();
      for (let y = 30; y < len; y += 34) {
        const lx = x + sway * 0.5 * Math.sin((y / len) * Math.PI), side = (y / 34) % 2 ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(lx + side * 7, y, 8, 4, side * 0.6, 0, TAU); ctx.fill();
      }
    }
  },
  dunes(ctx, p, rand) {
    const sun = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.25, 10, WIDTH * 0.75, HEIGHT * 0.25, 160);
    sun.addColorStop(0, 'hsl(45 100% 92% / 0.9)');
    sun.addColorStop(0.3, 'hsl(40 100% 80% / 0.4)');
    sun.addColorStop(1, 'hsl(40 100% 80% / 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(${28 - layer * 4} ${45 + layer * 5}% ${68 - layer * 9}% / 0.7)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      let y = HEIGHT * (0.55 + layer * 0.13);
      ctx.lineTo(0, y);
      for (let x = 0; x < WIDTH; x += 240) {
        const next = HEIGHT * (0.5 + layer * 0.13) + rand() * 50;
        ctx.quadraticCurveTo(x + 120, y - 50 - rand() * 40, x + 240, next);
        y = next;
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  caustics(ctx, p, rand) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const x = WIDTH * rand(), w = 30 + rand() * 60;
      const shaft = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      shaft.addColorStop(0, alpha(p.waterLine, 0.12));
      shaft.addColorStop(1, alpha(p.waterLine, 0));
      ctx.fillStyle = shaft;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.5 - 60, HEIGHT); ctx.lineTo(x - 60, HEIGHT); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = alpha(p.waterLine, 0.18);
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), 2 + rand() * 4, 0, TAU); ctx.stroke(); }
  },
  hills(ctx, p, rand) {
    ctx.fillStyle = 'hsl(45 80% 92% / 0.75)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.2 + rand() * 0.6), HEIGHT * 0.22, 46, 0, TAU); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(${290 + layer * 15} 25% ${30 - layer * 6}% / 0.75)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = -100; x <= WIDTH + 100; x += 200) {
        const r = 120 + rand() * 80;
        ctx.arc(x + 100, HEIGHT * (0.7 + layer * 0.1) + r * 0.6, r, Math.PI * 1.1, Math.PI * 1.9);
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  skyline(ctx, p, rand) {
    const moon = ctx.createRadialGradient(WIDTH * (0.15 + rand() * 0.7), HEIGHT * 0.2, 8, WIDTH / 2, HEIGHT * 0.2, 260);
    moon.addColorStop(0, 'hsl(40 80% 90% / 0.5)');
    moon.addColorStop(1, 'hsl(40 80% 90% / 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let layer = 0; layer < 2; layer++) {
      for (let x = -10; x < WIDTH;) {
        const w = 40 + rand() * 70, top = HEIGHT * (0.3 + rand() * 0.35) + layer * 60;
        ctx.fillStyle = alpha(p.rockDeep, 0.55 + 0.3 * layer);
        ctx.fillRect(x, top, w - 4, HEIGHT - top);
        if (rand() < 0.3) ctx.fillRect(x + w / 2 - 2, top - 24, 2, 24);
        ctx.fillStyle = alpha(p.accent, 0.35 + 0.25 * layer);
        for (let wy = top + 8; wy < HEIGHT - 8; wy += 14) for (let wx = x + 5; wx < x + w - 12; wx += 10) if (rand() < 0.3) ctx.fillRect(wx, wy, 4, 6);
        x += w;
      }
    }
  },
  fields(ctx, p, rand) {
    ctx.fillStyle = 'hsl(50 100% 92% / 0.9)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.6 + rand() * 0.3), HEIGHT * 0.2, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(0 0% 100% / 0.6)';
    for (let i = 0; i < 5; i++) {
      const cx = WIDTH * rand(), cy = HEIGHT * (0.08 + rand() * 0.25);
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + k * 22 - 33, cy + (k % 2) * -8, 26, 14, 0, 0, TAU); ctx.fill(); }
    }
    const crest = [];
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(${90 + layer * 10} 45% ${58 - layer * 9}% / 0.85)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      let y = HEIGHT * (0.55 + layer * 0.12);
      ctx.lineTo(0, y);
      for (let x = 0; x < WIDTH; x += 240) {
        const next = HEIGHT * (0.55 + layer * 0.12) + rand() * 40 - 20;
        ctx.quadraticCurveTo(x + 120, y - 40 - rand() * 30, x + 240, next);
        crest.push({ layer, x: x + 120, y: (y + next) / 2 - 30 });
        y = next;
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    const mill = rand() < 0.5 ? crest[1] : crest[2];
    ctx.fillStyle = 'hsl(30 25% 92% / 0.9)';
    ctx.beginPath(); ctx.moveTo(mill.x - 10, mill.y + 20); ctx.lineTo(mill.x - 5, mill.y - 40); ctx.lineTo(mill.x + 5, mill.y - 40); ctx.lineTo(mill.x + 10, mill.y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'hsl(30 25% 92% / 0.9)';
    ctx.lineWidth = 4;
    const spin = rand() * TAU;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const a = spin + (k * TAU) / 4; ctx.moveTo(mill.x, mill.y - 40); ctx.lineTo(mill.x + Math.cos(a) * 34, mill.y - 40 + Math.sin(a) * 34); }
    ctx.stroke();
    ctx.strokeStyle = alpha(p.ink, 0.45);
    ctx.lineWidth = 2;
    const fenceY = HEIGHT * 0.86;
    ctx.beginPath();
    for (let x = 10; x < WIDTH; x += 34) { ctx.moveTo(x, fenceY); ctx.lineTo(x, fenceY - 22); }
    for (const dy of [-8, -17]) { ctx.moveTo(0, fenceY + dy); ctx.lineTo(WIDTH, fenceY + dy); }
    ctx.stroke();
  },
  bulkhead(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 120) { ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); }
    for (const y of [HEIGHT * 0.12, HEIGHT * 0.88]) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
    ctx.stroke();
    ctx.strokeStyle = alpha(p.ink, 0.15);
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, HEIGHT * 0.06); ctx.lineTo(WIDTH, HEIGHT * 0.06); ctx.stroke();
    for (let x = 60; x < WIDTH; x += 240) {
      const y = HEIGHT * (0.35 + rand() * 0.3), r = 34 + rand() * 12;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = 'hsl(235 50% 5%)'; ctx.fill(); ctx.clip();
      ctx.fillStyle = 'hsl(0 0% 100% / 0.8)';
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(x - r + rand() * r * 2, y - r + rand() * r * 2, rand() < 0.15 ? 1.5 : 0.8, 0, TAU); ctx.fill(); }
      if (rand() < 0.4) { ctx.fillStyle = alpha(p.accent, 0.5); ctx.beginPath(); ctx.arc(x + r * 0.4, y + r * 0.3, r * 0.35, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = alpha(p.rockEdge, 0.45);
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.stroke();
    }
  },
  candyland(ctx, p, rand) {
    ctx.fillStyle = 'hsl(0 0% 100% / 0.7)';
    for (let i = 0; i < 6; i++) {
      const cx = WIDTH * rand(), cy = HEIGHT * (0.08 + rand() * 0.3);
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx + k * 16 - 32, cy - Math.sin(k) * 10, 16, 0, TAU); ctx.fill(); }
    }
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 160 + rand() * 60, top = HEIGHT * (0.4 + rand() * 0.2), r = 22 + rand() * 14;
      ctx.strokeStyle = 'hsl(0 0% 100% / 0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, HEIGHT); ctx.stroke();
      ctx.fillStyle = `hsl(${(p.hue + i * 60) % 360} 80% 72% / 0.7)`;
      ctx.beginPath(); ctx.arc(x, top, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'hsl(0 0% 100% / 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.5; a += 0.2) { const rr = (a / (TAU * 2.5)) * r; ctx.lineTo(x + Math.cos(a) * rr, top + Math.sin(a) * rr); }
      ctx.stroke();
    }
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? 'hsl(330 70% 82% / 0.85)' : 'hsl(30 60% 78% / 0.75)';
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = -60; x <= WIDTH + 60; x += 120) ctx.arc(x + 60, HEIGHT * (0.8 + layer * 0.08), 60 + rand() * 20, Math.PI, 0);
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  blinds(ctx, p, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.35);
    for (let x = 80; x < WIDTH; x += 260) ctx.fillRect(x, HEIGHT * 0.04, 90, 6);
    for (let x = 40; x < WIDTH; x += 320) {
      const w = 220, top = HEIGHT * 0.15, h = HEIGHT * 0.45;
      const sky = ctx.createLinearGradient(0, top, 0, top + h);
      sky.addColorStop(0, 'hsl(205 60% 75% / 0.8)');
      sky.addColorStop(1, 'hsl(205 40% 88% / 0.8)');
      ctx.fillStyle = sky;
      ctx.fillRect(x, top, w, h);
      ctx.fillStyle = 'hsl(215 15% 55% / 0.5)';
      for (let bx = x; bx < x + w;) { const bw = 20 + rand() * 30, bh = h * (0.2 + rand() * 0.5); ctx.fillRect(bx, top + h - bh, bw - 3, bh); bx += bw; }
      ctx.fillStyle = 'hsl(0 0% 100% / 0.55)';
      for (let y = top; y < top + h * (0.4 + rand() * 0.5); y += 9) ctx.fillRect(x, y, w, 5);
      ctx.strokeStyle = alpha(p.ink, 0.35);
      ctx.lineWidth = 4;
      ctx.strokeRect(x, top, w, h);
    }
    ctx.fillStyle = alpha(p.rockDeep, 0.45);
    for (let x = 0; x < WIDTH; x += 150) ctx.fillRect(x + 6, HEIGHT * 0.72, 138, HEIGHT * 0.28);
    ctx.fillStyle = alpha(p.ink, 0.3);
    for (let x = 0; x < WIDTH; x += 150) ctx.fillRect(x + 6, HEIGHT * 0.72, 138, 4);
  },
  code(ctx, p, rand) {
    ctx.font = '14px monospace';
    for (let x = 4; x < WIDTH; x += 16) {
      if (rand() < 0.4) continue;
      const start = rand() * HEIGHT - 100, length = 6 + Math.floor(rand() * 20);
      for (let k = 0; k < length; k++) {
        ctx.fillStyle = alpha(k === length - 1 ? p.accent : p.ink, k === length - 1 ? 0.6 : 0.08 + 0.22 * (k / length));
        ctx.fillText(GLYPHS[Math.floor(rand() * GLYPHS.length)], x, start + k * 16);
      }
    }
  },
  lavafalls(ctx, p, rand) {
    const glow = ctx.createLinearGradient(0, HEIGHT * 0.5, 0, HEIGHT);
    glow.addColorStop(0, 'hsl(15 100% 50% / 0)');
    glow.addColorStop(1, 'hsl(20 100% 50% / 0.45)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = `hsl(350 30% ${5 + layer * 5}% / 0.9)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 30) ctx.lineTo(x, HEIGHT * (0.35 + layer * 0.2) + (x / 30) % 2 * 30 - rand() * 70);
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const x = 80 + rand() * (WIDTH - 160), top = HEIGHT * (0.3 + rand() * 0.2), w = 6 + rand() * 10;
      const fall = ctx.createLinearGradient(0, top, 0, HEIGHT);
      fall.addColorStop(0, 'hsl(45 100% 65% / 0.8)');
      fall.addColorStop(1, 'hsl(10 100% 50% / 0.5)');
      ctx.fillStyle = fall;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.quadraticCurveTo(x + w * 2, top + 40, x + w, HEIGHT); ctx.lineTo(x + w * 2, HEIGHT); ctx.quadraticCurveTo(x + w * 3, top + 40, x + w, top); ctx.closePath(); ctx.fill();
    }
  },
  moonscape(ctx, p, rand) {
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `hsl(0 0% 100% / ${0.2 + rand() * 0.7})`;
      ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * 0.7 * rand(), rand() < 0.1 ? 1.6 : 0.8, 0, TAU); ctx.fill();
    }
    const ex = WIDTH * (0.2 + rand() * 0.6), ey = HEIGHT * 0.25, er = 46;
    ctx.fillStyle = 'hsl(210 70% 50%)';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(120 45% 42%)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(ex - er * 0.5 + rand() * er, ey - er * 0.5 + rand() * er, 10 + rand() * 12, 6 + rand() * 8, rand() * 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'hsl(230 30% 3% / 0.6)';
    ctx.beginPath(); ctx.arc(ex + er * 0.45, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(p.rockDeep, 0.85);
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 60) ctx.lineTo(x, HEIGHT * 0.78 - rand() * 30);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = alpha(p.rockEdge, 0.25);
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(WIDTH * rand(), HEIGHT * (0.85 + rand() * 0.12), 20 + rand() * 30, 5 + rand() * 4, 0, 0, TAU); ctx.stroke(); }
  },
  seaside(ctx, p, rand) {
    ctx.fillStyle = 'hsl(45 100% 92% / 0.85)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.15 + rand() * 0.7), HEIGHT * 0.35, 36, 0, TAU); ctx.fill();
    const sea = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
    sea.addColorStop(0, 'hsl(200 60% 45% / 0.9)');
    sea.addColorStop(1, 'hsl(210 65% 28% / 0.95)');
    ctx.fillStyle = sea;
    ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);
    ctx.strokeStyle = 'hsl(0 0% 100% / 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) { const x = WIDTH * rand(), y = HEIGHT * (0.58 + rand() * 0.4); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + rand() * 20, y); ctx.stroke(); }
    for (let i = 0; i < 3; i++) {
      const x = WIDTH * rand(), y = HEIGHT * 0.55, s = 0.6 + rand() * 0.8;
      ctx.fillStyle = alpha(p.ink, 0.55);
      ctx.beginPath(); ctx.moveTo(x - 30 * s, y - 8 * s); ctx.lineTo(x + 30 * s, y - 8 * s); ctx.lineTo(x + 22 * s, y); ctx.lineTo(x - 22 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'hsl(40 40% 96% / 0.85)';
      ctx.beginPath(); ctx.moveTo(x, y - 10 * s); ctx.lineTo(x, y - 56 * s); ctx.lineTo(x + 24 * s, y - 14 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 12 * s); ctx.lineTo(x - 3 * s, y - 44 * s); ctx.lineTo(x - 20 * s, y - 14 * s); ctx.closePath(); ctx.fill();
    }
    const lx = rand() < 0.5 ? WIDTH * 0.08 : WIDTH * 0.9;
    ctx.fillStyle = 'hsl(0 0% 96% / 0.9)';
    ctx.beginPath(); ctx.moveTo(lx - 12, HEIGHT * 0.56); ctx.lineTo(lx - 7, HEIGHT * 0.3); ctx.lineTo(lx + 7, HEIGHT * 0.3); ctx.lineTo(lx + 12, HEIGHT * 0.56); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'hsl(355 70% 50% / 0.9)';
    for (const t of [0.36, 0.46]) ctx.fillRect(lx - 11, HEIGHT * t, 22, 10);
    ctx.fillStyle = 'hsl(50 100% 70% / 0.9)';
    ctx.fillRect(lx - 8, HEIGHT * 0.27, 16, 12);
  },
  graveyard(ctx, p, rand) {
    const mx = WIDTH * (0.2 + rand() * 0.6), my = HEIGHT * 0.22;
    const halo = ctx.createRadialGradient(mx, my, 30, mx, my, 220);
    halo.addColorStop(0, 'hsl(60 60% 90% / 0.35)');
    halo.addColorStop(1, 'hsl(60 60% 90% / 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'hsl(55 50% 90% / 0.95)';
    ctx.beginPath(); ctx.arc(mx, my, 42, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(p.rockDeep, 0.95);
    const hx = WIDTH * (0.2 + rand() * 0.6), hy = HEIGHT * 0.62;
    ctx.fillRect(hx - 70, hy - 70, 140, 70);
    ctx.beginPath(); ctx.moveTo(hx - 80, hy - 70); ctx.lineTo(hx, hy - 130); ctx.lineTo(hx + 80, hy - 70); ctx.closePath(); ctx.fill();
    ctx.fillRect(hx + 30, hy - 150, 22, 60);
    ctx.fillStyle = 'hsl(45 100% 60% / 0.7)';
    for (let i = 0; i < 4; i++) if (rand() < 0.6) ctx.fillRect(hx - 55 + i * 32, hy - 50, 12, 16);
    ctx.fillStyle = alpha(p.rockDeep, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 80) ctx.lineTo(x, HEIGHT * 0.68 + Math.sin(x * 0.01 + rand()) * 12);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = alpha(p.rockDeep, 0.95);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = WIDTH * rand(), y = HEIGHT * 0.7;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 90); ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const by = y - 40 - k * 12, side = k % 2 ? 1 : -1; ctx.moveTo(x + 3, by); ctx.lineTo(x + side * (20 + rand() * 20), by - 15 - rand() * 15); }
      ctx.stroke();
    }
  },
  retro(ctx, p, rand) {
    const cx = WIDTH / 2, cy = HEIGHT * 0.5, r = 120;
    const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sun.addColorStop(0, 'hsl(50 100% 65%)');
    sun.addColorStop(1, 'hsl(330 100% 60%)');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = p.bgBottom;
    for (let k = 0; k < 6; k++) ctx.fillRect(cx - r, cy + 10 + k * 18, r * 2, 3 + k * 1.5);
    ctx.restore();
    ctx.strokeStyle = alpha(p.rockEdge, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy + 40);
    for (let x = 0; x <= WIDTH; x += 48) ctx.lineTo(x, cy + 40 - Math.abs(Math.sin(x * 0.013 + rand())) * 90);
    ctx.stroke();
    const horizon = cy + 40;
    ctx.fillStyle = 'hsl(270 60% 6% / 0.9)';
    ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);
    ctx.strokeStyle = alpha(p.rockEdge, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = -12; k <= 12; k++) { ctx.moveTo(cx + k * 20, horizon); ctx.lineTo(cx + k * 160, HEIGHT); }
    for (let k = 1; k < 9; k++) { const y = horizon + (HEIGHT - horizon) * (k / 9) ** 2; ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
    ctx.stroke();
  },
  industry(ctx, p, rand) {
    ctx.fillStyle = 'hsl(30 10% 70% / 0.18)';
    for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * 0.3 * rand(), 30 + rand() * 50, 0, TAU); ctx.fill(); }
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = `hsl(30 12% ${10 + layer * 7}% / 0.9)`;
      for (let x = -20; x < WIDTH;) {
        const w = 60 + rand() * 90, top = HEIGHT * (0.5 + rand() * 0.15) + layer * 50;
        ctx.fillRect(x, top, w - 6, HEIGHT - top);
        if (rand() < 0.5) {
          const sx = x + 10 + rand() * (w - 30);
          ctx.fillRect(sx, top - 90 - rand() * 60, 14, 160);
        }
        if (rand() < 0.4) { ctx.beginPath(); ctx.moveTo(x, top); for (let k = 0; k < 3; k++) { ctx.lineTo(x + (k + 0.5) * (w / 3), top - 18); ctx.lineTo(x + (k + 1) * (w / 3), top); } ctx.fill(); }
        x += w;
      }
    }
    ctx.strokeStyle = alpha(p.accent, 0.25);
    ctx.lineWidth = 6;
    for (let i = 0; i < 2; i++) {
      const gx = WIDTH * rand(), gy = HEIGHT * (0.25 + rand() * 0.3), gr = 30 + rand() * 20;
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ctx.moveTo(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr); ctx.lineTo(gx + Math.cos(a) * (gr + 10), gy + Math.sin(a) * (gr + 10)); }
      ctx.stroke();
    }
  },
  glowwood(ctx, p, rand) {
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 5; i++) {
        const x = WIDTH * rand(), base = HEIGHT, h = HEIGHT * (0.35 + rand() * 0.3) + layer * 40, cap = 50 + rand() * 50 - layer * 10;
        ctx.fillStyle = `hsl(250 30% ${10 + layer * 6}% / 0.85)`;
        ctx.fillRect(x - 8, base - h, 16, h);
        ctx.fillStyle = `hsl(${280 + layer * 20} 45% ${18 + layer * 8}% / 0.9)`;
        ctx.beginPath(); ctx.ellipse(x, base - h, cap, cap * 0.45, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
        ctx.fillStyle = alpha(p.rockEdge, 0.5);
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - cap * 0.6 + rand() * cap * 1.2, base - h - rand() * cap * 0.35, 3 + rand() * 4, 0, TAU); ctx.fill(); }
      }
    }
    ctx.fillStyle = alpha(p.accent, 0.6);
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), 1 + rand() * 1.5, 0, TAU); ctx.fill(); }
  },
  skyland(ctx, p, rand) {
    ctx.fillStyle = 'hsl(50 100% 95% / 0.9)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.1 + rand() * 0.8), HEIGHT * 0.15, 34, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 320 + rand() * 80, y = HEIGHT * (0.35 + rand() * 0.25), w = 70 + rand() * 50;
      ctx.fillStyle = 'hsl(150 35% 45% / 0.55)';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.2, y + w * 0.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'hsl(210 25% 70% / 0.6)';
      if (i === 1) {
        ctx.fillRect(x - 30, y - 50, 60, 50);
        for (const tx of [-34, 22]) { ctx.fillRect(x + tx, y - 76, 12, 76); ctx.beginPath(); ctx.moveTo(x + tx - 3, y - 76); ctx.lineTo(x + tx + 6, y - 94); ctx.lineTo(x + tx + 15, y - 76); ctx.closePath(); ctx.fill(); }
      }
    }
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = `hsl(0 0% 100% / ${0.5 + layer * 0.3})`;
      for (let i = 0; i < 5; i++) {
        const cx = WIDTH * rand(), cy = HEIGHT * (0.6 + layer * 0.2 + rand() * 0.1);
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(cx + k * 26 - 65, cy - Math.sin(k * 1.1) * 14, 30 + rand() * 10, 0, TAU); ctx.fill(); }
      }
    }
  },
  woodland(ctx, p, rand) {
    ctx.fillStyle = 'hsl(45 100% 90% / 0.8)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.2 + rand() * 0.6), HEIGHT * 0.18, 36, 0, TAU); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      const base = HEIGHT * (0.5 + layer * 0.17);
      for (let x = -30; x < WIDTH + 30; x += 70 + rand() * 50) {
        const h = 90 + rand() * 90 - layer * 20, r = 30 + rand() * 30;
        ctx.fillStyle = `hsl(${20 + layer * 6} 40% ${12 + layer * 8}% / 0.9)`;
        ctx.fillRect(x - 4, base - h, 8, h + 40);
        ctx.fillStyle = `hsl(${18 + rand() * 20} ${70 - layer * 10}% ${42 - layer * 8}% / 0.92)`;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + (rand() - 0.5) * r * 1.4, base - h + (rand() - 0.5) * r, r * (0.6 + rand() * 0.5), 0, TAU); ctx.fill(); }
      }
    }
    ctx.fillStyle = 'hsl(22 55% 24% / 0.95)';
    ctx.fillRect(0, HEIGHT * 0.9, WIDTH, HEIGHT * 0.1);
  },
  colonnade(ctx, p, rand) {
    ctx.fillStyle = 'hsl(35 30% 28% / 0.9)';
    ctx.beginPath(); ctx.moveTo(0, HEIGHT); ctx.lineTo(0, HEIGHT * 0.72); ctx.lineTo(WIDTH * 0.5, HEIGHT * 0.52); ctx.lineTo(WIDTH, HEIGHT * 0.72); ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
    for (let step = 0; step < 4; step++) { ctx.fillStyle = `hsl(35 30% ${30 + step * 4}% / 0.9)`; ctx.fillRect(WIDTH * 0.5 - 140 + step * 20, HEIGHT * (0.72 - step * 0.05), 280 - step * 40, HEIGHT * 0.06); }
    for (let x = 60; x < WIDTH; x += 150 + rand() * 60) {
      const h = HEIGHT * (0.3 + rand() * 0.25), w = 22, top = HEIGHT * 0.78 - h, broken = rand() < 0.5;
      ctx.fillStyle = 'hsl(38 30% 40% / 0.95)';
      ctx.fillRect(x, top, w, h);
      ctx.fillStyle = 'hsl(38 30% 50% / 0.95)';
      if (broken) { ctx.beginPath(); ctx.moveTo(x - 2, top + 8); ctx.lineTo(x + w / 2, top - 6); ctx.lineTo(x + w + 2, top + 4); ctx.lineTo(x + w, top + 12); ctx.lineTo(x, top + 12); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(x - 5, top - 6, w + 10, 8);
      ctx.fillRect(x - 5, HEIGHT * 0.78 - 8, w + 10, 8);
    }
    for (let i = 0; i < 3; i++) {
      const tx = WIDTH * (0.15 + rand() * 0.7), ty = HEIGHT * (0.45 + rand() * 0.2);
      const glow = ctx.createRadialGradient(tx, ty, 2, tx, ty, 90);
      glow.addColorStop(0, alpha(p.accent, 0.4)); glow.addColorStop(1, alpha(p.accent, 0));
      ctx.fillStyle = glow; ctx.fillRect(tx - 90, ty - 90, 180, 180);
    }
  },
  honeycomb(ctx, p, rand) {
    const r = 46, w = r * Math.sqrt(3);
    ctx.lineWidth = 3;
    for (let row = -1; row < HEIGHT / (r * 1.5) + 1; row++) {
      for (let col = -1; col < WIDTH / w + 1; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * TAU) / 6; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.closePath();
        const filled = rand() < 0.3;
        ctx.fillStyle = filled ? `hsl(${40 + rand() * 12} 90% ${38 + rand() * 12}% / 0.3)` : 'hsl(35 70% 30% / 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'hsl(30 60% 22% / 0.35)';
        ctx.stroke();
      }
    }
    ctx.fillStyle = alpha(p.accent, 0.8);
    for (let i = 0; i < 6; i++) { const x = WIDTH * rand(), y = HEIGHT * rand() * 0.5, len = 30 + rand() * 60; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x - 6, y + len * 0.6, x, y + len); ctx.quadraticCurveTo(x + 6, y + len * 0.6, x + 5, y); ctx.closePath(); ctx.fill(); }
  },
  vats(ctx, p, rand) {
    ctx.fillStyle = 'hsl(200 10% 18% / 0.95)';
    ctx.fillRect(0, HEIGHT * 0.86, WIDTH, HEIGHT * 0.14);
    ctx.strokeStyle = 'hsl(200 10% 40% / 0.9)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, HEIGHT * 0.12); ctx.lineTo(WIDTH, HEIGHT * 0.12); ctx.moveTo(0, HEIGHT * 0.2); ctx.lineTo(WIDTH * 0.6, HEIGHT * 0.2); ctx.lineTo(WIDTH * 0.6, HEIGHT * 0.5); ctx.stroke();
    for (let x = 40; x < WIDTH; x += 190 + rand() * 60) {
      const w = 70 + rand() * 30, top = HEIGHT * (0.35 + rand() * 0.15), level = 0.3 + rand() * 0.5, bottom = HEIGHT * 0.86;
      ctx.fillStyle = 'hsl(200 20% 60% / 0.18)';
      ctx.beginPath(); ctx.roundRect(x, top, w, bottom - top, 14); ctx.fill();
      ctx.fillStyle = alpha(p.rockEdge, 0.55);
      ctx.beginPath(); ctx.roundRect(x + 4, bottom - (bottom - top) * level, w - 8, (bottom - top) * level - 4, 10); ctx.fill();
      ctx.fillStyle = alpha(p.rockEdge, 0.9);
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 8 + rand() * (w - 16), bottom - rand() * (bottom - top) * level, 1.5 + rand() * 2.5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'hsl(200 20% 70% / 0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, top, w, bottom - top, 14); ctx.stroke();
      ctx.fillStyle = 'hsl(200 10% 35% / 0.95)'; ctx.fillRect(x - 6, top - 10, w + 12, 12);
    }
    for (let x = 0; x < WIDTH; x += 40) { ctx.fillStyle = (x / 40) % 2 ? 'hsl(50 100% 55% / 0.8)' : 'hsl(0 0% 8% / 0.9)'; ctx.beginPath(); ctx.moveTo(x, HEIGHT * 0.86); ctx.lineTo(x + 40, HEIGHT * 0.86); ctx.lineTo(x + 20, HEIGHT * 0.86 + 12); ctx.lineTo(x - 20, HEIGHT * 0.86 + 12); ctx.closePath(); ctx.fill(); }
  },
  cove(ctx, p, rand) {
    ctx.fillStyle = 'hsl(50 60% 92% / 0.9)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.6 + rand() * 0.3), HEIGHT * 0.22, 30, 0, TAU); ctx.fill();
    const sea = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT);
    sea.addColorStop(0, 'hsl(205 60% 35% / 0.9)'); sea.addColorStop(1, 'hsl(215 65% 20% / 0.95)');
    ctx.fillStyle = sea; ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4);
    ctx.strokeStyle = 'hsl(0 0% 100% / 0.25)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) { const x = WIDTH * rand(), y = HEIGHT * (0.63 + rand() * 0.35); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12 + rand() * 24, y); ctx.stroke(); }
    const sx = WIDTH * (0.25 + rand() * 0.4), sy = HEIGHT * 0.6, s = 1.1 + rand() * 0.5;
    ctx.fillStyle = 'hsl(25 35% 14% / 0.98)';
    ctx.beginPath(); ctx.moveTo(sx - 70 * s, sy - 14 * s); ctx.lineTo(sx + 80 * s, sy - 14 * s); ctx.lineTo(sx + 60 * s, sy + 8 * s); ctx.lineTo(sx - 55 * s, sy + 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(sx - 4 * s, sy - 110 * s, 5 * s, 100 * s); ctx.fillRect(sx + 36 * s, sy - 90 * s, 4 * s, 80 * s);
    ctx.fillStyle = 'hsl(40 25% 88% / 0.9)';
    ctx.beginPath(); ctx.moveTo(sx - 2 * s, sy - 100 * s); ctx.quadraticCurveTo(sx - 50 * s, sy - 60 * s, sx - 2 * s, sy - 24 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + 38 * s, sy - 82 * s); ctx.quadraticCurveTo(sx + 80 * s, sy - 50 * s, sx + 38 * s, sy - 26 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'hsl(0 0% 8%)'; ctx.fillRect(sx - 4 * s, sy - 110 * s, 22 * s, 12 * s);
    ctx.fillStyle = 'hsl(0 0% 95%)'; ctx.beginPath(); ctx.arc(sx + 7 * s, sy - 104 * s, 3 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(25 30% 12% / 0.95)';
    for (const side of [0, 1]) { ctx.beginPath(); ctx.moveTo(side ? WIDTH : 0, HEIGHT); ctx.lineTo(side ? WIDTH : 0, HEIGHT * 0.35); ctx.lineTo(side ? WIDTH - 90 - rand() * 60 : 90 + rand() * 60, HEIGHT * 0.5); ctx.lineTo(side ? WIDTH - 60 : 60, HEIGHT * 0.75); ctx.lineTo(side ? WIDTH - 120 : 120, HEIGHT); ctx.closePath(); ctx.fill(); }
  },
  stainedglass(ctx, p, rand) {
    ctx.fillStyle = 'hsl(235 12% 22% / 0.95)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let x = 70; x < WIDTH; x += 240) {
      const w = 110, top = HEIGHT * 0.1, bottom = HEIGHT * 0.85;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top + w / 2); ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, bottom); ctx.closePath();
      ctx.clip();
      const jewels = [[350, 55, 42], [215, 55, 45], [45, 70, 55], [150, 40, 38], [275, 40, 45], [20, 60, 48]];
      for (let gy = top; gy < bottom; gy += 28) for (let gx = x; gx < x + w; gx += 22) { const [jh, js, jl] = jewels[Math.floor(rand() * jewels.length)]; ctx.fillStyle = `hsl(${jh} ${js}% ${jl + rand() * 8}% / 0.6)`; ctx.fillRect(gx, gy, 22, 28); }
      ctx.strokeStyle = 'hsl(0 0% 8% / 0.9)'; ctx.lineWidth = 2;
      for (let gy = top; gy < bottom; gy += 28) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
      for (let gx = x; gx <= x + w; gx += 22) { ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bottom); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'hsl(230 10% 60% / 0.9)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top + w / 2); ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, bottom); ctx.stroke();
      ctx.fillStyle = 'hsl(230 10% 32% / 0.95)'; ctx.fillRect(x + w + 50, 0, 30, HEIGHT);
    }
    ctx.fillStyle = 'hsl(230 12% 18% / 0.95)'; ctx.fillRect(0, HEIGHT * 0.85, WIDTH, HEIGHT * 0.15);
    for (let i = 0; i < 5; i++) { const cx = WIDTH * rand(), cy = HEIGHT * 0.84; const glow = ctx.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, 40); glow.addColorStop(0, alpha(p.accent, 0.6)); glow.addColorStop(1, alpha(p.accent, 0)); ctx.fillStyle = glow; ctx.fillRect(cx - 40, cy - 50, 80, 80); }
  },
};

const PATTERNS = {
  none() {},
  hatch(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -TILE; i < TILE; i += 7) { ctx.moveTo(x + i, y + TILE); ctx.lineTo(x + i + TILE, y); }
    ctx.stroke();
  },
  facets(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.18);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); ctx.lineTo(x, y + TILE); ctx.closePath(); ctx.fill();
    ctx.fillStyle = alpha(p.rockDeep, 0.5);
    ctx.beginPath(); ctx.moveTo(x + TILE, y + TILE); ctx.lineTo(x + TILE, y + TILE * 0.4); ctx.lineTo(x + TILE * 0.4, y + TILE); ctx.closePath(); ctx.fill();
  },
  cracks(ctx, p, x, y, rand) {
    if (rand() > 0.35) return;
    ctx.strokeStyle = p.rockDeep;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + rand() * TILE, y);
    ctx.lineTo(x + rand() * TILE, y + TILE * 0.5);
    ctx.lineTo(x + rand() * TILE, y + TILE);
    ctx.stroke();
  },
  frost(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.25);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + rand() * TILE, y + rand() * TILE, 1.5, 0, TAU); ctx.fill(); }
  },
  moss(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.35);
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x + rand() * TILE, y + 6 + rand() * (TILE - 10), 4, 2, rand() * Math.PI, 0, TAU); ctx.fill(); }
  },
  strata(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.3);
    ctx.fillRect(x, y + 11 + rand() * 3, TILE, 2);
    ctx.fillRect(x, y + 22 + rand() * 3, TILE, 1.5);
  },
  barnacles(ctx, p, x, y, rand) {
    if (rand() > 0.2) return;
    ctx.strokeStyle = alpha(p.rockEdge, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 6 + rand() * 18, y + 8 + rand() * 16, 2.5 + rand() * 2, 0, TAU); ctx.stroke();
  },
  waves(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const r of [5, 10, 15]) { ctx.moveTo(x + TILE / 2 + r, y + TILE); ctx.arc(x + TILE / 2, y + TILE, r, 0, Math.PI, true); }
    ctx.stroke();
  },
  dots(ctx, p, x, y, rand) {
    if (rand() > 0.3) return;
    ctx.fillStyle = p.rockDeep;
    ctx.fillRect(x + 8 + rand() * 12, y + 8 + rand() * 12, 5, 5);
  },
  bricks(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let row = 0; row < 3; row++) {
      const ry = y + row * 10, joint = row % 2 ? 7 : 22;
      ctx.moveTo(x, ry); ctx.lineTo(x + TILE, ry);
      ctx.moveTo(x + joint, ry); ctx.lineTo(x + joint, ry + 10);
    }
    ctx.stroke();
  },
  turf(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.7);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + rand() * TILE, y + 8 + rand() * (TILE - 10), 2.5, 1.5, 0, 0, TAU); ctx.fill(); }
  },
  rivets(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = alpha(p.ink, 0.35);
    for (const [dx, dy] of [[5, 5], [TILE - 5, 5], [5, TILE - 5], [TILE - 5, TILE - 5]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.5, 0, TAU); ctx.fill(); }
  },
  sprinkles(ctx, p, x, y, rand) {
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const cx = x + 5 + rand() * (TILE - 10), cy = y + 7 + rand() * (TILE - 12), a = rand() * Math.PI;
      ctx.strokeStyle = `hsl(${Math.floor(rand() * 360)} 85% 68%)`;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 3, cy - Math.sin(a) * 3); ctx.lineTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3); ctx.stroke();
    }
  },
  ceiling(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    ctx.fillStyle = alpha(p.rockDeep, 0.5);
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + rand() * (TILE - 8), y + 4 + rand() * (TILE - 8), 1.5, 1.5);
  },
  circuit(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockEdge, 0.35);
    ctx.fillStyle = alpha(p.rockEdge, 0.5);
    ctx.lineWidth = 1;
    const cx = x + 8 + rand() * 14, cy = y + 8 + rand() * 14;
    ctx.beginPath();
    if (rand() < 0.5) { ctx.moveTo(x, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, y + TILE); }
    else { ctx.moveTo(cx, y); ctx.lineTo(cx, cy); ctx.lineTo(x + TILE, cy); }
    ctx.stroke();
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  },
  magma(ctx, p, x, y, rand) {
    if (rand() > 0.45) return;
    ctx.strokeStyle = alpha(p.rockEdge, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + rand() * TILE, y + rand() * 6);
    ctx.lineTo(x + rand() * TILE, y + TILE * 0.5);
    ctx.lineTo(x + rand() * TILE, y + TILE - rand() * 6);
    ctx.stroke();
  },
  craters(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) { if (rand() < 0.5) continue; ctx.beginPath(); ctx.arc(x + 6 + rand() * 18, y + 8 + rand() * 16, 2 + rand() * 4, 0, TAU); ctx.stroke(); }
  },
  planks(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 15); ctx.lineTo(x + TILE, y + 15);
    const seam = x + 6 + Math.floor(rand() * 18);
    ctx.moveTo(seam, y + 15); ctx.lineTo(seam, y + TILE);
    ctx.stroke();
    ctx.fillStyle = alpha(p.rockDeep, 0.9);
    ctx.fillRect(x + 4, y + 6, 2, 2);
  },
  scanlines(ctx, p, x, y) {
    ctx.fillStyle = alpha(p.rockEdge, 0.12);
    for (let k = 4; k < TILE; k += 6) ctx.fillRect(x, y + k, TILE, 2);
  },
  grating(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= TILE; k += 10) { ctx.moveTo(x + k, y); ctx.lineTo(x + k, y + TILE); ctx.moveTo(x, y + k); ctx.lineTo(x + TILE, y + k); }
    ctx.stroke();
  },
  bark(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const lx = x + 5 + rand() * (TILE - 10); ctx.moveTo(lx, y + 2); ctx.quadraticCurveTo(lx + rand() * 4 - 2, y + TILE / 2, lx + rand() * 3 - 1.5, y + TILE - 2); }
    ctx.stroke();
  },
  carved(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.75);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    if (rand() > 0.35) return;
    ctx.beginPath();
    const g = Math.floor(rand() * 3);
    if (g === 0) { ctx.moveTo(x + 8, y + 22); ctx.lineTo(x + 15, y + 8); ctx.lineTo(x + 22, y + 22); }
    else if (g === 1) { ctx.arc(x + 15, y + 15, 6, 0, TAU); ctx.moveTo(x + 15, y + 9); ctx.lineTo(x + 15, y + 21); }
    else { for (let k = 0; k < 3; k++) { ctx.moveTo(x + 7, y + 9 + k * 6); ctx.lineTo(x + 23, y + 9 + k * 6); } }
    ctx.stroke();
  },
  hex(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * TAU) / 6; ctx.lineTo(x + TILE / 2 + Math.cos(a) * 12, y + TILE / 2 + Math.sin(a) * 12); }
    ctx.closePath();
    ctx.stroke();
  },
  masonry(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 15); ctx.lineTo(x + TILE, y + 15);
    const joint = x + (rand() < 0.5 ? 9 : 21);
    ctx.moveTo(joint, y); ctx.lineTo(joint, y + 15);
    ctx.moveTo(joint + (joint - x > 15 ? -12 : 12), y + 15); ctx.lineTo(joint + (joint - x > 15 ? -12 : 12), y + TILE);
    ctx.stroke();
  },
  cloudy(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.45);
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + 6 + rand() * 18, y + 12 + rand() * 14, 5 + rand() * 4, 0, TAU); ctx.fill(); }
  },
};

function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  BACKGROUNDS[theme.background](canvas.getContext('2d'), p, seededNoise(level.palette * 7919 + 13));
  return canvas;
}

function renderTiles(level, theme, p, decor) {
  const canvas = new OffscreenCanvas(WIDTH, level.height);
  const ctx = canvas.getContext('2d');
  const rand = seededNoise(level.palette * 104729 + 7);

  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(level, c, r);
      if (tile === 0) continue;
      const x = c * TILE, y = r * TILE;
      if (tile === ONE_WAY) {
        ctx.fillStyle = p.rockEdge;
        roundRect(ctx, x, y, TILE, 8, 3);
        ctx.fill();
        if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
        continue;
      }
      ctx.fillStyle = p.rock;
      ctx.fillRect(x, y, TILE, TILE);
      PATTERNS[theme.pattern](ctx, p, x, y, rand);
    }
  }

  const bothFaces = level.rules.flipOnJump || level.rules.flipPeriod > 0;
  const up = level.rules.baseGravDir < 0;
  ctx.lineCap = 'round';
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solid(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const top = !solid(c, r - 1), bottom = !solid(c, r + 1), left = !solid(c - 1, r), right = !solid(c + 1, r);
      if (theme.hollow) {
        ctx.fillStyle = p.rockDeep;
        ctx.fillRect(x + (left ? 3 : 0), y + (top ? 3 : 0), TILE - (left ? 3 : 0) - (right ? 3 : 0), TILE - (top ? 3 : 0) - (bottom ? 3 : 0));
        ctx.fillStyle = p.rock;
        ctx.fillRect(x + (left ? 5 : 0), y + (top ? 5 : 0), TILE - (left ? 5 : 0) - (right ? 5 : 0), TILE - (top ? 5 : 0) - (bottom ? 5 : 0));
      }
      const lipTop = top && (!up || bothFaces), lipBottom = bottom && (up || bothFaces);
      ctx.fillStyle = p.rockEdge;
      if (lipTop) ctx.fillRect(x, y, TILE, theme.hollow ? 3 : 4);
      if (lipBottom) ctx.fillRect(x, y + TILE - (theme.hollow ? 3 : 4), TILE, theme.hollow ? 3 : 4);
      if (theme.hollow) {
        if (left) ctx.fillRect(x, y, 3, TILE);
        if (right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      }
      if (theme.outline) {
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = theme.outline;
        ctx.beginPath();
        if (top) { ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); }
        if (bottom) { ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y + TILE); }
        if (left) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE); }
        if (right) { ctx.moveTo(x + TILE, y); ctx.lineTo(x + TILE, y + TILE); }
        ctx.stroke();
      }
    }
  }
  paintDecor(ctx, decor, p, theme);
  return canvas;
}

function drawPlatform(ctx, p, theme, rect, style) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fillStyle = style;
  ctx.fill();
  if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = theme.outline; ctx.stroke(); }
  ctx.fillStyle = p.rockEdge;
  ctx.fillRect(rect.x + 3, rect.y, rect.w - 6, 3);
}

function glow(ctx, theme, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = theme.glow ? blur : 0;
}

const CRATE_LOOKS = {
  wood: { fill: 'hsl(32 55% 46%)', ink: 'hsl(28 50% 26%)' },
  steel: { fill: 'hsl(210 12% 64%)', ink: 'hsl(212 16% 34%)' },
  stone: { fill: 'hsl(30 6% 38%)', ink: 'hsl(30 8% 20%)' },
};

function drawCrate(ctx, theme, p, kind, x, y, size) {
  const look = CRATE_LOOKS[kind];
  roundRect(ctx, x, y, size, size, kind === 'stone' ? 6 : 3);
  ctx.fillStyle = look.fill;
  ctx.fill();
  ctx.strokeStyle = theme.outline ? p.ink : look.ink;
  ctx.lineWidth = kind === 'stone' ? 3 : 2;
  ctx.stroke();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === 'wood') {
    ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + size - 4, y + size - 4);
    ctx.moveTo(x + 3, y + size / 2); ctx.lineTo(x + size - 3, y + size / 2);
    ctx.stroke();
  } else if (kind === 'steel') {
    ctx.stroke();
    ctx.fillStyle = look.ink;
    for (const [dx, dy] of [[5, 5], [size - 5, 5], [5, size - 5], [size - 5, size - 5]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, TAU); ctx.fill(); }
    ctx.fillRect(x + 6, y + size / 2 - 1, size - 12, 2);
  } else {
    ctx.moveTo(x + size * 0.3, y + 3); ctx.lineTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.25, y + size * 0.7);
    ctx.moveTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.8, y + size * 0.6);
    ctx.stroke();
  }
}

const ITEM_COLORS = { jetpack: 'hsl(25 90% 60% / 1)', boots: 'hsl(190 80% 60% / 1)', shield: 'hsl(210 85% 72% / 1)', heart: 'hsl(350 85% 62% / 1)', comet: 'hsl(40 100% 62% / 1)' };

function drawItemIcon(ctx, kind, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = ITEM_COLORS[kind];
  ctx.strokeStyle = 'hsl(0 0% 100% / 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === 'jetpack') {
    ctx.roundRect(-8, -9, 7, 15, 3);
    ctx.roundRect(1, -9, 7, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(45 100% 60%)';
    ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-4.5, 11); ctx.lineTo(-3, 7); ctx.moveTo(3, 7); ctx.lineTo(4.5, 11); ctx.lineTo(6, 7); ctx.fill();
  } else if (kind === 'boots') {
    ctx.moveTo(-6, -9); ctx.lineTo(1, -9); ctx.lineTo(1, 1); ctx.lineTo(8, 1); ctx.lineTo(8, 6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(-5, 8 + i * 2); ctx.lineTo(7, 8 + i * 2); }
    ctx.stroke();
  } else if (kind === 'shield') {
    ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.lineTo(7, 3); ctx.lineTo(0, 10); ctx.lineTo(-7, 3); ctx.lineTo(-8, -6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'comet') {
    ctx.moveTo(-10, 9); ctx.quadraticCurveTo(-4, 0, 1, -3); ctx.lineTo(4, 3); ctx.quadraticCurveTo(-1, 6, -10, 9);
    ctx.fill();
    ctx.beginPath(); ctx.arc(3, -2, 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(0, 9); ctx.bezierCurveTo(-12, 0, -8, -11, 0, -4); ctx.bezierCurveTo(8, -11, 12, 0, 0, 9);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodies(ctx, p, theme, level, state) {
  const crates = levelIndex(level).crates;
  state.bodies.forEach((b, k) => { if (!b.gone) drawCrate(ctx, theme, p, crates[k].kind, b.x, b.y, crates[k].w); });
}

function drawPowers(ctx, level, state, time) {
  const { w, h } = playerSize(level.rules);
  const cx = state.x + w / 2, cy = state.y + h / 2;
  if (state.jetting) {
    const base = state.gravDir > 0 ? state.y + h : state.y;
    const flame = ctx.createLinearGradient(0, base, 0, base + 22 * state.gravDir);
    flame.addColorStop(0, 'hsl(45 100% 70% / 0.95)');
    flame.addColorStop(1, 'hsl(15 100% 55% / 0)');
    ctx.fillStyle = flame;
    const flicker = 16 + Math.sin(time / 30) * 5;
    ctx.beginPath(); ctx.moveTo(cx - 6, base); ctx.lineTo(cx, base + flicker * state.gravDir); ctx.lineTo(cx + 6, base); ctx.fill();
  }
  if (state.comet) drawCometAura(ctx, state, cx, cy, w, h, time);
  if (state.shield || state.invuln > 0) {
    ctx.strokeStyle = `hsl(210 90% 75% / ${state.shield ? 0.55 + Math.sin(time / 200) * 0.15 : (state.invuln % 10 < 5 ? 0.6 : 0.1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.85, 0, TAU); ctx.stroke();
  }
}

function drawCometAura(ctx, state, cx, cy, w, h, time) {
  const heat = (cometLift(state.comet) - 1) / 2;
  const hue = 45 - heat * 45, r = Math.max(w, h) * (0.9 + heat * 0.5);
  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.6);
  aura.addColorStop(0, `hsl(${hue} 100% 65% / ${state.cometMissed ? 0.15 : 0.55})`);
  aura.addColorStop(1, `hsl(${hue} 100% 55% / 0)`);
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, TAU); ctx.fill();
  const tail = -Math.sign(state.vy || -1) * state.gravDir;
  ctx.fillStyle = `hsl(${hue} 100% 62% / ${state.cometMissed ? 0.2 : 0.5})`;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.5, cy); ctx.lineTo(cx, cy + tail * (h * 1.4 + heat * 30 + Math.sin(time / 40) * 4)); ctx.lineTo(cx + w * 0.5, cy); ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `800 ${13 + Math.round(heat * 6)}px system-ui, sans-serif`;
  ctx.fillStyle = state.cometMissed ? 'hsl(0 85% 65%)' : `hsl(${hue} 100% 75%)`;
  ctx.fillText(state.cometMissed ? (state.cometEarly ? 'early!' : 'late!') : state.cometWait > 0 ? 'NOW' : `×${state.comet}`, cx, cy - h * 0.9 - 6);
}

function drawRival(ctx, p, theme, level, s) {
  const { w } = playerSize(level.rules);
  drawPlayer(ctx, p, theme, level, s, 0.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = alpha(p.text, 0.7);
  ctx.fillText('ghost', s.x + w / 2, s.y - 6);
}

function drawRope(ctx, p, level, state) {
  if (state.rope < 0) return;
  const anchor = hookAnchor(level.objects[state.rope]);
  const { w, h } = playerSize(level.rules);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(state.x + w / 2, state.y + h / 2); ctx.stroke();
}

function drawClimb(ctx, p, look, o, time) {
  const cx = o.x + o.w / 2, bottom = o.y + o.h;
  ctx.lineCap = 'round';
  if (look === 'ladder') {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const x of [o.x + 2, o.x + o.w - 2]) { ctx.moveTo(x, o.y - 6); ctx.lineTo(x, bottom); }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = o.y + 4; y < bottom; y += 12) { ctx.moveTo(o.x + 2, y); ctx.lineTo(o.x + o.w - 2, y); }
    ctx.stroke();
    return;
  }
  const sway = y => Math.sin(time / 700 + y / 40) * 2.5 * ((y - o.y) / o.h);
  ctx.strokeStyle = look === 'vine' ? p.rockEdge : p.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, o.y - 6);
  for (let y = o.y; y <= bottom; y += 6) ctx.lineTo(cx + sway(y), y);
  ctx.stroke();
  ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  for (let y = o.y + 10, k = 0; y < bottom; y += 22, k++) {
    ctx.beginPath();
    if (look === 'vine') ctx.ellipse(cx + sway(y) + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
    else ctx.arc(cx + sway(y), y, 3, 0, TAU);
    ctx.fill();
  }
}

function monsterFacing(o, clock) {
  if (!o.period) return o.dir ?? 1;
  const ahead = (((clock + o.phase) % o.period) + o.period) % o.period < o.period / 2;
  return Math.sign(o.dx || 1) * (ahead ? 1 : -1);
}

function drawEyes(ctx, p, x, y, look, r, count = 2) {
  for (let k = 0; k < count; k++) {
    const ex = x + (count > 1 ? (k - 0.5) * r * 2.4 : 0);
    ctx.fillStyle = p.text;
    ctx.beginPath(); ctx.arc(ex, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.arc(ex + look * r * 0.45, y + r * 0.15, r * 0.5, 0, TAU); ctx.fill();
  }
}

function drawMonster(ctx, p, theme, o, state, time) {
  if (slain(state, o)) {
    if (o.kind === 'flapper') return;
    ctx.fillStyle = alpha(p.hazard, 0.35);
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h - 2, o.w * 0.6, 3, 0, 0, TAU); ctx.fill();
    return;
  }
  const rect = objectRect(o, state.clock);
  const cx = rect.x + rect.w / 2, bottom = rect.y + rect.h, cy = rect.y + rect.h / 2;
  const look = monsterFacing(o, state.clock), t = time / 1000;
  glow(ctx, theme, p.hazard, 10);
  ctx.fillStyle = p.hazard;
  if (o.kind === 'patroller') {
    const step = Math.sin(t * 14) * 2;
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, rect.w / 2, rect.h / 2 - 1, 0, Math.PI, TAU); ctx.lineTo(cx + rect.w / 2, bottom - 3); ctx.lineTo(cx - rect.w / 2, bottom - 3); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const sx = cx + k * 6; ctx.moveTo(sx - 3, rect.y + 4); ctx.lineTo(sx, rect.y - 3); ctx.lineTo(sx + 3, rect.y + 4); }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.hazard;
    for (const side of [-1, 1]) ctx.fillRect(cx + side * 6 - 2, bottom - 4 + (side > 0 ? step : -step) * 0.5, 4, 4);
    drawEyes(ctx, p, cx + look * 2, cy + 1, look, 3);
  } else if (o.kind === 'flapper') {
    const flap = Math.sin(t * 18) * 8;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + side * 5, cy); ctx.quadraticCurveTo(cx + side * 14, cy - 10 - flap, cx + side * 20, cy - flap); ctx.quadraticCurveTo(cx + side * 12, cy + 2, cx + side * 5, cy + 4); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    drawEyes(ctx, p, cx, cy - 1, look, 4.5, 1);
  } else {
    const gape = 0.5 + 0.5 * Math.abs(Math.sin(t * 4));
    ctx.beginPath(); ctx.moveTo(cx - rect.w / 2, bottom); ctx.quadraticCurveTo(cx - rect.w / 2, rect.y - 4, cx, rect.y - 2); ctx.quadraticCurveTo(cx + rect.w / 2, rect.y - 4, cx + rect.w / 2, bottom); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.playerInk;
    ctx.beginPath(); ctx.ellipse(cx + look * 6, cy + 2, 4, 3 + gape * 2, 0, 0, TAU); ctx.fill();
    drawEyes(ctx, p, cx - look * 3, rect.y + 5, look, 2.5);
  }
  ctx.shadowBlur = 0;
}

function drawObject(ctx, p, theme, level, o, state, time) {
  const clock = state.clock;
  const bits = state.flags | state.pressed;
  if (crushed(level, state, o)) {
    ctx.fillStyle = o.type === 'saw' ? p.hazardGlow : p.dim;
    const rect = objectRect(o, clock);
    ctx.fillRect(rect.x, rect.y + rect.h - 4, rect.w, 4);
    return;
  }
  switch (o.type) {
    case 'mover': {
      ctx.strokeStyle = alpha(p.ink, 0.3);
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawPlatform(ctx, p, theme, objectRect(o, clock), p.rock);
      break;
    }
    case 'conveyor': {
      drawPlatform(ctx, p, theme, o, p.rock);
      ctx.fillStyle = p.accent;
      const shift = ((clock * o.speed) % 16 + 16) % 16;
      for (let x = o.x + shift - 16; x < o.x + o.w; x += 16) {
        const x0 = Math.max(o.x, x), x1 = Math.min(o.x + o.w, x + 8);
        if (x1 > x0) ctx.fillRect(x0, o.y + 12, x1 - x0, 4);
      }
      break;
    }
    case 'phase':
    case 'gate': {
      const on = phaseOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const soon = on ? o.on - t < 30 : o.period - t < 30;
      ctx.lineWidth = 2;
      if (on) {
        glow(ctx, theme, p.accent, 10);
        roundRect(ctx, o.x, o.y, o.w, o.h, 4);
        ctx.fillStyle = soon && Math.floor(time / 80) % 2 ? p.rockDeep : p.accentSoft;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = p.accent;
        ctx.stroke();
      } else {
        ctx.strokeStyle = soon ? p.accent : alpha(p.ink, 0.4);
        ctx.setLineDash([6, 6]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'crumble': {
      const gone = state.crumbled[o.slot];
      if (gone) {
        ctx.strokeStyle = alpha(p.ink, gone < 40 && Math.floor(time / 80) % 2 ? 0.7 : 0.18);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 5);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      drawPlatform(ctx, p, theme, o, p.rock);
      ctx.strokeStyle = p.rockDeep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x, o.y + 4); ctx.lineTo(x + 5, o.y + 14); ctx.lineTo(x - 2, o.y + o.h - 3); }
      ctx.stroke();
      break;
    }
    case 'door': {
      if (bits & o.bit) return;
      if (o.plate) {
        roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, 3);
        ctx.fillStyle = p.accentSoft;
        ctx.fill();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        for (let y = o.y + 10; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
        ctx.stroke();
        break;
      }
      roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, 4);
      ctx.fillStyle = p.accentSoft;
      ctx.fill();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU); ctx.fill();
      ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
      break;
    }
    case 'toggle': {
      const solid = ((bits & o.bit) !== 0) === o.on;
      ctx.lineWidth = 2;
      if (solid) {
        drawPlatform(ctx, p, theme, o, p.accentSoft);
        ctx.strokeStyle = p.accent;
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = alpha(p.ink, 0.3);
        ctx.setLineDash([3, 7]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'key':
    case 'orb': {
      if (state.flags & o.bit) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3;
      glow(ctx, theme, p.accent, 18);
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      if (o.type === 'orb') ctx.arc(cx, cy, 7, 0, TAU);
      else { ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 7, cy); ctx.closePath(); }
      ctx.fill();
      if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.shadowBlur = 0;
      break;
    }
    case 'switch': {
      const pressed = (state.flags & o.bit) !== 0;
      ctx.fillStyle = p.rockEdge;
      ctx.fillRect(o.x - 4, o.y + o.h - 6, o.w + 8, 6);
      ctx.fillStyle = pressed ? p.dim : p.accent;
      roundRect(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4);
      ctx.fill();
      break;
    }
    case 'spikes': {
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      const n = Math.max(1, Math.round(o.w / 12));
      const tipY = o.dir < 0 ? o.y : o.y + o.h;
      const baseY = o.dir < 0 ? o.y + o.h : o.y;
      for (let i = 0; i < n; i++) {
        const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
        ctx.moveTo(x0, baseY); ctx.lineTo((x0 + x1) / 2, tipY); ctx.lineTo(x1, baseY);
      }
      ctx.fill();
      if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      break;
    }
    case 'monster':
      drawMonster(ctx, p, theme, o, state, time);
      break;
    case 'shot': {
      if (slain(state, level.objects[o.source])) break;
      const rect = objectRect(o, clock);
      glow(ctx, theme, p.hazard, 14);
      ctx.fillStyle = p.hazard;
      ctx.beginPath(); ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = alpha(p.text, 0.8);
      ctx.beginPath(); ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 5, 0, TAU); ctx.fill();
      break;
    }
    case 'saw': {
      const rect = objectRect(o, clock);
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      ctx.strokeStyle = alpha(p.ink, 0.3);
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(clock / 6);
      glow(ctx, theme, p.hazard, 12);
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU, b = a + TAU / 20;
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(b) * 10, Math.sin(b) * 10);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.bgTop;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'laser': {
      const on = laserOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const warming = !on && o.period - t < 24;
      const cx = o.x + o.w / 2;
      ctx.fillStyle = p.hazard;
      ctx.beginPath(); ctx.arc(cx, o.y + 4, 5, 0, TAU); ctx.arc(cx, o.y + o.h - 4, 5, 0, TAU); ctx.fill();
      if (on) {
        const beam = laserBeam(level, o, state.bodies);
        glow(ctx, theme, p.hazard, 16);
        ctx.fillStyle = p.hazard;
        ctx.fillRect(beam.x, beam.y, beam.w, beam.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.fillRect(cx - 1, beam.y, 2, beam.h);
      } else if (warming) {
        ctx.strokeStyle = p.hazardGlow;
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.lineTo(cx, o.y + o.h); ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'spring':
      drawSpring(ctx, p.accent, o);
      break;
    case 'bumper': {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      glow(ctx, theme, p.accent, 10);
      ctx.fillStyle = p.accentSoft;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4 * o.dir, cy - 6); ctx.lineTo(cx + 3 * o.dir, cy); ctx.lineTo(cx - 4 * o.dir, cy + 6); ctx.stroke();
      break;
    }
    case 'gravpad': {
      const cx = o.x + o.w / 2;
      ctx.fillStyle = p.accent;
      roundRect(ctx, o.x, o.y, o.w, o.h, 3);
      ctx.fill();
      ctx.fillStyle = p.bgTop;
      ctx.beginPath();
      const tip = o.dir < 0 ? o.y + 1 : o.y + o.h - 1, base = o.dir < 0 ? o.y + o.h - 1 : o.y + 1;
      ctx.moveTo(cx - 5, base); ctx.lineTo(cx, tip); ctx.lineTo(cx + 5, base); ctx.closePath(); ctx.fill();
      break;
    }
    case 'wind': {
      ctx.strokeStyle = alpha(p.dim, 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (o.ay !== 0) {
        for (let i = 0; i < o.w / 18; i++) {
          const x = o.x + 9 + i * 18, phase = (time / 6 + i * 37) % o.h;
          const y = o.ay < 0 ? o.y + o.h - phase : o.y + phase;
          ctx.moveTo(x, y); ctx.lineTo(x, y + (o.ay < 0 ? 14 : -14));
        }
      } else {
        for (let i = 0; i < o.h / 18; i++) {
          const y = o.y + 9 + i * 18, phase = (time / 5 + i * 41) % o.w;
          const x = o.ax > 0 ? o.x + phase : o.x + o.w - phase;
          ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(o.ax) * 16, y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'water': {
      ctx.fillStyle = p.water;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = p.waterLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x; x <= o.x + o.w; x += 6) ctx.lineTo(x, o.y + Math.sin(x / 14 + time / 250) * 2);
      ctx.stroke();
      break;
    }
    case 'plate': {
      const down = (state.pressed & o.bit) !== 0;
      ctx.fillStyle = p.rockEdge;
      ctx.fillRect(o.x - 3, o.y + o.h - 2, o.w + 6, 2);
      if (down) glow(ctx, theme, p.accent, 12);
      ctx.fillStyle = down ? p.accent : p.accentSoft;
      roundRect(ctx, o.x, o.y + (down ? 3 : 0), o.w, o.h - (down ? 4 : 2), 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'coin': {
      if (state.coins & (1 << o.slot)) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 2;
      const spin = Math.abs(Math.cos(time / 180 + o.x / 40));
      glow(ctx, theme, COIN_COLOR, 10);
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1.5, 7 * spin), 7, 0, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'hsl(40 90% 40% / 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'item': {
      if (state.taken & (1 << o.slot)) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2 + Math.sin(time / 280 + o.x) * 3;
      const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
      halo.addColorStop(0, alpha(ITEM_COLORS[o.kind], 0.55));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - 22, cy - 22, 44, 44);
      drawItemIcon(ctx, o.kind, cx, cy);
      break;
    }
    case 'hook': {
      const { x, y } = hookAnchor(o);
      const { w, h } = playerSize(level.rules);
      const near = state.rope < 0 && Math.hypot(state.x + w / 2 - x, state.y + h / 2 - y) <= o.reach;
      if (near) {
        ctx.strokeStyle = alpha(p.accent, 0.25);
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, o.reach, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      glow(ctx, theme, p.accent, near ? 14 : 4);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'climb': {
      drawClimb(ctx, p, theme.climb, o, time);
      break;
    }
    case 'portal': {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate(time / 600);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      glow(ctx, theme, p.accent, 14);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function drawBuilding(ctx, building, title, y, colors) {
  const percent = Math.min(99, Math.floor(building.fraction * 100));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = colors.text;
  ctx.fillText(`${title} ${percent}%`, WIDTH / 2, y);
  roundRect(ctx, WIDTH / 2 - 120, y + 20, 240, 8, 4);
  ctx.fillStyle = colors.track;
  ctx.fill();
  if (percent > 0) {
    roundRect(ctx, WIDTH / 2 - 120, y + 20, 240 * building.fraction, 8, 4);
    ctx.fillStyle = colors.accent;
    ctx.fill();
  }
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = colors.dim;
  ctx.fillText(building.stage, WIDTH / 2, y + 46);
  ctx.font = 'italic 500 15px system-ui, sans-serif';
  ctx.fillStyle = colors.accent;
  ctx.fillText(`${building.phrase}…`, WIDTH / 2, y + 70);
}

function drawSpring(ctx, accent, o) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const y = o.y + 2 + (i * (o.h - 4)) / 3; ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); }
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(o.x - 2, (o.dir ?? -1) < 0 ? o.y - 3 : o.y + o.h, o.w + 4, 3);
}

function drawPlaced(ctx, p, theme, rect, time, valid = true) {
  ctx.save();
  if (!valid) ctx.globalAlpha = 0.45;
  if (rect.kind === 'ladder') {
    ctx.globalAlpha *= 0.9;
    drawClimb(ctx, { ...p, ink: valid ? p.accent : p.hazard }, 'ladder', rect, time);
  } else if (rect.kind === 'trampoline') {
    drawSpring(ctx, valid ? p.accent : p.hazard, rect);
  } else {
    drawPlatform(ctx, p, theme, rect, valid ? p.accentSoft : p.hazardGlow);
    ctx.strokeStyle = valid ? p.accent : p.hazard;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    roundRect(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAim(ctx, p, theme, level, state, aim, time) {
  if (aim.kind === 'erase') {
    ctx.strokeStyle = aim.object ? p.hazard : alpha(p.text, 0.5);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    if (aim.object) { const r = objectRect(aim.object, state.clock); roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
    return;
  }
  if (aim.kind === 'flag') {
    const { w, h } = playerSize(level.rules);
    ctx.save();
    ctx.globalAlpha = aim.ok ? 0.8 : 0.35;
    drawFlag(ctx, p, { x: state.x + w / 2 - 12, y: state.y + h - 40, w: 24, h: 40 }, true, time);
    ctx.restore();
    return;
  }
  const rect = aim.rect ?? placedAt(aim.kind, aim.x, aim.y);
  if (aim.kind === 'ladder' && !aim.rect) rect.h = 6 * TILE;
  drawPlaced(ctx, p, theme, rect, time, !!aim.rect);
}

function drawComboLine(ctx, p, floor) {
  ctx.save();
  ctx.strokeStyle = alpha(p.accent, 0.55);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(WIDTH, floor); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  ctx.strokeText('COMBO LINE', WIDTH - 12, floor - 3);
  ctx.fillStyle = p.accent;
  ctx.fillText('COMBO LINE', WIDTH - 12, floor - 3);
  ctx.restore();
}

function drawCombo(ctx, p, state, combo, w, h) {
  const links = combo.pop?.links ?? combo.links;
  if (combo.links < COMBO_FROM && !(combo.pop && combo.pop.age < 40 && links >= COMBO_FROM)) return;
  const pop = combo.pop && combo.pop.age < 12 ? 1 - combo.pop.age / 12 : 0;
  const cx = state.x + w / 2, top = state.gravDir > 0 ? state.y - 10 : state.y + h + 22;
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(1 + pop * 0.7, 1 + pop * 0.7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `800 ${16 + Math.min(14, links)}px system-ui, sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  ctx.fillStyle = p.accent;
  ctx.strokeText(`×${links}`, 0, 0);
  ctx.fillText(`×${links}`, 0, 0);
  ctx.restore();
  if (combo.pop?.word && combo.pop.wordAge < 60) {
    const t = combo.pop.wordAge / 60;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.translate(cx, top - 28 - t * 26);
    ctx.scale(1 + (1 - Math.min(1, t * 6)) * 0.6, 1 + (1 - Math.min(1, t * 6)) * 0.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'hsl(240 30% 8% / 0.75)';
    ctx.fillStyle = 'hsl(48 100% 70%)';
    ctx.strokeText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.fillText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.restore();
  }
}

export function inventoryHit(x, y, count) {
  if (y < SLOT.y || y > SLOT.y + SLOT.size) return null;
  for (let i = 0; i < count; i++) {
    const left = SLOT.right - (count - i) * (SLOT.size + SLOT.gap) + SLOT.gap;
    if (x >= left && x <= left + SLOT.size) return i;
  }
  return null;
}

export function shopHit(x, y) {
  const left = WIDTH / 2 - (3 * CARD.w + 2 * CARD.gap) / 2;
  if (y >= KEEP.y && y <= KEEP.y + KEEP.h && Math.abs(x - WIDTH / 2) <= KEEP.w / 2) return 0;
  if (y < CARD.y || y > CARD.y + CARD.h) return null;
  for (let i = 0; i < 3; i++) { const cx = left + i * (CARD.w + CARD.gap); if (x >= cx && x <= cx + CARD.w) return i + 1; }
  return null;
}

function drawTrickIcon(ctx, p, kind, cx, cy, scale = 1.6) {
  if (ITEM_COLORS[kind]) { drawItemIcon(ctx, kind, cx, cy, scale); return; }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale / 1.6, scale / 1.6);
  ctx.lineCap = 'round';
  if (kind === 'plank') {
    roundRect(ctx, -24, -6, 48, 12, 4);
    ctx.fillStyle = p.accentSoft; ctx.fill();
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = p.accent; ctx.fillRect(-21, -6, 42, 3);
  } else if (kind === 'trampoline') {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-18, -6 + i * 5); ctx.lineTo(18, -6 + i * 5); } ctx.stroke();
    ctx.fillStyle = p.accent; ctx.fillRect(-22, -12, 44, 4);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-6, -24); ctx.lineTo(6, -24); ctx.closePath(); ctx.fill();
  } else if (kind === 'ladder') {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(-9, 24); ctx.moveTo(9, -24); ctx.lineTo(9, 24); for (let y = -18; y <= 18; y += 9) { ctx.moveTo(-9, y); ctx.lineTo(9, y); } ctx.stroke();
  } else if (kind === 'flag') {
    ctx.strokeStyle = SHOP_TEXT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-8, 24); ctx.stroke();
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(16, -14); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
  } else if (kind === 'extraHeart') {
    ctx.fillStyle = p.hazard; ctx.font = '800 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♥', 0, 2);
    ctx.fillStyle = SHOP_TEXT; ctx.font = '800 18px system-ui, sans-serif'; ctx.fillText('+1', 18, -12);
  } else if (kind === 'double') {
    ctx.fillStyle = COIN_COLOR; ctx.beginPath(); ctx.arc(-8, 2, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = SHOP_TEXT; ctx.font = '900 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('×2', 12, -6);
  } else {
    ctx.strokeStyle = p.hazard; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
    ctx.strokeStyle = alpha(p.text, 0.6); ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  return [...lines, line];
}

function drawFlag(ctx, p, o, touched, time) {
  const x = o.x + 5, top = o.y + 4, bottom = o.y + o.h;
  const wave = Math.sin(time / 180 + o.x) * 2;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.fillStyle = touched ? p.accent : alpha(p.dim, 0.5);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
}

function verticalSpan(o) {
  const dy = o.period ? o.dy ?? 0 : 0;
  return [o.y + Math.min(0, dy), o.y + o.h + Math.max(0, dy)];
}

function drawFlood(ctx, p, level, state, time) {
  const y = floodLevel(level, state.clock);
  if (y >= level.height) return;
  ctx.fillStyle = p.hazardGlow;
  ctx.fillRect(0, y, WIDTH, level.height - y);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + time / 180) * 3);
  ctx.stroke();
}

function drawExit(ctx, p, level, time) {
  const e = level.exit;
  const pulse = 0.55 + Math.sin(time / 260) * 0.2;
  const beam = ctx.createLinearGradient(0, e.y, 0, e.y + 4 * TILE);
  beam.addColorStop(0, alpha(p.accent, pulse));
  beam.addColorStop(1, alpha(p.accent, 0));
  ctx.fillStyle = beam;
  ctx.fillRect(e.x + 4, e.y, e.w - 8, 4 * TILE);
}

const BLUSH = 'hsl(350 90% 70% / 0.4)';

function drawAccessory(ctx, p, kind, top, sway) {
  ctx.save();
  ctx.translate(0, top);
  ctx.rotate(sway);
  ctx.strokeStyle = p.playerInk;
  ctx.fillStyle = p.accent;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'leaf') {
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(1, -5, 0, -8); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4, -9, 5, 2.5, -0.5, 0, TAU); ctx.fill();
  } else if (kind === 'antenna') {
    ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -12, 3, 0, TAU); ctx.fill();
  } else if (kind === 'tuft') {
    ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-5, -6, -1, -8);
    ctx.moveTo(1, 0); ctx.quadraticCurveTo(3, -7, 6, -6);
    ctx.stroke();
  } else {
    ctx.moveTo(0, -1); ctx.lineTo(-7, -6); ctx.lineTo(-7, 3); ctx.closePath();
    ctx.moveTo(0, -1); ctx.lineTo(7, -6); ctx.lineTo(7, 3); ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, -1, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

const HAT_GOLD = 'hsl(48 95% 60%)';

function drawHat(ctx, p, kind, top, sway, dw, facing) {
  ctx.save();
  ctx.translate(0, top);
  ctx.rotate(sway * 0.5);
  ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  const w = dw * 0.5;
  ctx.beginPath();
  if (kind === 'cap') {
    ctx.fillStyle = p.accent;
    ctx.ellipse(0, 0, w, w * 0.62, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(facing > 0 ? 0 : -w * 1.5, -2, w * 1.5, 4, 2); ctx.fill(); ctx.stroke();
  } else if (kind === 'beanie') {
    ctx.fillStyle = p.accent;
    ctx.ellipse(0, -1, w, w * 0.9, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.playerInk; ctx.fillRect(-w, -3, w * 2, 4);
    ctx.fillStyle = p.player; ctx.beginPath(); ctx.arc(0, -w * 0.95, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (kind === 'tophat') {
    ctx.fillStyle = p.playerInk;
    ctx.fillRect(-w * 1.2, -2, w * 2.4, 3);
    ctx.fillRect(-w * 0.8, -w * 1.5, w * 1.6, w * 1.5);
    ctx.fillStyle = p.accent; ctx.fillRect(-w * 0.8, -5, w * 1.6, 3);
  } else if (kind === 'crown') {
    ctx.fillStyle = HAT_GOLD;
    ctx.moveTo(-w * 0.8, 0); ctx.lineTo(-w * 0.8, -w * 0.8); ctx.lineTo(-w * 0.35, -w * 0.35); ctx.lineTo(0, -w); ctx.lineTo(w * 0.35, -w * 0.35); ctx.lineTo(w * 0.8, -w * 0.8); ctx.lineTo(w * 0.8, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = p.accent;
    ctx.moveTo(-w * 0.7, 0); ctx.lineTo(0, -w * 1.8); ctx.lineTo(w * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.player; ctx.beginPath(); ctx.arc(0, -w * 1.8, 3, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawGlasses(ctx, p, kind, eyes, facing) {
  const { eyeX, eyeY, r } = eyes, lens = r * 1.9;
  ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = kind === 'shades' ? 'hsl(240 30% 10% / 0.85)' : 'hsl(200 80% 90% / 0.25)';
  const sides = kind === 'monocle' ? [facing] : [-1, 1];
  for (const side of sides) {
    ctx.beginPath();
    if (kind === 'square') ctx.roundRect(eyeX + side * r * 1.45 - lens, eyeY - lens * 0.8, lens * 2, lens * 1.6, 2);
    else ctx.arc(eyeX + side * r * 1.45, eyeY, lens, 0, TAU);
    ctx.fill(); ctx.stroke();
  }
  ctx.beginPath();
  if (kind === 'monocle') { ctx.moveTo(eyeX + facing * r * 1.45 + facing * lens * 0.7, eyeY + lens * 0.7); ctx.lineTo(eyeX + facing * r * 1.45 + facing * lens * 1.2, eyeY + lens * 2.2); }
  else { ctx.moveTo(eyeX - r * 1.45 + lens, eyeY); ctx.lineTo(eyeX + r * 1.45 - lens, eyeY); }
  ctx.stroke();
}

function drawPattern(ctx, p, avatar, dw, dh) {
  ctx.save();
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh - 3, Math.min(8, dw / 3));
  ctx.clip();
  ctx.fillStyle = alpha(p.playerInk, 0.16);
  ctx.beginPath();
  if (avatar.pattern === 'spots') for (const spot of avatar.spots) { ctx.moveTo(spot.x * dw + spot.r * dw, spot.y * dh); ctx.arc(spot.x * dw, spot.y * dh, spot.r * dw, 0, TAU); }
  else if (avatar.pattern === 'stripes') for (const y of [0.05, 0.25]) ctx.rect(-dw / 2, y * dh, dw, dh * 0.08);
  else { ctx.fillStyle = 'hsl(0 0% 100% / 0.55)'; ctx.ellipse(0, dh * 0.22, dw * 0.3, dh * 0.2, 0, 0, TAU); }
  ctx.fill();
  ctx.restore();
}

function drawFeet(ctx, p, s, avatar, dw, bottom) {
  ctx.fillStyle = p.playerInk;
  for (const side of [-1, 1]) {
    const lift = s.grounded || s.climbing ? Math.max(0, Math.sin(avatar.stride + (side > 0 ? Math.PI : 0))) * 3 : 2;
    const x = side * (s.grounded || s.climbing ? dw * 0.24 : dw * 0.16) + (s.grounded ? 0 : s.facing * 2);
    ctx.beginPath(); ctx.ellipse(x, bottom - 2.4 - lift, dw * 0.15, 2.6, 0, 0, TAU); ctx.fill();
  }
}

function drawFace(ctx, p, s, avatar, mood, dw, dh, base) {
  const eyeX = s.facing * dw * 0.14 + avatar.lookX * dw * 0.06, eyeY = -dh * 0.15 + avatar.lookY * s.gravDir * dh * 0.04;
  const r = dw * 0.09 * (mood === 'scared' ? 1.35 : 1);
  ctx.fillStyle = BLUSH;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(eyeX + side * dw * 0.27, eyeY + dh * 0.13, dw * 0.08, dh * 0.035, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x = eyeX + side * dw * 0.13;
    ctx.beginPath();
    if (mood === 'joy') { ctx.arc(x, eyeY + r * 0.6, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); continue; }
    if (avatar.blink > 0 || mood === 'asleep') { ctx.moveTo(x - r, eyeY); ctx.lineTo(x + r, eyeY); ctx.stroke(); continue; }
    ctx.arc(x, eyeY, r, 0, TAU); ctx.fill();
    if (mood === 'drowsy') { ctx.fillStyle = base; ctx.fillRect(x - r - 1, eyeY - r - 1, r * 2 + 2, r * 1.1); ctx.fillStyle = p.playerInk; }
    else if (mood === 'focus') { ctx.beginPath(); ctx.moveTo(x + side * r * 1.3, eyeY - r * 2.2); ctx.lineTo(x - side * r * 0.9, eyeY - r * 1.3); ctx.stroke(); }
    else { ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + r * 0.35, eyeY - r * 0.35, r * 0.35, 0, TAU); ctx.fill(); ctx.fillStyle = p.playerInk; }
  }
  const mx = eyeX, my = eyeY + dh * 0.17;
  ctx.beginPath();
  if (mood === 'joy') { ctx.arc(mx, my - 1, dw * 0.09, 0, Math.PI); ctx.closePath(); ctx.fill(); }
  else if (mood === 'scared' || mood === 'asleep') { ctx.ellipse(mx, my, dw * 0.045, dw * (mood === 'scared' ? 0.07 : 0.035), 0, 0, TAU); ctx.fill(); }
  else if (mood === 'focus') { ctx.moveTo(mx - dw * 0.06, my); ctx.lineTo(mx + dw * 0.06, my); ctx.stroke(); }
  else { ctx.arc(mx, my - dw * 0.06, dw * 0.07, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke(); }
  return { eyeX, eyeY, r };
}

function drawSnore(ctx, p, x, y, still) {
  const t = (still % 90) / 90;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = p.text;
  ctx.font = `700 ${10 + t * 6}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('z', x + 8 + t * 10, y - 14 - t * 18);
  ctx.restore();
}

function drawPlayer(ctx, p, theme, level, s, alpha = 1, avatar = RESTING) {
  const r = level.rules;
  const { w, h } = playerSize(r);
  const stretch = Math.min(1.35, Math.max(0.65, 1 + Math.abs(s.vy) * 0.015 + avatar.squash));
  const dw = w / stretch, dh = h * stretch;
  const g = s.gravDir;
  const mood = moodOf(avatar, s);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(s.x + w / 2, s.y + h / 2);
  const flip = (s.frame - s.flipFrame) / FLIP_FRAMES;
  if (flip >= 0 && flip < 1 && !s.grounded) ctx.rotate((1 - (1 - flip) ** 2) * TAU * s.facing);
  if (g < 0) ctx.scale(1, -1);
  ctx.translate(0, (h - dh) / 2);
  ctx.rotate(avatar.lean * g);
  if (r.glide && s.jumpHeld && !s.grounded && s.vy * g > 0) {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -dh / 2); ctx.lineTo(0, -dh / 2 - 14); ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.arc(0, -dh / 2 - 14, 18, Math.PI, TAU); ctx.closePath(); ctx.fill();
    if (theme.outline) ctx.stroke();
  }
  if (r.size < 1) {
    ctx.strokeStyle = p.playerInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -dh / 2); ctx.lineTo(-6, -dh / 2 - 7); ctx.moveTo(3, -dh / 2); ctx.lineTo(6, -dh / 2 - 7); ctx.stroke();
  } else if (avatar.accessory) {
    drawAccessory(ctx, p, avatar.accessory, -dh / 2 + 1, avatar.sway * g);
  }
  drawFeet(ctx, p, s, avatar, dw, dh / 2);
  const shattering = r.fallDamage && s.vy * g >= FALL_DAMAGE_SPEED - 0.6;
  const base = shattering ? p.hazard : avatar.tint ?? p.player;
  ctx.fillStyle = base;
  glow(ctx, theme, base, shattering ? 18 : 10 + 16 * s.charge);
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh - 3, Math.min(8, dw / 3));
  ctx.fill();
  ctx.shadowBlur = 0;
  if (avatar.pattern && !shattering) drawPattern(ctx, p, avatar, dw, dh);
  if (shattering) {
    ctx.strokeStyle = p.playerInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-dw * 0.3, -dh / 2); ctx.lineTo(-dw * 0.05, -dh * 0.1); ctx.lineTo(-dw * 0.25, dh * 0.2); ctx.lineTo(0, dh / 2);
    ctx.moveTo(dw * 0.35, -dh * 0.3); ctx.lineTo(dw * 0.1, 0); ctx.lineTo(dw * 0.3, dh * 0.3);
    ctx.stroke();
  }
  if (theme.outline) { ctx.strokeStyle = p.playerInk; ctx.lineWidth = 2; ctx.stroke(); }
  const eyes = drawFace(ctx, p, s, avatar, mood, dw, dh, base);
  if (avatar.glasses) drawGlasses(ctx, p, avatar.glasses, eyes, s.facing);
  if (avatar.hat && r.size >= 1) drawHat(ctx, p, avatar.hat, -dh / 2 + 1, avatar.sway * g, dw, s.facing);
  if (r.size > 1) { ctx.fillStyle = p.playerInk; const eyeX = s.facing * dw * 0.14; ctx.fillRect(eyeX - dw * 0.26, -dh * 0.32, dw * 0.22, 3); ctx.fillRect(eyeX + dw * 0.04, -dh * 0.32, dw * 0.22, 3); }
  ctx.restore();
  if (mood === 'asleep') drawSnore(ctx, p, s.x + w / 2, g > 0 ? s.y : s.y + h + 20, avatar.still);
  if (r.jumpBudget) {
    ctx.fillStyle = p.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${r.jumpBudget - s.jumpsUsed}`, s.x + w / 2, (g > 0 ? s.y : s.y + h + 14) - 6);
  }
}

const ALTITUDE_STOPS = [
  { at: 0, top: [35, 70, 75, 0.18], bottom: [30, 60, 70, 0.28], stars: 0 },
  { at: 300, top: [205, 70, 62, 0.22], bottom: [195, 60, 70, 0.18], stars: 0 },
  { at: 900, top: [275, 45, 40, 0.3], bottom: [20, 70, 55, 0.25], stars: 0.2 },
  { at: 1800, top: [235, 55, 8, 0.55], bottom: [250, 45, 18, 0.35], stars: 1 },
];

function mixStop(a, b, t) {
  const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
  const hsla = ([h, s, l, a]) => `hsl(${h} ${s}% ${l}% / ${a})`;
  return { top: hsla(mix(a.top, b.top)), bottom: hsla(mix(a.bottom, b.bottom)), stars: a.stars + (b.stars - a.stars) * t };
}

function altitudeTint(metres) {
  const i = ALTITUDE_STOPS.findIndex(stop => stop.at > metres);
  if (i === -1) return mixStop(ALTITUDE_STOPS.at(-1), ALTITUDE_STOPS.at(-1), 0);
  if (i === 0) return mixStop(ALTITUDE_STOPS[0], ALTITUDE_STOPS[0], 0);
  const a = ALTITUDE_STOPS[i - 1], b = ALTITUDE_STOPS[i];
  return mixStop(a, b, (metres - a.at) / (b.at - a.at));
}

function spawnAmbient(kind, rand) {
  switch (kind) {
    case 'snow': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.6 + rand() * 0.8, size: 2 + rand() * 2, alpha: 0.7, sway: rand() * TAU };
    case 'embers': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.6 - rand() * 0.9, size: 2 + rand() * 2, alpha: 0.8, sway: rand() * TAU };
    case 'motes': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0.1 + rand() * 0.2, vy: -0.05, size: 1.5 + rand() * 1.5, alpha: 0.35, sway: rand() * TAU };
    case 'sparks': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0, vy: 0, size: 1 + rand() * 2, alpha: 0.9, sway: rand() * TAU, twinkle: true };
    case 'stars': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: -0.15, vy: 0, size: 1 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'spores': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.2 - rand() * 0.3, size: 1.5 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'dust': return { x: -10, y: rand() * HEIGHT, vx: 0.8 + rand() * 0.9, vy: 0.05, size: 1 + rand() * 1.5, alpha: 0.45, sway: rand() * TAU };
    case 'bubbles': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.4 - rand() * 0.7, size: 1.5 + rand() * 2.5, alpha: 0.5, sway: rand() * TAU };
    case 'rain': return { x: rand() * (WIDTH + 200), y: -10, vx: -1.5, vy: 9 + rand() * 4, size: 1, alpha: 0.35, sway: 0, wobble: 0, shape: 'streak', trail: 2 };
    case 'sprinkles': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.8 + rand() * 0.6, size: 2, alpha: 0.8, sway: rand() * TAU, shape: 'streak', trail: 5 };
    case 'code': return { x: Math.floor(rand() * WIDTH / 16) * 16 + 4, y: -10, vx: 0, vy: 1.5 + rand() * 2.5, size: 14, alpha: 0.6, sway: 0, wobble: 0, shape: 'glyph', glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)] };
    case 'fog': return { x: -10, y: rand() * HEIGHT, vx: 0.25 + rand() * 0.3, vy: 0, size: 30 + rand() * 40, alpha: 0.07, sway: rand() * TAU };
    case 'petals': return { x: rand() * WIDTH, y: -10, vx: 0.3 + rand() * 0.4, vy: 0.4 + rand() * 0.5, size: 2.5 + rand(), alpha: 0.85, sway: rand() * TAU };
    case 'leaves': return { x: rand() * WIDTH, y: -10, vx: 0.4 + rand() * 0.5, vy: 0.5 + rand() * 0.6, size: 3 + rand() * 2, alpha: 0.8, sway: rand() * TAU, wobble: 0.8, shape: 'streak', trail: 3 };
    default: return null;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const layers = new WeakMap();
  let ambient = { level: null, particles: [] };
  const rand = Math.random;

  function layerFor(level) {
    let layer = layers.get(level);
    if (!layer) {
      const theme = themeFor(level);
      const palette = theme.palette(level.palette);
      const decor = growDecor(level);
      layer = { theme, palette, decor, tiles: renderTiles(level, theme, palette, decor), backdrop: renderBackdrop(level, theme, palette), life: growLife(level, theme) };
      layers.set(level, layer);
    }
    return layer;
  }

  function ambientFor(level, theme) {
    if (ambient.level !== level) {
      const particles = [];
      for (let i = 0; i < 45; i++) {
        const particle = spawnAmbient(theme.ambient, rand);
        if (!particle) break;
        particle.y = rand() * HEIGHT;
        particles.push(particle);
      }
      ambient = { level, particles };
    }
    return ambient.particles;
  }

  let scale = 1;

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
    scale = Math.min(viewport.width / WIDTH, viewport.height / (HEIGHT + BAR_H));
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((HEIGHT + BAR_H) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(HEIGHT + BAR_H) * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  function drawAmbient(level, theme, p, time) {
    const particles = ambientFor(level, theme);
    particles.forEach((a, i) => {
      a.x += a.vx + Math.sin(time / 900 + a.sway) * (a.wobble ?? 0.3);
      a.y += a.vy;
      if (a.y < -12 || a.y > HEIGHT + 12 || a.x > WIDTH + 12 || a.x < -12) particles[i] = { ...spawnAmbient(theme.ambient, rand) };
      ctx.globalAlpha = a.alpha * (a.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + a.sway)) : 1);
      ctx.fillStyle = ctx.strokeStyle = p[theme.mote];
      drawParticle(a);
    });
    ctx.globalAlpha = 1;
  }

  function drawParticle(a) {
    if (a.shape === 'streak') {
      ctx.lineWidth = a.size;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * a.trail, a.y - a.vy * a.trail); ctx.stroke();
    } else if (a.shape === 'glyph') {
      ctx.font = `${a.size}px monospace`;
      ctx.fillText(a.glyph, a.x, a.y);
    } else {
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, TAU); ctx.fill();
    }
  }

  function drawSky(p, altitude, camera) {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, p.bgTop);
    sky.addColorStop(1, p.bgBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const tint = altitudeTint(altitude);
    const air = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    air.addColorStop(0, tint.top);
    air.addColorStop(1, tint.bottom);
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (tint.stars > 0) {
      const stars = seededNoise(97);
      ctx.fillStyle = 'white';
      for (let i = 0; i < 90; i++) {
        const x = stars() * WIDTH, y = (((stars() * HEIGHT * 2 - camera * 0.05) % HEIGHT) + HEIGHT) % HEIGHT;
        ctx.globalAlpha = tint.stars * (0.3 + stars() * 0.7);
        ctx.fillRect(x, y, stars() < 0.15 ? 2 : 1, stars() < 0.15 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBackdrop(layer, top, bottom, floor) {
    if (bottom <= 0 || top >= HEIGHT) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(0, top), WIDTH, Math.min(HEIGHT, bottom) - Math.max(0, top));
    ctx.clip();
    const drift = (floor - HEIGHT) * PARALLAX;
    if (HORIZONS.has(layer.theme.background)) {
      ctx.drawImage(layer.backdrop, 0, drift);
    } else {
      const shift = ((drift % HEIGHT) + HEIGHT) % HEIGHT;
      ctx.drawImage(layer.backdrop, 0, shift - HEIGHT);
      ctx.drawImage(layer.backdrop, 0, shift);
    }
    ctx.restore();
  }

  function drawBiome(level, state, offset, view, current) {
    const layer = layerFor(level);
    const { palette: p, theme } = layer;
    const { time, ghost, trail } = view;
    ctx.save();
    drawLife(ctx, layer.life, p, offset, view.camera, time);
    ctx.translate(0, offset - view.camera);
    ctx.drawImage(layer.tiles, 0, 0);
    const top = view.camera - offset - CULL_MARGIN, bottom = top + HEIGHT + 2 * CULL_MARGIN;
    const { w: pw, h: ph } = playerSize(level.rules);
    drawDecor(ctx, layer.decor, p, { time, playerX: state.x + pw / 2, playerY: state.y + ph / 2, top, bottom });
    const shown = level.objects.filter(o => { const [y0, y1] = verticalSpan(o); return y1 >= top && y0 <= bottom && !state.erased.includes(o.id); });
    const backdrop = o => o.type === 'water' || o.type === 'wind';
    for (const o of shown) if (backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (!backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (o.type === 'checkpoint') drawFlag(ctx, p, o, current && view.touched.includes(o.id), time);
    if (current) for (const flag of view.planted ?? []) drawFlag(ctx, p, flag, true, time);
    for (const rect of state.placed) drawPlaced(ctx, p, theme, rect, time);
    drawExit(ctx, p, level, time);
    if (current) {
      if (ghost) drawPlayer(ctx, p, theme, level, ghost, 0.35);
      const { w, h } = playerSize(level.rules);
      trail.forEach((t, i) => {
        ctx.globalAlpha = (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
        ctx.fillStyle = p.player;
        roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      drawRope(ctx, p, level, state);
      if (view.combo?.floor !== null && view.combo?.floor !== undefined) drawComboLine(ctx, p, view.combo.floor);
      if (!state.dead) {
        drawPlayer(ctx, p, theme, level, state, 1, view.avatar);
        drawPowers(ctx, level, state, time);
        if (view.combo) drawCombo(ctx, p, state, view.combo, w, h);
      }
      if (view.aim) drawAim(ctx, p, theme, level, state, view.aim, time);
      const rival = view.rival;
      if (rival?.state && rival.index === view.biomeIndex && !rival.state.dead) drawRival(ctx, p, theme, level, rival.state);
    }
    drawBodies(ctx, p, theme, level, state);
    drawFlood(ctx, p, level, state, time);
    if (current) drawParticles(view.particles);
    ctx.restore();
  }

  function drawParticles(particles) {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.maxLife) * (q.puff ? 0.55 : 1);
      ctx.fillStyle = q.color;
      if (q.puff) { ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); }
      else ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state, level, camera) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2 - camera;
    const dark = ctx.createRadialGradient(cx, cy, 40, cx, cy, 170);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    dark.addColorStop(1, 'rgba(0,0,0,0.985)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawInventory(state, p) {
    let x = WIDTH - 180;
    const y = 44;
    if (state.fuel > 0) {
      drawItemIcon(ctx, 'jetpack', x, y, 0.8);
      ctx.fillStyle = 'hsl(240 20% 10% / 0.6)';
      ctx.fillRect(x + 12, y - 4, 50, 8);
      ctx.fillStyle = ITEM_COLORS.jetpack;
      ctx.fillRect(x + 12, y - 4, 50 * (state.fuel / JETPACK_FUEL), 8);
      x += 76;
    }
    if (state.boots > 0) {
      drawItemIcon(ctx, 'boots', x, y, 0.8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = p.text;
      ctx.fillText(`×${state.boots}`, x + 11, y + 1);
      x += 44;
    }
    if (state.shield) { drawItemIcon(ctx, 'shield', x, y, 0.8); x += 30; }
    if (state.comet) {
      drawItemIcon(ctx, 'comet', x, y, 0.8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = p.text;
      ctx.fillText(`×${state.comet}`, x + 12, y + 1);
    }
  }

  function drawMeter(view, p) {
    const { level, state, altitude, best, touched } = view;
    const x = 18, top = 70, bottom = HEIGHT - 70;
    const span = bottom - top;
    const at = y => bottom - (1 - y / level.height) * span;
    ctx.fillStyle = 'hsl(240 20% 8% / 0.55)';
    roundRect(ctx, x - 4, top - 8, 8, span + 16, 4);
    ctx.fill();
    for (const o of level.objects) {
      if (o.type !== 'checkpoint') continue;
      ctx.fillStyle = touched.includes(o.id) ? p.accent : 'hsl(240 10% 60% / 0.6)';
      ctx.fillRect(x - 7, at(o.y + o.h) - 1, 14, 2);
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(x - 8, top - 10); ctx.lineTo(x + 8, top - 10); ctx.lineTo(x, top - 18); ctx.closePath(); ctx.fill();
    if (view.combo?.floor !== null && view.combo?.floor !== undefined) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x - 10, at(view.combo.floor)); ctx.lineTo(x + 10, at(view.combo.floor)); ctx.stroke();
      ctx.setLineDash([]);
    }
    const py = at(Math.max(0, Math.min(level.height, state.y)));
    ctx.fillStyle = p.player;
    ctx.beginPath(); ctx.arc(x, py, 6, 0, TAU); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = p.text;
    ctx.fillText(`${altitude.toLocaleString()} m`, x + 16, py);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = p.dim;
    ctx.fillText(`best ${best.toLocaleString()} m`, x + 16, py + 20);
    const rival = view.rival;
    if (!rival) return;
    const ry = rival.index > view.biomeIndex ? top - 4 : rival.index < view.biomeIndex ? bottom + 4 : at(Math.max(0, Math.min(level.height, rival.state?.y ?? level.height)));
    ctx.strokeStyle = p.text;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, ry, 6, 0, TAU); ctx.stroke();
    const lead = rival.altitude - altitude;
    ctx.fillStyle = alpha(p.text, 0.75);
    ctx.fillText(`ghost ${rival.altitude.toLocaleString()} m${rival.done ? '' : lead > 0 ? ` · +${lead.toLocaleString()}` : ''}`, x + 16, py + 36);
  }

  function drawHud(view, p) {
    const { level, state, lives, seed, bannerAge, biomeIndex, building } = view;
    const maxLives = view.maxLives ?? MAX_LIVES;
    ctx.textBaseline = 'top';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = p.dim;
    ctx.textAlign = 'left';
    ctx.fillText(`seed ${seed}  ·  biome ${biomeIndex + 1}`, 14, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${(state.frame / 60).toFixed(1)}s`, WIDTH - 14, 12);
    ctx.font = '700 18px system-ui, sans-serif';
    for (let i = 0; i < maxLives; i++) {
      ctx.fillStyle = i < lives ? p.hazard : alpha(p.dim, 0.35);
      ctx.fillText('♥', WIDTH - 70 - (maxLives - 1 - i) * 20, 9);
    }
    if (view.points !== undefined) {
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath(); ctx.arc(WIDTH - 70 - maxLives * 20 - 58, 20, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = p.text;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${view.points}`, WIDTH - 70 - maxLives * 20 - 48, 12);
      ctx.textAlign = 'right';
      if (view.doubled) { ctx.fillStyle = COIN_COLOR; ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('×2', WIDTH - 70 - maxLives * 20 - 48 + ctx.measureText(`${view.points}`).width + 6, 13); ctx.textAlign = 'right'; }
      if (view.inventory?.kinds.length) drawTrickInventory(view.inventory, p);
    }
    drawInventory(state, p);
    if (view.toast && view.toast.age < view.toast.ms) {
      const { kind, text, age, ms } = view.toast;
      ctx.globalAlpha = Math.min(1, (ms - age) / 500, age / 150);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 17px system-ui, sans-serif';
      const width = ctx.measureText(text).width + (kind ? 60 : 36);
      ctx.fillStyle = 'hsl(240 25% 8% / 0.8)';
      roundRect(ctx, WIDTH / 2 - width / 2, HEIGHT - 70, width, 36, 10);
      ctx.fill();
      if (kind) drawItemIcon(ctx, kind, WIDTH / 2 - width / 2 + 22, HEIGHT - 52, 0.9);
      ctx.fillStyle = 'hsl(0 0% 97%)';
      ctx.fillText(text, WIDTH / 2 + (kind ? 12 : 0), HEIGHT - 51);
      ctx.globalAlpha = 1;
    }
    const banner = Math.max(0, 1 - Math.max(0, bannerAge - 2600) / 700);
    if (banner > 0) {
      const slide = Math.min(1, bannerAge / 350);
      ctx.globalAlpha = banner * slide;
      ctx.textAlign = 'center';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = p.dim;
      ctx.fillText(`${(biomeIndex * level.rows * 2).toLocaleString()} m`, WIDTH / 2, 112 + (1 - slide) * 20);
      ctx.fillStyle = p.text;
      ctx.font = '800 42px system-ui, sans-serif';
      ctx.fillText(level.title, WIDTH / 2, 134 + (1 - slide) * 20);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = p.accent;
      level.hints.forEach((hint, i) => ctx.fillText(hint, WIDTH / 2, 192 + i * 26));
      ctx.globalAlpha = 1;
    } else if (level.hints.length) {
      ctx.textAlign = 'left';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = p.accent;
      ctx.fillText(level.title.toUpperCase(), 14, 34);
    }
    if (building) drawBuilding(ctx, building, 'generating the next biome', HEIGHT / 2 - 80, { text: p.text, dim: p.dim, accent: p.accent, track: alpha(p.dim, 0.25) });
  }

  function drawControls(level, keys, p, muted, state) {
    ctx.fillStyle = 'hsl(240 20% 6%)';
    ctx.fillRect(0, HEIGHT, WIDTH, BAR_H);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const capFont = '700 12px system-ui, sans-serif', labelFont = '600 13px system-ui, sans-serif';
    const cy = HEIGHT + BAR_H / 2;
    const items = controlsFor(level, muted, state).map(item => {
      ctx.font = capFont;
      const caps = item.caps.map(cap => ({ cap, w: Math.max(22, ctx.measureText(cap).width + 12) }));
      ctx.font = labelFont;
      const labelW = ctx.measureText(item.label).width;
      return { ...item, caps, labelW, w: caps.reduce((sum, c) => sum + c.w + 4, 0) + 4 + labelW };
    });
    const gap = 22;
    let x = (WIDTH - items.reduce((sum, item) => sum + item.w, 0) - gap * (items.length - 1)) / 2;
    for (const item of items) {
      const lit = item.input?.some(input => keys[input]);
      const color = item.special ? p.accent : 'hsl(240 10% 78%)';
      for (const { cap, w } of item.caps) {
        roundRect(ctx, x, cy - 11, w, 22, 5);
        ctx.fillStyle = lit ? color : 'hsl(240 15% 14%)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = item.special ? 1.5 : 1;
        ctx.stroke();
        ctx.font = capFont;
        ctx.fillStyle = lit ? 'hsl(240 20% 8%)' : color;
        ctx.textAlign = 'center';
        ctx.fillText(cap, x + w / 2, cy + 1);
        x += w + 4;
      }
      ctx.textAlign = 'left';
      ctx.font = labelFont;
      ctx.fillStyle = item.special ? p.accent : 'hsl(240 8% 62%)';
      ctx.fillText(item.label, x + 4, cy + 1);
      x += 4 + item.labelW + gap;
    }
  }
  function draw(view) {
    const { level, state, particles, flash, frozen, camera, below, above, altitude } = view;
    const { palette: p, theme } = layerFor(level);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    drawSky(p, altitude, camera);
    const floor = level.height - camera;
    drawBackdrop(layerFor(level), -camera, floor + (below ? 0 : HEIGHT), floor);
    if (above) drawBackdrop(layerFor(above.level), -camera - above.level.height, -camera, -camera);
    if (below) drawBackdrop(layerFor(below.level), floor, floor + below.level.height, floor + below.level.height);
    drawAmbient(level, theme, p, view.time);
    if (above) drawBiome(above.level, above.state, -above.level.height, view, false);
    if (below) drawBiome(below.level, below.state, level.height, view, false);
    drawBiome(level, state, 0, view, true);
    if (level.rules.darkness) drawDarkness(state, level, camera);
    if (frozen) {
      ctx.fillStyle = 'rgba(120,130,160,0.22)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
    drawMeter(view, p);
    drawHud(view, p);
    if (view.shop) drawShop(view, p);
    if (view.over) drawGameOver(view, p);
    drawControls(level, view.keys, p, view.muted, state);
  }

  function drawTrickInventory({ kinds, counts, active }, p) {
    kinds.forEach((kind, i) => {
      const left = SLOT.right - (kinds.length - i) * (SLOT.size + SLOT.gap) + SLOT.gap, selected = kind === active;
      roundRect(ctx, left, SLOT.y, SLOT.size, SLOT.size, 8);
      ctx.fillStyle = selected ? p.accentSoft : 'hsl(240 25% 10% / 0.75)';
      ctx.fill();
      ctx.strokeStyle = selected ? p.accent : alpha(p.dim, 0.5);
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
      drawTrickIcon(ctx, p, kind, left + SLOT.size / 2, SLOT.y + SLOT.size / 2, 0.85);
      if (counts[i] > 1) {
        ctx.fillStyle = p.accent;
        ctx.beginPath(); ctx.arc(left + SLOT.size - 4, SLOT.y + 4, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = 'hsl(240 30% 8%)';
        ctx.font = '800 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${counts[i]}`, left + SLOT.size - 4, SLOT.y + 4.5);
      }
    });
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = active ? p.accent : p.dim;
    ctx.fillText(active ? `${TRICKS[active].title.toUpperCase()} · CLICK TO BUILD · TAB NEXT · B DONE` : 'B · BUILD', SLOT.right, SLOT.y + SLOT.size + 5);
  }

  function drawShop(view, p) {
    const { offer, bought, affordable } = view.shop;
    ctx.fillStyle = 'hsl(240 30% 4% / 0.72)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SHOP_TEXT;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText('Gate shop', WIDTH / 2, 64);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = SHOP_DIM;
    ctx.fillText(`${view.points} points · 1, 2, 3 or click to buy`, WIDTH / 2, 100);
    const left = WIDTH / 2 - (3 * CARD.w + 2 * CARD.gap) / 2;
    offer.forEach((kind, i) => {
      const x = left + i * (CARD.w + CARD.gap), y = CARD.y, sold = bought.includes(kind), open = affordable[i] && !sold;
      ctx.save();
      if (!open) ctx.globalAlpha = 0.5;
      roundRect(ctx, x, y, CARD.w, CARD.h, 14);
      ctx.fillStyle = 'hsl(240 25% 10% / 0.92)';
      ctx.fill();
      ctx.strokeStyle = open ? p.accent : alpha(p.dim, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
      roundRect(ctx, x + 12, y + 12, 26, 26, 8);
      ctx.fillStyle = open ? p.accent : p.dim;
      ctx.fill();
      ctx.fillStyle = 'hsl(240 30% 8%)';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(`${i + 1}`, x + 25, y + 26);
      drawTrickIcon(ctx, p, kind, x + CARD.w / 2, y + 60);
      ctx.fillStyle = SHOP_TEXT;
      ctx.font = '800 19px system-ui, sans-serif';
      ctx.fillText(TRICKS[kind].title, x + CARD.w / 2, y + 108);
      ctx.fillStyle = SHOP_DIM;
      ctx.font = '500 13px system-ui, sans-serif';
      wrapText(ctx, TRICKS[kind].text, CARD.w - 30).forEach((line, k) => ctx.fillText(line, x + CARD.w / 2, y + 132 + k * 16));
      ctx.restore();
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      if (sold) { ctx.fillStyle = p.accent; ctx.fillText('BOUGHT', x + CARD.w - 14, y + 25); }
      else {
        ctx.fillStyle = COIN_COLOR;
        ctx.beginPath(); ctx.arc(x + CARD.w - 14 - ctx.measureText(`${TRICK_COST}`).width - 10, y + 25, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = affordable[i] ? SHOP_TEXT : p.hazard;
        ctx.fillText(`${TRICK_COST}`, x + CARD.w - 14, y + 25);
      }
      ctx.textAlign = 'center';
    });
    roundRect(ctx, WIDTH / 2 - KEEP.w / 2, KEEP.y, KEEP.w, KEEP.h, 12);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.fillStyle = 'hsl(240 30% 8%)';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('EXIT', WIDTH / 2, KEEP.y + KEEP.h / 2);
  }

  function drawGameOver(view, p) {
    ctx.fillStyle = 'hsl(240 30% 4% / 0.78)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.hazard;
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.fillText('Out of lives', WIDTH / 2, HEIGHT / 2 - 70);
    ctx.fillStyle = 'hsl(0 0% 97%)';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(`You reached ${view.altitude.toLocaleString()} m`, WIDTH / 2, HEIGHT / 2 - 12);
    ctx.fillStyle = 'hsl(240 10% 75%)';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(`best on this seed: ${view.best.toLocaleString()} m${view.points ? `  ·  ${view.points} points` : ''}`, WIDTH / 2, HEIGHT / 2 + 26);
    ctx.fillStyle = p.accent;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText('Enter or R to climb again  ·  Esc for the menu', WIDTH / 2, HEIGHT / 2 + 72);
  }

  function drawLoading(building) {
    ctx.fillStyle = 'hsl(240 25% 5%)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT + BAR_H);
    drawBuilding(ctx, building, 'building the climb', HEIGHT / 2 - 30, { text: 'hsl(240 10% 92%)', dim: 'hsl(240 10% 60%)', accent: 'hsl(345 95% 62%)', track: 'hsl(240 15% 16%)' });
  }

  return { fit, draw, drawLoading, paletteFor: level => layerFor(level).palette, pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }) };
}
