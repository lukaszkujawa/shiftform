import { TILE, WIDTH, COLS } from './level.js';
import { playerSize } from './physics.js';
import { homeOf } from './home.js';
import { shopsX, clearSpot, climbX } from './signpost.js';
import { TAU } from './paint.js';

const REACH = 40;
const GOD_GAP = 100;
const HOME_GAP = 40;
const SIGN_GAP = 70;
const COLORS = {
  ink: 'hsl(350 62% 13% / 1)', skinLit: 'hsl(6 82% 56% / 1)', skin: 'hsl(355 72% 40% / 1)', skinDeep: 'hsl(345 70% 24% / 1)', rim: 'hsl(28 100% 74% / 0.85)',
  belly: 'hsl(24 72% 58% / 1)', bellyDeep: 'hsl(12 68% 38% / 1)', hornLit: 'hsl(44 58% 88% / 1)', hornDeep: 'hsl(28 34% 42% / 1)', membraneLit: 'hsl(350 58% 38% / 0.96)', membraneDeep: 'hsl(330 52% 17% / 0.96)',
  iron: 'hsl(235 16% 22% / 1)', ironLit: 'hsl(220 18% 62% / 1)', gold: 'hsl(44 88% 58% / 1)', eye: 'hsl(50 100% 72% / 1)', pupil: 'hsl(350 80% 8% / 1)', fang: 'hsl(44 50% 92% / 1)', shadow: 'hsl(240 40% 6% / 0.32)',
};
const EMBER = 'hsl(32 100% 66%';
const FLAME = { outer: 'hsl(14 100% 52% / 0.88)', inner: 'hsl(46 100% 66% / 0.95)' };
const GLOW_BY_TIER = [0, 0.28, 0.42, 0.6];
const FORK_X = 21;
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

