import { HEIGHT, WIDTH, TILE, EMPTY, tileAt } from './level.js';
import { levelRng } from './rng.js';
import { TAU, spans } from './life-kit.js';
import { FAMILIES } from './life-shapes.js';
import { WALKER_COATS } from './life-creatures.js';

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
const WALKER = { outline: 1.4, shadow: 'hsl(240 30% 5% / 0.28)', shadowH: 3 };
const LEG = { swing: 0.35, tuck: 0.45, pace: 1.3, airborne: 0.5 };
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

function band(height, depth) {
  const reach = HEIGHT / (2 * depth);
  return [HEIGHT / 2 - reach, height - HEIGHT / 2 + reach];
}

export function surfaces(level) {
  const runs = [];
  for (let row = 1; row < level.rows; row++) {
    for (const [start, end] of spans(col => tileAt(level, col, row) !== EMPTY && tileAt(level, col, row - 1) === EMPTY)) runs.push({ x0: start * TILE, x1: end * TILE, y: row * TILE });
  }
  return runs;
}

function rotation(rng, generators) {
  const order = rng.shuffle([...generators]);
  let next = rng.int(0, order.length - 1);
  return () => order[next++ % order.length](rng);
}

export function growLife(level, theme) {
  const rng = levelRng(level, theme.id, 17, 1);
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

function drawWalker(ctx, walker, x, ground, step, t) {
  const coat = WALKER_COATS[walker.kind], ink = { primary: coat.ink, secondary: coat.ink, ink: coat.ink };
  const y = ground - (walker.foot + step.lift) * walker.scale, reach = walker.height * walker.scale * 0.45;
  ctx.fillStyle = WALKER.shadow;
  ctx.beginPath(); ctx.ellipse(x, ground, reach / (1 + step.lift * 0.05), WALKER.shadowH, 0, 0, TAU); ctx.fill();
  const legs = walker.legs, stride = legs && step.x / (walker.scale * (legs.bottom - legs.top) * LEG.pace);
  const body = legs ? { ...walker, draw: (g, time, c) => { drawLegs(g, legs, stride, step.lift > LEG.airborne, c); walker.draw(g, time, c); } } : walker;
  for (const [ox, oy] of AROUND) drawCreature(ctx, body, x + ox * WALKER.outline, y + oy * WALKER.outline, step.dir, 0, 1, ink, t);
  drawCreature(ctx, body, x, y, step.dir, 0, 1, coat, t);
}

function drawLegs(g, legs, stride, airborne, c) {
  const reach = legs.bottom - legs.top;
  g.strokeStyle = c[legs.colour];
  g.lineWidth = legs.width;
  g.lineCap = 'round';
  g.beginPath();
  legs.xs.forEach((x, i) => {
    const swing = airborne ? -reach * LEG.tuck : Math.sin(stride + i * Math.PI) * reach * LEG.swing;
    g.moveTo(x, legs.top);
    g.lineTo(x + swing, legs.bottom - legs.width / 2);
  });
  g.stroke();
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
    drawWalker(ctx, w, step.x, y, step, t);
  }
}
