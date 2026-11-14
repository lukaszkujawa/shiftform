import { TILE, COLS, SOLID, ONE_WAY, tileAt } from '../world/level.js';
import { shade } from '../art/themes.js';
import { THREE, toon, mesh, createPainter, roundBox, box, placed, sphere, pebble, cone, cylinder, seeded, gem, hex } from './toon.js';
import { kitOf } from './kits.js';
import { homeOf } from '../world/home.js';
import { pick } from './kit.js';

export const FRONT = 18;
export const BACK = -42;
const DEPTH = FRONT - BACK;
const MID = (FRONT + BACK) / 2;
const LOOK = {
  wood: 'hsl(32 58% 52% / 1)', woodDark: 'hsl(26 48% 34% / 1)', stem: 'hsl(110 50% 38% / 1)', leaf: 'hsl(115 45% 40% / 1)', white: 'hsl(0 0% 98% / 1)',
  stone: 'hsl(220 8% 62% / 1)', ice: 'hsl(195 80% 88% / 1)', gold: 'hsl(45 90% 58% / 1)', orange: 'hsl(26 90% 55% / 1)', flame: 'hsl(40 100% 62% / 1)',
  petals: ['hsl(48 98% 60% / 1)', 'hsl(350 85% 70% / 1)', 'hsl(280 60% 75% / 1)', 'hsl(0 0% 98% / 1)', 'hsl(200 85% 70% / 1)'],
  candy: ['hsl(350 85% 62% / 1)', 'hsl(48 95% 62% / 1)', 'hsl(190 80% 60% / 1)', 'hsl(120 60% 55% / 1)', 'hsl(280 70% 70% / 1)', 'hsl(0 0% 98% / 1)'],
  spines: ['hsl(5 55% 40% / 1)', 'hsl(210 45% 38% / 1)', 'hsl(140 35% 32% / 1)', 'hsl(40 60% 45% / 1)', 'hsl(280 30% 38% / 1)', 'hsl(25 50% 30% / 1)'],
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


const ring = new THREE.TorusGeometry(1, 0.28, 6, 14);


function slab(paint, css, x, w, surface, dir, { height, overhang = 2, radius = 3, outline = 1.4, depth = DEPTH + 4 }) {
  paint.add(css, placed(roundBox(w + overhang * 2, height, depth, radius, 2), x + w / 2, surface - dir * (height / 2 - 1), MID), { outline });
}

function drips(paint, css, x, w, surface, dir, rand, { size = 1, z = FRONT + 1.5 } = {}) {
  for (let dx = 6; dx < w - 2; dx += 7 + rand() * 6) {
    const drop = (3 + rand() * 4) * size;
    paint.add(css, placed(pebble, x + dx, surface - dir * (8 * size + drop * 0.25), z, { sx: 3.2 * size, sy: drop, sz: 2.2 * size }));
  }
}

const CAPS = {
  drips(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 9, radius: 4 });
    drips(paint, p.rockEdge, x, w, surface, dir, rand);
  },
  snow(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 10, overhang: 4, radius: 5 });
    for (let dx = 5; dx < w - 3; dx += 9 + rand() * 8) paint.add(p.rockEdge, placed(pebble, x + dx, surface + dir * 1.5, MID + (rand() - 0.5) * 30, { sx: 6 + rand() * 4, sy: 3 + rand() * 2, sz: 6 + rand() * 4 }), { outline: 1.2 });
    drips(paint, p.rockEdge, x, w, surface, dir, rand, { size: 1.25 });
  },
  icing(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 8, overhang: 3, radius: 4 });
    drips(paint, p.rockEdge, x, w, surface, dir, rand, { size: 1.35 });
    for (let k = 0; k < w / 5; k++) paint.add(pick(rand, LOOK.candy), placed(box, x + rand() * w, surface + dir * 0.6, MID + (rand() - 0.5) * DEPTH, { sx: 4, sy: 1.4, sz: 1.4, ry: rand() * 3, rx: Math.PI / 2 }));
  },
  slab(paint, p, x, w, surface, dir) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 7, radius: 3 });
  },
  plate(paint, p, x, w, surface, dir) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 6, overhang: 1, radius: 1.5 });
    for (let dx = 7; dx < w; dx += 15) paint.add(p.rockDeep, placed(pebble, x + dx, surface - dir * 3, FRONT + 2.4, { sx: 1.5, sy: 1.5, sz: 1 }));
  },
  glow(paint, p, x, w, surface, dir) {
    slab(paint, p.rockDeep, x, w, surface, dir, { height: 4, overhang: 0, radius: 1.5, outline: 0 });
    for (const z of [FRONT + 0.6, BACK - 0.6]) paint.add(p.rockEdge, placed(box, x + w / 2, surface, z, { sx: w, sy: 2, sz: 2 }), { glow: true });
  },
  coral(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 8, radius: 4 });
    for (let dx = 4; dx < w - 2; dx += 6 + rand() * 6) paint.add(rand() < 0.3 ? p.accent : p.rockEdge, placed(pebble, x + dx, surface + dir * 1.5, MID + (rand() - 0.5) * DEPTH, { sx: 3 + rand() * 2, sy: 2.5 + rand() * 2, sz: 3 + rand() * 2 }), { outline: 0.8 });
  },
  cloud(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 8, overhang: 4, radius: 4, outline: 0 });
    for (let dx = 0; dx <= w; dx += 8 + rand() * 6) paint.add(p.rockEdge, placed(sphere, x + dx, surface - dir * 3, FRONT - 4 - rand() * 10, { sx: 7 + rand() * 4, sy: 6 + rand() * 3, sz: 7 }), { outline: 1 });
  },
  planks(paint, p, x, w, surface, dir, rand) {
    for (let dx = 0; dx < w; dx += TILE) paint.add(rand() < 0.5 ? p.rockEdge : shade(p.rockEdge, -6), placed(box, x + dx + TILE / 2, surface - dir * (2.5 + rand() * 0.8), MID, { sx: TILE - 1.5, sy: 7, sz: DEPTH + 4, rz: (rand() - 0.5) * 0.03 }), { outline: 1.2 });
  },
  tiles(paint, p, x, w, surface, dir) {
    slab(paint, shade(p.rockEdge, -20), x, w, surface, dir, { height: 4, overhang: 4, radius: 1.5 });
    for (let dx = 4; dx < w + 2; dx += 9) paint.add(p.rockEdge, placed(cylinder, x + dx, surface + dir * 1.5, MID, { sx: 4.5, sy: DEPTH + 8, sz: 4.5, rx: Math.PI / 2 }), { outline: 1 });
  },
  gems(paint, p, x, w, surface, dir, rand) {
    slab(paint, p.rockEdge, x, w, surface, dir, { height: 6, radius: 2 });
    for (let dx = 5; dx < w; dx += 8 + rand() * 12) paint.add(p.rockEdge, placed(gem, x + dx, surface + dir * 4, MID + (rand() - 0.5) * DEPTH * 0.8, { sx: 3, sy: 6 + rand() * 5, sz: 3, rz: (rand() - 0.5) * 0.5 }), { outline: 1 });
  },
};

