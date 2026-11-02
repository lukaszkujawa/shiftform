import { TAU } from './life-kit.js?v=ee21d18';
import { box, line, dot, blob } from './structure-materials.js?v=ee21d18';
import { alpha } from './themes.js?v=ee21d18';

const glowPane = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
const inset = (w, h, m) => ({ x: m, y: m, w: w - 2 * m, h: h - 2 * m });

export const BAYS = {
  xbrace(ctx, w, h, c) {
    line(ctx, 0, 0, w, h, 4, c.body);
    line(ctx, w, 0, 0, h, 4, c.lo);
  },
  planks(ctx, w, h, c, rng) {
    for (let x = 2; x < w - 2;) {
      const pw = rng.float(16, 26), top = rng.float(2, 12), bottom = h - rng.float(2, 12);
      box(ctx, x, top, Math.min(pw, w - x - 2), bottom - top, rng.chance(0.5) ? c.body : c.lo);
      box(ctx, x, top, 1.5, bottom - top, c.ink);
      for (const y of [top + 14, bottom - 14]) dot(ctx, x + pw / 2, y, 1.6, c.ink);
      x += pw + 1;
    }
    for (const y of [h * 0.28, h * 0.72]) box(ctx, 0, y, w, 8, c.hi);
  },
  wattle(ctx, w, h, c, rng) {
    const posts = Math.max(2, Math.floor(w / 56));
    for (let i = 0; i <= posts; i++) box(ctx, (i * (w - 10)) / posts, 6, 10, h - 12, c.lo);
    ctx.lineCap = 'round';
    for (let y = 24, row = 0; y < h - 18; y += rng.int(46, 70), row++) {
      for (let band = 0; band < 3; band++) {
        ctx.strokeStyle = band % 2 ? c.lo : c.body;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(6, y + band * 7);
        for (let i = 0; i < posts; i++) {
          const x0 = (i * (w - 10)) / posts + 5, x1 = ((i + 1) * (w - 10)) / posts + 5;
          ctx.quadraticCurveTo((x0 + x1) / 2, y + band * 7 + ((i + band + row) % 2 ? 7 : -7), x1, y + band * 7);
        }
        ctx.stroke();
      }
    }
  },
  windows(ctx, w, h, c, rng) {
    box(ctx, 8, 8, w - 16, h - 16, c.body);
    const cols = Math.max(2, Math.floor((w - 28) / 30)), rows = Math.max(1, Math.floor((h - 28) / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = 18 + i * ((w - 36) / cols), y = 18 + j * ((h - 36) / rows), pw = (w - 36) / cols - 10, ph = (h - 36) / rows - 10;
      box(ctx, x, y, pw, ph, c.ink);
      if (rng.chance(0.45)) c.lit.push(g => glowPane(g, x + 2, y + 2, pw - 4, ph - 4, alpha(c.window, 0.38)));
    }
  },
  arches(ctx, w, h, c) {
    const n = Math.max(1, Math.floor(w / 110)), span = w / n;
    box(ctx, 0, 0, w, 10, c.hi);
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = c.body;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(i * span + 4, h);
      ctx.lineTo(i * span + 4, h * 0.35);
      ctx.arc(i * span + span / 2, h * 0.35, span / 2 - 4, Math.PI, 0);
      ctx.lineTo((i + 1) * span - 4, h);
      ctx.stroke();
    }
  },
  rose(ctx, w, h, c) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34;
    dot(ctx, cx, cy, r + 8, c.body);
    c.lit.push(g => {
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8;
        g.fillStyle = alpha(c.glass[k % c.glass.length], 0.36);
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a + 0.04, a + TAU / 8 - 0.04); g.closePath(); g.fill();
      }
      g.fillStyle = alpha(c.window, 0.8);
      g.beginPath(); g.arc(cx, cy, r * 0.22, 0, TAU); g.fill();
    });
  },
  lancets(ctx, w, h, c) {
    const n = Math.max(2, Math.floor(w / 60));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * w / n, half = 14, top = h * 0.2;
      const path = g => { g.beginPath(); g.moveTo(x - half, h - 14); g.lineTo(x - half, top + 18); g.quadraticCurveTo(x - half, top, x, top - 8); g.quadraticCurveTo(x + half, top, x + half, top + 18); g.lineTo(x + half, h - 14); g.closePath(); };
      ctx.strokeStyle = c.body; ctx.lineWidth = 6; path(ctx); ctx.stroke();
      c.lit.push(g => { g.fillStyle = alpha(c.glass[i % c.glass.length], 0.32); path(g); g.fill(); });
    }
  },
  ducts(ctx, w, h, c, rng) {
    for (let k = 0; k < 3; k++) {
      const y = rng.float(14, h - 14), elbow = rng.float(w * 0.25, w * 0.75), y2 = rng.float(14, h - 14);
      ctx.strokeStyle = k % 2 ? c.body : c.lo;
      ctx.lineWidth = 9;
      ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(elbow, y); ctx.lineTo(elbow, y2); ctx.lineTo(w, y2); ctx.stroke();
      dot(ctx, elbow, y, 6, c.hi);
    }
  },
  mesh(ctx, w, h, c) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(4, 4, w - 8, h - 8);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.lo;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -h; x < w; x += 22) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); }
    ctx.stroke();
    ctx.restore();
  },
  shelves(ctx, w, h, c, rng) {
    box(ctx, 6, 6, w - 12, h - 12, c.lo);
    for (let y = 10; y < h - 16; y += 32) {
      box(ctx, 6, y + 26, w - 12, 4, c.hi);
      for (let x = 10; x < w - 14;) {
        const bw = rng.float(5, 11), bh = rng.float(14, 25);
        box(ctx, x, y + 26 - bh, bw, bh, rng.pick(c.spines));
        x += bw + (rng.chance(0.1) ? 12 : 1);
      }
    }
  },
  blinds(ctx, w, h, c, rng) {
    box(ctx, 10, 8, w - 20, h - 16, c.lo);
    const panes = Math.max(1, Math.floor(w / 120));
    for (let i = 0; i < panes; i++) {
      const x = 16 + i * (w - 26) / panes, pw = (w - 26) / panes - 8;
      c.lit.push(g => { for (let y = 14; y < h - 14; y += 7) { g.fillStyle = alpha(c.window, y % 14 ? 0.24 : 0.42); g.fillRect(x, y, pw, 4); } });
    }
  },
  honey(ctx, w, h, c) {
    const r = 18;
    for (let y = r, row = 0; y < h; y += r * 1.55, row++) for (let x = r + (row % 2 ? r * 0.9 : 0); x < w - r / 2; x += r * 1.8) {
      ctx.fillStyle = (row + Math.floor(x)) % 5 ? c.body : c.trim;
      ctx.strokeStyle = c.lo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) ctx.lineTo(x + Math.cos(a * TAU / 6 + TAU / 12) * r, y + Math.sin(a * TAU / 6 + TAU / 12) * r);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },
  circuit(ctx, w, h, c, rng) {
    for (let k = 0; k < 7; k++) {
      let x = rng.float(4, w - 4), y = rng.float(4, h - 4);
      ctx.strokeStyle = c.wire;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 3; s++) { if (s % 2) y = Math.max(4, Math.min(h - 4, y + rng.float(-50, 50))); else x = Math.max(4, Math.min(w - 4, x + rng.float(-70, 70))); ctx.lineTo(x, y); }
      ctx.stroke();
      dot(ctx, x, y, 3, c.wire);
    }
  },
  grid3d(ctx, w, h, c) {
    const cx = w / 2, cy = h * 0.42;
    ctx.strokeStyle = c.wire;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) { const x = k * w / 8; ctx.moveTo(cx, cy); ctx.lineTo(x, h); }
    for (let k = 1; k <= 5; k++) { const y = cy + (h - cy) * (k / 5) ** 2; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  },
  sail(ctx, w, h, c) {
    ctx.fillStyle = c.hi;
    ctx.beginPath(); ctx.moveTo(w * 0.15, 8); ctx.quadraticCurveTo(w * 0.62, h * 0.4, w * 0.85, h - 8); ctx.lineTo(w * 0.15, h - 8); ctx.closePath(); ctx.fill();
    for (let k = 1; k < 4; k++) line(ctx, w * 0.15, k * h / 4, w * 0.15 + k * w * 0.18, k * h / 4, 1, c.lo);
    box(ctx, w * 0.15 - 3, 0, 6, h, c.body);
  },
  nets(ctx, w, h, c) {
    ctx.strokeStyle = c.rope;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 18) { ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 9, h * 0.5, w / 2 + (x - w / 2) * 0.5, h * 0.92); }
    for (let k = 1; k < 7; k++) { const y = (k * h) / 7, sag = y * 0.09; ctx.moveTo(w * (k / 22), y); ctx.quadraticCurveTo(w / 2, y + sag, w * (1 - k / 22), y); }
    ctx.stroke();
  },
  shoji(ctx, w, h, c) {
    const f = inset(w, h, 10);
    box(ctx, f.x, f.y, f.w, f.h, c.body);
    c.lit.push(g => {
      g.fillStyle = alpha(c.window, 0.38);
      g.fillRect(f.x + 4, f.y + 4, f.w - 8, f.h - 8);
      g.strokeStyle = alpha(c.ink, 0.65);
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = f.x + 28; x < f.x + f.w - 4; x += 28) { g.moveTo(x, f.y + 4); g.lineTo(x, f.y + f.h - 4); }
      for (let y = f.y + 30; y < f.y + f.h - 4; y += 30) { g.moveTo(f.x + 4, y); g.lineTo(f.x + f.w - 4, y); }
      g.stroke();
    });
  },
  bunting(ctx, w, h, c, rng) {
    for (let k = 1; k <= 3; k++) {
      const y = (k * h) / 4, sag = rng.float(10, 28);
      line(ctx, 0, y, w, y, 1, c.lo);
      for (let x = 14; x < w - 8; x += 22) {
        const t = x / w, yy = y + sag * 4 * t * (1 - t) * 0.5;
        ctx.fillStyle = rng.pick([c.trim, c.hi, c.body]);
        ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.lineTo(x + 6, yy); ctx.lineTo(x, yy + 12); ctx.closePath(); ctx.fill();
      }
    }
  },
  wheel(ctx, w, h, c, rng) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
    ctx.strokeStyle = c.body; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.stroke();
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; box(ctx, x - 6, y, 12, 9, rng.pick([c.trim, c.hi])); }
    dot(ctx, cx, cy, 6, c.hi);
  },
  vats(ctx, w, h, c, rng) {
    const n = Math.max(1, Math.floor(w / 80));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * w / n, rw = 22, top = 12, bottom = h - 12;
      box(ctx, x - rw - 3, top - 6, 2 * rw + 6, 7, c.hi);
      box(ctx, x - rw - 3, bottom - 1, 2 * rw + 6, 7, c.lo);
      c.lit.push(g => {
        g.fillStyle = alpha(c.window, 0.32);
        g.fillRect(x - rw, top, 2 * rw, bottom - top);
        g.fillStyle = alpha(c.window, 0.55);
        for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + rng.float(-rw + 4, rw - 4), rng.float(top + 6, bottom - 6), rng.float(1.5, 3.5), 0, TAU); g.fill(); }
      });
    }
  },
  tracks(ctx, w, h, c) {
    box(ctx, 0, h - 16, w, 4, c.hi);
    for (let x = 6; x < w; x += 14) box(ctx, x, h - 12, 6, 8, c.lo);
    for (let k = 1; k <= Math.floor(w / 110); k++) { const x = k * w / (Math.floor(w / 110) + 1); box(ctx, x - 18, h - 38, 36, 20, c.body); dot(ctx, x - 10, h - 17, 4, c.ink); dot(ctx, x + 10, h - 17, 4, c.ink); }
  },
  reef(ctx, w, h, c, rng) {
    for (let k = 0; k < 8; k++) {
      const x = rng.float(8, w - 8);
      ctx.strokeStyle = rng.chance(0.5) ? c.trim : c.body;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let b = 0; b < 5; b++) { ctx.moveTo(x, h); ctx.quadraticCurveTo(x + (b - 2) * 5, h * 0.7, x + (b - 2) * rng.float(8, 14), h - rng.float(h * 0.2, h * 0.6)); }
      ctx.stroke();
    }
  },
  billows(ctx, w, h, c, rng) {
    for (let k = 0; k < 7; k++) { const x = rng.float(0, w), y = rng.float(10, h - 10); for (let i = -1; i <= 1; i++) dot(ctx, x + i * 22, y + Math.abs(i) * 4, rng.float(13, 22), c.mist); }
  },
  blueprint(ctx, w, h, c, rng) {
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(10, h / 2); ctx.lineTo(w - 10, h / 2); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * rng.float(0.2, 0.32), 0, TAU); ctx.stroke();
  },
  tapestry(ctx, w, h, c, rng) {
    const n = Math.max(1, Math.floor(w / 90));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * w / n, half = 22, tip = h * rng.float(0.55, 0.85);
      ctx.fillStyle = c.trim;
      ctx.beginPath(); ctx.moveTo(x - half, 0); ctx.lineTo(x + half, 0); ctx.lineTo(x + half, tip); ctx.lineTo(x, tip + 16); ctx.lineTo(x - half, tip); ctx.closePath(); ctx.fill();
      box(ctx, x - half - 4, 0, 2 * half + 8, 4, c.hi);
      blob(ctx, x, tip * 0.45, 9, 12, c.hi);
    }
  },
  cracks(ctx, w, h, c, rng) {
    for (let k = 0; k < 5; k++) {
      let x = rng.float(0, w), y = 0;
      ctx.strokeStyle = c.glowLine;
      ctx.lineWidth = rng.float(1.5, 3);
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < h) { x += rng.float(-16, 16); y += rng.float(10, 26); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },
  panels(ctx, w, h, c) {
    const n = Math.max(1, Math.floor(w / 70));
    for (let i = 0; i < n; i++) {
      const x = 8 + i * (w - 16) / n, pw = (w - 16) / n - 6;
      box(ctx, x, 12, pw, h - 24, c.lo);
      ctx.strokeStyle = c.hi;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 24; y < h - 12; y += 12) { ctx.moveTo(x, y); ctx.lineTo(x + pw, y); }
      ctx.moveTo(x + pw / 2, 12); ctx.lineTo(x + pw / 2, h - 12);
      ctx.stroke();
    }
  },
  crystals(ctx, w, h, c, rng) {
    for (let k = 0; k < 9; k++) {
      const x = rng.float(8, w - 8), up = rng.chance(0.5), base = up ? h : 0, len = rng.float(h * 0.2, h * 0.55), half = rng.float(5, 13), s = up ? -1 : 1;
      ctx.fillStyle = rng.chance(0.5) ? c.body : c.hi;
      ctx.beginPath(); ctx.moveTo(x - half, base); ctx.lineTo(x + rng.float(-5, 5), base + s * len); ctx.lineTo(x + half, base); ctx.closePath(); ctx.fill();
    }
  },
  canopy(ctx, w, h, c, rng) {
    for (let k = 0; k < 6; k++) { const x = rng.float(8, w - 8); line(ctx, x, 0, x + rng.float(-10, 10), h * rng.float(0.55, 0.95), 2, c.lo); }
    const clumps = Math.max(4, Math.floor(w / 42));
    for (let i = 0; i < clumps; i++) {
      const cx = (i + rng.float(0.1, 0.9)) * (w / clumps), cy = rng.float(8, h * 0.32);
      for (let k = 0; k < 26; k++) {
        const a = rng.float(0, TAU), d = rng.float(0, 30), x = cx + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d * 0.7;
        ctx.fillStyle = k < 14 ? c.leafDeep : rng.chance(0.3) ? c.leafLight : c.leaf;
        ctx.beginPath();
        ctx.ellipse(x, y, rng.float(6, 11), rng.float(3, 5), rng.float(0, Math.PI), 0, TAU);
        ctx.fill();
      }
    }
  },
};
