import { step, initialState, playerSize } from './physics.js';
import { replay } from './solver.js';
import { deserializeLevel, levelIndex, objectRect, HEIGHT } from './level.js';
import { touchCheckpoints, respawn, enterBiome, altitudeMetres, MAX_LIVES, livesAfterDeath, livesAfterBiome } from './climb.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { soundEvents } from './sounds.js';
import { themeFor } from './themes.js';

const FRAME_MS = 1000 / 60;
const DEATH_FRAMES = 36;
const BIOMES_AHEAD = 2;
const CAMERA_LEAD = 0.55;
const CAMERA_EASE = 0.12;
const ITEM_TOASTS = {
  jetpack: 'Jetpack! Out of jumps? Jump again in mid-air and hold to fly.',
  boots: 'Spring boots: 5 extra mid-air jumps.',
  shield: 'Shield: the next hazard bounces you to safety.',
  heart: 'Heart: lives refilled.',
};

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash',
  KeyF: 'interact',
};

function loadBest(seed) {
  try { return Number(localStorage.getItem(`shiftform:best:${seed}`)) || 0; } catch { return 0; }
}

function saveBest(seed, metres) {
  try { localStorage.setItem(`shiftform:best:${seed}`, String(metres)); } catch {}
}

export function createGame(canvas, { seed, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const biomes = new Map();
  worker.onmessage = event => biomes.set(event.data.index, deserializeLevel(event.data.level));
  const request = index => worker.postMessage({ seed, upTo: index + BIOMES_AHEAD });

  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  const game = {
    index: 0, level: null, s: null, below: null, touched: [], camera: 0,
    phase: 'loading', phaseAge: 0, lives: MAX_LIVES, best: loadBest(seed), altitude: 0,
    trail: [], particles: [], flash: 0, shake: 0, bannerAge: 0, toast: null,
    ghostStates: null, ghostStart: 0, running: true, prevGravDir: 1, prevClock: 0,
  };
  let lastTime = performance.now();
  let accumulator = 0;

  function announce(level) {
    const theme = themeFor(level).id;
    audio.setBiome(theme);
    audio.play({ type: 'biome', theme });
  }

  function begin(level) {
    announce(level);
    game.level = level;
    game.s = initialState(level);
    game.camera = level.height - HEIGHT;
    game.prevGravDir = game.s.gravDir;
    game.bannerAge = 0;
    game.phase = 'play';
  }

  function newClimb() {
    game.index = 0;
    game.below = null;
    game.touched = [];
    game.lives = MAX_LIVES;
    game.trail = [];
    game.particles = [];
    game.ghostStates = null;
    begin(biomes.get(0));
  }

  function enterNext() {
    const next = biomes.get(game.index + 1);
    if (!next) return false;
    game.lives = livesAfterBiome(game.lives);
    game.below = { level: game.level, state: game.s };
    game.s = enterBiome(game.level, game.s, next);
    game.camera += next.height;
    game.trail = game.trail.map(t => ({ x: t.x, y: t.y + next.height }));
    game.level = next;
    game.index++;
    announce(next);
    game.touched = [];
    game.ghostStates = null;
    game.bannerAge = 0;
    game.prevGravDir = game.s.gravDir;
    game.phase = 'play';
    request(game.index);
    return true;
  }

  function restore() {
    game.s = respawn(game.level, game.s, game.touched);
    game.prevGravDir = game.s.gravDir;
    game.trail = [];
    game.ghostStates = null;
    game.phase = 'play';
    game.phaseAge = 0;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 30 + Math.random() * 30, maxLife: 60, size: 3 + Math.random() * 4, color });
    }
  }

  function collected(kind) {
    if (kind === 'heart') game.lives = MAX_LIVES;
    game.toast = { kind, text: ITEM_TOASTS[kind], age: 0 };
    game.flash = 0.25;
  }

  function tickParticles() {
    for (const p of game.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.vx *= 0.96;
      p.life--;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    game.flash = Math.max(0, game.flash - 0.04);
    game.shake = Math.max(0, game.shake - 0.6);
  }

  function tickCamera() {
    const { level, s } = game;
    const low = biomes.has(game.index + 1) ? -HEIGHT / 2 : 0;
    const high = level.height - HEIGHT + (game.below ? HEIGHT / 2 : 0);
    const target = Math.max(low, Math.min(high, s.y - HEIGHT * CAMERA_LEAD));
    game.camera += (target - game.camera) * CAMERA_EASE;
  }

  function tickPlay() {
    const { level } = game;
    const prev = game.s;
    const s = step(level, prev, { ...keys });
    game.s = s;
    game.prevClock = prev.clock;
    const palette = renderer.paletteFor(level);
    const { w, h } = playerSize(level.rules);
    for (const event of soundEvents(level, prev, s)) {
      audio.play(event);
      if (event.type === 'item') collected(event.kind);
      if (event.type === 'kick') burst(s.x + (event.side > 0 ? w : 0), s.y + h * 0.8, palette.dim, 8, 2);
    }
    if (s.frame % 3 === 0) {
      game.trail.push({ x: s.x, y: s.y });
      if (game.trail.length > 8 + Math.round(8 * s.charge)) game.trail.shift();
    }
    if (s.gravDir !== game.prevGravDir) { game.flash = 0.35; game.prevGravDir = s.gravDir; }
    if (s.grounded && !prev.grounded && Math.abs(prev.vy) > 6) burst(s.x + w / 2, s.y + (s.gravDir > 0 ? h : 0), palette.dim, 6, 2);
    if (s.flags !== prev.flags) burst(s.x + w / 2, s.y + h / 2, palette.accent, 16, 3);
    const freshlyCrushed = s.crushed & ~prev.crushed;
    for (const [object, bit] of levelIndex(level).crushBit) {
      if (!(freshlyCrushed & bit)) continue;
      const rect = objectRect(object, s.clock);
      game.shake = 6;
      burst(rect.x + rect.w / 2, rect.y + rect.h / 2, palette.hazard, 20, 4);
    }
    const touched = touchCheckpoints(level, s, game.touched);
    if (touched !== game.touched) {
      game.touched = touched;
      game.flash = 0.2;
      audio.play({ type: 'checkpoint' });
      burst(s.x + w / 2, s.y + h / 2, palette.accent, 30, 4);
    }
    game.altitude = altitudeMetres(game.index, level, s);
    if (game.altitude > game.best) {
      game.best = game.altitude;
      if (s.frame % 30 === 0) saveBest(seed, game.best);
    }
    if (s.dead) {
      game.lives = livesAfterDeath(game.lives);
      game.phase = 'dead';
      game.phaseAge = 0;
      game.shake = 10;
      burst(s.x + w / 2, s.y + h / 2, palette.player, 28, 5);
    } else if (s.won && !enterNext()) {
      game.phase = 'gate';
    }
  }

  function tick() {
    tickParticles();
    game.phaseAge++;
    game.bannerAge += FRAME_MS;
    if (game.toast) game.toast.age += FRAME_MS;
    if (game.phase === 'loading' && biomes.has(0)) begin(biomes.get(0));
    else if (game.phase === 'play') tickPlay();
    else if (game.phase === 'dead' && game.phaseAge > DEATH_FRAMES) {
      if (game.lives > 0) restore();
      else { game.phase = 'over'; saveBest(seed, game.best); audio.play({ type: 'gameOver' }); }
    }
    else if (game.phase === 'gate') enterNext();
    if (game.level) {
      tickCamera();
      audio.update({ level: game.level, state: game.s, altitude: game.altitude });
    }
  }

  function ghostState() {
    if (!game.ghostStates) return null;
    const i = Math.min(game.ghostStates.length - 1, game.s.frame - game.ghostStart);
    return i >= 0 ? game.ghostStates[i] : null;
  }

  function toggleGhost() {
    if (game.ghostStates) { game.ghostStates = null; return; }
    const segment = game.level.segments[Math.min(game.touched.length, game.level.segments.length - 1)];
    game.ghostStates = replay(game.level, segment.inputs, segment.start);
    game.ghostStart = game.s.frame;
  }

  function render(time) {
    if (!game.level) {
      renderer.drawLoading();
      return;
    }
    const above = biomes.get(game.index + 1);
    renderer.draw({
      level: game.level, state: game.s, time, seed, camera: game.camera,
      below: game.below, above: above && { level: above, state: initialState(above) },
      ghost: ghostState(), trail: game.trail, particles: game.particles,
      flash: game.flash, shake: game.shake, lives: game.lives, over: game.phase === 'over',
      altitude: game.altitude, best: game.best, biomeIndex: game.index, bannerAge: game.bannerAge, touched: game.touched.map(t => t.id),
      frozen: game.level.rules.superhot && game.phase === 'play' && game.s.clock === game.prevClock,
      message: game.phase === 'gate' ? 'generating the next biome…' : '',
      keys, muted: audio.muted, toast: game.toast,
    });
  }

  function frame(now) {
    if (!game.running) return;
    accumulator += Math.min(100, now - lastTime);
    lastTime = now;
    while (accumulator >= FRAME_MS) {
      tick();
      accumulator -= FRAME_MS;
    }
    render(now);
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    audio.resume();
    if (event.code === 'KeyM') { audio.toggleMute(); return; }
    const action = KEYS[event.code];
    if (action) {
      for (const name of [action].flat()) keys[name] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Escape') { stop(); onQuit?.(); }
    if (game.phase === 'over' && (event.code === 'Enter' || event.code === 'KeyR')) newClimb();
    if (game.phase !== 'play') return;
    if (event.code === 'KeyR') restore();
    if (event.code === 'KeyH') toggleGhost();
  }

  function onKeyUp(event) {
    const action = KEYS[event.code];
    if (action) for (const name of [action].flat()) keys[name] = false;
  }

  function stop() {
    game.running = false;
    saveBest(seed, game.best);
    audio.stop();
    worker.terminate();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', renderer.fit);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  renderer.fit();
  request(0);
  requestAnimationFrame(frame);
  return { stop };
}
