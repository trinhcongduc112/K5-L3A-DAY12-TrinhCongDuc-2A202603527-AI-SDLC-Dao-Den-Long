const pieces = {
  mote_picked: [[780, 0.1]],
  lantern_lit: [[392, 0.18], [523, 0.19], [784, 0.27]],
  refuel: [[454, 0.14], [620, 0.19]],
  lantern_out: [[220, 0.18], [147, 0.23]],
  pulse: [[240, 0.2], [520, 0.19]],
  player_hit: [[130, 0.24], [91, 0.18]],
  jump: [[325, 0.13]],
  dash: [[255, 0.12], [380, 0.12]],
  won: [[523, 0.18], [659, 0.18], [784, 0.23], [1047, 0.35]],
  lost: [[294, 0.24], [220, 0.26], [165, 0.35]],
  shade_spawned: [[104, 0.36]],
  countdown: [[544, 0.10]],
  wind: [[112, 0.37], [146, 0.4]],
  charm_picked: [[659, 0.16], [880, 0.2]],
};

export function createAudio(initialVolume) {
  let context;
  let master;
  let music;
  let volume = initialVolume;
  const notes = [110, 164.81, 220, 261.63, 196, 164.81, 146.83, 220];
  function tone(frequency, duration, offset, gain, output = master) {
    if (!context || context.state !== 'running') return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  return {
    activate() {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
        music = context.createGain();
        music.gain.value = 0.34;
        music.connect(master);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    },
    volume(value) {
      volume = value;
      if (master) master.gain.setTargetAtTime(volume, context.currentTime, 0.05);
    },
    note(index) {
      if (!music) return;
      const note = notes[index % notes.length];
      tone(note, 2.3, 0, 0.21, music);
      tone(note * 2, 1.55, 0.04, 0.072, music);
    },
    play(name) {
      let offset = 0;
      for (const [frequency, duration] of pieces[name] ?? []) {
        tone(frequency, duration, offset, 0.18);
        offset += duration * 0.64;
      }
    },
  };
}
