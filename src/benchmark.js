import { REVISION } from 'three';
import contract from '../game.contract.json';
import { frameMetrics } from './frame-metrics.js';
import { Game } from './game.js';
import { createView } from './view.js';
import { DT, seededRandom } from './world.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed'));
const duration = Number(params.get('duration'));
const started = Number(params.get('started'));
const endpoint = './__bench_' + params.get('token');
const WARMUP = 3000;
const report = data => fetch(endpoint, { method: 'POST', body: JSON.stringify(data) });

function run() {
  const random = seededRandom(seed);
  const point = y => {
    const angle = random() * 2 * Math.PI;
    const radius = 40 * Math.sqrt(random());
    return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
  };
  const scenario = {
    random_motes: false, random_shades: false, random_drifters: false,
    motes: Array.from({ length: 100 }, () => point(0)),
    shades: Array.from({ length: 200 }, () => ({ pos: point(0.8), state: 'wander' })),
    lanterns: [1, 2, 3].map(index => ({ id: 'L' + index, lit: true, fuel: 100 })),
  };
  const game = new Game(contract, { seed, night: 1, scenario });
  const view = createView(document.getElementById('stage'), { decorations: false });
  view.setWorld(game);
  const gl = view.canvas.getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = 'Three.js r' + REVISION + ' / ' + gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);

  let first;
  let previous;
  let load;
  let accumulated = 0;
  const samples = [];
  function frame(now) {
    first ??= now;
    previous ??= now;
    const delta = now - previous;
    accumulated += delta / 1000;
    while (accumulated >= DT) {
      game.stepBenchmark();
      accumulated -= DT;
    }
    view.draw(game, 0, 0, 0, false, false, { orbitTime: (now - first) / 1000 });
    load ??= Math.round(performance.timeOrigin + performance.now() - started);
    const measuring = first + WARMUP;
    const end = measuring + duration * 1000;
    if (previous >= measuring && now <= end && delta > 0) samples.push(delta);
    previous = now;
    if (now < end) {
      requestAnimationFrame(frame);
      return;
    }
    try {
      report({ contract_version: contract.contract_version, ...frameMetrics(samples), load_ms: load, renderer });
    } catch (error) {
      report({ error: error.message });
    }
  }
  requestAnimationFrame(frame);
}

try {
  run();
} catch (error) {
  report({ error: error.message });
}
