import { step, initialState, playerSize, shoot, grant } from './physics.js';
import { levelIndex, hazardRect, HAZARD_TYPES, overlaps, erased, slain } from './level.js';
import { lurkerOf } from './lurkers.js';
import { inventoryOf, touchCheckpoints, respawn, enterBiome, altitudeMetres, climbedMetres, RACE_FROM_METRES, livesAfterDeath, livesAfterBiome, standAt } from './climb.js';
import { themeFor } from '../art/themes.js';
import { hallOf, tunnelExit, enterHall, arrive, stallAt, MERCHANT, TRAINER, DICER } from './tunnel.js';
import { biomeBanes, withRules, isBane } from './rules.js';
import { DIFFICULTIES, lostFlags, rewardOf } from './difficulty.js';
import { nearImp } from './imp.js';
import { MAX_SKILL, levelOf, priceOf, withSkills, luckyStart, skillOffer, SKILLS } from './skills.js';
import { stepCombo, freshCombo, earnedLongJump } from './combo.js';
import { TRICK_COST, REROLL_COST, TRICKS_FROM, PLACEABLE, offerFor, takeTrick, buildAt } from './tricks.js';
import { tombOf } from './tombs.js';

const DEATH_FRAMES = 36;
const STILL_SPEED = 1;

export function createRun(maxLives, seed = '') {
  return { seed, collected: [], runes: 0, skills: {}, skillStock: null, rolls: 0, index: 0, level: null, s: null, below: null, hall: null, touched: [], phase: 'loading', phaseAge: 0, elapsed: 0, lives: maxLives, maxLives, altitude: 0, peak: 0, deaths: 0, path: [], points: 0, earned: 0, combo: freshCombo(), offer: null, bought: [], tricks: [], doubled: -1, difficulty: 0 };
}

export const takesInput = run => run.phase === 'play';
const popcount = bits => { let n = 0; for (let b = bits; b; b &= b - 1) n++; return n; };

export function advance(run, biomes, input = {}) {
  run.phaseAge++;
  if (run.phase === 'loading') return begin(run, biomes);
  if (run.phase === 'play') return input.reset ? whenStill(run, reset) : input.restart ? whenStill(run, restore) : input.fire ? fire(run) : input.place ? place(run, input.place) : input.erase !== undefined ? erase(run, input.erase) : input.flag ? plant(run) : input.pick ? buy(run, input.pick) : input.skill ? learn(run, input.skill) : input.reroll ? reroll(run) : input.difficulty !== undefined ? choose(run, input.difficulty) : play(run, biomes, input);
  if (run.phase === 'dead' && run.elapsed > 0) run.elapsed++;
  if (run.phase === 'dead' && run.phaseAge > DEATH_FRAMES) return run.lives > 0 ? restore(run) : finish(run);
  if (run.phase === 'gate') return enterNext(run, biomes);
  return null;
}

export const biomeOf = run => run.hall?.level ?? run.level;

const banesOf = (run, level, index) => biomeBanes(run.seed, index, DIFFICULTIES[run.difficulty].banes, level.timed);

function fitted(run, level, index) {
  const gone = lostFlags(level, run.seed, run.difficulty), worn = withRules(level, banesOf(run, level, index));
  const rules = withSkills(worn.rules, run.skills), rise = playerSize(level.rules).h - playerSize(rules).h;
  return { ...worn, rules, proven: level, start: { ...level.start, y: level.start.y + rise }, objects: level.objects.map(o => (gone.has(o.id) ? { ...o, type: 'removed' } : o)) };
}

const dressed = (run, level, index) => (run.difficulty || Object.keys(run.skills).length ? fitted(run, level, index) : level);

const entryOf = run => (run.level ? biomeOf(run).exitCol : null);

export const wantedBiome = (run, index) => ({ index, entryCol: entryOf(run), rules: [] });

export function wantedChain(run, ahead) {
  const first = run.level ? run.index + 1 : 0;
  return { index: first, entryCol: entryOf(run), history: run.level ? biomeOf(run).profiles ?? [] : [], plans: Array.from({ length: run.index + ahead - first + 1 }, () => []) };
}

export const nextBiome = (run, biomes) => biomes(wantedBiome(run, run.index + 1));

