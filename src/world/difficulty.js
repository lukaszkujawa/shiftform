import { Rng, hashString, mix } from './rng.js?v=85658ef';

export const DIFFICULTIES = [
  { id: 'normal', title: 'Normal', banes: 0, flagsLost: 0, runes: 1, gold: 100, color: 'hsl(130 60% 62% / 1)' },
  { id: 'hard', title: 'Hard', banes: 1, flagsLost: 1, runes: 2, gold: 200, color: 'hsl(45 95% 60% / 1)' },
  { id: 'torment', title: 'Torment', banes: 2, flagsLost: 2, runes: 3, gold: 400, color: 'hsl(20 95% 60% / 1)' },
  { id: 'impossible', title: 'Impossible', banes: 3, flagsLost: Infinity, runes: 5, gold: 600, color: 'hsl(345 95% 62% / 1)' },
];

const FLAG_SALT = 0x464c4147;

export function lostFlags(level, seed, difficulty) {
  const rng = new Rng(mix(mix(hashString(seed), level.index * 7919 + 1), FLAG_SALT));
  return new Set(rng.shuffle(level.objects.filter(o => o.type === 'checkpoint')).slice(0, DIFFICULTIES[difficulty].flagsLost).map(o => o.id));
}

export function rewardOf(difficulty, raced) {
  const { runes, gold } = DIFFICULTIES[difficulty], factor = raced ? 2 : 1;
  return { runes: runes * factor, gold: gold * factor };
}
