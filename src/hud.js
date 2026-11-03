import { WIDTH, HEIGHT, levelIndex } from './level.js';
import { TRICKS } from './tricks.js';
import { SHIELD_RECHARGE } from './physics.js';
import { MAX_LIVES } from './climb.js';
import { SKILLS } from './skills.js';
import { mutatorById, isBane } from './rules.js';
import { drawMutatorIcon, EFFECT_COLORS } from './mutator-icons.js';
import { alpha } from './themes.js';
import { ITEM_COLORS, COIN_COLOR, RUNE_COLOR, BRIGHT_TEXT, drawItemIcon, drawTrickIcon, drawRune } from './icons.js';
import { TAU, font, roundRect, strokeDashed, veil } from './paint.js';
import { markTip, ruleTip, RUNE_TIP } from './tooltip.js';

export const BAR_H = 40;
const PROMPT = { w: 190, h: 48, y: HEIGHT / 2 + 38, gap: 20 };
const COUNT = { size: 20, gap: 6 };
const SLOT = { size: 34, gap: 6, y: 62, right: WIDTH - 14 };
const BANNER_ICON = 20;
const CORNER_ICON = 15;
const mutatorsOf = level => (level.mutators ?? []).filter(isBane).map(mutatorById);

function jumpExtras(rules) {
  return [
    rules.jumpFlipChance && 'may flip gravity',
    rules.jumps > 1 && `${rules.jumps}× in air`,
    rules.wallJump && 'off walls',
    rules.glide && 'hold to glide',
    rules.jumpBudget && `${rules.jumpBudget} total`,
  ].filter(Boolean);
}

const onRope = (level, state) => state?.rope >= 0 && !level.objects[state.rope].grip;

function controlsFor(level, muted = false, state = null) {
  const r = level.rules, index = levelIndex(level);
  const jump = jumpExtras(r);
  const grab = [index.levers.length && 'pull lever', index.crates.length && 'lift · throw crate', index.hooks.length && 'grab · let go'].filter(Boolean);
  return [
    r.mirror && { caps: ['←', '→'], label: 'move (reversed!)', input: ['left', 'right'], special: true },
    jump.length && { caps: ['Z'], label: ['jump', ...jump].join(' · '), input: ['jump'], special: true },
    r.dash && { caps: ['X'], label: 'dash', input: ['dash'], special: true },
    r.blinkJump && { caps: ['T'], label: 'teleport', count: state?.teleports ?? 0, input: ['teleport'], special: true },
    grab.length && { caps: ['F'], label: grab.join(' · '), input: ['interact'], special: true },
    level.objects.some(o => o.type === 'cannon') && { caps: ['Z'], label: 'fire cannon', input: ['jump'], special: true },
    onRope(level, state) ? { caps: ['↑', '↓'], label: 'reel rope', input: ['up', 'down'], special: true } : index.climbs.length && { caps: ['↑', '↓'], label: 'climb', input: ['up', 'down'], special: true },
    index.clings.length && !r.wallJump && { caps: ['Z'], label: 'jump off marked walls', input: ['jump'], special: true },
    state?.boots > 0 && { caps: ['Z'], label: `in air · boots ×${state.boots}`, input: ['jump'], special: true },
    state?.fuel > 0 && { caps: ['Z'], label: 'in air · jetpack', input: ['jump'], special: true },
    state?.arrows > 0 && { caps: ['V'], label: `shoot ×${state.arrows}`, special: true },
    { caps: ['R'], label: 'back to checkpoint' },
    !level.custom && { caps: ['H'], label: 'hint' },
    { caps: ['M'], label: muted ? 'sound off' : 'sound' },
    { caps: ['Esc'], label: 'menu' },
  ].filter(Boolean);
}

export function inventoryHit(x, y, count) {
  if (y < SLOT.y || y > SLOT.y + SLOT.size) return null;
  for (let i = 0; i < count; i++) {
    const left = SLOT.right - (count - i) * (SLOT.size + SLOT.gap) + SLOT.gap;
    if (x >= left && x <= left + SLOT.size) return i;
  }
  return null;
}

