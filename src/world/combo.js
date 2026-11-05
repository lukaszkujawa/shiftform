import { playerSize } from './physics.js';

export const COMBO_FROM = 3;
export const REST_FRAMES = 25;
export const MILESTONES = { 3: 'nice', 5: 'great', 8: 'superb', 10: 'unreal', 15: 'legend', 20: 'cosmic' };

export const earnedLongJump = combo => combo.links >= COMBO_FROM;

export const freshCombo = (floor = null) => ({ links: 0, landY: null, rest: 0, gained: 0, floor });

function cometCombo(level, prev, next, combo) {
  const jumped = prev.comet > 0 && next.comet > prev.comet;
  const links = prev.comet > 0 ? combo.links + (jumped ? 1 : 0) : 0;
  const g = next.gravDir, feet = g > 0 ? next.y + playerSize(level.rules).h : next.y;
  const pays = jumped && (combo.floor === null || (feet - combo.floor) * g < -1);
  return { ...freshCombo(pays ? feet : combo.floor), links, gained: pays ? links : 0 };
}

export function stepCombo(level, prev, next, combo) {
  if (next.comet > 0 && !next.dead) return cometCombo(level, prev, next, combo);
  if (next.dead || next.climbing || next.rope >= 0) return freshCombo(combo.floor);
  if (next.grounded && !prev.grounded) {
    const g = next.gravDir, feet = g > 0 ? next.y + playerSize(level.rules).h : next.y;
    const aboveFloor = combo.floor === null || (feet - combo.floor) * g < -1;
    const higher = aboveFloor && combo.landY !== null && (feet - combo.landY) * g < -1;
    const links = higher ? combo.links + 1 : 1;
    const gained = links >= COMBO_FROM ? links : 0;
    return { links, landY: feet, rest: 0, gained, floor: gained ? feet : combo.floor };
  }
  if (!next.grounded) return { ...combo, gained: 0 };
  return combo.rest >= REST_FRAMES ? freshCombo(combo.floor) : { ...combo, rest: combo.rest + 1, gained: 0 };
}
