import { step, initialState, playerSize, shoot, grant } from './physics.js';
import { levelIndex, objectRect, HAZARD_TYPES, overlaps, erased } from './level.js';
import { touchCheckpoints, respawn, enterBiome, altitudeMetres, livesAfterDeath, livesAfterBiome, standAt } from './climb.js';
import { themeFor } from './themes.js';
import { hallOf, tunnelExit, enterHall, arrive, stallAt, MERCHANT, RULESMITH, OUTFITTER } from './tunnel.js';
import { biomeRules, isBane } from './rules.js';
import { swapOptions, rulesWith, collect, SWAP_COST, RUNES_PER_BIOME } from './rulesmith.js';
import { gearOffer, equip, activeGear, priceOf, spareLives, luckyStart } from './outfitter.js';
import { stepCombo, freshCombo } from './combo.js';
import { TRICK_COST, TRICKS_FROM, PLACEABLE, offerFor, takeTrick, buildAt } from './tricks.js';

const DEATH_FRAMES = 36;

export function createRun(maxLives, seed = '') {
  return { seed, collected: [], runes: 0, swaps: {}, visit: 0, gear: [], planned: null, waiting: 0, index: 0, level: null, s: null, below: null, hall: null, touched: [], phase: 'loading', phaseAge: 0, lives: maxLives, maxLives, altitude: 0, peak: 0, deaths: 0, path: [], points: 0, earned: 0, combo: freshCombo(), offer: null, gearOffer: null, bought: [], tricks: [], doubled: -1 };
}

export const takesInput = run => run.phase === 'play';
const popcount = bits => { let n = 0; for (let b = bits; b; b &= b - 1) n++; return n; };

export function advance(run, biomes, input = {}) {
  run.phaseAge++;
  if (run.phase === 'loading') return begin(run, biomes);
  if (run.phase === 'play') return input.restart ? restore(run, biomes) : input.fire ? fire(run) : input.place ? place(run, input.place) : input.erase !== undefined ? erase(run, input.erase) : input.flag ? plant(run) : input.pick ? buy(run, input.pick) : input.equip ? outfit(run, input.equip, input.giving) : input.swap ? rewrite(run, input.swap) : play(run, biomes, input);
  if (run.phase === 'dead' && run.phaseAge > DEATH_FRAMES) return run.lives > 0 ? restore(run, biomes) : finish(run);
  if (run.phase === 'gate') return enterNext(run, biomes);
  if (run.phase === 'rebuild') return run.waiting ? passTunnel(run, biomes, run.waiting) : restore(run, biomes);
  return null;
}

export const biomeOf = run => run.hall?.level ?? run.level;

export function rulesFor(run, index) {
  const banes = rulesWith(biomeRules(run.seed, index), run.swaps[index]);
  return [...banes, ...activeGear(run.gear, banes)];
}

const entryOf = (run, index) => (!run.level ? null : index === run.index ? biomeOf(run).entryCol : biomeOf(run).exitCol);
const sameRules = (a, b) => a?.length === b.length && a.every((id, i) => id === b[i]);

export const wantedBiome = (run, index) => ({ index, entryCol: entryOf(run, index), rules: rulesFor(run, index) });
export const stale = run => !!run.level && !sameRules(run.planned, rulesFor(run, run.index));

export function wantedChain(run, ahead) {
  const first = !run.level ? 0 : stale(run) ? run.index : run.index + 1;
  return { index: first, entryCol: entryOf(run, first), plans: Array.from({ length: run.index + ahead - first + 1 }, (_, k) => rulesFor(run, first + k)) };
}

export const nextBiome = (run, biomes) => biomes(wantedBiome(run, run.index + 1));

function begin(run, biomes) {
  const want = wantedBiome(run, 0), level = biomes(want);
  if (!level) return null;
  Object.assign(run, { level, s: initialState(level), planned: want.rules, phase: 'play', phaseAge: 0 });
  run.path.push({ theme: themeFor(level).id, comet: false });
  return { type: 'begin', level };
}