const glowy = theme => (theme.glow ? { glow: true } : {});

const DETAILS = {
  none() {},
  pebbles(paint, p, x, y, rand) {
    if (rand() > 0.45) return;
    const size = 1.5 + rand() * 2.5;
    paint.add(p.rockDeep, placed(pebble, x + (0.2 + rand() * 0.6) * TILE, y - (0.35 + rand() * 0.5) * TILE, FRONT, { sx: size * 1.3, sy: size, sz: 1.2 }));
  },
  sprinkles(paint, p, x, y, rand) {
    for (let k = 0; k < 3; k++) paint.add(pick(rand, LOOK.candy), placed(box, x + 4 + rand() * 22, y - 4 - rand() * 22, FRONT + 0.4, { sx: 5, sy: 1.6, sz: 1.6, rz: rand() * 3 }));
  },
  gems(paint, p, x, y, rand, theme) {
    if (rand() > 0.25) return;
    paint.add(p.rockEdge, placed(gem, x + 6 + rand() * 18, y - 6 - rand() * 18, FRONT, { sx: 2.5, sy: 4, sz: 2 }), glowy(theme));
  },
  cracks(paint, p, x, y, rand, theme) {
    if (rand() > 0.3) return;
    let cx = x + 5 + rand() * 20, cy = y - 3 - rand() * 8;
    for (let k = 0; k < 3; k++) {
      const len = 5 + rand() * 6, angle = -Math.PI / 2 + (rand() - 0.5) * 1.4, nx = cx + Math.cos(angle) * len, ny = cy + Math.sin(angle) * len;
      paint.add(theme.glow ? p.rockEdge : p.rockDeep, placed(box, (cx + nx) / 2, (cy + ny) / 2, FRONT + 0.3, { sx: 1.3, sy: len + 1, sz: 1, rz: angle - Math.PI / 2 }), glowy(theme));
      [cx, cy] = [nx, ny];
    }
  },
  dots(paint, p, x, y, rand, theme) {
    if (rand() > 0.35) return;
    paint.add(p.rockEdge, placed(pebble, x + 5 + rand() * 20, y - 5 - rand() * 20, FRONT, { sx: 1.4, sy: 1.4, sz: 1 }), glowy(theme));
  },
  circuit(paint, p, x, y, rand) {
    if (rand() > 0.35) return;
    const cx = x + 6 + rand() * 12, cy = y - 6 - rand() * 12, run = 8 + rand() * 8;
    paint.add(p.rockEdge, placed(box, cx + run / 2, cy, FRONT + 0.3, { sx: run, sy: 1.4, sz: 1 }), { glow: true, opacity: 0.85 });
    paint.add(p.rockEdge, placed(box, cx + run, cy - run * 0.35, FRONT + 0.3, { sx: 1.4, sy: run * 0.7, sz: 1 }), { glow: true, opacity: 0.85 });
    paint.add(p.rockEdge, placed(pebble, cx, cy, FRONT + 0.4, { sx: 1.8, sy: 1.8, sz: 1 }), { glow: true });
  },
  scanlines(paint, p, x, y) {
    paint.add(p.rockEdge, placed(box, x + TILE / 2, y - TILE / 2, FRONT + 0.3, { sx: TILE - 2, sy: 1.2, sz: 1 }), { glow: true, opacity: 0.5 });
  },
  bricks(paint, p, x, y, rand, theme, c, r) {
    const color = shade(p.rock, 7);
    for (const row of [0, 1]) {
      const whole = (r * 2 + row) % 2 === 0, cy = y - 8 - row * 15;
      for (const cx of whole ? [TILE / 2] : [TILE / 4, (TILE * 3) / 4]) paint.add(color, placed(box, x + cx, cy, FRONT + 0.2, { sx: whole ? TILE - 2 : TILE / 2 - 2, sy: 13, sz: 1.2 }));
    }
  },
  lines(paint, p, x, y) {
    paint.add(p.rockEdge, placed(box, x + TILE / 2, y - TILE / 2, FRONT + 0.2, { sx: TILE, sy: 1, sz: 0.6 }));
  },
  tiles(paint, p, x, y) {
    paint.add(shade(p.rock, 6), placed(box, x + TILE / 2, y - TILE / 2, FRONT + 0.2, { sx: TILE - 3, sy: TILE - 3, sz: 1.2 }));
  },
  planks(paint, p, x, y, rand) {
    for (let k = 0; k < 3; k++) paint.add(k % 2 ? shade(p.rock, 5) : shade(p.rock, -3), placed(box, x + TILE / 2, y - 5 - k * 10, FRONT + 0.2, { sx: TILE - 1, sy: 9, sz: 1.2 }));
  },
  rivets(paint, p, x, y) {
    for (const [dx, dy] of [[5, 5], [25, 5], [5, 25], [25, 25]]) paint.add(shade(p.rock, 16), placed(pebble, x + dx, y - dy, FRONT + 0.2, { sx: 1.6, sy: 1.6, sz: 1 }));
  },
  hex(paint, p, x, y, rand, theme, c, r) {
    paint.add(shade(p.rock, 9), placed(hex, x + TILE / 2 + (r % 2 ? TILE / 4 : -TILE / 4), y - TILE / 2, FRONT + 0.2, { sx: 8, sy: 1.4, sz: 8, rx: Math.PI / 2 }));
  },
  spines(paint, p, x, y, rand) {
    for (let bx = 2; bx < TILE - 3; bx += 4 + rand() * 2) {
      const tall = 20 + rand() * 7;
      paint.add(pick(rand, LOOK.spines), placed(box, x + bx + 1.8, y - TILE + 1 + tall / 2, FRONT + 0.6, { sx: 3.6, sy: tall, sz: 2 }));
    }
  },
  stripes(paint, p, x, y, rand, theme, c) {
    if (c % 2) paint.add(p.rockEdge, placed(box, x + TILE / 2, y - TILE / 2, FRONT + 0.2, { sx: TILE / 2, sy: TILE, sz: 1 }));
  },
  craters(paint, p, x, y, rand) {
    if (rand() > 0.22) return;
    const size = 3 + rand() * 4;
    paint.add(shade(p.rock, -10), placed(ring, x + 6 + rand() * 18, y - 6 - rand() * 18, FRONT + 0.3, { sx: size, sy: size, sz: 1 }));
  },
  strata(paint, p, x, y, rand, theme, c, r) {
    if (r % 3 === 0) paint.add(shade(p.rock, 9), placed(box, x + TILE / 2, y - 8, FRONT + 0.2, { sx: TILE, sy: 7, sz: 1.2 }));
  },
};