function begin(run, biomes) {
  const want = wantedBiome(run, 0), built = biomes(want);
  if (!built) return null;
  const level = dressed(run, built, 0);
  Object.assign(run, { level, s: initialState(level), phase: 'play', phaseAge: 0 });
  run.path.push({ theme: themeFor(level).id, comet: false });
  return { type: 'begin', level };
}

function play(run, biomes, input) {
  if (run.hall) return walkHall(run, input);
  const level = run.level, prev = run.s, s = step(level, prev, { longJump: earnedLongJump(run.combo), ...input });
  run.s = s;
  if (run.elapsed > 0 || climbedMetres(level, s) >= RACE_FROM_METRES) run.elapsed++;
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
    const tomb = tombOf(level, s);
    if (tomb) run.s = { ...s, tombs: [...s.tombs, tomb] };
    run.lives = livesAfterDeath(run.lives);
    run.deaths++;
    run.phase = 'dead';
    run.phaseAge = 0;
  } else if (s.won) {
    entered = enterNext(run, biomes);
  } else if (side) {
    return passTunnel(run, side);
  }
  return { type: 'step', level, prev, s, checkpoint, entered };
}

function walkHall(run, input) {
  const level = run.level, prev = run.s, s = step(level, prev, input);
  run.s = s;
  const side = tunnelExit(level, s, input);
  if (side) return passTunnel(run, side);
  return { type: 'step', level, prev, s, checkpoint: false, entered: null };
}

function leaveHall(run) {
  const { level, s, comet } = run.hall;
  return { level, s: comet ? grant({ ...s }, 'comet') : s };
}

function refit(run) {
  const level = biomeOf(run), worn = fitted(run, level.proven ?? level, run.index), s = run.s;
  run.s = { ...s, teleports: s.teleports + worn.rules.teleports - level.rules.teleports };
  if (run.hall) Object.assign(run, { hall: { ...run.hall, level: worn }, level: hallOf(worn, run.skills) });
  else run.level = worn;
}

function passTunnel(run, side) {
  const from = run.s;
  if (run.hall) {
    const back = leaveHall(run);
    Object.assign(run, { level: back.level, s: arrive(back.level, back.s, from, side), hall: null });
    return { type: 'surface', level: back.level };
  }
  const hall = hallOf(run.level, run.skills);
  Object.assign(run, { hall: { level: run.level, s: from }, level: hall, s: enterHall(hall, from, side) });
  return { type: 'underpass', level: hall };
}

export const stallOf = run => (run.hall ? stallAt(run.level, run.s) : null);

export const shopOffer = run => (run.index >= TRICKS_FROM ? (run.offer ??= offerFor(run.hall.level, run.rolls)) : null);

export const skillsOnOffer = run => (run.skillStock ??= skillOffer(run.seed, run.index, run.skills, run.rolls));
export const skillPrice = (run, id) => (run.index === 0 && !Object.keys(run.skills).length ? 0 : priceOf(run.skills, id));
export const canLearn = (run, id) => levelOf(run.skills, id) < MAX_SKILL && run.runes >= skillPrice(run, id);

export function train(run, id) {
  const heart = id === 'heart' ? 1 : 0;
  Object.assign(run, { skills: { ...run.skills, [id]: levelOf(run.skills, id) + 1 }, maxLives: run.maxLives + heart, lives: run.lives + heart });
  refit(run);
  run.s = SKILLS[id].fill?.(run.s, run.level.rules) ?? run.s;
}

function learn(run, pick) {
  const id = stallOf(run) === TRAINER && skillsOnOffer(run)[pick - 1];
  if (!id || !canLearn(run, id)) return null;
  run.runes -= skillPrice(run, id);
  train(run, id);
  return { type: 'learned', id, level: run.skills[id] };
}

export const canReroll = run => run.points >= REROLL_COST;

function reroll(run) {
  if (stallOf(run) !== DICER || !canReroll(run)) return null;
  run.points -= REROLL_COST;
  run.rolls++;
  Object.assign(run, { offer: null, skillStock: null, bought: [] });
  return { type: 'rerolled' };
}

