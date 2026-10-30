import { TILE, WIDTH, HEIGHT } from './level.js?v=a3cd24e';
import { alpha } from './themes.js?v=a3cd24e';
import { TAU, veil } from './paint.js?v=a3cd24e';

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
};

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
};

export function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  BACKGROUNDS[theme.background](canvas.getContext('2d'), p, seededNoise(level.palette * 7919 + 13));
  return canvas;
}
