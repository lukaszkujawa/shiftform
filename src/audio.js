import { objectRect, floodLevel, phaseOn } from './level.js?v=3166742';
import { playerSize } from './physics.js?v=3166742';

const MASTER_VOLUME = 0.6;
const EMITTER_RANGE = 320;
const MUTE_KEY = 'shiftform:muted';
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];
const HIRAJOSHI = [0, 2, 3, 7, 8, 12, 14, 15];

const AMBIENCE = {
  neon: { root: 110, drone: 'sawtooth', cutoff: 420, bed: null, event: 'pulse', rate: 1.6 },
  paper: { root: 147, drone: 'triangle', cutoff: 900, bed: { type: 'highpass', freq: 3500, gain: 0.03 }, event: 'scratch', rate: 0.6 },
  crystal: { root: 196, drone: 'sine', cutoff: 2000, bed: { type: 'highpass', freq: 6000, gain: 0.02 }, event: 'bell', rate: 0.9 },
  ember: { root: 55, drone: 'sawtooth', cutoff: 220, bed: { type: 'lowpass', freq: 180, gain: 0.14 }, event: 'crackle', rate: 6 },
  frost: { root: 98, drone: 'sine', cutoff: 800, bed: { type: 'bandpass', freq: 520, gain: 0.12, sweep: true }, event: 'chime', rate: 0.35 },
  void: { root: 41, drone: 'sine', cutoff: 300, bed: { type: 'lowpass', freq: 110, gain: 0.08 }, event: 'shimmer', rate: 0.3 },
  jungle: { root: 82, drone: 'triangle', cutoff: 600, bed: { type: 'bandpass', freq: 2400, gain: 0.03, sweep: true }, event: 'drip', rate: 1.2 },
  dunes: { root: 73, drone: 'sine', cutoff: 500, bed: { type: 'bandpass', freq: 700, gain: 0.1, sweep: true }, event: 'scratch', rate: 0.4 },
  deep: { root: 49, drone: 'sine', cutoff: 350, bed: { type: 'lowpass', freq: 300, gain: 0.1 }, event: 'bubble', rate: 0.8 },
  blossom: { root: 131, drone: 'triangle', cutoff: 1200, bed: { type: 'highpass', freq: 5000, gain: 0.015 }, event: 'pluck', rate: 0.5 },
  city: { root: 62, drone: 'sawtooth', cutoff: 240, bed: { type: 'lowpass', freq: 420, gain: 0.09 }, event: 'horn', rate: 0.2 },
  country: { root: 131, drone: 'triangle', cutoff: 900, bed: { type: 'highpass', freq: 4000, gain: 0.015 }, event: 'chirp', rate: 0.9 },
  ship: { root: 52, drone: 'sawtooth', cutoff: 280, bed: { type: 'lowpass', freq: 220, gain: 0.1 }, event: 'beep', rate: 0.6 },
  candy: { root: 175, drone: 'sine', cutoff: 1500, bed: null, event: 'bell', rate: 0.8 },
  office: { root: 98, drone: 'sine', cutoff: 380, bed: { type: 'bandpass', freq: 1100, gain: 0.035 }, event: 'click', rate: 4 },
  matrix: { root: 65, drone: 'square', cutoff: 320, bed: { type: 'highpass', freq: 7000, gain: 0.012 }, event: 'beep', rate: 1.4 },
  inferno: { root: 41, drone: 'sawtooth', cutoff: 180, bed: { type: 'lowpass', freq: 160, gain: 0.16 }, event: 'rumble', rate: 0.25 },
  lunar: { root: 46, drone: 'sine', cutoff: 260, bed: { type: 'highpass', freq: 6500, gain: 0.01 }, event: 'beep', rate: 0.3 },
  harbor: { root: 73, drone: 'triangle', cutoff: 500, bed: { type: 'lowpass', freq: 600, gain: 0.12, sweep: true }, event: 'cry', rate: 0.35 },
  haunted: { root: 55, drone: 'sine', cutoff: 300, bed: { type: 'bandpass', freq: 400, gain: 0.08, sweep: true }, event: 'moan', rate: 0.15 },
  synthwave: { root: 82, drone: 'sawtooth', cutoff: 600, bed: null, event: 'arp', rate: 0.5 },
  factory: { root: 49, drone: 'square', cutoff: 200, bed: { type: 'bandpass', freq: 300, gain: 0.1 }, event: 'clank', rate: 0.7 },
  mushroom: { root: 98, drone: 'sine', cutoff: 700, bed: { type: 'highpass', freq: 5000, gain: 0.015 }, event: 'drip', rate: 0.9 },
  sky: { root: 147, drone: 'triangle', cutoff: 1100, bed: { type: 'bandpass', freq: 900, gain: 0.07, sweep: true }, event: 'chime', rate: 0.4 },
  autumn: { root: 98, drone: 'triangle', cutoff: 700, bed: { type: 'bandpass', freq: 1600, gain: 0.05, sweep: true }, event: 'chirp', rate: 0.6 },
  ruins: { root: 55, drone: 'sine', cutoff: 260, bed: { type: 'lowpass', freq: 200, gain: 0.1 }, event: 'drip', rate: 0.5 },
  hive: { root: 110, drone: 'sawtooth', cutoff: 320, bed: { type: 'bandpass', freq: 240, gain: 0.12 }, event: 'pulse', rate: 2 },
  lab: { root: 65, drone: 'square', cutoff: 300, bed: { type: 'highpass', freq: 6000, gain: 0.012 }, event: 'tick', rate: 5 },
  pirate: { root: 73, drone: 'triangle', cutoff: 450, bed: { type: 'lowpass', freq: 500, gain: 0.14, sweep: true }, event: 'creak', rate: 0.3 },
  cathedral: { root: 65, drone: 'sine', cutoff: 500, bed: { type: 'highpass', freq: 3000, gain: 0.02 }, event: 'choir', rate: 0.2 },
  savanna: { root: 98, drone: 'triangle', cutoff: 800, bed: { type: 'highpass', freq: 4500, gain: 0.015 }, event: 'trill', rate: 0.7 },
  bayou: { root: 55, drone: 'sine', cutoff: 360, bed: { type: 'bandpass', freq: 3800, gain: 0.02, sweep: true }, event: 'croak', rate: 0.6 },
  carnival: { root: 131, drone: 'triangle', cutoff: 1000, bed: { type: 'bandpass', freq: 1800, gain: 0.03, sweep: true }, event: 'calliope', rate: 0.3 },
  lantern: { root: 98, drone: 'sine', cutoff: 600, bed: { type: 'highpass', freq: 4500, gain: 0.012 }, event: 'koto', rate: 0.35 },
  library: { root: 87, drone: 'triangle', cutoff: 380, bed: { type: 'highpass', freq: 5500, gain: 0.012 }, event: 'pages', rate: 0.5 },
  mine: { root: 55, drone: 'sine', cutoff: 240, bed: { type: 'lowpass', freq: 260, gain: 0.1, sweep: true }, event: 'strike', rate: 0.4 },
};