function shape(ctx, fill, trace, ink = COLORS.ink) {
  ctx.beginPath();
  trace();
  ctx.fillStyle = fill;
  ctx.fill();
  if (!ink) return;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

function shaded(ctx, x0, y0, x1, y1, ...stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
  return gradient;
}

function stroked(ctx, color, width, trace) {
  ctx.beginPath();
  trace();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawFlames(ctx, count, time) {
  for (let i = 0; i < count; i++) {
    const at = (i - (count - 1) / 2) * 17, lick = 3.5 * Math.sin(time / 110 + i * 2), tall = 30 + 6 * Math.sin(time / 170 + i);
    for (const [fill, scale] of [[FLAME.outer, 1], [FLAME.inner, 0.55]]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(at - 8 * scale, 0);
      ctx.quadraticCurveTo(at - 9 * scale, -tall * scale * 0.5, at + lick * scale, -tall * scale);
      ctx.quadraticCurveTo(at + 9 * scale, -tall * scale * 0.5, at + 8 * scale, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawEmbers(ctx, tier, time) {
  for (let i = 0; i < 3 + tier * 2; i++) {
    const t = (time / 2400 + i * 0.37) % 1, x = Math.sin(i * 2.4 + t * 5) * (14 + i * 2);
    ctx.fillStyle = `${EMBER} / ${(1 - t) * 0.8})`;
    ctx.beginPath(); ctx.arc(x, -6 - t * 62, 1.1 * (1 - t * 0.5), 0, TAU); ctx.fill();
  }
}

function drawWing(ctx, side, flap) {
  ctx.save();
  ctx.translate(side * 5, -32);
  ctx.rotate(side * flap);
  ctx.scale(side, 1);
  shape(ctx, shaded(ctx, 0, -18, 24, 8, COLORS.membraneLit, COLORS.membraneDeep), () => {
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(8, -19, 25, -21);
    ctx.quadraticCurveTo(25, -10, 28, -4);
    ctx.quadraticCurveTo(20, -7, 19, 3);
    ctx.quadraticCurveTo(13, -2, 10, 9);
    ctx.quadraticCurveTo(6, 3, 0, 8);
    ctx.closePath();
  });
  for (const [x, y] of [[19, 3], [10, 9]]) stroked(ctx, COLORS.skinDeep, 0.9, () => { ctx.moveTo(1, 0); ctx.lineTo(x, y); });
  ctx.fillStyle = COLORS.hornLit;
  ctx.beginPath(); ctx.moveTo(24, -21); ctx.lineTo(29, -25); ctx.lineTo(26, -19); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTail(ctx, time) {
  const flick = Math.sin(time / 300) * 3, x = -22, y = -22 + flick;
  ctx.lineCap = 'round';
  stroked(ctx, COLORS.ink, 4.4, () => { ctx.moveTo(-6, -11); ctx.bezierCurveTo(-18, -4, -27, -10, x, y); });
  stroked(ctx, COLORS.skin, 2.6, () => { ctx.moveTo(-6, -11); ctx.bezierCurveTo(-18, -4, -27, -10, x, y); });
  shape(ctx, shaded(ctx, x, y - 8, x, y + 3, COLORS.skinLit, COLORS.skinDeep), () => {
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x - 6, y - 1, x - 1, y - 10);
    ctx.quadraticCurveTo(x + 6, y - 2, x, y + 2);
    ctx.closePath();
  });
}

function drawLeg(ctx, x, shade) {
  shape(ctx, shade, () => {
    ctx.moveTo(x - 4, -15);
    ctx.quadraticCurveTo(x - 6, -8, x - 3, -5);
    ctx.lineTo(x - 4, -1);
    ctx.lineTo(x + 6, -1);
    ctx.lineTo(x + 3, -5);
    ctx.quadraticCurveTo(x + 5, -10, x + 4, -15);
    ctx.closePath();
  });
  ctx.fillStyle = COLORS.fang;
  for (const claw of [x + 1, x + 4]) { ctx.beginPath(); ctx.moveTo(claw - 1.4, -2); ctx.lineTo(claw + 2.4, 0); ctx.lineTo(claw - 1.4, 0); ctx.closePath(); ctx.fill(); }
}

function drawBody(ctx) {
  shape(ctx, shaded(ctx, -10, -36, 11, -12, COLORS.skinLit, COLORS.skin, COLORS.skinDeep), () => {
    ctx.moveTo(-6, -35);
    ctx.bezierCurveTo(-12, -28, -12, -16, -7, -11);
    ctx.quadraticCurveTo(0, -8, 7, -11);
    ctx.bezierCurveTo(12, -16, 11, -29, 6, -35);
    ctx.closePath();
  });
  shape(ctx, shaded(ctx, 0, -30, 0, -11, COLORS.belly, COLORS.bellyDeep), () => {
    ctx.moveTo(-3, -31);
    ctx.bezierCurveTo(-7, -25, -6, -16, -3, -12);
    ctx.quadraticCurveTo(2, -10, 5, -12);
    ctx.bezierCurveTo(8, -17, 7, -26, 4, -31);
    ctx.closePath();
  }, null);
  for (const y of [-26, -21, -16]) stroked(ctx, COLORS.bellyDeep, 0.8, () => { ctx.moveTo(-3.5, y); ctx.quadraticCurveTo(1, y + 2, 5.5, y); });
  stroked(ctx, COLORS.rim, 1, () => { ctx.moveTo(-8, -31); ctx.quadraticCurveTo(-11, -23, -8.5, -15); });
}

function drawFork(ctx, tier, time) {
  const x = FORK_X, glow = GLOW_BY_TIER[tier] + 0.14 * Math.sin(time / 240);
  ctx.lineCap = 'round';
  stroked(ctx, COLORS.ink, 3.2, () => { ctx.moveTo(x, 0); ctx.lineTo(x, -56); });
  stroked(ctx, COLORS.iron, 1.9, () => { ctx.moveTo(x, 0); ctx.lineTo(x, -56); });
  if (tier) {
    const halo = ctx.createRadialGradient(x, -64, 1, x, -64, 15);
    halo.addColorStop(0, `${EMBER} / ${glow})`);
    halo.addColorStop(1, `${EMBER} / 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, -64, 15, 0, TAU); ctx.fill();
  }
  shape(ctx, shaded(ctx, x - 7, 0, x + 7, 0, COLORS.ironLit, COLORS.iron), () => {
    ctx.moveTo(x - 1.2, -56);
    ctx.quadraticCurveTo(x - 7.5, -57, x - 7, -66);
    ctx.lineTo(x - 5.2, -71);
    ctx.lineTo(x - 4.2, -64);
    ctx.quadraticCurveTo(x - 4, -60, x - 1.2, -60);
    ctx.lineTo(x - 1.2, -66);
    ctx.lineTo(x, -74);
    ctx.lineTo(x + 1.2, -66);
    ctx.lineTo(x + 1.2, -60);
    ctx.quadraticCurveTo(x + 4, -60, x + 4.2, -64);
    ctx.lineTo(x + 5.2, -71);
    ctx.lineTo(x + 7, -66);
    ctx.quadraticCurveTo(x + 7.5, -57, x + 1.2, -56);
    ctx.closePath();
  });
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x - 2.4, -56.5, 4.8, 2.4);
}

function drawArms(ctx) {
  shape(ctx, COLORS.skin, () => {
    ctx.moveTo(6, -33);
    ctx.quadraticCurveTo(15, -33, FORK_X, -28);
    ctx.lineTo(FORK_X - 1.5, -24.5);
    ctx.quadraticCurveTo(12, -28, 6, -28);
    ctx.closePath();
  });
  shape(ctx, COLORS.skinLit, () => { ctx.arc(FORK_X, -26, 3, 0, TAU); });
  shape(ctx, COLORS.skinDeep, () => {
    ctx.moveTo(-7, -33);
    ctx.quadraticCurveTo(-14, -28, -11, -21);
    ctx.lineTo(-7.5, -19);
    ctx.lineTo(-8.5, -22);
    ctx.quadraticCurveTo(-10, -27, -6, -29);
    ctx.closePath();
  });
}

function drawHorn(ctx, side) {
  shape(ctx, shaded(ctx, side * 6, -48, side * 16, -66, COLORS.hornDeep, COLORS.hornLit), () => {
    ctx.moveTo(side * 3, -52);
    ctx.quadraticCurveTo(side * 11, -53, side * 17, -67);
    ctx.quadraticCurveTo(side * 19, -52, side * 11, -46);
    ctx.closePath();
  });
  for (const [x, y, across] of [[10, -51, 3.5], [13.5, -56, 2.2]]) stroked(ctx, COLORS.hornDeep, 0.9, () => { ctx.moveTo(side * (x - across), y - 1); ctx.quadraticCurveTo(side * x, y + 1, side * (x + across), y - 1.5); });
}

function drawEar(ctx, side) {
  shape(ctx, shaded(ctx, side * 10, -44, side * 22, -40, COLORS.skin, COLORS.skinDeep), () => {
    ctx.moveTo(side * 10, -46);
    ctx.quadraticCurveTo(side * 18, -47, side * 23, -50);
    ctx.quadraticCurveTo(side * 20, -41, side * 10, -39);
    ctx.closePath();
  });
  stroked(ctx, COLORS.skinDeep, 1, () => { ctx.moveTo(side * 12, -43); ctx.lineTo(side * 19, -46); });
}

function drawEye(ctx, x, lookX, lookY, tier) {
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath(); ctx.moveTo(x - 4.2, -44); ctx.quadraticCurveTo(x, -47.5, x + 4.2, -44.5); ctx.quadraticCurveTo(x, -39.6, x - 4.2, -44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tier ? `hsl(${50 - tier * 12} 100% 66% / 1)` : COLORS.eye;
  ctx.beginPath(); ctx.moveTo(x - 3.2, -44); ctx.quadraticCurveTo(x, -46.6, x + 3.2, -44.5); ctx.quadraticCurveTo(x, -40.6, x - 3.2, -44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.pupil;
  ctx.beginPath(); ctx.ellipse(x + lookX, -43.8 + lookY, 0.95, 2.1, 0, 0, TAU); ctx.fill();
}

function drawHead(ctx, tier, lookY, time) {
  drawEar(ctx, -1);
  drawEar(ctx, 1);
  drawHorn(ctx, -1);
  drawHorn(ctx, 1);
  shape(ctx, shaded(ctx, -11, -53, 11, -32, COLORS.skinLit, COLORS.skin, COLORS.skinDeep), () => {
    ctx.moveTo(0, -53);
    ctx.bezierCurveTo(9, -53, 13, -47, 12, -41);
    ctx.bezierCurveTo(11, -36, 5, -31, 0, -30);
    ctx.bezierCurveTo(-5, -31, -11, -36, -12, -41);
    ctx.bezierCurveTo(-13, -47, -9, -53, 0, -53);
    ctx.closePath();
  });
  stroked(ctx, COLORS.rim, 1, () => { ctx.moveTo(-10, -48); ctx.quadraticCurveTo(-7, -52, -2, -52); });
  const blink = Math.sin(time / 1700) > 0.985;
  if (blink) for (const x of [-4, 6]) stroked(ctx, COLORS.ink, 1.4, () => { ctx.moveTo(x - 3.5, -44); ctx.lineTo(x + 3.5, -44); });
  else for (const x of [-4, 6]) drawEye(ctx, x, 1, lookY, tier);
  for (const [from, to] of [[-9, 0], [11, 2]]) stroked(ctx, COLORS.skinDeep, 2, () => { ctx.moveTo(from, -49.5); ctx.lineTo(to, -46.2); });
  stroked(ctx, COLORS.skinDeep, 1, () => { ctx.moveTo(0, -41); ctx.lineTo(1.5, -39.5); });
  ctx.fillStyle = COLORS.pupil;
  ctx.beginPath(); ctx.moveTo(-5, -37.5); ctx.quadraticCurveTo(2, -33.8, 9, -39); ctx.quadraticCurveTo(3, -36.8, -5, -37.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.fang;
  for (const [x, y] of [[-1.5, -37.2], [5, -37.6]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2.4, y - 0.1); ctx.lineTo(x + 1, y + 3); ctx.closePath(); ctx.fill(); }
}

export function drawImp(ctx, level, time, player, difficulty = 0) {
  const { w, h } = playerSize(level.rules), x = impX(level), floor = (level.rows - 1) * TILE;
  const toward = Math.sign(player.x + w / 2 - x) || 1, breath = Math.sin(time / 520), flap = 0.1 + 0.1 * Math.sin(time / 300);
  const lookY = Math.max(-0.8, Math.min(0.8, (player.y + h / 2 - (floor - 44)) / 120));
  ctx.save();
  ctx.translate(x, floor);
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 3.4, 0, 0, TAU); ctx.fill();
  drawFlames(ctx, difficulty, time);
  drawEmbers(ctx, difficulty, time);
  ctx.scale(toward, 1);
  ctx.save();
  ctx.scale(1, 1 + breath * 0.012);
  drawWing(ctx, -1, flap);
  drawWing(ctx, 1, flap);
  drawTail(ctx, time);
  drawLeg(ctx, -5, shaded(ctx, -9, -15, -1, 0, COLORS.skin, COLORS.skinDeep));
  drawLeg(ctx, 5, shaded(ctx, 1, -15, 9, 0, COLORS.skin, COLORS.skinDeep));
  drawBody(ctx);
  drawFork(ctx, difficulty, time);
  drawArms(ctx);
  drawHead(ctx, difficulty, lookY, time);
  ctx.restore();
  ctx.restore();
}
