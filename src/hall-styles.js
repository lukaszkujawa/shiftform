import { WIDTH, TILE, ROWS } from './level.js?v=5f043fa';
import { HALL_CEILING } from './tunnel.js?v=5f043fa';
import { TAU, roundRect } from './paint.js?v=5f043fa';

const C = HALL_CEILING * TILE;
const F = (ROWS - 1) * TILE;
const DRIP = { cycle: 140, fall: 100 };

const fill = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
const disc = (ctx, color, x, y, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const stroke = (ctx, color, width, ...pts) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
};
const glow = (ctx, color, x, y, r) => {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'hsl(0 0% 0% / 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
};
const spots = (n, salt) => Array.from({ length: n }, (_, i) => ({ x: ((i * 397 + salt * 131) % 1000) / 1000, y: ((i * 211 + salt * 71) % 1000) / 1000, k: i }));
const flicker = (time, i) => 0.85 + 0.15 * Math.sin(time / 90 + i * 2) * Math.sin(time / 37 + i);

function lanterns(ctx, time, color, n = 4) {
  for (let i = 0; i < n; i++) {
    const x = (WIDTH * (i + 0.5)) / n, sway = Math.sin(time / 900 + i) * 3;
    stroke(ctx, 'hsl(30 20% 40% / 1)', 1.5, x, C, x + sway, C + 26);
    glow(ctx, color.replace('/ 1)', `/ ${0.32 * flicker(time, i)})`), x + sway, C + 36, 44);
    roundRect(ctx, x + sway - 7, C + 26, 14, 18, 5);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function bricks(ctx, color, w, h) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = C + h, row = 0; y < F; y += h, row++) {
    ctx.moveTo(0, y); ctx.lineTo(WIDTH, y);
    for (let x = (row % 2) * w / 2; x < WIDTH; x += w) { ctx.moveTo(x, y - h); ctx.lineTo(x, y); }
  }
  ctx.stroke();
}

function gear(ctx, color, x, y, r, teeth, angle) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = angle + (i * Math.PI) / teeth, rr = i % 2 ? r : r * 1.18;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  disc(ctx, 'hsl(28 30% 22% / 1)', x, y, r * 0.35);
}

