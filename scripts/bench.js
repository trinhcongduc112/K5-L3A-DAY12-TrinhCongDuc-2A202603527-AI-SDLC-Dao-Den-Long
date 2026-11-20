import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { arch, platform, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { distPath, startStaticServer } from './static-server.js';
import { readJsonBody, sendJson } from './leaderboard-store.js';

const started = performance.timeOrigin;

function browserBinary() {
  const candidates = [process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const file of candidates) {
    const check = spawnSync(file, ['--version'], { encoding: 'utf8', timeout: 2500 });
    if (check.status === 0) return { file, version: check.stdout.trim() };
  }
  throw new Error('Chrome or Chromium is required. Set CHROME_BIN to its executable.');
}

async function benchmark(seed, duration) {
  await access(join(distPath, 'benchmark.html')).catch(() => { throw new Error('Build the game first with npm run build'); });
  const browser = browserBinary();
  const profile = await mkdtemp(join(tmpdir(), 'dao-bench-'));
  const token = randomUUID();
  let complete;
  let fail;
  let server;
  let child;
  let timer;
  const result = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  let diagnostics = '';
  try {
    const bound = await startStaticServer({
      route(request, response) {
        if (request.url !== '/__bench_' + token || request.method !== 'POST') return false;
        readJsonBody(request).then(data => {
          sendJson(response, 200, { ok: true });
          if (data.error) fail(new Error(data.error));
          else complete(data);
        }, error => { sendJson(response, 400, { ok: false }); fail(error); });
        return true;
      },
    });
    server = bound.server;
    const query = new URLSearchParams({ seed, duration, started, token });
    const url = bound.url + '/benchmark.html?' + query;
    const args = [
      '--user-data-dir=' + profile, '--no-first-run', '--window-size=1280,720', '--force-device-scale-factor=1',
      '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--no-default-browser-check',
    ];
    if (process.platform === 'linux') args.push('--use-gl=angle', '--use-angle=gl');
    if (process.getuid?.() === 0) args.push('--no-sandbox');
    if (process.env.DAO_BENCH_HEADLESS === '1' ||
        (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)) args.push('--headless=new');
    args.push('--app=' + url);
    child = spawn(browser.file, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.setEncoding('utf8').on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-2200); });
    child.once('error', fail);
    child.once('exit', code => fail(new Error('Browser stopped before sending results (' + code + ')')));
    timer = setTimeout(() => fail(new Error('Timed out waiting for frames')), (duration + 35) * 1000);
    const metrics = await result;
    return { ...metrics, peak_mem_mb: null, vsync_off: true,
      renderer: browser.version + ' / ' + metrics.renderer, os: platform() + ' ' + release() + ' ' + arch() };
  } catch (error) {
    if (diagnostics) console.error(diagnostics.trim());
    throw error;
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(1000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    server?.closeAllConnections();
    server?.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

try {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, duration: { type: 'string' }, out: { type: 'string' },
  } });
  const seed = Number(values.seed);
  const duration = Number(values.duration);
  if (!Number.isSafeInteger(seed) || !Number.isFinite(duration) || duration <= 0 || !values.out) {
    throw new Error('Usage: --seed INT --duration SECONDS --out FILE');
  }
  const metrics = await benchmark(seed, duration);
  await writeFile(values.out, JSON.stringify(metrics, null, 2) + '\n');
  console.log(JSON.stringify(metrics));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
