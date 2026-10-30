import { Rng, hashString, mix } from './rng.js?v=5f043fa';
import { MUTATORS, BOONS, mutatorById, compatible, isPerk } from './rules.js?v=5f043fa';

export const GEAR_SLOTS = 2;
export const TIERS = {
  common: { cost: 2, color: 'hsl(210 20% 80% / 1)', weight: () => 4 },
  rare: { cost: 3, color: 'hsl(205 95% 62% / 1)', weight: index => Math.min(4, index) },
  epic: { cost: 4, color: 'hsl(285 90% 70% / 1)', weight: index => Math.max(0, index - 3) },
};
const TIER_OF = { glide: 'common', slowair: 'common', superhot: 'common', spare: 'common', charm: 'common', grip: 'common', torch: 'common', walls: 'rare', dash: 'rare', moon: 'rare', double: 'rare', triple: 'epic', blink: 'epic', flywheel: 'epic' };
export const tierOf = id => TIER_OF[id];
export const priceOf = id => TIERS[tierOf(id)].cost;
const OFFER = 3;
const GEAR_SALT = 0x47454152;
const LUCK_SALT = 0x4c55434b;
const LUCK = 0.5;

const touched = id => {
  const rules = {};
  mutatorById(id).apply(rules);
  return Object.keys(rules);
};

const clashes = (a, b) => touched(a).some(key => touched(b).includes(key));

export function gearOffer(seed, index, worn = [], roll = 0) {
  const rng = new Rng(mix(mix(hashString(seed), index * 7919 + 1), GEAR_SALT + roll));
  const weightOf = m => TIERS[tierOf(m.id)].weight(index) * m.weight;
  const pool = MUTATORS.filter(m => BOONS.includes(m.id) && !worn.includes(m.id) && weightOf(m) > 0);
  const offer = [];
  while (offer.length < OFFER) offer.push(pool.splice(pool.indexOf(rng.weighted(pool, weightOf)), 1)[0].id);
  return offer;
}

export const replacedBy = (gear, kind, giving = null) => gear.find(id => clashes(id, kind)) ?? (gear.length >= GEAR_SLOTS ? (gear.includes(giving) ? giving : gear[0]) : null);

export function equip(gear, kind, giving = null) {
  const replaced = replacedBy(gear, kind, giving);
  return { gear: [...gear.filter(id => id !== replaced), kind], replaced };
}

export const activeGear = (gear, banes) => gear.filter(id => !isPerk(id) && compatible(banes.map(mutatorById), mutatorById(id)));

export const spareLives = gear => (gear.includes('spare') ? 1 : 0);

export const lightOf = gear => (gear.includes('torch') ? 2 : 1);

export const luckyStart = (gear, seed, index) => gear.includes('charm') && new Rng(mix(mix(hashString(seed), index * 7919 + 1), LUCK_SALT)).chance(LUCK);
