import { leaderboardPath, rankedEntries } from './leaderboard.js';

const key = 'dao-den-long-leaderboard';
const endpoint = './' + leaderboardPath;

async function request(options) {
  const reply = await fetch(endpoint, options);
  if ([404, 405].includes(reply.status) || (reply.ok && !reply.headers.get('content-type')?.includes('application/json'))) return null;
  if (!reply.ok) throw new Error('Không truy cập được bảng xếp hạng.');
  return rankedEntries((await reply.json()).entries);
}

function localEntries() {
  try {
    return rankedEntries(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    return [];
  }
}

export async function listScores() {
  return await request() ?? localEntries();
}

export async function persistScore(entry) {
  const remote = await request({
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  });
  if (remote !== null) return remote;
  const entries = rankedEntries([...localEntries(), entry]);
  localStorage.setItem(key, JSON.stringify(entries));
  return entries;
}