const HANGS = {
  icicles(paint, p, x, w, surface, rand) {
    for (let dx = 4; dx < w - 2; dx += 6 + rand() * 9) paint.add(LOOK.ice, placed(cone, x + dx, surface - 4 - rand() * 3, FRONT - 2 - rand() * 14, { sx: 2.2, sy: 7 + rand() * 9, sz: 2.2, rx: Math.PI }), { outline: 0.8 });
  },
  vines(paint, p, x, w, surface, rand) {
    for (let dx = 6; dx < w - 4; dx += 14 + rand() * 18) {
      const long = 12 + rand() * 26, z = FRONT - 4 - rand() * 10;
      paint.add(LOOK.stem, placed(cylinder, x + dx, surface - long / 2, z, { sx: 1, sy: long, sz: 1 }));
      for (let k = 6; k < long; k += 7) paint.add(LOOK.leaf, placed(pebble, x + dx + (k % 14 ? 2.5 : -2.5), surface - k, z, { sx: 2.8, sy: 1.6, sz: 1.6 }), { outline: 0.6 });
    }
  },
  roots(paint, p, x, w, surface, rand) {
    for (let dx = 5; dx < w - 3; dx += 9 + rand() * 12) {
      const long = 6 + rand() * 12;
      paint.add(p.rockDeep, placed(cylinder, x + dx, surface - long / 2, FRONT - 3 - rand() * 12, { sx: 1.1, sy: long, sz: 1.1, rz: (rand() - 0.5) * 0.7 }));
    }
  },
  crystals(paint, p, x, w, surface, rand, theme) {
    for (let dx = 6; dx < w - 3; dx += 12 + rand() * 16) paint.add(p.rockEdge, placed(gem, x + dx, surface - 5, FRONT - 4 - rand() * 12, { sx: 2.5, sy: 6 + rand() * 6, sz: 2.5 }), { outline: 1 });
  },
};

