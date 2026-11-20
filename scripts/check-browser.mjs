import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const tabs = await (await fetch('http://127.0.0.1:' + (process.env.GAME_CHECK_PORT ?? 9329) + '/json/list')).json();
const page = tabs.find(tab => tab.type === 'page');
assert.ok(page, 'Chrome needs an open tab');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  const response = pending.get(message.id);
  if (!response) return;
  pending.delete(message.id);
  if (message.error) response.reject(new Error(JSON.stringify(message.error)));
  else response.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression, awaitPromise = false, userGesture = false) {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise, userGesture, returnByValue: true });
  if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
  return reply.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await wait(100);
  }
  throw new Error('Timed out while waiting for ' + expression);
}
async function click(text) {
  const expression = `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)})`;
  await until('Boolean(' + expression + ')');
  await evaluate(expression + '.click()', false, true);
}
async function press(code, duration = 60) {
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' }))`);
  await wait(duration);
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' }))`);
}
async function screenshot(path) {
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  writeFileSync(path, Buffer.from(data, 'base64'));
}
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: process.env.GAME_CHECK_URL ?? 'http://127.0.0.1:5173/' });
  await until("Boolean(document.querySelector('#stage canvas'))");
  assert.deepEqual(await evaluate("[innerWidth, innerHeight, document.title]"), [1280, 720, 'Đảo Đèn Lồng']);
  await click('Bắt đầu');
  await click('Vào đảo');
  await until("document.querySelector('#overlay').hidden && document.querySelector('#lantern-count').textContent === 'Đèn 0/5'");
  assert.equal(await evaluate("document.querySelector('#capacity').textContent"), '0/10');
  await press('KeyW', 450);
  await press('Space', 90);
  if (process.env.GAME_CHECK_SCREENSHOT) await screenshot(process.env.GAME_CHECK_SCREENSHOT);
  const gpu = await evaluate(`(() => {
    const canvas = document.querySelector('#stage canvas');
    const gl = canvas.getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  })()`);
  const measure = () => evaluate(`new Promise(resolve => {
    let start, count = 0;
    function loop(now) {
      start ??= now;
      if (now - start >= 5500) return resolve({ count, fps: count * 1000 / (now - start), clock: document.querySelector('#clock').textContent });
      count++;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })`, true);
  const nights = [await measure()];
  assert.ok(nights[0].count > 0);
  {
    await press('Escape');
    await until("document.querySelector('#screen-title').textContent === 'Tạm dừng'");
    const previousClock = await evaluate("document.querySelector('#clock').textContent");
    await click('Cài đặt');
    await until("Boolean(document.querySelector('input[type=range]'))");
    await evaluate(`(() => {
      const slider = document.querySelector('input[type=range]');
      slider.value = '0.42';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const palette = document.querySelector('input[type=checkbox]');
      palette.checked = true;
      palette.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await click('Quay lại');
    assert.equal(await evaluate("document.querySelector('#clock').textContent"), previousClock);
    await click('Tiếp tục');
    await until("document.querySelector('#overlay').hidden");
    await press('Escape');
    await click('Chơi lại Đêm');
    await click('Vào đảo');
    await until("document.querySelector('#overlay').hidden");
    await send('Page.reload');
    await until("Boolean(document.querySelector('#stage canvas'))");
    await click('Cài đặt');
    assert.equal(await evaluate("document.querySelector('input[type=range]').value"), '0.42');
    assert.equal(await evaluate("document.querySelector('input[type=checkbox]').checked"), true);
  }
  await click('Quay lại');
  await click('Bắt đầu');
  await click('Vào đảo');
  // Exercise campaign transitions with an in-memory equivalent of a scenario.
  // This changes only a browser test session, never the shipped game.
  await evaluate(`(async () => {
    const url = performance.getEntriesByType('resource')
      .map(item => item.name).find(name => new URL(name).pathname === '/src/game.js');
    const { Game } = await import(url ?? '/src/game.js');
    const { HZ } = await import(new URL('./world.js', url ?? location.href));
    const step = Game.prototype.step;
    Game.prototype.step = function (input) {
      if (window.testFuelView) {
        window.testFuelView = false;
        Object.assign(this.lanterns[0], { pos: [-1.3, 0, 1.3], lit: true, fuelUnits: 25 * HZ, everLit: true });
        this.lanterns[1].pos = [1.8, 0, 1.4];
        this.player.carried = 5;
        this.player.successfulLights = 1;
        this.addShade({ pos: [0.75, 0.8, 5], state: 'stunned', state_ticks_left: 180 });
        this.startTime = this.simTick / HZ + 25;
      }
      if (window.testWinNight === this.night) {
        window.testWinNight = null;
        this.startTime = (this.simTick + 1) / HZ;
        this.lanterns.forEach((lantern, index) => {
          lantern.lit = index < this.dawnTarget;
          lantern.fuelUnits = lantern.lit ? this.maxFuelUnits : 0;
        });
      }
      return step.call(this, input);
    };
  })()`, true);
  await evaluate('window.testFuelView = true');
  await until("document.querySelector('#capacity').textContent === '5/12' && document.querySelector('#clock').classList.contains('urgent')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#clock')).color"), 'rgb(255, 255, 255)');
  assert.match(await evaluate("getComputedStyle(document.querySelector('#clock'), '::before').content"), /⚠/);
  assert.match(await evaluate("document.querySelector('#prompt').textContent"), /Châm dầu/);
  if (process.env.GAME_CHECK_FUEL_SCREENSHOT) await screenshot(process.env.GAME_CHECK_FUEL_SCREENSHOT);
  await press('KeyE');
  await until("document.querySelector('#capacity').textContent === '0/12'");
  await evaluate('window.testWinNight = 1');
  await click('Đêm kế tiếp');
  await until("document.querySelector('#screen-title').textContent === 'Đảo Cau'");
  await click('Vào đảo');
  await until("document.querySelector('#lantern-count').textContent === 'Đèn 0/6'");
  if (process.env.GAME_CHECK_SCREENSHOT) await screenshot(process.env.GAME_CHECK_SCREENSHOT.replace(/\.jpg$/, '-night2.jpg'));
  nights.push(await measure());
  await evaluate('window.testWinNight = 2');
  await click('Đêm kế tiếp');
  await until("document.querySelector('#screen-title').textContent === 'Đảo Chuông'");
  await click('Vào đảo');
  await until("document.querySelector('#lantern-count').textContent === 'Đèn 0/7'");
  if (process.env.GAME_CHECK_SCREENSHOT) await screenshot(process.env.GAME_CHECK_SCREENSHOT.replace(/\.jpg$/, '-night3.jpg'));
  nights.push(await measure());
  await evaluate('window.testWinNight = 3');
  await until("document.querySelector('#screen-title').textContent === 'Bình Minh'");
  assert.match(await evaluate("document.querySelector('#screen-copy').textContent"), /Tổng điểm: [1-9]/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ gpu, nights, settingsPersisted: true, refuelHud: true, errors: errors.length }));
} finally {
  socket.close();
}
