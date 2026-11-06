import { TILE, COLS, SOLID, ONE_WAY, EMPTY, CRATE_SIZE, SPRING_VEL, HOOK_REACH, createLevel, addObject, tileAt, WATER_TILE, waterRects, START_POSITIONS, startPhase } from '../world/level.js';
import { buildRules, mutatorById } from '../world/rules.js';
import { playerSize } from '../world/physics.js';
import { THEMES } from '../art/themes.js';
import { encodeBytes, decodeBytes } from '../game/ghost.js';
import { LURKERS } from '../world/lurkers.js';
import { KINDS } from '../world/items.js';
import { MONSTER_KINDS } from '../generation/design.js';

export const BLUEPRINT_VERSION = 1;
export const TOWER_HEIGHTS = [18, 36, 54, 72, 108, 144, 216];
export const MAX_ENTRIES = 600;
const MAX_TITLE = 40;
const ALWAYS = 240;
const FUSE_OPEN = 300;
const MONSTER = { w: 22, h: 20 };
const CANNON = 34;
const CANNON_VEL = 15;
const HANDLE = 12;
const WHEEL_RADIUS = 90;
const SWING_LENGTH = 150;
const SWING_ARC = 0.9;
const RAIL_TILES = 8;
const FAST = 120;
const UPDRAFT = 0.73;
const GUST = 0.25;
const WIRE_RAIL = 20;

const standing = (cell, shape) => ({ ...shape, x: cell.c * TILE + (TILE - shape.w) / 2, y: (cell.r + 1) * TILE - shape.h });
const filling = (cell, shape) => ({ ...shape, x: cell.c * TILE, y: cell.r * TILE, w: cell.w * TILE, h: cell.h * TILE });
const centred = (cell, shape) => ({ ...shape, x: (cell.c + 0.5) * TILE - shape.w / 2, y: (cell.r + 0.5) * TILE - shape.h / 2 });
const stands = shape => cell => [standing(cell, shape)];
const fills = shape => cell => [filling(cell, shape)];
const monster = (kind, extra) => stands({ type: 'monster', kind, ...MONSTER, ...extra });
const lurker = kind => stands({ type: 'lurker', kind, w: LURKERS[kind].w, h: LURKERS[kind].h });
const pickup = kind => stands({ type: 'item', kind, w: 20, h: 20 });
const cannon = (angle, auto = false) => cell => [centred(cell, { type: 'cannon', w: CANNON, h: CANNON, angle, arc: 0, vel: CANNON_VEL, auto })];
const handle = extra => cell => [centred(cell, { type: 'hook', grip: true, w: HANDLE, h: HANDLE, reach: 0, ...extra })];

function beam(cell, level, dir, timing) {
  let top = cell.r, bottom = cell.r;
  while (top > 0 && tileAt(level, cell.c, top - 1) !== SOLID) top--;
  while (bottom < level.rows - 1 && tileAt(level, cell.c, bottom + 1) !== SOLID) bottom++;
  return [{ type: 'laser', x: cell.c * TILE + 11, y: top * TILE, w: 8, h: (bottom - top + 1) * TILE, dir, phase: 0, ...timing }];
}

const STEADY = { steady: true, period: ALWAYS, on: ALWAYS };
const PULSING = { period: ALWAYS, on: ALWAYS / 2 };

