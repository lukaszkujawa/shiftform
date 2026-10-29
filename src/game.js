import { initialState, playerSize, COMET_GATES } from './physics.js';
import { replay } from './solver.js';
import { deserializeLevel, levelIndex, objectRect, HEIGHT } from './level.js';
import { MAX_LIVES } from './climb.js';
import { createRun, advance, takesInput, hazardAt, canBuy } from './run.js';
import { codeOf, inputOf } from './ghost.js';
import { createRenderer, shopHit, inventoryHit } from './render.js';
import { COMBO_FROM, MILESTONES } from './combo.js';
import { TRICKS, PLACEABLE, buildAt } from './tricks.js';
import { createAudio } from './audio.js';
import { soundEvents } from './sounds.js';
import { themeFor } from './themes.js';
import { createAvatar, stepAvatar, cheer } from './avatar.js';
import { chatter } from './chatter.js';

const FRAME_MS = 1000 / 60;
const BIOMES_AHEAD = 2;
const CAMERA_LEAD = 0.55;
const CAMERA_EASE = 0.12;
const COMET_CAMERA_LEAD = 28;
const COMET_CAMERA_EASE = 0.2;
const HIT_STOP = { stomp: 5, death: 9, cometPerfect: 3, crush: 4, fanfare: 2 };
const COIN_COLOR = 'hsl(48 95% 60% / 1)';
const PHRASE_MS = 1600;
const TOAST_MS = 3200;
const TIP_MS = 6000;
const PLANNING = { fraction: 0, stage: 'drawing up a plan' };
const ITEM_TOASTS = {
  jetpack: 'Jetpack! Out of jumps? Jump again in mid-air and hold to fly.',
  boots: 'Spring boots: 5 extra mid-air jumps.',
  shield: 'Shield: the next hazard bounces you to safety.',
  heart: 'Heart: lives refilled.',
  comet: 'Comet! You fly up through platforms and bounce. Tap jump as you land to bounce higher; miss and it burns out.',
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

export function createGame(canvas, { seed, lives = MAX_LIVES, rival = null, onClimb, onOver, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const biomes = new Map();
  const building = new Map();
  const restingStates = new WeakMap();
  worker.onmessage = ({ data }) => {
    if (data.type === 'level') { biomes.set(data.index, deserializeLevel(data.level)); building.delete(data.index); }
    else building.set(data.index, { fraction: data.fraction, stage: data.stage });
  };
  const buildingView = (index, time) => ({ ...(building.get(index) ?? PLANNING), phrase: chatter(seed, index, Math.floor(time / PHRASE_MS)) });
  const restingState = level => restingStates.get(level) ?? restingStates.set(level, initialState(level)).get(level);
  let requested = -1;
  const request = (index, ahead = BIOMES_AHEAD) => {
    if (index + ahead <= requested) return;
    requested = index + ahead;
    worker.postMessage({ seed, upTo: requested });
  };

  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  const game = {
    run: createRun(lives), recording: { codes: [], acts: [] }, restart: false, pending: null, pointer: null, active: 0, building: false, ghost: null, ghostAt: 0, ghostActAt: 0, combo: null,
    camera: 0, best: loadBest(seed),
    trail: [], particles: [], flash: 0, shake: 0, freeze: 0, avatar: createAvatar(seed), bannerAge: 0, toast: null, moved: false,
    routeStates: null, routeStart: 0, running: true, prevGravDir: 1, prevClock: 0,
  };
  let lastTime = performance.now();
  let accumulator = 0;

  function announce(level) {
    const theme = themeFor(level).id;
    audio.setBiome(theme);
    audio.play({ type: 'biome', theme });
  }

  function newClimb() {
    Object.assign(game, { run: createRun(lives), recording: { codes: [], acts: [] }, restart: false, pending: null, active: 0, building: false, ghost: rival && createRun(lives), ghostAt: 0, ghostActAt: 0, combo: null, trail: [], particles: [], freeze: 0, avatar: createAvatar(seed), routeStates: null, moved: false });
    onClimb?.();
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 30 + Math.random() * 30, maxLife: 60, size: 3 + Math.random() * 4, color });
    }
  }

  function puff(dust, color) {
    game.particles.push({ ...dust, life: 22, maxLife: 22, color, puff: true });
  }

  function collected(kind) {
    if (kind === 'comet') request(game.run.index, BIOMES_AHEAD + COMET_GATES);
    game.toast = { kind, text: ITEM_TOASTS[kind], age: 0, ms: TOAST_MS };
    game.flash = 0.25;
  }

  function tip(level, stretch) {
    const text = level.tips?.[stretch];
    if (text) game.toast = { kind: null, text, age: 0, ms: TIP_MS };
  }

  function comboed(s, w, h, palette) {
    const { links } = game.run.combo;
    const word = MILESTONES[links];
    game.combo = { links, age: 0, word: word ?? game.combo?.word ?? null, wordAge: word ? 0 : (game.combo?.wordAge ?? 999) };
    if (links < COMBO_FROM) return;
    cheer(game.avatar);
    if (!word) { audio.play({ type: 'combo', links }); return; }
    audio.play({ type: 'fanfare', links });
    game.freeze = Math.max(game.freeze, HIT_STOP.fanfare);
    game.flash = 0.15;
    burst(s.x + w / 2, s.y + h / 2, palette.accent, 18 + links * 2, 4);
  }

  function tickParticles() {
    for (const p of game.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.puff) { p.vx *= 0.9; p.vy *= 0.9; p.size += 0.18; } else { p.vx *= 0.96; p.vy += 0.25; }
      p.life--;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    game.flash = Math.max(0, game.flash - 0.04);
    game.shake = Math.max(0, game.shake - 0.6);
  }

  function tickCamera() {
    const { level, s, index, below } = game.run;
    const low = biomes.has(index + 1) ? -HEIGHT / 2 : 0;
    const high = level.height - HEIGHT + (below ? HEIGHT / 2 : 0);
    const falling = s.comet ? Math.max(0, s.vy * s.gravDir) * COMET_CAMERA_LEAD * s.gravDir : 0;
    const target = Math.max(low, Math.min(high, s.y - HEIGHT * CAMERA_LEAD + falling));
    game.camera += (target - game.camera) * (s.comet ? COMET_CAMERA_EASE : CAMERA_EASE);
  }

  function stepped({ level, prev, s, checkpoint }) {
    game.prevClock = prev.clock;
    const palette = renderer.paletteFor(level);
    const { w, h } = playerSize(level.rules);
    const events = soundEvents(level, prev, s);
    for (const dust of stepAvatar(game.avatar, level, prev, s, events)) puff(dust, palette.dim);
    for (const event of events) {
      audio.play(event);
      game.freeze = Math.max(game.freeze, HIT_STOP[event.type] ?? 0);
      if (event.type === 'item') collected(event.kind);
      if (event.type === 'stomp') game.shake = 4;
      if (event.type === 'kick') burst(s.x + (event.side > 0 ? w : 0), s.y + h * 0.8, palette.dim, 8, 2);
      if (event.type === 'coin') burst(s.x + w / 2, s.y + h / 3, COIN_COLOR, 8, 2);
    }
    if (game.run.combo.gained) comboed(s, w, h, palette);
    if (game.combo) { game.combo.age++; game.combo.wordAge++; }
    if (s.frame % 3 === 0) {
      game.trail.push({ x: s.x, y: s.y });
      if (game.trail.length > 8 + Math.round(8 * s.charge)) game.trail.shift();
    }
    if (s.gravDir !== game.prevGravDir) { game.flash = 0.35; game.prevGravDir = s.gravDir; }
    if (s.flags !== prev.flags) burst(s.x + w / 2, s.y + h / 2, palette.accent, 16, 3);
    const freshlyCrushed = s.crushed & ~prev.crushed;
    for (const [object, bit] of levelIndex(level).crushBit) {
      if (!(freshlyCrushed & bit)) continue;
      const rect = objectRect(object, s.clock);
      game.shake = 6;
      burst(rect.x + rect.w / 2, rect.y + rect.h / 2, palette.hazard, 20, 4);
    }
    if (checkpoint) {
      tip(level, game.run.touched.length);
      cheer(game.avatar);
      game.flash = 0.2;
      audio.play({ type: 'checkpoint' });
      burst(s.x + w / 2, s.y + h / 2, palette.accent, 30, 4);
    }
    if (game.run.peak > game.best) {
      game.best = game.run.peak;
      if (s.frame % 30 === 0) saveBest(seed, game.best);
    }
    if (s.dead) {
      game.shake = 10;
      burst(s.x + w / 2, s.y + h / 2, palette.player, 28, 5);
    }
  }

  function react(event) {
    if (!event) return;
    const { run } = game;
    if (event.type === 'begin') {
      announce(event.level);
      game.camera = event.level.height - HEIGHT;
      game.prevGravDir = run.s.gravDir;
      game.bannerAge = 0;
      tip(event.level, 0);
    } else if (event.type === 'step') {
      stepped(event);
      react(event.entered);
    } else if (event.type === 'enter') {
      game.camera += event.level.height;
      game.trail = game.trail.map(t => ({ x: t.x, y: t.y + event.level.height }));
      announce(event.level);
      game.routeStates = null;
      game.bannerAge = 0;
      game.prevGravDir = run.s.gravDir;
      request(run.index);
    } else if (event.type === 'restore') {
      game.prevGravDir = run.s.gravDir;
      game.avatar = createAvatar(seed);
      game.trail = [];
      game.routeStates = null;
    } else if (event.type === 'chosen') {
      if (event.kind) { audio.play({ type: 'pick' }); game.toast = { kind: ITEM_TOASTS[event.kind] ? event.kind : null, text: `${TRICKS[event.kind].title}: ${TRICKS[event.kind].text}`, age: 0, ms: TIP_MS }; }
    } else if (event.type === 'planted' || event.type === 'placed' || event.type === 'erased') {
      if (!run.tricks.length) game.building = false;
      game.active = Math.min(game.active, Math.max(0, ownedKinds().length - 1));
    }
    if (event.type === 'planted') {
      audio.play({ type: 'checkpoint' });
      burst(event.flag.x + 12, event.flag.y + 20, renderer.paletteFor(run.level).accent, 24, 4);
    } else if (event.type === 'placed') {
      audio.play({ type: 'place' });
      burst(event.rect.x + event.rect.w / 2, event.rect.y + event.rect.h / 2, renderer.paletteFor(run.level).accent, 14, 3);
    } else if (event.type === 'erased') {
      const rect = objectRect(event.object, run.s.clock);
      audio.play({ type: 'erase' });
      game.shake = 4;
      burst(rect.x + rect.w / 2, rect.y + rect.h / 2, renderer.paletteFor(run.level).hazard, 20, 4);
    } else if (event.type === 'over') {
      saveBest(seed, game.best);
      audio.play({ type: 'gameOver' });
      onOver?.({ metres: run.peak, best: game.best, deaths: run.deaths, points: run.points, path: run.path, recording: game.recording });
    }
  }

  const actOf = pending => pending.pick !== undefined ? { type: 'pick', value: pending.pick } : pending.place ? { type: 'place', ...pending.place } : pending.flag ? { type: 'flag' } : { type: 'erase', id: pending.erase };
  const inputOfAct = act => act.type === 'pick' ? { pick: act.value } : act.type === 'place' ? { place: { kind: act.kind, x: act.x, y: act.y } } : act.type === 'flag' ? { flag: true } : { erase: act.id };

  function tickGhost() {
    const ghost = game.ghost;
    if (!ghost || ghost.phase === 'over') return;
    if (!takesInput(ghost)) { advance(ghost, biomes); return; }
    const act = rival.acts[game.ghostActAt];
    if (act && act.at === game.ghostAt) { game.ghostActAt++; advance(ghost, biomes, inputOfAct(act)); return; }
    if (ghost.phase === 'choose') { advance(ghost, biomes, { pick: 0 }); return; }
    if (game.ghostAt >= rival.codes.length) { ghost.phase = 'over'; return; }
    advance(ghost, biomes, inputOf(rival.codes[game.ghostAt++]));
    request(ghost.index);
  }

  function tick() {
    if (game.freeze > 0) { game.freeze--; return; }
    tickParticles();
    game.moved ||= Object.values(keys).some(Boolean);
    if (game.moved || game.run.index > 0) game.bannerAge += FRAME_MS;
    if (game.toast) game.toast.age += FRAME_MS;
    const { run } = game;
    if (game.pending && takesInput(run)) {
      const pending = game.pending;
      game.pending = null;
      const result = advance(run, biomes, pending);
      if (result) { game.recording.acts.push({ at: game.recording.codes.length, ...actOf(pending) }); react(result); }
    } else if (run.phase === 'play') {
      const input = { ...keys, restart: game.restart };
      game.restart = false;
      game.recording.codes.push(codeOf(input));
      react(advance(run, biomes, input));
    } else {
      react(advance(run, biomes));
    }
    tickGhost();
    if (run.level) {
      tickCamera();
      audio.update({ level: run.level, state: run.s, altitude: run.altitude });
    }
  }

  function routeState() {
    if (!game.routeStates) return null;
    const i = Math.min(game.routeStates.length - 1, game.run.s.frame - game.routeStart);
    return i >= 0 ? game.routeStates[i] : null;
  }

  function toggleRoute() {
    if (game.routeStates) { game.routeStates = null; return; }
    const { level, touched, s } = game.run;
    const segment = level.segments[Math.min(touched.length, level.segments.length - 1)];
    game.routeStates = replay(level, segment.inputs, segment.start);
    game.routeStart = s.frame;
  }

  function rivalView() {
    const ghost = game.ghost;
    if (!ghost?.level) return null;
    return { index: ghost.index, state: ghost.phase === 'play' ? ghost.s : null, altitude: ghost.peak, done: ghost.phase === 'over' };
  }

  const ownedKinds = () => [...new Set(game.run.tricks)];
  const activeTrick = () => ownedKinds()[game.active % Math.max(1, ownedKinds().length)] ?? null;

  function inventoryView() {
    const kinds = ownedKinds();
    return { kinds, counts: kinds.map(kind => game.run.tricks.filter(t => t === kind).length), active: game.building ? activeTrick() : null };
  }

  function aim() {
    const { run } = game;
    const kind = activeTrick();
    if (!game.building || !kind || !game.pointer || run.phase !== 'play') return null;
    const x = game.pointer.x, y = game.pointer.y + game.camera;
    if (kind === 'erase') return { kind, object: hazardAt(run.level, run.s, x, y), x, y };
    if (kind === 'flag') return { kind, ok: run.s.grounded, x, y };
    return { kind, rect: buildAt(run.level, run.s, kind, x, y), x, y };
  }

  function render(time) {
    const { run } = game;
    if (!run.level) {
      renderer.drawLoading(buildingView(0, time));
      return;
    }
    const above = biomes.get(run.index + 1);
    renderer.draw({
      level: run.level, state: run.s, time, seed, camera: game.camera,
      below: run.below, above: above && { level: above, state: restingState(above) },
      ghost: routeState(), rival: rivalView(), trail: game.trail, particles: game.particles,
      flash: game.flash, shake: game.shake, lives: run.lives, maxLives: run.maxLives, over: run.phase === 'over',
      altitude: run.altitude, best: game.best, biomeIndex: run.index, bannerAge: game.bannerAge, touched: run.touched.map(t => t.id),
      frozen: run.level.rules.superhot && run.phase === 'play' && run.s.clock === game.prevClock,
      building: run.phase === 'gate' ? buildingView(run.index + 1, time) : null,
      keys, muted: audio.muted, toast: game.toast, avatar: game.avatar,
      points: run.points, combo: { links: run.combo.links, floor: run.combo.floor, pop: game.combo }, aim: aim(), doubled: run.doubled === run.index,
      shop: run.phase === 'choose' ? { offer: run.offer, bought: run.bought, affordable: run.offer.map(kind => canBuy(run, kind)) } : null,
      inventory: inventoryView(), planted: run.touched.filter(t => t.flag).map(t => t.flag),
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
    if (event.code === 'Escape') { stop(); onQuit?.(); return; }
    const over = game.run.phase === 'over';
    if (over && event.code === 'KeyR') { newClimb(); return; }
    if (event.target.closest?.('button, input')) return;
    audio.resume();
    if (event.code === 'KeyM') { audio.toggleMute(); return; }
    const action = KEYS[event.code];
    if (action) {
      for (const name of [action].flat()) keys[name] = true;
      event.preventDefault();
      return;
    }
    if (over && event.code === 'Enter') newClimb();
    if (game.run.phase === 'choose') {
      const pick = { Digit1: 1, Digit2: 2, Digit3: 3, Enter: 0, Space: 0 }[event.code];
      if (pick !== undefined) game.pending = { pick };
      return;
    }
    if (game.run.phase !== 'play') return;
    if (event.code === 'KeyB' && game.run.tricks.length) { game.building = !game.building; return; }
    if (event.code === 'Tab' && game.building) { game.active = (game.active + 1) % ownedKinds().length; event.preventDefault(); return; }
    if (event.code === 'KeyR') game.restart = true;
    if (event.code === 'KeyH') toggleRoute();
  }

  function onPointerMove(event) {
    game.pointer = event.type === 'pointerleave' ? null : renderer.pointer(event);
  }

  function onClick(event) {
    const { run } = game;
    const at = renderer.pointer(event);
    if (run.phase === 'choose') { const hit = shopHit(at.x, at.y); if (hit !== null) game.pending = { pick: hit }; return; }
    const slot = inventoryHit(at.x, at.y, ownedKinds().length);
    if (slot !== null) { game.active = slot; game.building = true; return; }
    const target = aim();
    if (!target) return;
    if (target.kind === 'erase' && target.object) game.pending = { erase: target.object.id };
    else if (target.kind === 'flag' && target.ok) game.pending = { flag: true };
    else if (target.rect) game.pending = { place: { kind: PLACEABLE.indexOf(target.kind), x: target.x, y: target.y } };
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
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerMove);
    canvas.removeEventListener('click', onClick);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerMove);
  canvas.addEventListener('click', onClick);
  renderer.fit();
  newClimb();
  request(0);
  requestAnimationFrame(frame);
  return { stop, restart: newClimb };
}
