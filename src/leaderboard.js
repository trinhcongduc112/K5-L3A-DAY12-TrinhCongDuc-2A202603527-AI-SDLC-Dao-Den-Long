export const leaderboardPath = '__dao_leaderboard';
export const leaderboardName = /^[A-Za-z0-9_]{3,12}$/;
const isoWithZone = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;

export function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const { name, score, nights_won, achieved_at, seed } = value;
  if (typeof name !== 'string' || !leaderboardName.test(name) ||
      !Number.isSafeInteger(score) || score < 0 ||
      !Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3 ||
      typeof achieved_at !== 'string' || !isoWithZone.test(achieved_at) ||
      !Number.isFinite(Date.parse(achieved_at)) || !Number.isSafeInteger(seed)) return null;
  return { name, score, nights_won, achieved_at, seed };
}

export function rankedEntries(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeEntry).filter(Boolean)
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, 10);
}
