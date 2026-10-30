import { WIDTH, HEIGHT, levelIndex } from './level.js?v=9c9592d';
import { TRICKS } from './tricks.js?v=9c9592d';
import { JETPACK_FUEL } from './physics.js?v=9c9592d';
import { MAX_LIVES } from './climb.js?v=9c9592d';
import { GEAR_SLOTS, TIERS, tierOf } from './outfitter.js?v=9c9592d';
import { mutatorById, isBane } from './rules.js?v=9c9592d';
import { drawMutatorIcon, EFFECT_COLORS } from './mutator-icons.js?v=9c9592d';
import { alpha } from './themes.js?v=9c9592d';
import { ITEM_COLORS, COIN_COLOR, RUNE_COLOR, BRIGHT_TEXT, drawItemIcon, drawTrickIcon, drawRune } from './icons.js?v=9c9592d';
import { TAU, font, roundRect, strokeDashed, veil } from './paint.js?v=9c9592d';
import { markTip, ruleTip, RUNE_TIP } from './tooltip.js?v=9c9592d';

export const BAR_H = 40;
const PROMPT = { w: 200, h: 48, y: HEIGHT / 2 + 38, gap: 24 };
const SLOT = { size: 34, gap: 6, y: 62, right: WIDTH - 14 };
const BANNER_ICON = 20;
const CORNER_ICON = 15;
const mutatorsOf = level => (level.mutators ?? []).filter(isBane).map(mutatorById);

function jumpExtras(rules) {
  return [
    rules.jumpFlipChance && 'may flip gravity',
    rules.blinkJump && 'teleports up',
    rules.jumps > 1 && `${rules.jumps}× in air`,
    rules.wallJump && 'off walls',
    rules.glide && 'hold to glide',
    rules.jumpBudget && `${rules.jumpBudget} total`,
  ].filter(Boolean);
}

