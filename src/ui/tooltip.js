import { WIDTH, HEIGHT } from '../world/level.js?v=c6cd642';
import { mutatorById } from '../world/rules.js?v=c6cd642';
import { TRICKS, REROLL_COST } from '../world/tricks.js?v=c6cd642';
import { EFFECT_COLORS } from '../art/mutator-icons.js?v=c6cd642';
import { COIN_COLOR, RUNE_COLOR } from '../art/icons.js?v=c6cd642';
import { SKILLS, levelOf, MAX_SKILL } from '../world/skills.js?v=c6cd642';
import { font, roundRect, wrapText } from '../art/paint.js?v=c6cd642';

const TIP = { width: 230, pad: 12, line: 17, gap: 6, offset: 18, margin: 8 };
const spots = [];

export const ruleTip = id => {
  const rule = mutatorById(id);
  return { title: rule.title, tag: 'bane', color: EFFECT_COLORS[rule.effect], text: rule.about };
};

export const trickTip = kind => ({ title: TRICKS[kind].title, tag: 'card', color: COIN_COLOR, text: TRICKS[kind].text });

export const RUNE_TIP = { title: 'Runes', tag: 'currency', color: RUNE_COLOR, text: 'You earn them for every biome you finish, more the harder you set it. Spend them on skills.' };

export function skillTip(id, skills) {
  const skill = SKILLS[id], level = levelOf(skills, id);
  const now = level ? `Now: ${skill.now(level)}.` : '';
  return { title: skill.title, tag: `skill ${level}/${MAX_SKILL}`, color: EFFECT_COLORS.boon, text: [skill.about, now].filter(Boolean).join(' ') };
}

export const DICE_TIP = { title: 'Re-roll', tag: 'shady deal', color: COIN_COLOR, text: `For ${REROLL_COST} gold, new cards at the merchant and new skills at the trainer.` };

export function markTip(x, y, w, h, tip) {
  spots.push({ x, y, w, h, tip });
}

export function tipAt(x, y) {
  return spots.findLast(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h)?.tip ?? null;
}

export function drawTooltip(ctx, pointer) {
  const tip = pointer && tipAt(pointer.x, pointer.y);
  spots.length = 0;
  if (!tip) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(500, 12.5);
  const lines = wrapText(ctx, tip.text, TIP.width);
  const textW = Math.max(...lines.map(line => ctx.measureText(line).width));
  ctx.font = font(800, 14);
  const titleW = ctx.measureText(tip.title).width;
  ctx.font = font(800, 10);
  const tagW = ctx.measureText(tip.tag.toUpperCase()).width;
  const w = Math.max(textW, titleW + tagW + 18) + 2 * TIP.pad, h = 2 * TIP.pad + 18 + TIP.gap + lines.length * TIP.line;
  const x = Math.max(TIP.margin, Math.min(WIDTH - TIP.margin - w, pointer.x - w / 2));
  const below = pointer.y + TIP.offset, y = below + h > HEIGHT - TIP.margin ? pointer.y - TIP.offset - h : below;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'hsl(240 26% 9% / 0.96)';
  ctx.fill();
  ctx.strokeStyle = tip.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const top = y + TIP.pad + 9;
  ctx.fillStyle = tip.color;
  ctx.font = font(800, 14);
  ctx.fillText(tip.title, x + TIP.pad, top);
  ctx.font = font(800, 10);
  ctx.globalAlpha = 0.75;
  ctx.fillText(tip.tag.toUpperCase(), x + w - TIP.pad - tagW, top + 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'hsl(240 15% 86% / 1)';
  ctx.font = font(500, 12.5);
  lines.forEach((line, i) => ctx.fillText(line, x + TIP.pad, top + 9 + TIP.gap + TIP.line / 2 + i * TIP.line));
  ctx.restore();
}
