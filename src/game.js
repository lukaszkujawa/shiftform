import { initialState, playerSize, blinkDestination } from './physics.js';
import { replay } from './solver.js';
import { deserializeLevel, levelIndex, objectRect, HEIGHT, TILE, CLOCK_PERIOD, wrap } from './level.js';
import { MAX_LIVES } from './climb.js';
import { createRun, advance, takesInput, hazardAt, canBuy, currentRules, stallOf, shopOffer, swapPrice, outfitterOffer, canEquip, gearPrice, canReroll, wantedBiome, wantedChain, nextBiome, biomeOf } from './run.js';
import { swapOptions, RUNES_PER_BIOME } from './rulesmith.js';
import { replacedBy, lightOf } from './outfitter.js';
import { MUTATORS, biomeKey, isPerk } from './rules.js';
import { codeOf, inputOf } from './ghost.js';
import { createRenderer, promptHit, inventoryHit, gearHit } from './render.js';
import { stallHit } from './stall-ui.js';
import { MERCHANT, OUTFITTER, DICER } from './tunnel.js';
import { COMBO_FROM, MILESTONES } from './combo.js';
import { TRICKS, PLACEABLE, buildAt } from './tricks.js';
import { KINDS } from './items.js';
import { createAudio } from './audio.js';
import { soundEvents } from './sounds.js';
import { themeFor } from './themes.js';
import { createAvatar, stepAvatar, cheer, wear } from './avatar.js';
import { homeOf, atWardrobe } from './home.js';
import { loadOutfit, saveOutfit, openWardrobe, browse, shuffle, wardrobeHit } from './wardrobe.js';
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
const LEVEL_UP_MS = 5200;
const TIP_MS = 6000;
const COME_BACK = "Come back when you're more experienced.";
const PLANNING = { fraction: 0, stage: 'drawing up a plan' };
const isItem = kind => KINDS.some(([k]) => k === kind);
const cardText = kind => `${TRICKS[kind].title}: ${TRICKS[kind].text}`;

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash',
  KeyF: 'interact',
};
const MENU_MOVES = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
const WARDROBE_CLOSE = new Set(['Enter', 'Escape', 'KeyF', 'Space', 'KeyZ']);
const TOUCH_WARDROBE = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', interact: 'KeyF', dash: 'Enter' };

function loadBest(seed) {
  try { return Number(localStorage.getItem(`shiftform:best:${seed}`)) || 0; } catch { return 0; }
}

function saveBest(seed, metres) {
  try { localStorage.setItem(`shiftform:best:${seed}`, String(metres)); } catch {}
}