const PLANTS = {
  none() {},
  flowers(paint, p, x, g, z, rand) {
    const tall = 10 + rand() * 12, fx = x + 6 + rand() * 18, color = pick(rand, LOOK.petals);
    paint.add(LOOK.stem, placed(cylinder, fx, g + tall / 2, z, { sx: 0.9, sy: tall, sz: 0.9 }));
    for (let k = 0; k < 5; k++) paint.add(color, placed(pebble, fx + Math.cos((k / 5) * Math.PI * 2) * 3, g + tall + Math.sin((k / 5) * Math.PI * 2) * 3, z, { sx: 2.4, sy: 2.4, sz: 1.2 }), { outline: 0.8 });
    paint.add(LOOK.gold, placed(pebble, fx, g + tall, z + 1, { sx: 1.8, sy: 1.8, sz: 1.4 }));
  },
  tufts(paint, p, x, g, z, rand) {
    for (let k = 0; k < 3; k++) paint.add(shade(p.rockEdge, -8), placed(cone, x + 6 + rand() * 18, g + 3, z + rand() * 6, { sx: 1.4, sy: 6 + rand() * 6, sz: 1.4, rz: (rand() - 0.5) * 0.6 }));
  },
  bushes(paint, p, x, g, z, rand) {
    const bx = x + rand() * TILE, size = 7 + rand() * 6;
    for (let k = 0; k < 3; k++) paint.add(shade(p.rockEdge, -12), placed(pebble, bx + (k - 1) * size * 0.8, g + size * (k === 1 ? 0.7 : 0.45), BACK + 10, { sx: size * 0.75, sy: size * (k === 1 ? 0.8 : 0.6), sz: size * 0.6 }), { outline: 1 });
  },
  mushrooms(paint, p, x, g, z, rand, theme, glow = false) {
    const mx = x + 8 + rand() * 14, size = 4 + rand() * 3;
    paint.add(LOOK.white, placed(cylinder, mx, g + size * 0.7, z, { sx: size * 0.35, sy: size * 1.4, sz: size * 0.35 }));
    paint.add(glow ? p.rockEdge : 'hsl(5 78% 55% / 1)', placed(pebble, mx, g + size * 1.4, z, { sx: size, sy: size * 0.7, sz: size }), glow ? { glow: true } : { outline: 1 });
    if (!glow) paint.add(LOOK.white, placed(pebble, mx - size * 0.4, g + size * 1.75, z + size * 0.55, { sx: 1, sy: 1, sz: 0.6 }));
  },
  glowshrooms(paint, p, x, g, z, rand, theme) {
    PLANTS.mushrooms(paint, p, x, g, z, rand, theme, true);
  },
  ferns(paint, p, x, g, z, rand) {
    const fx = x + 8 + rand() * 14;
    for (let k = -2; k <= 2; k++) paint.add(shade(p.rockEdge, -10), placed(pebble, fx + k * 3.5, g + 7 - Math.abs(k) * 1.5, z, { sx: 2.2, sy: 8, sz: 1, rz: -k * 0.45 }), { outline: 0.7 });
  },
  pines(paint, p, x, g, z, rand) {
    const px = x + 8 + rand() * 14, size = 6 + rand() * 4;
    paint.add(LOOK.woodDark, placed(cylinder, px, g + 3, z, { sx: 1.4, sy: 6, sz: 1.4 }));
    for (let k = 0; k < 3; k++) paint.add('hsl(150 35% 32% / 1)', placed(cone, px, g + 7 + k * size * 0.55, z, { sx: size * (1 - k * 0.25), sy: size * 0.9, sz: size * (1 - k * 0.25) }), { outline: 1 });
    paint.add(LOOK.white, placed(cone, px, g + 7 + 2.4 * size * 0.55, z + 0.5, { sx: size * 0.4, sy: size * 0.45, sz: size * 0.4 }));
  },
  snowballs(paint, p, x, g, z, rand) {
    const sx = x + 10 + rand() * 10;
    paint.add(LOOK.white, placed(pebble, sx, g + 5, z, { sx: 5.5, sy: 5, sz: 5.5 }), { outline: 1 });
    paint.add(LOOK.white, placed(pebble, sx, g + 13, z, { sx: 3.8, sy: 3.6, sz: 3.8 }), { outline: 1 });
    paint.add(LOOK.orange, placed(cone, sx, g + 13, z + 4, { sx: 0.9, sy: 3.5, sz: 0.9, rx: Math.PI / 2 }));
  },
  cacti(paint, p, x, g, z, rand) {
    const cx = x + 10 + rand() * 10, tall = 14 + rand() * 10, green = 'hsl(120 35% 40% / 1)';
    paint.add(green, placed(roundBox(6, tall, 6, 3, 2), cx, g + tall / 2, z), { outline: 1 });
    for (const side of [-1, 1]) if (rand() < 0.7) {
      const at = g + tall * (0.4 + rand() * 0.3);
      paint.add(green, placed(roundBox(5, 4, 4, 2, 2), cx + side * 4.5, at, z), { outline: 1 });
      paint.add(green, placed(roundBox(4, 8, 4, 2, 2), cx + side * 7, at + 3, z), { outline: 1 });
    }
  },
  rocks(paint, p, x, g, z, rand) {
    for (let k = 0; k < 2; k++) {
      const size = 3 + rand() * 4;
      paint.add(shade(p.rock, 12), placed(pebble, x + 6 + rand() * 18, g + size * 0.5, z + rand() * 8, { sx: size * 1.3, sy: size, sz: size }), { outline: 1 });
    }
  },
  embers(paint, p, x, g, z, rand) {
    for (let k = 0; k < 2; k++) paint.add(p.hazard, placed(gem, x + 6 + rand() * 18, g + 2, z + rand() * 8, { sx: 2.5, sy: 2, sz: 2.5 }), { glow: true });
  },
  crystals(paint, p, x, g, z, rand) {
    const cx = x + 8 + rand() * 14;
    for (let k = -1; k <= 1; k++) paint.add(p.rockEdge, placed(gem, cx + k * 4, g + 4, z, { sx: 2.4, sy: 7 + rand() * 6 - Math.abs(k) * 3, sz: 2.4, rz: k * 0.35 }), { outline: 1 });
  },
  kelp(paint, p, x, g, z, rand) {
    const kx = x + 6 + rand() * 18, green = 'hsl(150 45% 35% / 1)';
    for (let k = 0; k < 4; k++) paint.add(green, placed(pebble, kx + (k % 2 ? 2 : -2), g + 4 + k * 7, z, { sx: 2.4, sy: 5, sz: 1.2, rz: k % 2 ? -0.4 : 0.4 }), { outline: 0.7 });
  },
  coral(paint, p, x, g, z, rand) {
    const cx = x + 8 + rand() * 14;
    for (let k = -1; k <= 1; k++) paint.add(p.accent, placed(cylinder, cx + k * 3, g + 5, z, { sx: 1.4, sy: 9 + rand() * 6 - Math.abs(k) * 3, sz: 1.4, rz: -k * 0.5 }), { outline: 0.8 });
  },
  shells(paint, p, x, g, z, rand) {
    paint.add('hsl(15 70% 82% / 1)', placed(pebble, x + 8 + rand() * 14, g + 2, z, { sx: 3.5, sy: 2.2, sz: 3 }), { outline: 0.8 });
  },
  lollipops(paint, p, x, g, z, rand) {
    const lx = x + 8 + rand() * 14, tall = 12 + rand() * 8;
    paint.add(LOOK.white, placed(cylinder, lx, g + tall / 2, z, { sx: 0.8, sy: tall, sz: 0.8 }));
    paint.add(pick(rand, LOOK.candy), placed(cylinder, lx, g + tall + 4, z, { sx: 5, sy: 2, sz: 5, rx: Math.PI / 2 }), { outline: 1 });
  },
  canes(paint, p, x, g, z, rand) {
    const cx = x + 8 + rand() * 14;
    for (let k = 0; k < 5; k++) paint.add(k % 2 ? LOOK.white : LOOK.candy[0], placed(cylinder, cx, g + 1.6 + k * 3.2, z, { sx: 1.5, sy: 3.2, sz: 1.5 }));
    paint.add(LOOK.candy[0], placed(new THREE.TorusGeometry(3, 1.5, 6, 10, Math.PI), cx + 3, g + 16, z), { outline: 0.8 });
  },
  gumdrops(paint, p, x, g, z, rand) {
    for (let k = 0; k < 2; k++) paint.add(pick(rand, LOOK.candy), placed(sphere, x + 6 + rand() * 18, g + 2, z + rand() * 6, { sx: 4, sy: 5, sz: 4 }), { outline: 1 });
  },
  pencils(paint, p, x, g, z, rand) {
    const px = x + 8 + rand() * 14, tall = 14 + rand() * 6;
    paint.add(LOOK.gold, placed(hex, px, g + tall / 2, z, { sx: 2, sy: tall, sz: 2 }), { outline: 0.8 });
    paint.add('hsl(30 50% 75% / 1)', placed(cone, px, g + tall + 2, z, { sx: 2, sy: 4, sz: 2 }));
  },
  pots(paint, p, x, g, z, rand) {
    const px = x + 10 + rand() * 10;
    paint.add('hsl(15 55% 50% / 1)', placed(cylinder, px, g + 4, z, { sx: 4.5, sy: 8, sz: 4.5 }), { outline: 1 });
    for (let k = -1; k <= 1; k++) paint.add('hsl(120 40% 38% / 1)', placed(pebble, px + k * 3, g + 13 - Math.abs(k) * 2, z, { sx: 2.5, sy: 6, sz: 2, rz: -k * 0.5 }), { outline: 0.7 });
  },
  bins(paint, p, x, g, z, rand) {
    const bx = x + 10 + rand() * 10;
    paint.add('hsl(200 8% 45% / 1)', placed(cylinder, bx, g + 6, z, { sx: 5, sy: 12, sz: 5 }), { outline: 1 });
    paint.add('hsl(200 8% 55% / 1)', placed(cylinder, bx, g + 12.5, z, { sx: 5.6, sy: 1.6, sz: 5.6 }), { outline: 1 });
  },
  vents(paint, p, x, g, z) {
    paint.add(shade(p.rockEdge, -25), placed(box, x + 15, g + 4, z, { sx: 12, sy: 8, sz: 8 }), { outline: 1 });
    for (let k = -1; k <= 1; k++) paint.add(p.rockDeep, placed(box, x + 15, g + 4 + k * 2.2, z + 4.2, { sx: 9, sy: 1, sz: 1 }));
  },
  graves(paint, p, x, g, z, rand) {
    const gx = x + 8 + rand() * 14;
    paint.add(LOOK.stone, placed(roundBox(9, 12, 4, 3.5, 2), gx, g + 5, z, { rz: (rand() - 0.5) * 0.25 }), { outline: 1 });
    paint.add(shade(LOOK.stone, -25), placed(box, gx, g + 8, z + 2.1, { sx: 5, sy: 1.2, sz: 1 }));
  },
  pumpkins(paint, p, x, g, z, rand) {
    const px = x + 8 + rand() * 14;
    paint.add(LOOK.orange, placed(pebble, px, g + 3.5, z, { sx: 5, sy: 3.8, sz: 4.5 }), { outline: 1 });
    paint.add(LOOK.stem, placed(cylinder, px, g + 8, z, { sx: 0.8, sy: 2.5, sz: 0.8 }));
  },
  leaves(paint, p, x, g, z, rand) {
    for (let k = 0; k < 5; k++) paint.add(pick(rand, [LOOK.orange, 'hsl(10 75% 48% / 1)', 'hsl(42 85% 55% / 1)']), placed(pebble, x + 6 + rand() * 18, g + 1 + rand() * 2, z + rand() * 8, { sx: 3, sy: 1, sz: 2, ry: rand() * 3 }));
  },
  columns(paint, p, x, g, z, rand) {
    const cx = x + 10 + rand() * 10, tall = 8 + rand() * 12;
    paint.add(shade(p.rockEdge, 5), placed(cylinder, cx, g + tall / 2, z, { sx: 4, sy: tall, sz: 4 }), { outline: 1 });
    paint.add(shade(p.rockEdge, 5), placed(box, cx, g + 1.5, z, { sx: 11, sy: 3, sz: 11 }), { outline: 1 });
  },
  candles(paint, p, x, g, z, rand) {
    for (let k = 0; k < 2; k++) {
      const cx = x + 8 + rand() * 14, tall = 5 + rand() * 6;
      paint.add('hsl(45 50% 92% / 1)', placed(cylinder, cx, g + tall / 2, z + k * 4, { sx: 1.6, sy: tall, sz: 1.6 }), { outline: 0.7 });
      paint.add(LOOK.flame, placed(pebble, cx, g + tall + 1.8, z + k * 4, { sx: 1, sy: 2, sz: 1 }), { glow: true });
    }
  },
  reeds(paint, p, x, g, z, rand) {
    for (let k = 0; k < 3; k++) {
      const rx = x + 6 + rand() * 18, tall = 14 + rand() * 10;
      paint.add('hsl(90 35% 35% / 1)', placed(cylinder, rx, g + tall / 2, z, { sx: 0.6, sy: tall, sz: 0.6, rz: (rand() - 0.5) * 0.2 }));
      paint.add(LOOK.woodDark, placed(cylinder, rx, g + tall - 2, z, { sx: 1.3, sy: 5, sz: 1.3 }));
    }
  },
  barrels(paint, p, x, g, z, rand) {
    const bx = x + 10 + rand() * 10;
    paint.add(LOOK.wood, placed(cylinder, bx, g + 6, z, { sx: 5, sy: 12, sz: 5 }), { outline: 1 });
    for (const y of [2.5, 9.5]) paint.add('hsl(220 8% 40% / 1)', placed(cylinder, bx, g + y, z, { sx: 5.3, sy: 1.2, sz: 5.3 }));
  },
  chests(paint, p, x, g, z, rand) {
    const cx = x + 10 + rand() * 10;
    paint.add(LOOK.woodDark, placed(box, cx, g + 4, z, { sx: 12, sy: 8, sz: 7 }), { outline: 1 });
    paint.add(LOOK.gold, placed(box, cx, g + 5.5, z, { sx: 12.4, sy: 1.4, sz: 7.4 }));
  },
  balloons(paint, p, x, g, z, rand) {
    const bx = x + 8 + rand() * 14, tall = 16 + rand() * 10;
    paint.add(LOOK.white, placed(cylinder, bx, g + tall / 2, z, { sx: 0.3, sy: tall, sz: 0.3 }));
    paint.add(pick(rand, LOOK.candy), placed(sphere, bx, g + tall + 4, z, { sx: 4.5, sy: 5.5, sz: 4.5 }), { outline: 1 });
  },
  lanterns(paint, p, x, g, z, rand) {
    const lx = x + 10 + rand() * 10;
    paint.add(LOOK.woodDark, placed(cylinder, lx, g + 6, z, { sx: 0.8, sy: 12, sz: 0.8 }));
    paint.add('hsl(5 85% 55% / 1)', placed(sphere, lx, g + 15, z, { sx: 4.5, sy: 5.5, sz: 4.5 }), { glow: true });
  },
  books(paint, p, x, g, z, rand) {
    for (let k = 0; k < 3; k++) paint.add(pick(rand, LOOK.spines), placed(box, x + 15 + (rand() - 0.5) * 3, g + 1.5 + k * 3, z, { sx: 12 - k, sy: 3, sz: 8, ry: (rand() - 0.5) * 0.5 }), { outline: 0.8 });
  },
  flasks(paint, p, x, g, z, rand) {
    const fx = x + 10 + rand() * 10;
    paint.add(p.rockEdge, placed(pebble, fx, g + 3.5, z, { sx: 4, sy: 3.5, sz: 4 }), { glow: true, opacity: 0.85 });
    paint.add(LOOK.white, placed(cylinder, fx, g + 9, z, { sx: 1.4, sy: 5, sz: 1.4 }), { opacity: 0.6 });
  },
};

