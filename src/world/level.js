import { PURSUIT, pursuitLevel } from './pursuit.js?v=c6cd642';
export const TILE = 30;
export const COLS = 32;
export const ROWS = 18;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const CLOCK_PERIOD = 240;
export const PLAYER_W = 20;
export const PLAYER_H = 26;

export const EMPTY = 0;
export const SOLID = 1;
export const ONE_WAY = 2;

export const SPRING_VEL = 15;
export const BUMPER_VEL = 12;
export const HOOK_REACH = 150;
export const WATER_TILE = 3;

export function waterRects(isWater, isOpen, cols, rows) {
  const spans = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!isWater(c, r)) continue;
      let bottom = r;
      while (bottom + 1 < rows && isWater(c, bottom + 1)) bottom++;
      spans.push({ c, top: r, bottom, surface: isOpen(c, r - 1) });
      r = bottom;
    }
  }
  const merged = [];
  for (const span of spans) {
    const before = merged.find(m => m.end === span.c - 1 && m.top === span.top && m.bottom === span.bottom && m.surface === span.surface);
    if (before) before.end = span.c;
    else merged.push({ ...span, start: span.c, end: span.c });
  }
  return merged.map(m => ({ x: m.start * TILE, y: m.top * TILE, w: (m.end - m.start + 1) * TILE, h: (m.bottom - m.top + 1) * TILE, surface: m.surface }));
}
export const CRATE_SIZE = 28;
export const CRATE_KINDS = {
  wood: { mass: 1, floats: true },
  steel: { mass: 2, floats: false },
  stone: { mass: 4, floats: false },
};

const DYNAMIC_TYPES = new Set(['mover', 'conveyor', 'phase', 'gate', 'crumble', 'door', 'toggle']);
const TRIGGER_TYPES = new Set(['cannon', 'spikes', 'laser', 'saw', 'monster', 'shot', 'key', 'orb', 'switch', 'spring', 'bumper', 'gravpad', 'portal', 'item', 'coin', 'refill', 'timer']);
const SLOT_TYPES = new Set(['crate', 'crumble', 'item', 'monster', 'lurker', 'coin', 'refill', 'timer']);
export const HAZARD_TYPES = new Set(['spikes', 'laser', 'saw', 'monster', 'lurker']);
export const SHOP_ROWS = 4;
const CRUSHABLE_TYPES = new Set(['saw', 'spring']);
const BODY_TRIGGER_TYPES = new Set(['saw', 'spring', 'bumper', 'switch', 'portal']);
const INDEX = Symbol('index');
const BAND = 4 * TILE;
const BAND_MARGIN = 2 * TILE;

export const refreshIndex = level => { delete level[INDEX]; };

export function levelIndex(level) {
  const cached = level[INDEX];
  const last = level.objects[level.objects.length - 1];
  if (cached && cached.count === level.objects.length && cached.last === last) return cached;
  const ofType = type => level.objects.filter(o => o.type === type);
  const crushable = level.objects.filter(o => CRUSHABLE_TYPES.has(o.type));
  const index = {
    count: level.objects.length,
    last,
    dynamic: level.objects.filter(o => DYNAMIC_TYPES.has(o.type)),
    triggers: level.objects.filter(o => TRIGGER_TYPES.has(o.type)),
    bodyTriggers: level.objects.filter(o => BODY_TRIGGER_TYPES.has(o.type)),
    water: ofType('water'),
    wind: ofType('wind'),
    spikes: ofType('spikes'),
    crates: ofType('crate'),
    crumbles: ofType('crumble'),
    monsters: ofType('monster'),
    lurkers: ofType('lurker'),
    items: ofType('item'),
    coins: ofType('coin'),
    hooks: ofType('hook'),
    climbs: ofType('climb'),
    clings: ofType('cling'),
    refills: ofType('refill'),
    timers: ofType('timer'),
    plates: ofType('plate'),
    levers: ofType('lever'),
    crushBit: new Map(crushable.map((o, i) => [o, 1 << i])),
  };
  index.bands = Array.from({ length: Math.ceil(level.height / BAND) }, (_, k) => index.triggers.filter(o => reachesBand(o, k)));
  Object.defineProperty(level, INDEX, { value: index, configurable: true });
  return index;
}

