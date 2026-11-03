import { TILE } from '../world/level.js?v=7d0e866';
import { alpha } from './themes.js?v=7d0e866';
import { TAU } from './paint.js?v=7d0e866';
import { ellipse } from './backdrop-kit.js?v=7d0e866';

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
    ctx.fillStyle = alpha(p.rockEdge, 0.22);
    for (let i = 0; i < 2; i++) ellipse(ctx, x + 5 + rand() * 20, y + 8 + rand() * 18, 4 + rand() * 6, 3 + rand() * 3);
    ctx.fillStyle = alpha(p.rockDeep, 0.6);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + rand() * TILE, y + rand() * TILE, 2, 2);
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