function enterNext(run, biomes) {
  const want = wantedBiome(run, run.index + 1), built = biomes(want);
  if (!built) {
    run.phase = 'gate';
    return null;
  }
  const next = dressed(run, built, run.index + 1);
  const unlocked = run.level.mutators.filter(id => isBane(id) && !run.collected.includes(id));
  const raced = outpaced(run), reward = rewardOf(run.difficulty, raced);
  run.points += reward.gold;
  run.earned += reward.gold;
  run.collected = [...run.collected, ...unlocked];
  run.runes += reward.runes;
  run.lives = livesAfterBiome(run.lives, run.maxLives);
  run.path.at(-1).comet = run.s.comet > 0;
  run.below = { level: run.level, state: run.s };
  run.s = enterBiome(run.level, run.s, next);
  Object.assign(run, { level: next, index: run.index + 1, touched: [], phase: 'play', phaseAge: 0, elapsed: 0, combo: freshCombo(), offer: null, skillStock: null, rolls: 0, bought: [] });
  run.path.push({ theme: themeFor(next).id, comet: false });
  const lucky = luckyStart(run.skills, run.seed, run.index);
  if (lucky) run.s = grant({ ...run.s }, 'shield');
  return { type: 'enter', level: next, unlocked, lucky, raced, reward };
}

export const paceOf = level => level.solution?.length ?? 0;
export const outpaced = run => paceOf(run.level) > 0 && run.elapsed <= paceOf(run.level);

export function restful(run) {
  const s = run.s, { w, h } = playerSize(run.level.rules);
  return (s.grounded && Math.abs(s.vx) < STILL_SPEED) || s.climbing || s.rope >= 0 || s.barrel >= 0 || levelIndex(run.level).water.some(o => overlaps(s.x, s.y, w, h, o));
}

const whenStill = (run, act) => (restful(run) ? act(run) : null);

function surface(run) {
  if (!run.hall) return;
  const back = leaveHall(run);
  Object.assign(run, { level: back.level, s: { ...back.s, ...inventoryOf(run.s), frame: run.s.frame }, hall: null });
}

export function restore(run) {
  const comet = run.hall?.comet;
  surface(run);
  run.s = respawn(run.level, run.s, run.touched);
  if (comet) run.s = grant({ ...run.s }, 'comet');
  run.phase = 'play';
  run.phaseAge = 0;
  run.combo = freshCombo(run.combo.floor);
  return { type: 'restore' };
}

function reset(run) {
  const comet = run.hall?.comet;
  surface(run);
  run.touched = [];
  run.s = respawn(run.level, run.s, run.touched);
  if (comet) run.s = grant({ ...run.s }, 'comet');
  Object.assign(run, { phase: 'play', phaseAge: 0, elapsed: 0, combo: freshCombo(run.combo.floor) });
  return { type: 'reset' };
}

export const atImp = run => !run.hall && nearImp(run.level, run.s);

export function difficultyOffer(run) {
  const level = biomeOf(run), proven = level.proven ?? level, flags = proven.objects.filter(o => o.type === 'checkpoint').length;
  return DIFFICULTIES.map((tier, i) => ({ ...tier, rules: biomeBanes(run.seed, run.index, tier.banes, proven.timed), flags: flags - lostFlags(proven, run.seed, i).size, current: i === run.difficulty }));
}

function choose(run, difficulty) {
  if (!atImp(run) || difficulty === run.difficulty || !DIFFICULTIES[difficulty]) return null;
  run.difficulty = difficulty;
  run.touched = [];
  refit(run);
  run.s = { ...respawn(run.level, run.s, []), x: run.s.x, tombs: [] };
  Object.assign(run, { elapsed: 0, combo: freshCombo(run.combo.floor) });
  return { type: 'difficulty', difficulty };
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

const erasable = (o, state) => HAZARD_TYPES.has(o.type) && !erased(state, o) && !(o.type === 'monster' && slain(state, o)) && !(o.type === 'lurker' && lurkerOf(o, state).dead);

export function hazardAt(level, state, x, y) {
  return level.objects.find(o => erasable(o, state) && overlaps(x, y, 1, 1, hazardRect(o, state))) ?? null;
}

function place(run, at) {
  const kind = PLACEABLE[at.kind];
  const rect = !run.hall && run.tricks.includes(kind) && buildAt(run.level, run.s, kind, at.x, at.y);
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
  if (run.hall || !run.tricks.includes('erase') || !object || !erasable(object, run.s)) return null;
  run.s = { ...run.s, erased: [...run.s.erased, id] };
  spend(run, 'erase');
  return { type: 'erased', object };
}

function plant(run) {
  const { s, level } = run;
  if (run.hall || !run.tricks.includes('flag') || !s.grounded) return null;
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
