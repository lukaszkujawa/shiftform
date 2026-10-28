import { TILE, COLS, addObject } from './level.js';
import { FEATURES, platform, clearAbove, carveBetween } from './features.js';

const KINDS = [['jetpack', 3], ['boots', 3], ['shield', 2], ['heart', 1.5]];
const GUARDS = ['laser', 'saw', 'crumble'];
const LEDGE_WIDTH = 2;

export function chooseKind(rng) {
  return rng.weighted(KINDS, ([, weight]) => weight)[0];
}

export function ledgeSpots(ctx, anchors, crowded) {
  const { rng, maxGap, maxUp } = ctx;
  const spots = [];
  for (const anchor of anchors) {
    for (const dir of [1, -1]) {
      for (let gap = 2; gap <= Math.max(2, maxGap); gap++) {
        for (let up = 0; up <= maxUp; up++) {
          const col = dir > 0 ? anchor.col + anchor.w + gap : anchor.col - gap - LEDGE_WIDTH;
          const row = anchor.row - up;
          if (col < 0 || col + LEDGE_WIDTH > COLS || crowded(anchor, col, row, LEDGE_WIDTH)) continue;
          spots.push({ anchor, ledge: { col, row, w: LEDGE_WIDTH, gap, dir, kind: 'tiles', thick: 1 } });
        }
      }
    }
  }
  return rng.shuffle(spots);
}

export function buildLedge(ctx, anchor, ledge, kind) {
  if (ctx.cave) {
    clearAbove(ctx, ledge.col, ledge.row, ledge.w);
    carveBetween(ctx, anchor, ledge);
  }
  platform(ctx, ledge);
  const guardId = ctx.rng.pick(GUARDS);
  const guard = FEATURES.find(f => f.id === guardId);
  guard.apply({ ...ctx, nodes: [anchor, ledge] }, 1);
  return addObject(ctx.level, { type: 'item', kind, x: (ledge.col + ledge.w / 2) * TILE - 10, y: ledge.row * TILE - 24, w: 20, h: 20 });
}

export function routeThrough(route, anchorPoint, item) {
  const at = route.indexOf(anchorPoint);
  return [...route.slice(0, at + 1), { x: item.x + item.w / 2, y: item.y + item.h / 2, item: 1 << item.slot }, anchorPoint, ...route.slice(at + 1)];
}
