import { WIDTH } from './level.js?v=4a2bde0';
import { TRICKS, TRICK_COST, REROLL_COST } from './tricks.js?v=4a2bde0';
import { mutatorById } from './rules.js?v=4a2bde0';
import { drawMutatorIcon, EFFECT_COLORS } from './mutator-icons.js?v=4a2bde0';
import { drawTrickIcon, drawRune, drawDie, COIN_COLOR, RUNE_COLOR, BRIGHT_TEXT } from './icons.js?v=4a2bde0';
import { STALLS } from './tunnel.js?v=4a2bde0';
import { TIERS, tierOf } from './outfitter.js?v=4a2bde0';
import { TAU, font, fitText, roundRect, wrapText } from './paint.js?v=4a2bde0';
import { markTip, ruleTip, trickTip, DICE_TIP } from './tooltip.js?v=4a2bde0';

const TILE_W = 84;
const TILE_H = 104;
const GAP = 8;
const PAD = 10;
const TAIL = 10;
const LIFT = 84;
const NOTE = { w: 176, h: 58, line: 17, size: 12.5, weight: 500 };
const POP_MS = 160;
const PANEL = 'hsl(240 26% 10% / 0.94)';
const CARD = 'hsl(240 22% 17% / 1)';
const MUTED = 'hsl(240 10% 60% / 1)';
const DOT = 16;
const MAX_DOTS = 5;

const countOf = stall => (stall.note ? 0 : stall.dice ? 1 : (stall.offer ?? stall.gear ?? stall.rows).length);

function frameOf(stall) {
  const n = countOf(stall);
  const { w, h } = stall.note ? NOTE : { w: n * TILE_W + (n - 1) * GAP + 2 * PAD, h: TILE_H + 2 * PAD };
  const x = Math.max(12, Math.min(WIDTH - 12 - w, STALLS[stall.id] - w / 2));
  return { x, y: Math.max(8, stall.floor - LIFT - h), w, h };
}

const tileAt = (frame, i) => ({ x: frame.x + PAD + i * (TILE_W + GAP), y: frame.y + PAD, w: TILE_W, h: TILE_H });

export function stallHit(stall, x, y) {
  if (!stall) return null;
  const frame = frameOf(stall);
  for (let i = 0; i < countOf(stall); i++) {
    const t = tileAt(frame, i);
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return i + 1;
  }
  return null;
}

function label(ctx, text, x, y, size, color, weight = 800) {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function badge(ctx, n, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
  label(ctx, `${n}`, x, y + 0.5, 11, 'hsl(240 30% 8%)');
}

function drawCard(ctx, p, t, i, kind, sold, affordable) {
  const open = !sold && affordable;
  markTip(t.x, t.y, t.w, t.h, trickTip(kind));
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  if (open) { ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.globalAlpha = sold ? 0.35 : 1;
  drawTrickIcon(ctx, p, kind, t.x + t.w / 2, t.y + 38, 1.25);
  ctx.fillStyle = BRIGHT_TEXT;
  fitText(ctx, TRICKS[kind].title, t.x + t.w / 2, t.y + 70, t.w - 10, 800, 11);
  ctx.globalAlpha = 1;
  if (sold) { label(ctx, '✓', t.x + t.w / 2, t.y + 90, 15, p.accent); return; }
  ctx.fillStyle = COIN_COLOR;
  ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 15, t.y + 90, 5, 0, TAU); ctx.fill();
  label(ctx, `${TRICK_COST}`, t.x + t.w / 2 + 6, t.y + 90.5, 12, affordable ? BRIGHT_TEXT : p.hazard);
  badge(ctx, i + 1, t.x + 12, t.y + 12, open ? p.accent : MUTED);
}

function drawDiceCard(ctx, p, t, affordable, age) {
  const tumble = Math.floor(age / 90);
  markTip(t.x, t.y, t.w, t.h, DICE_TIP);
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  if (affordable) { ctx.strokeStyle = COIN_COLOR; ctx.lineWidth = 2; ctx.stroke(); }
  drawDie(ctx, t.x + t.w / 2 - 11, t.y + 36, 20, tumble % 6);
  drawDie(ctx, t.x + t.w / 2 + 11, t.y + 40, 20, (tumble + 3) % 6);
  ctx.fillStyle = BRIGHT_TEXT;
  fitText(ctx, 'Re-roll', t.x + t.w / 2, t.y + 68, t.w - 10, 800, 11);
  ctx.fillStyle = COIN_COLOR;
  ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 17, t.y + 90, 5, 0, TAU); ctx.fill();
  label(ctx, `${REROLL_COST}`, t.x + t.w / 2 + 5, t.y + 90.5, 12, affordable ? BRIGHT_TEXT : p.hazard);
  badge(ctx, 1, t.x + 12, t.y + 12, affordable ? COIN_COLOR : MUTED);
}

