import { TILE, COLS, EMPTY, WATER_TILE, HAZARD_TYPES, startPhase, START_POSITIONS } from '../world/level.js';
import { initialState } from '../world/physics.js';
import { replay } from '../generation/solver.js';
import { BLOCKS, blankBlueprint, levelFrom } from './blueprint.js';

const OWN_FIELDS = new Set(['id', 'slot']);
const CLOSE_TO_NEXT_START = 2 * TILE;

const sameShape = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter(key => !OWN_FIELDS.has(key)));
  return [...keys].every(key => a[key] === b[key]);
};

function cellOfShape(o) {
  return { c: Math.max(0, Math.min(COLS - 1, Math.floor(o.x / TILE))), r: Math.max(0, Math.floor((o.y + o.h - 1) / TILE)), w: Math.max(1, Math.round(o.w / TILE)), h: Math.max(1, Math.round(o.h / TILE)) };
}

function plainBlock(o) {
  const cell = cellOfShape(o);
  for (const block of BLOCKS) {
    if (!block.make || block.only || block.source || block.lock || block.make.length > 1) continue;
    const [shape, extra] = block.make(cell);
    if (extra || shape.type !== o.type) continue;
    if (sameShape(shape, o)) return { b: block.id, ...cell };
    if (!block.timed) continue;
    for (let p = 1; p < START_POSITIONS; p++) if (sameShape({ ...shape, phase: startPhase(p, shape.period) }, o)) return { b: block.id, ...cell, p };
  }
  return null;
}

function madeItem(shapes) {
  const cell = cellOfShape(shapes[0]);
  const o = shapes.map(({ id, slot, target, source, ...shape }) => ({
    ...shape, x: shape.x - cell.c * TILE, y: shape.y - cell.r * TILE,
    ...(source === undefined ? {} : { sourceAt: shapes.findIndex(other => other.id === source) }),
  }));
  return { b: 'made', ...cell, o };
}

function groupsOf(objects) {
  const taken = new Set(), groups = [];
  for (const o of objects) {
    if (taken.has(o)) continue;
    const partners = objects.filter(other => other !== o && !taken.has(other) && (
      other.source === o.id
      || (o.type === 'portal' && other.id === o.target)
      || (o.type === 'hook' && o.motion === 'orbit' && other.type === 'hook' && other.motion === 'orbit' && other.x === o.x && other.y === o.y)
    ));
    for (const member of [o, ...partners]) taken.add(member);
    groups.push([o, ...partners]);
  }
  return groups;
}

const isTileAligned = o => o.x % TILE === 0 && o.y % TILE === 0 && o.w % TILE === 0 && o.h % TILE === 0;

export function blueprintFromLevel(level, keep = {}) {
  const blueprint = { ...blankBlueprint(level.rows), ...keep, rules: level.provenMutators ?? [], rows: level.rows, tiles: Array.from(level.tiles) };
  const gate = level.objects.filter(o => o.type === 'spring' && level.exit.x <= o.x && o.x < level.exit.x + level.exit.w).sort((a, b) => a.y - b.y)[0];
  const gateRow = (gate.y + gate.h) / TILE;
  const carried = [];
  for (const o of level.objects) {
    if (o.type === 'removed' || o === gate) continue;
    if (o.type === 'water' && isTileAligned(o)) {
      for (let r = o.y / TILE; r < (o.y + o.h) / TILE; r++) for (let c = o.x / TILE; c < (o.x + o.w) / TILE; c++) if (blueprint.tiles[r * COLS + c] === EMPTY) blueprint.tiles[r * COLS + c] = WATER_TILE;
      continue;
    }
    carried.push(o);
  }
  let next = 2;
  const items = groupsOf(carried).map(group => ({ ...(group.length === 1 ? plainBlock(group[0]) ?? madeItem(group) : madeItem(group)), u: next++ }));
  const startCol = level.entryCol;
  const goalCol = Math.round(level.exit.x / TILE);
  blueprint.items = [
    { b: 'start', c: startCol, r: level.rows - 2, w: 1, h: 1, u: 0 },
    { b: 'goal', c: goalCol, r: gateRow - 1, w: 1, h: 1, u: 1 },
    ...items,
  ];
  blueprint.next = next;
  return blueprint;
}

export function proofHolds(level, blueprint) {
  const built = levelFrom(blueprint);
  return level.segments.every(({ inputs, start }, k) => {
    const states = replay(built, inputs, k ? start : { ...initialState(built), taken: start.taken }), end = states.at(-1), next = level.segments[k + 1]?.start;
    if (states.some(s => s.dead)) return false;
    return next ? Math.hypot(end.x - next.x, end.y - next.y) < CLOSE_TO_NEXT_START : states.some(s => s.won);
  });
}

export function designSummary(level, blueprint, asked, design) {
  const count = test => level.objects.filter(test).length;
  return {
    title: level.title,
    seconds: Math.round(level.segments.reduce((sum, segment) => sum + segment.inputs.length, 0) / 60),
    monsters: count(o => o.type === 'monster' || o.type === 'lurker'),
    hazards: count(o => HAZARD_TYPES.has(o.type) && o.type !== 'monster' && o.type !== 'lurker'),
    coins: count(o => o.type === 'coin'),
    droppedRules: asked.filter(id => !blueprint.rules.includes(id)),
    styleKept: !design.style || level.focus === design.style,
    flooded: level.segments.some(segment => segment.sunken),
    simplified: !!level.simplified,
    wantedFlood: design.flooded === 'always',
    wantedIdea: design.idea !== 'auto' && design.idea !== 'never',
    ideaKept: level.segments.some(segment => segment.idea === design.idea),
    proven: proofHolds(level, blueprint),
  };
}
