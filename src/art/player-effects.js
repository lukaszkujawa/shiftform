import { COMBO_FROM } from '../world/combo.js?v=9b09a76';
import { playerSize, shieldsUp } from '../world/physics.js?v=9b09a76';
import { alpha } from './themes.js?v=9b09a76';
import { ITEM_COLORS } from './icons.js?v=9b09a76';
import { drawPlayer } from './player-art.js?v=9b09a76';
import { TAU, font, roundRect, strokeDashed } from './paint.js?v=9b09a76';

export function drawPowers(ctx, level, state, time) {
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
  const shielded = state.shield || shieldsUp(level.rules, state) > 0;
  if (shielded || state.invuln > 0) {
    ctx.strokeStyle = `hsl(210 90% 75% / ${shielded ? 0.55 + Math.sin(time / 200) * 0.15 : (state.invuln % 10 < 5 ? 0.6 : 0.1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.85, 0, TAU); ctx.stroke();
  }
}

export function drawRival(ctx, p, theme, level, s) {
  const { w } = playerSize(level.rules);
  drawPlayer(ctx, p, theme, level, s, 0.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = font(700, 11);
  ctx.fillStyle = alpha(p.text, 0.7);
  ctx.fillText('ghost', s.x + w / 2, s.y - 6);
}

export function drawArrows(ctx, p, state) {
  for (const a of state.flying) {
    ctx.save();
    ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
    ctx.rotate(Math.atan2(a.vy, a.vx));
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.fillStyle = ITEM_COLORS.bow;
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3.5); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function drawBlinkPreview(ctx, p, level, state, to, time) {
  const { w, h } = playerSize(level.rules);
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time / 120);
  ctx.strokeStyle = p.player;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  roundRect(ctx, to.x, to.y, w, h, 6);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(state.x + w / 2, state.y + h / 2); ctx.lineTo(to.x + w / 2, to.y + h / 2); ctx.stroke();
  ctx.restore();
}

export function drawArchitect(ctx, p, level, s, time) {
  const { w, h } = playerSize(level.rules);
  const bob = Math.sin(time / 180) * 1.5, radius = Math.min(8, w / 3);
  ctx.save();
  ctx.translate(s.x + w / 2, s.y + h / 2);
  if (s.gravDir < 0) ctx.scale(1, -1);
  ctx.fillStyle = alpha(p.accent, 0.16);
  roundRect(ctx, -w / 2, -h / 2 + bob, w, h - 3, radius);
  ctx.fill();
  ctx.strokeStyle = alpha(p.accent, 0.75);
  ctx.lineWidth = 1.5;
  strokeDashed(ctx, [4, 3], () => roundRect(ctx, -w / 2, -h / 2 + bob, w, h - 3, radius));
  ctx.fillStyle = p.accent;
  const eye = s.facing * w * 0.14;
  ctx.beginPath(); ctx.arc(eye - w * 0.15, -h * 0.2 + bob, 1.8, 0, TAU); ctx.arc(eye + w * 0.15, -h * 0.2 + bob, 1.8, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawCombo(ctx, p, state, combo, w, h) {
  const links = combo.pop?.links ?? combo.links;
  if (combo.links < COMBO_FROM && !(combo.pop && combo.pop.age < 40 && links >= COMBO_FROM)) return;
  const pop = combo.pop && combo.pop.age < 12 ? 1 - combo.pop.age / 12 : 0;
  const cx = state.x + w / 2, top = state.gravDir > 0 ? state.y - 10 : state.y + h + 22;
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(1 + pop * 0.7, 1 + pop * 0.7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = font(800, 16 + Math.min(14, links));
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
    ctx.font = font(900, 24);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'hsl(240 30% 8% / 0.75)';
    ctx.fillStyle = 'hsl(48 100% 70%)';
    ctx.strokeText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.fillText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.restore();
  }
}