const PROMPT_BUTTONS = ['stay', 'restart', 'leave'];
const promptX = i => WIDTH / 2 + (i - 1.5) * PROMPT.w + (i - 1) * PROMPT.gap;

export function promptHit(x, y) {
  if (y < PROMPT.y || y > PROMPT.y + PROMPT.h) return null;
  return PROMPT_BUTTONS.find((_, i) => x >= promptX(i) && x <= promptX(i) + PROMPT.w) ?? null;
}

function drawBuilding(ctx, building, title, y, colors) {
  const percent = Math.min(99, Math.floor(building.fraction * 100));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(700, 22);
  ctx.fillStyle = colors.text;
  ctx.fillText(`${title} ${percent}%`, WIDTH / 2, y);
  roundRect(ctx, WIDTH / 2 - 120, y + 20, 240, 8, 4);
  ctx.fillStyle = colors.track;
  ctx.fill();
  if (percent > 0) {
    roundRect(ctx, WIDTH / 2 - 120, y + 20, 240 * building.fraction, 8, 4);
    ctx.fillStyle = colors.accent;
    ctx.fill();
  }
  ctx.font = font(600, 14);
  ctx.fillStyle = colors.dim;
  ctx.fillText(building.stage, WIDTH / 2, y + 46);
  ctx.font = font('italic 500', 15);
  ctx.fillStyle = colors.accent;
  ctx.fillText(`${building.phrase}…`, WIDTH / 2, y + 70);
}

function drawCounted(ctx, p, kind, count, x, textGap) {
  drawItemIcon(ctx, kind, x, 44, 0.8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(700, 13);
  ctx.fillStyle = p.text;
  ctx.fillText(`×${count}`, x + textGap, 45);
}

function drawShieldCharges(ctx, rules, state) {
  const down = state.frame < state.shieldsBack, left = rules.shields - state.shieldsLost;
  for (let k = 0; k < rules.shields; k++) {
    const x = WIDTH - CHARGES.right - k * CHARGES.step;
    if (k >= left) {
      ctx.globalAlpha = CHARGES.lost;
      drawItemIcon(ctx, 'shield', x, CHARGES.y, CHARGES.scale);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = down ? CHARGES.dim : 1;
    drawItemIcon(ctx, 'shield', x, CHARGES.y, CHARGES.scale);
    ctx.globalAlpha = 1;
    if (!down) continue;
    ctx.strokeStyle = ITEM_COLORS.shield;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, CHARGES.y, CHARGES.ring, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - (state.shieldsBack - state.frame) / SHIELD_RECHARGE)); ctx.stroke();
  }
}

function drawInventory(ctx, state, p, rules) {
  let x = WIDTH - 180;
  if (state.fuel > 0) {
    drawItemIcon(ctx, 'jetpack', x, 44, 0.8);
    ctx.fillStyle = 'hsl(240 20% 10% / 0.6)';
    ctx.fillRect(x + 12, 40, 50, 8);
    ctx.fillStyle = ITEM_COLORS.jetpack;
    ctx.fillRect(x + 12, 40, 50 * Math.min(1, state.fuel / rules.jetFuel), 8);
    x += 76;
  }
  if (state.boots > 0) { drawCounted(ctx, p, 'boots', state.boots, x, 11); x += 44; }
  if (state.arrows > 0) { drawCounted(ctx, p, 'bow', state.arrows, x, 11); x += 44; }
  if (state.shield) { drawItemIcon(ctx, 'shield', x, 44, 0.8); x += 30; }
  if (state.comet) drawCounted(ctx, p, 'comet', state.comet, x, 12);
}

