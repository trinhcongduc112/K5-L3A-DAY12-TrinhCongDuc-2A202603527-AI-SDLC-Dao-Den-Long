import './style.css';
import contract from '../game.contract.json';
import { createAudio } from './audio.js';
import { blankInput, Game } from './game.js';
import { DT, horizontalDistance } from './world.js';
import { createView } from './view.js';

const $ = id => document.getElementById(id);
const stage = $('stage');
const overlay = $('overlay');
const hud = $('hud');
const clock = $('clock');
const scenes = {
  1: 'Ông Đăng: “Mang từng đốm sáng về đèn. Khi cả đảo rực lên, sương sẽ tan.”',
  2: 'Ông Đăng: “Bên kia cầu tre còn đèn tắt. Nếu gặp Gió Lạc, hãy giữ chặt những đốm sáng.”',
  3: 'Ông Đăng: “Theo con dốc lên tầng trên. Đèn ở chân tháp chuông sẽ gọi bình minh về.”',
};
const saved = readSettings();
const audio = createAudio(saved.volume);
const held = new Set();
const edges = new Set();
const numberFormat = new Intl.NumberFormat('vi-VN');
const screenButtons = $('screen-buttons');
const lamps = $('flames');
const inventory = $('motes');
let view;
let game;
let screen = 'menu';
let settingsFrom;
let total = 0;
let yaw = 0;
let pitch = 0.30;
let mouseAnchor = null;

function readSettings() {
  try {
    const data = JSON.parse(localStorage.getItem('dao-den-long-settings'));
    if (data && typeof data.volume === 'number' && typeof data.sensitivity === 'number') {
      return {
        volume: Math.min(1, Math.max(0, data.volume)),
        sensitivity: Math.min(2, Math.max(0.35, data.sensitivity)),
      };
    }
  } catch {}
  return { volume: 0.55, sensitivity: 1 };
}

function saveSettings() {
  try {
    localStorage.setItem('dao-den-long-settings', JSON.stringify(saved));
  } catch {}
}

function command(title, action, secondary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = title;
  button.classList.toggle('secondary', secondary);
  button.addEventListener('click', () => { audio.activate(); action(); });
  return button;
}

function clearInput() {
  held.clear();
  edges.clear();
  mouseAnchor = null;
}

function reset(night) {
  game = new Game(contract, { seed: 1200 + night - 1, night });
  yaw = 0;
  pitch = 0.30;
  clearInput();
  view.setWorld(game);
}

function beginNight(night) {
  reset(night);
  show('intro');
}

function mainMenu() {
  total = 0;
  reset(1);
  show('menu');
}

function beginPlay() {
  show('play');
  view.canvas.focus();
}

function settings() {
  settingsFrom = screen;
  show('settings');
  const panel = document.createElement('div');
  panel.className = 'settings';
  for (const [key, title, min, max] of [['volume', 'Âm lượng', 0, 1], ['sensitivity', 'Độ nhạy chuột', 0.35, 2]]) {
    const label = document.createElement('label');
    label.textContent = title;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = '0.01';
    input.value = saved[key];
    input.addEventListener('input', () => {
      saved[key] = Number(input.value);
      audio.volume(saved.volume);
      saveSettings();
    });
    label.append(input);
    panel.append(label);
  }
  screenButtons.prepend(panel);
}

