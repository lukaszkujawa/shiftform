import { TILE, WIDTH, COLS } from './level.js?v=dd78f3b';
import { playerSize } from './physics.js?v=dd78f3b';
import { homeOf } from './home.js?v=dd78f3b';
import { shopsX, clearSpot, climbX } from '../art/signpost.js?v=dd78f3b';
import { TAU, shadedBody } from '../art/paint.js?v=dd78f3b';

const REACH = 40;
const GOD_GAP = 100;
const HOME_GAP = 40;
const SIGN_GAP = 70;
const BODY = { fill: 'hsl(358 74% 50% / 1)', shade: 'hsl(354 72% 37% / 1)', line: 'hsl(350 66% 20% / 1)' };
const HORN = { fill: 'hsl(40 45% 84% / 1)', shade: 'hsl(34 30% 62% / 1)', line: BODY.line };
const EYE = 'hsl(0 0% 98% / 1)';
const PUPIL = 'hsl(240 30% 10% / 1)';
const FLAME = { outer: 'hsl(18 100% 54% / 0.9)', inner: 'hsl(46 100% 64% / 1)' };
const FORK = 'hsl(235 16% 22% / 1)';
const FORK_X = 17;
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

function drawFlames(ctx, count, time) {
  for (let i = 0; i < count; i++) {
    const at = (i - (count - 1) / 2) * 15, lick = 3 * Math.sin(time / 110 + i * 2);
    for (const [fill, scale] of [[FLAME.outer, 1], [FLAME.inner, 0.55]]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(at - 6 * scale, 0);
      ctx.lineTo(at + lick * scale, -26 * scale);
      ctx.lineTo(at + 6 * scale, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawFork(ctx) {
  ctx.strokeStyle = FORK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(FORK_X, 0); ctx.lineTo(FORK_X, -38); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(FORK_X - 5, -46); ctx.lineTo(FORK_X - 5, -38); ctx.lineTo(FORK_X + 5, -38); ctx.lineTo(FORK_X + 5, -46);
  ctx.moveTo(FORK_X, -38); ctx.lineTo(FORK_X, -48);
  ctx.stroke();
}

function drawTail(ctx, time) {
  const y = -16 + Math.sin(time / 300) * 3;
  ctx.strokeStyle = BODY.line;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-20, -4, -19, y); ctx.stroke();
  ctx.fillStyle = BODY.line;
  ctx.beginPath(); ctx.moveTo(-23, y + 1); ctx.lineTo(-19, y - 7); ctx.lineTo(-15, y + 1); ctx.closePath(); ctx.fill();
}

function drawHorn(ctx, side) {
  shadedBody(ctx, () => { ctx.moveTo(side * 3, -31); ctx.quadraticCurveTo(side * 9, -35, side * 11, -42); ctx.quadraticCurveTo(side * 14, -32, side * 10, -27); ctx.closePath(); }, HORN, 1.1);
}

export function drawImp(ctx, level, time, player, difficulty = 0) {
  const { w } = playerSize(level.rules), x = impX(level), floor = (level.rows - 1) * TILE;
  const toward = Math.sign(player.x + w / 2 - x) || 1, bob = Math.abs(Math.sin(time / 420)) * 1.5;
  ctx.save();
  ctx.translate(x, floor);
  drawFlames(ctx, difficulty, time);
  ctx.scale(toward, 1);
  drawFork(ctx);
  ctx.translate(0, -bob);
  drawTail(ctx, time);
  drawHorn(ctx, -1);
  drawHorn(ctx, 1);
  shadedBody(ctx, () => ctx.roundRect(-12, -32, 24, 32, 10), BODY);
  for (const eye of [-4, 6]) {
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.arc(eye, -21, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = PUPIL;
    ctx.beginPath(); ctx.arc(eye + 1.2, -21, 1.7, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = BODY.line;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-3, -12.5); ctx.quadraticCurveTo(2, -9.5, 7, -13); ctx.stroke();
  ctx.fillStyle = EYE;
  ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(6, -12.6); ctx.lineTo(5, -8.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