function reachesBand(o, k) {
  const sweep = o.type === 'shot' ? 0 : Math.abs(o.dy ?? 0) + (o.lift ?? 0) + (o.grow ?? 0);
  return o.y - sweep < (k + 1) * BAND + BAND_MARGIN && o.y + o.h + sweep > k * BAND - BAND_MARGIN;
}

export function nearbyTriggers(level, y) {
  const index = levelIndex(level), k = Math.floor(y / BAND);
  return k >= 0 && k < index.bands.length ? index.bands[k] : index.triggers;
}

export const slain = (state, monster) => (state.slain & (1 << monster.slot)) !== 0;
export const erased = (state, object) => state.erased.includes(object.id);

export function crushed(level, state, object) {
  return state.crushed !== 0 && (state.crushed & (levelIndex(level).crushBit.get(object) ?? 0)) !== 0;
}

export function createLevel(rules, mutators, rows = ROWS) {
  const height = rows * TILE;
  return {
    rules,
    mutators,
    rows,
    height,
    tiles: new Uint8Array(COLS * rows),
    objects: [],
    start: { x: TILE, y: height - 3 * TILE },
    exit: { x: WIDTH - TILE, y: height - 4 * TILE, w: TILE, h: 3 * TILE },
    exitNeeds: 0,
    timed: false,
    palette: 0,
    title: '',
  };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= COLS) return SOLID;
  if (row < 0 || row >= level.rows) return EMPTY;
  return level.tiles[row * COLS + col];
}

export function setTile(level, col, row, value) {
  if (col < 0 || col >= COLS || row < 0 || row >= level.rows) return;
  level.tiles[row * COLS + col] = value;
}

export function fillTiles(level, col, row, w, h, value) {
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) setTile(level, c, r, value);
}

export function addObject(level, object) {
  object.id = level.objects.length;
  if (SLOT_TYPES.has(object.type)) object.slot = level.objects.filter(o => o.type === object.type).length;
  level.objects.push(object);
  if (object.period && !object.steady) level.timed = true;
  return object;
}

export const wrap = (t, period) => ((t % period) + period) % period;
export const cycleAt = (object, clock) => wrap(clock + object.phase, object.period);

