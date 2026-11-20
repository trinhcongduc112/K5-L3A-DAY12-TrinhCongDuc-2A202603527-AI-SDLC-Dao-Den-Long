import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { frameMetrics } from '../src/frame-metrics.js';
import { normalizeEntry, rankedEntries } from '../src/leaderboard.js';
import { bindingConflict, defaultBindings, validBindings, readSettings, saveSettings } from '../src/settings.js';
import { readLeaderboard, saveEntry } from '../scripts/leaderboard-store.js';

const score = (name, points, date = '2026-01-01T08:00:00+07:00') =>
  ({ name, score: points, nights_won: 2, achieved_at: date, seed: 1200 });

test('v1.3: FPS uses real frame intervals and the mean of the slowest 1 percent', () => {
  const samples = [...Array(198).fill(10), 30, 50];
  assert.deepEqual(frameMetrics(samples), { avg_fps: 97.087, p1_low_fps: 25, frame_ms_p95: 10, frames: 200 });
  assert.deepEqual(frameMetrics([40]), { avg_fps: 25, p1_low_fps: 25, frame_ms_p95: 40, frames: 1 });
  assert.throws(() => frameMetrics([]), /No frame/);
});

test('v1.3: key conflicts include secondary defaults and settings survive loading', () => {
  const initial = defaultBindings();
  assert.equal(bindingConflict(initial, 'jump', 'ArrowUp'), 'Đi tới');
  assert.equal(bindingConflict(initial, 'jump', 'Space'), undefined);
  assert.deepEqual(validBindings({ ...initial, jump: ['KeyE'] }), initial);
  const storage = new Map();
  const adapters = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const settings = readSettings(adapters);
  settings.bindings.jump = ['KeyJ'];
  settings.largeText = true;
  settings.reducedMotion = true;
  saveSettings(adapters, settings);
  assert.deepEqual(readSettings(adapters), settings);
});

test('v1.3: leaderboard validates entries, sorts ties by instant and keeps only ten', () => {
  const earlier = score('Earlier', 23, '2026-01-01T07:59:00+07:00');
  const later = score('Later', 23, '2026-01-01T01:00:00Z');
  const rest = Array.from({ length: 10 }, (_, index) => score('User_' + index, index));
  assert.deepEqual(rankedEntries([later, earlier, ...rest]).map(x => x.name),
    ['Earlier', 'Later', 'User_9', 'User_8', 'User_7', 'User_6', 'User_5', 'User_4', 'User_3', 'User_2']);
  assert.equal(normalizeEntry(score('A!', 23)), null);
  assert.equal(normalizeEntry(score('Valid', 23, '2026-01-01T07:59:00')), null);
});

test('v1.3: leaderboard saves concurrent entries atomically and run_cmd exports from disk', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dao-leaderboard-test-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const file = join(directory, 'leaderboard.json');
  assert.deepEqual(await readLeaderboard(file), { entries: [] });
  const submitted = [score('First', 10), score('Second', 20), score('Third', 30)];
  await Promise.all([...submitted, submitted[0]].map(value => saveEntry(value, file)));
  const out = join(directory, 'export.json');
  execFileSync(process.execPath, ['scripts/run-game.js', '--export-leaderboard', out],
    { env: { ...process.env, DAO_DEN_LONG_DATA_DIR: directory } });
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), { entries: submitted.toReversed() });
});
