import { TILE, WIDTH, HEIGHT } from './level.js?v=9c9592d';
import { alpha } from './themes.js?v=9c9592d';
import { TAU, veil } from './paint.js?v=9c9592d';

export function seededNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function fillBelow(ctx, style, trace) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  trace();
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
}

export const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

const silhouette = (ctx, x, y, scale, draw) => { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); draw(ctx); ctx.restore(); };
const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };

const SAVANNA_ANIMALS = {
  acacia(ctx) {
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-2, -34, -14, -64); ctx.lineTo(-8, -66); ctx.quadraticCurveTo(0, -42, 2, -40); ctx.quadraticCurveTo(8, -52, 20, -62); ctx.lineTo(22, -58);
    ctx.quadraticCurveTo(8, -40, 5, -30); ctx.quadraticCurveTo(5, -14, 4, 0);
    ctx.fill();
    ellipse(ctx, 0, -68, 58, 8); ellipse(ctx, 22, -76, 34, 6); ellipse(ctx, -26, -75, 30, 6);
  },
  giraffe(ctx) {
    ellipse(ctx, 0, -62, 24, 10, -0.08);
    ctx.fillRect(-20, -58, 4, 58); ctx.fillRect(-12, -56, 4, 56); ctx.fillRect(11, -56, 4, 56); ctx.fillRect(19, -58, 4, 58);
    ctx.beginPath(); ctx.moveTo(14, -66); ctx.lineTo(25, -70); ctx.lineTo(44, -118); ctx.lineTo(37, -121); ctx.closePath(); ctx.fill();
    ellipse(ctx, 46, -122, 10, 5, -0.35);
    ctx.fillRect(40, -134, 2, 10); ctx.fillRect(46, -135, 2, 10);
    ctx.beginPath(); ctx.moveTo(-22, -66); ctx.quadraticCurveTo(-32, -58, -29, -38); ctx.lineTo(-27, -39); ctx.quadraticCurveTo(-29, -56, -21, -62); ctx.fill();
  },
  elephant(ctx) {
    ellipse(ctx, 0, -40, 40, 26);
    for (const x of [-34, -16, 8, 24]) ctx.fillRect(x, -30, 13, 30);
    ellipse(ctx, 44, -54, 17, 19);
    ellipse(ctx, 34, -48, 12, 22, 0.2);
    ctx.beginPath(); ctx.moveTo(55, -60); ctx.quadraticCurveTo(70, -46, 62, -8); ctx.quadraticCurveTo(66, 0, 72, -4); ctx.lineTo(72, -10); ctx.quadraticCurveTo(76, -50, 62, -64); ctx.closePath(); ctx.fill();
  },
};