export function triangle(t, period) {
  const phase = wrap(t, period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export const START_POSITIONS = 8;
export const startPhase = (position, period) => Math.round((position * period) / START_POSITIONS);

export function moverOffset(object, clock) {
  const k = triangle(clock + object.phase, object.period);
  return { dx: object.dx * k, dy: object.dy * k };
}

export function phaseOn(object, clock) {
  return cycleAt(object, clock) < object.on;
}

function shotTravel(shot, clock) {
  const travel = cycleAt(shot, clock) * shot.speed;
  return travel <= shot.range ? travel : -1;
}

const SPENT = { x: -1000, y: -1000, w: 0, h: 0 };

function perimeterOffset({ dx, dy }, f) {
  const around = f * 2 * (dx + dy);
  if (around < dx) return { dx: around, dy: 0 };
  if (around < dx + dy) return { dx, dy: around - dx };
  if (around < 2 * dx + dy) return { dx: 2 * dx + dy - around, dy };
  return { dx: 0, dy: 2 * (dx + dy) - around };
}

function monsterOffset(o, clock) {
  const f = cycleAt(o, clock) / o.period;
  if (o.motion === 'perimeter') return perimeterOffset(o, f);
  if (o.motion === 'leap') return { dx: 0, dy: f < 0.5 ? -o.lift * Math.sin(f * 2 * Math.PI) : 0 };
  if (o.motion === 'orbit') return { dx: o.dx * Math.cos(f * Math.PI * 2), dy: o.dy * Math.sin(f * Math.PI * 2) };
  if (o.motion === 'swing') {
    const angle = o.arc * Math.sin(f * Math.PI * 2);
    return { dx: o.dx * Math.sin(angle), dy: o.dy * Math.cos(angle) };
  }
  if (o.motion === 'hop') {
    const leg = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    return { dx: o.dx * (f < 0.5 ? leg : 1 - leg), dy: -o.lift * Math.sin(Math.PI * leg) };
  }
  return { dx: 0, dy: o.dy * (f < 0.2 ? f / 0.2 : f < 0.5 ? 1 : 1 - (f - 0.5) / 0.5) };
}

export function objectRect(object, clock) {
  if (object.type === 'shot') {
    const travel = shotTravel(object, clock);
    return travel < 0 ? SPENT : { x: object.x + object.dir * travel, y: object.y, w: object.w, h: object.h, id: object.id };
  }
  if (object.motion === 'puff') {
    const grow = object.grow * Math.max(0, Math.sin((cycleAt(object, clock) / object.period) * Math.PI * 2));
    return { x: object.x - grow, y: object.y - grow, w: object.w + 2 * grow, h: object.h + 2 * grow, id: object.id };
  }
  if (object.period && object.dx !== undefined) {
    const { dx, dy } = object.motion ? monsterOffset(object, clock) : moverOffset(object, clock);
    return { x: object.x + dx, y: object.y + dy, w: object.w, h: object.h, id: object.id };
  }
  return object;
}

export const hazardRect = (o, s) => (o.type === 'lurker' ? { ...o, ...s.lurkers[o.slot] } : objectRect(o, s.clock));

export function floodLevel(level, tide) {
  if (!level.rules.flood) return Infinity;
  const risen = Math.max(0, tide);
  return level.pursuit ? pursuitLevel(level.pursuit, risen) : level.height + PURSUIT.below - risen * level.rules.flood;
}

export function gateOutput({ op, mask, not }, bits) {
  const high = (bits ^ not) & mask;
  if (op === 'and') return high === mask;
  return op === 'or' ? high !== 0 : high !== 0 && high !== mask;
}

const PIN_SPREAD = 7;
const PIN_REACH = 11;

export function gatePins({ mask, not, x, y, dir }) {
  const bits = Array.from({ length: 31 }, (_, i) => 1 << i).filter(bit => mask & bit);
  return bits.map((bit, i) => ({ bit, negated: (not & bit) !== 0, at: [x + (i ? PIN_SPREAD : -PIN_SPREAD), y - dir * PIN_REACH] }));
}

export const lockPowered = (lock, bits) => (lock.gate ? gateOutput(lock.gate, bits) : (bits & lock.bit) !== 0);

export const doorOpen = (door, state, clock) => state.timers[door.timer] >= 0 && clock - state.timers[door.timer] < door.open;

export function isSolidObject(object, state, clock) {
  const bits = state.flags | state.pressed;
  switch (object.type) {
    case 'mover':
    case 'conveyor':
      return true;
    case 'phase':
    case 'gate':
      return phaseOn(object, clock);
    case 'crumble':
      return !state.crumbled[object.slot];
    case 'door':
      return object.timer !== undefined ? !doorOpen(object, state, clock) : !lockPowered(object, bits);
    case 'toggle':
      return lockPowered(object, bits) === object.on;
    default:
      return false;
  }
}

export function overlaps(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export const roomAt = (level, y) => level.rooms?.find(room => y >= room.top && y < room.bottom);

export function serializeLevel(level) {
  return { ...level, tiles: Array.from(level.tiles) };
}

export function deserializeLevel(data) {
  return { ...data, tiles: Uint8Array.from(data.tiles) };
}

const SIZES = new WeakMap();

export function playerSize(rules) {
  let size = SIZES.get(rules);
  if (!size) SIZES.set(rules, size = Object.freeze({ w: PLAYER_W * rules.size, h: PLAYER_H * rules.size }));
  return size;
}