export function createGame(canvas, { seed, lives = MAX_LIVES, rival = null, notice = null, onClimb, onOver, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const made = new Map();
  const building = new Map();
  const restingStates = new WeakMap();
  worker.onmessage = ({ data }) => {
    if (data.type === 'level') { made.set(data.key, deserializeLevel(data.level)); building.delete(data.key); }
    else building.set(data.key, { fraction: data.fraction, stage: data.stage });
  };
  const keyOf = want => biomeKey(want.index, want.entryCol, want.rules);
  const biomes = want => made.get(keyOf(want)) ?? null;
  const buildingView = (want, time) => ({ ...(building.get(keyOf(want)) ?? PLANNING), phrase: chatter(seed, want.index, Math.floor(time / PHRASE_MS)) });
  const restingState = level => restingStates.get(level) ?? restingStates.set(level, initialState(level)).get(level);
  const posted = {};
  function request(lane, run) {
    if (!run || run.phase === 'over') return;
    const job = { lane, seed, ...wantedChain(run, BIOMES_AHEAD) }, text = JSON.stringify(job);
    if (posted[lane] === text) return;
    posted[lane] = text;
    worker.postMessage(job);
  }

  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
  const game = {
    run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, quitting: false, pending: null, pointer: null, giving: null, active: 0, building: false, ghost: null, ghostAt: 0, ghostActAt: 0, combo: null,
    camera: 0, best: loadBest(seed),
    trail: [], particles: [], flash: 0, shake: 0, freeze: 0, avatar: createAvatar(seed, loadOutfit()), bannerAge: 0, toast: null, moved: false,
    routeStates: null, routeOffset: 0, routeIndex: 0, running: true, prevGravDir: 1, prevClock: 0, notice,
  };
  let lastTime = performance.now();
  let accumulator = 0;

  function announce(level) {
    const theme = themeFor(level).id;
    audio.setBiome(theme);
    audio.play({ type: 'biome', theme });
  }

  function newClimb() {
    Object.assign(game, { run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, quitting: false, pending: null, active: 0, building: false, ghost: rival && createRun(lives, seed), ghostAt: 0, ghostActAt: 0, combo: null, trail: [], particles: [], freeze: 0, avatar: createAvatar(seed, loadOutfit()), routeStates: null, moved: false, dressing: null, levelUp: null });
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
    game.toast = { kind, text: cardText(kind), age: 0, ms: TOAST_MS };
    game.flash = 0.25;
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
    const { level, s, below } = game.run;
    const low = !game.run.hall && nextBiome(game.run, biomes) ? -HEIGHT / 2 : 0;
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
      game.levelUp = { ids: event.unlocked, runes: RUNES_PER_BIOME, age: 0, ms: LEVEL_UP_MS };
      audio.play({ type: 'fanfare', links: event.unlocked.length ? 16 : 8 });
      if (event.lucky) audio.play({ type: 'item' });
    } else if (event.type === 'underpass' || event.type === 'surface') {
      game.camera = event.level.height - HEIGHT;
      game.trail = [];
      game.routeStates = null;
      game.prevGravDir = run.s.gravDir;
      audio.play({ type: 'portal' });
    } else if (event.type === 'rerolled') {
      audio.play({ type: 'pick' });
      game.flash = 0.2;
      game.shake = 3;
    } else if (event.type === 'equipped') {
      game.giving = null;
      audio.play({ type: 'item' });
      game.flash = 0.2;
    } else if (event.type === 'rewritten') {
      audio.play({ type: event.to ? 'item' : 'pick' });
    } else if (event.type === 'restore') {
      game.prevGravDir = run.s.gravDir;
      game.avatar = createAvatar(seed, loadOutfit());
      game.trail = [];
      game.routeStates = null;
    } else if (event.type === 'chosen') {
      if (event.kind) { audio.play({ type: 'pick' }); game.toast = { kind: isItem(event.kind) ? event.kind : null, text: cardText(event.kind), age: 0, ms: TIP_MS }; }
    } else if (event.type === 'planted' || event.type === 'placed' || event.type === 'erased') {
      if (!run.tricks.length) game.building = false;
      game.active = Math.min(game.active, Math.max(0, ownedKinds().length - 1));
    }
    if (event.type === 'shot') audio.play({ type: 'shoot' });
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
      onOver?.({ metres: run.peak, best: game.best, deaths: run.deaths, points: run.earned, path: run.path, recording: game.recording });
    }
  }

  const ruleAt = id => MUTATORS.findIndex(m => m.id === id);
  const actOf = pending => pending.pick !== undefined ? { type: 'pick', value: pending.pick } : pending.equip ? { type: 'equip', value: pending.equip, giving: (pending.giving ?? -1) + 1 } : pending.place ? { type: 'place', ...pending.place } : pending.flag ? { type: 'flag' } : pending.fire ? { type: 'fire' } : pending.reroll ? { type: 'reroll' } : pending.swap ? { type: 'swap', from: ruleAt(pending.swap.from), to: ruleAt(pending.swap.to) } : { type: 'erase', id: pending.erase };
  const inputOfAct = act => act.type === 'pick' ? { pick: act.value } : act.type === 'equip' ? { equip: act.value, giving: act.giving ? act.giving - 1 : undefined } : act.type === 'place' ? { place: { kind: act.kind, x: act.x, y: act.y } } : act.type === 'flag' ? { flag: true } : act.type === 'fire' ? { fire: true } : act.type === 'reroll' ? { reroll: true } : act.type === 'swap' ? { swap: { from: MUTATORS[act.from].id, to: MUTATORS[act.to].id } } : { erase: act.id };

  function tickGhost() {
    const ghost = game.ghost;
    if (!ghost || ghost.phase === 'over') return;
    if (!takesInput(ghost)) { advance(ghost, biomes); return; }
    const act = rival.acts[game.ghostActAt];
    if (act && act.at === game.ghostAt) { game.ghostActAt++; advance(ghost, biomes, inputOfAct(act)); return; }
    if (game.ghostAt >= rival.codes.length) { ghost.phase = 'over'; return; }
    advance(ghost, biomes, inputOf(rival.codes[game.ghostAt++]));
  }

  function tick() {
    if (game.quitting || game.dressing) return;
    if (game.freeze > 0) { game.freeze--; return; }
    tickParticles();
    game.moved ||= Object.values(keys).some(Boolean);
    if (game.moved || game.run.index > 0) game.bannerAge += FRAME_MS;
    if (game.toast) game.toast.age += FRAME_MS;
    if (game.levelUp && (game.levelUp.age += FRAME_MS) > game.levelUp.ms) game.levelUp = null;
    const { run } = game;
    if (game.notice && run.s?.frame > 420 && !(game.toast && game.toast.age < game.toast.ms)) { game.toast = { kind: null, text: game.notice, age: 0, ms: TIP_MS }; game.notice = null; }
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
    request('run', game.run);
    request('ghost', game.ghost);
    if (run.level) {
      tickCamera();
      audio.update({ level: run.level, state: run.s, altitude: run.altitude });
    }
  }

  function routeState() {
    const states = game.routeStates;
    if (!states) return null;
    const clock = game.run.s.clock - game.routeOffset;
    if (clock < states[0].clock) return null;
    while (game.routeIndex + 1 < states.length && states[game.routeIndex + 1].clock <= clock) game.routeIndex++;
    return states[game.routeIndex];
  }

  function toggleRoute() {
    if (game.routeStates) { game.routeStates = null; return; }
    const { touched, s, hall, level } = game.run;
    if (hall) return;
    const segment = level.segments[Math.min(touched.length, level.segments.length - 1)];
    const period = level.timed ? CLOCK_PERIOD : 1;
    const wait = wrap(segment.start.clock - s.clock, period);
    game.routeStates = replay(level, segment.inputs, segment.start);
    game.routeOffset = s.clock + wait - segment.start.clock;
    game.routeIndex = 0;
  }

  function rivalView() {
    const ghost = game.ghost;
    if (!ghost?.level) return null;
    return { index: ghost.index, state: ghost.phase === 'play' && !ghost.hall && !game.run.hall ? ghost.s : null, altitude: ghost.peak, done: ghost.phase === 'over' };
  }

  const ownedKinds = () => [...new Set(game.run.tricks)];
  const activeTrick = () => ownedKinds()[game.active % Math.max(1, ownedKinds().length)] ?? null;

  function inventoryView() {
    const kinds = ownedKinds();
    return { kinds, counts: kinds.map(kind => game.run.tricks.filter(t => t === kind).length), active: game.building ? activeTrick() : null };
  }

  function blinkPreview() {
    const { run } = game;
    const s = run.s;
    if (!run.level.rules.blinkJump || run.phase !== 'play' || s.dead || !(s.grounded || s.jumpsLeft > 0)) return null;
    const held = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    return blinkDestination(run.level, s, run.level.rules.mirror ? -held : held);
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
    document.body.classList.toggle('armed', run.s?.arrows > 0);
    if (!run.level) {
      renderer.drawLoading(buildingView(wantedBiome(run, 0), time));
      return;
    }
    const above = !run.hall && nextBiome(run, biomes);
    renderer.draw({
      level: run.level, state: run.s, time, seed, camera: game.camera,
      below: run.hall ? null : run.below, above: above && { level: above, state: restingState(above) },
      ghost: routeState(), rival: rivalView(), trail: game.trail, particles: game.particles,
      flash: game.flash, shake: game.shake, lives: run.lives, maxLives: run.maxLives, over: run.phase === 'over', quitting: game.quitting,
      altitude: run.altitude, best: game.best, biomeIndex: run.index, collected: run.collected, runes: run.runes, pointer: game.pointer, bannerAge: game.bannerAge, touched: run.touched.map(t => t.id),
      frozen: run.level.rules.superhot && run.phase === 'play' && run.s.clock === game.prevClock,
      building: run.phase === 'gate' ? buildingView(wantedBiome(run, run.index + 1), time) : null,
      giving: stallOf(run) === OUTFITTER ? game.giving : null,
      freeGear: run.index === 0 && !run.gear.length,
      light: lightOf(run.gear),
      gear: run.gear.map(id => ({ id, active: isPerk(id) || biomeOf(run).mutators.includes(id) })),
      keys, muted: audio.muted, toast: game.toast, levelUp: game.levelUp, avatar: game.avatar, wardrobe: game.dressing,
      points: run.points, combo: { links: run.combo.links, floor: run.combo.floor, pop: game.combo }, aim: aim(), blink: blinkPreview(), doubled: run.doubled === run.index,
      stall: stallView(time),
      inventory: inventoryView(), planted: run.touched.filter(t => t.flag).map(t => t.flag),
    });
  }

  function frame(now) {
    if (!game.running) return;
    accumulator += Math.min(100, now - lastTime);
    lastTime = now;
    const ticks = Math.floor(accumulator / FRAME_MS);
    for (let i = 0; i < ticks; i++) tick();
    accumulator -= ticks * FRAME_MS;
    if (ticks) render(now);
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const over = game.run.phase === 'over';
    if (game.quitting) {
      if (event.code === 'Enter' || event.code === 'KeyY') leave();
      else if (event.code === 'Escape' || event.code === 'KeyN') game.quitting = false;
      return;
    }
    if (game.dressing) { dress(event.code); return; }
    if (event.code === 'Escape') {
      if (over) leave();
      else if (game.building) game.building = false;
      else askToLeave();
      return;
    }
    if (over && event.code === 'KeyR') { newClimb(); return; }
    if (event.target.closest?.('button, input')) return;
    audio.resume();
    if (event.code === 'KeyM') { audio.toggleMute(); return; }
    if (event.code === 'KeyF' && nearWardrobe()) { openDressing(); event.preventDefault(); return; }
    const action = KEYS[event.code];
    if (action) {
      for (const name of [action].flat()) keys[name] = true;
      event.preventDefault();
      return;
    }
    if (over && event.code === 'Enter') newClimb();
    if (game.run.phase !== 'play') return;
    const digit = { Digit1: 1, Digit2: 2, Digit3: 3 }[event.code];
    if (digit && stallOf(game.run)) { useStall(digit); return; }
    if (event.code === 'KeyB' && game.run.tricks.length) {
      if (!game.building) { game.building = true; game.active = 0; }
      else if (game.active + 1 < ownedKinds().length) game.active += 1;
      else game.building = false;
      return;
    }
    if (event.code === 'Tab' && game.building) { game.active = (game.active + 1) % ownedKinds().length; event.preventDefault(); return; }
    if (event.code === 'KeyR') game.restart = true;
    if (event.code === 'KeyV' && game.run.s?.arrows > 0) game.pending = { fire: true };
    if (event.code === 'KeyH') toggleRoute();
  }

  function onPointerMove(event) {
    game.pointer = event.type === 'pointerleave' ? null : renderer.pointer(event);
  }

  const nearWardrobe = () => game.run.phase === 'play' && atWardrobe(homeOf(game.run.level), game.run.level, game.run.s);

  function releaseKeys() {
    for (const name of Object.keys(keys)) keys[name] = false;
  }

  function openDressing() {
    game.dressing = openWardrobe(game.avatar);
    releaseKeys();
    audio.play({ type: 'pick' });
  }

  function closeDressing() {
    saveOutfit(game.dressing.outfit);
    Object.assign(game.avatar, wear(game.dressing.outfit));
    game.dressing = null;
    cheer(game.avatar);
    audio.play({ type: 'checkpoint' });
  }

  function dress(code) {
    const move = MENU_MOVES[code];
    if (move) { game.dressing = browse(game.dressing, ...move); audio.play({ type: 'pick' }); }
    else if (code === 'KeyR') { game.dressing = shuffle(game.dressing); audio.play({ type: 'pick' }); }
    else if (WARDROBE_CLOSE.has(code)) closeDressing();
  }

  function stallRows() {
    const { run } = game, rules = currentRules(run), swap = run.swaps[run.index];
    return rules.map(from => {
      const price = swapPrice(run);
      return { from, options: [from, ...swapOptions(rules, run.collected, from)], current: swap?.from === from ? swap.to : from, price: Math.max(0, price), affordable: run.runes >= price };
    });
  }

  function stallView(time) {
    const { run } = game, id = stallOf(run);
    if (id !== game.stall?.id) Object.assign(game, { stall: id && { id, since: time }, giving: null });
    if (!id) return null;
    const base = { id, age: time - game.stall.since, floor: run.level.height - TILE - game.camera };
    if (id === DICER) return { ...base, dice: true, affordable: canReroll(run) };
    if (id === OUTFITTER) {
      const gear = outfitterOffer(run), giving = run.gear[game.giving] ?? null;
      return { ...base, gear, owned: gear.map(kind => run.gear.includes(kind)), replaces: gear.map(kind => replacedBy(run.gear, kind, giving)), prices: gear.map(kind => gearPrice(run, kind)), affordable: gear.map(kind => canEquip(run, kind)) };
    }
    const rows = id === MERCHANT ? null : stallRows(), offer = id === MERCHANT ? shopOffer(run) : null;
    if (rows?.length) return { ...base, rows };
    if (offer) return { ...base, offer, bought: run.bought, affordable: offer.map(kind => canBuy(run, kind)) };
    return { ...base, note: COME_BACK };
  }

  function useStall(n) {
    if (stallOf(game.run) === MERCHANT) { game.pending = { pick: n }; return; }
    if (stallOf(game.run) === OUTFITTER) { game.pending = { equip: n, giving: game.giving ?? undefined }; return; }
    if (stallOf(game.run) === DICER) { if (n === 1) game.pending = { reroll: true }; return; }
    const row = stallRows()[n - 1];
    if (row) game.pending = { swap: { from: row.from, to: row.options[(row.options.indexOf(row.current) + 1) % row.options.length] } };
  }

  function askToLeave() {
    game.quitting = true;
    releaseKeys();
  }

  function leave() {
    stop();
    onQuit?.();
  }

  function onClick(event) {
    const { run } = game;
    const at = renderer.pointer(event);
    game.pointer = at;
    if (game.dressing) {
      const hit = wardrobeHit(at.x, at.y);
      if (hit === 'done') closeDressing();
      else if (hit === 'shuffle') { game.dressing = shuffle(game.dressing); audio.play({ type: 'pick' }); }
      else if (hit) { game.dressing = browse(game.dressing, hit.row - game.dressing.row, hit.step); audio.play({ type: 'pick' }); }
      return;
    }
    if (game.quitting) { const hit = promptHit(at.x, at.y); if (hit === 'leave') leave(); else if (hit === 'stay') game.quitting = false; return; }
    const worn = stallOf(run) === OUTFITTER ? gearHit(at.x, at.y, run.maxLives) : null;
    if (worn !== null && run.gear[worn]) { game.giving = game.giving === worn ? null : worn; audio.play({ type: 'pick' }); return; }
    const tile = stallHit(stallView(performance.now()), at.x, at.y);
    if (tile) { useStall(tile); return; }
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

  function press(name, down) {
    if (!(name in keys)) return;
    if (game.dressing) { if (down && TOUCH_WARDROBE[name]) dress(TOUCH_WARDROBE[name]); return; }
    if (down && name === 'interact' && nearWardrobe()) { openDressing(); return; }
    if (down) audio.resume();
    keys[name] = down;
  }

  const tap = code => onKeyDown({ code, repeat: false, target: canvas, preventDefault() {} });

  function stop() {
    game.running = false;
    saveBest(seed, game.best);
    audio.stop();
    worker.terminate();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', renderer.fit);
    window.visualViewport?.removeEventListener('resize', renderer.fit);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerMove);
    canvas.removeEventListener('click', onClick);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  window.visualViewport?.addEventListener('resize', renderer.fit);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerMove);
  canvas.addEventListener('click', onClick);
  renderer.fit();
  newClimb();
  requestAnimationFrame(frame);
  return { stop, restart: newClimb, press, tap };
}
