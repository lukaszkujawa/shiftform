import { THEMES } from './themes.js';

const EMOJI = Object.fromEntries(THEMES.map(t => [t.id, t.emoji]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function climbLine(path) {
  return path.map(step => EMOJI[step.theme] + (step.comet ? '☄️' : '')).join('') + '💀';
}

export function shareText({ daily, seed, metres, path, deaths, best, points = 0 }, url) {
  const title = daily ? `Shiftform Daily #${daily.number}` : `Shiftform · seed "${seed}"`;
  const skips = path.filter(step => step.comet).length;
  const stats = [plural(deaths, 'death'), points && plural(points, 'point'), skips && plural(skips, 'comet skip'), best > metres && `best ${best.toLocaleString('en')} m`].filter(Boolean).join(' · ');
  return [`${title} — ${metres.toLocaleString('en')} m`, climbLine(path), stats, url].join('\n');
}
