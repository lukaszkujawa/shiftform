import { WIDTH, HEIGHT } from './level.js?v=5f043fa';
import { OUTFIT_ROWS, outfitOf, wear } from './avatar.js?v=5f043fa';
import { playerSize } from './physics.js?v=5f043fa';
import { drawPlayer } from './player-art.js?v=5f043fa';
import { BRIGHT_TEXT } from './icons.js?v=5f043fa';
import { TAU, font, roundRect, veil } from './paint.js?v=5f043fa';

const STORAGE_KEY = 'shiftform:outfit';
const PANEL = { w: 600, h: 340, x: (WIDTH - 600) / 2, y: (HEIGHT - 340) / 2 };
const MIRROR = { x: PANEL.x + 140, y: PANEL.y + 180, rx: 92, ry: 122, zoom: 3.6 };
const ROW = { x: PANEL.x + 268, y: PANEL.y + 64, w: 300, h: 56, box: 30 };
const DONE = { w: 96, h: 32, x: PANEL.x + PANEL.w - 128, y: PANEL.y + PANEL.h - 50 };
const TINT_NAMES = ['Peach', 'Mint', 'Lilac', 'Lemon', 'Sky', 'Rose', 'Apricot'];
const NAMES = { tophat: 'Top hat', party: 'Party hat' };
const DIM = 'hsl(240 10% 72%)';
const WOOD = 'hsl(26 48% 40%)';

export function loadOutfit() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && OUTFIT_ROWS.every(({ key, options }) => options.includes(saved[key])) ? saved : null;
  } catch {
    return null;
  }
}

export function saveOutfit(outfit) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(outfit)); } catch {}
}

export const openWardrobe = avatar => ({ row: 0, outfit: outfitOf(avatar) });

export function browse(dressing, rowStep, optionStep) {
  const row = (dressing.row + rowStep + OUTFIT_ROWS.length) % OUTFIT_ROWS.length;
  const { key, options } = OUTFIT_ROWS[row];
  const at = options.indexOf(dressing.outfit[key]);
  return { row, outfit: { ...dressing.outfit, [key]: options[(at + optionStep + options.length) % options.length] } };
}

export function wardrobeHit(x, y) {
  if (x >= DONE.x && x <= DONE.x + DONE.w && y >= DONE.y && y <= DONE.y + DONE.h) return 'done';
  if (x < PANEL.x || x > PANEL.x + PANEL.w || y < PANEL.y || y > PANEL.y + PANEL.h) return 'done';
  const row = Math.floor((y - ROW.y) / ROW.h);
  if (row < 0 || row >= OUTFIT_ROWS.length || x < ROW.x || x > ROW.x + ROW.w) return null;
  const third = (x - ROW.x) / ROW.w;
  return { row, step: third < 1 / 3 ? -1 : third > 2 / 3 ? 1 : 0 };
}

function label(row, value) {
  if (row.key === 'tint') return value ? TINT_NAMES[row.options.indexOf(value) - 1] : 'Biome colour';
  if (!value) return 'None';
  return NAMES[value] ?? value[0].toUpperCase() + value.slice(1);
}

function drawMirror(ctx, view, p, theme) {
  const { w, h } = playerSize(view.level.rules);
  const preview = { ...view.avatar, ...wear(view.wardrobe.outfit), squash: 0, lean: 0, sway: 0, joy: 1, still: 0, blink: 0, lookX: 0, lookY: 0 };
  const pose = { ...view.state, x: -w / 2, y: -h / 2, vx: 0, vy: 0, gravDir: 1, grounded: true, facing: 1, flipFrame: -1e9, charge: 0, dashTimer: 0, comet: 0 };
  ctx.fillStyle = WOOD;
  ctx.beginPath(); ctx.ellipse(MIRROR.x, MIRROR.y, MIRROR.rx + 12, MIRROR.ry + 12, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(MIRROR.x, MIRROR.y, MIRROR.rx, MIRROR.ry, 0, 0, TAU); ctx.clip();
  const glass = ctx.createLinearGradient(MIRROR.x - MIRROR.rx, MIRROR.y - MIRROR.ry, MIRROR.x + MIRROR.rx, MIRROR.y + MIRROR.ry);
  glass.addColorStop(0, 'hsl(200 45% 86%)');
  glass.addColorStop(1, 'hsl(215 35% 62%)');
  ctx.fillStyle = glass;
  ctx.fillRect(MIRROR.x - MIRROR.rx, MIRROR.y - MIRROR.ry, MIRROR.rx * 2, MIRROR.ry * 2);
  ctx.strokeStyle = 'hsl(0 0% 100% / 0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(MIRROR.x - 70, MIRROR.y - 40); ctx.lineTo(MIRROR.x - 20, MIRROR.y - 100); ctx.moveTo(MIRROR.x - 66, MIRROR.y - 6); ctx.lineTo(MIRROR.x - 2, MIRROR.y - 86); ctx.stroke();
  ctx.translate(MIRROR.x, MIRROR.y + 24);
  ctx.scale(MIRROR.zoom, MIRROR.zoom);
  drawPlayer(ctx, p, theme, view.level, pose, 1, preview);
  ctx.restore();
}

function drawRows(ctx, dressing, p) {
  OUTFIT_ROWS.forEach((row, i) => {
    const y = ROW.y + i * ROW.h, chosen = i === dressing.row, value = dressing.outfit[row.key];
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = font(700, 12);
    ctx.fillText(row.title.toUpperCase(), ROW.x + 4, y + 6);
    roundRect(ctx, ROW.x, y + 14, ROW.w, ROW.box, ROW.box / 2);
    ctx.fillStyle = chosen ? p.accent : 'hsl(240 15% 20%)';
    ctx.fill();
    ctx.fillStyle = chosen ? 'hsl(240 20% 8%)' : BRIGHT_TEXT;
    ctx.textAlign = 'center';
    ctx.font = font(800, 15);
    ctx.fillText('◀', ROW.x + 18, y + 29);
    ctx.fillText('▶', ROW.x + ROW.w - 18, y + 29);
    ctx.font = font(700, 15);
    const text = label(row, value);
    ctx.fillText(text, ROW.x + ROW.w / 2 + (row.key === 'tint' ? 9 : 0), y + 29);
    if (row.key !== 'tint') return;
    ctx.fillStyle = value ?? p.player;
    ctx.beginPath(); ctx.arc(ROW.x + ROW.w / 2 - ctx.measureText(text).width / 2 - 6, y + 29, 7, 0, TAU); ctx.fill();
  });
}

export function drawWardrobe(ctx, view, p, theme) {
  veil(ctx, 'hsl(240 30% 4% / 0.72)');
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 22);
  ctx.fillStyle = 'hsl(240 22% 11% / 0.96)';
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.font = font(800, 24);
  ctx.fillText('Wardrobe', ROW.x, PANEL.y + 32);
  drawMirror(ctx, view, p, theme);
  drawRows(ctx, view.wardrobe, p);
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = font(600, 12);
  ctx.fillText('↑ ↓ choose  ·  ← → change', ROW.x, DONE.y + DONE.h / 2);
  roundRect(ctx, DONE.x, DONE.y, DONE.w, DONE.h, DONE.h / 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.fillStyle = 'hsl(240 20% 8%)';
  ctx.textAlign = 'center';
  ctx.font = font(800, 14);
  ctx.fillText('Done', DONE.x + DONE.w / 2, DONE.y + DONE.h / 2);
}
