import { TILE, addObject } from './level.js';
import { guardedLedge, GUARDS } from './features.js';

const KINDS = [['jetpack', 3], ['boots', 3], ['shield', 2], ['heart', 1.5], ['comet', 1.5]];

export function chooseKind(rng) {
  return rng.weighted(KINDS, ([, weight]) => weight)[0];
}

export function buildLedge(ctx, anchor, ledge, kind) {
  guardedLedge(ctx, anchor, ledge, ctx.index === 0 ? ['crumble'] : GUARDS);
  return addObject(ctx.level, { type: 'item', kind, x: (ledge.col + ledge.w / 2) * TILE - 10, y: ledge.row * TILE - 24, w: 20, h: 20 });
}

export function routeThrough(route, anchorPoint, item) {
  const at = route.indexOf(anchorPoint);
  return [...route.slice(0, at + 1), { x: item.x + item.w / 2, y: item.y + item.h / 2, item: 1 << item.slot }, anchorPoint, ...route.slice(at + 1)];
}
