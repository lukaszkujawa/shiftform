import { TILE, WIDTH, PLAYER_W, EMPTY, overlaps, tileAt } from './level.js?v=129676c';
import { playerSize } from './physics.js?v=129676c';
import { TAU, font, roundRect } from './paint.js?v=129676c';

const ROOM_W = 7 * TILE;
const WALL_H = 3 * TILE;
const ROOF_H = 54;
const EAVE = 14;
const WARDROBE = { w: 40, h: 56 };
const REACH = 10;
const GAP = 4;
const SLIDE = 6;
const LOOK = {
  roof: 'hsl(8 58% 52% / 1)', roofEdge: 'hsl(8 50% 38% / 1)', brick: 'hsl(12 35% 42% / 1)',
  wall: 'hsl(38 55% 88% / 1)', paper: 'hsl(38 45% 81% / 1)', trim: 'hsl(26 42% 40% / 1)',
  wood: 'hsl(26 48% 44% / 1)', woodDark: 'hsl(24 45% 28% / 1)', brass: 'hsl(45 85% 60% / 1)',
  glass: 'hsl(205 70% 80% / 1)', curtain: 'hsl(340 60% 72% / 1)', rug: 'hsl(340 55% 62% / 1)', rugInner: 'hsl(40 80% 72% / 1)',
  mirror: 'hsl(200 55% 84% / 1)', shine: 'hsl(0 0% 100% / 0.75)', lamp: 'hsl(45 100% 78% / 1)', glow: 'hsl(45 100% 70% / 0.16)',
  hill: 'hsl(120 35% 55% / 1)', sky: 'hsl(200 70% 85% / 1)', bubble: 'hsl(240 25% 12% / 0.85)', label: 'hsl(0 0% 97% / 1)',
};

function wardrobeSpot(level, x, floor, startX) {
  const y = floor - WARDROBE.h;
  const clear = wx => {
    if (wx + WARDROBE.w + GAP > startX && wx < startX + PLAYER_W + GAP) return false;
    for (let row = Math.floor(y / TILE); row * TILE < floor; row++) for (let col = Math.floor(wx / TILE); col * TILE < wx + WARDROBE.w; col++) if (tileAt(level, col, row) !== EMPTY) return false;
    return true;
  };
  const fromWall = wx => Math.min(wx - x, x + ROOM_W - wx - WARDROBE.w);
  const spots = [];
  for (let wx = x + 14; wx <= x + ROOM_W - 14 - WARDROBE.w; wx += SLIDE) spots.push(wx);
  return { x: spots.filter(clear).sort((a, b) => fromWall(a) - fromWall(b))[0] ?? x + 14, y, ...WARDROBE };
}

export function homeOf(level) {
  if (level.index !== 0) return null;
  const floor = level.height - TILE, cx = level.start.x + PLAYER_W / 2;
  const x = Math.max(EAVE, Math.min(WIDTH - ROOM_W - EAVE, cx - ROOM_W / 2));
  const wardrobe = wardrobeSpot(level, x, floor, level.start.x);
  return { x, floor, top: floor - WALL_H, wardrobe, windowX: wardrobe.x < x + ROOM_W / 2 ? x + ROOM_W - 62 : x + 18 };
}

export function atWardrobe(home, level, s) {
  if (!home || !s.grounded) return false;
  const { w, h } = playerSize(level.rules), { x, y, w: ww, h: wh } = home.wardrobe;
  return overlaps(s.x, s.y, w, h, { x: x - REACH, y, w: ww + 2 * REACH, h: wh });
}

