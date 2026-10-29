import { TILE, WIDTH, overlaps } from './level.js';
import { initialState, playerSize, NO_COMET } from './physics.js';

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
    charge: 0,
    chargeDir: 0,
    dead: false,
    won: false,
    ...NO_COMET,
  };
}

export function touchCheckpoints(level, state, touched) {
  const { w, h } = playerSize(level.rules);
  const fresh = level.objects.filter(o => o.type === 'checkpoint' && !touched.some(t => t.id === o.id) && overlaps(state.x, state.y, w, h, o));
  if (!fresh.length) return touched;
  return [...touched, ...fresh.map(o => ({ id: o.id, y: o.y + o.h, snapshot: standAt(level, state, o) }))];
}

export function respawn(level, state, touched) {
  const highest = touched.reduce((best, t) => (best && best.y <= t.y ? best : t), null);
  return { ...(highest ? highest.snapshot : initialState(level)), frame: state.frame, taken: state.taken, coins: state.coins, placed: state.placed, erased: state.erased, ...inventoryOf(state) };
}

export function enterBiome(from, state, to) {
  const { w, h } = playerSize(to.rules);
  const launch = Math.sqrt(2 * to.rules.gravity * (TILE + h + HATCH_CLEARANCE));
  return {
    ...initialState(to),
    x: Math.max(0, Math.min(WIDTH - w, state.x)),
    y: to.height + state.y,
    vx: state.vx,
    vy: state.comet ? state.vy : -launch,
    facing: state.facing,
    frame: state.frame,
    ...inventoryOf(state),
    ...(state.comet ? cometOf(state) : {}),
  };
}

const cometOf = state => ({ comet: state.comet, cometWait: state.cometWait, cometMissed: state.cometMissed, cometBounces: state.cometBounces, cometGates: state.cometGates + 1 });

function inventoryOf(state) {
  return { fuel: state.fuel, boots: state.boots, shield: state.shield };
}

export function altitudeMetres(biomeIndex, level, state) {
  return Math.floor(((biomeIndex * level.height + level.height - state.y) / TILE) * METRES_PER_TILE);
}

export function livesAfterDeath(lives) {
  return Math.max(0, lives - 1);
}

export function livesAfterBiome(lives, max = MAX_LIVES) {
  return Math.min(max, lives + 1);
}
