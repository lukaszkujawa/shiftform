import { HEIGHT, WIDTH, TILE, COLS, EMPTY, tileAt } from './level.js';
import { Rng, mix, hashString } from './rng.js';
import { FAMILIES } from './life-shapes.js';

const TAU = Math.PI * 2;
export const DEPTHS = [0.35, 0.55, 0.75];
const PATTERNS = ['glide', 'wave', 'loop', 'swoop'];
const PLANT_CHANCE = 0.45;
const WALKER_CHANCE = 0.12;
const WALK_MIN_TILES = 3;
const FLYERS_PER_SCREEN = 1.5;
const MARGIN = 120;
const ROOT_SINK = 4;
const WALKER_SCALE = 0.8;
const PLANT_ALPHA = 0.32;
const WALKER_ALPHA = 0.5;

function band(height, depth) {
  const reach = HEIGHT / (2 * depth);
  return [HEIGHT / 2 - reach, height - HEIGHT / 2 + reach];
}

export function surfaces(level) {
  const runs = [];
  for (let row = 1; row < level.rows; row++) {
    let start = -1;
    for (let col = 0; col <= COLS; col++) {
      const top = col < COLS && tileAt(level, col, row) !== EMPTY && tileAt(level, col, row - 1) === EMPTY;
      if (top && start < 0) start = col;
      if (!top && start >= 0) {
        runs.push({ x0: start * TILE, x1: col * TILE, y: row * TILE });
        start = -1;
      }
    }
  }
  return runs;
}

function rotation(rng, generators) {
  const order = rng.shuffle([...generators]);
  let next = rng.int(0, order.length - 1);
  return () => order[next++ % order.length](rng);
}

export function growLife(level, theme) {
  const rng = new Rng(mix(level.palette * 131 + (level.index ?? 0) * 17 + 1, hashString(theme.id)));
  const family = FAMILIES[theme.id];
  const nextPlant = rotation(rng, family.plants);
  const plants = [], walkers = [];
  for (const run of surfaces(level)) {
    const tiles = (run.x1 - run.x0) / TILE;
    for (let k = 0; k < Math.ceil(tiles / 6); k++) {
      if (!rng.chance(PLANT_CHANCE)) continue;
      plants.push({ ...nextPlant(), x: run.x0 + rng.float(0.15, 0.85) * (run.x1 - run.x0), y: run.y + ROOT_SINK, scale: rng.float(0.5, 0.8), phase: rng.float(0, TAU) });
    }
    if (family.walkers.length && tiles >= WALK_MIN_TILES && rng.chance(WALKER_CHANCE)) {
      walkers.push({ ...rng.pick(family.walkers)(rng), x0: run.x0 + 12, x1: run.x1 - 12, y: run.y, scale: WALKER_SCALE, speed: rng.float(12, 22), phase: rng.float(0, TAU) });
    }
  }
  const nextFlyer = rotation(rng, family.flyers);
  const count = Math.max(2, Math.round((level.height / HEIGHT) * FLYERS_PER_SCREEN));
  const flyers = Array.from({ length: count }, (_, i) => {
    const depth = rng.pick(DEPTHS);
    const [lo, hi] = band(level.height, depth);
    return {
      ...nextFlyer(), depth, pattern: rng.pick(PATTERNS),
      y: lo + ((i + rng.float(0.2, 0.8)) / count) * (hi - lo),
      x: rng.float(0, WIDTH), dir: rng.chance(0.5) ? 1 : -1, speed: rng.float(10, 26),
      scale: 0.45 + 0.7 * depth, phase: rng.float(0, TAU),
    };
  });
  const depth = rng.pick(DEPTHS);
  const [lo, hi] = band(level.height, depth);
  const drifter = { ...rng.pick(family.drifters)(rng), x: 0, y: rng.float(lo, hi), depth, dir: rng.chance(0.5) ? 1 : -1, scale: 0.45 + 0.7 * depth, phase: rng.float(0, TAU) };
  return { plants, walkers, flyers, drifter };
}