function drawGearCard(ctx, t, i, kind, { owned, replaces, price, affordable }) {
  const rule = mutatorById(kind), color = EFFECT_COLORS.boon, tier = TIERS[tierOf(kind)].color, open = !owned && affordable;
  markTip(t.x, t.y, t.w, t.h, ruleTip(kind));
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = tier;
  ctx.globalAlpha = open ? 1 : 0.4;
  ctx.lineWidth = open ? 2.5 : 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalAlpha = owned ? 0.35 : 1;
  drawMutatorIcon(ctx, rule, t.x + t.w / 2, t.y + 36, 38);
  ctx.fillStyle = color;
  fitText(ctx, rule.title, t.x + t.w / 2, t.y + 66, t.w - 10, 800, 11);
  ctx.globalAlpha = 1;
  if (owned) { label(ctx, '✓', t.x + t.w / 2, t.y + 89, 15, color); return; }
  if (price) {
    drawRune(ctx, t.x + t.w / 2 - 10, t.y + 89, 6);
    label(ctx, `${price}`, t.x + t.w / 2 + 6, t.y + 89.5, 12, affordable ? RUNE_COLOR : MUTED);
  } else label(ctx, 'FREE', t.x + t.w / 2, t.y + 89.5, 11, tier);
  badge(ctx, i + 1, t.x + 12, t.y + 12, open ? tier : MUTED);
  if (replaces) drawReplaced(ctx, replaces, t.x + t.w - 14, t.y + 14);
}

function drawReplaced(ctx, id, x, y) {
  ctx.globalAlpha = 0.75;
  drawMutatorIcon(ctx, mutatorById(id), x, y, 16);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'hsl(0 85% 62% / 1)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 7, y + 7); ctx.lineTo(x + 7, y - 7); ctx.stroke();
}

function drawPrice(ctx, t, price, affordable) {
  ctx.globalAlpha = affordable ? 1 : 0.45;
  drawRune(ctx, t.x + t.w - 22, t.y + 12, 6);
  label(ctx, `${price}`, t.x + t.w - 11, t.y + 12.5, 11, affordable ? RUNE_COLOR : MUTED);
  ctx.globalAlpha = 1;
}

function drawRule(ctx, t, i, { from, options, current, price, affordable }) {
  const rule = mutatorById(current), color = EFFECT_COLORS[rule.effect], swappable = options.length > 1;
  markTip(t.x, t.y, t.w, t.h, ruleTip(current));
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  if (current !== from) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
  drawMutatorIcon(ctx, rule, t.x + t.w / 2, t.y + 34, 38);
  ctx.fillStyle = color;
  fitText(ctx, rule.title, t.x + t.w / 2, t.y + 64, t.w - 10, 800, 11);
  if (swappable && options.length > MAX_DOTS) {
    label(ctx, `‹ ${options.indexOf(current) + 1} / ${options.length} ›`, t.x + t.w / 2, t.y + 87, 11, MUTED);
    badge(ctx, i + 1, t.x + 12, t.y + 12, color);
    if (price) drawPrice(ctx, t, price, affordable);
  } else if (swappable) {
    const left = t.x + t.w / 2 - ((options.length - 1) * DOT) / 2;
    options.forEach((id, k) => {
      if (id === current) { ctx.strokeStyle = BRIGHT_TEXT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(left + k * DOT, t.y + 87, 8, 0, TAU); ctx.stroke(); }
      drawMutatorIcon(ctx, mutatorById(id), left + k * DOT, t.y + 87, 13);
    });
    badge(ctx, i + 1, t.x + 12, t.y + 12, color);
    if (price) drawPrice(ctx, t, price, affordable);
  } else {
    label(ctx, '🔒', t.x + t.w / 2, t.y + 87, 12, MUTED, 600);
  }
}

function drawNote(ctx, text, frame) {
  ctx.font = font(NOTE.weight, NOTE.size);
  ctx.fillStyle = 'hsl(240 15% 86% / 1)';
  const lines = wrapText(ctx, text, frame.w - 2 * PAD - 8);
  lines.forEach((line, i) => ctx.fillText(line, frame.x + frame.w / 2, frame.y + frame.h / 2 + (i - (lines.length - 1) / 2) * NOTE.line));
}

export function drawStallBubble(ctx, stall, p, age) {
  const frame = frameOf(stall), pop = Math.min(1, age / POP_MS), tip = Math.max(frame.x + 16, Math.min(frame.x + frame.w - 16, STALLS[stall.id] - 28));
  ctx.save();
  ctx.globalAlpha = pop;
  ctx.translate(tip, frame.y + frame.h);
  ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
  ctx.translate(-tip, -(frame.y + frame.h));
  ctx.fillStyle = PANEL;
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, 16);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(tip - TAIL, frame.y + frame.h); ctx.lineTo(tip, frame.y + frame.h + TAIL); ctx.lineTo(tip + TAIL, frame.y + frame.h); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stall.note) drawNote(ctx, stall.note, frame);
  else if (stall.offer) stall.offer.forEach((kind, i) => drawCard(ctx, p, tileAt(frame, i), i, kind, stall.bought.includes(kind), stall.affordable[i]));
  else if (stall.dice) drawDiceCard(ctx, p, tileAt(frame, 0), stall.affordable, stall.age);
  else if (stall.gear) stall.gear.forEach((kind, i) => drawGearCard(ctx, tileAt(frame, i), i, kind, { owned: stall.owned[i], replaces: stall.replaces[i], price: stall.prices[i], affordable: stall.affordable[i] }));
  else stall.rows.forEach((row, i) => drawRule(ctx, tileAt(frame, i), i, row));
  ctx.restore();
}
