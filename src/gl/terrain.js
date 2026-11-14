import { TILE, COLS, SOLID, ONE_WAY, tileAt } from '../world/level.js';
import { THREE, toon, mesh, roundBox, placed, merged, sphere, pebble, cone, cylinder, seeded } from './toon.js';

export const FRONT = 18;
export const BACK = -42;
const DEPTH = FRONT - BACK;
const MID = (FRONT + BACK) / 2;
const CAP = 9;
const LOOK = {
  earth: 'hsl(26 46% 42% / 1)', earthDark: 'hsl(24 42% 30% / 1)', pebble: 'hsl(30 18% 62% / 1)',
  grass: 'hsl(100 62% 48% / 1)', grassDark: 'hsl(110 55% 34% / 1)', plank: 'hsl(32 58% 52% / 1)',
  petals: ['hsl(48 98% 60% / 1)', 'hsl(350 85% 70% / 1)', 'hsl(280 60% 75% / 1)', 'hsl(0 0% 98% / 1)', 'hsl(200 85% 70% / 1)'],
  stem: 'hsl(110 50% 38% / 1)', mushroom: 'hsl(5 78% 55% / 1)', dots: 'hsl(40 60% 95% / 1)', bush: 'hsl(115 45% 40% / 1)',
};

const CORNER = 7;
const BEVEL = 4;

function outlines(level, solid) {
  const edges = new Map(), key = (x, y) => `${x},${y}`;
  const edge = (x0, y0, x1, y1) => {
    const from = key(x0, y0);
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from).push([x1, y1, x1 - x0, y1 - y0]);
  };
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solid(c, r)) continue;
      if (!solid(c, r - 1)) edge(c, r, c + 1, r);
      if (!solid(c + 1, r)) edge(c + 1, r, c + 1, r + 1);
      if (!solid(c, r + 1)) edge(c + 1, r + 1, c, r + 1);
      if (!solid(c - 1, r)) edge(c, r + 1, c, r);
    }
  }
  const loops = [];
  for (const [start, outgoing] of edges) {
    while (outgoing.length) {
      const loop = [];
      let [x, y] = start.split(',').map(Number), heading = null;
      for (;;) {
        const choices = edges.get(key(x, y));
        if (!choices?.length) break;
        const pick = heading ? choices.findIndex(([, , dx, dy]) => dx === -heading[1] && dy === heading[0]) : -1;
        const [nx, ny, dx, dy] = choices.splice(pick >= 0 ? pick : 0, 1)[0];
        if (!heading || dx !== heading[0] || dy !== heading[1]) loop.push([x, y]);
        heading = [dx, dy];
        [x, y] = [nx, ny];
        if (key(x, y) === start) break;
      }
      if (loop.length > 2) loops.push(loop.map(([gx, gy]) => new THREE.Vector2(gx * TILE, -gy * TILE)));
    }
  }
  return loops;
}

function rounded(path, points) {
  const n = points.length;
  points.forEach((corner, i) => {
    const before = points[(i + n - 1) % n], after = points[(i + 1) % n];
    const a = corner.clone().add(before.clone().sub(corner).setLength(CORNER)), b = corner.clone().add(after.clone().sub(corner).setLength(CORNER));
    if (i) path.lineTo(a.x, a.y); else path.moveTo(a.x, a.y);
    path.quadraticCurveTo(corner.x, corner.y, b.x, b.y);
  });
  path.closePath();
  return path;
}

const inside = (point, polygon) => polygon.reduce((hit, a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x ? !hit : hit;
}, false);

function rock(level, solid) {
  const loops = outlines(level, solid);
  const outer = loops.filter(loop => THREE.ShapeUtils.isClockWise(loop)), holes = loops.filter(loop => !THREE.ShapeUtils.isClockWise(loop));
  const shapes = outer.map(loop => ({ loop, shape: rounded(new THREE.Shape(), loop), area: Math.abs(THREE.ShapeUtils.area(loop)) }));
  for (const hole of holes) {
    const probe = hole[0].clone().add(hole[1]).multiplyScalar(0.5).add(new THREE.Vector2(0.5, 0.5));
    const home = shapes.filter(({ loop }) => inside(probe, loop)).sort((a, b) => a.area - b.area)[0];
    home?.shape.holes.push(rounded(new THREE.Path(), hole));
  }
  if (!shapes.length) return null;
  const geometry = new THREE.ExtrudeGeometry(shapes.map(({ shape }) => shape), { depth: DEPTH - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelOffset: -BEVEL, bevelSegments: 2, curveSegments: 3 });
  geometry.translate(0, 0, BACK + BEVEL);
  geometry.deleteAttribute('uv');
  return geometry;
}

function runs(level, edge) {
  const found = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!edge(c, r)) continue;
      let w = 1;
      while (c + w < COLS && edge(c + w, r)) w++;
      found.push({ c, r, w });
      c += w - 1;
    }
  }
  return found;
}

function grassCap(run, top, rand, below) {
  const x = run.c * TILE, w = run.w * TILE, y = below ? -(run.r + 1) * TILE + CAP / 2 - 1 : -run.r * TILE - CAP / 2 + 1;
  const parts = [placed(roundBox(w + 4, CAP, DEPTH + 4, 4, 2), x + w / 2, y, MID)];
  for (let dx = 6; dx < w - 2; dx += 7 + rand() * 6) {
    const drop = 3 + rand() * 4;
    parts.push(placed(pebble, x + dx, y + (below ? 1 : -1) * (CAP / 2 + drop * 0.25), FRONT + 1.5, { sx: 3.2, sy: drop, sz: 2.2 }));
  }
  return top(parts);
}