const screenY = (y, depth, offset, camera) => HEIGHT / 2 + (offset + y - camera - HEIGHT / 2) * depth;
const alphaOf = depth => 0.14 + 0.26 * depth;
const visible = y => y >= -MARGIN && y <= HEIGHT + MARGIN;

function crossing(mover, t) {
  const span = WIDTH + 2 * MARGIN;
  const head = ((((mover.x + t * mover.speed) % span) + span) % span) - MARGIN;
  return mover.dir > 0 ? head : WIDTH - head;
}

export function flightPath(flyer, t) {
  const x = crossing(flyer, t), a = t + flyer.phase;
  switch (flyer.pattern) {
    case 'wave': return { x, y: Math.sin(x / 90 + flyer.phase) * 40, tilt: Math.cos(x / 90 + flyer.phase) * 0.35 * flyer.dir };
    case 'loop': return { x: x + Math.cos(a * 1.1) * 36, y: Math.sin(a * 1.1) * 36, tilt: 0 };
    case 'swoop': return { x, y: -Math.abs(Math.sin(a * 0.45)) * 70, tilt: -Math.sin(a * 0.9) * 0.3 * flyer.dir };
    default: return { x, y: Math.sin(a * 0.8) * 8, tilt: 0 };
  }
}

export function walkPath(walker, t) {
  const length = walker.x1 - walker.x0;
  const a = (t * walker.speed) / length * Math.PI + walker.phase;
  return { x: walker.x0 + length * (0.5 - 0.5 * Math.cos(a)), dir: Math.sin(a) >= 0 ? 1 : -1, lift: walker.hop * Math.abs(Math.sin(a * 6)) };
}

function drawPlant(ctx, plant, palette, t, makePath) {
  ctx.rotate(Math.sin(t * 0.7 + plant.phase) * 0.04 * plant.flex);
  for (const part of plant.parts) {
    if (!part.path) {
      part.path = makePath();
      part.build(part.path);
    }
    if (part.mode === 'fill') {
      ctx.fillStyle = palette[part.color];
      ctx.fill(part.path);
    } else {
      ctx.strokeStyle = palette[part.color];
      ctx.lineWidth = part.width;
      ctx.stroke(part.path);
    }
  }
}

function drawCreature(ctx, creature, x, y, dir, tilt, alpha, colors, t) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(creature.scale * dir, creature.scale);
  creature.draw(ctx, t + creature.phase, colors);
  ctx.restore();
}

export function drawLife(ctx, life, palette, offset, camera, time, makePath = () => new Path2D()) {
  const t = time / 1000;
  const colors = { primary: palette.accent, secondary: palette.rockEdge, ink: palette.ink };
  const d = life.drifter;
  const dy = screenY(d.y, d.depth, offset, camera);
  if (visible(dy)) {
    const x = crossing(d, t);
    for (const m of d.members) drawCreature(ctx, d, x - d.dir * m.dx, dy + m.dy + Math.sin(t * 1.1 + m.phase) * 6, d.dir, 0, alphaOf(d.depth), colors, t + m.phase);
  }
  for (const f of life.flyers) {
    const path = flightPath(f, t);
    const y = screenY(f.y, f.depth, offset, camera) + path.y;
    if (visible(y)) drawCreature(ctx, f, path.x, y, f.dir, path.tilt, alphaOf(f.depth), colors, t);
  }
  for (const p of life.plants) {
    const y = offset + p.y - camera;
    if (!visible(y)) continue;
    ctx.save();
    ctx.globalAlpha = PLANT_ALPHA;
    ctx.translate(p.x, y);
    ctx.scale(p.scale, p.scale);
    drawPlant(ctx, p, palette, t, makePath);
    ctx.restore();
  }
  for (const w of life.walkers) {
    const y = offset + w.y - camera;
    if (!visible(y)) continue;
    const step = walkPath(w, t);
    drawCreature(ctx, w, step.x, y - (w.foot + step.lift) * w.scale, step.dir, 0, WALKER_ALPHA, colors, t);
  }
}
