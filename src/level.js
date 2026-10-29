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
export const CRATE_SIZE = 28;
export const CRATE_KINDS = {
  wood: { mass: 1, floats: true },
  steel: { mass: 2, floats: false },
  stone: { mass: 4, floats: false },
};

const DYNAMIC_TYPES = new Set(['mover', 'conveyor', 'phase', 'gate', 'crumble', 'door', 'toggle']);
const TRIGGER_TYPES = new Set(['spikes', 'laser', 'saw', 'monster', 'shot', 'key', 'orb', 'switch', 'spring', 'bumper', 'gravpad', 'portal', 'item', 'coin']);
export const HAZARD_TYPES = new Set(['spikes', 'laser', 'saw', 'monster']);
const CRUSHABLE_TYPES = new Set(['saw', 'spring']);
const BODY_TRIGGER_TYPES = new Set(['saw', 'spring', 'bumper', 'switch', 'portal']);
const INDEX = Symbol('index');

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
    items: ofType('item'),
    coins: ofType('coin'),
    hooks: ofType('hook'),
    climbs: ofType('climb'),
    plates: ofType('plate'),
    crushBit: new Map(crushable.map((o, i) => [o, 1 << i])),
  };
  Object.defineProperty(level, INDEX, { value: index, configurable: true });
  return index;
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
    floodMin: 0,
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
  if (object.type === 'crate' || object.type === 'crumble' || object.type === 'item' || object.type === 'monster' || object.type === 'coin') object.slot = level.objects.filter(o => o.type === object.type).length;
  level.objects.push(object);
  if (object.period) level.timed = true;
  return object;
}

export function triangle(t, period) {
  const phase = ((t % period) + period) % period / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export function moverOffset(object, clock) {
  const k = triangle(clock + object.phase, object.period);
  return { dx: object.dx * k, dy: object.dy * k };
}

export function phaseOn(object, clock) {
  return (((clock + object.phase) % object.period) + object.period) % object.period < object.on;
}

export function shotTravel(shot, clock) {
  const travel = ((((clock + shot.phase) % shot.period) + shot.period) % shot.period) * shot.speed;
  return travel <= shot.range ? travel : -1;
}

const SPENT = { x: -1000, y: -1000, w: 0, h: 0 };

export function objectRect(object, clock) {
  if (object.type === 'shot') {
    const travel = shotTravel(object, clock);
    return travel < 0 ? SPENT : { x: object.x + object.dir * travel, y: object.y, w: object.w, h: object.h, id: object.id };
  }
  if (object.period && object.dx !== undefined) {
    const { dx, dy } = moverOffset(object, clock);
    return { x: object.x + dx, y: object.y + dy, w: object.w, h: object.h, id: object.id };
  }
  return object;
}

export function floodLevel(level, clock) {
  return level.rules.flood ? Math.max(level.floodMin, level.height + 90 - clock * level.rules.flood) : Infinity;
}

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
      return (bits & object.bit) === 0;
    case 'toggle':
      return ((bits & object.bit) !== 0) === object.on;
    default:
      return false;
  }
}

export function overlaps(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function serializeLevel(level) {
  return { ...level, tiles: Array.from(level.tiles) };
}

export function deserializeLevel(data) {
  return { ...data, tiles: Uint8Array.from(data.tiles) };
}
