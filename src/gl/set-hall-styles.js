import { WIDTH, TILE, ROWS } from '../world/level.js?v=cb728ba';
import { HALL_CEILING } from '../world/tunnel.js?v=cb728ba';
import { alpha } from '../art/themes.js?v=cb728ba';
import { TAU } from '../art/paint.js?v=cb728ba';
import { THREE, toon, colorOf, opacityOf, mesh, shape, roundBox, placed, sphere, cone, cylinder, glowing, shining } from './toon.js?v=cb728ba';
import { glow, cutout, strand } from './set-kit.js?v=cb728ba';

export const C = HALL_CEILING * TILE;
export const F = (ROWS - 1) * TILE;
export const WALL_Z = -42;
export const MARGIN = 48;
const LEFT = -MARGIN, RIGHT = WIDTH + MARGIN;
const CORD = 'hsl(30 20% 40% / 1)';
const CAP = 'hsl(28 25% 18% / 1)';
const DRIP = { cycle: 140, fall: 100 };

const spots = (n, salt) => Array.from({ length: n }, (_, i) => ({ x: ((i * 397 + salt * 131) % 1000) / 1000, y: ((i * 211 + salt * 71) % 1000) / 1000, k: i }));
const flicker = (time, i) => 0.85 + 0.15 * Math.sin(time / 90 + i * 2) * Math.sin(time / 37 + i);
const box = (x0, y0, x1, y1, z0, z1, r = 1) => placed(roundBox(x1 - x0, y1 - y0, z1 - z0, r, 2), (x0 + x1) / 2, -(y0 + y1) / 2, (z0 + z1) / 2);
const disc = (ctx, color, x, y, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - C, r, 0, TAU); ctx.fill(); };
const lines = (ctx, color, width, draw) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); draw(); ctx.stroke(); };

function lantern(group, color, x, i, z = -24) {
  const pivot = new THREE.Group(), cord = mesh(cylinder, toon(CORD), 0), body = mesh(roundBox(14, 18, 14, 5), glowing(color), 1.2);
  cord.scale.set(0.75, 26, 0.75);
  cord.position.y = -13;
  body.position.y = -35;
  const caps = [-26, -44].map(y => { const cap = mesh(shape('set:hall-cap', () => roundBox(10, 3, 10, 1)), toon(CAP), 0.8); cap.position.y = y; return cap; });
  const halo = glow(alpha(color, 0.32), 44, 0, -36, WALL_Z - z + 2);
  pivot.position.set(x, -C, z);
  pivot.add(cord, shining(body, color, { power: 1.3, reach: 220 }), halo, ...caps);
  group.add(pivot);
  return time => {
    pivot.rotation.z = Math.asin(Math.sin(time / 900 + i) * 3 / 26);
    halo.material.opacity = 0.32 * flicker(time, i);
  };
}

function bulb(group, { x, top, length, r, color, halo, reach, key, z = -30 }) {
  const cord = mesh(cylinder, toon('hsl(0 0% 15% / 1)'), 0), light = mesh(sphere, glowing(color), 0.8);
  cord.scale.set(0.6, length, 0.6);
  cord.position.set(x, -(top + length / 2), z);
  light.scale.setScalar(r);
  light.position.set(x, -(top + length + r), z);
  const shine = glow(halo, reach, x, -(top + length + r), WALL_Z + 2);
  group.add(cord, shining(light, color, { power: 1.1, reach: 180 }), shine);
  return time => { shine.material.opacity = opacityOf(halo) * flicker(time, key); };
}