function show(mode) {
  screen = mode;
  clearInput();
  overlay.hidden = mode === 'play';
  hud.hidden = !['play', 'pause', 'result'].includes(mode);
  $('controls').hidden = !['menu', 'intro'].includes(mode);
  if (mode === 'play') return;
  const kicker = $('screen-kicker');
  kicker.textContent = mode === 'dawn' ? 'BA ĐÊM ĐÃ QUA' : 'ĐÊM ' + game.night + '  ✧  ' + game.world.title.toUpperCase();
  const won = game.state === 'won';
  const pages = {
    menu: ['Đảo Đèn Lồng', 'Cùng Mây mang ánh sáng trở lại ba hòn đảo.', [
      command('Bắt đầu', () => beginNight(1)), command('Cài đặt', settings, true),
    ]],
    intro: [game.world.title, scenes[game.night], [
      command('Vào đảo', beginPlay), command('Về menu', mainMenu, true),
    ]],
    pause: ['Tạm dừng', '', [
      command('Tiếp tục', () => edges.add('Escape')), command('Chơi lại Đêm', () => beginNight(game.night), true),
      command('Cài đặt', settings, true), command('Về menu', mainMenu, true),
    ]],
    settings: ['Cài đặt', '', [command('Quay lại', () => show(settingsFrom))]],
    result: [
      won ? 'Đảo đã sáng!' : 'Sương đã phủ kín đảo',
      'Điểm đêm này: ' + numberFormat.format(game.score) + ' · Tổng điểm: ' + numberFormat.format(total),
      [
        won ? command('Đêm kế tiếp', () => beginNight(game.night + 1)) : command('Chơi lại Đêm', () => beginNight(game.night)),
        command('Về menu', mainMenu, true),
      ],
    ],
    dawn: ['Bình Minh', 'Ba hòn đảo đã sáng trở lại. Tổng điểm: ' + numberFormat.format(total), [
      command('Về menu', mainMenu),
    ]],
  };
  const [title, copy, actions] = pages[mode];
  $('screen-title').textContent = title;
  $('screen-copy').textContent = copy;
  $('screen-copy').hidden = !copy;
  screenButtons.replaceChildren(...actions);
  screenButtons.querySelector('button')?.focus({ preventScroll: true });
}

function isDown(...codes) {
  return Number(codes.some(code => held.has(code)));
}

function sampleInput() {
  const input = {
    ...blankInput,
    move: [isDown('KeyA', 'ArrowLeft') - isDown('KeyD', 'ArrowRight'), isDown('KeyW', 'ArrowUp') - isDown('KeyS', 'ArrowDown')],
    cam_yaw_deg: yaw,
    jump: edges.has('Space'),
    interact: edges.has('KeyE'),
    pulse: edges.has('KeyQ'),
    dash: edges.has('ShiftLeft') || edges.has('ShiftRight'),
    pause: edges.has('Escape') || edges.has('KeyP'),
  };
  edges.clear();
  return input;
}

const keys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyP']);
window.addEventListener('keydown', event => {
  const pauseKey = event.code === 'Escape' || event.code === 'KeyP';
  if (screen !== 'play' && !(screen === 'pause' && pauseKey)) return;
  if (!keys.has(event.code)) return;
  event.preventDefault();
  if (!event.repeat && !held.has(event.code)) edges.add(event.code);
  held.add(event.code);
});
window.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', clearInput);
stage.addEventListener('pointerdown', event => {
  if (screen !== 'play') return;
  mouseAnchor = [event.clientX, event.clientY];
  event.target.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!mouseAnchor) return;
  yaw -= (event.clientX - mouseAnchor[0]) * 0.26 * saved.sensitivity;
  pitch = Math.max(0.14, Math.min(1.05, pitch + (event.clientY - mouseAnchor[1]) * 0.006 * saved.sensitivity));
  mouseAnchor = [event.clientX, event.clientY];
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(name, () => { mouseAnchor = null; });
}

for (let index = 0; index < contract.tuning.flames; index++) {
  const item = document.createElement('span');
  item.textContent = '♦';
  lamps.append(item);
}
for (let index = 0; index < contract.tuning.carry_capacity; index++) inventory.append(document.createElement('i'));
const dashStatus = $('dash-status');
const pulseStatus = $('pulse-status');
const windNotice = $('wind-notice');

