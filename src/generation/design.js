import { LURKERS } from '../world/lurkers.js';

const AMOUNT = { none: 0, some: 1, lots: 1.6, swarm: 2 };
const MONSTER_TRIES = { none: 0, some: 1, swarm: 3 };
const TOLERANCE_SHIFT = { forgiving: 3, normal: 0, tight: -1 };
const LOTS_OF_COINS = 6;
const TOLERANCE_FLOOR = 2;
const HAZARD_KILLERS = new Set(['saw', 'crusher', 'pendulum', 'beam', 'flame']);
const KILLER_MONSTER = { turret: 'spitter' };

export const HAZARD_FEATURES = new Set(['laser', 'saw', 'spikeStrip', 'floatingSpike']);
export const MONSTER_KINDS = ['patroller', 'crawler', 'flapper', 'spitter', 'hopper', 'urchin', 'spider', 'puffer', 'leaper', ...Object.keys(LURKERS)];

export const DEFAULT_DESIGN = {
  difficulty: 4, style: null, stretches: 2, monsters: 'some', kinds: MONSTER_KINDS, hazards: 'some',
  budget: 'good', fun: 'balanced', repeatable: false, coins: 'normal', flooded: 'auto', timing: 'normal', devices: 'random',
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
    cover: gauntlet.cover * hazards, ceilings: gauntlet.ceilings * hazards, sills: gauntlet.sills * hazards, mines: gauntlet.mines * hazards,
    killers: (gauntlet.killers * (hazards + monsters)) / 2,
    lurkers: Math.round(gauntlet.lurkers * monsters),
  };
}
