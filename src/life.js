import { HEIGHT, WIDTH, TILE, EMPTY, tileAt } from './level.js';
import { levelRng } from './rng.js';
import { TAU, spans, boundsOf } from './life-kit.js';
import { FAMILIES } from './life-shapes.js';
import { WALKER_COATS } from './life-creatures.js';
import { shade } from './themes.js';

export const DEPTHS = [0.35, 0.55, 0.75];
const PATTERNS = ['glide', 'wave', 'loop', 'swoop'];
const PLANT_CHANCE = 0.45;
const WALKER_CHANCE = 0.12;
const WALK_MIN_TILES = 3;
const FLYERS_PER_SCREEN = 1.5;
const MARGIN = 120;
const ROOT_SINK = 4;
const PLANT_ALPHA = 0.32;
const BAKE = { zoom: 3, outline: 1, glow: 8 };
const WALKER = { scale: 0.7, maxHeight: 15, alpha: 0.5, shadow: 'hsl(240 30% 5% / 0.14)', shadowH: 2 };
const LEG = { swing: 0.35, tuck: 0.45, pace: 1.3, airborne: 0.5 };
const SHADE = { alpha: 0.28, from: 0.05, reach: 400 };

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
      const creature = rng.pick(family.walkers)(rng);
      walkers.push({ ...creature, x0: run.x0 + 12, x1: run.x1 - 12, y: run.y, scale: Math.min(WALKER.scale, WALKER.maxHeight / creature.height), speed: rng.float(12, 22), phase: rng.float(0, TAU) });
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
  return { plants, walkers, flyers, drifter, glow: !!theme.glow };
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

function paintParts(ctx, plant, palette, glow, makePath) {
  for (const part of plant.parts) {
    part.path ??= makePath();
    if (!part.built) { part.build(part.path); part.built = true; }
    ctx.shadowBlur = glow && part.glow ? BAKE.glow : 0;
    ctx.shadowColor = palette[part.glow] ?? 'transparent';
    ctx.lineJoin = ctx.lineCap = 'round';
    if (part.mode === 'fill') {
      ctx.fillStyle = palette[part.color];
      ctx.fill(part.path);
      if (part.outline) { ctx.shadowBlur = 0; ctx.strokeStyle = palette[part.outline]; ctx.lineWidth = BAKE.outline; ctx.stroke(part.path); }
    } else {
      ctx.strokeStyle = palette[part.color];
      ctx.lineWidth = part.width;
      ctx.stroke(part.path);
    }
  }
  ctx.shadowBlur = 0;
}

function bakePlant(plant, palette, glow) {
  const box = plant.parts.map(part => boundsOf(part.build, part.width + (glow && part.glow ? BAKE.glow : 0) + 2)).reduce((all, b) => ({ x: Math.min(all.x, b.x), y: Math.min(all.y, b.y), x1: Math.max(all.x1, b.x + b.w), y1: Math.max(all.y1, b.y + b.h) }), { x: Infinity, y: Infinity, x1: -Infinity, y1: -Infinity });
  const w = Math.ceil(box.x1 - box.x), h = Math.ceil(box.y1 - box.y);
  const canvas = new OffscreenCanvas(Math.max(1, w * BAKE.zoom), Math.max(1, h * BAKE.zoom));
  const ctx = canvas.getContext('2d');
  ctx.scale(BAKE.zoom, BAKE.zoom);
  ctx.translate(-box.x, -box.y);
  paintParts(ctx, plant, palette, glow, () => new Path2D());
  return { canvas, x: box.x, y: box.y, w, h };
}

function drawPlant(ctx, plant, palette, glow, t, makePath) {
  ctx.rotate(Math.sin(t * 0.7 + plant.phase) * 0.04 * plant.flex);
  if (typeof OffscreenCanvas === 'undefined') return paintParts(ctx, plant, palette, false, makePath);
  plant.sprite ??= bakePlant(plant, palette, glow);
  ctx.drawImage(plant.sprite.canvas, plant.sprite.x, plant.sprite.y, plant.sprite.w, plant.sprite.h);
}

function drawWalker(ctx, walker, x, ground, step, t) {
  const y = ground - (walker.foot + step.lift) * walker.scale, reach = walker.height * walker.scale * 0.45;
  ctx.fillStyle = WALKER.shadow;
  ctx.beginPath(); ctx.ellipse(x, ground, reach / (1 + step.lift * 0.05), WALKER.shadowH, 0, 0, TAU); ctx.fill();
  const legs = walker.legs, stride = legs && step.x / (walker.scale * (legs.bottom - legs.top) * LEG.pace);
  const body = legs ? { ...walker, draw: (g, time, c) => { drawLegs(g, legs, stride, step.lift > LEG.airborne, c); walker.draw(g, time, c); } } : walker;
  const coat = WALKER_COATS[walker.kind];
  drawCreature(ctx, body, x, y, step.dir, 0, WALKER.alpha, { ...coat, shadow: shade(coat.primary, -14) }, t);
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
  if (colors.shadow) {
    ctx.globalAlpha = alpha * SHADE.alpha;
    ctx.beginPath();
    ctx.rect(-SHADE.reach, creature.height * SHADE.from, 2 * SHADE.reach, SHADE.reach);
    ctx.clip();
    creature.draw(ctx, t + creature.phase, { primary: colors.shadow, secondary: colors.shadow, ink: colors.shadow, shadow: colors.shadow });
  }
  ctx.restore();
}

export function drawLife(ctx, life, palette, offset, camera, time, makePath = () => new Path2D()) {
  const t = time / 1000;
  const colors = { primary: palette.accent, secondary: palette.rockEdge, ink: palette.ink, shadow: palette.accentDeep };
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
    drawPlant(ctx, p, palette, life.glow, t, makePath);
    ctx.restore();
  }
  for (const w of life.walkers) {
    const y = offset + w.y - camera;
    if (!visible(y)) continue;
    const step = walkPath(w, t);
    drawWalker(ctx, w, step.x, y, step, t);
  }
}
