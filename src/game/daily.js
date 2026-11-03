const DAY = 86400000;
const FIRST = Date.UTC(2026, 9, 29);

export function dailyOn(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '');
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return { key, number: Math.floor((at - FIRST) / DAY) + 1, seed: `daily-${key}` };
}

export const today = (now = new Date()) => dailyOn(now.toISOString().slice(0, 10));
