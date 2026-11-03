import { TILE, hazardRect } from '../world/level.js?v=c6cd642';
import { placedAt } from '../world/tricks.js?v=c6cd642';
import { playerSize } from '../world/physics.js?v=c6cd642';
import { alpha } from './themes.js?v=c6cd642';
import { drawSpring } from './gadgets.js?v=c6cd642';
import { TAU, roundRect, strokeDashed } from './paint.js?v=c6cd642';
import { drawPlatform, drawClimb, drawFlag } from './object-parts.js?v=c6cd642';

export function drawPlaced(ctx, p, theme, rect, time, valid = true) {
  ctx.save();
  if (!valid) ctx.globalAlpha = 0.45;
  if (rect.kind === 'ladder') {
    ctx.globalAlpha *= 0.9;
    drawClimb(ctx, { ...p, ink: valid ? p.accent : p.hazard }, 'ladder', rect, time);
  } else if (rect.kind === 'trampoline') {
    drawSpring(ctx, p, rect, time, null, valid ? p.accent : p.hazard);
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

const TOMB_FALL = 0.55;
const TOMB_SLAB_INSET = 3;
const TOMB_SHOULDER = 5;
const TOMB_PLINTH = 3;

const TOMB_SPIN = 0.3;

export function drawTomb(ctx, p, rect, frame) {
  const age = Math.max(0, frame - rect.born), flying = rect.path?.[age];
  const y = rect.path ? (flying?.[1] ?? rect.y) : Math.min(rect.y, rect.from + (TOMB_FALL * age * age) / 2);
  ctx.save();
  ctx.translate(flying?.[0] ?? rect.x, y);
  if (flying) { ctx.translate(rect.w / 2, rect.h / 2); ctx.rotate(age * TOMB_SPIN); ctx.translate(-rect.w / 2, -rect.h / 2); }
  ctx.fillStyle = p.edgeDeep;
  ctx.beginPath(); ctx.roundRect(TOMB_SLAB_INSET, 0, rect.w - 2 * TOMB_SLAB_INSET, rect.h, [TOMB_SHOULDER, TOMB_SHOULDER, 0, 0]); ctx.fill();
  ctx.fillStyle = p.edgeLight;
  ctx.fillRect(0, rect.h - TOMB_PLINTH, rect.w, TOMB_PLINTH);
  ctx.fillStyle = p.inkSoft;
  ctx.fillRect(rect.w / 2 - 1, 3, 2, 9);
  ctx.fillRect(rect.w / 2 - 4, 5, 8, 2);
  ctx.restore();
}

export function drawAim(ctx, p, theme, level, state, aim, time) {
  if (aim.kind === 'erase') {
    ctx.strokeStyle = aim.object ? p.hazard : alpha(p.text, 0.5);
    ctx.lineWidth = 2;
    strokeDashed(ctx, [4, 4], () => {
      if (aim.object) { const r = hazardRect(aim.object, state); roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 6); }
      else { ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, TAU); }
    });
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
