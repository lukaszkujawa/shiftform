import { TILE, WIDTH, overlaps } from './level.js';
import { initialState, playerSize } from './physics.js';

export const MAX_LIVES = 5;
const METRES_PER_TILE = 2;
const HATCH_CLEARANCE = 10;

export function standAt(level, state, checkpoint) {
  const { w, h } = playerSize(level.rules);
  const bodies = state.held >= 0 ? state.bodies.map((b, k) => k === state.held ? { ...b, asleep: 0 } : b) : state.bodies;
  return {
    ...state,
    bodies,
    x: checkpoint.x + checkpoint.w / 2 - w / 2,
    y: checkpoint.y + checkpoint.h - h,
    vx: 0,
    vy: 0,
    gravDir: level.rules.baseGravDir,
    grounded: true,
    groundId: -1,
    coyote: 0,
    jumpsLeft: level.rules.jumps,
    dashLeft: 1,
    dashTimer: 0,
    jumpHeld: false,
    jumpBuffer: 0,
    dashHeld: false,
    interactHeld: false,
    inPortal: false,
    held: -1,
    rope: -1,
    dead: false,
    won: false,
  };
}

export function touchCheckpoints(level, state, touched) {
  const { w, h } = playerSize(level.rules);
  const fresh = level.objects.filter(o => o.type === 'checkpoint' && !touched.some(t => t.id === o.id) && overlaps(state.x, state.y, w, h, o));
  if (!fresh.length) return touched;
  return [...touched, ...fresh.map(o => ({ id: o.id, y: o.y + o.h, snapshot: standAt(level, state, o) }))];
}

export function respawn(level, state, touched) {
  const feet = state.y + playerSize(level.rules).h;
  const below = touched.filter(t => t.y >= feet - TILE).sort((a, b) => a.y - b.y)[0];
  return { ...(below ? below.snapshot : initialState(level)), frame: state.frame, taken: state.taken, ...inventoryOf(state) };
}

export function enterBiome(from, state, to) {
  const { w, h } = playerSize(to.rules);
  const launch = Math.sqrt(2 * to.rules.gravity * (TILE + h + HATCH_CLEARANCE));
  return {
    ...initialState(to),
    x: Math.max(0, Math.min(WIDTH - w, state.x)),
    y: to.height + state.y,
    vx: state.vx,
    vy: -launch,
    facing: state.facing,
    frame: state.frame,
    ...inventoryOf(state),
  };
}

function inventoryOf(state) {
  return { fuel: state.fuel, boots: state.boots, shield: state.shield };
}

export function altitudeMetres(biomeIndex, level, state) {
  return Math.floor(((biomeIndex * level.height + level.height - state.y) / TILE) * METRES_PER_TILE);
}

export function livesAfterDeath(lives) {
  return Math.max(0, lives - 1);
}

export function livesAfterBiome(lives) {
  return Math.min(MAX_LIVES, lives + 1);
}
