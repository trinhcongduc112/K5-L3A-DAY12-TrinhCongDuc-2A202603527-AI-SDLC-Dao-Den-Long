import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'lantern-test-'));
const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const { tuning } = contract;
let id = 0;
after(() => rmSync(directory, { recursive: true, force: true }));

function run({ scenario, frames, ticks = 120, seed = 7, night = 1, every = 1 } = {}) {
  const base = join(directory, String(++id));
  const output = base + '.jsonl';
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks),
    '--snapshot-every', String(every), '--out', output];
  if (scenario !== undefined) {
    const path = base + '-scenario.json';
    writeFileSync(path, JSON.stringify(scenario));
    args.push('--scenario', path);
  }
  if (frames !== undefined) {
    const path = base + '-inputs.json';
    writeFileSync(path, JSON.stringify({ frames }));
    args.push('--inputs', path);
  }
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (result.status !== 0) return result;
  const text = readFileSync(output, 'utf8');
  return { ...result, text, lines: text.trimEnd().split('\n').map(line => JSON.parse(line)) };
}
const event = (result, name) => result.lines.filter(line => line.type === 'event' && line.name === name);
const snapshot = (result, tick) => result.lines.find(line => line.type === 'snapshot' && line.tick === tick);
const clean = { random_motes: false, random_shades: false, motes: [], shades: [] };

test('tick 0, camera rotation, normalized movement and fixed simulation time', () => {
  const result = run({ ticks: 60, scenario: clean, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(result, 0).player.pos, [0, 0, 0]);
  assert.equal(snapshot(result, 60).sim_tick, 60);
  assert.equal(snapshot(result, 60).time_left_s, tuning.night1_duration_s - 1);
  assert.deepEqual(snapshot(result, 60).player.pos, [tuning.player_speed, 0, 0]);
  const diagonal = run({ ticks: 60, scenario: clean, frames: [{ tick: 0, move: [1, 1] }] });
  assert.ok(Math.abs(Math.hypot(...snapshot(diagonal, 60).player.pos) - tuning.player_speed) < 0.002);
});

test('pickup, partial frame updates, rising-edge deposit and win score', () => {
  const result = run({
    scenario: {
      ...clean,
      player: { carried: tuning.lantern_cost - 1 },
      motes: [[0, 0, 0]],
      lanterns: Array.from({ length: 5 }, (_, index) => ({ id: 'L' + (index + 1), lit: index !== 0, pos: [0, 0, 1] })),
    },
    frames: [{ tick: 1, interact: true }],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(event(result, 'mote_picked')[0].tick, 1);
  assert.deepEqual(event(result, 'deposit')[0].data, { lantern_id: 'L1', amount: tuning.lantern_cost, deposited: tuning.lantern_cost });
  assert.equal(event(result, 'lantern_lit').length, 1);
  assert.deepEqual(event(result, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(result.lines.at(-1), { type: 'end', ticks: 2, state: 'won', score:
    tuning.score.per_mote + tuning.score.per_lantern + (tuning.night1_duration_s - 1) * tuning.score.per_second_left + tuning.flames * tuning.score.per_flame_left });
});

test('jump rising edge fires once while held', () => {
  const result = run({ scenario: clean, frames: [{ tick: 0, jump: true }], ticks: 120 });
  assert.ok(snapshot(result, 17).player.pos[1] > 0);
  assert.equal(snapshot(result, 120).player.pos[1], 0);
});

test('pulse spends charge, reports stun and stays on cooldown', () => {
  const result = run({
    scenario: { ...clean, player: { carried: 10 }, shades: [{ id: 'S4', pos: [1, 0.8, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }],
  });
  assert.deepEqual(event(result, 'pulse').map(line => line.data), [{ stunned_ids: ['S4'] }]);
  assert.equal(snapshot(result, 1).player.carried, 10 - tuning.pulse_cost);
  assert.equal(snapshot(result, 80).shades[0].state, 'stunned');
  assert.equal(event(result, 'player_hit').length, 0);
});

test('contact drops motes and loses the last flame only once', () => {
  const result = run({
    scenario: { ...clean, player: { carried: 9, flames: 1 }, shades: [{ pos: [0, 0.8, 0] }, { pos: [0, 0.8, 0] }] },
  });
  assert.deepEqual(event(result, 'player_hit').map(line => line.data), [{ by: 'shade', flames: 0, dropped: 4 }]);
  assert.equal(event(result, 'game_over')[0].data.reason, 'no_flames');
  assert.equal(result.lines.at(-1).ticks, 1);
});

test('scenario initialization has no events; timeout still produces the final end record', () => {
  const result = run({ scenario: { ...clean, time_left_s: 0.05, lanterns: [{ id: 'L1', lit: true }] }, every: 10 });
  assert.equal(snapshot(result, 0).score, 0);
  assert.ok(snapshot(result, 0).lanterns[0].lit);
  assert.equal(event(result, 'lantern_lit').length, 0);
  assert.deepEqual(event(result, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.deepEqual(result.lines.at(-1), { type: 'end', ticks: 3, state: 'lost', score: 0 });
});

test('equal runs produce byte-identical seeded output including events and IDs', () => {
  const options = { ticks: 820, every: 10, seed: -12, frames: [{ tick: 0, move: [0, 1] }, { tick: 80, move: [0, 0] }] };
  const first = run(options);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(run(options).text, first.text);
  assert.ok(event(first, 'shade_spawned').length >= 2);
});

test('invalid inputs or scenario fail with stderr and code 2', () => {
  for (const options of [{ frames: [{ tick: 0 }, { tick: 0 }] }, { frames: [{ tick: 0, move: [2, 0] }] },
    { scenario: { motes: [[0, 1]] } }, { scenario: { shades: [{ id: 'S1' }] } }]) {
    const result = run(options);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.length > 0);
    assert.equal(result.stdout, '');
  }
});
