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

export function createLevel(rules, mutators) {
  return {
    rules,
    mutators,
    tiles: new Uint8Array(COLS * ROWS),
    objects: [],
    start: { x: TILE, y: HEIGHT - 3 * TILE },
    exit: { x: WIDTH - TILE, y: HEIGHT - 4 * TILE, w: TILE, h: 3 * TILE },
    exitNeeds: 0,
    timed: false,
    palette: 0,
    title: '',
  };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= COLS) return SOLID;
  if (row < 0 || row >= ROWS) return EMPTY;
  return level.tiles[row * COLS + col];
}

export function setTile(level, col, row, value) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  level.tiles[row * COLS + col] = value;
}

export function fillTiles(level, col, row, w, h, value) {
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) setTile(level, c, r, value);
}

export function addObject(level, object) {
  object.id = level.objects.length;
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

export function objectRect(object, clock) {
  if (object.type === 'mover') {
    const { dx, dy } = moverOffset(object, clock);
    return { x: object.x + dx, y: object.y + dy, w: object.w, h: object.h, id: object.id };
  }
  return object;
}

export function isSolidObject(object, state, clock) {
  switch (object.type) {
    case 'mover':
    case 'conveyor':
      return true;
    case 'phase':
      return phaseOn(object, clock);
    case 'crumble':
      return (state.flags & object.bit) === 0 || state.groundId === object.id;
    case 'door':
      return (state.flags & object.bit) === 0;
    case 'toggle':
      return ((state.flags & object.bit) !== 0) === object.on;
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