function updateHud() {
  const { player } = game;
  for (const [index, item] of Array.from(lamps.children).entries()) item.classList.toggle('spent', index >= player.flames);
  for (const [index, item] of Array.from(inventory.children).entries()) item.classList.toggle('on', index < player.carried);
  const flameCount = player.flames + ' Ngọn Lửa';
  if (lamps.getAttribute('aria-label') !== flameCount) lamps.setAttribute('aria-label', flameCount);
  const seconds = Math.ceil(game.timeLeft);
  const format = value => String(value).padStart(2, '0');
  clock.textContent = format(Math.floor(seconds / 60)) + ':' + format(seconds % 60);
  clock.classList.toggle('urgent', seconds <= 30 && game.state === 'playing');
  $('lantern-count').textContent = 'Đèn ' + game.lanterns.filter(item => item.lit).length + '/' + game.lanterns.length;
  $('points').textContent = numberFormat.format(total + (game.state === 'won' ? 0 : game.score)) + ' điểm';
  const cooldown = end => end > game.simTick ? ((end - game.simTick) / 60).toFixed(1) + 's' : '✓';
  dashStatus.textContent = cooldown(player.dashCooldown);
  pulseStatus.textContent = cooldown(player.pulseCooldown);

  const lantern = game.nearbyLantern();
  $('prompt').hidden = !lantern || screen !== 'play';
  if (lantern) $('prompt').textContent = 'E — Nạp ánh sáng (' + lantern.deposited + '/' + game.tuning.lantern_cost + ')';
  windNotice.hidden = !game.windEnabled || !(game.wind.active || game.simTick % 1800 >= 1680) || screen !== 'play';
  if (!windNotice.hidden) windNotice.textContent = game.wind.active ? 'Gió mạnh' : 'Gió mạnh sắp đến';
  showWaypoint(player);
}

function showWaypoint(player) {
  const waypoint = $('waypoint');
  const closest = game.lanterns.filter(item => !item.lit).sort((a, b) =>
    horizontalDistance(player.pos, a.pos) - horizontalDistance(player.pos, b.pos))[0];
  waypoint.hidden = true;
  if (!closest || screen !== 'play') return;
  const { x, y, behind } = view.project([closest.pos[0], closest.pos[1] + 3, closest.pos[2]]);
  if (!behind && Math.abs(x) <= 0.94 && Math.abs(y) <= 0.9) return;
  waypoint.hidden = false;
  const side = behind ? -x : x;
  const top = behind ? -y : y;
  const leftPct = Math.max(7, Math.min(93, 50 + side * 48));
  const topPct = Math.max(17, Math.min(82, 50 - top * 44));
  waypoint.style.left = leftPct + '%';
  waypoint.style.top = topPct + '%';
  waypoint.style.transform = 'translate(-50%, -50%) rotate(' + Math.atan2(side, top) + 'rad)';
}

function advance() {
  const previousSecond = Math.ceil(game.timeLeft);
  const wasGrounded = game.player.grounded;
  const previousTick = game.simTick;
  for (const event of game.step(sampleInput())) {
    audio.play(event.name);
    if (event.name === 'pulse') view.flash(game);
    if (event.name === 'paused') show('pause');
    if (event.name === 'resumed') beginPlay();
    if (event.name === 'game_over') {
      const won = game.state === 'won';
      audio.play(game.state);
      if (won) total += game.score;
      show(won && game.night === 3 ? 'dawn' : 'result');
    }
  }
  if (game.simTick === previousTick) return;
  if (wasGrounded && !game.player.grounded && game.player.vel[1] > 0) audio.play('jump');
  const second = Math.ceil(game.timeLeft);
  if (second < previousSecond && second <= 10 && second > 0) audio.play('countdown');
  if (game.simTick % 132 === 1) audio.note(Math.floor(game.simTick / 132));
  if (game.windEnabled && game.simTick % 1800 === 1680) audio.play('wind');
}

let previous = performance.now();
let accumulator = 0;
function ticking() {
  return screen === 'play' || screen === 'pause' || (screen === 'settings' && settingsFrom === 'pause');
}
function frame(now) {
  const elapsed = Math.max(0, Math.min((now - previous) / 1000, 0.15));
  previous = now;
  if (ticking()) {
    accumulator += elapsed;
    while (accumulator >= DT && ticking()) {
      accumulator -= DT;
      advance();
    }
  } else {
    accumulator = 0;
  }
  view.draw(game, yaw, pitch, now / 1000, screen === 'menu' || screen === 'intro');
  if (!hud.hidden) updateHud();
  requestAnimationFrame(frame);
}

try {
  view = createView(stage);
} catch {
  $('screen-copy').textContent = 'Trình duyệt cần WebGL 2 để mở game. Bạn vẫn có thể chạy chế độ headless theo README.';
  $('start').disabled = true;
}
if (view) {
  mainMenu();
  requestAnimationFrame(frame);
}
