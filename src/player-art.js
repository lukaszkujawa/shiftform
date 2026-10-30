import { playerSize, FALL_DAMAGE_SPEED } from './physics.js';
import { RESTING, moodOf } from './avatar.js';
import { glow } from './sprites.js';
import { alpha } from './themes.js';
import { TAU, font, roundRect } from './paint.js';

const FLIP_FRAMES = 24;
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
  ctx.font = font(700, 10 + t * 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('z', x + 8 + t * 10, y - 14 - t * 18);
  ctx.restore();
}

export function drawPlayer(ctx, p, theme, level, s, alpha = 1, avatar = RESTING) {
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
    ctx.font = font('bold', 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${r.jumpBudget - s.jumpsUsed}`, s.x + w / 2, (g > 0 ? s.y : s.y + h + 14) - 6);
  }
}
