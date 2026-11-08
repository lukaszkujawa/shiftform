import { TILE, COLS, SOLID, EMPTY, ONE_WAY, WATER_TILE, createLevel, fillTiles, tileAt, sweepOf } from '../world/level.js?v=ececfed';
import { buildRules } from '../world/rules.js?v=ececfed';
import { initialState, playerSize } from '../world/physics.js?v=ececfed';
import { blockById, placeBlueprint } from '../builder/blueprint.js?v=ececfed';
import { replay, solveRoute } from './solver.js?v=ececfed';
import { DEFAULT_DESIGN } from './design.js?v=ececfed';

const MOST_ROWS = 18;
const TRACE_NODES = 1500000;
const TRACE_ROWS = 36;
const TRACE_ENTRY_W = 3;
const REST_RISE = 2;
const STRIDE_RISE = 4;
const MOST_BRIDGE = 12;
const EXIT_W = 2;
const GROUND = new Set([SOLID, ONE_WAY]);
const SKIPPED_GROUPS = { monsters: 'Monsters', hazards: 'Hazards' };

const rowStrings = (tiles, top, rows) => Array.from({ length: rows }, (_, r) => tiles.slice((top + r) * COLS, (top + r + 1) * COLS).join(''));
const topOf = ({ tiles, items }) => Math.min(tiles.findIndex(tile => tile !== EMPTY) / COLS | 0, ...items.map(item => item.r));

export function chunkFrom(blueprint, id, title = blueprint.title || id) {
  const start = blueprint.items.find(item => item.b === 'start'), goal = blueprint.items.find(item => item.b === 'goal');
  if (!start || !goal) throw new Error('a chunk needs a Start and a Goal');
  if (goal.r >= start.r) throw new Error('the Goal must sit above the Start');
  const at = (c, r) => blueprint.tiles[r * COLS + c];
  if (![goal.c, goal.c + 1].every(c => GROUND.has(at(c, goal.r + 1)))) throw new Error('the Goal must stand on two ground tiles');
  const top = topOf(blueprint), rows = start.r - top + 1;
  if (rows > MOST_ROWS) throw new Error(`the drawing above the Start may be at most ${MOST_ROWS} rows tall; it is ${rows}`);
  const lifted = ({ c, r }) => ({ c, r: r - top });
  const kept = blueprint.items.filter(item => !['start', 'goal', 'step'].includes(item.b) && item.r <= start.r).map(item => ({ ...item, r: item.r - top }));
  const steps = blueprint.items.filter(item => item.b === 'step').sort((a, b) => a.u - b.u);
  return {
    id, title, rows, start: lifted(start), goal: lifted(goal), steps: steps.map(lifted), tiles: rowStrings(blueprint.tiles, top, rows), items: kept,
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
  const standOn = ({ c, r }) => ({ x: (c + 0.5) * TILE, y: (r + 1 + roof) * TILE - size.h / 2, w: TILE, firm: r + 1 >= chunk.rows || GROUND.has(at(c | 0, r + 1)) });
  const top = { col: goal.c, row: goal.r + 1 + roof, w: EXIT_W, kind: 'tiles', thick: 1, exit: true, reserved: true, dir: goal.c < COLS / 2 ? 1 : -1 };
  fillTiles(level, top.col, top.row, top.w, 1, SOLID);
  const walkIn = start.c < entry.col || start.c >= entry.col + entry.w ? [standOn(start)] : [];
  const route = [...walkIn, ...chunk.steps.map(standOn), { ...standOn({ c: goal.c + 0.5, r: goal.r }), w: EXIT_W * TILE }];
  const footprint = { col: 0, row: entry.row - 1, w: COLS, span: entry.row - 1 - roof };
  return { top, route, nodes: [entry, top], footprint, extent: { roof, band: entry.row }, kicks: true, drawn: true };
}

export function traceSteps(chunk) {
  const rules = buildRules([]), size = playerSize(rules), level = createLevel(rules, [], TRACE_ROWS);
  Object.assign(level, { segments: [], wires: [], rooms: [] });
  const entry = { col: Math.max(0, Math.min(COLS - TRACE_ENTRY_W, chunk.start.c - 1)), row: TRACE_ROWS - 2, w: TRACE_ENTRY_W };
  fillTiles(level, entry.col, entry.row, entry.w, 1, SOLID);
  const raised = stampChunk({ ...chunk, steps: [] }, { level, rules, size, design: DEFAULT_DESIGN, cave: false, clearance: 4, nextBit: 1 }, entry, 0);
  if (!raised) return null;
  const start = { ...initialState(level), x: (entry.col + entry.w / 2) * TILE - size.w / 2, y: entry.row * TILE - size.h, grounded: true };
  const top = raised.route.at(-1), goal = { x: top.x - top.w / 2, y: top.y - size.h / 2, w: top.w, h: size.h };
  const found = solveRoute(level, raised.route, { start, goal, maxNodes: TRACE_NODES, kicks: true, fair: true });
  if (!found) return null;
  const roof = entry.row - chunk.rows, steps = [];
  let last = start;
  for (const s of replay(level, found.inputs, start)) {
    const rise = (last.y - s.y) / TILE;
    if (!((s.grounded && rise >= REST_RISE) || rise >= STRIDE_RISE)) continue;
    steps.push({ c: +((s.x + size.w / 2) / TILE - 0.5).toFixed(2), r: +((s.y + size.h) / TILE - 1 - roof).toFixed(2) });
    last = s;
  }
  return steps;
}
