import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { blankInput, buttons, drifterStates, Game, shadeStates } from './game.js';
import { worlds } from './world.js';

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const flags = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const number = value => typeof value === 'number' && Number.isFinite(value);
const vector = (value, size) => Array.isArray(value) && value.length === size && value.every(number);
const id = value => typeof value === 'string' && value.length > 0;

class DataError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new DataError(message);
}

function validateFields(record, fields, label) {
  requireValue(object(record), label + ' must be an object');
  for (const [key, validate] of Object.entries(fields)) {
    requireValue(!(key in record) || validate(record[key]), label + '.' + key + ' has an invalid value');
  }
}

function readData(path, validate) {
  if (!path) return undefined;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    validate(data);
    return data;
  } catch (error) {
    throw new DataError(path + ': ' + error.message);
  }
}

function validateInputs(data) {
  requireValue(object(data) && Array.isArray(data.frames), 'inputs.frames must be an array');
  let previous = -1;
  for (const [index, frame] of data.frames.entries()) {
    const label = 'frames[' + index + ']';
    validateFields(frame, {
      move: value => vector(value, 2) && value.every(component => Math.abs(component) <= 1),
      cam_yaw_deg: number,
      ...Object.fromEntries(buttons.map(button => [button, value => typeof value === 'boolean'])),
    }, label);
    requireValue(integer(frame.tick) && frame.tick > previous, label + '.tick must be a strictly increasing nonnegative integer');
    previous = frame.tick;
  }
}

function records(list, name, validate) {
  if (list === undefined) return;
  requireValue(Array.isArray(list), name + ' must be an array');
  const ids = new Set();
  list.forEach((item, index) => {
    const label = name + '[' + index + ']';
    validate(item, label);
    if (item.id === undefined) return;
    requireValue(!ids.has(item.id), label + ' repeats id ' + item.id);
    ids.add(item.id);
  });
}

function validateScenario(data, night) {
  const isBoolean = value => typeof value === 'boolean';
  const pos = value => vector(value, 3);
  const count = worlds[night].lanterns.length;
  const lanternId = value => id(value) && worlds[night].lanterns.some((_, i) => value === 'L' + (i + 1));
  validateFields(data, {
    time_left_s: value => number(value) && value >= 0,
    random_motes: isBoolean,
    random_shades: isBoolean,
    random_drifters: isBoolean,
    wind_enabled: isBoolean,
    motes: value => Array.isArray(value) && value.every(pos),
  }, 'scenario');
  if ('player' in data) validateFields(data.player, {
    pos, carried: value => integer(value), flames: value => integer(value),
    invuln_ticks: integer, dash_cd_ticks: integer, pulse_cd_ticks: integer, charm_ticks: integer,
    successful_lights: integer,
  }, 'player');
  records(data.shades, 'shades', (item, label) => {
    validateFields(item, {
      pos, id, state: value => shadeStates.includes(value), state_ticks_left: integer, target_lantern_id: lanternId,
    }, label);
    requireValue(pos(item.pos), label + '.pos is required');
  });
  records(data.drifters, 'drifters', (item, label) => {
    validateFields(item, { pos, id, state: value => drifterStates.includes(value), stolen: integer, state_ticks_left: integer }, label);
    requireValue(pos(item.pos), label + '.pos is required');
  });
  records(data.charms, 'charms', (item, label) => {
    validateFields(item, { pos, id, available: isBoolean, respawn_ticks: integer, respawn_ticks_left: integer }, label);
  });
  records(data.lanterns, 'lanterns', (item, label) => {
    validateFields(item, {
      pos, lit: isBoolean, deposited: integer, ever_lit: isBoolean,
      fuel: value => number(value) && value >= 0 && value <= contract.tuning.fuel_max,
    }, label);
    requireValue(lanternId(item.id), label + '.id must be L1 through L' + count);
  });
}

function parseArguments(values) {
  const args = {};
  for (let index = 0; index < values.length; index += 2) {
    const token = values[index];
    const key = token.slice(2);
    const value = values[index + 1];
    if (!token.startsWith('--') || !flags.has(key) || key in args || !value || value.startsWith('--')) {
      throw new Error('Invalid argument: ' + token);
    }
    args[key] = value;
  }
  const seed = Number(args.seed);
  const night = Number(args.night);
  const count = Number(args.ticks);
  const interval = Number(args['snapshot-every'] ?? 10);
  if (!Number.isSafeInteger(seed) || !integer(night, 1) || !worlds[night] ||
      !integer(count) || !integer(interval, 1) || !args.out) {
    throw new Error('Usage: node src/headless.js --seed INT --night 1|2|3 [--scenario FILE] [--inputs FILE] --ticks N --out FILE [--snapshot-every N]');
  }
  return { args, seed, night, count, interval };
}

function run() {
  const { args, seed, night, count, interval } = parseArguments(process.argv.slice(2));
  const scenario = readData(args.scenario, data => validateScenario(data, night));
  const { frames } = readData(args.inputs, validateInputs) ?? { frames: [] };
  const game = new Game(contract, { seed, night, scenario });
  let input = blankInput;
  let frameIndex = 0;
  const output = openSync(args.out, 'w');
  let buffer = '';
  function write(line) {
    buffer += JSON.stringify(line) + '\n';
    if (buffer.length < 65536) return;
    writeFileSync(output, buffer);
    buffer = '';
  }
  try {
    write(game.snapshot());
    for (let index = 0; index < count && ['playing', 'paused'].includes(game.state); index++) {
      if (frames[frameIndex]?.tick === index) input = { ...input, ...frames[frameIndex++] };
      for (const event of game.step(input)) write(event);
      if (game.tick % interval === 0) write(game.snapshot());
    }
    write({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
    if (buffer) writeFileSync(output, buffer);
  } finally {
    closeSync(output);
  }
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof DataError ? 2 : 1;
}
