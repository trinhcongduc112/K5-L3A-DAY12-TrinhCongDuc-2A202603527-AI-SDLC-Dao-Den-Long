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
const clean = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [] };

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
    tuning.lantern_cost * tuning.score.per_mote + tuning.score.per_lantern + (tuning.night1_duration_s - 1) * tuning.score.per_second_left + tuning.flames * tuning.score.per_flame_left });
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

test('v1.1: three standardized maps have 5, 6 and 7 lanterns and correct durations and base spawn', () => {
  for (const [night, count, last] of [[1, 5, [-23.8, 0, 7.7]], [2, 6, [53, 0, -10]], [3, 7, [-20, 0, -35]]]) {
    const result = run({ night, ticks: 1 });
    assert.equal(result.status, 0, result.stderr);
    const initial = snapshot(result, 0);
    assert.equal(initial.night, night);
    assert.equal(initial.time_left_s, tuning['night' + night + '_duration_s']);
    assert.equal(initial.lanterns.length, count);
    assert.deepEqual(initial.lanterns.at(-1).pos, last);
    assert.deepEqual(initial.player.pos, [0, 0, 0]);
    assert.equal(initial.motes_active, 20);
    assert.equal(new Set(initial.motes.map(mote => JSON.stringify(mote.pos))).size, 20);
    assert.deepEqual(event(result, 'night_start').map(line => line.data), [{ night }]);
  }
});

test('v1.1: schedules entities on simulation ticks, including distinct shade IDs', () => {
  const result = run({ night: 2, ticks: 1201, every: 1, scenario: { player: { invuln_ticks: 3600 } } });
  assert.equal(snapshot(result, 239).motes_active, 20);
  assert.equal(snapshot(result, 240).motes_active, 21);
  assert.deepEqual(event(result, 'shade_spawned').slice(0, 3).map(line => [line.tick, line.data.id]),
    [[300, 'S1'], [300, 'S2'], [720, 'S3']]);
  assert.equal(snapshot(result, 300).shades[0].state, 'spawning');
  assert.notEqual(snapshot(result, 301).shades[0].state, 'spawning');
  assert.equal(snapshot(result, 1199).drifters.length, 0);
  assert.equal(snapshot(result, 1200).drifters[0].id, 'D1');
});

test('v1.1: dash holds airborne height for twelve ticks and starts a 90-tick cooldown', () => {
  const result = run({ scenario: { ...clean, player: { pos: [0, 1, 0] } }, ticks: 92,
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 10, dash: true },
      { tick: 11, dash: false }, { tick: 90, dash: true }] });
  assert.deepEqual(event(result, 'dash').map(line => line.tick), [1, 91]);
  assert.deepEqual(snapshot(result, 12).player.pos, [0, 1, 2.8]);
  assert.equal(snapshot(result, 1).player.dash_cd_s, 1.5);
  assert.ok(snapshot(result, 13).player.pos[1] < 1);
});

test('v1.1: pause freezes sim tick, time, movement and cooldowns while tick advances', () => {
  const result = run({ scenario: clean, ticks: 100, frames: [{ tick: 0, dash: true }, { tick: 5, pause: true },
    { tick: 8, pause: false }, { tick: 90, pause: true }] });
  const before = snapshot(result, 5);
  const stopped = snapshot(result, 90);
  assert.equal(stopped.state, 'paused');
  assert.equal(stopped.sim_tick, 5);
  assert.equal(stopped.time_left_s, before.time_left_s);
  assert.deepEqual(stopped.player, before.player);
  assert.equal(snapshot(result, 91).sim_tick, 6);
  assert.deepEqual(event(result, 'paused').map(line => line.tick), [6]);
  assert.deepEqual(event(result, 'resumed').map(line => line.tick), [91]);
});

test('v1.1: fall ignores immunity, drops no pickups, waits sixty ticks and respawns at origin', () => {
  const result = run({ scenario: { ...clean, player: { pos: [41, -11, 0], carried: 9, invuln_ticks: 2000 } }, ticks: 70 });
  assert.deepEqual(event(result, 'player_hit').map(line => line.data), [{ by: 'fall', flames: 2, dropped: 0, lost: 9 }]);
  assert.deepEqual(snapshot(result, 60).player.pos, [41, -11, 0]);
  assert.deepEqual(snapshot(result, 61).player.pos, [0, 0, 0]);
  assert.ok(snapshot(result, 61).player.invuln);
  const last = run({ scenario: { ...clean, player: { pos: [41, -11, 0], flames: 1 } } });
  assert.equal(last.lines.at(-1).state, 'lost');
  assert.equal(last.lines.at(-1).ticks, 1);
});

