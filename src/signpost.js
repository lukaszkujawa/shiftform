import { TILE, WIDTH } from './level.js?v=4a2bde0';
import { MOUTH } from './tunnel.js?v=4a2bde0';
import { glow } from './sprites.js?v=4a2bde0';
import { alpha } from './themes.js?v=4a2bde0';
import { TAU, font, roundRect } from './paint.js?v=4a2bde0';

const SIGN = { post: 60, w: 78, h: 24, tip: 12, gap: 62 };
const MARQUEE = { w: 96, h: 30, rise: 38, bulb: 2.2, spacing: 8, chase: 140 };
const WOOD = { post: 'hsl(26 40% 30% / 1)', board: 'hsl(31 48% 47% / 1)', edge: 'hsl(26 45% 26% / 1)', text: 'hsl(40 70% 93% / 1)' };
const STONE = { post: 'hsl(30 6% 40% / 1)', board: 'hsl(30 6% 58% / 1)', edge: 'hsl(30 8% 30% / 1)', text: 'hsl(30 10% 18% / 1)' };
const STEEL = { post: 'hsl(210 8% 42% / 1)', board: 'hsl(210 10% 66% / 1)', edge: 'hsl(210 14% 28% / 1)', text: 'hsl(210 30% 14% / 1)' };

