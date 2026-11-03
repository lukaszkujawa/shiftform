import { TILE, COLS, WIDTH, SOLID, ONE_WAY, tileAt } from '../world/level.js';
import { paintDecor } from './decor.js';
import { seededNoise } from './backdrop-kit.js';
import { PATTERNS } from './tile-patterns.js';
import { slab } from './paint.js';

const TILE_SHADE = 'hsl(240 35% 8% / 0.13)';
const TILE_SHINE = 'hsl(0 0% 100% / 0.4)';
const TILE_CAST = { shadowColor: 'hsl(240 35% 8% / 0.42)', shadowBlur: 8, shadowOffsetX: 3, shadowOffsetY: 7 };

export function renderTiles(level, theme, p, decor) {
  const canvas = new OffscreenCanvas(WIDTH, level.height);
  const ctx = canvas.getContext('2d');
  const rand = seededNoise(level.palette * 104729 + 7);

  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(level, c, r);
      if (tile === 0) continue;
      const x = c * TILE, y = r * TILE;
      if (tile === ONE_WAY) {
        slab(ctx, x, y, TILE, 8, 3, p.rockEdge, theme.outline ? p.ink : null, 1.5);
        continue;
      }
      ctx.fillStyle = p.rock;
      ctx.fillRect(x, y, TILE, TILE);
      PATTERNS[theme.pattern](ctx, p, x, y, rand);
    }
  }

  const bothFaces = level.rules.jumpFlipChance > 0;
  const up = level.rules.baseGravDir < 0;
  ctx.lineCap = 'round';
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solid(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const top = !solid(c, r - 1), bottom = !solid(c, r + 1), left = !solid(c - 1, r), right = !solid(c + 1, r);
      if (theme.hollow) {
        ctx.fillStyle = p.rockDeep;
        ctx.fillRect(x + (left ? 3 : 0), y + (top ? 3 : 0), TILE - (left ? 3 : 0) - (right ? 3 : 0), TILE - (top ? 3 : 0) - (bottom ? 3 : 0));
        ctx.fillStyle = p.rock;
        ctx.fillRect(x + (left ? 5 : 0), y + (top ? 5 : 0), TILE - (left ? 5 : 0) - (right ? 5 : 0), TILE - (top ? 5 : 0) - (bottom ? 5 : 0));
      }
      const lipTop = top && (!up || bothFaces), lipBottom = bottom && (up || bothFaces);
      ctx.fillStyle = TILE_SHADE;
      if (bottom) { ctx.fillRect(x, y + TILE - 8, TILE, 8); ctx.fillRect(x, y + TILE - 4, TILE, 4); }
      if (right) ctx.fillRect(x + TILE - 4, y, 4, TILE);
      if (lipTop) ctx.fillRect(x, y + 4, TILE, 3);
      ctx.fillStyle = p.rockEdge;
      if (lipTop) ctx.fillRect(x, y, TILE, theme.hollow ? 3 : 4);
      if (lipTop && !theme.hollow) { ctx.fillStyle = TILE_SHINE; ctx.fillRect(x, y, TILE, 1.5); ctx.fillStyle = p.rockEdge; }
      if (lipBottom) ctx.fillRect(x, y + TILE - (theme.hollow ? 3 : 4), TILE, theme.hollow ? 3 : 4);
      if (theme.hollow) {
        if (left) ctx.fillRect(x, y, 3, TILE);
        if (right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      }
      if (theme.outline) {
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = theme.outline;
        ctx.beginPath();
        if (top) { ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); }
        if (bottom) { ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y + TILE); }
        if (left) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE); }
        if (right) { ctx.moveTo(x + TILE, y); ctx.lineTo(x + TILE, y + TILE); }
        ctx.stroke();
      }
    }
  }
  paintDecor(ctx, decor, p, theme);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  Object.assign(ctx, TILE_CAST);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  return canvas;
}