export function drawMeter(ctx, view, p) {
  const { level, state, altitude, best, touched } = view;
  const x = 18, top = 70, bottom = HEIGHT - 70;
  const span = bottom - top;
  const at = y => bottom - (1 - y / level.height) * span;
  ctx.fillStyle = 'hsl(240 20% 8% / 0.55)';
  roundRect(ctx, x - 4, top - 8, 8, span + 16, 4);
  ctx.fill();
  for (const o of level.objects) {
    if (o.type !== 'checkpoint') continue;
    ctx.fillStyle = touched.includes(o.id) ? p.accent : 'hsl(240 10% 60% / 0.6)';
    ctx.fillRect(x - 7, at(o.y + o.h) - 1, 14, 2);
  }
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.moveTo(x - 8, top - 10); ctx.lineTo(x + 8, top - 10); ctx.lineTo(x, top - 18); ctx.closePath(); ctx.fill();
  if (Number.isFinite(view.combo?.floor)) {
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    strokeDashed(ctx, [3, 3], () => { ctx.beginPath(); ctx.moveTo(x - 10, at(view.combo.floor)); ctx.lineTo(x + 10, at(view.combo.floor)); });
  }
  const py = at(Math.max(0, Math.min(level.height, state.y)));
  ctx.fillStyle = p.player;
  ctx.beginPath(); ctx.arc(x, py, 6, 0, TAU); ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(800, 22);
  ctx.fillStyle = p.text;
  ctx.fillText(`${altitude.toLocaleString()} m`, x + 16, py);
  ctx.font = font(600, 12);
  ctx.fillStyle = p.dim;
  ctx.fillText(`best ${best.toLocaleString()} m`, x + 16, py + 20);
  const architect = view.architect;
  if (architect?.started) {
    const ay = at(Math.max(0, Math.min(level.height, architect.state.y)));
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, ay - 7); ctx.lineTo(x + 6, ay); ctx.lineTo(x, ay + 7); ctx.lineTo(x - 6, ay); ctx.closePath(); ctx.stroke();
  }
  const rival = view.rival;
  if (!rival) return;
  const ry = rival.index > view.biomeIndex ? top - 4 : rival.index < view.biomeIndex ? bottom + 4 : at(Math.max(0, Math.min(level.height, rival.state?.y ?? level.height)));
  ctx.strokeStyle = p.text;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, ry, 6, 0, TAU); ctx.stroke();
  const lead = rival.altitude - altitude;
  ctx.fillStyle = alpha(p.text, 0.75);
  ctx.fillText(`ghost ${rival.altitude.toLocaleString()} m${rival.done ? '' : lead > 0 ? ` · +${lead.toLocaleString()}` : ''}`, x + 16, py + 36);
}

const PROGRESS = { x: 14, y: 18, badge: 20, icon: 15, step: 17, max: 12 };
const CORNER_Y = 41;
const RUNE_GAP = 48;
const CHARGES = { right: 196, step: 22, y: 44, scale: 0.6, lost: 0.12, dim: 0.3, ring: 9 };
const OWNED = { gap: 30, step: 26, icon: 18, y: 20 };

const runeX = maxLives => WIDTH - 70 - maxLives * 20 - 58 - RUNE_GAP;

function drawSkills(ctx, skills, maxLives) {
  skills.forEach(({ id, level, tip }, k) => {
    const x = runeX(maxLives) - OWNED.gap - k * OWNED.step;
    drawMutatorIcon(ctx, mutatorById(SKILLS[id].icon), x, OWNED.y, OWNED.icon);
    ctx.font = font(900, 10);
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'hsl(240 30% 8%)';
    ctx.strokeText(`${level}`, x + 8, OWNED.y + 8);
    ctx.fillStyle = BRIGHT_TEXT;
    ctx.fillText(`${level}`, x + 8, OWNED.y + 8);
    markTip(x - OWNED.step / 2, OWNED.y - OWNED.step / 2, OWNED.step, OWNED.step, tip);
  });
}

