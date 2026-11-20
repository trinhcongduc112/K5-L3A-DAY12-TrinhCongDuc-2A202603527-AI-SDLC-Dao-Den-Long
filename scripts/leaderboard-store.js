import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { leaderboardPath, normalizeEntry, rankedEntries } from '../src/leaderboard.js';

export function leaderboardFile() {
  const fallback = process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support')
    : process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  return join(process.env.DAO_DEN_LONG_DATA_DIR || join(fallback, 'dao-den-long'), 'leaderboard.json');
}

export async function readLeaderboard(file = leaderboardFile()) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(data.entries)) throw new Error('Leaderboard entries must be an array');
    return { entries: rankedEntries(data.entries) };
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [] };
    throw error;
  }
}

export async function saveEntry(entry, file = leaderboardFile()) {
  const normalized = normalizeEntry(entry);
  if (!normalized) throw new TypeError('Invalid leaderboard entry');
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const lock = file + '.lock';
  for (let attempts = 0; ; attempts++) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || attempts >= 55) throw error;
      const info = await stat(lock).catch(problem => problem.code === 'ENOENT' ? null : Promise.reject(problem));
      if (info && Date.now() - info.mtimeMs > 30_000) await rm(lock, { recursive: true, force: true });
      await sleep(20);
    }
  }
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    const { entries } = await readLeaderboard(file);
    // A retried submission represents the same score, not a second placement.
    const unique = entries.filter(item => JSON.stringify(item) !== JSON.stringify(normalized));
    const result = { entries: rankedEntries([...unique, normalized]) };
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
    return result;
  } finally {
    await rm(temporary, { force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

export function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

export async function readJsonBody(request, maxLength = 4096) {
  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxLength) throw new RangeError('Request too large');
  }
  return JSON.parse(body);
}

export function leaderboardMiddleware(request, response, next) {
  if (new URL(request.url, 'http://localhost').pathname !== '/' + leaderboardPath) return next();
  async function respond() {
    if (request.method === 'GET') return sendJson(response, 200, await readLeaderboard());
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
    const { origin, host } = request.headers;
    if (origin && origin !== 'http://' + host && origin !== 'https://' + host) {
      return sendJson(response, 403, { error: 'Request originates outside this game' });
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Expected a JSON entry' });
    }
    let entry;
    try {
      entry = normalizeEntry(await readJsonBody(request));
    } catch {
      return sendJson(response, 400, { error: 'Invalid JSON entry' });
    }
    if (!entry) return sendJson(response, 400, { error: 'Invalid leaderboard entry' });
    return sendJson(response, 200, await saveEntry(entry));
  }
  respond().catch(error => {
    console.error('Leaderboard:', error.message);
    if (!response.headersSent) sendJson(response, 500, { error: 'Could not access local leaderboard' });
  });
}