const FLAT_BACKGROUNDS = {
  grid(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.ink, 0.08);
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 20, WIDTH / 2, HEIGHT / 2, 700);
    glow.addColorStop(0, alpha(p.accent, 0.18));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    veil(ctx, glow);
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
  stars(ctx, p, rand) {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `hsl(0 0% 100% / ${0.2 + rand() * 0.7})`;
      ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), rand() < 0.1 ? 2 : 1, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 10, WIDTH / 2, HEIGHT / 2, 600);
    g.addColorStop(0, alpha(p.accent, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    veil(ctx, g);
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
  stainedglass(ctx, p, rand) {
    veil(ctx, 'hsl(235 12% 22% / 0.95)');
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
  library(ctx, p, rand) {
    veil(ctx, 'hsl(22 40% 5%)');
    for (let x = 0; x < WIDTH; x += 160) shelfBay(ctx, x, 160, 0.8, 0.5, rand);
    moonWindow(ctx, WIDTH * 0.27, rand);
    moonWindow(ctx, WIDTH * 0.66, rand);
    rollingLadder(ctx, WIDTH * 0.5 - 10);
    shelfBay(ctx, 0, 130, 1.1, 0.3, rand);
    shelfBay(ctx, WIDTH - 130, 130, 1.1, 0.3, rand);
    chandelier(ctx, p, WIDTH * 0.5, 96);
    for (const [fx, fy, tilt] of [[0.18, 0.3, -0.2], [0.42, 0.55, 0.15], [0.8, 0.38, 0.25], [0.6, 0.8, -0.1]]) floatingBook(ctx, p, WIDTH * fx, HEIGHT * fy, tilt);
    for (const side of [0, 1]) {
      const edge = ctx.createLinearGradient(side ? WIDTH : 0, 0, side ? WIDTH - 90 : 90, 0);
      edge.addColorStop(0, 'hsl(22 50% 3% / 0.92)'); edge.addColorStop(1, 'hsl(22 50% 3% / 0)');
      veil(ctx, edge);
    }
  },
  mine(ctx, p, rand) {
    const cx = WIDTH / 2, cy = HEIGHT * 0.5;
    veil(ctx, 'hsl(222 14% 11%)');
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `hsl(220 12% ${6 + rand() * 12}% / 0.5)`;
      ctx.beginPath(); ctx.ellipse(WIDTH * rand(), HEIGHT * rand(), 20 + rand() * 50, 10 + rand() * 30, rand() * Math.PI, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 8; i++) oreVein(ctx, WIDTH * (i % 2 ? 0.8 + rand() * 0.2 : rand() * 0.2), HEIGHT * rand(), `hsl(${[45, 175, 300, 205][i % 4]} 85% 62%)`, rand);
    pool(ctx, cx, cy, 420, 'hsl(225 30% 2% / 0.95)');
    minecartRails(ctx, cx, cy);
    for (let depth = 0; depth < 6; depth++) timberFrame(ctx, cx, cy, 0.12 * 1.5 ** depth, depth % 2 === 1 ? p : null);
  },
};

const HORIZON_BACKGROUNDS = {
  mountains(ctx, p, rand) {
    for (let layer = 0; layer < 3; layer++) {
      fillBelow(ctx, `hsl(210 35% ${30 + layer * 12}% / 0.8)`, () => {
        for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(x, HEIGHT * (0.45 + layer * 0.15) - rand() * 90 - layer * 20);
      });
    }
  },
  dunes(ctx, p, rand) {
    const sun = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.25, 10, WIDTH * 0.75, HEIGHT * 0.25, 160);
    sun.addColorStop(0, 'hsl(45 100% 92% / 0.9)');
    sun.addColorStop(0.3, 'hsl(40 100% 80% / 0.4)');
    sun.addColorStop(1, 'hsl(40 100% 80% / 0)');
    veil(ctx, sun);
    for (let layer = 0; layer < 3; layer++) {
      fillBelow(ctx, `hsl(${28 - layer * 4} ${45 + layer * 5}% ${68 - layer * 9}% / 0.7)`, () => {
        let y = HEIGHT * (0.55 + layer * 0.13);
        ctx.lineTo(0, y);
        for (let x = 0; x < WIDTH; x += 240) {
          const next = HEIGHT * (0.5 + layer * 0.13) + rand() * 50;
          ctx.quadraticCurveTo(x + 120, y - 50 - rand() * 40, x + 240, next);
          y = next;
        }
      });
    }
  },
  hills(ctx, p, rand) {
    ctx.fillStyle = 'hsl(45 80% 92% / 0.75)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.2 + rand() * 0.6), HEIGHT * 0.22, 46, 0, TAU); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      fillBelow(ctx, `hsl(${290 + layer * 15} 25% ${30 - layer * 6}% / 0.75)`, () => {
        for (let x = -100; x <= WIDTH + 100; x += 200) {
          const r = 120 + rand() * 80;
          ctx.arc(x + 100, HEIGHT * (0.7 + layer * 0.1) + r * 0.6, r, Math.PI * 1.1, Math.PI * 1.9);
        }
      });
    }
  },
  skyline(ctx, p, rand) {
    const moon = ctx.createRadialGradient(WIDTH * (0.15 + rand() * 0.7), HEIGHT * 0.2, 8, WIDTH / 2, HEIGHT * 0.2, 260);
    moon.addColorStop(0, 'hsl(40 80% 90% / 0.5)');
    moon.addColorStop(1, 'hsl(40 80% 90% / 0)');
    veil(ctx, moon);
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
      fillBelow(ctx, `hsl(${90 + layer * 10} 45% ${58 - layer * 9}% / 0.85)`, () => {
        let y = HEIGHT * (0.55 + layer * 0.12);
        ctx.lineTo(0, y);
        for (let x = 0; x < WIDTH; x += 240) {
          const next = HEIGHT * (0.55 + layer * 0.12) + rand() * 40 - 20;
          ctx.quadraticCurveTo(x + 120, y - 40 - rand() * 30, x + 240, next);
          crest.push({ layer, x: x + 120, y: (y + next) / 2 - 30 });
          y = next;
        }
      });
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
      fillBelow(ctx, layer ? 'hsl(330 70% 82% / 0.85)' : 'hsl(30 60% 78% / 0.75)', () => {
        for (let x = -60; x <= WIDTH + 60; x += 120) ctx.arc(x + 60, HEIGHT * (0.8 + layer * 0.08), 60 + rand() * 20, Math.PI, 0);
      });
    }
  },
  lavafalls(ctx, p, rand) {
    const glow = ctx.createLinearGradient(0, HEIGHT * 0.5, 0, HEIGHT);
    glow.addColorStop(0, 'hsl(15 100% 50% / 0)');
    glow.addColorStop(1, 'hsl(20 100% 50% / 0.45)');
    veil(ctx, glow);
    for (let layer = 0; layer < 2; layer++) {
      fillBelow(ctx, `hsl(350 30% ${5 + layer * 5}% / 0.9)`, () => {
        for (let x = 0; x <= WIDTH; x += 30) ctx.lineTo(x, HEIGHT * (0.35 + layer * 0.2) + (x / 30) % 2 * 30 - rand() * 70);
      });
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
    fillBelow(ctx, alpha(p.rockDeep, 0.85), () => {
      for (let x = 0; x <= WIDTH; x += 60) ctx.lineTo(x, HEIGHT * 0.78 - rand() * 30);
    });
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
    veil(ctx, halo);
    ctx.fillStyle = 'hsl(55 50% 90% / 0.95)';
    ctx.beginPath(); ctx.arc(mx, my, 42, 0, TAU); ctx.fill();
    fillBelow(ctx, alpha(p.rockDeep, 0.9), () => {
      for (let x = 0; x <= WIDTH; x += 80) ctx.lineTo(x, HEIGHT * 0.68 + Math.sin(x * 0.01 + rand()) * 12);
    });
    ctx.fillStyle = alpha(p.rockDeep, 0.95);
    const hx = WIDTH * (0.2 + rand() * 0.6), hy = HEIGHT * 0.74;
    ctx.fillRect(hx - 70, hy - 70, 140, 70);
    ctx.beginPath(); ctx.moveTo(hx - 80, hy - 70); ctx.lineTo(hx, hy - 130); ctx.lineTo(hx + 80, hy - 70); ctx.closePath(); ctx.fill();
    ctx.fillRect(hx + 30, hy - 150, 22, 60);
    ctx.fillStyle = 'hsl(45 100% 60% / 0.7)';
    for (let i = 0; i < 4; i++) if (rand() < 0.6) ctx.fillRect(hx - 55 + i * 32, hy - 50, 12, 16);
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
    fillBelow(ctx, 'hsl(35 30% 28% / 0.9)', () => { ctx.lineTo(0, HEIGHT * 0.72); ctx.lineTo(WIDTH * 0.5, HEIGHT * 0.52); ctx.lineTo(WIDTH, HEIGHT * 0.72); });
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
  goldenhour(ctx, p, rand) {
    const horizon = HEIGHT * 0.78, sunX = WIDTH * (0.5 + rand() * 0.3), sunY = HEIGHT * 0.64;
    const glow = ctx.createLinearGradient(0, 0, 0, horizon);
    glow.addColorStop(0, 'hsl(330 50% 30% / 0)'); glow.addColorStop(0.55, 'hsl(18 85% 48% / 0.55)'); glow.addColorStop(1, 'hsl(42 100% 62% / 0.9)');
    veil(ctx, glow);
    const halo = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 380);
    halo.addColorStop(0, 'hsl(48 100% 85% / 0.85)'); halo.addColorStop(0.25, 'hsl(40 100% 65% / 0.45)'); halo.addColorStop(1, 'hsl(30 100% 55% / 0)');
    veil(ctx, halo);
    ctx.fillStyle = 'hsl(52 100% 90%)';
    ctx.beginPath(); ctx.arc(sunX, sunY, 62, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(350 45% 32% / 0.5)';
    for (let i = 0; i < 6; i++) ellipse(ctx, WIDTH * rand(), HEIGHT * (0.2 + rand() * 0.38), 90 + rand() * 120, 3 + rand() * 4);
    fillBelow(ctx, 'hsl(8 38% 34% / 0.8)', () => { for (let x = 0; x <= WIDTH; x += 60) ctx.lineTo(x, horizon - 18 - Math.sin(x / 130) * 10 - rand() * 14); });
    const scene = ['acacia', 'giraffe', 'elephant', 'giraffe', 'acacia', 'acacia'];
    scene.forEach((kind, i) => {
      ctx.fillStyle = `hsl(8 ${36 - i * 2}% ${14 + (i % 2) * 8}% / 0.95)`;
      silhouette(ctx, WIDTH * ((i + 0.3 + rand() * 0.4) / scene.length), horizon + 4, 0.45 + rand() * 0.3, SAVANNA_ANIMALS[kind]);
    });
    const ground = ctx.createLinearGradient(0, horizon, 0, HEIGHT);
    ground.addColorStop(0, 'hsl(14 40% 14% / 0.98)'); ground.addColorStop(1, 'hsl(14 35% 7% / 0.98)');
    fillBelow(ctx, ground, () => { for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(x, horizon + rand() * 6); });
    ctx.strokeStyle = 'hsl(12 40% 9% / 0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < WIDTH; x += 8 + rand() * 10) { const h = 8 + rand() * 18; ctx.moveTo(x, horizon + 6); ctx.quadraticCurveTo(x + 2, horizon - h / 2, x + (rand() - 0.5) * 8, horizon - h); }
    ctx.stroke();
  },
  swamp(ctx, p, rand) {
    const waterline = HEIGHT * 0.72;
    const moonX = WIDTH * (0.15 + rand() * 0.7), moonY = HEIGHT * 0.2;
    const moon = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 240);
    moon.addColorStop(0, 'hsl(150 60% 88% / 0.55)'); moon.addColorStop(0.2, 'hsl(160 50% 70% / 0.2)'); moon.addColorStop(1, 'hsl(170 50% 60% / 0)');
    veil(ctx, moon);
    ctx.fillStyle = 'hsl(150 55% 90% / 0.8)';
    ctx.beginPath(); ctx.arc(moonX, moonY, 22, 0, TAU); ctx.fill();
    const trees = Array.from({ length: 9 }, (_, i) => {
      const depth = i % 3, h = HEIGHT * (0.45 + rand() * 0.4);
      return {
        x: WIDTH * ((i + rand() * 0.8) / 9), h, width: 9 + rand() * 7 + depth * 3, color: `hsl(172 ${32 - depth * 4}% ${19 - depth * 6}%)`, depth,
        limbs: Array.from({ length: 4 }, (_, k) => ({ y: h * (0.5 + k * 0.12 + rand() * 0.06), reach: (k % 2 ? 1 : -1) * (26 + rand() * 44), strands: Array.from({ length: 5 }, () => ({ at: rand(), drop: 24 + rand() * 70, sway: (rand() - 0.5) * 10 })) })),
      };
    }).sort((a, b) => a.depth - b.depth);
    const drawTree = ({ x, h, width, color, limbs }) => {
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - width * 2, waterline + 6); ctx.quadraticCurveTo(x - width * 0.4, waterline - 30, x - width * 0.5, waterline - h * 0.5); ctx.lineTo(x - width * 0.35, waterline - h);
      ctx.lineTo(x + width * 0.35, waterline - h); ctx.lineTo(x + width * 0.5, waterline - h * 0.5); ctx.quadraticCurveTo(x + width * 0.4, waterline - 30, x + width * 2, waterline + 6);
      ctx.closePath(); ctx.fill();
      for (const { y, reach, strands } of limbs) {
        const bx = x + reach, by = waterline - y - 14;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, waterline - y); ctx.quadraticCurveTo(x + reach * 0.5, by - 6, bx, by); ctx.stroke();
        ellipse(ctx, bx, by - 3, 20, 7);
        ctx.lineWidth = 1.2; ctx.globalAlpha *= 0.7;
        ctx.beginPath();
        for (const { at, drop, sway } of strands) { const sx = x + reach * (0.4 + at * 0.6); ctx.moveTo(sx, by - 3); ctx.quadraticCurveTo(sx + sway, by + drop * 0.5, sx + sway * 0.4, by + drop); }
        ctx.stroke(); ctx.globalAlpha /= 0.7;
      }
    };
    trees.forEach(drawTree);
    const water = ctx.createLinearGradient(0, waterline, 0, HEIGHT);
    water.addColorStop(0, 'hsl(172 40% 13%)'); water.addColorStop(1, 'hsl(180 45% 4%)');
    ctx.fillStyle = water; ctx.fillRect(0, waterline, WIDTH, HEIGHT - waterline);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, waterline, WIDTH, HEIGHT - waterline); ctx.clip();
    ctx.translate(0, 2 * waterline); ctx.scale(1, -1); ctx.globalAlpha = 0.4;
    trees.forEach(drawTree);
    ctx.restore();
    ctx.strokeStyle = 'hsl(150 50% 75% / 0.2)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) { const x = WIDTH * rand(), y = waterline + 6 + rand() * (HEIGHT - waterline); ctx.moveTo(x, y); ctx.lineTo(x + 14 + rand() * 40, y); }
    ctx.stroke();
    for (const [y, strength] of [[waterline - 30, 0.28], [waterline + 24, 0.2], [HEIGHT * 0.5, 0.1]]) {
      const fog = ctx.createLinearGradient(0, y - 50, 0, y + 50);
      fog.addColorStop(0, 'hsl(165 30% 60% / 0)'); fog.addColorStop(0.5, `hsl(165 30% 60% / ${strength})`); fog.addColorStop(1, 'hsl(165 30% 60% / 0)');
      ctx.fillStyle = fog; ctx.fillRect(0, y - 50, WIDTH, 100);
    }
    for (let i = 0; i < 26; i++) {
      const x = WIDTH * rand(), y = HEIGHT * (0.35 + rand() * 0.6), glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
      glow.addColorStop(0, alpha(p.accent, 0.9)); glow.addColorStop(0.3, alpha(p.accent, 0.25)); glow.addColorStop(1, alpha(p.accent, 0));
      ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18);
    }
  },
  fairground(ctx, p, rand) {
    const glow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.8, 10, WIDTH * 0.5, HEIGHT * 0.8, WIDTH * 0.7);
    glow.addColorStop(0, 'hsl(25 95% 62% / 0.6)');
    glow.addColorStop(0.5, 'hsl(340 70% 50% / 0.25)');
    glow.addColorStop(1, 'hsl(340 70% 50% / 0)');
    veil(ctx, glow);
    fillBelow(ctx, 'hsl(265 40% 16% / 0.8)', () => { for (let x = 0; x <= WIDTH; x += 60) ctx.lineTo(x, HEIGHT * 0.74 - rand() * 30); });
    const tent = (x, base, w, h, hue) => {
      const stripes = 8, step = w / stripes;
      ctx.fillStyle = `hsl(${hue} 55% 38% / 0.92)`;
      ctx.fillRect(x - w / 2, base - h * 0.45, w, h * 0.45);
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 ? 'hsl(40 55% 82% / 0.92)' : `hsl(${hue} 60% 42% / 0.92)`;
        ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x - w / 2 + i * step, base - h * 0.45); ctx.lineTo(x - w / 2 + (i + 1) * step, base - h * 0.45); ctx.closePath(); ctx.fill();
        if (i % 2) ctx.fillRect(x - w / 2 + i * step, base - h * 0.45, step, h * 0.45);
      }
      ctx.fillStyle = 'hsl(265 40% 10% / 0.9)';
      ctx.fillRect(x - 1, base - h - 22, 2, 24);
      ctx.beginPath(); ctx.moveTo(x + 1, base - h - 22); ctx.lineTo(x + 16, base - h - 17); ctx.lineTo(x + 1, base - h - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'hsl(42 100% 68% / 0.85)';
      ctx.beginPath(); ctx.moveTo(x - w * 0.09, base); ctx.lineTo(x - w * 0.09, base - h * 0.2); ctx.quadraticCurveTo(x, base - h * 0.3, x + w * 0.09, base - h * 0.2); ctx.lineTo(x + w * 0.09, base); ctx.closePath(); ctx.fill();
    };
    const wx = WIDTH * (0.5 + rand() * 0.25), wy = HEIGHT * 0.5, radius = HEIGHT * 0.3, cabins = 14, rightSide = wx > WIDTH * 0.6;
    tent(rightSide ? WIDTH * 0.2 : WIDTH * 0.82, HEIGHT * 0.9, 190, 130, 345);
    tent(rightSide ? WIDTH * 0.42 : WIDTH * 0.12, HEIGHT * 0.9, 130, 90, 200);
    ctx.strokeStyle = 'hsl(265 45% 9% / 0.92)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(wx - radius * 0.5, HEIGHT * 0.92); ctx.lineTo(wx, wy); ctx.lineTo(wx + radius * 0.5, HEIGHT * 0.92); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(wx, wy, radius, 0, TAU); ctx.moveTo(wx + radius * 0.82, wy); ctx.arc(wx, wy, radius * 0.82, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < cabins; i++) { const a = (i / cabins) * TAU; ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * radius, wy + Math.sin(a) * radius); }
    ctx.stroke();
    for (let i = 0; i < cabins; i++) {
      const a = (i / cabins) * TAU, cx = wx + Math.cos(a) * radius, cy = wy + Math.sin(a) * radius;
      ctx.fillStyle = `hsl(${40 + (i % 3) * 20} 100% 62% / 0.2)`; ctx.beginPath(); ctx.arc(cx, cy + 12, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = `hsl(${(i % 3) * 30 + 340} 85% ${i % 2 ? 62 : 70}% / 0.95)`;
      ctx.beginPath(); ctx.roundRect(cx - 8, cy + 3, 16, 14, [6, 6, 2, 2]); ctx.fill();
      ctx.fillStyle = 'hsl(48 100% 85% / 0.9)'; ctx.fillRect(cx - 5, cy + 8, 10, 5);
    }
    ctx.fillStyle = 'hsl(48 100% 75% / 0.9)';
    for (let i = 0; i < cabins * 3; i++) { const a = (i / (cabins * 3)) * TAU; ctx.beginPath(); ctx.arc(wx + Math.cos(a) * radius * 0.82, wy + Math.sin(a) * radius * 0.82, 1.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'hsl(48 100% 85%)'; ctx.beginPath(); ctx.arc(wx, wy, 7, 0, TAU); ctx.fill();
    for (const [y0, sag] of [[HEIGHT * 0.08, 50], [HEIGHT * 0.2, 36]]) {
      const bulbs = 22, string = t => [WIDTH * t, y0 + Math.sin(t * Math.PI) * sag];
      ctx.strokeStyle = 'hsl(265 40% 10% / 0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 0; i <= 40; i++) ctx.lineTo(...string(i / 40)); ctx.stroke();
      for (let i = 0; i <= bulbs; i++) {
        const [x, y] = string(i / bulbs), hue = [50, 340, 190, 130][i % 4];
        ctx.fillStyle = `hsl(${hue} 100% 65% / 0.22)`; ctx.beginPath(); ctx.arc(x, y + 5, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(${hue} 100% 72%)`; ctx.beginPath(); ctx.arc(x, y + 5, 3.2, 0, TAU); ctx.fill();
      }
    }
  },
  lanternfest(ctx, p, rand) {
    const mx = WIDTH * (0.3 + rand() * 0.4), my = HEIGHT * 0.3, mr = HEIGHT * 0.1;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
    halo.addColorStop(0, 'hsl(45 90% 80% / 0.5)');
    halo.addColorStop(1, 'hsl(45 90% 80% / 0)');
    veil(ctx, halo);
    ctx.fillStyle = 'hsl(48 70% 93%)';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'hsl(45 40% 80% / 0.5)';
    for (let i = 0; i < 6; i++) { const a = rand() * TAU, d = rand() * mr * 0.6; ctx.beginPath(); ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, mr * (0.1 + rand() * 0.14), 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'hsl(0 0% 100% / 0.7)';
    for (let i = 0; i < 50; i++) ctx.fillRect(WIDTH * rand(), HEIGHT * rand() * 0.5, 1.2, 1.2);
    const gate = (x, base, h, color) => {
      const w = h * 0.75;
      ctx.fillStyle = color;
      for (const side of [-1, 1]) ctx.fillRect(x + side * w * 0.38 - h * 0.035, base - h, h * 0.07, h);
      ctx.fillRect(x - w * 0.5, base - h * 0.78, w, h * 0.06);
      ctx.beginPath(); ctx.moveTo(x - w * 0.68, base - h * 1.04); ctx.quadraticCurveTo(x, base - h * 0.9, x + w * 0.68, base - h * 1.04); ctx.lineTo(x + w * 0.58, base - h * 0.96); ctx.quadraticCurveTo(x, base - h * 0.84, x - w * 0.58, base - h * 0.96); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - w * 0.5, base - h * 0.96, w, h * 0.08);
    };
    const pagoda = (x, base, w, tiers, color) => {
      const th = w * 0.4;
      ctx.fillStyle = color;
      for (let t = 0; t < tiers; t++) {
        const rw = w * (1 - t * 0.17), y = base - (t + 1) * th;
        ctx.fillRect(x - rw * 0.34, y + 6, rw * 0.68, th - 6);
        ctx.beginPath(); ctx.moveTo(x - rw / 2 - 9, y - 4); ctx.quadraticCurveTo(x - rw * 0.3, y + 5, x, y); ctx.quadraticCurveTo(x + rw * 0.3, y + 5, x + rw / 2 + 9, y - 4); ctx.lineTo(x + rw * 0.45, y + 8); ctx.lineTo(x - rw * 0.45, y + 8); ctx.closePath(); ctx.fill();
        if (t % 2 === 0) { ctx.fillStyle = 'hsl(38 100% 62% / 0.75)'; ctx.fillRect(x - 3, y + 12, 6, 9); ctx.fillStyle = color; }
      }
      ctx.fillRect(x - 1.5, base - tiers * th - 26, 3, 24);
    };
    const ridge = (layer, base, amp, color) => {
      fillBelow(ctx, color, () => { for (let x = 0; x <= WIDTH; x += 50) ctx.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + layer * 2 + rand())) * amp); });
    };
    ridge(0, HEIGHT * 0.66, 70, 'hsl(240 30% 22% / 0.9)');
    pagoda(WIDTH * (0.08 + rand() * 0.15), HEIGHT * 0.7, 46, 5, 'hsl(240 30% 15% / 0.9)');
    gate(mx, HEIGHT * 0.66, HEIGHT * 0.3, 'hsl(5 55% 26% / 0.85)');
    const mist = ctx.createLinearGradient(0, HEIGHT * 0.58, 0, HEIGHT * 0.8);
    mist.addColorStop(0, 'hsl(240 40% 60% / 0)');
    mist.addColorStop(1, 'hsl(240 40% 60% / 0.22)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, HEIGHT * 0.58, WIDTH, HEIGHT * 0.22);
    ridge(1, HEIGHT * 0.84, 60, 'hsl(240 30% 14% / 0.95)');
    pagoda(WIDTH * (0.72 + rand() * 0.2), HEIGHT * 0.86, 64, 4, 'hsl(240 30% 9% / 0.97)');
    pagoda(WIDTH * (0.3 + rand() * 0.2), HEIGHT * 0.9, 50, 3, 'hsl(240 30% 9% / 0.97)');
    for (let i = 0; i < 150; i++) {
      const x = WIDTH * rand(), y = HEIGHT * Math.pow(rand(), 0.8) * 0.96, near = rand(), s = 1.5 + near * 2.5, hue = 22 + rand() * 24;
      ctx.fillStyle = `hsl(${hue} 100% 60% / ${0.05 + near * 0.07})`; ctx.beginPath(); ctx.arc(x, y, s * 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = `hsl(${hue} 100% ${62 + near * 18}% / ${0.55 + near * 0.4})`; ctx.fillRect(x - s / 2, y - s * 0.6, s, s * 1.2);
    }
  },
};

function pool(ctx, x, y, r, color) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, r);
  light.addColorStop(0, color);
  light.addColorStop(1, color.replace(/\/ [\d.]+\)$/, '/ 0)'));
  ctx.fillStyle = light;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const BOOK_HUES = [8, 22, 38, 205, 150, 280, 350];

function shelfBay(ctx, x, w, scale, dim, rand) {
  const rowHeight = 54 * scale;
  ctx.fillStyle = 'hsl(22 40% 6%)';
  ctx.fillRect(x, 0, w, HEIGHT);
  for (let shelf = rowHeight; shelf < HEIGHT + rowHeight; shelf += rowHeight) {
    for (let bx = x + 5 * scale; bx < x + w - 8 * scale; ) {
      const bw = (6 + rand() * 9) * scale, bh = rowHeight * (0.55 + rand() * 0.38), top = shelf - bh - 5 * scale;
      ctx.fillStyle = `hsl(${BOOK_HUES[Math.floor(rand() * BOOK_HUES.length)]} ${30 + rand() * 25}% ${20 + rand() * 14}%)`;
      ctx.fillRect(bx, top, bw, bh);
      ctx.fillStyle = 'hsl(42 70% 60% / 0.45)';
      ctx.fillRect(bx, top + bh * 0.2, bw, scale);
      ctx.fillRect(bx, top + bh * 0.75, bw, scale);
      bx += bw + (rand() < 0.08 ? 10 * scale : 0.5);
    }
    ctx.fillStyle = 'hsl(22 45% 15%)';
    ctx.fillRect(x, shelf - 5 * scale, w, 7 * scale);
  }
  ctx.fillStyle = `hsl(22 50% 4% / ${dim})`;
  ctx.fillRect(x, 0, w, HEIGHT);
  ctx.fillStyle = 'hsl(22 45% 12%)';
  ctx.fillRect(x, 0, 6 * scale, HEIGHT);
  ctx.fillRect(x + w - 6 * scale, 0, 6 * scale, HEIGHT);
}

function archPath(ctx, x, top, w, bottom) {
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, top + w / 2);
  ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
}

function moonWindow(ctx, x, rand) {
  const w = 112, top = HEIGHT * 0.1, bottom = HEIGHT * 0.66;
  ctx.fillStyle = 'hsl(22 35% 20%)';
  archPath(ctx, x - 8, top - 8, w + 16, bottom + 4);
  ctx.fill();
  const sky = ctx.createLinearGradient(0, top, 0, bottom);
  sky.addColorStop(0, 'hsl(228 50% 18%)'); sky.addColorStop(1, 'hsl(212 55% 36%)');
  ctx.fillStyle = sky;
  archPath(ctx, x, top, w, bottom);
  ctx.fill();
  ctx.save();
  archPath(ctx, x, top, w, bottom);
  ctx.clip();
  ctx.fillStyle = 'hsl(50 60% 92% / 0.95)';
  ctx.beginPath(); ctx.arc(x + w * (0.35 + rand() * 0.3), top + w * 0.4, 15, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'hsl(22 35% 14%)'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, top); ctx.lineTo(x + w / 2, bottom);
  for (const y of [top + w * 0.8, top + w * 1.9, top + w * 3]) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); }
  ctx.stroke();
  ctx.restore();
  const beam = ctx.createLinearGradient(x, bottom, x + w * 2.4, HEIGHT);
  beam.addColorStop(0, 'hsl(210 80% 85% / 0.13)'); beam.addColorStop(1, 'hsl(210 80% 85% / 0)');
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x + w, bottom); ctx.lineTo(x + w * 2.8, HEIGHT); ctx.lineTo(x + w * 1.2, HEIGHT); ctx.closePath(); ctx.fill();
}

function chandelier(ctx, p, cx, cy) {
  pool(ctx, cx, cy + 20, 230, alpha(p.accent, 0.3));
  ctx.strokeStyle = 'hsl(40 50% 40%)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - 8); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(cx, cy, 52, 11, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 52, cy); ctx.quadraticCurveTo(cx, cy + 36, cx + 52, cy); ctx.stroke();
  for (let k = -2; k <= 2; k++) {
    const x = cx + k * 20, y = cy + 4 * Math.sqrt(1 - (k / 2.6) ** 2);
    ctx.fillStyle = 'hsl(45 30% 85%)'; ctx.fillRect(x - 2, y - 12, 4, 12);
    ctx.fillStyle = alpha(p.accent, 0.95);
    ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.quadraticCurveTo(x - 4, y - 19, x, y - 26); ctx.quadraticCurveTo(x + 4, y - 19, x, y - 13); ctx.fill();
  }
}

function rollingLadder(ctx, x) {
  ctx.strokeStyle = 'hsl(40 55% 42%)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, HEIGHT * 0.235); ctx.lineTo(WIDTH, HEIGHT * 0.235); ctx.stroke();
  ctx.strokeStyle = 'hsl(24 40% 26%)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, HEIGHT * 0.235); ctx.lineTo(x + 16, HEIGHT); ctx.moveTo(x + 34, HEIGHT * 0.235); ctx.lineTo(x + 50, HEIGHT); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = HEIGHT * 0.2356; y < HEIGHT; y += 22) { const lean = ((y - HEIGHT * 0.235) / (HEIGHT * 0.765)) * 16; ctx.moveTo(x + lean, y); ctx.lineTo(x + 34 + lean, y); }
  ctx.stroke();
}

function floatingBook(ctx, p, x, y, tilt) {
  pool(ctx, x, y - 6, 48, alpha(p.accent, 0.35));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'hsl(10 50% 22%)';
  ctx.beginPath(); ctx.moveTo(-23, 5); ctx.lineTo(0, 9); ctx.lineTo(23, 5); ctx.lineTo(23, 0); ctx.lineTo(-23, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'hsl(45 45% 88% / 0.95)';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(side * 12, -8, side * 21, -4); ctx.lineTo(side * 21, 3); ctx.quadraticCurveTo(side * 12, 0, 0, 6); ctx.fill(); }
  ctx.restore();
}

function oreVein(ctx, x, y, color, rand) {
  const angle = rand() * TAU, gems = 7 + Math.floor(rand() * 5);
  for (let k = 0; k < gems; k++) {
    const along = (k - gems / 2) * 22, gx = x + Math.cos(angle) * along + (rand() - 0.5) * 16, gy = y + Math.sin(angle) * along + (rand() - 0.5) * 16, r = 2 + rand() * 4;
    pool(ctx, gx, gy, r * 5, color.replace(/\)$/, ' / 0.35)'));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(gx, gy - r * 1.4); ctx.lineTo(gx + r, gy); ctx.lineTo(gx, gy + r * 1.4); ctx.lineTo(gx - r, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'hsl(0 0% 100% / 0.8)';
    ctx.fillRect(gx - 0.7, gy - r * 0.8, 1.4, 1.4);
  }
}

function minecartRails(ctx, cx, cy) {
  ctx.strokeStyle = 'hsl(28 30% 14%)';
  for (let s = 0.1; s < 1.7; s *= 1.17) {
    ctx.lineWidth = 2 + 6 * s;
    ctx.beginPath(); ctx.moveTo(cx - WIDTH * 0.2 * s, cy + HEIGHT * 0.4 * s); ctx.lineTo(cx + WIDTH * 0.2 * s, cy + HEIGHT * 0.4 * s); ctx.stroke();
  }
  ctx.strokeStyle = 'hsl(210 12% 42%)';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * WIDTH * 0.009, cy + HEIGHT * 0.04); ctx.lineTo(cx + side * WIDTH * 0.15, cy + HEIGHT * 0.64); ctx.stroke(); }
}

function timberFrame(ctx, cx, cy, s, lit) {
  const halfWidth = WIDTH * 0.44 * s, top = cy - HEIGHT * 0.38 * s, bottom = cy + HEIGHT * 0.4 * s, post = 6 + 26 * s;
  ctx.fillStyle = `hsl(28 38% ${7 + s * 17}%)`;
  for (const side of [-1, 1]) {
    ctx.fillRect(cx + side * halfWidth - post / 2, top, post, bottom - top);
    ctx.beginPath(); ctx.moveTo(cx + side * (halfWidth - post / 2), top + post * 0.9); ctx.lineTo(cx + side * (halfWidth - post / 2 - post * 1.6), top + post * 0.9); ctx.lineTo(cx + side * (halfWidth - post / 2), top + post * 2.6); ctx.fill();
  }
  ctx.fillRect(cx - halfWidth - post, top - post * 0.3, halfWidth * 2 + post * 2, post * 0.9);
  ctx.fillStyle = `hsl(32 40% ${14 + s * 18}%)`;
  ctx.fillRect(cx - halfWidth - post, top - post * 0.3, halfWidth * 2 + post * 2, Math.max(1, post * 0.12));
  if (!lit) return;
  const hang = top + post * 0.6 + 34 * s;
  pool(ctx, cx, hang + 10 * s, 120 + 220 * s, alpha(lit.accent, 0.5));
  ctx.strokeStyle = 'hsl(28 20% 10%)'; ctx.lineWidth = 1 + s;
  ctx.beginPath(); ctx.moveTo(cx, top + post * 0.6); ctx.lineTo(cx, hang); ctx.stroke();
  ctx.fillStyle = alpha(lit.accent, 0.95);
  ctx.fillRect(cx - 8 * s, hang, 16 * s, 22 * s);
  ctx.strokeStyle = 'hsl(28 20% 10%)';
  ctx.strokeRect(cx - 8 * s, hang, 16 * s, 22 * s);
}

const BACKGROUNDS = { ...FLAT_BACKGROUNDS, ...HORIZON_BACKGROUNDS };

export const hasHorizon = background => background in HORIZON_BACKGROUNDS;

export const PATTERNS = {
  none() {},
  hatch(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -TILE; i < TILE; i += 7) { ctx.moveTo(x + i, y + TILE); ctx.lineTo(x + i + TILE, y); }
    ctx.stroke();
  },
  facets(ctx, p, x, y) {
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
  moss(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.22);
    for (let i = 0; i < 2; i++) ellipse(ctx, x + 5 + rand() * 20, y + 8 + rand() * 18, 4 + rand() * 6, 3 + rand() * 3);
    ctx.fillStyle = alpha(p.rockDeep, 0.6);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + rand() * TILE, y + rand() * TILE, 2, 2);
  },
  stripes(ctx, p, x, y) {
    ctx.fillStyle = alpha(p.rockEdge, 0.28);
    for (let i = 0; i < TILE; i += 10) ctx.fillRect(x + i, y, 5, TILE);
  },
  kawara(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.85);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) { const cx = x + i * 15 + row * 7.5, cy = y + 7.5 + row * 15; ctx.moveTo(cx + 7.5, cy); ctx.arc(cx, cy, 7.5, 0, Math.PI); }
    ctx.stroke();
  },
  spines(ctx, p, x, y, rand) {
    for (let bx = x; bx < x + TILE; ) {
      const w = 3 + Math.floor(rand() * 5);
      ctx.fillStyle = alpha(rand() < 0.5 ? p.rockDeep : p.rockEdge, 0.4);
      ctx.fillRect(bx, y + 2, w - 1, TILE - 4);
      ctx.fillStyle = alpha(p.accent, 0.5);
      ctx.fillRect(bx, y + 7, w - 1, 1.5);
      ctx.fillRect(bx, y + 21, w - 1, 1.5);
      bx += w;
    }
  },
  ore(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + rand() * TILE, y); ctx.lineTo(x + rand() * TILE, y + TILE / 2); ctx.lineTo(x + rand() * TILE, y + TILE); ctx.stroke();
    if (rand() > 0.3) return;
    const gx = x + 6 + rand() * 18, gy = y + 6 + rand() * 18;
    ctx.fillStyle = alpha(p.accent, 0.85);
    ctx.beginPath(); ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 3, gy); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 3, gy); ctx.closePath(); ctx.fill();
  },
};

export function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  BACKGROUNDS[theme.background](canvas.getContext('2d'), p, seededNoise(level.palette * 7919 + 13));
  return canvas;
}