function drawProgress(ctx, collected, biomeIndex) {
  ctx.font = font(900, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = `LV ${biomeIndex + 1}`, w = ctx.measureText(text).width + 16;
  roundRect(ctx, PROGRESS.x, PROGRESS.y - PROGRESS.badge / 2, w, PROGRESS.badge, PROGRESS.badge / 2);
  ctx.fillStyle = COIN_COLOR;
  ctx.fill();
  ctx.fillStyle = 'hsl(240 30% 8%)';
  ctx.fillText(text, PROGRESS.x + w / 2, PROGRESS.y + 0.5);
  const shown = collected.length > PROGRESS.max ? collected.slice(0, PROGRESS.max - 1) : collected;
  let x = PROGRESS.x + w + 6 + PROGRESS.step / 2;
  for (const id of shown) {
    drawMutatorIcon(ctx, mutatorById(id), x, PROGRESS.y, PROGRESS.icon);
    markTip(x - PROGRESS.step / 2, PROGRESS.y - PROGRESS.step / 2, PROGRESS.step, PROGRESS.step, ruleTip(id));
    x += PROGRESS.step;
  }
  if (shown.length < collected.length) {
    ctx.fillStyle = BRIGHT_TEXT;
    ctx.font = font(800, 11);
    ctx.fillText(`+${collected.length - shown.length}`, x, PROGRESS.y + 0.5);
  }
}

export function drawHud(ctx, view, p) {
  const { level, state, lives, bannerAge, biomeIndex, building } = view;
  const maxLives = view.maxLives ?? MAX_LIVES;
  drawProgress(ctx, view.collected ?? [], biomeIndex ?? 0);
  ctx.textBaseline = 'top';
  ctx.font = font(600, 14);
  ctx.fillStyle = p.dim;
  ctx.textAlign = 'right';
  if (view.fps) ctx.fillText(`${view.fps} fps`, WIDTH - 14, 12);
  ctx.font = font(700, 18);
  for (let i = 0; i < maxLives; i++) {
    ctx.fillStyle = i < lives ? p.hazard : alpha(p.dim, 0.35);
    ctx.fillText('♥', WIDTH - 70 - (maxLives - 1 - i) * 20, 9);
  }
  if (view.points !== undefined) {
    ctx.fillStyle = COIN_COLOR;
    ctx.beginPath(); ctx.arc(WIDTH - 70 - maxLives * 20 - 58, 20, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = p.text;
    ctx.font = font(700, 15);
    ctx.textAlign = 'left';
    ctx.fillText(`${view.points}`, WIDTH - 70 - maxLives * 20 - 48, 12);
    ctx.textAlign = 'right';
    if (view.runes !== undefined) {
      const rx = runeX(maxLives);
      drawRune(ctx, rx, 20, 8);
      ctx.fillStyle = p.text;
      ctx.font = font(700, 15);
      ctx.textAlign = 'left';
      ctx.fillText(`${view.runes}`, rx + 10, 12);
      markTip(rx - 8, 8, 40, 24, RUNE_TIP);
      ctx.textAlign = 'right';
      if (view.skills) drawSkills(ctx, view.skills, maxLives);
    }
    if (view.doubled) { ctx.fillStyle = COIN_COLOR; ctx.font = font(800, 13); ctx.textAlign = 'left'; ctx.fillText('×2', WIDTH - 70 - maxLives * 20 - 48 + ctx.measureText(`${view.points}`).width + 6, 13); ctx.textAlign = 'right'; }
    if (view.inventory?.kinds.length) drawTrickInventory(ctx, view.inventory, p);
  }
  drawInventory(ctx, state, p, level.rules);
  drawShieldCharges(ctx, level.rules, state);
  if (view.toast && view.toast.age < view.toast.ms) {
    const { kind, text, age, ms } = view.toast;
    ctx.globalAlpha = Math.min(1, (ms - age) / 500, age / 150);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, 17);
    const width = ctx.measureText(text).width + (kind ? 60 : 36);
    ctx.fillStyle = 'hsl(240 25% 8% / 0.8)';
    roundRect(ctx, WIDTH / 2 - width / 2, HEIGHT - 70, width, 36, 10);
    ctx.fill();
    if (kind) drawItemIcon(ctx, kind, WIDTH / 2 - width / 2 + 22, HEIGHT - 52, 0.9);
    ctx.fillStyle = BRIGHT_TEXT;
    ctx.fillText(text, WIDTH / 2 + (kind ? 12 : 0), HEIGHT - 51);
    ctx.globalAlpha = 1;
  }
  const banner = Math.max(0, 1 - Math.max(0, bannerAge - 2600) / 700);
  if (banner > 0) {
    const slide = Math.min(1, bannerAge / 350);
    ctx.globalAlpha = banner * slide;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font(700, 15);
    ctx.fillStyle = p.dim;
    ctx.fillText(`${(biomeIndex * level.rows * 2).toLocaleString()} m`, WIDTH / 2, 112 + (1 - slide) * 20);
    ctx.fillStyle = p.text;
    ctx.font = font(800, 42);
    ctx.fillText(level.title, WIDTH / 2, 134 + (1 - slide) * 20);
    ctx.font = font(500, 18);
    mutatorsOf(level).forEach((mutator, i) => {
      const y = 192 + i * 26, x = WIDTH / 2 + BANNER_ICON / 2 + 4;
      ctx.fillStyle = EFFECT_COLORS[mutator.effect];
      ctx.fillText(mutator.title, x, y);
      const textW = ctx.measureText(mutator.title).width;
      drawMutatorIcon(ctx, mutator, x - textW / 2 - BANNER_ICON / 2 - 8, y + 9, BANNER_ICON);
      markTip(x - textW / 2 - BANNER_ICON - 8, y - 2, textW + BANNER_ICON + 8, 24, ruleTip(mutator.id));
    });
    ctx.globalAlpha = 1;
  } else if (level.title && !level.hall) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(600, 13);
    ctx.fillStyle = p.accent;
    const title = level.title.toUpperCase();
    ctx.fillText(title, PROGRESS.x, CORNER_Y);
    let x = PROGRESS.x + ctx.measureText(title).width + 14;
    for (const m of mutatorsOf(level)) {
      drawMutatorIcon(ctx, m, x + CORNER_ICON / 2, CORNER_Y, CORNER_ICON);
      ctx.fillStyle = EFFECT_COLORS[m.effect];
      ctx.fillText(m.title.toUpperCase(), x + CORNER_ICON + 5, CORNER_Y);
      const w = CORNER_ICON + 5 + ctx.measureText(m.title.toUpperCase()).width;
      markTip(x, CORNER_Y - 10, w, 20, ruleTip(m.id));
      x += w + 12;
    }
  }
  if (building) drawBuilding(ctx, building, 'generating the next biome', HEIGHT / 2 - 80, { text: p.text, dim: p.dim, accent: p.accent, track: alpha(p.dim, 0.25) });
}

