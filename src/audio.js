import { objectRect, floodLevel } from './level.js';
import { laserOn, playerSize } from './physics.js';

const MASTER_VOLUME = 0.6;
const EMITTER_RANGE = 320;
const MUTE_KEY = 'shiftform:muted';
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

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

  function bus(gain) {
    const node = ctx.createGain();
    node.gain.value = gain;
    node.connect(master);
    return node;
  }

  function resume() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);
      sfx = bus(0.9);
      amb = bus(0.5);
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
    portal: () => { tone({ freq: 300, to: 1200, dur: 0.3, gain: 0.07 }); tone({ freq: 1210, to: 310, dur: 0.3, gain: 0.07 }); },
    grab: () => { tone({ type: 'triangle', freq: 1400, dur: 0.06, gain: 0.08 }); tone({ type: 'triangle', freq: 2100, dur: 0.05, gain: 0.05, delay: 0.02 }); },
    letGo: () => tone({ type: 'triangle', freq: 900, to: 600, dur: 0.08, gain: 0.06 }),
    lift: () => tone({ type: 'triangle', freq: 200, to: 320, dur: 0.12, gain: 0.08 }),
    throw: () => hiss({ freq: 600, to: 2400, dur: 0.18, gain: 0.14 }),
    drop: e => MATERIALS[e.kind](0.6),
    crateLand: e => MATERIALS[e.kind](Math.min(1, e.speed / 10)),
    push: e => { pushed = e.kind; },
    crush: () => { hiss({ filter: 'lowpass', freq: 1200, to: 150, dur: 0.4, gain: 0.3 }); tone({ type: 'square', freq: 90, to: 40, dur: 0.35, gain: 0.1 }); },
    item: e => {
      [0, 4, 7, 11, 14].forEach((n, i) => tone({ type: 'triangle', freq: semitone(523, n), dur: 0.22, gain: 0.07, delay: i * 0.045 }));
      if (e.kind === 'heart') [0, 7, 12].forEach((n, i) => bell(semitone(392, n), 0.05, 1, 0.25 + i * 0.08));
    },
    shieldBreak: () => { hiss({ filter: 'highpass', freq: 3000, dur: 0.3, gain: 0.2 }); bell(1250, 0.07, 0.5); },
    checkpoint: () => [0, 4, 7, 12].forEach((n, i) => bell(semitone(523, n), 0.07, 1.2, i * 0.07)),
    biome: e => [0, 7, 12, 16].forEach((n, i) => tone({ type: 'triangle', freq: semitone(AMBIENCE[e.theme].root * 2, n), dur: 2.4, gain: 0.05, attack: 0.3, delay: i * 0.12 })),
    gameOver: () => [12, 7, 3, 0].forEach((n, i) => tone({ type: 'triangle', freq: semitone(196, n), dur: 0.6, gain: 0.08, delay: i * 0.18 })),
  };

  const AMBIENT_EVENTS = {
    pulse: s => tone({ type: 'triangle', freq: semitone(s.root * 4, pick(PENTATONIC)), dur: 0.3, gain: 0.025, out: ambience.out }),
    scratch: () => hiss({ freq: 2500, to: 4200, q: 4, dur: 0.12, gain: 0.035, out: ambience.out }),
    bell: s => bell(semitone(s.root * 4, pick(PENTATONIC)), 0.03, 1.6, 0, ambience.out),
    crackle: () => hiss({ filter: 'highpass', freq: 2000, q: 0.5, dur: 0.02, gain: 0.06 * Math.random(), out: ambience.out }),
    chime: s => bell(semitone(s.root * 8, pick(PENTATONIC)), 0.025, 2.2, 0, ambience.out),
    shimmer: s => tone({ freq: semitone(s.root * 16, pick(PENTATONIC)), dur: 2.5, attack: 1, gain: 0.02, out: ambience.out }),
    drip: s => tone({ freq: semitone(s.root * 16, pick(PENTATONIC)), to: s.root * 8, dur: 0.12, gain: 0.03, out: ambience.out }),
    bubble: s => tone({ freq: s.root * 8, to: s.root * 24, dur: 0.18, gain: 0.025, out: ambience.out }),
    pluck: s => tone({ type: 'triangle', freq: semitone(s.root * 4, pick(PENTATONIC)), dur: 1.2, gain: 0.035, out: ambience.out }),
  };

  function loop(build, out) {
    const level = ctx.createGain();
    level.gain.value = 0;
    level.connect(out);
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
    const osc = ctx.createOscillator(), amount = ctx.createGain();
    osc.frequency.value = rate;
    amount.gain.value = depth;
    osc.connect(amount).connect(param);
    return osc;
  }

  const EMITTERS = {
    saw: out => { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 150; osc.connect(filtered('lowpass', 900, 2, out)); return [osc, lfo(18, 25, osc.frequency)]; },
    laser: out => [880, 887].map(f => { const osc = ctx.createOscillator(); osc.frequency.value = f; osc.connect(out); return osc; }),
    conveyor: out => { const src = noiseSource(); src.connect(filtered('bandpass', 450, 4, out)); return [src]; },
    mover: out => { const osc = ctx.createOscillator(); osc.frequency.value = 62; osc.connect(out); return [osc]; },
    wind: out => { const src = noiseSource(); const shape = filtered('highpass', 900, 0.7, out); src.connect(shape); return [src, lfo(0.4, 300, shape.frequency)]; },
    flood: out => { const src = noiseSource(); src.connect(filtered('lowpass', 140, 1, out)); return [src]; },
  };
  const EMITTER_GAIN = { saw: 0.05, laser: 0.035, conveyor: 0.12, mover: 0.08, wind: 0.12, flood: 0.3 };

  function emitter(type) {
    if (!emitters.has(type)) emitters.set(type, loop(EMITTERS[type], sfx));
    return emitters.get(type);
  }

  function setLevel(voice, value, smooth = 0.08) {
    voice.level.gain.setTargetAtTime(value, now(), smooth);
  }

  function startAmbience(theme) {
    const spec = AMBIENCE[theme];
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(amb);
    out.gain.setTargetAtTime(1, now(), 1.2);
    const drone = filtered('lowpass', spec.cutoff, 1, (() => { const g = ctx.createGain(); g.gain.value = 0.05; g.connect(out); return g; })());
    const nodes = [[1, 0], [1.5, 4], [2, -6]].map(([mult, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = spec.drone;
      osc.frequency.value = spec.root * mult;
      osc.detune.value = detune;
      osc.connect(drone);
      return osc;
    });
    nodes.push(lfo(0.07, spec.cutoff * 0.4, drone.frequency));
    if (spec.bed) {
      const level = ctx.createGain();
      level.gain.value = spec.bed.gain;
      level.connect(out);
      const shape = filtered(spec.bed.type, spec.bed.freq, 0.8, level);
      const src = noiseSource();
      src.connect(shape);
      nodes.push(src);
      if (spec.bed.sweep) nodes.push(lfo(0.13, spec.bed.freq * 0.6, shape.frequency));
    }
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
    wind ??= loop(out => { const src = noiseSource(); const shape = filtered('bandpass', 450, 0.5, out); src.connect(shape); return [src, lfo(0.09, 250, shape.frequency)]; }, amb);
    setLevel(wind, Math.min(0.14, (altitude / 1800) * 0.14), 1);
  }

  function updateEmitters(level, state) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2;
    const loudest = {};
    for (const o of level.objects) {
      if (!EMITTERS[o.type] || (o.type === 'laser' && !laserOn(o, state.clock))) continue;
      loudest[o.type] = Math.max(loudest[o.type] ?? 0, proximity(objectRect(o, state.clock), cx, cy));
    }
    const flood = floodLevel(level, state.clock);
    if (flood !== Infinity) loudest.flood = Math.max(0, 1 - Math.abs(flood - cy) / (EMITTER_RANGE * 2));
    for (const type of Object.keys(EMITTERS)) {
      if (!loudest[type] && !emitters.has(type)) continue;
      setLevel(emitter(type), (loudest[type] ?? 0) * EMITTER_GAIN[type]);
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
      jet ??= loop(out => { const src = noiseSource(); src.connect(filtered('bandpass', 700, 0.8, out)); return [src]; }, sfx);
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