const line = (ctx, color, width, ...pts) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
};
const dot = (ctx, color, x, y, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

const ORNAMENTS = {
  grain: (ctx, b) => { for (const k of [0.33, 0.66]) line(ctx, 'hsl(26 40% 34% / 0.6)', 1, b.x + 6, b.y + b.h * k, b.x + b.w - 14, b.y + b.h * k); },
  rope: (ctx, b, s) => { for (let y = s.floor - 18; y > s.floor - 34; y -= 5) line(ctx, 'hsl(40 45% 70% / 1)', 2, s.x - 5, y + 3, s.x + 5, y); },
  web: (ctx, b) => { const x = b.x + b.w - 18, y = b.y; for (const a of [0.3, 0.8, 1.3]) line(ctx, 'hsl(0 0% 90% / 0.6)', 0.8, x, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14); },
  rivets: (ctx, b) => { for (const [x, y] of [[b.x + 6, b.y + 5], [b.x + 6, b.y + b.h - 5], [b.x + b.w - 18, b.y + 5], [b.x + b.w - 18, b.y + b.h - 5]]) dot(ctx, 'hsl(210 12% 34% / 1)', x, y, 1.8); },
  hazard: (ctx, b, s) => { for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? 'hsl(0 0% 12% / 1)' : 'hsl(48 95% 55% / 1)'; ctx.fillRect(s.x - 4, s.floor - 26 + i * 6, 8, 6); } },
  neon: (ctx, b, s, p) => { glow(ctx, s.theme, p.accent, 12); ctx.strokeStyle = p.accent; ctx.lineWidth = 2; board(ctx, b); ctx.stroke(); ctx.shadowBlur = 0; },
  chips: (ctx, b) => { ctx.fillStyle = 'hsl(30 6% 46% / 1)'; for (const [x, y] of [[b.x + 4, b.y + 3], [b.x + b.w - 22, b.y + b.h - 6]]) ctx.fillRect(x, y, 5, 3); },
  shard: (ctx, b, s, p) => { ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(s.x, s.top - 22); ctx.lineTo(s.x + 6, s.top - 6); ctx.lineTo(s.x, s.top); ctx.lineTo(s.x - 6, s.top - 6); ctx.closePath(); ctx.fill(); },
  embers: (ctx, b, s, p, time) => { line(ctx, alpha(p.hazard, 0.7 + 0.3 * Math.sin(time / 300)), 1.5, b.x + 8, b.y + 4, b.x + 16, b.y + 12, b.x + 12, b.y + b.h - 3); },
  candy: (ctx, b, s) => { for (let y = s.floor; y > s.top; y -= 8) line(ctx, 'hsl(350 85% 60% / 1)', 3, s.x - 4, y, s.x + 4, y - 6); },
  sprinkles: (ctx, b) => { ['hsl(190 80% 60% / 1)', 'hsl(55 90% 60% / 1)', 'hsl(120 60% 55% / 1)'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(b.x + 8 + i * 18, b.y + 3 + (i % 2) * 15, 4, 2); }); },
  bulbs: (ctx, b, s, p, time) => { for (let i = 0; i < 5; i++) dot(ctx, `hsl(${(i * 70 + time / 20) % 360} 90% 65% / 1)`, b.x + 6 + i * ((b.w - 20) / 4), b.y - 2, 2.2); },
  snow: (ctx, b) => { roundRect(ctx, b.x - 2, b.y - 5, b.w - 6, 7, 4); ctx.fillStyle = 'hsl(0 0% 98% / 1)'; ctx.fill(); for (let i = 0; i < 4; i++) { const x = b.x + 8 + i * 15; ctx.fillStyle = 'hsl(195 70% 90% / 0.9)'; ctx.beginPath(); ctx.moveTo(x, b.y + b.h); ctx.lineTo(x + 3, b.y + b.h + 6 + (i % 2) * 4); ctx.lineTo(x + 6, b.y + b.h); ctx.closePath(); ctx.fill(); } },
  vines: (ctx, b, s) => { line(ctx, 'hsl(120 45% 38% / 1)', 2, s.x, s.floor, s.x + 5, s.floor - 18, s.x - 4, s.floor - 34, s.x + 3, s.top + 4); for (const [x, y] of [[s.x + 6, s.floor - 20], [s.x - 6, s.floor - 36], [b.x + b.w - 20, b.y + b.h]]) dot(ctx, 'hsl(120 50% 45% / 1)', x, y, 3.5); },
  petals: (ctx, b, s, p, time) => { for (let i = 0; i < 3; i++) dot(ctx, 'hsl(340 75% 82% / 1)', b.x + 10 + i * 22, b.y - 6 + Math.sin(time / 500 + i) * 2, 2.5); },
  leaves: (ctx, b, s, p, time) => { for (let i = 0; i < 3; i++) { const y = (time / 30 + i * 20) % 50; dot(ctx, 'hsl(25 85% 52% / 0.9)', s.x - 18 + i * 16 + Math.sin(y / 8) * 4, b.y - 10 + y, 2.5); } },
  grass: (ctx, b, s) => { for (const dx of [-9, -5, 5, 9]) line(ctx, 'hsl(45 55% 55% / 1)', 1.5, s.x + dx, s.floor, s.x + dx * 1.4, s.floor - 10); },
  cap: (ctx, b, s) => { ctx.fillStyle = 'hsl(355 70% 52% / 1)'; ctx.beginPath(); ctx.arc(s.x, s.top + 2, 16, Math.PI, TAU); ctx.closePath(); ctx.fill(); for (const dx of [-7, 2, 9]) dot(ctx, 'hsl(0 0% 96% / 1)', s.x + dx, s.top - 6 + Math.abs(dx) * 0.4, 2.2); },
  honey: (ctx, b, s, p, time) => { const drip = 4 + (time / 120) % 8; ctx.fillStyle = 'hsl(42 95% 55% / 1)'; roundRect(ctx, b.x + 14, b.y + b.h - 2, 5, drip, 2.5); ctx.fill(); },
  sketch: (ctx, b, s, p) => { ctx.strokeStyle = alpha(p.ink, 0.8); ctx.lineWidth = 1; ctx.save(); ctx.translate(1.5, -1.5); board(ctx, b); ctx.stroke(); ctx.restore(); },
  spine: (ctx, b) => { for (const k of [0.18, 0.82]) { ctx.fillStyle = 'hsl(45 80% 60% / 1)'; ctx.fillRect(b.x + 3, b.y + b.h * k - 1, b.w - 14, 2); } },
  lantern: (ctx, b, s, p, time) => { const x = b.x + b.w / 2 - 4, sway = Math.sin(time / 700) * 2; line(ctx, 'hsl(45 80% 55% / 1)', 1, x, b.y + b.h, x + sway, b.y + b.h + 8); roundRect(ctx, x + sway - 6, b.y + b.h + 8, 12, 14, 5); ctx.fillStyle = 'hsl(5 85% 55% / 1)'; ctx.fill(); dot(ctx, 'hsl(45 100% 70% / 0.35)', x + sway, b.y + b.h + 15, 10); },
  clouds: (ctx, b, s) => { for (const [dx, r] of [[-12, 8], [0, 11], [12, 8]]) dot(ctx, 'hsl(0 0% 99% / 0.95)', s.x + dx, s.floor - 4, r); },
  bubbles: (ctx, b, s, p, time) => { for (let i = 0; i < 3; i++) { const y = (time / 25 + i * 22) % 60; ctx.strokeStyle = 'hsl(190 80% 85% / 0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x + 10 + Math.sin(y / 9 + i) * 3, s.floor - 10 - y, 2 + i * 0.6, 0, TAU); ctx.stroke(); } },
};

const STYLES = {
  wood: { ...WOOD, ornaments: ['grain'] },
  rope: { ...WOOD, ornaments: ['grain', 'rope'] },
  crooked: { post: 'hsl(260 10% 20% / 1)', board: 'hsl(270 8% 34% / 1)', edge: 'hsl(260 12% 14% / 1)', text: 'hsl(80 40% 85% / 1)', tilt: -0.12, ornaments: ['web'] },
  steel: { ...STEEL, ornaments: ['rivets'] },
  hazard: { ...STEEL, ornaments: ['rivets', 'hazard'] },
  neon: { post: 'hsl(240 20% 14% / 1)', board: 'hsl(240 30% 8% / 1)', edge: null, text: null, ornaments: ['neon'] },
  stone: { ...STONE, ornaments: ['chips'] },
  crystal: { ...STONE, ornaments: ['chips', 'shard'] },
  ember: { post: 'hsl(15 15% 16% / 1)', board: 'hsl(15 12% 22% / 1)', edge: 'hsl(15 15% 10% / 1)', text: 'hsl(30 100% 65% / 1)', ornaments: ['embers'] },
  candy: { post: 'hsl(0 0% 97% / 1)', board: 'hsl(330 80% 72% / 1)', edge: 'hsl(330 60% 50% / 1)', text: 'hsl(0 0% 100% / 1)', ornaments: ['candy', 'sprinkles'] },
  carnival: { post: 'hsl(0 0% 97% / 1)', board: 'hsl(355 75% 55% / 1)', edge: 'hsl(45 95% 60% / 1)', text: 'hsl(48 100% 90% / 1)', ornaments: ['candy', 'bulbs'] },
  frost: { post: 'hsl(205 30% 55% / 1)', board: 'hsl(200 55% 78% / 1)', edge: 'hsl(205 40% 45% / 1)', text: 'hsl(210 45% 22% / 1)', ornaments: ['snow'] },
  vines: { ...WOOD, ornaments: ['grain', 'vines'] },
  blossom: { ...WOOD, ornaments: ['grain', 'petals'] },
  autumn: { ...WOOD, ornaments: ['grain', 'leaves'] },
  savanna: { ...WOOD, ornaments: ['grain', 'grass'] },
  mushroom: { post: 'hsl(40 35% 85% / 1)', board: 'hsl(35 30% 72% / 1)', edge: 'hsl(30 25% 45% / 1)', text: 'hsl(20 40% 18% / 1)', ornaments: ['cap'] },
  hive: { post: 'hsl(30 40% 30% / 1)', board: 'hsl(42 90% 58% / 1)', edge: 'hsl(35 70% 35% / 1)', text: 'hsl(30 60% 16% / 1)', ornaments: ['honey'] },
  paper: { post: 'hsl(0 0% 96% / 1)', board: 'hsl(0 0% 99% / 1)', edge: null, text: null, ornaments: ['sketch'] },
  library: { post: 'hsl(26 40% 28% / 1)', board: 'hsl(350 50% 36% / 1)', edge: 'hsl(350 50% 22% / 1)', text: 'hsl(45 80% 75% / 1)', ornaments: ['spine'] },
  lantern: { post: 'hsl(5 55% 30% / 1)', board: 'hsl(5 70% 42% / 1)', edge: 'hsl(45 80% 55% / 1)', text: 'hsl(45 90% 80% / 1)', ornaments: ['lantern'] },
  sky: { post: 'hsl(210 30% 85% / 1)', board: 'hsl(205 70% 88% / 1)', edge: 'hsl(210 45% 60% / 1)', text: 'hsl(215 50% 30% / 1)', ornaments: ['clouds'] },
  coral: { post: 'hsl(12 70% 62% / 1)', board: 'hsl(185 45% 40% / 1)', edge: 'hsl(190 50% 25% / 1)', text: 'hsl(180 60% 92% / 1)', ornaments: ['bubbles'] },
};

const THEME_STYLES = {
  country: 'wood', harbor: 'rope', pirate: 'rope', dunes: 'rope', haunted: 'crooked',
  city: 'steel', office: 'steel', ship: 'steel', lunar: 'steel', factory: 'hazard', lab: 'hazard', mine: 'hazard',
  neon: 'neon', synthwave: 'neon', matrix: 'neon', void: 'neon', ruins: 'stone', cathedral: 'stone', crystal: 'crystal',
  ember: 'ember', inferno: 'ember', candy: 'candy', carnival: 'carnival', frost: 'frost', jungle: 'vines', bayou: 'vines',
  blossom: 'blossom', autumn: 'autumn', savanna: 'savanna', mushroom: 'mushroom', hive: 'hive', paper: 'paper',
  library: 'library', lantern: 'lantern', sky: 'sky', deep: 'coral',
};

function board(ctx, b) {
  const tipX = b.dir < 0 ? b.x - SIGN.tip : b.x + b.w + SIGN.tip;
  const body = b.dir < 0 ? b.x : b.x + b.w;
  ctx.beginPath();
  ctx.moveTo(b.dir < 0 ? b.x + b.w : b.x, b.y);
  ctx.lineTo(body, b.y);
  ctx.lineTo(tipX, b.y + b.h / 2);
  ctx.lineTo(body, b.y + b.h);
  ctx.lineTo(b.dir < 0 ? b.x + b.w : b.x, b.y + b.h);
  ctx.closePath();
}

const signSide = level => {
  const near = level.start.x < WIDTH / 2 ? -1 : 1;
  return level.index === 0 ? -near : near;
};

function bulbsAround(m) {
  const spots = [], perimeter = 2 * (m.w + m.h), count = Math.floor(perimeter / MARQUEE.spacing);
  for (let i = 0; i < count; i++) {
    let d = (i / count) * perimeter;
    if (d < m.w) spots.push([m.x + d, m.y]);
    else if ((d -= m.w) < m.h) spots.push([m.x + m.w, m.y + d]);
    else if ((d -= m.h) < m.w) spots.push([m.x + m.w - d, m.y + m.h]);
    else spots.push([m.x, m.y + m.h - (d - m.w)]);
  }
  return spots;
}

function drawMarquee(ctx, x, top, time) {
  const m = { x: x - MARQUEE.w / 2, y: top - MARQUEE.rise, w: MARQUEE.w, h: MARQUEE.h }, step = Math.floor(time / MARQUEE.chase);
  roundRect(ctx, x - 3, m.y + m.h, 6, MARQUEE.rise - m.h, 2);
  ctx.fillStyle = 'hsl(240 15% 22% / 1)';
  ctx.fill();
  roundRect(ctx, m.x, m.y, m.w, m.h, 6);
  ctx.fillStyle = 'hsl(345 70% 30% / 1)';
  ctx.fill();
  ctx.strokeStyle = 'hsl(45 95% 60% / 1)';
  ctx.lineWidth = 2;
  ctx.stroke();
  bulbsAround(m).forEach(([bx, by], i) => {
    const lit = (i + step) % 3 !== 0, hue = (i * 47 + step * 30) % 360;
    if (lit) dot(ctx, `hsl(${hue} 100% 65% / 0.3)`, bx, by, MARQUEE.bulb * 2.4);
    dot(ctx, lit ? `hsl(${hue} 100% 70% / 1)` : 'hsl(0 0% 30% / 1)', bx, by, MARQUEE.bulb);
  });
  ctx.fillStyle = step % 6 < 3 ? 'hsl(48 100% 88% / 1)' : 'hsl(48 100% 70% / 1)';
  ctx.font = font(900, 13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FREE GEAR', x, m.y + m.h / 2 + 1);
}

export function drawSignpost(ctx, level, p, theme, time, freeGear = false) {
  const style = STYLES[THEME_STYLES[theme.id] ?? 'wood'], dir = signSide(level);
  const floor = (level.rows - 1) * TILE, mouth = MOUTH.w * TILE;
  const x = dir < 0 ? mouth + SIGN.gap : WIDTH - mouth - SIGN.gap, top = floor - SIGN.post;
  const b = { x: x - SIGN.w / 2, y: top + 6, w: SIGN.w, h: SIGN.h, dir };
  const scene = { x, floor, top, theme };
  if (freeGear) drawMarquee(ctx, x, top, time);
  roundRect(ctx, x - 4, top, 8, SIGN.post, 3);
  ctx.fillStyle = style.post;
  ctx.fill();
  ctx.save();
  if (style.tilt) { ctx.translate(x, b.y + b.h / 2); ctx.rotate(style.tilt * dir); ctx.translate(-x, -(b.y + b.h / 2)); }
  board(ctx, b);
  ctx.fillStyle = style.board;
  ctx.fill();
  ctx.strokeStyle = style.edge ?? p.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const name of style.ornaments) ORNAMENTS[name](ctx, b, scene, p, time);
  ctx.fillStyle = style.text ?? (style.edge === null && style.ornaments.includes('neon') ? p.accent : p.ink);
  ctx.font = font(900, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHOPS', b.x + b.w / 2 + dir * 4, b.y + b.h / 2 + 1);
  ctx.restore();
}