export const HALL_STYLES = [
  {
    ceiling: 'hsl(20 15% 18% / 1)', wall: 'hsl(15 22% 24% / 1)', floor: 'hsl(20 18% 14% / 1)', trim: 'hsl(25 35% 40% / 1)',
    shop: 'hsl(42 95% 58% / 1)', rules: 'hsl(275 70% 62% / 1)',
    merchant: { tint: 'hsl(35 90% 82% / 1)', top: 'tophat', glasses: 'monocle' }, rulesmith: { tint: 'hsl(265 60% 86% / 1)', top: 'crown', glasses: 'round' },
    gear: 'hsl(145 65% 50% / 1)', outfitter: { tint: 'hsl(120 50% 84% / 1)', top: 'tuft', glasses: 'square' },
    paint(ctx, time) {
      bricks(ctx, 'hsl(15 25% 14% / 0.6)', 48, 24);
      lanterns(ctx, time, 'hsl(40 100% 62% / 1)');
    },
  },
  {
    ceiling: 'hsl(25 14% 12% / 1)', wall: 'hsl(25 16% 18% / 1)', floor: 'hsl(25 15% 11% / 1)', trim: 'hsl(30 35% 30% / 1)',
    shop: 'hsl(38 90% 55% / 1)', rules: 'hsl(190 60% 55% / 1)',
    merchant: { tint: 'hsl(20 70% 80% / 1)', top: 'cap', glasses: 'square' }, rulesmith: { tint: 'hsl(200 80% 84% / 1)', top: 'beanie', glasses: 'round' },
    gear: 'hsl(160 55% 45% / 1)', outfitter: { tint: 'hsl(90 55% 82% / 1)', top: 'bow', glasses: 'shades' },
    paint(ctx, time) {
      for (const s of spots(18, 3)) disc(ctx, 'hsl(25 14% 23% / 1)', s.x * WIDTH, C + 10 + s.y * (F - C - 30), 6 + (s.k % 4) * 3);
      for (const s of spots(10, 9)) disc(ctx, `hsl(48 100% 65% / ${0.4 + 0.6 * Math.abs(Math.sin(time / 600 + s.k))})`, s.x * WIDTH, C + 20 + s.y * (F - C - 60), 1.8);
      for (let x = 80; x < WIDTH; x += 200) {
        fill(ctx, 'hsl(28 45% 30% / 1)', x - 6, C, 12, F - C);
        fill(ctx, 'hsl(28 45% 34% / 1)', x - 40, C, 80, 12);
        glow(ctx, `hsl(38 100% 60% / ${0.35 * flicker(time, x)})`, x + 26, C + 32, 40);
        disc(ctx, 'hsl(40 100% 65% / 1)', x + 26, C + 30, 5);
        stroke(ctx, 'hsl(0 0% 15% / 1)', 1.2, x + 26, C + 12, x + 26, C + 25);
      }
      stroke(ctx, 'hsl(210 10% 55% / 1)', 2, 0, F - 4, WIDTH, F - 4);
      for (let x = 10; x < WIDTH; x += 26) fill(ctx, 'hsl(28 40% 26% / 1)', x, F - 3, 14, 3);
    },
  },
  {
    ceiling: 'hsl(250 30% 10% / 1)', wall: 'hsl(245 26% 15% / 1)', floor: 'hsl(250 28% 9% / 1)', trim: 'hsl(185 60% 45% / 1)',
    shop: 'hsl(185 80% 55% / 1)', rules: 'hsl(300 70% 65% / 1)',
    merchant: { tint: 'hsl(200 80% 84% / 1)', top: 'tophat', glasses: 'shades' }, rulesmith: { tint: 'hsl(300 60% 86% / 1)', top: 'crown', glasses: 'square' },
    gear: 'hsl(130 70% 55% / 1)', outfitter: { tint: 'hsl(160 60% 84% / 1)', top: 'beanie', glasses: 'round' },
    paint(ctx, time) {
      for (const s of spots(14, 5)) disc(ctx, 'hsl(245 24% 19% / 1)', s.x * WIDTH, C + 20 + s.y * (F - C - 40), 14 + (s.k % 3) * 8);
      for (let x = 20; x < WIDTH; x += 46) { ctx.fillStyle = 'hsl(250 30% 10% / 1)'; ctx.beginPath(); ctx.moveTo(x, C); ctx.lineTo(x + 8, C + 14 + (x % 5) * 5); ctx.lineTo(x + 16, C); ctx.fill(); }
      [[120, 'hsl(185 90% 60% / 1)'], [470, 'hsl(300 80% 70% / 1)'], [840, 'hsl(185 90% 60% / 1)']].forEach(([x, color], i) => {
        glow(ctx, color.replace('/ 1)', `/ ${0.3 + 0.1 * Math.sin(time / 500 + i)})`), x, F - 20, 60);
        for (const [dx, h, lean] of [[-10, 34, -0.3], [0, 48, 0], [11, 28, 0.35]]) {
          ctx.save(); ctx.translate(x + dx, F); ctx.rotate(lean);
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-6, -h + 10); ctx.lineTo(0, -h); ctx.lineTo(6, -h + 10); ctx.lineTo(6, 0); ctx.fill();
          ctx.restore();
        }
      });
    },
  },
  {
    ceiling: 'hsl(200 10% 20% / 1)', wall: 'hsl(200 12% 30% / 1)', floor: 'hsl(200 12% 18% / 1)', trim: 'hsl(200 15% 50% / 1)',
    shop: 'hsl(30 85% 58% / 1)', rules: 'hsl(160 55% 48% / 1)',
    merchant: { tint: 'hsl(55 90% 80% / 1)', top: 'beanie', glasses: 'monocle' }, rulesmith: { tint: 'hsl(150 55% 80% / 1)', top: 'party', glasses: 'round' },
    gear: 'hsl(95 60% 48% / 1)', outfitter: { tint: 'hsl(30 80% 84% / 1)', top: 'tuft', glasses: 'shades' },
    paint(ctx, time) {
      for (let x = 0; x < WIDTH; x += 160) {
        ctx.fillStyle = 'hsl(200 14% 22% / 1)';
        ctx.beginPath(); ctx.moveTo(x + 20, F - 16); ctx.lineTo(x + 20, C + 90); ctx.arc(x + 80, C + 90, 60, Math.PI, TAU); ctx.lineTo(x + 140, F - 16); ctx.fill();
      }
      fill(ctx, 'hsl(200 12% 34% / 1)', 0, C + 4, WIDTH, 24);
      fill(ctx, 'hsl(200 70% 38% / 1)', 0, C + 8, WIDTH, 12);
      for (let x = (time / 30) % 40 - 40; x < WIDTH; x += 40) stroke(ctx, 'hsl(195 80% 78% / 0.7)', 1.5, x, C + 13, x + 16, C + 13);
      fill(ctx, 'hsl(200 15% 42% / 1)', 0, C + 26, WIDTH, 2);
      for (const [k, x] of [400, 720].entries()) {
        const cycle = (time / 7 + k * 70) % DRIP.cycle, fall = Math.min(1, cycle / DRIP.fall), splash = cycle - DRIP.fall;
        fill(ctx, 'hsl(200 12% 28% / 1)', x - 5, C + 26, 10, 6);
        if (splash < 0) disc(ctx, 'hsl(195 80% 75% / 0.85)', x, C + 34 + (F - C - 36) * fall * fall, 2);
        else {
          ctx.strokeStyle = `hsl(195 80% 75% / ${0.6 * (1 - splash / (DRIP.cycle - DRIP.fall))})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, F - 2, 3 + splash / 3, 1.5 + splash / 14, 0, 0, TAU); ctx.stroke();
        }
      }
      for (let x = 0; x < WIDTH; x += 64) stroke(ctx, 'hsl(200 12% 24% / 1)', 1, x, F, x, F + 30);
      lanterns(ctx, time, 'hsl(48 90% 70% / 1)', 3);
    },
  },
  {
    ceiling: 'hsl(330 30% 13% / 1)', wall: 'hsl(20 28% 20% / 1)', floor: 'hsl(15 30% 14% / 1)', trim: 'hsl(45 80% 55% / 1)',
    shop: 'hsl(350 80% 58% / 1)', rules: 'hsl(180 60% 45% / 1)',
    merchant: { tint: 'hsl(20 70% 80% / 1)', top: 'party', glasses: null }, rulesmith: { tint: 'hsl(340 75% 85% / 1)', top: 'crown', glasses: 'monocle' },
    gear: 'hsl(140 65% 50% / 1)', outfitter: { tint: 'hsl(60 80% 84% / 1)', top: 'bow', glasses: 'round' },
    paint(ctx, time) {
      const cloth = ['hsl(350 70% 42% / 1)', 'hsl(45 85% 50% / 1)', 'hsl(180 55% 35% / 1)'];
      for (let i = 0, x = 0; x < WIDTH; x += 80, i++) {
        ctx.fillStyle = cloth[i % 3];
        ctx.beginPath(); ctx.moveTo(x, C); ctx.lineTo(x + 80, C); ctx.quadraticCurveTo(x + 40, C + 46, x, C); ctx.fill();
      }
      for (let i = 0; i < 24; i++) {
        const x = i * 41 + 10, y = C + 70 + Math.sin(i * 0.9) * 10;
        disc(ctx, `hsl(${(i * 47) % 360} 90% 65% / ${0.6 + 0.4 * Math.sin(time / 300 + i)})`, x, y, 2.6);
      }
      stroke(ctx, 'hsl(0 0% 20% / 0.6)', 1, ...Array.from({ length: 24 }, (_, i) => [i * 41 + 10, C + 70 + Math.sin(i * 0.9) * 10]).flat());
      fill(ctx, 'hsl(350 50% 30% / 1)', 200, F - 4, 560, 4);
      for (let x = 210; x < 750; x += 30) fill(ctx, 'hsl(45 70% 50% / 1)', x, F - 3, 10, 2);
    },
  },
  {
    ceiling: 'hsl(210 10% 16% / 1)', wall: 'hsl(195 15% 80% / 1)', floor: 'hsl(210 10% 24% / 1)', trim: 'hsl(210 10% 40% / 1)',
    shop: 'hsl(14 85% 55% / 1)', rules: 'hsl(220 70% 55% / 1)',
    merchant: { tint: 'hsl(150 55% 80% / 1)', top: 'cap', glasses: 'round' }, rulesmith: { tint: 'hsl(220 60% 84% / 1)', top: 'tophat', glasses: 'square' },
    gear: 'hsl(165 60% 45% / 1)', outfitter: { tint: 'hsl(35 90% 84% / 1)', top: 'party', glasses: 'monocle' },
    paint(ctx, time) {
      ctx.strokeStyle = 'hsl(195 12% 70% / 1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = C; y < F; y += 16) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
      for (let x = 0; x < WIDTH; x += 16) { ctx.moveTo(x, C); ctx.lineTo(x, F); }
      ctx.stroke();
      fill(ctx, 'hsl(14 80% 52% / 1)', 0, C + 110, WIDTH, 12);
      fill(ctx, 'hsl(210 30% 25% / 1)', 0, C + 124, WIDTH, 4);
      for (let x = 60; x < WIDTH; x += 220) {
        const on = Math.sin(time / 50 + x) > -0.97;
        fill(ctx, on ? 'hsl(190 30% 96% / 1)' : 'hsl(190 10% 60% / 1)', x, C + 4, 100, 5);
        if (on) glow(ctx, 'hsl(190 60% 95% / 0.25)', x + 50, C + 8, 70);
      }
      for (const x of [110, 850]) { fill(ctx, 'hsl(210 15% 35% / 1)', x - 30, F - 18, 60, 5); fill(ctx, 'hsl(210 15% 30% / 1)', x - 26, F - 13, 4, 13); fill(ctx, 'hsl(210 15% 30% / 1)', x + 22, F - 13, 4, 13); }
    },
  },
  {
    ceiling: 'hsl(160 25% 9% / 1)', wall: 'hsl(150 22% 13% / 1)', floor: 'hsl(140 25% 10% / 1)', trim: 'hsl(120 40% 35% / 1)',
    shop: 'hsl(30 90% 58% / 1)', rules: 'hsl(280 60% 62% / 1)',
    merchant: { tint: 'hsl(35 90% 82% / 1)', top: 'leaf', glasses: 'round' }, rulesmith: { tint: 'hsl(265 60% 86% / 1)', top: 'antenna', glasses: 'monocle' },
    gear: 'hsl(110 55% 50% / 1)', outfitter: { tint: 'hsl(330 60% 86% / 1)', top: 'tuft', glasses: 'square' },
    paint(ctx, time) {
      for (const s of spots(16, 7)) disc(ctx, 'hsl(140 30% 18% / 1)', s.x * WIDTH, C + 10 + s.y * 70, 10 + (s.k % 3) * 6);
      for (let x = 30; x < WIDTH; x += 70) stroke(ctx, 'hsl(30 30% 28% / 1)', 2, x, C, x + 6, C + 30 + (x % 7) * 6, x - 2, C + 50 + (x % 5) * 6);
      [[80, 1], [360, 0.7], [560, 1.2], [910, 0.8]].forEach(([x, k], i) => {
        const glowing = `hsl(${i % 2 ? 190 : 300} 80% 65% / 1)`;
        glow(ctx, glowing.replace('/ 1)', `/ ${0.25 + 0.08 * Math.sin(time / 700 + i)})`), x, F - 30 * k, 50 * k);
        fill(ctx, 'hsl(40 30% 80% / 1)', x - 3 * k, F - 28 * k, 6 * k, 28 * k);
        ctx.fillStyle = glowing; ctx.beginPath(); ctx.arc(x, F - 26 * k, 16 * k, Math.PI, TAU); ctx.fill();
      });
      for (let i = 0; i < 8; i++) disc(ctx, `hsl(70 100% 70% / ${0.4 + 0.5 * Math.abs(Math.sin(time / 400 + i * 1.7))})`, (i * 127 + time / 40) % WIDTH, C + 60 + ((i * 53) % 160) + Math.sin(time / 500 + i) * 8, 1.8);
    },
  },
  {
    ceiling: 'hsl(28 30% 15% / 1)', wall: 'hsl(30 32% 30% / 1)', floor: 'hsl(28 30% 18% / 1)', trim: 'hsl(30 40% 45% / 1)',
    shop: 'hsl(48 95% 55% / 1)', rules: 'hsl(205 70% 55% / 1)',
    merchant: { tint: 'hsl(55 90% 80% / 1)', top: 'beanie', glasses: 'square' }, rulesmith: { tint: 'hsl(200 80% 84% / 1)', top: 'tophat', glasses: 'monocle' },
    gear: 'hsl(150 60% 45% / 1)', outfitter: { tint: 'hsl(15 70% 82% / 1)', top: 'leaf', glasses: 'shades' },
    paint(ctx, time) {
      ctx.strokeStyle = 'hsl(28 30% 22% / 1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < WIDTH; x += 36) { ctx.moveTo(x, C); ctx.lineTo(x, F); }
      ctx.stroke();
      for (let x = 0; x < WIDTH; x += 120) fill(ctx, 'hsl(28 35% 22% / 1)', x, C, 18, 18);
      gear(ctx, 'hsl(35 30% 45% / 1)', 150, C + 90, 30, 10, time / 900);
      gear(ctx, 'hsl(35 25% 40% / 1)', 196, C + 120, 18, 8, -time / 540);
      gear(ctx, 'hsl(35 30% 45% / 1)', 790, C + 100, 34, 12, time / 1000);
      for (const x of [420, 560]) { fill(ctx, 'hsl(28 40% 22% / 1)', x, C + 130, 90, 6); for (let k = 0; k < 4; k++) fill(ctx, `hsl(${k * 70 + 20} 50% 55% / 1)`, x + 8 + k * 20, C + 114, 12, 16); }
      stroke(ctx, 'hsl(0 0% 15% / 1)', 1.2, 480, C, 480, C + 40);
      glow(ctx, `hsl(48 100% 70% / ${0.35 * flicker(time, 3)})`, 480, C + 46, 60);
      disc(ctx, 'hsl(48 100% 80% / 1)', 480, C + 46, 6);
    },
  },
];

export const styleOf = hall => HALL_STYLES[hall.variant % HALL_STYLES.length];