const semitone = (root, n) => root * 2 ** (n / 12);
const pick = list => list[Math.floor(Math.random() * list.length)];

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function saveMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

function proximity(rect, cx, cy) {
  const dx = Math.max(rect.x - cx, 0, cx - rect.x - rect.w);
  const dy = Math.max(rect.y - cy, 0, cy - rect.y - rect.h);
  return Math.max(0, 1 - Math.hypot(dx, dy) / EMITTER_RANGE) ** 2;
}

export function createAudio() {
  let ctx = null, master, sfx, amb, noise, ambience = null, wind = null, scrape = null, scrapeShape = null, pushed = null, jet = null;
  let muted = loadMuted();
  const emitters = new Map();
  const now = () => ctx.currentTime;
  const followVisibility = () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); };
  document.addEventListener('visibilitychange', followVisibility);

  function gain(value, into) {
    const node = ctx.createGain();
    node.gain.value = value;
    if (into) node.connect(into);
    return node;
  }

  function resume() {
    if (!ctx) {
      ctx = new AudioContext();
      master = gain(muted ? 0 : MASTER_VOLUME, ctx.destination);
      sfx = gain(0.9, master);
      amb = gain(0.5, master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function envelope(param, at, peak, attack, dur) {
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + dur);
  }

  function tone({ freq, to = freq, type = 'sine', dur = 0.15, gain = 0.1, attack = 0.005, delay = 0, out = sfx }) {
    const at = now() + delay;
    const osc = ctx.createOscillator(), level = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    envelope(level.gain, at, gain, attack, dur);
    osc.connect(level).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function noiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    return src;
  }

  function hiss({ freq, to = freq, filter = 'bandpass', q = 1, dur = 0.15, gain = 0.1, attack = 0.005, delay = 0, out = sfx }) {
    const at = now() + delay;
    const src = noiseSource(), shape = ctx.createBiquadFilter(), level = ctx.createGain();
    shape.type = filter;
    shape.Q.value = q;
    shape.frequency.setValueAtTime(freq, at);
    if (to !== freq) shape.frequency.exponentialRampToValueAtTime(to, at + dur);
    envelope(level.gain, at, gain, attack, dur);
    src.connect(shape).connect(level).connect(out);
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
  }

  function bell(freq, gain, dur, delay = 0, out = sfx) {
    [1, 2.76, 5.4].forEach((m, i) => tone({ freq: freq * m, dur: dur / (i + 1), gain: gain / (i + 1), attack: 0.003, delay, out }));
  }

  const MATERIALS = {
    wood: v => { hiss({ freq: 700, q: 3, dur: 0.08, gain: 0.25 * v }); tone({ freq: 190, to: 140, dur: 0.1, gain: 0.15 * v }); },
    steel: v => bell(410, 0.09 * v, 0.5),
    stone: v => { hiss({ filter: 'lowpass', freq: 260, dur: 0.22, gain: 0.35 * v }); tone({ freq: 70, to: 40, dur: 0.25, gain: 0.25 * v }); },
  };
  const SCRAPE = { wood: 900, steel: 2600, stone: 300 };

  const SOUNDS = {
    jump: () => { tone({ type: 'square', freq: 240, to: 480, dur: 0.12, gain: 0.04 }); tone({ type: 'triangle', freq: 480, to: 960, dur: 0.1, gain: 0.05 }); },
    airJump: () => { tone({ type: 'square', freq: 420, to: 840, dur: 0.1, gain: 0.035 }); tone({ freq: 1260, dur: 0.08, gain: 0.04, delay: 0.03 }); },
    land: e => {
      const v = Math.min(1, e.speed / 14);
      if (v < 0.15) return;
      hiss({ filter: 'lowpass', freq: 500, dur: 0.09, gain: 0.25 * v });
      tone({ freq: 110, to: 50, dur: 0.1, gain: 0.2 * v });
    },
    kick: () => { tone({ type: 'triangle', freq: 320, to: 760, dur: 0.14, gain: 0.07 }); hiss({ freq: 1800, to: 900, dur: 0.08, gain: 0.08 }); },
    dash: () => hiss({ freq: 900, to: 3200, q: 0.8, dur: 0.2, gain: 0.18 }),
    charged: () => { tone({ type: 'triangle', freq: 440, to: 1320, dur: 0.22, gain: 0.07 }); hiss({ freq: 1200, to: 4000, dur: 0.18, gain: 0.06 }); },
    uncharged: () => tone({ type: 'triangle', freq: 880, to: 330, dur: 0.16, gain: 0.05 }),
    death: () => { tone({ type: 'sawtooth', freq: 420, to: 55, dur: 0.55, gain: 0.1 }); hiss({ filter: 'lowpass', freq: 1200, to: 200, dur: 0.4, gain: 0.2 }); },
    key: () => [0, 4, 7, 12].forEach((n, i) => tone({ type: 'triangle', freq: semitone(660, n), dur: 0.18, gain: 0.07, delay: i * 0.05 })),
    switch: () => { tone({ type: 'square', freq: 300, dur: 0.05, gain: 0.05 }); tone({ type: 'triangle', freq: 600, to: 900, dur: 0.15, gain: 0.06, delay: 0.05 }); },
    crumble: () => hiss({ freq: 400, to: 150, q: 2, dur: 0.35, gain: 0.18 }),
    plateDown: () => { tone({ type: 'square', freq: 160, dur: 0.05, gain: 0.06 }); tone({ freq: 220, to: 330, dur: 0.25, gain: 0.08, delay: 0.04 }); },
    plateUp: () => tone({ freq: 330, to: 200, dur: 0.2, gain: 0.07 }),
    flip: e => tone({ type: 'triangle', freq: e.dir < 0 ? 200 : 700, to: e.dir < 0 ? 700 : 200, dur: 0.25, gain: 0.08 }),
    spring: () => tone({ freq: 180, to: 720, dur: 0.22, gain: 0.12 }),
    launch: () => { tone({ type: 'sawtooth', freq: 110, to: 880, dur: 0.7, gain: 0.07 }); hiss({ freq: 300, to: 4000, dur: 0.8, gain: 0.12 }); },
    bumper: () => tone({ type: 'square', freq: 520, to: 260, dur: 0.15, gain: 0.08 }),
    splash: () => { hiss({ filter: 'bandpass', freq: 900, to: 300, q: 1, dur: 0.3, gain: 0.25 }); tone({ freq: 240, to: 120, dur: 0.2, gain: 0.08 }); },
    portal: () => { tone({ freq: 300, to: 1200, dur: 0.3, gain: 0.07 }); tone({ freq: 1210, to: 310, dur: 0.3, gain: 0.07 }); },
    grab: () => { tone({ type: 'triangle', freq: 1400, dur: 0.06, gain: 0.08 }); tone({ type: 'triangle', freq: 2100, dur: 0.05, gain: 0.05, delay: 0.02 }); },
    letGo: () => tone({ type: 'triangle', freq: 900, to: 600, dur: 0.08, gain: 0.06 }),
    climbStep: () => hiss({ freq: 1800 + Math.random() * 600, q: 3, dur: 0.04, gain: 0.05 }),
    lift: () => tone({ type: 'triangle', freq: 200, to: 320, dur: 0.12, gain: 0.08 }),
    throw: () => hiss({ freq: 600, to: 2400, dur: 0.18, gain: 0.14 }),
    drop: e => MATERIALS[e.kind](0.6),
    crateLand: e => MATERIALS[e.kind](Math.min(1, e.speed / 10)),
    push: e => { pushed = e.kind; },
    cometPerfect: e => { const f = semitone(392, PENTATONIC[Math.min(PENTATONIC.length - 1, e.combo - 2)]); tone({ type: 'triangle', freq: f, to: f * 2, dur: 0.18, gain: 0.12 }); bell(f * 2, 0.05, 0.5, 0.05); },
    cometBounce: () => tone({ freq: 220, to: 440, dur: 0.14, gain: 0.08 }),
    cometLate: () => tone({ type: 'square', freq: 180, to: 140, dur: 0.12, gain: 0.05 }),
    cometOut: () => { hiss({ filter: 'highpass', freq: 3000, to: 600, dur: 0.5, gain: 0.12 }); tone({ freq: 330, to: 110, dur: 0.4, gain: 0.06 }); },
    shoot: () => { tone({ type: 'triangle', freq: 160, to: 110, dur: 0.07, gain: 0.08 }); hiss({ filter: 'highpass', freq: 2600, to: 1400, dur: 0.14, gain: 0.1 }); },
    stomp: () => { tone({ type: 'square', freq: 320, to: 90, dur: 0.16, gain: 0.12 }); hiss({ filter: 'lowpass', freq: 900, dur: 0.1, gain: 0.15 }); tone({ freq: 520, to: 980, dur: 0.12, gain: 0.06, delay: 0.06 }); },
    crush: () => { hiss({ filter: 'lowpass', freq: 1200, to: 150, dur: 0.4, gain: 0.3 }); tone({ type: 'square', freq: 90, to: 40, dur: 0.35, gain: 0.1 }); },
    item: e => {
      [0, 4, 7, 11, 14].forEach((n, i) => tone({ type: 'triangle', freq: semitone(523, n), dur: 0.22, gain: 0.07, delay: i * 0.045 }));
      if (e.kind === 'heart') [0, 7, 12].forEach((n, i) => bell(semitone(392, n), 0.05, 1, 0.25 + i * 0.08));
    },
    shieldBreak: () => { hiss({ filter: 'highpass', freq: 3000, dur: 0.3, gain: 0.2 }); bell(1250, 0.07, 0.5); },
    checkpoint: () => [0, 4, 7, 12].forEach((n, i) => bell(semitone(523, n), 0.07, 1.2, i * 0.07)),
    coin: () => { tone({ type: 'triangle', freq: 1760, dur: 0.07, gain: 0.05 }); tone({ type: 'triangle', freq: 2349, dur: 0.14, gain: 0.05, delay: 0.06 }); },
    combo: e => { const f = semitone(523, PENTATONIC[Math.min(PENTATONIC.length - 1, e.links - 2)]); tone({ type: 'triangle', freq: f, to: f * 1.5, dur: 0.14, gain: 0.07 }); },
    fanfare: e => [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, Math.floor(e.links / 8))).forEach((n, i) => bell(semitone(659, n), 0.07, 0.9, i * 0.07)),
    pick: () => [0, 7, 12].forEach((n, i) => tone({ type: 'triangle', freq: semitone(440, n), dur: 0.2, gain: 0.07, delay: i * 0.06 })),
    place: () => { hiss({ filter: 'lowpass', freq: 700, dur: 0.12, gain: 0.25 }); tone({ freq: 160, to: 110, dur: 0.14, gain: 0.15 }); },
    erase: () => { hiss({ filter: 'highpass', freq: 2500, to: 400, dur: 0.35, gain: 0.18 }); tone({ type: 'square', freq: 500, to: 60, dur: 0.3, gain: 0.05 }); },
    biome: e => [0, 7, 12, 16].forEach((n, i) => tone({ type: 'triangle', freq: semitone(AMBIENCE[e.theme].root * 2, n), dur: 2.4, gain: 0.05, attack: 0.3, delay: i * 0.12 })),
    gameOver: () => [12, 7, 3, 0].forEach((n, i) => tone({ type: 'triangle', freq: semitone(196, n), dur: 0.6, gain: 0.08, delay: i * 0.18 })),
  };

  const ambientTone = options => tone({ ...options, out: ambience.out });
  const ambientHiss = options => hiss({ ...options, out: ambience.out });
  const ambientBell = (freq, gain, dur) => bell(freq, gain, dur, 0, ambience.out);
  const note = (spec, octave) => semitone(spec.root * octave, pick(PENTATONIC));

  const AMBIENT_EVENTS = {
    pulse: s => ambientTone({ type: 'triangle', freq: note(s, 4), dur: 0.3, gain: 0.025 }),
    scratch: () => ambientHiss({ freq: 2500, to: 4200, q: 4, dur: 0.12, gain: 0.035 }),
    bell: s => ambientBell(note(s, 4), 0.03, 1.6),
    crackle: () => ambientHiss({ filter: 'highpass', freq: 2000, q: 0.5, dur: 0.02, gain: 0.06 * Math.random() }),
    chime: s => ambientBell(note(s, 8), 0.025, 2.2),
    shimmer: s => ambientTone({ freq: note(s, 16), dur: 2.5, attack: 1, gain: 0.02 }),
    drip: s => ambientTone({ freq: note(s, 16), to: s.root * 8, dur: 0.12, gain: 0.03 }),
    bubble: s => ambientTone({ freq: s.root * 8, to: s.root * 24, dur: 0.18, gain: 0.025 }),
    pluck: s => ambientTone({ type: 'triangle', freq: note(s, 4), dur: 1.2, gain: 0.035 }),
    horn: s => [0, 4].forEach(n => ambientTone({ type: 'triangle', freq: semitone(s.root * 4, n), dur: 0.45, gain: 0.015, attack: 0.04 })),
    chirp: s => [0, 0.09, 0.18].slice(0, 1 + Math.floor(Math.random() * 3)).forEach(delay => ambientTone({ freq: s.root * 24, to: s.root * 36, dur: 0.06, gain: 0.018, delay })),
    beep: s => ambientTone({ type: 'square', freq: note(s, 16), dur: 0.07, gain: 0.01 }),
    click: () => ambientHiss({ filter: 'highpass', freq: 3200, q: 1, dur: 0.012, gain: 0.03 + 0.03 * Math.random() }),
    rumble: s => { ambientHiss({ filter: 'lowpass', freq: 120, q: 0.7, dur: 1.4, attack: 0.4, gain: 0.12 }); ambientTone({ freq: s.root, to: s.root * 0.7, dur: 1.2, gain: 0.04, attack: 0.3 }); },
    cry: s => ambientTone({ type: 'triangle', freq: s.root * 24, to: s.root * 16, dur: 0.35, gain: 0.015, attack: 0.03 }),
    moan: s => ambientTone({ freq: note(s, 4), to: s.root * 3, dur: 2.2, gain: 0.025, attack: 0.8 }),
    arp: s => [0, 4, 7, 12].forEach((n, i) => ambientTone({ type: 'sawtooth', freq: semitone(s.root * 4, n), dur: 0.14, gain: 0.012, delay: i * 0.12 })),
    clank: s => { ambientBell(s.root * 6, 0.02, 0.4); ambientHiss({ freq: 1800, q: 3, dur: 0.05, gain: 0.03 }); },
    tick: () => ambientHiss({ filter: 'highpass', freq: 4000, q: 2, dur: 0.01, gain: 0.05 + 0.05 * Math.random() }),
    creak: s => { ambientTone({ type: 'sawtooth', freq: s.root * 1.5, to: s.root * 1.2, dur: 0.6, gain: 0.012, attack: 0.1 }); if (Math.random() < 0.5) ambientTone({ type: 'triangle', freq: s.root * 24, to: s.root * 16, dur: 0.35, gain: 0.012, attack: 0.03, delay: 0.3 }); },
    choir: s => [0, 4, 7].forEach(n => ambientTone({ type: 'triangle', freq: semitone(s.root * 4, n + pick([0, 2, 5])), dur: 3.2, gain: 0.012, attack: 1.2 })),
    trill: s => { const base = note(s, 16); for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) ambientTone({ freq: base * (1 + (i % 2) * 0.25), to: base * (1.2 + (i % 2) * 0.2), dur: 0.07, gain: 0.015, delay: i * 0.09 }); },
    croak: s => { for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) ambientTone({ type: 'sawtooth', freq: s.root * 4, to: s.root * 3, dur: 0.08, gain: 0.014, attack: 0.02, delay: i * 0.12 }); },
    calliope: s => { const shift = pick([0, 5, 7]); [4, 5, 4, 2, 3, 1].forEach((n, i) => ambientTone({ type: 'square', freq: semitone(s.root * 4, PENTATONIC[n] + shift), dur: 0.18, gain: 0.008, delay: i * 0.17 })); },
    koto: s => { [0, 1, 2].slice(0, 2 + Math.floor(Math.random() * 2)).forEach(i => ambientTone({ type: 'triangle', freq: semitone(s.root * 4, pick(HIRAJOSHI)), dur: 1.4, gain: 0.03, delay: i * 0.24 })); if (Math.random() < 0.25) ambientBell(s.root * 2, 0.02, 3.5); },
    pages: () => {
      ambientHiss({ filter: 'highpass', freq: 3000, to: 6000, q: 0.6, dur: 0.35, attack: 0.1, gain: 0.04 });
      if (Math.random() < 0.4) [440, 330].forEach((freq, i) => ambientTone({ type: 'triangle', freq, to: freq * 0.9, dur: 0.05, gain: 0.03, delay: 0.5 + i * 0.6 }));
    },
    strike: s => {
      if (Math.random() < 0.5) { ambientBell(s.root * 14, 0.012, 0.9); ambientHiss({ freq: 2200, q: 4, dur: 0.04, gain: 0.025 }); }
      else ambientTone({ freq: s.root * 32, to: s.root * 12, dur: 0.1, gain: 0.03 });
    },
  };

  function loop(build, out) {
    const level = gain(0, out);
    const nodes = build(level);
    nodes.forEach(n => n.start());
    return { level, nodes };
  }

  function filtered(type, freq, q, into) {
    const shape = ctx.createBiquadFilter();
    shape.type = type;
    shape.frequency.value = freq;
    shape.Q.value = q;
    shape.connect(into);
    return shape;
  }

  function lfo(rate, depth, param) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = gain(depth);
    osc.connect(amount).connect(param);
    return osc;
  }

  const noiseLoop = (type, freq, q, sweep) => out => {
    const src = noiseSource(), shape = filtered(type, freq, q, out);
    src.connect(shape);
    return sweep ? [src, lfo(...sweep, shape.frequency)] : [src];
  };

  const EMITTERS = {
    saw: { gain: 0.05, build: out => { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 150; osc.connect(filtered('lowpass', 900, 2, out)); return [osc, lfo(18, 25, osc.frequency)]; } },
    laser: { gain: 0.035, build: out => [880, 887].map(f => { const osc = ctx.createOscillator(); osc.frequency.value = f; osc.connect(out); return osc; }) },
    conveyor: { gain: 0.12, build: noiseLoop('bandpass', 450, 4) },
    mover: { gain: 0.08, build: out => { const osc = ctx.createOscillator(); osc.frequency.value = 62; osc.connect(out); return [osc]; } },
    wind: { gain: 0.12, build: noiseLoop('highpass', 900, 0.7, [0.4, 300]) },
    flood: { gain: 0.3, build: noiseLoop('lowpass', 140, 1) },
  };

  function emitter(type) {
    if (!emitters.has(type)) emitters.set(type, loop(EMITTERS[type].build, sfx));
    return emitters.get(type);
  }

  function setLevel(voice, value, smooth = 0.08) {
    if (Math.abs(value - (voice.target ?? -1)) < 1e-3) return;
    voice.target = value;
    voice.level.gain.setTargetAtTime(value, now(), smooth);
  }

  function startAmbience(theme) {
    const spec = AMBIENCE[theme];
    const out = gain(0.0001, amb);
    out.gain.setTargetAtTime(1, now(), 1.2);
    const drone = filtered('lowpass', spec.cutoff, 1, gain(0.05, out));
    const nodes = [[1, 0], [1.5, 4], [2, -6]].map(([mult, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = spec.drone;
      osc.frequency.value = spec.root * mult;
      osc.detune.value = detune;
      osc.connect(drone);
      return osc;
    });
    nodes.push(lfo(0.07, spec.cutoff * 0.4, drone.frequency));
    if (spec.bed) nodes.push(...noiseLoop(spec.bed.type, spec.bed.freq, 0.8, spec.bed.sweep && [0.13, spec.bed.freq * 0.6])(gain(spec.bed.gain, out)));
    nodes.forEach(n => n.start());
    return { theme, spec, out, nodes, next: now() + 1 };
  }

  function stopAmbience(old) {
    old.out.gain.setTargetAtTime(0.0001, now(), 0.8);
    setTimeout(() => old.nodes.forEach(n => n.stop()), 4000);
  }

  function updateAmbience(altitude) {
    if (!ambience) return;
    if (ambience.next < now() - 1) ambience.next = now();
    while (ambience.next < now()) {
      AMBIENT_EVENTS[ambience.spec.event](ambience.spec);
      ambience.next += -Math.log(1 - Math.random()) / ambience.spec.rate;
    }
    wind ??= loop(noiseLoop('bandpass', 450, 0.5, [0.09, 250]), amb);
    setLevel(wind, Math.min(0.14, (altitude / 1800) * 0.14), 1);
  }

  function updateEmitters(level, state) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2;
    const loudest = {};
    for (const o of level.objects) {
      if (!EMITTERS[o.type] || (o.type === 'laser' && !phaseOn(o, state.clock))) continue;
      loudest[o.type] = Math.max(loudest[o.type] ?? 0, proximity(objectRect(o, state.clock), cx, cy));
    }
    const flood = floodLevel(level, state.tide);
    if (flood !== Infinity) loudest.flood = Math.max(0, 1 - Math.abs(flood - cy) / (EMITTER_RANGE * 2));
    for (const type of Object.keys(EMITTERS)) {
      if (!loudest[type] && !emitters.has(type)) continue;
      setLevel(emitter(type), (loudest[type] ?? 0) * EMITTERS[type].gain);
    }
  }

  function updateScrape() {
    if (pushed && !scrape) scrape = { voice: loop(out => { const src = noiseSource(); scrapeShape = filtered('bandpass', 900, 3, out); src.connect(scrapeShape); return [src]; }, sfx) };
    if (!scrape) return;
    if (pushed) scrapeShape.frequency.setTargetAtTime(SCRAPE[pushed], now(), 0.05);
    setLevel(scrape.voice, pushed ? 0.1 : 0, 0.05);
    pushed = null;
  }

  return {
    resume,
    play(event) {
      if (ctx) SOUNDS[event.type]?.(event);
    },
    setBiome(theme) {
      resume();
      if (ambience?.theme === theme) return;
      if (ambience) stopAmbience(ambience);
      ambience = startAmbience(theme);
    },
    update({ level, state, altitude }) {
      if (!ctx) return;
      jet ??= loop(noiseLoop('bandpass', 700, 0.8), sfx);
      setLevel(jet, state.jetting ? 0.16 : 0, 0.04);
      updateEmitters(level, state);
      updateScrape();
      updateAmbience(altitude);
    },
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, now(), 0.05);
      return muted;
    },
    get muted() { return muted; },
    stop() {
      document.removeEventListener('visibilitychange', followVisibility);
      ctx?.close();
      ctx = null;
      ambience = null;
      wind = null;
      scrape = null;
      jet = null;
      emitters.clear();
    },
  };
}