test('v1.1: chooses nearest unlit lantern with ID tie-break and scores each deposited mote', () => {
  const result = run({ scenario: { ...clean, player: { carried: 4 }, motes: [[0, 0, 0]],
    lanterns: [{ id: 'L1', pos: [-2, 0, 0] }, { id: 'L2', pos: [2, 0, 0] }, { id: 'L3', pos: [0, 0, 0], lit: true }] },
  frames: [{ tick: 1, interact: true }], ticks: 10 });
  assert.equal(snapshot(result, 1).score, 0);
  assert.deepEqual(event(result, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.equal(snapshot(result, 10).score, 50);
  assert.equal(event(result, 'lantern_lit').length, 0);
});

test('v1.1: ejection blocks damage, moving shades stay at the edge of a lit zone', () => {
  const result = run({ scenario: { ...clean, player: { carried: 10 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ id: 'S1', pos: [0, 0.8, 0] }, { id: 'S2', pos: [6.03, 0.8, 0] }] },
  frames: [{ tick: 0, interact: true }], ticks: 60 });
  assert.equal(event(result, 'player_hit').length, 0);
  assert.ok(snapshot(result, 30).shades.every(shade => Math.hypot(shade.pos[0], shade.pos[2]) >= 6));
  assert.ok(snapshot(result, 60).shades.every(shade => Math.hypot(shade.pos[0], shade.pos[2]) >= 6));
});

test('v1.1: pulse locks 3D targets, repels over 15 steps, and uses the specified shadow state names', () => {
  const result = run({ scenario: { ...clean, player: { carried: 3, invuln_ticks: 1000 },
    shades: [{ id: 'S1', pos: [0, 0.8, 0] }, { id: 'S2', pos: [0, 6, 0] }] },
  frames: [{ tick: 0, pulse: true }], ticks: 121 });
  assert.deepEqual(event(result, 'pulse').map(line => line.data), [{ stunned_ids: ['S1'] }]);
  assert.equal(snapshot(result, 1).player.pulse_cd_s, 3);
  assert.deepEqual(snapshot(result, 15).shades[0].pos, [4, 0.8, 0]);
  assert.equal(snapshot(result, 120).shades[0].state, 'stunned');
  assert.equal(snapshot(result, 121).shades[0].state, 'chase');
});

test('v1.1: Gió Lạc steals before shade hits and returns loot after being pulsed during flee', () => {
  const result = run({ night: 2, scenario: { ...clean, player: { carried: 10 }, drifters: [{ id: 'D5', pos: [0.5, 1.2, 0] }],
    shades: [{ id: 'S1', pos: [0, 0.8, 0] }] },
  frames: [{ tick: 1, pulse: true }], ticks: 3 });
  assert.deepEqual(event(result, 'drifter_steal')[0].data, { drifter_id: 'D5', amount: 3, carried: 7 });
  assert.deepEqual(event(result, 'player_hit')[0].data, { by: 'shade', flames: 2, dropped: 3 });
  assert.equal(snapshot(result, 1).shades[0].state, 'recoil');
  assert.equal(event(result, 'drifter_drop')[0].data.amount, 3);
  assert.equal(snapshot(result, 2).motes.filter(item => item.kind === 'dropped').length, 6);
  assert.equal(snapshot(result, 2).player.carried, 1);
  assert.equal(snapshot(result, 3).player.carried, 4);
});

test('v1.1: pulse scares a chasing drifter and a fleeing drifter disappears after the duration', () => {
  const result = run({ night: 2, scenario: { ...clean, player: { carried: 8 }, drifters: [
    { id: 'D1', pos: [0, 1.2, 2], state: 'chase' }, { id: 'D2', pos: [0, 1.2, 20], state: 'flee', stolen: 3, state_ticks_left: 3 }] },
    frames: [{ tick: 0, pulse: true }], ticks: 241 });
  assert.equal(snapshot(result, 1).drifters[0].state, 'flee');
  assert.equal(event(result, 'drifter_steal').length, 0);
  assert.equal(snapshot(result, 3).drifters.length, 1);
  assert.equal(snapshot(result, 241).drifters.length, 0);
});

test('v1.1: wind charm runs at 7.2 m/s, removes dash cooldown, expires and respawns', () => {
  const scenario = { ...clean, charms: [{ id: 'C1', pos: [0, 0, 0] }] };
  const boosted = run({ night: 2, scenario, frames: [{ tick: 1, move: [0, 1] }], ticks: 61 });
  assert.equal(event(boosted, 'charm_picked')[0].data.charm_ticks, 600);
  assert.deepEqual(snapshot(boosted, 61).player.pos, [0, 0, 7.2]);
  const dashes = run({ night: 2, scenario, frames: [{ tick: 1, dash: true }, { tick: 2, dash: false },
    { tick: 4, dash: true }, { tick: 5, dash: false }, { tick: 13, dash: true }],
    ticks: 2701, every: 1 });
  assert.deepEqual(event(dashes, 'dash').map(line => line.tick), [2, 14]);
  assert.equal(snapshot(dashes, 600).player.charm_s, 1 / 60);
  assert.equal(snapshot(dashes, 601).player.charm_s, 0);
  assert.equal(snapshot(dashes, 2701).charms[0].available, true);
});

test('v1.1: bridge connects the islands and jump pads reach their target surfaces', () => {
  const bridge = run({ night: 2, scenario: { ...clean, player: { pos: [25, 0, 0] } },
    frames: [{ tick: 0, move: [1, 0] }], ticks: 220, every: 10 });
  assert.deepEqual(snapshot(bridge, 220).player.pos, [47, 0, 0]);
  const pad = run({ night: 2, scenario: { ...clean, player: { pos: [20, 0, 18] } },
    frames: [{ tick: 1, move: [-1, 0] }, { tick: 82, move: [0, 0] }], ticks: 90 });
  assert.ok(snapshot(pad, 40).player.pos[0] > 30);
  assert.ok(snapshot(pad, 90).player.pos[0] > 50);
  assert.ok(snapshot(pad, 90).player.grounded);
  const upper = run({ night: 3, scenario: { ...clean, player: { pos: [0, 3, 13] } }, ticks: 65 });
  assert.equal(snapshot(upper, 65).player.pos[1], 6);
  assert.ok(snapshot(upper, 65).player.grounded);
});

test('v1.1: west/east ramps reach the ledge, the ledge edge drops to ground, tower blocks', () => {
  const angle = Math.PI / 6;
  const ramp = run({ night: 3, scenario: {
    ...clean, player: { pos: [30.1 * Math.cos(angle), 0, 30.1 * Math.sin(angle)] },
  }, frames: [{ tick: 0, move: [-Math.cos(angle), -Math.sin(angle)] }], ticks: 100 });
  assert.equal(snapshot(ramp, 100).player.pos[1], 3);
  const ledge = run({ night: 3, scenario: { ...clean, player: { pos: [4, 3, 11.5] } },
    frames: [{ tick: 0, move: [0, -1] }, { tick: 4, move: [0, 0] }], ticks: 60 });
  assert.equal(snapshot(ledge, 60).player.pos[1], 0);
  const tower = run({ night: 3, scenario: { ...clean, player: { pos: [0, 6, 5] } },
    frames: [{ tick: 0, move: [0, -1] }], ticks: 60 });
  assert.ok(snapshot(tower, 60).player.pos[2] >= 2);
});

test('v1.1: wind starts at 1800, moves idle player 10 m and stops at 2100', () => {
  const result = run({ night: 3, scenario: { ...clean, wind_enabled: true }, ticks: 2100, every: 1 });
  const start = snapshot(result, 1800);
  const end = snapshot(result, 2100);
  assert.equal(snapshot(result, 1799).wind.active, false);
  assert.equal(start.wind.active, true);
  assert.equal(end.wind.active, false);
  assert.equal(end.wind.dir_deg, start.wind.dir_deg);
  assert.ok(Math.abs(Math.hypot(end.player.pos[0], end.player.pos[2]) - 10) < 0.002);
});

test('v1.1: flame loss takes priority over lighting all lanterns, lighting takes priority over dawn', () => {
  const lanterns = Array.from({ length: 5 }, (_, index) => ({ id: 'L' + (index + 1), lit: index !== 0, pos: [0, 0, 0] }));
  const frames = [{ tick: 0, interact: true }];
  const atDawn = run({ scenario: { ...clean, player: { carried: 10 }, time_left_s: 1 / 60, lanterns }, frames });
  assert.equal(event(atDawn, 'game_over')[0].data.reason, 'all_lit');
  const noFlames = run({ scenario: { ...clean, player: { carried: 10, flames: 0 }, time_left_s: 1 / 60, lanterns }, frames });
  assert.equal(event(noFlames, 'game_over')[0].data.reason, 'no_flames');
});

test('v1.1: charm, drifter and shade scenario records reject malformed values', () => {
  for (const scenario of [{ player: { invuln_ticks: -1 } }, { drifters: [{ state: 'chase' }] },
    { charms: [{ available: 'true' }] }, { shades: [{ pos: [0, 0, 0], state: 'asleep' }] }]) {
    assert.equal(run({ scenario }).status, 2);
  }
});
