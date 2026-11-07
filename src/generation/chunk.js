import { TILE, COLS, SOLID, EMPTY, ONE_WAY, WATER_TILE, fillTiles, tileAt, sweepOf } from '../world/level.js';
import { blockById, placeBlueprint } from '../builder/blueprint.js';
import { replay } from './solver.js';

const MOST_RISE = 17;
const MOST_BRIDGE = 12;
const EXIT_W = 2;
const GROUND = new Set([SOLID, ONE_WAY]);
const SKIPPED_GROUPS = { monsters: 'Monsters', hazards: 'Hazards' };

const rowStrings = (tiles, rows) => Array.from({ length: rows }, (_, r) => tiles.slice(r * COLS, (r + 1) * COLS).join(''));
const cellOf = ({ c, r }) => ({ c, r });

export function chunkFrom(blueprint, id, title = blueprint.title || id) {
  const start = blueprint.items.find(item => item.b === 'start'), goal = blueprint.items.find(item => item.b === 'goal');
  if (!start || !goal) throw new Error('a chunk needs a Start and a Goal');
  if (goal.r >= start.r) throw new Error('the Goal must sit above the Start');
  if (start.r > MOST_RISE) throw new Error(`the Start must be within ${MOST_RISE + 1} rows of the top; move it up or shorten the tower`);
  const at = (c, r) => blueprint.tiles[r * COLS + c];
  if (![goal.c, goal.c + 1].every(c => GROUND.has(at(c, goal.r + 1)))) throw new Error('the Goal must stand on two ground tiles');
  const rows = start.r + 1;
  const kept = blueprint.items.filter(item => !['start', 'goal', 'step'].includes(item.b) && item.r < rows);
  const steps = blueprint.items.filter(item => item.b === 'step').sort((a, b) => a.u - b.u);
  return {
    id, title, rows, start: cellOf(start), goal: cellOf(goal), steps: steps.map(cellOf), tiles: rowStrings(blueprint.tiles, rows), items: kept,
    dropped: blueprint.items.length - kept.length - steps.length - 2,
  };
}

export const chunkIdea = chunk => ({ id: chunk.id, title: chunk.title, once: true, raise: (ctx, entry, topRow) => stampChunk(chunk, ctx, entry, topRow) });

const wanted = (design, item) => !design || !Object.entries(SKIPPED_GROUPS).some(([setting, group]) => design[setting] === 'none' && blockById(item.b).group === group);
const bitAbove = bits => (bits ? 1 << (32 - Math.clz32(bits)) : 1);

function clashes(ctx, entry, becomesSolid) {
  const { level, size } = ctx, last = level.segments.at(-1);
  const flown = last ? replay(level, last.inputs, last.start).map(s => ({ x: s.x, y: s.y, w: size.w, h: size.h })) : [];
  const covers = ({ x, y, w, h }) => {
    for (let r = Math.floor(y / TILE); r <= Math.floor((y + h - 1) / TILE); r++) for (let c = Math.floor(x / TILE); c <= Math.floor((x + w - 1) / TILE); c++) if (becomesSolid(c, r)) return true;
    return false;
  };
  return [...flown, ...level.objects.map(sweepOf)].some(box => box.y < entry.row * TILE && covers(box));
}

export function stampChunk(chunk, ctx, entry, topRow) {
  const { level, size } = ctx, roof = entry.row - chunk.rows, { start, goal } = chunk;
  const from = Math.min(entry.col, start.c), to = Math.max(entry.col + entry.w - 1, start.c);
  if (roof < topRow || to - from > entry.w + MOST_BRIDGE) return null;
  const tiles = chunk.tiles.join('').split('').map(Number), at = (c, r) => tiles[r * COLS + c];
  const headroom = Math.ceil(size.h / TILE) + 1;
  for (let c = from; c <= to; c++) for (let k = 0; k < headroom; k++) if (at(c, start.r - k) !== EMPTY) return null;
  const bridged = c => c >= from && c <= to && tileAt(level, c, entry.row) === EMPTY;
  const becomesSolid = (c, r) => r >= roof && r < entry.row && c >= 0 && c < COLS && at(c, r - roof) === SOLID;
  if (clashes(ctx, entry, becomesSolid)) return null;
  if (ctx.cave) fillTiles(level, 0, roof - ctx.clearance, COLS, ctx.clearance, EMPTY);
  for (let r = 0; r < chunk.rows; r++) for (let c = 0; c < COLS; c++) {
    const tile = at(c, r);
    level.tiles[(r + roof) * COLS + c] = tile === WATER_TILE ? EMPTY : tile;
  }
  for (let c = from; c <= to; c++) if (bridged(c)) fillTiles(level, c, entry.row, 1, 1, ONE_WAY);
  const used = placeBlueprint(level, { tiles, rows: chunk.rows, items: chunk.items.filter(item => wanted(ctx.design, item)) }, roof, ctx.nextBit - 1);
  ctx.nextBit = Math.max(ctx.nextBit, bitAbove(used & ((1 << 30) - 1)));
  const standOn = ({ c, r }) => ({ x: (c + 0.5) * TILE, y: (r + 1 + roof) * TILE - size.h / 2, w: TILE, firm: true });
  const top = { col: goal.c, row: goal.r + 1 + roof, w: EXIT_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: goal.c < COLS / 2 ? 1 : -1 };
  fillTiles(level, top.col, top.row, top.w, 1, SOLID);
  const walkIn = start.c < entry.col || start.c >= entry.col + entry.w ? [standOn(start)] : [];
  const route = [...walkIn, ...chunk.steps.map(standOn), { ...standOn({ c: goal.c + 0.5, r: goal.r }), w: EXIT_W * TILE }];
  const footprint = { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - roof };
  return { top, route, nodes: [entry, top], footprint, extent: { roof, band: entry.row } };
}
