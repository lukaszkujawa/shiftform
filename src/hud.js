import { WIDTH, HEIGHT, levelIndex } from './level.js?v=a3cd24e';
import { TRICKS, TRICK_COST } from './tricks.js?v=a3cd24e';
import { JETPACK_FUEL } from './physics.js?v=a3cd24e';
import { MAX_LIVES } from './climb.js?v=a3cd24e';
import { alpha } from './themes.js?v=a3cd24e';
import { ITEM_COLORS, COIN_COLOR, BRIGHT_TEXT, drawItemIcon, drawTrickIcon } from './icons.js?v=a3cd24e';
import { TAU, font, roundRect, strokeDashed, veil } from './paint.js?v=a3cd24e';

export const BAR_H = 40;
const CARD = { w: 250, h: 190, gap: 24, y: 140 };
const KEEP = { w: 300, h: 44, y: 370 };
const PROMPT = { w: 200, h: 48, y: HEIGHT / 2 + 38, gap: 24 };
const SLOT = { size: 34, gap: 6, y: 62, right: WIDTH - 14 };
const SHOP_DIM = 'hsl(240 10% 72%)';

function jumpExtras(rules) {
  return [
    rules.flipOnJump && 'flips gravity',
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

export function shopHit(x, y) {
  const left = WIDTH / 2 - (3 * CARD.w + 2 * CARD.gap) / 2;
  if (y >= KEEP.y && y <= KEEP.y + KEEP.h && Math.abs(x - WIDTH / 2) <= KEEP.w / 2) return 0;
  if (y < CARD.y || y > CARD.y + CARD.h) return null;
  for (let i = 0; i < 3; i++) { const cx = left + i * (CARD.w + CARD.gap); if (x >= cx && x <= cx + CARD.w) return i + 1; }
  return null;
}

function wrapText(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  return [...lines, line];
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

export function drawHud(ctx, view, p) {
  const { level, state, lives, seed, bannerAge, biomeIndex, building } = view;
  const maxLives = view.maxLives ?? MAX_LIVES;
  ctx.textBaseline = 'top';
  ctx.font = font(600, 14);
  ctx.fillStyle = p.dim;
  ctx.textAlign = 'left';
  ctx.fillText(`seed ${seed}  ·  biome ${biomeIndex + 1}`, 14, 12);
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
    ctx.font = font(700, 15);
    ctx.fillStyle = p.dim;
    ctx.fillText(`${(biomeIndex * level.rows * 2).toLocaleString()} m`, WIDTH / 2, 112 + (1 - slide) * 20);
    ctx.fillStyle = p.text;
    ctx.font = font(800, 42);
    ctx.fillText(level.title, WIDTH / 2, 134 + (1 - slide) * 20);
    ctx.font = font(500, 18);
    ctx.fillStyle = p.accent;
    level.hints.forEach((hint, i) => ctx.fillText(hint, WIDTH / 2, 192 + i * 26));
    ctx.globalAlpha = 1;
  } else if (level.hints.length) {
    ctx.textAlign = 'left';
    ctx.font = font(600, 13);
    ctx.fillStyle = p.accent;
    ctx.fillText(level.title.toUpperCase(), 14, 34);
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

export function drawShop(ctx, view, p) {
  const { offer, bought, affordable } = view.shop;
  veil(ctx, 'hsl(240 30% 4% / 0.72)');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.font = font(800, 30);
  ctx.fillText('Gate shop', WIDTH / 2, 64);
  ctx.font = font(600, 15);
  ctx.fillStyle = SHOP_DIM;
  ctx.fillText(`${view.points} points · 1, 2, 3 or click to buy`, WIDTH / 2, 100);
  const left = WIDTH / 2 - (3 * CARD.w + 2 * CARD.gap) / 2;
  offer.forEach((kind, i) => {
    const x = left + i * (CARD.w + CARD.gap), y = CARD.y, sold = bought.includes(kind), open = affordable[i] && !sold;
    ctx.save();
    if (!open) ctx.globalAlpha = 0.5;
    roundRect(ctx, x, y, CARD.w, CARD.h, 14);
    ctx.fillStyle = 'hsl(240 25% 10% / 0.92)';
    ctx.fill();
    ctx.strokeStyle = open ? p.accent : alpha(p.dim, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, x + 12, y + 12, 26, 26, 8);
    ctx.fillStyle = open ? p.accent : p.dim;
    ctx.fill();
    ctx.fillStyle = 'hsl(240 30% 8%)';
    ctx.font = font(800, 15);
    ctx.fillText(`${i + 1}`, x + 25, y + 26);
    drawTrickIcon(ctx, p, kind, x + CARD.w / 2, y + 60);
    ctx.fillStyle = BRIGHT_TEXT;
    ctx.font = font(800, 19);
    ctx.fillText(TRICKS[kind].title, x + CARD.w / 2, y + 108);
    ctx.fillStyle = SHOP_DIM;
    ctx.font = font(500, 13);
    wrapText(ctx, TRICKS[kind].text, CARD.w - 30).forEach((line, k) => ctx.fillText(line, x + CARD.w / 2, y + 132 + k * 16));
    ctx.restore();
    ctx.font = font(800, 13);
    ctx.textAlign = 'right';
    if (sold) { ctx.fillStyle = p.accent; ctx.fillText('BOUGHT', x + CARD.w - 14, y + 25); }
    else {
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath(); ctx.arc(x + CARD.w - 14 - ctx.measureText(`${TRICK_COST}`).width - 10, y + 25, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = affordable[i] ? BRIGHT_TEXT : p.hazard;
      ctx.fillText(`${TRICK_COST}`, x + CARD.w - 14, y + 25);
    }
    ctx.textAlign = 'center';
  });
  roundRect(ctx, WIDTH / 2 - KEEP.w / 2, KEEP.y, KEEP.w, KEEP.h, 12);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.fillStyle = 'hsl(240 30% 8%)';
  ctx.font = font(800, 16);
  ctx.fillText('EXIT', WIDTH / 2, KEEP.y + KEEP.h / 2);
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
