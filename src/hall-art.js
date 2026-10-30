import { TILE, WIDTH } from './level.js?v=4a2bde0';
import { initialState, playerSize } from './physics.js?v=4a2bde0';
import { buildRules } from './rules.js?v=4a2bde0';
import { createAvatar } from './avatar.js?v=4a2bde0';
import { drawPlayer } from './player-art.js?v=4a2bde0';
import { MOUTH, HALL_CEILING, STALLS, MERCHANT, RULESMITH, OUTFITTER, DICER } from './tunnel.js?v=4a2bde0';
import { alpha } from './themes.js?v=4a2bde0';
import { styleOf } from './hall-styles.js?v=4a2bde0';
import { drawDie } from './icons.js?v=4a2bde0';
import { TAU, font, roundRect } from './paint.js?v=4a2bde0';

const LIGHT = 'hsl(40 30% 96% / 1)';
const DARK = 'hsl(235 35% 4% / 1)';
const STALL = { w: 58, h: 30, roof: 62, offset: 20 };
const KEEPER_OFFSET = -28;
const KEEPER_RULES = buildRules([]);
const PORTAL = { pillar: 12, course: 15, lintel: 12, stone: 17, overhang: 8 };
const KEEPERS = {
  [MERCHANT]: { sign: 'SHOP', outfit: { pattern: 'belly' } },
  [RULESMITH]: { sign: 'RULES', outfit: { pattern: 'stripes' } },
  [OUTFITTER]: { sign: 'GEAR', outfit: { pattern: 'spots' } },
  [DICER]: { sign: 'DICE', color: 'hsl(275 40% 52% / 1)', outfit: { pattern: null, tint: 'hsl(255 12% 42% / 1)', top: 'tophat', glasses: 'shades' } },
};
const COLOR_OF = { [MERCHANT]: 'shop', [RULESMITH]: 'rules', [OUTFITTER]: 'gear' };

function block(ctx, p, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 2.5);
  ctx.fillStyle = p.rock;
  ctx.fill();
  ctx.strokeStyle = alpha(DARK, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = alpha(p.rockEdge, 0.55);
  ctx.fillRect(x + 1.5, y + 1, w - 3, 2);
}