function gearShape(r, teeth) {
  const points = Array.from({ length: teeth * 2 }, (_, i) => {
    const a = (i * Math.PI) / teeth, rr = i % 2 ? r : r * 1.18;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
  return cutout(points, 5, 0.8);
}

export const HALL_LOOKS = [
  {
    wall(ctx) {
      lines(ctx, 'hsl(15 25% 14% / 0.6)', 1, () => {
        for (let y = 24, row = 0; y < F - C; y += 24, row++) {
          ctx.moveTo(LEFT, y); ctx.lineTo(RIGHT, y);
          for (let x = (row % 2) * 24 + LEFT; x < RIGHT; x += 48) { ctx.moveTo(x, y - 24); ctx.lineTo(x, y); }
        }
      });
    },
    decor({ group }) {
      const swings = Array.from({ length: 4 }, (_, i) => lantern(group, 'hsl(40 100% 62% / 1)', (WIDTH * (i + 0.5)) / 4, i));
      return time => swings.forEach(swing => swing(time));
    },
  },
  {
    wall(ctx) {
      for (const s of spots(18, 3)) disc(ctx, 'hsl(25 14% 23% / 1)', s.x * WIDTH, C + 10 + s.y * (F - C - 30), 6 + (s.k % 4) * 3);
    },
    decor({ group, parts }) {
      const specks = spots(10, 9).map(s => {
        const speck = mesh(sphere, glowing('hsl(48 100% 65% / 1)'), 0);
        speck.scale.setScalar(1.8);
        speck.position.set(s.x * WIDTH, -(C + 20 + s.y * (F - C - 60)), WALL_Z + 1);
        group.add(speck);
        return { speck, k: s.k };
      });
      const lamps = [];
      for (let x = 80; x < WIDTH; x += 200) {
        parts.add('hsl(28 45% 30% / 1)', box(x - 6, C, x + 6, F, WALL_Z, WALL_Z + 10, 1.5), { outline: 1.2 });
        parts.add('hsl(28 45% 34% / 1)', box(x - 40, C, x + 40, C + 12, WALL_Z, WALL_Z + 14, 1.5), { outline: 1.2 });
        lamps.push(bulb(group, { x: x + 26, top: C + 12, length: 13, r: 5, color: 'hsl(40 100% 65% / 1)', halo: 'hsl(38 100% 60% / 0.35)', reach: 40, key: x, z: WALL_Z + 8 }));
      }
      for (let x = 10; x < WIDTH; x += 26) parts.add('hsl(28 40% 26% / 1)', box(x, F - 3, x + 14, F, -36, -18, 0.8), { outline: 0.8 });
      for (const z of [-32, -22]) parts.add('hsl(210 10% 55% / 1)', placed(cylinder, WIDTH / 2, -(F - 4), z, { sx: 1.4, sy: RIGHT - LEFT, sz: 1.4, rz: Math.PI / 2 }), { outline: 0.8 });
      return time => {
        for (const { speck, k } of specks) speck.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(time / 600 + k));
        lamps.forEach(lamp => lamp(time));
      };
    },
  },
  {
    wall(ctx) {
      for (const s of spots(14, 5)) disc(ctx, 'hsl(245 24% 19% / 1)', s.x * WIDTH, C + 20 + s.y * (F - C - 40), 14 + (s.k % 3) * 8);
    },
    decor({ group, parts }) {
      for (let x = 20; x < WIDTH; x += 46) parts.add('hsl(250 30% 14% / 1)', placed(cone, x + 8, -(C + (14 + (x % 5) * 5) / 2), -34, { sx: 8, sy: 14 + (x % 5) * 5, sz: 7, rz: Math.PI }), { outline: 1 });
      const glows = [[120, 'hsl(185 90% 60% / 1)'], [470, 'hsl(300 80% 70% / 1)'], [840, 'hsl(185 90% 60% / 1)']].map(([x, color]) => {
        for (const [dx, h, lean] of [[-10, 34, -0.3], [0, 48, 0], [11, 28, 0.35]]) {
          const crystal = new THREE.Group(), body = mesh(new THREE.CylinderGeometry(6, 6, h - 10, 6), toon(color, { emissive: 0.45 }), 1.2), tip = mesh(new THREE.ConeGeometry(6, 10, 6), toon(color, { emissive: 0.6 }), 1.2);
          body.position.y = (h - 10) / 2;
          tip.position.y = h - 5;
          crystal.add(body, tip);
          crystal.position.set(x + dx, -F, -26 + dx * 0.4);
          crystal.rotation.z = -lean;
          group.add(crystal);
        }
        const halo = glow(alpha(color, 0.3), 60, x, -(F - 20), WALL_Z + 2);
        group.add(halo);
        return halo;
      });
      return time => glows.forEach((halo, i) => { halo.material.opacity = 0.3 + 0.1 * Math.sin(time / 500 + i); });
    },
  },
  {
    wall(ctx) {
      ctx.fillStyle = 'hsl(200 14% 22% / 1)';
      for (let x = -160; x < RIGHT; x += 160) { ctx.beginPath(); ctx.moveTo(x + 20, F - 16 - C); ctx.lineTo(x + 20, 90); ctx.arc(x + 80, 90, 60, Math.PI, TAU); ctx.lineTo(x + 140, F - 16 - C); ctx.fill(); }
      ctx.fillStyle = 'hsl(200 12% 34% / 1)';
      ctx.fillRect(LEFT, 4, RIGHT - LEFT, 24);
    },
    decor({ group, parts }) {
      parts.add('hsl(200 70% 38% / 1)', box(LEFT, C + 8, RIGHT, C + 20, WALL_Z, -30, 0.5));
      parts.add('hsl(200 15% 42% / 1)', box(LEFT, C + 20, RIGHT, C + 28, WALL_Z, -26, 1.5), { outline: 1.2 });
      const streaks = Array.from({ length: Math.ceil(WIDTH / 40) + 2 }, () => {
        const streak = mesh(shape('set:hall-streak', () => roundBox(16, 1.5, 1.5, 0.7)), glowing('hsl(195 80% 78% / 0.7)'), 0);
        group.add(streak);
        return streak;
      });
      const drips = [400, 720].map((x, k) => {
        parts.add('hsl(200 12% 28% / 1)', box(x - 5, C + 26, x + 5, C + 32, -36, -26, 1), { outline: 1 });
        const drop = mesh(sphere, glowing('hsl(195 80% 75% / 0.85)'), 0), ring = mesh(shape('set:hall-ring', () => new THREE.TorusGeometry(1, 0.12, 4, 24).rotateX(Math.PI / 2)), glowing('hsl(195 80% 75% / 0.6)'), 0);
        drop.scale.setScalar(2);
        ring.position.set(x, -(F - 1), -31);
        group.add(drop, ring);
        return { x, k, drop, ring };
      });
      const swings = Array.from({ length: 3 }, (_, i) => lantern(group, 'hsl(48 90% 70% / 1)', (WIDTH * (i + 0.5)) / 3, i, -20));
      return time => {
        streaks.forEach((streak, k) => streak.position.set((time / 30) % 40 - 40 + k * 40 + 8, -(C + 13), -29.6));
        for (const { x, k, drop, ring } of drips) {
          const cycle = (time / 7 + k * 70) % DRIP.cycle, fall = Math.min(1, cycle / DRIP.fall), splash = cycle - DRIP.fall;
          drop.visible = splash < 0;
          ring.visible = !drop.visible;
          drop.position.set(x, -(C + 34 + (F - C - 36) * fall * fall), -31);
          ring.scale.set(3 + splash / 3, 1, 1.5 + splash / 14);
          ring.material.opacity = 0.6 * (1 - splash / (DRIP.cycle - DRIP.fall));
        }
        swings.forEach(swing => swing(time));
      };
    },
  },
  {
    wall() {},
    decor({ group, parts }) {
      const cloth = ['hsl(350 70% 42% / 1)', 'hsl(45 85% 50% / 1)', 'hsl(180 55% 35% / 1)'];
      for (let i = 0, x = 0; x < WIDTH; x += 80, i++) {
        const swag = [[x, C], [x + 80, C], ...Array.from({ length: 9 }, (_, k) => { const t = (k + 1) / 10, u = 1 - t; return [u * u * (x + 80) + 2 * u * t * (x + 40) + t * t * x, C + 2 * u * t * 46]; })];
        parts.add(cloth[i % 3], placed(cutout(swag, 2, 0.6), 0, 0, -36), { outline: 0.9, weld: true });
      }
      const points = Array.from({ length: 24 }, (_, i) => [i * 41 + 10, C + 70 + Math.sin(i * 0.9) * 10, -30]);
      parts.add('hsl(0 0% 20% / 1)', strand(points, 0.5, 96));
      const bulbs = points.map(([x, y, z], i) => {
        const light = mesh(sphere, glowing(`hsl(${(i * 47) % 360} 90% 65% / 1)`), 0.6);
        light.scale.setScalar(2.6);
        light.position.set(x, -(y + 2), z);
        group.add(light);
        return light;
      });
      parts.add('hsl(350 50% 30% / 1)', box(200, F - 1.5, 760, F + 1, -40, -26, 0.6), { outline: 0.8 });
      for (let x = 210; x < 750; x += 30) parts.add('hsl(45 70% 50% / 1)', box(x, F - 2.2, x + 10, F - 1, -36, -30, 0.3));
      return time => bulbs.forEach((light, i) => { light.material.opacity = 0.6 + 0.4 * Math.sin(time / 300 + i); });
    },
  },
  {
    wall(ctx) {
      lines(ctx, 'hsl(195 12% 70% / 1)', 1, () => {
        for (let y = 0; y < F - C; y += 16) { ctx.moveTo(LEFT, y); ctx.lineTo(RIGHT, y); }
        for (let x = LEFT; x < RIGHT; x += 16) { ctx.moveTo(x, 0); ctx.lineTo(x, F - C); }
      });
    },
    decor({ group, parts }) {
      parts.add('hsl(14 80% 52% / 1)', box(LEFT, C + 110, RIGHT, C + 122, WALL_Z, WALL_Z + 3, 0.8), { outline: 0.8 });
      parts.add('hsl(210 30% 25% / 1)', box(LEFT, C + 124, RIGHT, C + 128, WALL_Z, WALL_Z + 2, 0.5));
      const lights = [];
      for (let x = 60; x < WIDTH; x += 220) {
        parts.add('hsl(210 15% 30% / 1)', box(x - 3, C, x + 103, C + 4, -38, -22, 1), { outline: 1 });
        const tube = mesh(roundBox(100, 5, 8, 2.4), glowing('hsl(190 30% 96% / 1)'), 1), halo = glow('hsl(190 60% 95% / 0.25)', 70, x + 50, -(C + 8), WALL_Z + 2);
        tube.position.set(x + 50, -(C + 6.5), -30);
        group.add(tube, halo);
        lights.push({ x, tube, halo });
      }
      for (const x of [110, 850]) {
        parts.add('hsl(210 15% 35% / 1)', box(x - 30, F - 18, x + 30, F - 13, -38, -24, 1.5), { outline: 1.2 });
        for (const lx of [x - 26, x + 22]) parts.add('hsl(210 15% 30% / 1)', box(lx, F - 13, lx + 4, F, -34, -28, 0.8), { outline: 1 });
      }
      const on = colorOf('hsl(190 30% 96% / 1)'), off = colorOf('hsl(190 10% 60% / 1)');
      return time => {
        for (const { x, tube, halo } of lights) {
          const shining = Math.sin(time / 50 + x) > -0.97;
          tube.material.color.copy(shining ? on : off);
          halo.visible = shining;
        }
      };
    },
  },
  {
    wall(ctx) {
      for (const s of spots(16, 7)) disc(ctx, 'hsl(140 30% 18% / 1)', s.x * WIDTH, C + 10 + s.y * 70, 10 + (s.k % 3) * 6);
    },
    decor({ group, parts }) {
      for (let x = 30; x < WIDTH; x += 70) parts.add('hsl(30 30% 28% / 1)', strand([[x, C - 2, -36], [x + 6, C + 30 + (x % 7) * 6, -36], [x - 2, C + 50 + (x % 5) * 6, -35]], 1.2, 12), { outline: 0.6 });
      const glows = [[80, 1], [360, 0.7], [560, 1.2], [910, 0.8]].map(([x, k], i) => {
        const color = `hsl(${i % 2 ? 190 : 300} 80% 65% / 1)`;
        parts.add('hsl(40 30% 80% / 1)', placed(cylinder, x, -(F - 14 * k), -30, { sx: 3 * k, sy: 28 * k, sz: 3 * k }), { outline: 1 });
        const cap = mesh(shape('set:dome', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(color, { emissive: 0.55 }), 1.2);
        cap.scale.set(16 * k, 12 * k, 14 * k);
        cap.position.set(x, -(F - 26 * k), -30);
        const halo = glow(alpha(color, 0.25), 50 * k, x, -(F - 30 * k), WALL_Z + 2);
        group.add(cap, halo);
        return halo;
      });
      const flies = Array.from({ length: 8 }, () => {
        const fly = mesh(sphere, glowing('hsl(70 100% 70% / 1)'), 0);
        fly.scale.setScalar(1.8);
        group.add(fly);
        return fly;
      });
      return time => {
        glows.forEach((halo, i) => { halo.material.opacity = 0.25 + 0.08 * Math.sin(time / 700 + i); });
        flies.forEach((fly, i) => {
          fly.position.set((i * 127 + time / 40) % WIDTH, -(C + 60 + ((i * 53) % 160) + Math.sin(time / 500 + i) * 8), -22 - (i % 3) * 5);
          fly.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(time / 400 + i * 1.7));
        });
      };
    },
  },
  {
    wall(ctx) {
      lines(ctx, 'hsl(28 30% 22% / 1)', 2, () => { for (let x = LEFT; x < RIGHT; x += 36) { ctx.moveTo(x, 0); ctx.lineTo(x, F - C); } });
    },
    decor({ group, parts }) {
      for (let x = 0; x < WIDTH; x += 120) parts.add('hsl(28 35% 22% / 1)', box(x, C, x + 18, C + 18, WALL_Z, WALL_Z + 18, 1.5), { outline: 1.2 });
      const gears = [[150, 90, 30, 10, 900, 'hsl(35 30% 45% / 1)'], [196, 120, 18, 8, -540, 'hsl(35 25% 40% / 1)'], [790, 100, 34, 12, 1000, 'hsl(35 30% 45% / 1)']].map(([x, y, r, teeth, period, color]) => {
        const gear = mesh(gearShape(r, teeth), toon(color), 1.2, { weld: true });
        const hub = mesh(cylinder, toon('hsl(28 30% 22% / 1)'), 0.8);
        hub.scale.set(r * 0.35, 7, r * 0.35);
        hub.rotation.x = Math.PI / 2;
        gear.add(hub);
        gear.position.set(x, -(C + y), WALL_Z + 5);
        group.add(gear);
        return { gear, period };
      });
      for (const x of [420, 560]) {
        parts.add('hsl(28 40% 22% / 1)', box(x, C + 130, x + 90, C + 136, WALL_Z, WALL_Z + 14, 1), { outline: 1 });
        for (let k = 0; k < 4; k++) parts.add(`hsl(${k * 70 + 20} 50% 55% / 1)`, box(x + 8 + k * 20, C + 114, x + 20 + k * 20, C + 130, WALL_Z + 1, WALL_Z + 11, 1), { outline: 1 });
      }
      const lamp = bulb(group, { x: 480, top: C, length: 40, r: 6, color: 'hsl(48 100% 80% / 1)', halo: 'hsl(48 100% 70% / 0.35)', reach: 60, key: 3, z: -30 });
      return time => {
        for (const { gear, period } of gears) gear.rotation.z = -time / period;
        lamp(time);
      };
    },
  },
];