export function buildTerrain(level, palette, theme) {
  if (level.hall) return new THREE.Group();
  const rand = seeded(level.palette * 7919 + level.rows * 31 + (level.index ?? 0) + 1);
  const kit = kitOf(theme), p = palette, paint = createPainter(), group = new THREE.Group();
  const solid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < level.rows && tileAt(level, c, r) === SOLID;
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < COLS; c++) if (solid(c, r)) DETAILS[kit.detail](paint, p, c * TILE, -r * TILE, rand, theme, c, r);
  const upsideDown = level.rules.baseGravDir < 0, bothFaces = level.rules.jumpFlipChance > 0;
  const tops = runs(level, (c, r) => solid(c, r) && !solid(c, r - 1) && r > 0);
  const bottoms = runs(level, (c, r) => solid(c, r) && !solid(c, r + 1) && r < level.rows - 1);
  const capped = (run, dir) => CAPS[kit.cap](paint, p, run.c * TILE, run.w * TILE, dir > 0 ? -run.r * TILE : -(run.r + 1) * TILE, dir, rand);
  if (!upsideDown || bothFaces) for (const run of tops) capped(run, 1);
  if (upsideDown || bothFaces) for (const run of bottoms) capped(run, -1);
  if (kit.hang && !upsideDown) for (const run of bottoms) HANGS[kit.hang](paint, p, run.c * TILE, run.w * TILE, -(run.r + 1) * TILE, rand, theme);
  const natural = ['drips', 'snow', 'coral'].includes(kit.cap);
  for (const { c, r, w } of runs(level, (c, r) => tileAt(level, c, r) === ONE_WAY)) paint.add(natural ? LOOK.wood : p.rockEdge, placed(roundBox(w * TILE, 8, DEPTH * 0.6, 3), (c + w / 2) * TILE, -r * TILE - 4, MID + 6), { outline: 1.3 });
  const home = homeOf(level), indoors = c => home && (c + 1) * TILE > home.x && c * TILE < home.right;
  if (!upsideDown && kit.plants.length) for (const run of tops) for (let c = run.c; c < run.c + run.w; c++) if (!indoors(c)) PLANTS[pick(rand, kit.plants)](paint, p, c * TILE, -run.r * TILE, BACK + 8 + rand() * 22, rand, theme);
  const body = rock(level, solid);
  if (body) group.add(mesh(body, toon(p.rock), kit.rim ? 2 : 1.6, { weld: true, ...(kit.rim ? { ink: p.rockEdge } : {}) }));
  paint.build(group);
  return group;
}