function drawMouth(ctx, p, floor, time) {
  const w = MOUTH.w * TILE, h = MOUTH.h * TILE, top = floor - h, open = w - PORTAL.pillar;
  const depth = ctx.createLinearGradient(open, 0, 0, 0);
  depth.addColorStop(0, alpha(DARK, 0.82));
  depth.addColorStop(1, alpha(DARK, 0.98));
  ctx.fillStyle = depth;
  ctx.fillRect(0, top, open, h);
  const light = ctx.createRadialGradient(0, floor - 12, 2, 0, floor - 12, 50);
  light.addColorStop(0, `hsl(38 100% 66% / ${0.26 + 0.05 * Math.sin(time / 420)})`);
  light.addColorStop(1, 'hsl(38 100% 60% / 0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, top, open, h);
  for (const [x, shade] of [[open * 0.66, 0.5], [open * 0.28, 0.28]]) {
    ctx.fillStyle = alpha(p.rockDeep, shade);
    ctx.fillRect(x - 2.5, top + 4, 5, h - 4);
    ctx.fillRect(x - 9, top + 4, 18, 4);
  }
  ctx.fillStyle = alpha(p.rockEdge, 0.2);
  ctx.fillRect(0, floor - 3, open, 3);
  for (let i = 0; i < 4; i++) {
    const t = (time / 2600 + i / 4) % 1;
    ctx.fillStyle = `hsl(40 100% 80% / ${(1 - t) * 0.55})`;
    ctx.beginPath(); ctx.arc(open * (1 - t) * 0.9, floor - 10 - i * 10 + Math.sin(t * TAU + i) * 3, 1.3, 0, TAU); ctx.fill();
  }
  for (let y = floor - PORTAL.course; y > top - 1; y -= PORTAL.course) block(ctx, p, open, y, PORTAL.pillar, PORTAL.course);
  block(ctx, p, open - 2, floor - 5, PORTAL.pillar + 4, 5);
  block(ctx, p, open - 3, top - 2, PORTAL.pillar + 6, 6);
  const lintel = top - PORTAL.lintel;
  for (let x = -6, k = 0; x < w + PORTAL.overhang; x += PORTAL.stone, k++) block(ctx, p, x, lintel + (k % 2), Math.min(PORTAL.stone, w + PORTAL.overhang - x), PORTAL.lintel - (k % 2));
  const key = { x: w / 2 - 9, y: lintel - 4, w: 18, h: PORTAL.lintel + 6 };
  block(ctx, p, key.x, key.y, key.w, key.h);
  ctx.fillStyle = alpha(p.accent, 0.65 + 0.35 * Math.sin(time / 350));
  ctx.beginPath(); ctx.moveTo(key.x + 5, key.y + key.h / 2); ctx.lineTo(key.x + 12, key.y + key.h / 2 - 5); ctx.lineTo(key.x + 12, key.y + key.h / 2 + 5); ctx.closePath(); ctx.fill();
  const flicker = 1 + 0.12 * Math.sin(time / 90) * Math.sin(time / 37), lx = w + 7, ly = top + 10;
  ctx.strokeStyle = alpha(DARK, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(w + PORTAL.overhang - 3, lintel + PORTAL.lintel); ctx.lineTo(lx, ly); ctx.stroke();
  const halo = ctx.createRadialGradient(lx, ly + 7, 1, lx, ly + 7, 22 * flicker);
  halo.addColorStop(0, alpha(p.accent, 0.4));
  halo.addColorStop(1, alpha(p.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(lx - 24, ly - 16, 48, 48);
  roundRect(ctx, lx - 4, ly, 8, 11, 3);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.fillStyle = alpha(DARK, 0.8);
  ctx.fillRect(lx - 5, ly - 1, 10, 2);
}

export function drawMouths(ctx, level, p, time) {
  const floor = (level.rows - 1) * TILE;
  drawMouth(ctx, p, floor, time);
  ctx.save();
  ctx.translate(WIDTH, 0);
  ctx.scale(-1, 1);
  drawMouth(ctx, p, floor, time);
  ctx.restore();
}

function drawStall(ctx, p, keeper, cx, floor) {
  const left = cx - STALL.w / 2, roof = floor - STALL.roof;
  ctx.fillStyle = alpha(p.rockEdge, 0.75);
  ctx.fillRect(left + 3, roof + 10, 4, STALL.roof - 10);
  ctx.fillRect(left + STALL.w - 7, roof + 10, 4, STALL.roof - 10);
  roundRect(ctx, left, floor - STALL.h, STALL.w, STALL.h, 4);
  ctx.fillStyle = p.rockDeep;
  ctx.fill();
  ctx.fillStyle = alpha(LIGHT, 0.14);
  ctx.fill();
  ctx.fillStyle = keeper.color;
  ctx.fillRect(left - 3, floor - STALL.h - 4, STALL.w + 6, 5);
  for (let i = 0; i < 4; i++) {
    const x = left - 3 + (i * (STALL.w + 6)) / 4, w = (STALL.w + 6) / 4;
    ctx.fillStyle = i % 2 ? LIGHT : keeper.color;
    ctx.beginPath(); ctx.moveTo(x, roof); ctx.lineTo(x + w, roof); ctx.lineTo(x + w, roof + 10); ctx.quadraticCurveTo(x + w / 2, roof + 16, x, roof + 10); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = keeper.color;
  ctx.font = font(800, 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(keeper.sign, cx, roof - 9);
}

function drawKeeper(ctx, p, theme, hall, keeper, x, floor, player, time) {
  const stage = { ...hall, rules: KEEPER_RULES }, { w, h } = playerSize(KEEPER_RULES), toward = Math.sign(player.x + w / 2 - x) || 1, near = Math.abs(player.x + w / 2 - x) < 90;
  const pose = { ...initialState(stage), x: x - w / 2, y: floor - h, facing: toward, frame: Math.floor(time / 16) };
  const look = { ...createAvatar('', keeper.outfit), lookX: toward, joy: near ? 1 : 0, sway: Math.sin(time / 700) * 0.3, squash: Math.sin(time / 450) * 0.04 };
  drawPlayer(ctx, p, theme, stage, pose, 1, look);
}

function drawProp(ctx, id, x, floor, time) {
  const bob = Math.sin(time / 500) * 1.2;
  if (id === DICER) {
    drawDie(ctx, x + 13, floor - 11 + bob, 9, Math.floor(time / 600) % 6);
    return;
  }
  if (id === MERCHANT) {
    roundRect(ctx, x + 8, floor - 15 + bob, 11, 12, 5);
    ctx.fillStyle = 'hsl(45 90% 55% / 1)';
    ctx.fill();
    ctx.fillStyle = 'hsl(30 60% 30% / 1)';
    ctx.fillRect(x + 10, floor - 16 + bob, 7, 2);
    ctx.fillStyle = 'hsl(30 60% 30% / 1)';
    ctx.font = font(900, 7);
    ctx.fillText('$', x + 13.5, floor - 8 + bob);
    return;
  }
  if (id === OUTFITTER) {
    ctx.fillStyle = 'hsl(140 70% 55% / 1)';
    ctx.beginPath(); ctx.arc(x + 12, floor - 9 + bob, 6, 0, TAU); ctx.fill();
    ctx.fillRect(x + 10, floor - 19 + bob, 4, 6);
    ctx.fillStyle = 'hsl(30 40% 45% / 1)';
    ctx.fillRect(x + 9.5, floor - 21 + bob, 5, 3);
    ctx.fillStyle = 'hsl(0 0% 100% / 0.6)';
    ctx.beginPath(); ctx.arc(x + 10, floor - 11 + bob, 1.6, 0, TAU); ctx.fill();
    return;
  }
  ctx.fillStyle = 'hsl(45 50% 88% / 1)';
  ctx.fillRect(x + 8, floor - 18 + bob, 6, 14);
  ctx.fillStyle = 'hsl(30 40% 55% / 1)';
  for (const y of [floor - 19, floor - 5]) { ctx.beginPath(); ctx.arc(x + 11, y + bob, 3.2, 0, TAU); ctx.fill(); }
}

function drawCounterGoods(ctx, id, cx, floor) {
  const top = floor - STALL.h - 4;
  if (id === MERCHANT) {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'hsl(45 95% 58% / 1)'; ctx.beginPath(); ctx.ellipse(cx + 10, top - 2 - i * 3, 6, 2.2, 0, 0, TAU); ctx.fill(); }
    return;
  }
  if (id === DICER) {
    drawDie(ctx, cx + 6, top - 5, 9, 4);
    drawDie(ctx, cx + 18, top - 5, 9, 2);
    return;
  }
  if (id === OUTFITTER) {
    for (const [dx, hue] of [[4, 140], [12, 190], [20, 90]]) {
      ctx.fillStyle = `hsl(${hue} 75% 60% / 1)`;
      ctx.beginPath(); ctx.moveTo(cx + dx, top - 9); ctx.lineTo(cx + dx + 3.5, top - 4.5); ctx.lineTo(cx + dx, top); ctx.lineTo(cx + dx - 3.5, top - 4.5); ctx.closePath(); ctx.fill();
    }
    return;
  }
  ctx.strokeStyle = 'hsl(0 0% 96% / 1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + 6, top - 2); ctx.lineTo(cx + 16, top - 14); ctx.stroke();
  ctx.fillStyle = 'hsl(0 0% 96% / 1)';
  ctx.beginPath(); ctx.ellipse(cx + 16, top - 15, 2.5, 5, 0.7, 0, TAU); ctx.fill();
}

function drawCeiling(ctx, ceiling) {
  for (let row = 0, y = 6; y < ceiling - 20; y += 34, row++) {
    for (let x = (row % 2) * -40; x < WIDTH; x += 80) {
      roundRect(ctx, x + 4, y, 72, 28, 8);
      ctx.fillStyle = `hsl(0 0% ${row % 3 ? 100 : 0}% / 0.035)`;
      ctx.fill();
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, ceiling);
  shade.addColorStop(0, alpha(DARK, 0.55));
  shade.addColorStop(1, alpha(DARK, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, ceiling);
  const lip = ctx.createLinearGradient(0, ceiling, 0, ceiling + 26);
  lip.addColorStop(0, alpha(DARK, 0.4));
  lip.addColorStop(1, alpha(DARK, 0));
  ctx.fillStyle = lip;
  ctx.fillRect(0, ceiling, WIDTH, 26);
}

export function drawHall(ctx, hall, p, theme, time, player) {
  const floor = (hall.rows - 1) * TILE, ceiling = HALL_CEILING * TILE, style = styleOf(hall);
  ctx.fillStyle = style.ceiling;
  ctx.fillRect(0, 0, WIDTH, ceiling);
  drawCeiling(ctx, ceiling);
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, ceiling, WIDTH, floor - ceiling);
  ctx.fillStyle = style.floor;
  ctx.fillRect(0, floor, WIDTH, hall.height - floor);
  style.paint(ctx, time);
  ctx.fillStyle = style.trim;
  ctx.fillRect(0, ceiling - 4, WIDTH, 4);
  ctx.fillRect(0, floor, WIDTH, 3);
  for (const [id, x] of Object.entries(STALLS)) {
    const keeper = { ...KEEPERS[id], color: KEEPERS[id].color ?? style[COLOR_OF[id]], outfit: { ...KEEPERS[id].outfit, ...style[id] } };
    drawStall(ctx, p, keeper, x + STALL.offset, floor);
    drawCounterGoods(ctx, id, x + STALL.offset, floor);
    drawKeeper(ctx, p, theme, hall, keeper, x + KEEPER_OFFSET, floor, player, time);
    drawProp(ctx, id, x + KEEPER_OFFSET, floor, time);
  }
}
