import { LURKERS } from '../world/lurkers.js?v=9b09a76';

const AMOUNT = { none: 0, some: 1, lots: 1.6, swarm: 2 };
const MONSTER_TRIES = { none: 0, some: 1, swarm: 3 };
const TOLERANCE_SHIFT = { forgiving: 3, normal: 0, tight: -1 };
const DEATH_SCALE = { forgiving: 0.6, normal: 1, tight: 1.4 };
const LOTS_OF_COINS = 6;
const CAPS_FIT_STRETCHES = 4;
const TOLERANCE_FLOOR = 1;
const HAZARD_KILLERS = new Set(['saw', 'crusher', 'pendulum', 'beam', 'flame']);
const KILLER_MONSTER = { turret: 'spitter' };

const HAZARD_FEATURES = new Set(['laser', 'saw', 'spikeStrip', 'floatingSpike']);
export const MONSTER_KINDS = ['patroller', 'crawler', 'flapper', 'spitter', 'hopper', 'urchin', 'spider', 'puffer', 'leaper', 'eel', 'jelly', ...Object.keys(LURKERS)];
export const BUILDER_ONLY_KINDS = ['puffer', 'leaper'];

export const DEFAULT_DESIGN = {
  difficulty: 4, style: null, stretches: 2, monsters: 'some', kinds: MONSTER_KINDS, hazards: 'some',
  budget: 'good', fun: 'balanced', repeatable: false, coins: 'normal', flooded: 'auto', idea: 'auto', timing: 'normal', devices: 'random',
};

export const monsterTries = design => MONSTER_TRIES[design.monsters];
export const wantsMonster = (design, kind) => !design || design.monsters !== 'none' && design.kinds.includes(kind);
export const wantsFeature = (design, id) => !design || design.hazards !== 'none' || !HAZARD_FEATURES.has(id);
export const coinsPerStretch = (design, usual) => (design?.coins === 'none' ? 0 : design?.coins === 'lots' ? LOTS_OF_COINS : usual);

export function wantsKiller(design, kind) {
  if (!design) return true;
  return HAZARD_KILLERS.has(kind) ? design.hazards !== 'none' : wantsMonster(design, KILLER_MONSTER[kind] ?? kind);
}

export function tunedGauntlet(gauntlet, design) {
  if (!design || !gauntlet) return gauntlet;
  const hazards = AMOUNT[design.hazards], monsters = AMOUNT[design.monsters];
  return {
    ...gauntlet,
    tolerance: Math.max(TOLERANCE_FLOOR, gauntlet.tolerance + TOLERANCE_SHIFT[design.timing]),
    deaths: gauntlet.deaths * DEATH_SCALE[design.timing], worst: Math.min(1, gauntlet.worst * DEATH_SCALE[design.timing]),
    cover: gauntlet.cover * hazards, ceilings: gauntlet.ceilings * hazards, sills: gauntlet.sills * hazards, mines: gauntlet.mines * hazards,
    killers: (gauntlet.killers * (hazards + monsters)) / 2,
    lurkers: Math.round(gauntlet.lurkers * monsters * Math.max(1, design.stretches / CAPS_FIT_STRETCHES)),
  };
}