function controlsFor(level, muted = false, state = null) {
  const r = level.rules, index = levelIndex(level);
  const jump = jumpExtras(r);
  const grab = [index.crates.length && 'lift · throw crate', index.hooks.length && 'grab hook'].filter(Boolean);
  return [
    r.mirror && { caps: ['←', '→'], label: 'move (reversed!)', input: ['left', 'right'], special: true },
    jump.length && { caps: ['Z'], label: ['jump', ...jump].join(' · '), input: ['jump'], special: true },
    r.dash && { caps: ['X'], label: 'dash', input: ['dash'], special: true },
    grab.length && { caps: ['F'], label: grab.join(' · '), input: ['interact'], special: true },
    index.climbs.length && { caps: ['↑', '↓'], label: 'climb', input: ['up', 'down'], special: true },
    state?.boots > 0 && { caps: ['Z'], label: `in air · boots ×${state.boots}`, input: ['jump'], special: true },
    state?.fuel > 0 && { caps: ['Z'], label: 'in air · jetpack', input: ['jump'], special: true },
    state?.arrows > 0 && { caps: ['V'], label: `shoot ×${state.arrows}`, special: true },
    { caps: ['R'], label: 'back to checkpoint' },
    { caps: ['H'], label: 'hint' },
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

export function promptHit(x, y) {
  if (y < PROMPT.y || y > PROMPT.y + PROMPT.h) return null;
  if (x >= WIDTH / 2 - PROMPT.gap / 2 - PROMPT.w && x <= WIDTH / 2 - PROMPT.gap / 2) return 'stay';
  if (x >= WIDTH / 2 + PROMPT.gap / 2 && x <= WIDTH / 2 + PROMPT.gap / 2 + PROMPT.w) return 'leave';
  return null;
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

function drawInventory(ctx, state, p) {
  let x = WIDTH - 180;
  if (state.fuel > 0) {
    drawItemIcon(ctx, 'jetpack', x, 44, 0.8);
    ctx.fillStyle = 'hsl(240 20% 10% / 0.6)';
    ctx.fillRect(x + 12, 40, 50, 8);
    ctx.fillStyle = ITEM_COLORS.jetpack;
    ctx.fillRect(x + 12, 40, 50 * (state.fuel / JETPACK_FUEL), 8);
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
const GEAR = { gap: 30, step: 24, icon: 18, y: 20, socket: 'hsl(240 30% 8% / 0.45)', rim: 'hsl(0 0% 100% / 0.55)', given: 'hsl(0 85% 62% / 1)' };

const runeX = maxLives => WIDTH - 70 - maxLives * 20 - 58 - RUNE_GAP;
const gearX = (maxLives, k) => runeX(maxLives) - GEAR.gap - (GEAR_SLOTS - 1 - k) * GEAR.step;

export function gearHit(x, y, maxLives) {
  if (Math.abs(y - GEAR.y) > GEAR.step / 2) return null;
  const k = Array.from({ length: GEAR_SLOTS }, (_, i) => i).find(i => Math.abs(x - gearX(maxLives, i)) <= GEAR.step / 2);
  return k ?? null;
}

function drawGear(ctx, gear, maxLives, giving) {
  for (let k = 0; k < GEAR_SLOTS; k++) {
    const x = gearX(maxLives, k), piece = gear[k];
    if (!piece) {
      ctx.fillStyle = GEAR.socket;
      ctx.beginPath(); ctx.arc(x, GEAR.y, GEAR.icon / 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = GEAR.rim;
      ctx.lineWidth = 1.5;
      strokeDashed(ctx, [3, 3], () => { ctx.beginPath(); ctx.arc(x, GEAR.y, GEAR.icon / 2, 0, TAU); });
      continue;
    }
    ctx.globalAlpha = piece.active ? 1 : 0.35;
    ctx.strokeStyle = TIERS[tierOf(piece.id)].color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, GEAR.y, GEAR.icon / 2 + 2, 0, TAU); ctx.stroke();
    drawMutatorIcon(ctx, mutatorById(piece.id), x, GEAR.y, GEAR.icon);
    ctx.globalAlpha = 1;
    if (k === giving) drawGivenUp(ctx, x);
    markTip(x - GEAR.step / 2, GEAR.y - GEAR.step / 2, GEAR.step, GEAR.step, ruleTip(piece.id));
  }
}

function drawGivenUp(ctx, x) {
  ctx.strokeStyle = GEAR.given;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, GEAR.y, GEAR.icon / 2 + 4, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, GEAR.y + 7); ctx.lineTo(x + 7, GEAR.y - 7); ctx.stroke();
}

function drawProgress(ctx, collected) {
  ctx.font = font(900, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = `LV ${collected.length + 1}`, w = ctx.measureText(text).width + 16;
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
  drawProgress(ctx, view.collected ?? []);
  ctx.textBaseline = 'top';
  ctx.font = font(600, 14);
  ctx.fillStyle = p.dim;
  ctx.textAlign = 'right';
  ctx.fillText(`${(state.frame / 60).toFixed(1)}s`, WIDTH - 14, 12);
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
      if (view.gear) drawGear(ctx, view.gear, maxLives, view.giving);
    }
    if (view.doubled) { ctx.fillStyle = COIN_COLOR; ctx.font = font(800, 13); ctx.textAlign = 'left'; ctx.fillText('×2', WIDTH - 70 - maxLives * 20 - 48 + ctx.measureText(`${view.points}`).width + 6, 13); ctx.textAlign = 'right'; }
    if (view.inventory?.kinds.length) drawTrickInventory(ctx, view.inventory, p);
  }
  drawInventory(ctx, state, p);
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

export function drawControls(ctx, bar, level, keys, p, muted, state) {
  ctx.fillStyle = 'hsl(240 20% 6%)';
  ctx.fillRect(0, HEIGHT, WIDTH, BAR_H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const capFont = font(700, 12), labelFont = font(600, 13);
  const cy = HEIGHT + BAR_H / 2;
  const key = `${state.boots}:${state.fuel > 0}:${state.arrows}:${muted}`;
  if (bar.level !== level || bar.key !== key) {
    Object.assign(bar, { level, key, items: controlsFor(level, muted, state).map(item => {
      ctx.font = capFont;
      const caps = item.caps.map(cap => ({ cap, w: Math.max(22, ctx.measureText(cap).width + 12) }));
      ctx.font = labelFont;
      const labelW = ctx.measureText(item.label).width;
      return { ...item, caps, labelW, w: caps.reduce((sum, c) => sum + c.w + 4, 0) + 4 + labelW };
    }) });
  }
  const items = bar.items;
  const gap = 22;
  let x = (WIDTH - items.reduce((sum, item) => sum + item.w, 0) - gap * (items.length - 1)) / 2;
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
    x += 4 + item.labelW + gap;
  }
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
  ctx.fillText('Leave the climb?', WIDTH / 2, HEIGHT / 2 - 62);
  ctx.fillStyle = 'hsl(240 10% 75%)';
  ctx.font = font(600, 17);
  ctx.fillText(`Leaving ends this climb. You are at ${view.altitude.toLocaleString()} m.`, WIDTH / 2, HEIGHT / 2 - 18);
  const buttons = [['Stay', 'Esc', WIDTH / 2 - PROMPT.gap / 2 - PROMPT.w, p.accent, 'hsl(240 20% 8%)'], ['Leave', 'Enter', WIDTH / 2 + PROMPT.gap / 2, 'hsl(240 15% 18%)', BRIGHT_TEXT]];
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

export function drawGameOver(ctx, view, p) {
  veil(ctx, 'hsl(240 30% 4% / 0.78)');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.hazard;
  ctx.font = font(800, 46);
  ctx.fillText('Out of lives', WIDTH / 2, HEIGHT / 2 - 70);
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.font = font(800, 30);
  ctx.fillText(`You reached ${view.altitude.toLocaleString()} m`, WIDTH / 2, HEIGHT / 2 - 12);
  ctx.fillStyle = 'hsl(240 10% 75%)';
  ctx.font = font(600, 17);
  ctx.fillText(`best on this seed: ${view.best.toLocaleString()} m${view.points ? `  ·  ${view.points} points` : ''}`, WIDTH / 2, HEIGHT / 2 + 26);
  ctx.fillStyle = p.accent;
  ctx.font = font(700, 17);
  ctx.fillText('Enter or R to climb again  ·  Esc for the menu', WIDTH / 2, HEIGHT / 2 + 72);
}

export function drawLoading(ctx, building) {
  ctx.fillStyle = 'hsl(240 25% 5%)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT + BAR_H);
  drawBuilding(ctx, building, 'building the climb', HEIGHT / 2 - 30, { text: 'hsl(240 10% 92%)', dim: 'hsl(240 10% 60%)', accent: 'hsl(345 95% 62%)', track: 'hsl(240 15% 16%)' });
}

const LEVEL_UP = { h: 84, y: HEIGHT - 176, fade: 450, icon: 46, gap: 22, pad: 28 };

const spaced = text => text.split(' ').map(word => [...word].join(' ')).join('   ');

const levelUpEntries = (ids, runes) => [
  { title: `+${runes} rune`, sub: ids.length ? 'biome cleared' : 'for the climb', color: RUNE_COLOR, tip: RUNE_TIP, icon: (ctx, x, y) => drawRune(ctx, x, y, 11) },
  ...ids.map(mutatorById).map(rule => ({
    title: rule.title, sub: rule.effect === 'bane' ? 'bane beaten' : 'boon won', color: EFFECT_COLORS[rule.effect], tip: ruleTip(rule.id),
    icon: (ctx, x, y) => drawMutatorIcon(ctx, rule, x, y, 28),
  })),
];

export function drawLevelUp(ctx, { ids, runes, age, ms }) {
  const entries = levelUpEntries(ids, runes);
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
