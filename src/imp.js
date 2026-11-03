import { TILE, WIDTH, COLS } from './level.js';
import { playerSize } from './physics.js';
import { homeOf } from './home.js';
import { shopsX, clearSpot, climbX } from './signpost.js';
import { TAU } from './paint.js';

const REACH = 40;
const GOD_GAP = 100;
const HOME_GAP = 40;
const SIGN_GAP = 70;
const SKIN = 'hsl(358 72% 46% / 1)';
const DARK = 'hsl(358 75% 28% / 1)';
const HORN = 'hsl(40 40% 82% / 1)';
const EYE = 'hsl(50 100% 72% / 1)';
const FORK = 'hsl(30 12% 36% / 1)';
const FLAME = ['hsl(25 100% 55% / 0.9)', 'hsl(48 100% 62% / 0.95)'];
const spots = new WeakMap();

function spotOf(level) {
  const far = WIDTH - shopsX(level), inward = far < WIDTH / 2 ? 1 : -1, home = homeOf(level);
  const free = x => clearSpot(level, x, false) && (!home || ((x < home.x - HOME_GAP || x > home.right + HOME_GAP) && Math.abs(x - climbX(level).x) > SIGN_GAP));
  const candidates = Array.from({ length: COLS }, (_, k) => far + inward * (GOD_GAP + k * TILE));
  return candidates.find(free) ?? candidates[0];
}

export const impX = level => spots.get(level.tiles) ?? spots.set(level.tiles, spotOf(level)).get(level.tiles);

export function nearImp(level, s) {
  if (level.hall || level.custom) return false;
  const { w, h } = playerSize(level.rules);
  const onFloor = s.grounded && Math.abs(s.y + h - (level.rows - 1) * TILE) < 1;
  return onFloor && Math.abs(s.x + w / 2 - impX(level)) < REACH;
}

const blob = (ctx, color, x, y, rx, ry) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };

function polygon(ctx, color, ...points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function drawFlames(ctx, count, time) {
  for (let i = 0; i < count; i++) {
    const at = (i - (count - 1) / 2) * 15, lick = 3 * Math.sin(time / 110 + i * 2);
    polygon(ctx, FLAME[0], [at - 6, 0], [at + lick, -24 - lick], [at + 6, 0]);
    polygon(ctx, FLAME[1], [at - 3, 0], [at + lick / 2, -13 - lick / 2], [at + 3, 0]);
  }
}

function drawFork(ctx, side) {
  ctx.strokeStyle = FORK;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const x = side * 15;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -40); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 5, -49); ctx.lineTo(x - 5, -40); ctx.lineTo(x + 5, -40); ctx.lineTo(x + 5, -49);
  ctx.moveTo(x, -40); ctx.lineTo(x, -51);
  ctx.stroke();
}

function drawTail(ctx, side, time) {
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 2.5;
  const flick = Math.sin(time / 260) * 4, x = -side * 20, y = -18 + flick;
  ctx.beginPath(); ctx.moveTo(-side * 7, -8); ctx.quadraticCurveTo(-side * 22, -4, x, y); ctx.stroke();
  polygon(ctx, DARK, [x - 4, y + 2], [x, y - 7], [x + 4, y + 2]);
}

export function drawImp(ctx, level, time, player, difficulty = 0) {
  const { w } = playerSize(level.rules), x = impX(level), floor = (level.rows - 1) * TILE;
  const toward = Math.sign(player.x + w / 2 - x) || 1, hop = Math.abs(Math.sin(time / 320)) * 3;
  ctx.save();
  ctx.translate(x, floor);
  drawFlames(ctx, difficulty, time);
  ctx.translate(0, -hop);
  drawTail(ctx, toward, time);
  drawFork(ctx, toward);
  blob(ctx, DARK, -5, -3, 4, 3);
  blob(ctx, DARK, 5, -3, 4, 3);
  blob(ctx, SKIN, 0, -13, 10, 11);
  blob(ctx, SKIN, 0, -29, 12, 10);
  polygon(ctx, HORN, [-11, -33], [-13, -46], [-4, -37]);
  polygon(ctx, HORN, [11, -33], [13, -46], [4, -37]);
  for (const eye of [-5, 5]) {
    blob(ctx, EYE, eye + toward, -30, 3.2, 2.8);
    blob(ctx, 'hsl(0 0% 6% / 1)', eye + toward * 2, -30, 1.3, 1.8);
  }
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(toward, -26, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}
