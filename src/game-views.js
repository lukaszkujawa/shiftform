import { playerSize, blinkDestination, aimOf } from './physics.js';
import { replay, chainStates } from './solver.js';
import { wrap, CLOCK_PERIOD } from './level.js';
import { hazardAt, paceOf } from './run.js';
import { asProven } from './rules.js';
import { buildAt } from './tricks.js';

export function createViews({ game, keys }) {
  const chains = new WeakMap();
  const chainOf = level => chains.get(level) ?? chains.set(level, chainStates(asProven(level))).get(level);

  function routeState() {
    const states = game.routeStates;
    if (!states) return null;
    const clock = game.run.s.clock - game.routeOffset;
    if (clock < states[0].clock) return null;
    while (game.routeIndex + 1 < states.length && states[game.routeIndex + 1].clock <= clock) game.routeIndex++;
    return states[game.routeIndex];
  }

  function stretchFrom(level, touched) {
    const feet = Math.min(Infinity, ...touched.map(t => t.y)), { h } = playerSize(asProven(level).rules);
    return level.segments.findLast(segment => segment.start.y + h >= feet - 1) ?? level.segments[0];
  }

  function toggleRoute() {
    if (game.routeStates) { game.routeStates = null; return; }
    const { touched, s, hall, level } = game.run;
    if (hall) return;
    const segment = stretchFrom(level, touched);
    if (!segment) return;
    const period = level.timed ? CLOCK_PERIOD : 1;
    const wait = wrap(segment.start.clock - s.clock, period);
    game.routeStates = replay(asProven(level), segment.inputs, segment.start);
    game.routeOffset = s.clock + wait - segment.start.clock;
    game.routeIndex = 0;
  }

  function architectView() {
    const { run } = game;
    if (run.hall || !paceOf(run.level)) return null;
    const states = chainOf(run.level);
    return { state: states[Math.min(run.elapsed, states.length - 1)], done: run.elapsed >= states.length, started: run.elapsed > 0 };
  }

  function rivalView() {
    const ghost = game.ghost;
    if (!ghost?.level) return null;
    return { index: ghost.index, state: ghost.phase === 'play' && !ghost.hall && !game.run.hall ? ghost.s : null, altitude: ghost.peak, done: ghost.phase === 'over' };
  }

  const ownedKinds = () => [...new Set(game.run.tricks)];
  const activeTrick = () => ownedKinds()[game.active % Math.max(1, ownedKinds().length)] ?? null;

  function inventoryView() {
    const kinds = ownedKinds();
    return { kinds, counts: kinds.map(kind => game.run.tricks.filter(t => t === kind).length), active: game.building ? activeTrick() : null };
  }

  const teleporting = () => !!game.run.level?.rules.blinkJump && game.run.phase === 'play';

  function blinkAim() {
    const { run } = game, { w, h } = playerSize(run.level.rules), s = run.s;
    if (game.pointer) return aimOf(game.pointer.x - (s.x + w / 2), game.pointer.y + game.camera - (s.y + h / 2));
    const across = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * (run.level.rules.mirror ? -1 : 1);
    return aimOf(across, keys.down ? 1 : -1);
  }

  function blinkPreview() {
    const s = game.run.s;
    if (!teleporting() || s.dead || s.teleports < 1) return null;
    return blinkDestination(game.run.level, s, blinkAim());
  }

  function aim() {
    const { run } = game;
    const kind = activeTrick();
    if (!game.building || !kind || !game.pointer || run.phase !== 'play') return null;
    const x = Math.round(game.pointer.x), y = Math.round(game.pointer.y + game.camera);
    if (kind === 'erase') return { kind, object: hazardAt(run.level, run.s, x, y), x, y };
    if (kind === 'flag') return { kind, ok: run.s.grounded, x, y };
    return { kind, rect: buildAt(run.level, run.s, kind, x, y), x, y };
  }

  return { routeState, toggleRoute, architectView, rivalView, ownedKinds, inventoryView, teleporting, blinkAim, blinkPreview, aim };
}