function play(run, biomes, input) {
  if (run.hall) return walkHall(run, biomes, input);
  const level = run.level, prev = run.s, s = step(level, prev, input);
  run.s = s;
  const touched = touchCheckpoints(level, s, run.touched);
  const checkpoint = touched !== run.touched;
  run.touched = touched;
  const gained = s.taken & ~prev.taken;
  if (gained && levelIndex(level).items.some(o => o.kind === 'heart' && gained & (1 << o.slot))) run.lives = run.maxLives;
  run.combo = stepCombo(level, prev, s, run.combo);
  const scored = (run.combo.gained + popcount(s.coins & ~prev.coins)) * (run.doubled === run.index ? 2 : 1);
  run.points += scored;
  run.earned += scored;
  run.altitude = altitudeMetres(run.index, level, s);
  run.peak = Math.max(run.peak, run.altitude);
  let entered = null;
  const side = tunnelExit(level, s, input);
  if (s.dead) {
    run.lives = livesAfterDeath(run.lives);
    run.deaths++;
    run.phase = 'dead';
    run.phaseAge = 0;
  } else if (s.won) {
    entered = enterNext(run, biomes);
  } else if (side) {
    return passTunnel(run, biomes, side);
  }
  return { type: 'step', level, prev, s, checkpoint, entered };
}

function walkHall(run, biomes, input) {
  const level = run.level, prev = run.s, s = step(level, prev, input);
  run.s = s;
  const side = tunnelExit(level, s, input);
  if (side) return passTunnel(run, biomes, side);
  return { type: 'step', level, prev, s, checkpoint: false, entered: null };
}

function leaveHall(run, biomes) {
  const back = surfaceOf(run, biomes);
  return back && run.hall.comet ? { ...back, s: grant({ ...back.s }, 'comet') } : back;
}

function surfaceOf(run, biomes) {
  const { level, s } = run.hall;
  if (!stale(run)) return { level, s, touched: run.touched };
  const want = wantedBiome(run, run.index), fresh = biomes(want);
  if (!fresh) return null;
  run.planned = want.rules;
  return fresh === level ? { level, s, touched: run.touched } : { level: fresh, s: initialState(fresh), touched: [] };
}

function passTunnel(run, biomes, side) {
  const from = run.s;
  if (run.hall) {
    const back = leaveHall(run, biomes);
    if (!back) return wait(run, side);
    const s = arrive(back.level, back.s, from, side);
    Object.assign(run, { level: back.level, s, touched: back.touched, hall: null, phase: 'play' });
    return { type: 'surface', level: back.level };
  }
  const hall = hallOf(run.level);
  run.visit++;
  Object.assign(run, { hall: { level: run.level, s: from }, level: hall, s: enterHall(hall, from, side) });
  return { type: 'underpass', level: hall };
}

function wait(run, side) {
  Object.assign(run, { phase: 'rebuild', waiting: side });
  return null;
}

export const currentRules = run => biomeRules(run.seed, run.index);

export const stallOf = run => (run.hall ? stallAt(run.level, run.s) : null);

export const shopOffer = run => (run.index >= TRICKS_FROM ? (run.offer ??= offerFor(run.hall.level)) : null);

function refundOf(run) {
  const swap = run.swaps[run.index];
  return swap?.visit === run.visit ? swap.cost : 0;
}

export const swapPrice = run => SWAP_COST - refundOf(run);

function rewrite(run, { from, to }) {
  const rules = currentRules(run);
  if (stallOf(run) !== RULESMITH || !rules.includes(from)) return null;
  if (to === from) {
    if (run.swaps[run.index]?.from !== from) return null;
    run.runes += refundOf(run);
    delete run.swaps[run.index];
  } else {
    const price = swapPrice(run);
    if (!swapOptions(rules, run.collected, from).includes(to) || run.runes < price) return null;
    run.runes -= price;
    run.swaps[run.index] = { from, to, cost: SWAP_COST, visit: run.visit };
  }
  return { type: 'rewritten', from, to };
}

