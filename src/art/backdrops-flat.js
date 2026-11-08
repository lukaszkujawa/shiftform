import { HEIGHT, WIDTH } from '../world/level.js?v=ececfed';
import { alpha } from './themes.js?v=ececfed';
import { TAU, veil } from './paint.js?v=ececfed';

export const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

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


export const FLAT_BACKGROUNDS = {
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
