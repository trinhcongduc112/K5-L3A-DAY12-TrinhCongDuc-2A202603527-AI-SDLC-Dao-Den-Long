import './style.css';
import contract from '../game.contract.json';
import { createAudio } from './audio.js';
import { blankInput, Game } from './game.js';
import { leaderboardName } from './leaderboard.js';
import { listScores, persistScore } from './leaderboard-client.js';
import { bindingConflict, bindingText, canBind, controls, defaultBindings, readSettings, saveSettings } from './settings.js';
import { DT, HZ } from './world.js';
import { createView } from './view.js';

const $ = id => document.getElementById(id);
const stage = $('stage');
const overlay = $('overlay');
const hud = $('hud');
const clock = $('clock');
const scenes = {
  1: 'Ông Đăng: “Giữ đủ đèn sáng đến bình minh. Nhớ châm thêm dầu khi đèn yếu.”',
  2: 'Ông Đăng: “Bên kia cầu tre còn đèn tắt. Nếu gặp Gió Lạc, hãy giữ chặt những đốm sáng.”',
  3: 'Ông Đăng: “Theo con dốc lên tầng trên. Đèn ở chân tháp chuông sẽ gọi bình minh về.”',
};
const campaignSeed = 1200;
const saved = readSettings(localStorage, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const audio = createAudio(saved.volume);
const held = new Set();
const edges = new Set();
const numberFormat = new Intl.NumberFormat('vi-VN');
const screenButtons = $('screen-buttons');
const lamps = $('flames');
const inventory = $('motes');
const capacityLabel = $('capacity');
const notices = $('notices');
const hitFlash = $('hit-flash');
let view;
let game;
let screen = 'menu';
let settingsFrom;
let waitingForKey;
let keyStatus;
let bindingsUI = new Map();
let pauseRequested = false;
let total = 0;
let scoreSaved = false;
let yaw = 0;
let pitch = 0.30;
let mouseAnchor = null;
let spawnNotice = null;
let hitFlashUntil = 0;

function applyPreferences() {
  document.body.classList.toggle('distinct-colors', saved.distinctColors);
  document.body.classList.toggle('reduced-motion', saved.reducedMotion);
  document.documentElement.classList.toggle('large-text', saved.largeText);
  $('dash-key').textContent = bindingText(saved.bindings.dash);
  $('pulse-key').textContent = bindingText(saved.bindings.pulse);
  $('controls').textContent = [
    ['Di chuyển', ['up', 'left', 'down', 'right'].map(key => bindingText(saved.bindings[key])).join(', ')],
    ...controls.slice(4).map(([action, label]) => [label, bindingText(saved.bindings[action])]),
  ].map(([label, binding]) => label + ' ' + binding).join(' · ');
}

function updateSettings() {
  applyPreferences();
  saveSettings(localStorage, saved);
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
  pauseRequested = false;
  mouseAnchor = null;
}

function reset(night) {
  game = new Game(contract, { seed: campaignSeed + night - 1, night });
  yaw = 0;
  pitch = 0.30;
  scoreSaved = false;
  spawnNotice = null;
  hitFlashUntil = 0;
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

function rebuildBindingLabels() {
  for (const [action, button] of bindingsUI) {
    button.textContent = waitingForKey === action ? 'Nhấn phím mới…' : bindingText(saved.bindings[action]);
  }
}

function buildBindings() {
  bindingsUI = new Map();
  const group = document.createElement('fieldset');
  group.className = 'bindings';
  const legend = document.createElement('legend');
  legend.textContent = 'Đổi phím';
  group.append(legend);
  const grid = document.createElement('div');
  grid.className = 'binding-grid';
  for (const [action, title] of controls) {
    const label = document.createElement('span');
    label.textContent = title;
    const button = command('', () => {
      waitingForKey = action;
      keyStatus.textContent = 'Đang đổi phím cho ' + title.toLowerCase() + '.';
      rebuildBindingLabels();
    }, true);
    button.dataset.action = action;
    button.setAttribute('aria-label', 'Đổi phím ' + title.toLowerCase());
    bindingsUI.set(action, button);
    grid.append(label, button);
  }
  keyStatus = document.createElement('p');
  keyStatus.className = 'key-status';
  keyStatus.setAttribute('aria-live', 'polite');
  const restore = command('Khôi phục mặc định', () => {
    saved.bindings = defaultBindings();
    waitingForKey = null;
    keyStatus.textContent = 'Đã khôi phục phím mặc định.';
    rebuildBindingLabels();
    updateSettings();
  }, true);
  group.append(grid, keyStatus, restore);
  rebuildBindingLabels();
  return group;
}

function settings() {
  settingsFrom = screen;
  show('settings');
  const panel = document.createElement('div');
  panel.className = 'settings';
  const preferences = document.createElement('div');
  preferences.className = 'preferences';
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
      updateSettings();
    });
    label.append(input);
    preferences.append(label);
  }
  for (const [key, title] of [['distinctColors', 'Bảng màu dễ phân biệt'],
    ['reducedMotion', 'Giảm chuyển động'], ['largeText', 'Chữ lớn (×1,25)']]) {
    const label = document.createElement('label');
    label.className = 'checkbox-setting';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = key;
    input.checked = saved[key];
    input.addEventListener('change', () => {
      saved[key] = input.checked;
      updateSettings();
    });
    label.append(input, title);
    preferences.append(label);
  }
  panel.append(preferences, buildBindings());
  screenButtons.prepend(panel);
}

