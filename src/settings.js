export const controls = [
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Nạp / châm dầu'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng'],
];

const defaults = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'], pulse: ['KeyQ'], pause: ['Escape', 'KeyP'],
};
const pretty = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', Backspace: 'Backspace' };
const supportedCode = /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Escape|Enter|Backspace|Shift(?:Left|Right)|Control(?:Left|Right)|Bracket(?:Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Backquote)$/;

export function defaultBindings() {
  return Object.fromEntries(controls.map(([action]) => [action, [...defaults[action]]]));
}

export function bindingConflict(bindings, action, code) {
  return controls.find(([other]) => other !== action && bindings[other].includes(code))?.[1];
}

export function canBind(code) {
  return typeof code === 'string' && supportedCode.test(code);
}

export function validBindings(bindings) {
  if (!bindings || typeof bindings !== 'object') return defaultBindings();
  const seen = new Set();
  for (const [action] of controls) {
    const codes = bindings[action];
    if (!Array.isArray(codes) || !codes.length || codes.length > 2) return defaultBindings();
    for (const code of codes) {
      if (!canBind(code) || seen.has(code)) return defaultBindings();
      seen.add(code);
    }
  }
  return Object.fromEntries(controls.map(([action]) => [action, [...bindings[action]]]));
}

export function bindingText(codes) {
  return [...new Set(codes.map(code => pretty[code] ?? code.replace(/^(Key|Digit)/, '')))].join(' / ');
}

const storageKey = 'dao-den-long-settings';

export function readSettings(storage, reducedMotion = false) {
  let saved;
  try { saved = JSON.parse(storage.getItem(storageKey)); } catch {}
  const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    volume: bounded(saved?.volume, 0, 1, 0.55),
    sensitivity: bounded(saved?.sensitivity, 0.35, 2, 1),
    distinctColors: saved?.distinctColors === true,
    reducedMotion: typeof saved?.reducedMotion === 'boolean' ? saved.reducedMotion : reducedMotion,
    largeText: saved?.largeText === true,
    bindings: validBindings(saved?.bindings),
  };
}

export function saveSettings(storage, settings) {
  try { storage.setItem(storageKey, JSON.stringify(settings)); } catch {}
}
