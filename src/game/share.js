import { THEMES } from '../art/themes.js?v=ececfed';

const EMOJI = Object.fromEntries(THEMES.map(t => [t.id, t.emoji]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function climbLine(path) {
  return path.map(step => EMOJI[step.theme]).join('') + '💀';
}

export function shareText({ daily, seed, metres, path, deaths, best, points = 0 }, url) {
  const title = daily ? `Shiftform Daily #${daily.number}` : `Shiftform · seed "${seed}"`;
  const stats = [plural(deaths, 'death'), points && `${points.toLocaleString('en')} gold`, best > metres && `best ${best.toLocaleString('en')} m`].filter(Boolean).join(' · ');
  return [`${title} — ${metres.toLocaleString('en')} m`, climbLine(path), stats, url].join('\n');
}
