import { floodLevel } from './level.js?v=b723367';
import { playerSize } from './physics.js?v=b723367';
import { createMusic, moodOf, UNDERPASS } from './music.js?v=b723367';

const MASTER_VOLUME = 0.6;
const MUSIC_VOLUME = 0.32;
const FLOOD_RANGE = 640;
const FLOOD_GAIN = 0.3;
const MUTE_KEY = 'shiftform:muted';
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];
const COMBO_JUMP_STEPS = [0, 4, 7];

const semitone = (root, n) => root * 2 ** (n / 12);

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function saveMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

export function createAudio() {
  let ctx = null, music = null, worldMood = null, master, sfx, noise, flood = null, scrape = null, scrapeShape = null, pushed = null, jet = null;
  let muted = loadMuted();
  const now = () => ctx.currentTime;
  const followVisibility = () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); music.pause(); } else { ctx.resume(); music.resume(); }
  };
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
      music = createMusic(ctx, gain(MUSIC_VOLUME, master));
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
    barrelIn: () => { tone({ type: 'triangle', freq: 180, to: 110, dur: 0.1, gain: 0.12 }); hiss({ freq: 900, q: 2, dur: 0.05, gain: 0.08 }); },
    cannon: () => { hiss({ filter: 'lowpass', freq: 1400, to: 200, dur: 0.3, gain: 0.3 }); tone({ freq: 120, to: 50, dur: 0.25, gain: 0.22 }); },
    jump: e => {
      const f = semitone(240, COMBO_JUMP_STEPS[Math.min(COMBO_JUMP_STEPS.length - 1, e.links ?? 0)]);
      tone({ type: 'square', freq: f, to: f * 2, dur: 0.12, gain: 0.04 });
      tone({ type: 'triangle', freq: f * 2, to: f * 4, dur: 0.1, gain: 0.05 });
    },
    longJump: () => {
      tone({ type: 'square', freq: 300, to: 1200, dur: 0.2, gain: 0.04 });
      tone({ type: 'triangle', freq: 600, to: 2400, dur: 0.22, gain: 0.06 });
      hiss({ freq: 1200, to: 4200, q: 0.8, dur: 0.28, gain: 0.12 });
      bell(semitone(659, 7), 0.05, 0.6, 0.1);
    },
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
    refill: () => { tone({ type: 'triangle', freq: 880, to: 1760, dur: 0.12, gain: 0.07 }); tone({ type: 'sine', freq: 1320, dur: 0.2, gain: 0.05, delay: 0.06 }); },
    timer: () => { tone({ type: 'square', freq: 520, dur: 0.06, gain: 0.05 }); tone({ type: 'square', freq: 780, dur: 0.06, gain: 0.05, delay: 0.08 }); },
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
    blast: () => { hiss({ filter: 'lowpass', freq: 900, dur: 0.5, gain: 0.35 }); tone({ type: 'sawtooth', freq: 70, dur: 0.35, gain: 0.2 }); },
    growl: () => tone({ type: 'sawtooth', freq: 110, dur: 0.16, gain: 0.05 }),
    shieldBack: () => [0, 7].forEach((n, i) => bell(semitone(880, n), 0.05, 0.6, i * 0.07)),
    checkpoint: () => [0, 4, 7, 12].forEach((n, i) => bell(semitone(523, n), 0.07, 1.2, i * 0.07)),
    coin: () => { tone({ type: 'triangle', freq: 1760, dur: 0.07, gain: 0.05 }); tone({ type: 'triangle', freq: 2349, dur: 0.14, gain: 0.05, delay: 0.06 }); },
    combo: e => { const f = semitone(523, PENTATONIC[Math.min(PENTATONIC.length - 1, e.links - 2)]); tone({ type: 'triangle', freq: f, to: f * 1.5, dur: 0.14, gain: 0.07 }); },
    fanfare: e => [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, Math.floor(e.links / 8))).forEach((n, i) => bell(semitone(659, n), 0.07, 0.9, i * 0.07)),
    pick: () => [0, 7, 12].forEach((n, i) => tone({ type: 'triangle', freq: semitone(440, n), dur: 0.2, gain: 0.07, delay: i * 0.06 })),
    place: () => { hiss({ filter: 'lowpass', freq: 700, dur: 0.12, gain: 0.25 }); tone({ freq: 160, to: 110, dur: 0.14, gain: 0.15 }); },
    erase: () => { hiss({ filter: 'highpass', freq: 2500, to: 400, dur: 0.35, gain: 0.18 }); tone({ type: 'square', freq: 500, to: 60, dur: 0.3, gain: 0.05 }); },
    gameOver: () => [12, 7, 3, 0].forEach((n, i) => tone({ type: 'triangle', freq: semitone(196, n), dur: 0.6, gain: 0.08, delay: i * 0.18 })),
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

  const noiseLoop = (type, freq, q) => out => {
    const src = noiseSource();
    src.connect(filtered(type, freq, q, out));
    return [src];
  };

  function setLevel(voice, value, smooth = 0.08) {
    if (Math.abs(value - (voice.target ?? -1)) < 1e-3) return;
    voice.target = value;
    voice.level.gain.setTargetAtTime(value, now(), smooth);
  }

  function updateFlood(level, state) {
    const water = floodLevel(level, state.tide);
    if (water === Infinity && !flood) return;
    flood ??= loop(noiseLoop('lowpass', 140, 1), sfx);
    const cy = state.y + playerSize(level.rules).h / 2;
    setLevel(flood, water === Infinity ? 0 : Math.max(0, 1 - Math.abs(water - cy) / FLOOD_RANGE) * FLOOD_GAIN);
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
      worldMood = moodOf(theme);
    },
    update({ level, state }) {
      if (!ctx) return;
      if (worldMood) music.setMood(level.hall ? UNDERPASS : worldMood);
      jet ??= loop(noiseLoop('bandpass', 700, 0.8), sfx);
      setLevel(jet, state.jetting ? 0.16 : 0, 0.04);
      updateFlood(level, state);
      updateScrape();
    },
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, now(), 0.05);
      return muted;
    },
    get muted() { return muted; },
    get music() { return music?.status ?? null; },
    stop() {
      document.removeEventListener('visibilitychange', followVisibility);
      music?.stop();
      ctx?.close();
      ctx = null;
      music = null;
      worldMood = null;
      flood = null;
      scrape = null;
      jet = null;
    },
  };
}