const BAR_MARGIN = 12;

export function drawControls(ctx, bar, level, keys, p, muted, state) {
  ctx.fillStyle = 'hsl(240 20% 6%)';
  ctx.fillRect(0, HEIGHT, WIDTH, BAR_H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const capFont = font(700, 12), labelFont = font(600, 13);
  const cy = HEIGHT + BAR_H / 2;
  const key = `${state.boots}:${state.fuel > 0}:${state.arrows}:${state.teleports}:${onRope(level, state)}:${muted}`;
  if (bar.level !== level || bar.key !== key) {
    Object.assign(bar, { level, key, items: controlsFor(level, muted, state).map(item => {
      ctx.font = capFont;
      const caps = item.caps.map(cap => ({ cap, w: Math.max(22, ctx.measureText(cap).width + 12) }));
      ctx.font = labelFont;
      const labelW = ctx.measureText(item.label).width;
      return { ...item, caps, labelW, w: caps.reduce((sum, c) => sum + c.w + 4, 0) + 4 + labelW + (item.count === undefined ? 0 : COUNT.gap + COUNT.size) };
    }) });
  }
  const items = bar.items;
  const gap = 22;
  const total = items.reduce((sum, item) => sum + item.w, 0) + gap * (items.length - 1);
  const fit = Math.min(1, (WIDTH - 2 * BAR_MARGIN) / total);
  let x = (WIDTH - total) / 2;
  ctx.save();
  ctx.translate(WIDTH / 2, cy);
  ctx.scale(fit, fit);
  ctx.translate(-WIDTH / 2, -cy);
  for (const item of items) {
    const lit = item.input?.some(input => keys[input]);
    const color = item.special ? p.accent : 'hsl(240 10% 78%)';
    for (const { cap, w } of item.caps) {
      roundRect(ctx, x, cy - 11, w, 22, 5);
      ctx.fillStyle = lit ? color : 'hsl(240 15% 14%)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = item.special ? 1.5 : 1;
      ctx.stroke();
      ctx.font = capFont;
      ctx.fillStyle = lit ? 'hsl(240 20% 8%)' : color;
      ctx.textAlign = 'center';
      ctx.fillText(cap, x + w / 2, cy + 1);
      x += w + 4;
    }
    ctx.textAlign = 'left';
    ctx.font = labelFont;
    ctx.fillStyle = item.special ? p.accent : 'hsl(240 8% 62%)';
    ctx.fillText(item.label, x + 4, cy + 1);
    x += 4 + item.labelW;
    if (item.count !== undefined) {
      x += COUNT.gap;
      ctx.fillStyle = item.count > 0 ? color : 'hsl(240 10% 30%)';
      ctx.beginPath(); ctx.arc(x + COUNT.size / 2, cy, COUNT.size / 2, 0, TAU); ctx.fill();
      ctx.font = capFont;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'hsl(240 20% 8%)';
      ctx.fillText(item.count, x + COUNT.size / 2, cy + 1);
      x += COUNT.size;
    }
    x += gap;
  }
  ctx.restore();
}

function drawTrickInventory(ctx, { kinds, counts, active }, p) {
  kinds.forEach((kind, i) => {
    const left = SLOT.right - (kinds.length - i) * (SLOT.size + SLOT.gap) + SLOT.gap, selected = kind === active;
    roundRect(ctx, left, SLOT.y, SLOT.size, SLOT.size, 8);
    ctx.fillStyle = selected ? p.accentSoft : 'hsl(240 25% 10% / 0.75)';
    ctx.fill();
    ctx.strokeStyle = selected ? p.accent : alpha(p.dim, 0.5);
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    drawTrickIcon(ctx, p, kind, left + SLOT.size / 2, SLOT.y + SLOT.size / 2, 0.85);
    if (counts[i] > 1) {
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(left + SLOT.size - 4, SLOT.y + 4, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'hsl(240 30% 8%)';
      ctx.font = font(800, 10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${counts[i]}`, left + SLOT.size - 4, SLOT.y + 4.5);
    }
  });
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = font(600, 11);
  ctx.fillStyle = active ? p.accent : p.dim;
  ctx.fillText(active ? `${TRICKS[active].title.toUpperCase()} · CLICK TO BUILD · TAB NEXT · B DONE` : 'B · BUILD', SLOT.right, SLOT.y + SLOT.size + 5);
}

export function drawQuitPrompt(ctx, view, p) {
  veil(ctx, 'hsl(240 30% 4% / 0.7)');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.font = font(800, 34);
  ctx.fillText('Paused', WIDTH / 2, HEIGHT / 2 - 62);
  ctx.fillStyle = 'hsl(240 10% 75%)';
  ctx.font = font(600, 17);
  ctx.fillText(`Leaving ends this climb. You are at ${view.altitude.toLocaleString()} m.`, WIDTH / 2, HEIGHT / 2 - 18);
  const buttons = [['Stay', 'Esc', promptX(0), p.accent, 'hsl(240 20% 8%)'], ['Restart level', 'R', promptX(1), 'hsl(240 15% 18%)', BRIGHT_TEXT], ['Leave', 'Enter', promptX(2), 'hsl(240 15% 18%)', BRIGHT_TEXT]];
  for (const [label, key, x, fill, text] of buttons) {
    roundRect(ctx, x, PROMPT.y, PROMPT.w, PROMPT.h, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = text;
    ctx.font = font(700, 17);
    ctx.fillText(label, x + PROMPT.w / 2, PROMPT.y + PROMPT.h / 2 - 7);
    ctx.font = font(600, 11);
    ctx.globalAlpha = 0.7;
    ctx.fillText(key, x + PROMPT.w / 2, PROMPT.y + PROMPT.h / 2 + 12);
    ctx.globalAlpha = 1;
  }
}

export function drawPerfect(ctx, { age, ms }) {
  const pop = Math.min(1, age / 260), leave = Math.min(1, (ms - age) / 500);
  const scale = 1.7 - 0.7 * (1 - (1 - pop) ** 3), wobble = Math.sin(age / 90) * 0.03;
  ctx.save();
  ctx.globalAlpha = Math.min(pop * 1.5, leave);
  ctx.translate(WIDTH / 2, HEIGHT * 0.34);
  ctx.rotate(wobble);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(900, 64);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.85)';
  ctx.strokeText('PERFECT', 0, 0);
  ctx.shadowColor = COIN_COLOR;
  ctx.shadowBlur = 24;
  ctx.fillStyle = COIN_COLOR;
  ctx.fillText('PERFECT', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawGameOver(ctx) {
  veil(ctx, 'hsl(240 30% 4% / 0.78)');
}

export function drawLoading(ctx, building) {
  ctx.fillStyle = 'hsl(240 25% 5%)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT + BAR_H);
  drawBuilding(ctx, building, 'building the climb', HEIGHT / 2 - 30, { text: 'hsl(240 10% 92%)', dim: 'hsl(240 10% 60%)', accent: 'hsl(345 95% 62%)', track: 'hsl(240 15% 16%)' });
}

const LEVEL_UP = { h: 84, y: HEIGHT - 176, fade: 450, icon: 46, gap: 22, pad: 28 };

const spaced = text => text.split(' ').map(word => [...word].join(' ')).join('   ');

const drawCoin = (ctx, x, y) => { ctx.fillStyle = COIN_COLOR; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); };

const levelUpEntries = (ids, { runes, gold }, raced) => [
  { title: `+${runes} rune${runes > 1 ? 's' : ''}`, sub: raced ? 'doubled, perfect' : ids.length ? 'biome cleared' : 'for the climb', color: RUNE_COLOR, tip: RUNE_TIP, icon: (ctx, x, y) => drawRune(ctx, x, y, 11) },
  { title: `+${gold} gold`, sub: raced ? 'doubled, perfect' : 'for the climb', color: COIN_COLOR, tip: null, icon: drawCoin },
  ...ids.map(mutatorById).map(rule => ({
    title: rule.title, sub: rule.effect === 'bane' ? 'bane beaten' : 'boon won', color: EFFECT_COLORS[rule.effect], tip: ruleTip(rule.id),
    icon: (ctx, x, y) => drawMutatorIcon(ctx, rule, x, y, 28),
  })),
];

export function drawLevelUp(ctx, { ids, reward, raced, age, ms }) {
  const entries = levelUpEntries(ids, reward, raced);
  ctx.font = font(800, 14);
  const widths = entries.map(entry => LEVEL_UP.icon + Math.max(76, ctx.measureText(entry.title).width));
  const content = widths.reduce((sum, w) => sum + w, 0) + LEVEL_UP.gap * (entries.length - 1);
  const w = Math.max(220, content + 2 * LEVEL_UP.pad), x = WIDTH / 2 - w / 2;
  const enter = Math.min(1, age / 300), leave = Math.min(1, (ms - age) / LEVEL_UP.fade);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(enter, leave));
  ctx.translate(0, (1 - enter) * 24);
  roundRect(ctx, x, LEVEL_UP.y, w, LEVEL_UP.h, 18);
  ctx.fillStyle = 'hsl(240 26% 9% / 0.92)';
  ctx.fill();
  ctx.strokeStyle = alpha(COIN_COLOR, 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COIN_COLOR;
  ctx.font = font(900, 13);
  ctx.fillText(spaced(ids.length ? 'LEVEL UP' : 'BIOME CLEARED'), WIDTH / 2, LEVEL_UP.y + 18);
  let left = WIDTH / 2 - content / 2;
  entries.forEach((entry, i) => {
    const cx = left + 19, cy = LEVEL_UP.y + 52, pulse = 1 + 0.12 * Math.sin(age / 220 + i);
    ctx.fillStyle = alpha(entry.color, 0.22);
    ctx.beginPath(); ctx.arc(cx, cy, 19 * pulse, 0, TAU); ctx.fill();
    entry.icon(ctx, cx, cy);
    ctx.textAlign = 'left';
    ctx.fillStyle = entry.color;
    ctx.font = font(800, 14);
    ctx.fillText(entry.title, left + LEVEL_UP.icon, cy - 7);
    ctx.fillStyle = 'hsl(240 10% 72%)';
    ctx.font = font(600, 11);
    ctx.fillText(entry.sub, left + LEVEL_UP.icon, cy + 10);
    markTip(left, cy - 22, widths[i], 44, entry.tip);
    left += widths[i] + LEVEL_UP.gap;
  });
  ctx.restore();
}
