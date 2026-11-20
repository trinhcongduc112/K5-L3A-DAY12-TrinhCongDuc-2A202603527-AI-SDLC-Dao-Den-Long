import './style.css';
import contract from '../game.contract.json';
import { blankInput, Game } from './game.js';
import { DT, horizontalDistance } from './world.js';
import { createView } from './view.js';

const $ = id => document.getElementById(id);
const stage = $('stage');
const overlay = $('overlay');
const hud = $('hud');
const clock = $('clock');
const held = new Set();
const edges = new Set();
let view;
let game;
let screen = 'menu';
let yaw = 0;
let pitch = 0.3;
let mouseAnchor = null;

try {
  view = createView(stage);
} catch {
  $('screen-copy').textContent = 'Trình duyệt cần WebGL 2 để mở game. Bạn vẫn có thể chạy chế độ headless theo README.';
  $('start').disabled = true;
}

function reset() {
  game = new Game(contract, { seed: 1200 });
  yaw = 0;
  pitch = 0.3;
  held.clear();
  edges.clear();
  view.setWorld(game);
}

function show(mode) {
  screen = mode;
  overlay.hidden = mode === 'play';
  hud.hidden = mode === 'menu';
  if (mode === 'play') return;
  $('screen-title').textContent = mode === 'menu' ? 'Đảo Đèn Lồng' : game.state === 'won' ? 'Đảo đã sáng!' : 'Sương phủ Đảo Bến';
  $('screen-copy').textContent = mode === 'menu'
    ? 'Cùng Mây nhặt đom đóm và thắp lại năm chiếc đèn trên đảo.'
    : 'Điểm của bạn: ' + game.score.toLocaleString('vi-VN');
  $('start').textContent = mode === 'menu' ? 'Bắt đầu' : 'Chơi lại';
}

function start() {
  if (!view) return;
  reset();
  show('play');
  view.canvas.focus();
}

$('start').addEventListener('click', start);
const keys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ']);
window.addEventListener('keydown', event => {
  if (screen !== 'play' || !keys.has(event.code)) return;
  event.preventDefault();
  if (!held.has(event.code)) edges.add(event.code);
  held.add(event.code);
});
window.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', () => { held.clear(); edges.clear(); });
stage.addEventListener('pointerdown', event => {
  if (screen !== 'play') return;
  mouseAnchor = [event.clientX, event.clientY];
  event.target.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!mouseAnchor) return;
  yaw -= (event.clientX - mouseAnchor[0]) * 0.26;
  pitch = Math.max(0.14, Math.min(1.05, pitch + (event.clientY - mouseAnchor[1]) * 0.006));
  mouseAnchor = [event.clientX, event.clientY];
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(name, () => { mouseAnchor = null; });
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
  };
  edges.clear();
  return input;
}

const lamps = $('flames');
const inventory = $('motes');
for (let index = 0; index < contract.tuning.flames; index++) {
  const item = document.createElement('span');
  item.textContent = '♦';
  lamps.append(item);
}
for (let index = 0; index < contract.tuning.carry_capacity; index++) inventory.append(document.createElement('i'));

function updateHud() {
  const { player } = game;
  for (const [index, item] of Array.from(lamps.children).entries()) item.classList.toggle('spent', index >= player.flames);
  for (const [index, item] of Array.from(inventory.children).entries()) item.classList.toggle('on', index < player.carried);
  const seconds = Math.ceil(game.timeLeft);
  const format = value => String(value).padStart(2, '0');
  clock.textContent = format(Math.floor(seconds / 60)) + ':' + format(seconds % 60);
  clock.classList.toggle('urgent', seconds <= 30);
  $('lantern-count').textContent = 'Đèn ' + game.lanterns.filter(item => item.lit).length + '/' + game.lanterns.length;
  $('points').textContent = game.score.toLocaleString('vi-VN') + ' điểm';
  const lantern = game.nearbyLantern();
  $('prompt').hidden = !lantern || screen !== 'play';
  if (lantern) $('prompt').textContent = 'E · Nạp ánh sáng (' + lantern.deposited + '/' + game.tuning.lantern_cost + ')';
  const waypoint = $('waypoint');
  const closest = game.lanterns.filter(item => !item.lit).sort((a, b) =>
    horizontalDistance(player.pos, a.pos) - horizontalDistance(player.pos, b.pos))[0];
  waypoint.hidden = true;
  if (closest && screen === 'play') {
    const { x, y, behind } = view.project([closest.pos[0], closest.pos[1] + 3, closest.pos[2]]);
    if (behind || Math.abs(x) > 0.94 || Math.abs(y) > 0.9) {
      waypoint.hidden = false;
      const side = behind ? -x : x;
      const top = behind ? -y : y;
      const leftPct = Math.max(7, Math.min(93, 50 + side * 48));
      const topPct = Math.max(17, Math.min(82, 50 - top * 44));
      waypoint.style.left = leftPct + '%';
      waypoint.style.top = topPct + '%';
      waypoint.style.transform = 'translate(-50%, -50%) rotate(' + Math.atan2(side, top) + 'rad)';
    }
  }
}

let previous = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.max(0, Math.min((now - previous) / 1000, 0.15));
  previous = now;
  if (screen === 'play') {
    accumulator += elapsed;
    while (accumulator >= DT && screen === 'play') {
      accumulator -= DT;
      for (const event of game.step(sampleInput())) {
        if (event.name === 'pulse') view.flash(game);
        if (event.name === 'game_over') show('result');
      }
    }
  } else {
    accumulator = 0;
  }
  view.draw(game, yaw, pitch, now / 1000, screen === 'menu');
  if (!hud.hidden) updateHud();
  requestAnimationFrame(frame);
}
if (view) {
  reset();
  requestAnimationFrame(frame);
}