function drawRoof(ctx, { x, top }, time) {
  const right = x + ROOM_W, chimney = right - 52;
  ctx.fillStyle = LOOK.brick;
  ctx.fillRect(chimney, top - ROOF_H + 4, 16, ROOF_H);
  for (let i = 0; i < 3; i++) {
    const t = (time / 2400 + i / 3) % 1;
    ctx.fillStyle = `hsl(0 0% 94% / ${(1 - t) * 0.45})`;
    ctx.beginPath(); ctx.arc(chimney + 8 + t * 14 + Math.sin(t * TAU) * 3, top - ROOF_H - t * 44, 4 + t * 7, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = LOOK.roof;
  ctx.strokeStyle = LOOK.roofEdge;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - EAVE, top); ctx.lineTo(x + ROOM_W / 2, top - ROOF_H); ctx.lineTo(right + EAVE, top); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LOOK.glass;
  ctx.beginPath(); ctx.arc(x + ROOM_W / 2, top - ROOF_H * 0.45, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = LOOK.trim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawRoom(ctx, { x, top, floor, windowX }, time) {
  const right = x + ROOM_W, mid = x + ROOM_W / 2;
  ctx.fillStyle = LOOK.wall;
  ctx.fillRect(x, top, ROOM_W, floor - top);
  ctx.fillStyle = LOOK.paper;
  for (let sx = x + 7; sx < right - 4; sx += 14) ctx.fillRect(sx, top, 5, floor - top);
  ctx.fillStyle = LOOK.trim;
  ctx.fillRect(x - 5, top - 4, ROOM_W + 10, 8);
  ctx.fillRect(x - 5, top, 8, floor - top);
  ctx.fillRect(right - 3, top, 8, floor - top);
  ctx.fillRect(x, floor - 6, ROOM_W, 6);
  ctx.fillStyle = LOOK.trim;
  ctx.fillRect(windowX - 3, top + 15, 50, 42);
  ctx.fillStyle = LOOK.glass;
  ctx.fillRect(windowX, top + 18, 44, 36);
  ctx.fillStyle = LOOK.trim;
  ctx.fillRect(windowX + 20, top + 18, 4, 36);
  ctx.fillRect(windowX, top + 34, 44, 4);
  ctx.fillStyle = LOOK.curtain;
  for (const [edge, dir] of [[windowX - 4, 1], [windowX + 48, -1]]) {
    ctx.beginPath(); ctx.moveTo(edge, top + 12); ctx.lineTo(edge + dir * 16, top + 12); ctx.quadraticCurveTo(edge + dir * 4, top + 36, edge + dir * 10, top + 60); ctx.lineTo(edge, top + 60); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = LOOK.trim;
  ctx.fillRect(mid - 15, top + 14, 30, 24);
  ctx.fillStyle = LOOK.sky;
  ctx.fillRect(mid - 12, top + 17, 24, 18);
  ctx.fillStyle = LOOK.hill;
  ctx.beginPath(); ctx.moveTo(mid - 12, top + 35); ctx.lineTo(mid - 3, top + 22); ctx.lineTo(mid + 3, top + 28); ctx.lineTo(mid + 7, top + 24); ctx.lineTo(mid + 12, top + 35); ctx.closePath(); ctx.fill();
  const flicker = 1 + 0.06 * Math.sin(time / 260);
  ctx.fillStyle = LOOK.glow;
  ctx.beginPath(); ctx.arc(mid, top + 50, 34 * flicker, 0, TAU); ctx.fill();
  ctx.strokeStyle = LOOK.woodDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(mid, top + 4); ctx.lineTo(mid, top + 42); ctx.stroke();
  ctx.fillStyle = LOOK.curtain;
  ctx.beginPath(); ctx.moveTo(mid - 5, top + 42); ctx.lineTo(mid + 5, top + 42); ctx.lineTo(mid + 10, top + 50); ctx.lineTo(mid - 10, top + 50); ctx.closePath(); ctx.fill();
  ctx.fillStyle = LOOK.lamp;
  ctx.beginPath(); ctx.arc(mid, top + 51, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = LOOK.rug;
  ctx.beginPath(); ctx.ellipse(mid, floor - 2, 52, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = LOOK.rugInner;
  ctx.beginPath(); ctx.ellipse(mid, floor - 2, 38, 3.5, 0, 0, TAU); ctx.fill();
}

function drawWardrobe(ctx, { x, y, w, h }, near, time) {
  ctx.fillStyle = LOOK.woodDark;
  roundRect(ctx, x - 4, y - 7, w + 8, 9, 3); ctx.fill();
  ctx.fillRect(x + 3, y + h - 5, 5, 5);
  ctx.fillRect(x + w - 8, y + h - 5, 5, 5);
  ctx.fillStyle = LOOK.wood;
  roundRect(ctx, x, y, w, h - 4, 3); ctx.fill();
  ctx.strokeStyle = LOOK.woodDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 7); ctx.stroke();
  ctx.strokeRect(x + w / 2 + 4, y + 6, w / 2 - 8, h - 16);
  ctx.fillStyle = LOOK.trim;
  ctx.beginPath(); ctx.ellipse(x + w / 4, y + h * 0.42, w / 4 - 2, h * 0.32, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = LOOK.mirror;
  ctx.beginPath(); ctx.ellipse(x + w / 4, y + h * 0.42, w / 4 - 4.5, h * 0.32 - 2.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = LOOK.shine;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 6, y + h * 0.36); ctx.lineTo(x + 12, y + h * 0.24); ctx.moveTo(x + 7, y + h * 0.46); ctx.lineTo(x + 14, y + h * 0.32); ctx.stroke();
  ctx.fillStyle = LOOK.brass;
  for (const dx of [-4, 4]) { ctx.beginPath(); ctx.arc(x + w / 2 + dx, y + h * 0.5, 1.8, 0, TAU); ctx.fill(); }
  if (!near) return;
  const pulse = 0.55 + 0.45 * Math.sin(time / 220);
  ctx.strokeStyle = `hsl(48 100% 70% / ${pulse})`;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 6, y - 10, w + 12, h + 12, 6); ctx.stroke();
  ctx.fillStyle = LOOK.bubble;
  roundRect(ctx, x + w / 2 - 38, y - 36, 76, 20, 10); ctx.fill();
  ctx.fillStyle = LOOK.label;
  ctx.font = font(700, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F  dress up', x + w / 2, y - 26);
}

export function drawHome(ctx, home, time, near) {
  drawRoof(ctx, home, time);
  drawRoom(ctx, home, time);
  drawWardrobe(ctx, home.wardrobe, near, time);
}
