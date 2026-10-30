import { mutatorById, compatible, isBane } from './rules.js?v=5f043fa';

export const SWAP_COST = 1;
export const RUNES_PER_BIOME = 1;

export function swapOptions(rules, collected, from) {
  if (!collected.includes(from)) return [];
  const others = rules.filter(id => id !== from).map(mutatorById);
  return collected.filter(id => id !== from && !rules.includes(id) && compatible(others, mutatorById(id)));
}

export const rulesWith = (rules, swap) => rules.map(id => (id === swap?.from ? swap.to : id));

export const collect = (collected, rules) => [...collected, ...rules.filter(id => isBane(id) && !collected.includes(id))];
