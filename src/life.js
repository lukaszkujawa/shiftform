import { HEIGHT, WIDTH } from './level.js';
import { Rng, mix, hashString } from './rng.js';
import { FAMILIES } from './life-shapes.js';

const TAU = Math.PI * 2;
export const DEPTHS = [0.35, 0.55, 0.75];
const PLANTS = 80;
const CREATURES = 30;
const MARGIN = 120;

function band(height, depth) {
  const reach = HEIGHT / (2 * depth);
  return [HEIGHT / 2 - reach, height - HEIGHT / 2 + reach];
}

function place(rng, level) {
  const depth = rng.pick(DEPTHS);
  const [lo, hi] = band(level.height, depth);
  return { x: rng.float(0, WIDTH), y: rng.float(lo, hi), depth, phase: rng.float(0, TAU) };
}

function specimen(rng, level, grow, plant) {
  const spot = place(rng, level);
  return { ...grow(rng), ...spot, plant, scale: (0.45 + 0.7 * spot.depth) * rng.float(0.8, 1.25) };
}

export function growLife(level, theme) {
  const rng = new Rng(mix(level.palette * 131 + (level.index ?? 0) * 17 + 1, hashString(theme.id)));
  const family = FAMILIES[theme.id];
  const specimens = [
    ...Array.from({ length: PLANTS }, () => specimen(rng, level, rng.pick(family.plants), true)),
    ...Array.from({ length: CREATURES }, () => specimen(rng, level, rng.pick(family.creatures), false)),
  ].sort((a, b) => a.depth - b.depth);
  const drifters = Array.from({ length: rng.int(1, 3) }, () => {
    const spot = place(rng, level);
    return { ...rng.pick(family.drifters)(rng), ...spot, dir: rng.chance(0.5) ? 1 : -1, scale: 0.45 + 0.7 * spot.depth };
  });
  return { specimens, drifters };
}

const screenY = (y, depth, offset, camera) => HEIGHT / 2 + (offset + y - camera - HEIGHT / 2) * depth;
const alphaOf = depth => 0.16 + 0.28 * depth;
const visible = y => y >= -MARGIN && y <= HEIGHT + MARGIN;

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

function drawDrifter(ctx, drifter, colors, y, t) {
  const span = WIDTH + 2 * MARGIN;
  const head = ((((t * drifter.speed + drifter.phase * 100) % span) + span) % span) - MARGIN;
  const x = drifter.dir > 0 ? head : WIDTH - head;
  for (const member of drifter.members) {
    ctx.save();
    ctx.globalAlpha = alphaOf(drifter.depth);
    ctx.translate(x - drifter.dir * member.dx, y + member.dy + Math.sin(t * 1.1 + member.phase) * 6);
    ctx.scale(drifter.scale * drifter.dir, drifter.scale);
    drifter.draw(ctx, t + member.phase, colors);
    ctx.restore();
  }
}

export function drawLife(ctx, life, palette, offset, camera, time, makePath = () => new Path2D()) {
  const t = time / 1000;
  const colors = { primary: palette.accent, secondary: palette.rockEdge, ink: palette.ink };
  for (const s of life.specimens) {
    const y = screenY(s.y, s.depth, offset, camera);
    if (!visible(y)) continue;
    ctx.save();
    ctx.globalAlpha = alphaOf(s.depth);
    ctx.translate(s.x, y);
    ctx.scale(s.scale, s.scale);
    if (s.plant) drawPlant(ctx, s, palette, t, makePath);
    else s.draw(ctx, t + s.phase, colors);
    ctx.restore();
  }
  for (const d of life.drifters) {
    const y = screenY(d.y, d.depth, offset, camera);
    if (visible(y)) drawDrifter(ctx, d, colors, y, t);
  }
}
