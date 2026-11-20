import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { blankInput, Game } from '../src/game.js';
import { HZ, seededRandom } from '../src/world.js';

const mb = bytes => bytes / (1024 * 1024);
function rss() {
  globalThis.gc?.();
  return Math.round(mb(process.memoryUsage.rss()) * 1000) / 1000;
}

function playNight(game, seed) {
  const random = seededRandom(seed);
  const maxTicks = Math.round(game.startTime * HZ);
  const input = { ...blankInput };
  for (let tick = 0; tick < maxTicks && game.state === 'playing'; tick++) {
    if (tick % 30 === 0) {
      const heading = random() * 2 * Math.PI;
      input.move = [Math.cos(heading), Math.sin(heading)];
    }
    input.jump = random() < 0.05;
    input.dash = random() < 0.03;
    input.pulse = random() < 0.02;
    input.interact = random() < 0.1;
    game.step(input);
  }
  if (game.state !== 'won' && game.state !== 'lost') throw new Error('Night did not reach an end state');
  return game.state;
}

try {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, nights: { type: 'string' }, out: { type: 'string' },
  } });
  const seed = Number(values.seed);
  const nights = Number(values.nights);
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(nights) || nights < 1 || !values.out ||
      !Number.isSafeInteger(seed + nights - 1)) throw new Error('Usage: --seed INT --nights N --out FILE');
  const contract = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const started = performance.now();
  const results = [];
  let crashes = 0;
  let initialMemory;
  let game;
  for (let index = 0; index < nights; index++) {
    try {
      const nightSeed = seed + index;
      game = new Game(contract, { seed: nightSeed, night: index % 3 + 1 });
      initialMemory ??= rss();
      results.push(playNight(game, nightSeed));
    } catch (error) {
      crashes++;
      results.push('crash');
      console.error('Soak night', index + 1, error.message);
    } finally {
      game = null;
    }
  }
  const finalMemory = rss();
  const result = {
    nights, crashes, results, mem_start_mb: initialMemory ?? null, mem_end_mb: finalMemory,
    duration_s: Math.round((performance.now() - started)) / 1000,
  };
  await writeFile(values.out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (crashes) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
