import { WIDTH } from '../world/level.js';
import { TRICKS, TRICK_COST, REROLL_COST } from '../world/tricks.js';
import { mutatorById } from '../world/rules.js';
import { drawMutatorIcon, EFFECT_COLORS } from '../art/mutator-icons.js';
import { drawTrickIcon, drawRune, drawDie, COIN_COLOR, RUNE_COLOR, BRIGHT_TEXT } from '../art/icons.js';
import { STALLS } from '../world/tunnel.js';
import { SKILLS, MAX_SKILL } from '../world/skills.js';
import { TAU, font, fitText, roundRect, wrapText } from '../art/paint.js';
import { markTip, ruleTip, trickTip, DICE_TIP } from './tooltip.js';

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
const PIP = { r: 3, step: 11, y: 74 };
const TIER_ICON = 18;
const TIER_ICON_STEP = 22;

const anchorOf = stall => stall.x ?? STALLS[stall.id];
const countOf = stall => (stall.note ? 0 : stall.dice ? 1 : (stall.offer ?? stall.skills ?? stall.gifts ?? stall.tiers).length);

function frameOf(stall) {
  const n = countOf(stall);
  const { w, h } = stall.note ? NOTE : { w: n * TILE_W + (n - 1) * GAP + 2 * PAD, h: TILE_H + 2 * PAD };
  const x = Math.max(12, Math.min(WIDTH - 12 - w, anchorOf(stall) - w / 2));
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

function drawGiftCard(ctx, t, i, gift) {
  const edge = gift.skill ? EFFECT_COLORS.boon : COIN_COLOR;
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (gift.skill) drawMutatorIcon(ctx, mutatorById(SKILLS[gift.skill].icon), t.x + t.w / 2, t.y + 36, 38);
  else label(ctx, gift.icon, t.x + t.w / 2, t.y + 38, 30, BRIGHT_TEXT);
  ctx.fillStyle = BRIGHT_TEXT;
  fitText(ctx, gift.title, t.x + t.w / 2, t.y + 70, t.w - 10, 800, 11);
  label(ctx, gift.level ? `LV ${gift.level}` : gift.more ? '' : 'FREE', t.x + t.w / 2, t.y + 90, 11, COIN_COLOR);
  badge(ctx, i + 1, t.x + 12, t.y + 12, edge);
}

function drawFlagCount(ctx, x, y, count) {
  ctx.strokeStyle = count ? BRIGHT_TEXT : MUTED;
  ctx.fillStyle = count ? BRIGHT_TEXT : MUTED;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x - 8, y - 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x, y - 3); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill();
  label(ctx, `${count}`, x + 8, y + 0.5, 12, count ? BRIGHT_TEXT : MUTED);
}

function drawTierCard(ctx, t, i, tier) {
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = tier.color;
  ctx.globalAlpha = tier.current ? 1 : 0.35;
  ctx.lineWidth = tier.current ? 3 : 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tier.color;
  fitText(ctx, tier.title, t.x + t.w / 2, t.y + 28, t.w - 10, 800, 11);
  tier.rules.forEach((id, k) => {
    const x = t.x + t.w / 2 + (k - (tier.rules.length - 1) / 2) * TIER_ICON_STEP;
    drawMutatorIcon(ctx, mutatorById(id), x, t.y + 48, TIER_ICON);
    markTip(x - TIER_ICON_STEP / 2, t.y + 38, TIER_ICON_STEP, 20, ruleTip(id));
  });
  drawFlagCount(ctx, t.x + t.w / 2, t.y + 70, tier.flags);
  drawRune(ctx, t.x + 13, t.y + 90, 6);
  label(ctx, `${tier.runes}`, t.x + 26, t.y + 90.5, 12, RUNE_COLOR);
  ctx.fillStyle = COIN_COLOR;
  ctx.beginPath(); ctx.arc(t.x + 41, t.y + 90, 5, 0, TAU); ctx.fill();
  label(ctx, `${tier.gold}`, t.x + 60, t.y + 90.5, 12, BRIGHT_TEXT);
  if (tier.current) label(ctx, '✓', t.x + 12, t.y + 12, 15, tier.color);
  else badge(ctx, i + 1, t.x + 12, t.y + 12, tier.color);
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

function drawSkillCard(ctx, t, i, { id, level, price, affordable, tip }) {
  const skill = SKILLS[id], maxed = level >= MAX_SKILL, color = EFFECT_COLORS.boon;
  markTip(t.x, t.y, t.w, t.h, tip);
  roundRect(ctx, t.x, t.y, t.w, t.h, 12);
  ctx.fillStyle = CARD;
  ctx.fill();
  if (affordable) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
  drawMutatorIcon(ctx, mutatorById(skill.icon), t.x + t.w / 2, t.y + 32, 36);
  ctx.fillStyle = color;
  fitText(ctx, skill.title, t.x + t.w / 2, t.y + 60, t.w - 10, 800, 11);
  for (let k = 0; k < MAX_SKILL; k++) {
    ctx.fillStyle = k < level ? color : 'hsl(240 12% 30% / 1)';
    ctx.beginPath(); ctx.arc(t.x + t.w / 2 + (k - (MAX_SKILL - 1) / 2) * PIP.step, t.y + PIP.y, PIP.r, 0, TAU); ctx.fill();
  }
  if (maxed) { label(ctx, 'MAX', t.x + t.w / 2, t.y + 91, 11, color); return; }
  if (price) {
    drawRune(ctx, t.x + t.w / 2 - 10, t.y + 91, 6);
    label(ctx, `${price}`, t.x + t.w / 2 + 6, t.y + 91.5, 12, affordable ? RUNE_COLOR : MUTED);
  } else label(ctx, 'FREE', t.x + t.w / 2, t.y + 91.5, 11, color);
  badge(ctx, i + 1, t.x + 12, t.y + 12, affordable ? color : MUTED);
}

function drawNote(ctx, text, frame) {
  ctx.font = font(NOTE.weight, NOTE.size);
  ctx.fillStyle = 'hsl(240 15% 86% / 1)';
  const lines = wrapText(ctx, text, frame.w - 2 * PAD - 8);
  lines.forEach((line, i) => ctx.fillText(line, frame.x + frame.w / 2, frame.y + frame.h / 2 + (i - (lines.length - 1) / 2) * NOTE.line));
}

export function drawStallBubble(ctx, stall, p, age) {
  const frame = frameOf(stall), pop = Math.min(1, age / POP_MS), tip = Math.max(frame.x + 16, Math.min(frame.x + frame.w - 16, anchorOf(stall) - 28));
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
  else if (stall.gifts) stall.gifts.forEach((gift, i) => drawGiftCard(ctx, tileAt(frame, i), i, gift));
  else if (stall.tiers) stall.tiers.forEach((tier, i) => drawTierCard(ctx, tileAt(frame, i), i, tier));
  else if (stall.dice) drawDiceCard(ctx, p, tileAt(frame, 0), stall.affordable, stall.age);
  else stall.skills.forEach((skill, i) => drawSkillCard(ctx, tileAt(frame, i), i, skill));
  ctx.restore();
}