export const outfitterOffer = run => (run.gearOffer ??= gearOffer(run.seed, run.index, run.gear));
export const gearPrice = (run, kind) => (run.index === 0 && !run.gear.length ? 0 : priceOf(kind));
export const canEquip = (run, kind) => run.runes >= gearPrice(run, kind) && !run.gear.includes(kind);

function outfit(run, pick, giving) {
  const kind = stallOf(run) === OUTFITTER && outfitterOffer(run)[pick - 1];
  if (!kind || !canEquip(run, kind)) return null;
  const price = gearPrice(run, kind), { gear, replaced } = equip(run.gear, kind, run.gear[giving]);
  const extra = spareLives(gear) - spareLives(run.gear), maxLives = run.maxLives + extra;
  Object.assign(run, { gear, runes: run.runes - price, maxLives, lives: Math.min(maxLives, run.lives + Math.max(0, extra)) });
  return { type: 'equipped', kind, replaced };
}

function enterNext(run, biomes) {
  const want = wantedBiome(run, run.index + 1), next = biomes(want);
  if (!next) {
    run.phase = 'gate';
    return null;
  }
  run.planned = want.rules;
  const unlocked = run.level.mutators.filter(id => isBane(id) && !run.collected.includes(id));
  run.collected = collect(run.collected, run.level.mutators);
  run.runes += RUNES_PER_BIOME;
  run.lives = livesAfterBiome(run.lives, run.maxLives);
  run.path.at(-1).comet = run.s.comet > 0;
  run.below = { level: run.level, state: run.s };
  run.s = enterBiome(run.level, run.s, next);
  Object.assign(run, { level: next, index: run.index + 1, touched: [], phase: 'play', phaseAge: 0, combo: freshCombo(), offer: null, gearOffer: gearOffer(run.seed, run.index + 1, run.gear), bought: [] });
  run.path.push({ theme: themeFor(next).id, comet: false });
  const lucky = luckyStart(run.gear, run.seed, run.index);
  if (lucky) run.s = grant({ ...run.s }, 'shield');
  return { type: 'enter', level: next, unlocked, lucky };
}

function restore(run, biomes) {
  if (run.hall) {
    const back = leaveHall(run, biomes);
    if (!back) return wait(run, 0);
    Object.assign(run, { level: back.level, s: { ...back.s, frame: run.s.frame }, touched: back.touched, hall: null });
  }
  run.s = respawn(run.level, run.s, run.touched);
  run.phase = 'play';
  run.phaseAge = 0;
  run.combo = freshCombo(run.combo.floor);
  return { type: 'restore' };
}

function buy(run, pick) {
  const kind = stallOf(run) === MERCHANT && shopOffer(run)?.[pick - 1];
  if (!kind || run.bought.includes(kind) || run.points < TRICK_COST) return null;
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
  return level.objects.find(o => HAZARD_TYPES.has(o.type) && !erased(state, o) && overlaps(x, y, 1, 1, objectRect(o, state.clock))) ?? null;
}

function place(run, at) {
  const kind = PLACEABLE[at.kind];
  const rect = run.tricks.includes(kind) && buildAt(run.level, run.s, kind, at.x, at.y);
  if (!rect) return null;
  run.s = { ...run.s, placed: [...run.s.placed, rect] };
  spend(run, kind);
  return { type: 'placed', rect };
}

function fire(run) {
  const s = shoot(run.level, run.s);
  if (!s) return null;
  run.s = s;
  return { type: 'shot' };
}

function erase(run, id) {
  const object = run.level.objects[id];
  if (!run.tricks.includes('erase') || !object || !HAZARD_TYPES.has(object.type) || erased(run.s, object)) return null;
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
