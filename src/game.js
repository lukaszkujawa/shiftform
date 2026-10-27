import { step, initialState, playerSize } from './physics.js';
import { replay } from './solver.js';
import { deserializeLevel } from './level.js';
import { createRenderer } from './render.js';

const FRAME_MS = 1000 / 60;
const DEATH_FRAMES = 36;
const WIN_FRAMES = 48;
const CONTROLS = '← → move   ·   Z / Space jump   ·   X dash   ·   R restart   ·   H hint   ·   N skip';

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash',
};

export function createGame(canvas, { seed, startLevel = 1, onLevelChange, onQuit }) {
  const renderer = createRenderer(canvas);
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  const levels = new Map();
  worker.onmessage = event => {
    const { index, level } = event.data;
    pending.get(index)?.(deserializeLevel(level));
    pending.delete(index);
  };

  function fetchLevel(index) {
    if (!levels.has(index)) {
      levels.set(index, new Promise(resolve => pending.set(index, resolve)));
      worker.postMessage({ seed, index });
    }
    return levels.get(index);
  }

  const keys = { left: false, right: false, jump: false, dash: false };
  const game = {
    level: null, s: null, phase: 'loading', phaseAge: 0, deaths: 0, solvedCount: 0,
    trail: [], particles: [], flash: 0, shake: 0, introAge: 0, jumpLatch: 0,
    ghostStates: null, ghostStart: 0, running: true, prevGravDir: 1,
  };
  let lastTime = performance.now();
  let accumulator = 0;

  async function loadLevel(index) {
    game.phase = 'loading';
    game.level = await fetchLevel(index);
    game.s = initialState(game.level);
    game.prevGravDir = game.s.gravDir;
    game.trail = [];
    game.particles = [];
    game.ghostStates = null;
    game.introAge = 0;
    game.phase = 'play';
    game.phaseAge = 0;
    onLevelChange?.(index);
    fetchLevel(index + 1);
  }

  function restart() {
    game.s = initialState(game.level);
    game.prevGravDir = game.s.gravDir;
    game.trail = [];
    game.phase = 'play';
    game.phaseAge = 0;
    game.ghostStart = 0;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 30 + Math.random() * 30, maxLife: 60, size: 3 + Math.random() * 4, color });
    }
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

  function currentInput() {
    const s = game.s;
    const input = { left: keys.left, right: keys.right, jump: keys.jump, dash: keys.dash };
    if (game.jumpLatch > 0) game.jumpLatch--;
    if (game.jumpLatch > 0 && keys.jump && s.jumpHeld && (s.grounded || s.coyote > 0)) {
      input.jump = false;
      game.jumpLatch = 1;
    }
    return input;
  }

  function tickPlay() {
    const { level } = game;
    const prev = game.s;
    const s = step(level, prev, currentInput());
    game.s = s;
    const palette = renderer.paletteFor(level);
    const { w, h } = playerSize(level.rules);
    if (s.frame % 3 === 0) {
      game.trail.push({ x: s.x, y: s.y });
      if (game.trail.length > 8) game.trail.shift();
    }
    if (s.gravDir !== game.prevGravDir) { game.flash = 0.35; game.prevGravDir = s.gravDir; }
    if (s.grounded && !prev.grounded && Math.abs(prev.vy) > 6) burst(s.x + w / 2, s.y + (s.gravDir > 0 ? h : 0), palette.dim, 6, 2);
    if (s.flags !== prev.flags) burst(s.x + w / 2, s.y + h / 2, palette.accent, 16, 3);
    if (s.dead) {
      game.deaths++;
      game.phase = 'dead';
      game.phaseAge = 0;
      game.shake = 10;
      burst(s.x + w / 2, s.y + h / 2, palette.player, 28, 5);
    } else if (s.won) {
      game.phase = 'won';
      game.phaseAge = 0;
      game.solvedCount++;
      burst(s.x + w / 2, s.y + h / 2, palette.accent, 40, 5);
    }
  }

  function tick() {
    tickParticles();
    game.introAge += FRAME_MS;
    game.phaseAge++;
    if (game.phase === 'play') tickPlay();
    else if (game.phase === 'dead' && game.phaseAge > DEATH_FRAMES) restart();
    else if (game.phase === 'won' && game.phaseAge > WIN_FRAMES) loadLevel(game.level.index + 1);
  }

  function ghostState() {
    if (!game.ghostStates) return null;
    const i = Math.min(game.ghostStates.length - 1, game.s.frame - game.ghostStart);
    return i >= 0 ? game.ghostStates[i] : null;
  }

  function render(time) {
    if (!game.level) return;
    renderer.draw({
      level: game.level, state: game.s, time, seed,
      ghost: ghostState(), trail: game.trail, particles: game.particles,
      flash: game.flash, shake: game.shake, deaths: game.deaths, solvedCount: game.solvedCount,
      introAge: game.introAge,
      message: game.phase === 'loading' ? 'generating…' : '',
      controlsHint: game.level.index <= 2 ? CONTROLS : '',
    });
    if (game.phase === 'won') renderer.drawTransition(Math.min(1, game.phaseAge / WIN_FRAMES), renderer.paletteFor(game.level));
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
    const action = KEYS[event.code];
    if (action) {
      keys[action] = true;
      if (action === 'jump') game.jumpLatch = 8;
      event.preventDefault();
      return;
    }
    if (!game.level) return;
    if (event.code === 'KeyR' && game.phase === 'play') restart();
    if (event.code === 'KeyH' && game.phase === 'play') {
      if (game.ghostStates) game.ghostStates = null;
      else { game.ghostStates = replay(game.level, game.level.solution); game.ghostStart = game.s.frame; }
    }
    if (event.code === 'KeyN' && game.phase === 'play') { game.phase = 'won'; game.phaseAge = 0; }
    if (event.code === 'Escape') { stop(); onQuit?.(); }
  }

  function onKeyUp(event) {
    const action = KEYS[event.code];
    if (action) keys[action] = false;
  }

  function stop() {
    game.running = false;
    worker.terminate();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', renderer.fit);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  renderer.fit();
  loadLevel(startLevel);
  requestAnimationFrame(frame);
  return { stop };
}