export const BLOCKS = [
  { id: 'rock', label: 'Rock', group: 'Ground', tile: SOLID, stretch: 'both' },
  { id: 'oneway', label: 'One-way', group: 'Ground', tile: ONE_WAY, stretch: 'both' },
  { id: 'water', label: 'Water', group: 'Ground', tile: WATER_TILE, stretch: 'both' },
  { id: 'start', label: 'Start', group: 'Ground', only: true, make: stands({ type: 'start', w: TILE, h: 10 }) },
  { id: 'goal', label: 'Goal', group: 'Ground', only: true, make: stands({ type: 'goal', w: 2 * TILE, h: 2 * TILE }) },
  { id: 'flag', label: 'Checkpoint', group: 'Ground', make: stands({ type: 'checkpoint', w: 24, h: 40 }) },
  { id: 'moverx', timed: true, label: 'Mover ↔', group: 'Platforms', stretch: 'w', size: [3, 1], make: fills({ type: 'mover', dx: 90, dy: 0, period: ALWAYS, phase: 0 }) },
  { id: 'movery', timed: true, label: 'Mover ↕', group: 'Platforms', stretch: 'w', size: [3, 1], make: fills({ type: 'mover', dx: 0, dy: -90, period: ALWAYS, phase: 0 }) },
  { id: 'phase', timed: true, label: 'Blinker', group: 'Platforms', stretch: 'w', size: [3, 1], make: fills({ type: 'phase', period: ALWAYS, on: 132, phase: 0 }) },
  { id: 'crumble', label: 'Crumbler', group: 'Platforms', stretch: 'w', size: [2, 1], make: fills({ type: 'crumble' }) },
  { id: 'beltr', label: 'Belt →', group: 'Platforms', stretch: 'w', size: [3, 1], make: fills({ type: 'conveyor', speed: 2 }) },
  { id: 'beltl', label: 'Belt ←', group: 'Platforms', stretch: 'w', size: [3, 1], make: fills({ type: 'conveyor', speed: -2 }) },
  { id: 'ladder', label: 'Ladder', group: 'Platforms', stretch: 'h', size: [1, 5], make: cell => [{ type: 'climb', x: cell.c * TILE + 5, y: cell.r * TILE, w: TILE - 10, h: cell.h * TILE }] },
  { id: 'spring', label: 'Spring', group: 'Platforms', make: stands({ type: 'spring', w: TILE - 8, h: 12, dir: -1, vel: SPRING_VEL }) },
  { id: 'bumpr', label: 'Bumper →', group: 'Platforms', make: stands({ type: 'bumper', w: 24, h: 24, dir: 1 }) },
  { id: 'bumpl', label: 'Bumper ←', group: 'Platforms', make: stands({ type: 'bumper', w: 24, h: 24, dir: -1 }) },
  { id: 'windu', label: 'Updraft', group: 'Platforms', stretch: 'both', size: [2, 6], make: fills({ type: 'wind', ax: 0, ay: -UPDRAFT }) },
  { id: 'windr', label: 'Gust →', group: 'Platforms', stretch: 'both', size: [4, 3], make: fills({ type: 'wind', ax: GUST, ay: 0 }) },
  { id: 'windl', label: 'Gust ←', group: 'Platforms', stretch: 'both', size: [4, 3], make: fills({ type: 'wind', ax: -GUST, ay: 0 }) },
  { id: 'hook', label: 'Rope hook', group: 'Momentum', make: cell => [centred(cell, { type: 'hook', w: HANDLE, h: HANDLE, reach: HOOK_REACH })] },
  { id: 'pendulum', timed: true, label: 'Pendulum', group: 'Momentum', make: handle({ motion: 'swing', dx: SWING_LENGTH, dy: SWING_LENGTH, arc: SWING_ARC, period: FAST, phase: 0 }) },
  { id: 'wheel', timed: true, label: 'Wheel', group: 'Momentum', make: cell => [0, FAST / 2].flatMap(phase => handle({ motion: 'orbit', dx: WHEEL_RADIUS, dy: WHEEL_RADIUS, period: FAST, phase })(cell)) },
  { id: 'railr', timed: true, label: 'Rail →', group: 'Momentum', make: handle({ dx: RAIL_TILES * TILE, dy: 0, period: ALWAYS, phase: 0 }) },
  { id: 'railu', timed: true, label: 'Rail ↗', group: 'Momentum', make: handle({ dx: RAIL_TILES * TILE, dy: -4 * TILE, period: ALWAYS, phase: 0 }) },
  { id: 'cannonu', label: 'Cannon ↑', group: 'Momentum', make: cannon(-Math.PI / 2) },
  { id: 'cannonr', label: 'Cannon ↗', group: 'Momentum', make: cannon(-Math.PI / 4) },
  { id: 'cannonl', label: 'Cannon ↖', group: 'Momentum', make: cannon((-3 * Math.PI) / 4) },
  { id: 'blastr', label: 'Auto cannon ↗', group: 'Momentum', make: cannon(-Math.PI / 4, true) },
  { id: 'blastl', label: 'Auto cannon ↖', group: 'Momentum', make: cannon((-3 * Math.PI) / 4, true) },
  { id: 'spikeu', label: 'Spikes', group: 'Hazards', stretch: 'w', make: cell => [{ type: 'spikes', x: cell.c * TILE + 2, y: (cell.r + 1) * TILE - 14, w: cell.w * TILE - 4, h: 14, dir: -1 }] },
  { id: 'spiker', label: 'Wall spikes →', group: 'Hazards', stretch: 'h', size: [1, 2], make: cell => [{ type: 'spikes', x: cell.c * TILE, y: cell.r * TILE + 2, w: 14, h: cell.h * TILE - 4, side: 1 }] },
  { id: 'spikel', label: 'Wall spikes ←', group: 'Hazards', stretch: 'h', size: [1, 2], make: cell => [{ type: 'spikes', x: (cell.c + 1) * TILE - 14, y: cell.r * TILE + 2, w: 14, h: cell.h * TILE - 4, side: -1 }] },
  { id: 'spiked', label: 'Ceiling spikes', group: 'Hazards', stretch: 'w', make: cell => [{ type: 'spikes', x: cell.c * TILE + 2, y: cell.r * TILE, w: cell.w * TILE - 4, h: 14, dir: 1 }] },
  { id: 'sawx', timed: true, label: 'Saw ↔', group: 'Hazards', make: stands({ type: 'saw', w: 26, h: 26, dx: 90, dy: 0, period: ALWAYS, phase: 0 }) },
  { id: 'sawy', timed: true, label: 'Saw ↕', group: 'Hazards', make: stands({ type: 'saw', w: 26, h: 26, dx: 0, dy: -90, period: ALWAYS, phase: 0 }) },
  { id: 'lasertop', label: 'Ceiling laser', group: 'Hazards', make: (cell, level) => beam(cell, level, 1, STEADY) },
  { id: 'laserfloor', label: 'Floor laser', group: 'Hazards', make: (cell, level) => beam(cell, level, -1, STEADY) },
  { id: 'laserpulse', timed: true, label: 'Pulsing laser', group: 'Hazards', make: (cell, level) => beam(cell, level, 1, PULSING) },
  { id: 'door', label: 'Door', group: 'Machines', lock: true, stretch: 'both', size: [1, 3], make: fills({ type: 'door' }) },
  { id: 'shutter', label: 'Shutter', group: 'Machines', lock: true, stretch: 'both', size: [1, 3], make: fills({ type: 'toggle', on: true }) },
  { id: 'bridge', label: 'Bridge', group: 'Machines', lock: true, stretch: 'w', size: [4, 1], make: fills({ type: 'toggle', on: true }) },
  { id: 'plate', label: 'Plate', group: 'Machines', source: true, stretch: 'w', size: [2, 1], make: cell => [{ type: 'plate', x: cell.c * TILE + 2, y: (cell.r + 1) * TILE - 6, w: cell.w * TILE - 4, h: 6 }] },
  { id: 'key', label: 'Key', group: 'Machines', source: true, make: stands({ type: 'key', w: 16, h: 18 }) },
  { id: 'switch', label: 'Switch', group: 'Machines', source: true, make: stands({ type: 'switch', w: 16, h: 18 }) },
  { id: 'timer', label: 'Timer', group: 'Machines', source: true, make: stands({ type: 'timer', w: 16, h: 18, open: FUSE_OPEN }) },
  { id: 'portal', label: 'Portal', group: 'Machines', make: stands({ type: 'portal', w: 20, h: 34 }) },
  { id: 'wood', label: 'Wood crate', group: 'Machines', make: stands({ type: 'crate', kind: 'wood', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'steel', label: 'Steel crate', group: 'Machines', make: stands({ type: 'crate', kind: 'steel', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'stone', label: 'Stone crate', group: 'Machines', make: stands({ type: 'crate', kind: 'stone', w: CRATE_SIZE, h: CRATE_SIZE }) },
  { id: 'gravity', label: 'Gravity pad', group: 'Machines', make: stands({ type: 'gravpad', w: TILE - 6, h: 8, dir: -1 }) },
  { id: 'patroller', label: 'Patroller', group: 'Monsters', make: monster('patroller', { dx: 90, dy: 0, period: 300, phase: 0 }) },
  { id: 'hopper', label: 'Hopper', group: 'Monsters', make: monster('hopper', { motion: 'hop', dx: 60, dy: 0, lift: 60, period: ALWAYS, phase: 0 }) },
  { id: 'flapper', label: 'Flapper', group: 'Monsters', make: monster('flapper', { dx: 0, dy: 90, period: ALWAYS, phase: 30 }) },
  { id: 'urchin', label: 'Urchin', group: 'Monsters', make: monster('urchin', { motion: 'orbit', dx: 20, dy: 30, period: ALWAYS, phase: 0 }) },
  { id: 'spider', label: 'Spider', group: 'Monsters', make: monster('spider', { motion: 'drop', dx: 0, dy: 60, period: ALWAYS, phase: 0 }) },
  { id: 'eel', label: 'Eel', group: 'Monsters', make: cell => [centred(cell, { type: 'monster', kind: 'eel', w: 26, h: 12, dx: 90, dy: 0, period: ALWAYS, phase: 0 })] },
  { id: 'jelly', label: 'Jellyfish', group: 'Monsters', make: cell => [centred(cell, { type: 'monster', kind: 'jelly', w: 18, h: 18, dx: 0, dy: 60, period: ALWAYS, phase: 0 })] },
  { id: 'puffer', label: 'Puffer', group: 'Monsters', make: monster('puffer', { motion: 'puff', dx: 0, dy: 0, grow: 16, period: ALWAYS, phase: 0 }) },
  ...Object.keys(LURKERS).map(kind => ({ id: kind, label: kind[0].toUpperCase() + kind.slice(1), group: 'Monsters', make: lurker(kind) })),
  { id: 'coin', label: 'Coin', group: 'Pickups', make: stands({ type: 'coin', w: 14, h: 14 }) },
  { id: 'heart', label: 'Heart', group: 'Pickups', make: pickup('heart') },
  { id: 'shield', label: 'Shield', group: 'Pickups', make: pickup('shield') },
  { id: 'jetpack', label: 'Jetpack', group: 'Pickups', make: pickup('jetpack') },
  { id: 'boots', label: 'Spring boots', group: 'Pickups', make: pickup('boots') },
];

const MADE_TYPES = new Set(['checkpoint', 'mover', 'phase', 'crumble', 'conveyor', 'climb', 'spring', 'bumper', 'wind', 'water', 'hook', 'cannon', 'spikes', 'saw', 'laser', 'door', 'toggle', 'gate', 'plate', 'key', 'switch', 'portal', 'crate', 'gravpad', 'monster', 'shot', 'lurker', 'coin', 'item', 'refill', 'cling', 'orb', 'lever', 'timer']);
const MAX_MADE_SHAPES = 8;
const SIGNAL_BITS = 30;
const MADE = { id: 'made', make: (cell, level, item) => item.o.map(shape => ({ ...shape, x: shape.x + cell.c * TILE, y: shape.y + cell.r * TILE })) };
const BY_ID = new Map([...BLOCKS, MADE].map(block => [block.id, block]));
export const blockById = id => BY_ID.get(id);
const CYCLING = new Set(['hook', 'mover', 'saw', 'phase', 'laser']);
export const isTimedItem = item => (item.b === MADE.id ? item.o.some(o => CYCLING.has(o.type) && o.period && !o.steady) : !!blockById(item.b).timed);
export const BLOCK_GROUPS = [...new Set(BLOCKS.map(block => block.group))];

export function blankBlueprint(rows = TOWER_HEIGHTS[1]) {
  const tiles = new Array(COLS * rows).fill(EMPTY);
  tiles.fill(SOLID, COLS * (rows - 1));
  return {
    v: BLUEPRINT_VERSION, title: '', theme: THEMES.findIndex(theme => theme.id === 'paper'), rules: [], rows, tiles, next: 2,
    items: [{ b: 'start', c: 3, r: rows - 2, w: 1, h: 1, u: 0 }, { b: 'goal', c: COLS - 5, r: rows - 2, w: 1, h: 1, u: 1 }],
  };
}

const startingAt = (shape, position = 0) => (position && shape.period ? { ...shape, phase: (shape.phase + startPhase(position, shape.period)) % shape.period } : { ...shape });

function wire(level, source, lock, bit) {
  const sx = source.x + source.w / 2, sy = source.y + source.h / 2, lx = lock.x + lock.w / 2, ly = lock.y + lock.h / 2;
  const rail = Math.min(sy, ly) - WIRE_RAIL;
  level.wires.push({ bit, points: [[sx, sy], [sx, rail], [lx, rail], [lx, ly]] });
}

export function levelFrom(blueprint) {
  const rules = buildRules(blueprint.rules);
  const level = createLevel(rules, blueprint.rules, blueprint.rows);
  level.tiles = Uint8Array.from(blueprint.tiles, tile => (tile === WATER_TILE ? EMPTY : tile));
  Object.assign(level, {
    custom: true, index: 1, theme: blueprint.theme, palette: blueprint.theme * 37 % 360, title: blueprint.title, style: 'open', focus: 'custom', entryCol: 0, exitCol: 0,
    segments: [], solution: [], itemProofs: [], wires: [], rooms: [], moves: [], profiles: [], exit: { x: -1e6, y: -1e6, w: 0, h: 0 },
  });
  const at = (c, r) => blueprint.tiles[r * COLS + c];
  for (const rect of waterRects((c, r) => at(c, r) === WATER_TILE, (c, r) => r >= 0 && at(c, r) !== SOLID, COLS, blueprint.rows)) addObject(level, { type: 'water', ...rect });
  const made = new Map();
  blueprint.items.filter(item => !blockById(item.b).tile).forEach(item => {
    const shapes = blockById(item.b).make({ c: item.c, r: item.r, w: item.w, h: item.h }, level, item).map(shape => addObject(level, startingAt(shape, item.p)));
    for (const shape of shapes) {
      if (shape.sourceAt === undefined) continue;
      shape.source = shapes[shape.sourceAt].id;
      delete shape.sourceAt;
    }
    made.set(item.u, shapes);
  });
  const { h } = playerSize(rules);
  for (const object of level.objects) {
    if (object.type === 'start') level.start = { x: object.x + object.w / 2 - playerSize(rules).w / 2, y: object.y + object.h - h };
    if (object.type === 'goal') level.exit = { x: object.x, y: object.y, w: object.w, h: object.h };
  }
  linkMachines(level, blueprint, made);
  return level;
}

function freeBit(i, taken) {
  for (let k = 0; k < SIGNAL_BITS; k++) {
    const bit = 1 << ((i + k) % SIGNAL_BITS);
    if (!(taken & bit)) return bit;
  }
  return 1 << (i % SIGNAL_BITS);
}

function linkMachines(level, blueprint, made) {
  let taken = blueprint.items.filter(item => item.b === MADE.id).flatMap(item => item.o).reduce((bits, shape) => bits | (shape.bit ?? 0), 0);
  blueprint.items.filter(item => blockById(item.b).source).forEach((item, i) => {
    const [source] = made.get(item.u);
    const bit = source.type === 'timer' ? null : freeBit(i, taken);
    taken |= bit ?? 0;
    if (bit) source.bit = bit;
    for (const target of item.to ?? []) {
      const lock = made.get(target)?.[0];
      if (!lock) continue;
      if (source.type === 'timer') { lock.timer = source.slot; lock.open = source.open; }
      else {
        lock.bit = (lock.bit ?? 0) | bit;
        if (source.type === 'plate') lock.plate = true;
        wire(level, source, lock, bit);
      }
    }
  });
  for (const lock of level.objects) if ((lock.type === 'door' || lock.type === 'toggle') && lock.bit === undefined && lock.timer === undefined) lock.bit = 1 << 30;
  const portals = level.objects.filter(o => o.type === 'portal');
  portals.forEach((portal, i) => { portal.target = portals[i % 2 ? i - 1 : i + 1]?.id ?? portal.id; });
}

export const MOST_TRACKED = 31;
const TRACKED_TYPES = ['monster', 'coin', 'item', 'refill'];

export function overTracked(blueprint) {
  const { objects } = levelFrom(blueprint);
  return TRACKED_TYPES.some(type => objects.filter(o => o.type === type).length > MOST_TRACKED);
}

const packTiles = tiles => tiles.join('').replace(/(.)\1{2,}/g, (run, tile) => `${tile}*${run.length};`);
function unpackTiles(text, most) {
  const expanded = [...text.matchAll(/(\d)\*(\d+);/g)].reduce((sum, run) => sum + +run[2], 0);
  if (expanded > most) throw new Error('bad tiles');
  return [...text.replace(/(\d)\*(\d+);/g, (_, tile, count) => tile.repeat(+count))].map(Number);
}

export const encodeBlueprint = blueprint => encodeBytes(new TextEncoder().encode(JSON.stringify({
  v: blueprint.v, t: blueprint.title, h: blueprint.theme, m: blueprint.rules, n: blueprint.rows, g: packTiles(blueprint.tiles), x: blueprint.next,
  i: blueprint.items.map(({ b, c, r, w, h, u, to, p, o }) => [b, c, r, w, h, u, ...(to?.length || p || o ? [to ?? []] : []), ...(p || o ? [p ?? 0] : []), ...(o ? [o] : [])]),
})));

const inRange = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;

const isMadeShape = shape => shape && typeof shape === 'object' && MADE_TYPES.has(shape.type) && Number.isFinite(shape.x) && Number.isFinite(shape.y) && Number.isFinite(shape.w) && Number.isFinite(shape.h)
  && Object.values(shape).every(value => ['number', 'string', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value)))
  && (shape.type !== 'item' || KINDS.some(([kind]) => kind === shape.kind)) && (shape.type !== 'lurker' || !!LURKERS[shape.kind]) && (shape.type !== 'monster' || MONSTER_KINDS.includes(shape.kind));

const RETIRED = new Set(['comet']);
function unretired(o) {
  if (!Array.isArray(o)) return o;
  const kept = o.flatMap((shape, i) => (RETIRED.has(shape?.kind) ? [] : [[shape, i]]));
  const moved = new Map(kept.map(([, i], k) => [i, k]));
  return kept.map(([shape]) => (shape?.sourceAt === undefined ? shape : { ...shape, sourceAt: moved.get(shape.sourceAt) ?? -1 }));
}

const isMadeList = (o, length = o?.length) => Array.isArray(o) && length > 0 && length <= MAX_MADE_SHAPES && o.every(shape => isMadeShape(shape) && (shape.sourceAt === undefined || (Number.isInteger(shape.sourceAt) && shape.sourceAt >= 0 && shape.sourceAt < length)));

export function checkBlueprint(raw) {
  const { v, t, h, m, n, g, x, i } = raw;
  if (v !== BLUEPRINT_VERSION || !TOWER_HEIGHTS.includes(n) || !inRange(h, 0, THEMES.length - 1) || !Array.isArray(m) || !m.every(id => mutatorById(id)) || !Array.isArray(i) || i.length > MAX_ENTRIES) throw new Error('bad level');
  const tiles = unpackTiles(String(g), COLS * n);
  if (tiles.length !== COLS * n || tiles.some(tile => ![EMPTY, SOLID, ONE_WAY, WATER_TILE].includes(tile))) throw new Error('bad tiles');
  for (const [b, c, r, w, height] of i) {
    if (b !== 'water' || !inRange(c, 0, COLS - 1) || !inRange(r, 0, n - 1) || !inRange(w, 1, COLS) || !inRange(height, 1, n)) continue;
    for (let row = r; row < Math.min(n, r + height); row++) for (let col = c; col < Math.min(COLS, c + w); col++) tiles[row * COLS + col] = WATER_TILE;
  }
  const current = i.filter(([b]) => b !== 'water' && !RETIRED.has(b)).map(([b, c, r, w, height, u, to, p, o]) => [b, c, r, w, height, u, to, p, unretired(o)]);
  const items = current.filter(([b, , , , , , , , o]) => b !== MADE.id || o?.length).map(([b, c, r, w, height, u, to, p, o]) => {
    if (!blockById(b) || (b === MADE.id && !isMadeList(o)) || !inRange(c, 0, COLS - 1) || !inRange(r, 0, n - 1) || !inRange(w, 1, COLS) || !inRange(height, 1, n) || !inRange(u, 0, 1e6)) throw new Error('bad item');
    return { b, c, r, w, h: height, u, ...(Array.isArray(to) && to.length ? { to: to.filter(target => inRange(target, 0, 1e6)) } : {}), ...(b === MADE.id ? { o } : {}), ...(isTimedItem(b === MADE.id ? { b, o } : { b }) && inRange(p, 1, START_POSITIONS - 1) ? { p } : {}) };
  });
  const checked = { v, title: String(t ?? '').slice(0, MAX_TITLE), theme: h, rules: m, rows: n, tiles, next: inRange(x, 0, 1e7) ? x : items.length, items };
  if (overTracked(checked)) throw new Error('too many tracked things');
  return checked;
}

export const decodeBlueprint = async text => checkBlueprint(JSON.parse(new TextDecoder().decode(await decodeBytes(text))));
