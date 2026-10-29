import { step, initialState } from './physics.js';
import { levelIndex } from './level.js';
import { touchCheckpoints, respawn, enterBiome, altitudeMetres, livesAfterDeath, livesAfterBiome } from './climb.js';
import { themeFor } from './themes.js';

export const DEATH_FRAMES = 36;

export function createRun(maxLives) {
  return { index: 0, level: null, s: null, below: null, touched: [], phase: 'loading', phaseAge: 0, lives: maxLives, maxLives, altitude: 0, peak: 0, deaths: 0, path: [] };
}

export const takesInput = run => run.phase === 'play';

export function advance(run, biomes, input = {}) {
  run.phaseAge++;
  if (run.phase === 'loading') return biomes.has(0) ? begin(run, biomes.get(0)) : null;
  if (run.phase === 'play') return input.restart ? restore(run) : play(run, biomes, input);
  if (run.phase === 'dead' && run.phaseAge > DEATH_FRAMES) return run.lives > 0 ? restore(run) : finish(run);
  if (run.phase === 'gate') return enterNext(run, biomes);
  return null;
}

function begin(run, level) {
  Object.assign(run, { level, s: initialState(level), phase: 'play', phaseAge: 0 });
  run.path.push({ theme: themeFor(level).id, comet: false });
  return { type: 'begin', level };
}

function play(run, biomes, input) {
  const level = run.level, prev = run.s, s = step(level, prev, input);
  run.s = s;
  const touched = touchCheckpoints(level, s, run.touched);
  const checkpoint = touched !== run.touched;
  run.touched = touched;
  const gained = s.taken & ~prev.taken;
  if (gained && levelIndex(level).items.some(o => o.kind === 'heart' && gained & (1 << o.slot))) run.lives = run.maxLives;
  run.altitude = altitudeMetres(run.index, level, s);
  run.peak = Math.max(run.peak, run.altitude);
  let entered = null;
  if (s.dead) {
    run.lives = livesAfterDeath(run.lives);
    run.deaths++;
    run.phase = 'dead';
    run.phaseAge = 0;
  } else if (s.won) {
    entered = enterNext(run, biomes);
  }
  return { type: 'step', level, prev, s, checkpoint, entered };
}

function enterNext(run, biomes) {
  const next = biomes.get(run.index + 1);
  if (!next) {
    run.phase = 'gate';
    return null;
  }
  run.lives = livesAfterBiome(run.lives, run.maxLives);
  run.path.at(-1).comet = run.s.comet > 0;
  run.below = { level: run.level, state: run.s };
  run.s = enterBiome(run.level, run.s, next);
  Object.assign(run, { level: next, index: run.index + 1, touched: [], phase: 'play', phaseAge: 0 });
  run.path.push({ theme: themeFor(next).id, comet: false });
  return { type: 'enter', level: next };
}

function restore(run) {
  run.s = respawn(run.level, run.s, run.touched);
  run.phase = 'play';
  run.phaseAge = 0;
  return { type: 'restore' };
}

function finish(run) {
  run.phase = 'over';
  return { type: 'over' };
}