function plants(level, rand, tops) {
  const stems = [], heads = new Map(), caps = [], dots = [], bushes = [];
  const head = (css, part) => heads.set(css, [...(heads.get(css) ?? []), part]);
  for (const { c, r } of tops) {
    const x = c * TILE, ground = -r * TILE;
    const roll = rand();
    const z = BACK + 8 + rand() * 22;
    if (roll < 0.22) {
      const tall = 10 + rand() * 12, fx = x + 6 + rand() * 18, color = LOOK.petals[Math.floor(rand() * LOOK.petals.length)];
      stems.push(placed(cylinder, fx, ground + tall / 2, z, { sx: 0.9, sy: tall, sz: 0.9 }));
      for (let k = 0; k < 5; k++) head(color, placed(sphere, fx + Math.cos((k / 5) * Math.PI * 2) * 3, ground + tall + Math.sin((k / 5) * Math.PI * 2) * 3, z, { sx: 2.4, sy: 2.4, sz: 1.2 }));
      head(LOOK.petals[0], placed(sphere, fx, ground + tall, z + 1, { sx: 1.8, sy: 1.8, sz: 1.4 }));
    } else if (roll < 0.3) {
      const mx = x + 8 + rand() * 14, size = 4 + rand() * 3;
      stems.push(placed(cylinder, mx, ground + size * 0.7, z, { sx: size * 0.35, sy: size * 1.4, sz: size * 0.35 }));
      caps.push(placed(sphere, mx, ground + size * 1.4, z, { sx: size, sy: size * 0.7, sz: size }));
      dots.push(placed(sphere, mx - size * 0.4, ground + size * 1.75, z + size * 0.55, { sx: 1, sy: 1, sz: 0.6 }));
      dots.push(placed(sphere, mx + size * 0.35, ground + size * 1.6, z + size * 0.75, { sx: 0.8, sy: 0.8, sz: 0.6 }));
    } else if (roll < 0.42) {
      const bx = x + rand() * TILE, size = 7 + rand() * 6;
      for (let k = 0; k < 3; k++) bushes.push(placed(sphere, bx + (k - 1) * size * 0.8, ground + size * (k === 1 ? 0.7 : 0.45), BACK + 10, { sx: size * 0.75, sy: size * (k === 1 ? 0.8 : 0.6), sz: size * 0.6 }));
    } else if (roll < 0.75) {
      for (let k = 0; k < 3; k++) stems.push(placed(cone, x + 6 + rand() * 18, ground + 3, z + rand() * 6, { sx: 1.4, sy: 6 + rand() * 6, sz: 1.4, rz: (rand() - 0.5) * 0.6 }));
    }
  }
  const group = new THREE.Group();
  const add = (parts, css, outline = 1) => { if (parts.length) group.add(mesh(merged(parts), toon(css), outline)); };
  add(stems, LOOK.stem, 0);
  for (const [css, parts] of heads) add(parts, css, 0.8);
  add(caps, LOOK.mushroom);
  add(dots, LOOK.dots, 0);
  add(bushes, LOOK.bush);
  return group;
}

export function buildTerrain(level) {
  const rand = seeded(level.palette * 7919 + level.rows * 31 + (level.index ?? 0) + 1);
  const group = new THREE.Group();
  const solid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < level.rows && tileAt(level, c, r) === SOLID;
  const pebbles = [], grass = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solid(c, r) || rand() > 0.45) continue;
      const size = 1.5 + rand() * 2.5;
      pebbles.push(placed(pebble, (c + 0.2 + rand() * 0.6) * TILE, -(r + 0.35 + rand() * 0.5) * TILE, FRONT, { sx: size * 1.3, sy: size, sz: 1.2 }));
    }
  }
  const upsideDown = level.rules.baseGravDir < 0, bothFaces = level.rules.jumpFlipChance > 0;
  const tops = runs(level, (c, r) => solid(c, r) && !solid(c, r - 1) && r > 0);
  const bottoms = runs(level, (c, r) => solid(c, r) && !solid(c, r + 1) && r < level.rows - 1);
  const top = parts => grass.push(...parts);
  if (!upsideDown || bothFaces) for (const run of tops) grassCap(run, top, rand, false);
  if (upsideDown || bothFaces) for (const run of bottoms) grassCap(run, top, rand, true);
  const body = rock(level, solid);
  if (body) group.add(mesh(body, toon(LOOK.earth), 1.6, { weld: true }));
  if (pebbles.length) group.add(mesh(merged(pebbles), toon(LOOK.earthDark), 0));
  if (grass.length) group.add(mesh(merged(grass), toon(LOOK.grass), 1.4));
  const planks = runs(level, (c, r) => tileAt(level, c, r) === ONE_WAY).map(({ c, r, w }) => placed(roundBox(w * TILE, 8, DEPTH * 0.6, 3), (c + w / 2) * TILE, -r * TILE - 4, MID + 6));
  if (planks.length) group.add(mesh(merged(planks), toon(LOOK.plank), 1.3));
  const tiles = [];
  if (!upsideDown) for (const run of tops) for (let k = 0; k < run.w; k++) tiles.push({ c: run.c + k, r: run.r });
  group.add(plants(level, rand, tiles));
  return group;
}
