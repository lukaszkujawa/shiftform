const PREFIX = 'shiftform:best:';
export const LEADERBOARD = 50;

export function bestOf(seed) {
  try { return Number(localStorage.getItem(PREFIX + seed)) || 0; } catch { return 0; }
}

export function saveBest(seed, metres) {
  try { localStorage.setItem(PREFIX + seed, String(metres)); } catch {}
}

export function topClimbs(limit = LEADERBOARD) {
  try {
    return Object.keys(localStorage)
      .filter(key => key.startsWith(PREFIX))
      .map(key => ({ seed: key.slice(PREFIX.length), metres: Number(localStorage.getItem(key)) || 0 }))
      .filter(climb => climb.metres > 0)
      .sort((a, b) => b.metres - a.metres)
      .slice(0, limit);
  } catch {
    return [];
  }
}
