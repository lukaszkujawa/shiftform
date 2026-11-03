import { WIDTH, floodLevel } from '../world/level.js';
import { alpha } from './themes.js';
import { TAU } from './paint.js';

const CHASERS = {
  water(ctx, p, y, depth, time) {
    ctx.fillStyle = p.hazardGlow;
    ctx.fillRect(0, y, WIDTH, depth);
    ctx.strokeStyle = p.hazard;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + time / 180) * 3);
    ctx.stroke();
  },
  ash(ctx, p, y, depth, time) {
    const smoke = 'hsl(20 30% 4% / 0.92)', g = ctx.createLinearGradient(0, y, 0, y + 120);
    g.addColorStop(0, alpha(p.accent, 0.6));
    g.addColorStop(0.35, alpha(p.hazard, 0.6));
    g.addColorStop(1, smoke);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, WIDTH, Math.min(depth, 120));
    ctx.fillStyle = smoke;
    ctx.fillRect(0, y + 120, WIDTH, Math.max(0, depth - 120));
    ctx.strokeStyle = p.accentLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 6) ctx.lineTo(x, y + Math.sin(x / 11 + time / 90) * 4 + Math.sin(x / 3.7 - time / 60) * 2);
    ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const rise = (time / 14 + i * 53) % 90, x = (i * 97 + Math.sin(time / 500 + i) * 12 + WIDTH) % WIDTH;
      ctx.fillStyle = alpha(i % 3 ? p.hazard : p.accent, Math.max(0, 0.9 - rise / 100));
      ctx.fillRect(x, y - rise, 2, 2);
    }
  },
  fog(ctx, p, y, depth, time) {
    const mist = a => `hsl(200 30% 92% / ${a})`, g = ctx.createLinearGradient(0, y - 40, 0, y + 60);
    g.addColorStop(0, mist(0));
    g.addColorStop(0.4, mist(0.55));
    g.addColorStop(1, mist(0.85));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 40, WIDTH, Math.min(depth + 40, 100));
    ctx.fillStyle = mist(0.85);
    ctx.fillRect(0, y + 60, WIDTH, Math.max(0, depth - 60));
    ctx.fillStyle = alpha(p.accentLight, 0.8);
    for (let i = 0; i < 14; i++) {
      const x = (i * 71 + 20) % WIDTH, spike = 10 + ((i * 37) % 14) + Math.sin(time / 400 + i) * 2;
      ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x, y - spike); ctx.lineTo(x + 6, y + 4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = mist(0.6);
    for (let i = 0; i < 20; i++) ctx.fillRect((i * 113 + (time / 40) * (1 + (i % 3))) % WIDTH, y - ((i * 29) % 50) - Math.sin(time / 300 + i) * 4, 2, 2);
  },
  void(ctx, p, y, depth, time) {
    ctx.fillStyle = 'hsl(260 45% 4% / 0.94)';
    ctx.fillRect(0, y, WIDTH, depth);
    const g = ctx.createLinearGradient(0, y - 50, 0, y);
    g.addColorStop(0, alpha(p.accent, 0));
    g.addColorStop(1, alpha(p.accent, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, WIDTH, 50);
    ctx.strokeStyle = alpha(p.accent, 0.8);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const x = i * (WIDTH / 8) + Math.sin(time / 700 + i) * 20;
      ctx.beginPath(); ctx.moveTo(x, y + 2);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(time / 250 + i + k * 1.3) * k * 2.3, y - k * 9);
      ctx.stroke();
    }
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 16; i++) {
      const fall = (time / 10 + i * 41) % 70;
      ctx.globalAlpha = fall / 70;
      ctx.fillRect((i * 131 + 40) % WIDTH, y - 70 + fall, 2, 2);
    }
    ctx.globalAlpha = 1;
  },
  growth(ctx, p, y, depth, time) {
    const g = ctx.createLinearGradient(0, y, 0, y + 100);
    g.addColorStop(0, alpha(p.rockEdge, 0.7));
    g.addColorStop(1, alpha(p.edgeDeep, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, WIDTH, Math.min(depth, 100));
    ctx.fillStyle = alpha(p.edgeDeep, 0.9);
    ctx.fillRect(0, y + 100, WIDTH, Math.max(0, depth - 100));
    ctx.fillStyle = alpha(p.rockEdge, 0.85);
    for (let x = 0; x < WIDTH; x += 18) {
      ctx.beginPath(); ctx.arc(x + 9, y + 4 + Math.sin(time / 350 + x / 30) * 2, 8 + ((x * 7) % 9), Math.PI, TAU); ctx.fill();
    }
    ctx.strokeStyle = alpha(p.accent, 0.9);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = i * (WIDTH / 7) + 30, sway = Math.sin(time / 420 + i) * 6, reach = 24 + ((i * 13) % 16);
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + sway, y - reach / 2, x - sway, y - reach); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - sway, y - reach, 2.5, 0, TAU); ctx.fillStyle = p.accent; ctx.fill();
    }
  },
  sand(ctx, p, y, depth, time) {
    const g = ctx.createLinearGradient(0, y - 30, 0, y + 40);
    g.addColorStop(0, alpha(p.rockDeep, 0));
    g.addColorStop(1, alpha(p.rockDeep, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 30, WIDTH, Math.min(depth + 30, 70));
    ctx.fillStyle = alpha(p.rockDeep, 0.9);
    ctx.fillRect(0, y + 40, WIDTH, Math.max(0, depth - 40));
    ctx.strokeStyle = alpha(p.rockEdge, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 40 + time / 600) * 5);
    ctx.stroke();
    ctx.fillStyle = alpha(p.rockEdge, 0.7);
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 89 + (time / 6) * (1 + (i % 4))) % WIDTH, y - ((i * 23) % 45), 2, 1);
  },
};

export function drawFlood(ctx, p, theme, level, state, time) {
  const y = floodLevel(level, state.tide);
  if (y >= level.height) return;
  ctx.save();
  CHASERS[theme.chaser](ctx, p, y, level.height - y, time);
  ctx.restore();
}
