import { step, initialState, playerSize } from './physics.js';
import { levelIndex, objectRect } from './level.js';
import { touchCheckpoints, respawn, enterBiome, altitudeMetres, livesAfterDeath, livesAfterBiome } from './climb.js';
import { themeFor } from './themes.js';
import { stepCombo, freshCombo } from './combo.js';
import { TRICK_COST, TRICKS_FROM, TRICKS, PLACEABLE, offerFor, takeTrick, buildAt } from './tricks.js';
import { HAZARD_TYPES, overlaps } from './level.js';
import { standAt } from './climb.js';

export const DEATH_FRAMES = 36;

export function createRun(maxLives) {
  return { index: 0, level: null, s: null, below: null, touched: [], phase: 'loading', phaseAge: 0, lives: maxLives, maxLives, altitude: 0, peak: 0, deaths: 0, path: [], points: 0, combo: freshCombo(), offer: null, bought: [], tricks: [], doubled: -1 };
}

export const takesInput = run => run.phase === 'play' || run.phase === 'choose';
const popcount = bits => { let n = 0; for (let b = bits; b; b &= b - 1) n++; return n; };

export function advance(run, biomes, input = {}) {
  run.phaseAge++;
  if (run.phase === 'loading') return biomes.has(0) ? begin(run, biomes.get(0)) : null;
  if (run.phase === 'choose') return input.pick === undefined ? null : choose(run, input.pick);
  if (run.phase === 'play') return input.restart ? restore(run) : input.place ? place(run, input.place) : input.erase !== undefined ? erase(run, input.erase) : input.flag ? plant(run) : play(run, biomes, input);
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
  run.combo = stepCombo(level, prev, s, run.combo);
  run.points += (run.combo.gained + popcount(s.coins & ~prev.coins)) * (run.doubled === run.index ? 2 : 1);
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
  Object.assign(run, { level: next, index: run.index + 1, touched: [], phase: 'play', phaseAge: 0, combo: freshCombo() });
  run.path.push({ theme: themeFor(next).id, comet: false });
  if (run.index >= TRICKS_FROM) Object.assign(run, { phase: 'choose', offer: offerFor(next), bought: [] });
  return { type: 'enter', level: next };
}

function restore(run) {
  run.s = respawn(run.level, run.s, run.touched);
  run.phase = 'play';
  run.phaseAge = 0;
  run.combo = freshCombo(run.combo.floor);
  return { type: 'restore' };
}

function choose(run, pick) {
  const kind = run.offer[pick - 1] ?? null;
  if (!kind) { Object.assign(run, { offer: null, bought: [], phase: 'play' }); return { type: 'chosen', kind: null }; }
  if (run.bought.includes(kind) || run.points < TRICK_COST) return null;
  takeTrick(run, kind);
  run.bought = [...run.bought, kind];
  return { type: 'chosen', kind };
}

export const canBuy = (run, kind) => run.points >= TRICK_COST && !run.bought.includes(kind);

function spend(run, kind) {
  const at = run.tricks.indexOf(kind);
  run.tricks = run.tricks.filter((_, i) => i !== at);
}

export function hazardAt(level, state, x, y) {
  return level.objects.find(o => HAZARD_TYPES.has(o.type) && !state.erased.includes(o.id) && overlaps(x, y, 1, 1, objectRect(o, state.clock))) ?? null;
}

function place(run, at) {
  const kind = PLACEABLE[at.kind];
  const rect = run.tricks.includes(kind) && buildAt(run.level, run.s, kind, at.x, at.y);
  if (!rect) return null;
  run.s = { ...run.s, placed: [...run.s.placed, rect] };
  spend(run, kind);
  return { type: 'placed', rect };
}

function erase(run, id) {
  const object = run.level.objects[id];
  if (!run.tricks.includes('erase') || !object || !HAZARD_TYPES.has(object.type) || run.s.erased.includes(id)) return null;
  run.s = { ...run.s, erased: [...run.s.erased, id] };
  spend(run, 'erase');
  return { type: 'erased', object };
}

function plant(run) {
  const { s, level } = run;
  if (!run.tricks.includes('flag') || !s.grounded) return null;
  const { w, h } = playerSize(level.rules);
  const flag = { id: -1 - run.touched.length, x: s.x + w / 2 - 12, y: s.y + h - 40, w: 24, h: 40, planted: true };
  run.touched = [...run.touched, { id: flag.id, y: flag.y + flag.h, snapshot: standAt(level, s, flag), flag }];
  spend(run, 'flag');
  return { type: 'planted', flag };
}

function finish(run) {
  run.phase = 'over';
  return { type: 'over' };
}