function scoreForm() {
  const form = document.createElement('form');
  form.className = 'score-form';
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'player-name';
  input.minLength = 3;
  input.maxLength = 12;
  input.pattern = '[A-Za-z0-9_]{3,12}';
  input.required = true;
  input.autocomplete = 'off';
  label.append('Tên (3–12 chữ cái, số hoặc _)', input);
  const submit = document.createElement('button');
  submit.textContent = 'Lưu điểm';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(label, submit, status);
  if (scoreSaved) {
    status.textContent = 'Đã lưu điểm.';
    input.disabled = true;
    submit.disabled = true;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = input.value;
    if (scoreSaved || !leaderboardName.test(name)) return;
    const entry = { name, score: total, nights_won: game.night - Number(game.state === 'lost'),
      achieved_at: new Date().toISOString(), seed: campaignSeed };
    const completedGame = game;
    submit.disabled = true;
    try {
      await persistScore(entry);
      if (game === completedGame) scoreSaved = true;
      input.disabled = true;
      status.textContent = 'Đã lưu điểm.';
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
  return form;
}

async function showLeaderboard() {
  show('leaderboard');
  const content = document.createElement('div');
  content.className = 'leaderboard';
  content.textContent = 'Đang tải điểm…';
  screenButtons.prepend(content);
  try {
    const entries = await listScores();
    if (!entries.length) { content.textContent = 'Chưa có điểm nào.'; return; }
    const table = document.createElement('table');
    table.setAttribute('aria-label', 'Điểm cao nhất');
    const body = table.createTBody();
    const heading = table.createTHead().insertRow();
    for (const title of ['Hạng', 'Tên', 'Điểm', 'Đêm thắng']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = title;
      heading.append(cell);
    }
    entries.forEach((entry, index) => {
      const row = body.insertRow();
      for (const value of [index + 1, entry.name, numberFormat.format(entry.score), entry.nights_won + '/3']) {
        row.insertCell().textContent = value;
      }
    });
    content.replaceChildren(table);
  } catch (error) {
    content.textContent = error.message;
  }
}

function show(mode) {
  screen = mode;
  waitingForKey = null;
  clearInput();
  overlay.hidden = mode === 'play';
  overlay.classList.toggle('settings-open', mode === 'settings');
  hud.hidden = !['play', 'pause', 'result'].includes(mode);
  $('controls').hidden = !['menu', 'intro'].includes(mode);
  if (mode === 'play') return;
  const kicker = $('screen-kicker');
  kicker.hidden = ['leaderboard', 'settings'].includes(mode);
  kicker.textContent = mode === 'dawn' ? 'BA ĐÊM ĐÃ QUA' : 'ĐÊM ' + game.night + '  ✧  ' + game.world.title.toUpperCase();
  const won = game.state === 'won';
  const pages = {
    menu: ['Đảo Đèn Lồng', 'Cùng Mây giữ ánh sáng trên ba hòn đảo tới bình minh.', [
      command('Bắt đầu', () => beginNight(1)), command('Bảng xếp hạng', showLeaderboard, true), command('Cài đặt', settings, true),
    ]],
    intro: [game.world.title, scenes[game.night], [
      command('Vào đảo', beginPlay), command('Về menu', mainMenu, true),
    ]],
    pause: ['Tạm dừng', '', [
      command('Tiếp tục', () => { pauseRequested = true; }), command('Chơi lại Đêm', () => beginNight(game.night), true),
      command('Cài đặt', settings, true), command('Về menu', mainMenu, true),
    ]],
    settings: ['Cài đặt', '', [command('Quay lại', () => show(settingsFrom))]],
    leaderboard: ['Bảng xếp hạng', '', [command('Về menu', mainMenu)]],
    result: [
      won ? 'Đảo sáng tới bình minh!' : game.player.flames <= 0 ? 'Mây đã hết Ngọn Lửa' : 'Đảo chưa đủ đèn sáng',
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
  if (mode === 'dawn' || (mode === 'result' && !won)) screenButtons.prepend(scoreForm());
  screenButtons.querySelector('button')?.focus({ preventScroll: true });
}

function matches(action, keys) {
  return saved.bindings[action].some(code => keys.has(code));
}

function sampleInput() {
  const input = {
    ...blankInput,
    move: [Number(matches('left', held)) - Number(matches('right', held)),
      Number(matches('up', held)) - Number(matches('down', held))],
    cam_yaw_deg: yaw,
    jump: matches('jump', edges),
    interact: matches('interact', edges),
    pulse: matches('pulse', edges),
    dash: matches('dash', edges),
    pause: pauseRequested || matches('pause', edges),
  };
  edges.clear();
  pauseRequested = false;
  return input;
}

window.addEventListener('keydown', event => {
  if (screen === 'settings' && waitingForKey && !event.repeat) {
    event.preventDefault();
    const other = bindingConflict(saved.bindings, waitingForKey, event.code);
    if (!canBind(event.code) || other) {
      keyStatus.textContent = other ? 'Phím này đã dùng cho ' + other.toLowerCase() + '.' : 'Phím này không hỗ trợ.';
      return;
    }
    saved.bindings[waitingForKey] = [event.code];
    waitingForKey = null;
    keyStatus.textContent = 'Đã lưu phím.';
    rebuildBindingLabels();
    updateSettings();
    return;
  }
  const pauseKey = saved.bindings.pause.includes(event.code);
  if (screen !== 'play' && !(screen === 'pause' && pauseKey)) return;
  if (!controls.some(([action]) => saved.bindings[action].includes(event.code))) return;
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
const moteSlots = Array.from({ length: contract.tuning.capacity_max }, () => {
  const slot = document.createElement('i');
  slot.setAttribute('aria-hidden', 'true');
  inventory.insertBefore(slot, capacityLabel);
  return slot;
});

function caption(id, text) {
  const message = $(id);
  message.hidden = !text;
  if (text && message.textContent !== text) message.textContent = text;
}

function updateHud() {
  const { player } = game;
  for (const [index, item] of Array.from(lamps.children).entries()) item.classList.toggle('spent', index >= player.flames);
  for (const [index, item] of moteSlots.entries()) {
    item.hidden = index >= game.capacity;
    item.classList.toggle('on', index < player.carried);
  }
  capacityLabel.textContent = player.carried + '/' + game.capacity;
  const flameCount = player.flames + ' Ngọn Lửa';
  if (lamps.getAttribute('aria-label') !== flameCount) lamps.setAttribute('aria-label', flameCount);
  const seconds = Math.ceil(game.timeLeft);
  const format = value => String(value).padStart(2, '0');
  clock.textContent = format(Math.floor(seconds / 60)) + ':' + format(seconds % 60);
  clock.classList.toggle('urgent', seconds <= 30 && game.state === 'playing');
  $('lantern-count').textContent = 'Đèn ' + game.litCount + '/' + game.lanterns.length;
  $('dawn-target').textContent = 'Cần ' + game.dawnTarget + ' lúc bình minh';
  $('points').textContent = numberFormat.format(total + (game.state === 'won' ? 0 : game.score)) + ' điểm';
  const cooldown = end => end > game.simTick ? ((end - game.simTick) / HZ).toFixed(1) + 's' : '✓';
  $('dash-status').textContent = cooldown(player.dashCooldown);
  $('pulse-status').textContent = cooldown(player.pulseCooldown);

  const lantern = game.nearbyLantern();
  const interactKey = bindingText(saved.bindings.interact);
  $('prompt').hidden = !lantern || screen !== 'play';
  if (lantern?.lit) $('prompt').textContent = interactKey + ' — Châm dầu (' + (lantern.fuelUnits / HZ).toFixed(1) + '/' + game.tuning.fuel_max + ')';
  else if (lantern) $('prompt').textContent = interactKey + ' — Nạp ánh sáng (' + lantern.deposited + '/' + game.lanternCost(lantern) + ')';

  const shade = spawnNotice?.until > game.simTick ? game.shades.find(item => item.id === spawnNotice.id) : null;
  const weak = game.lanterns.filter(lamp => game.isWeak(lamp)).length;
  notices.hidden = screen !== 'play';
  caption('spawn-notice', shade && 'Bóng Mực xuất hiện');
  caption('countdown-notice', seconds <= 10 && seconds > 0 && '10 giây cuối');
  caption('low-fuel-notice', weak && weak + ' đèn sắp cạn dầu');
  caption('wind-notice', game.windEnabled && (game.wind.active ? 'Gió mạnh' : game.simTick % 1800 >= 1680 && 'Gió mạnh sắp đến'));
  showArrow($('shade-waypoint'), shade?.pos, true);
  const closest = game.closestLantern(player.pos, item => !item.lit) ??
    game.closestLantern(player.pos, item => game.isWeak(item));
  showArrow($('waypoint'), closest && [closest.pos[0], closest.pos[1] + 3, closest.pos[2]]);
}

function showArrow(waypoint, position, always = false) {
  waypoint.hidden = true;
  if (!position || screen !== 'play') return;
  const { x, y, behind } = view.project(position);
  if (!always && !behind && Math.abs(x) <= 0.94 && Math.abs(y) <= 0.9) return;
  const side = behind ? -x : x;
  const top = behind ? -y : y;
  const scale = always ? Math.max(Math.abs(side) / 0.84, Math.abs(top) / 0.64, 0.0001) : 1;
  const leftPct = Math.max(7, Math.min(93, 50 + side * 50 / scale));
  const topPct = Math.max(17, Math.min(82, 50 - top * 50 / scale));
  waypoint.hidden = false;
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
    if (event.name === 'pulse' && !saved.reducedMotion) view.flash(game);
    if (event.name === 'shade_spawned') spawnNotice = { id: event.data.id, until: game.simTick + 4 * HZ };
    if (event.name === 'player_hit' && !saved.reducedMotion) {
      view.hit(game);
      hitFlashUntil = game.simTick + 8;
    }
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
  view.draw(game, yaw, pitch, now / 1000, screen === 'menu' || screen === 'intro', saved.distinctColors,
    { reducedMotion: saved.reducedMotion });
  hitFlash.hidden = saved.reducedMotion || screen !== 'play' || hitFlashUntil <= game.simTick;
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
  applyPreferences();
  mainMenu();
  requestAnimationFrame(frame);
}
