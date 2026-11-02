import { initialState, playerSize, blinkDestination, aimOf, grant } from './physics.js?v=2401b20';
import { replay, chainStates } from './solver.js?v=2401b20';
import { deserializeLevel, roomAt, levelIndex, objectRect, WIDTH, HEIGHT, TILE, COLS, CLOCK_PERIOD, wrap } from './level.js?v=2401b20';
import { MAX_LIVES } from './climb.js?v=2401b20';
import { createRun, advance, takesInput, hazardAt, paceOf, restful, RACE_RUNES, canBuy, currentRules, stallOf, shopOffer, swapPrice, outfitterOffer, canEquip, gearPrice, canReroll, wantedBiome, wantedChain, nextBiome, biomeOf } from './run.js?v=2401b20';
import { swapOptions, RUNES_PER_BIOME } from './rulesmith.js?v=2401b20';
import { replacedBy, lightOf } from './outfitter.js?v=2401b20';
import { MUTATORS, biomeKey, isPerk, asProven } from './rules.js?v=2401b20';
import { codeOf, inputOf } from './ghost.js?v=2401b20';
import { BAR_H } from './hud.js?v=2401b20';
import { createRenderer, promptHit, inventoryHit, gearHit } from './render.js?v=2401b20';
import { stallHit } from './stall-ui.js?v=2401b20';
import { MERCHANT, OUTFITTER, DICER } from './tunnel.js?v=2401b20';
import { COMBO_FROM, MILESTONES } from './combo.js?v=2401b20';
import { TRICKS, PLACEABLE, buildAt } from './tricks.js?v=2401b20';
import { KINDS } from './items.js?v=2401b20';
import { createAudio } from './audio.js?v=2401b20';
import { soundEvents } from './sounds.js?v=2401b20';
import { themeFor } from './themes.js?v=2401b20';
import { createAvatar, stepAvatar, cheer, wear } from './avatar.js?v=2401b20';
import { homeOf, atWardrobe } from './home.js?v=2401b20';
import { loadOutfit, saveOutfit, openWardrobe, browse, shuffle, wardrobeHit } from './wardrobe.js?v=2401b20';
import { chatter } from './chatter.js?v=2401b20';
import { VERSION } from './version.js?v=2401b20';
import { GOD_PAGES, godX, nearGod, summit } from './god.js?v=2401b20';
import { bestOf, saveBest } from './records.js?v=2401b20';
import { parseScript, framesOf, summarizeLevel, summarizeState, causeOfDeath } from './devtools.js?v=2401b20';
import { cellOf, rectFrom, isWirable } from './editor.js?v=2401b20';
import { blockById } from './blueprint.js?v=2401b20';

const FRAME_MS = 1000 / 60;
const DEV = VERSION === 'dev';
const GOD = 'god';
const BIOMES_AHEAD = 2;
const CAMERA_LEAD = 0.55;
const CAMERA_EASE = 0.12;
const ROOM_LIGHT = 8;
const FLY_SPEED = 8;
const WHEEL_SCROLL = 0.6;
const FPS_WINDOW_MS = 500;
const COMET_CAMERA_LEAD = 28;
const COMET_CAMERA_MAX = HEIGHT * 0.35;
const COMET_CAMERA_EASE = 0.2;
const HIT_STOP = { stomp: 5, death: 9, cometPerfect: 3, crush: 4, fanfare: 2 };
const ECHO = { frames: 90, ms: 2600 };
const PERFECT_MS = 2600;
const COIN_COLOR = 'hsl(48 95% 60% / 1)';
const FIREWORKS = { frames: 100, every: 8, colors: [COIN_COLOR, 'hsl(0 90% 65% / 1)', 'hsl(200 90% 65% / 1)', 'hsl(130 80% 60% / 1)', 'hsl(0 0% 100% / 1)'] };
const PHRASE_MS = 1600;
const TOAST_MS = 3200;
const LEVEL_UP_MS = 5200;
const TIP_MS = 6000;
const COME_BACK = "Come back when you're more experienced.";
const PLANNING = { fraction: 0, stage: 'drawing up a plan' };
const FAILED = { fraction: 0, stage: 'this biome could not be built, try another seed' };
const DIRECTIONS = new Set(['left', 'right', 'up', 'down']);
const isItem = kind => KINDS.some(([k]) => k === kind);
const cardText = kind => `${TRICKS[kind].title}: ${TRICKS[kind].text}`;

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash',
  KeyF: 'interact',
  KeyT: 'teleport',
};
const MENU_MOVES = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
const WARDROBE_CLOSE = new Set(['Enter', 'Escape', 'KeyF', 'Space', 'KeyZ']);
const TOUCH_WARDROBE = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', interact: 'KeyF', dash: 'Enter' };

export function createGame(canvas, { seed, lives = MAX_LIVES, rival = null, notice = null, focus = null, custom = null, onClimb, onOver, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = new Worker(new URL('./worker.js?v=2401b20', import.meta.url), { type: 'module' });
  const made = new Map();
  const building = new Map();
  const restingStates = new WeakMap();
  const chains = new WeakMap();
  worker.onmessage = ({ data }) => {
    if (data.type === 'level') { made.set(data.key, deserializeLevel(data.level)); building.delete(data.key); }
    else if (data.type === 'failed') building.set(data.key, FAILED);
    else building.set(data.key, { fraction: data.fraction, stage: data.stage });
  };
  worker.onerror = () => { game.failed = true; };
  const keyOf = want => biomeKey(want.index, want.entryCol, want.rules);
  const biomes = custom ? want => (want.index === 0 ? custom.current() : null) : want => made.get(keyOf(want)) ?? null;
  const buildingView = (want, time) => ({ ...(game.failed ? FAILED : building.get(keyOf(want)) ?? PLANNING), phrase: chatter(seed, want.index, Math.floor(time / PHRASE_MS)) });
  const restingState = level => restingStates.get(level) ?? restingStates.set(level, initialState(level)).get(level);
  const chainOf = level => chains.get(level) ?? chains.set(level, chainStates(asProven(level))).get(level);
  const posted = {};
  function request(lane, run) {
    if (custom || !run || run.phase === 'over') return;
    const job = { lane, seed, focus: DEV ? focus : null, ...wantedChain(run, BIOMES_AHEAD) }, text = JSON.stringify(job);
    if (posted[lane] === text) return;
    posted[lane] = text;
    worker.postMessage(job);
  }

  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false, teleport: false };
  const tapped = new Set();
  const hold = name => {
    keys[name] = true;
    tapped.add(name);
    if (name === 'teleport' && teleporting()) game.blink = blinkAim();
  };
  function heldThisTick() {
    const input = { ...keys };
    for (const name of tapped) input[name] = true;
    tapped.clear();
    return input;
  }
  const game = {
    run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, blink: null, quitting: false, pending: null, pointer: null, giving: null, godPage: 0, active: 0, building: false, ghost: null, ghostAt: 0, ghostActAt: 0, combo: null, failed: false,
    camera: 0, best: custom ? 0 : bestOf(seed), record: custom ? 0 : bestOf(seed), editing: !!custom?.editor, drag: null, linking: null, builtFrom: null, startedAt: 0, perfect: null, fireworks: 0,
    trail: [], particles: [], flash: 0, shake: 0, freeze: 0, avatar: createAvatar(seed, loadOutfit()), bannerAge: 0, toast: null, moved: false,
    routeStates: null, routeOffset: 0, routeIndex: 0, running: true, prevGravDir: 1, prevClock: 0, notice, script: null, tracing: false, path: [], deaths: [],
    recent: [], echo: null, ahead: false,
  };
  let lastTime = performance.now();
  let accumulator = 0;
  let fpsFrames = 0, fpsSince = performance.now();

  const keepBest = () => { if (!custom) saveBest(seed, game.best); };

  function announce(level) {
    const theme = themeFor(level).id;
    audio.setBiome(theme);
  }

  function newClimb() {
    Object.assign(game, { run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, blink: null, quitting: false, pending: null, active: 0, building: false, ghost: rival && createRun(lives, seed), ghostAt: 0, ghostActAt: 0, combo: null, trail: [], particles: [], freeze: 0, avatar: createAvatar(seed, loadOutfit()), routeStates: null, moved: false, dressing: null, levelUp: null, recent: [], echo: null, ahead: false, record: bestOf(seed), perfect: null, fireworks: 0 });
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
    const high = level.height - HEIGHT + (below ? HEIGHT / 2 : 0) + (game.editing ? dockReach() : 0);
    const falling = s.comet ? Math.min(COMET_CAMERA_MAX, Math.max(0, s.vy * s.gravDir) * COMET_CAMERA_LEAD) * s.gravDir : 0;
    const room = roomAt(level, s.y);
    const target = room ? (room.top + room.bottom - HEIGHT) / 2 : Math.max(low, Math.min(high, s.y - HEIGHT * CAMERA_LEAD + falling));
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
      if (level.rooms?.some(r => Math.abs(s.y + h - r.top) < TILE)) game.fireworks = FIREWORKS.frames / 2;
    }
    const foot = { x: s.x + w / 2, y: s.y + h, frame: s.frame };
    game.recent.push(foot);
    if (game.recent.length > ECHO.frames) game.recent.shift();
    if (game.tracing) {
      const point = { ...foot };
      if (s.dead && !prev.dead) { point.death = causeOfDeath(level, prev, s); game.deaths.push({ ...point, index: game.run.index, altitude: game.run.altitude }); }
      game.path.push(point);
    }
    const architect = architectView();
    const ahead = !!architect?.state && !architect.done && s.y < architect.state.y;
    if (ahead && !game.ahead) { audio.play({ type: 'pick' }); burst(architect.state.x + w / 2, architect.state.y + h / 2, palette.accent, 12, 2.5); }
    game.ahead = ahead;
    if (game.run.peak > game.best) {
      game.best = game.run.peak;
      if (s.frame % 30 === 0) keepBest();
    }
    if (s.dead) {
      game.shake = 10;
      burst(s.x + w / 2, s.y + h / 2, palette.player, 28, 5);
      game.echo = { points: game.recent, age: 0, ms: ECHO.ms };
      game.recent = [];
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
      game.path = game.path.map(p => ({ x: p.x, y: p.y + event.level.height }));
      Object.assign(game, { recent: [], echo: null, ahead: false });
      announce(event.level);
      game.routeStates = null;
      game.bannerAge = 0;
      game.prevGravDir = run.s.gravDir;
      game.levelUp = { ids: event.unlocked, runes: RUNES_PER_BIOME + (event.raced ? RACE_RUNES : 0), raced: event.raced, age: 0, ms: LEVEL_UP_MS };
      audio.play({ type: 'fanfare', links: event.raced ? 20 : event.unlocked.length ? 16 : 8 });
      if (event.raced) Object.assign(game, { flash: 0.3, perfect: { age: 0, ms: PERFECT_MS }, fireworks: FIREWORKS.frames });
      if (event.lucky) audio.play({ type: 'item' });
    } else if (event.type === 'underpass' || event.type === 'surface') {
      game.camera = event.level.height - HEIGHT;
      game.trail = [];
      game.path = [];
      Object.assign(game, { recent: [], echo: null, ahead: false });
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
    } else if (event.type === 'restore' || event.type === 'reset') {
      game.prevGravDir = run.s.gravDir;
      game.avatar = createAvatar(seed, loadOutfit());
      game.trail = [];
      game.recent = [];
      game.ahead = false;
      if (event.type === 'reset') Object.assign(game, { echo: null, path: [] });
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
      keepBest();
      audio.play({ type: 'gameOver' });
      onOver?.({ metres: run.peak, best: game.best, deaths: run.deaths, points: run.earned, path: run.path, recording: game.recording });
    }
  }

  const ruleAt = id => MUTATORS.findIndex(m => m.id === id);
  const actOf = pending => pending.reset ? { type: 'reset' } : pending.pick !== undefined ? { type: 'pick', value: pending.pick } : pending.equip ? { type: 'equip', value: pending.equip, giving: (pending.giving ?? -1) + 1 } : pending.place ? { type: 'place', ...pending.place } : pending.flag ? { type: 'flag' } : pending.fire ? { type: 'fire' } : pending.reroll ? { type: 'reroll' } : pending.swap ? { type: 'swap', from: ruleAt(pending.swap.from), to: ruleAt(pending.swap.to) } : { type: 'erase', id: pending.erase };
  const swapOfAct = act => MUTATORS[act.from] && MUTATORS[act.to] ? { swap: { from: MUTATORS[act.from].id, to: MUTATORS[act.to].id } } : null;
  const inputOfAct = act => act.type === 'reset' ? { reset: true } : act.type === 'blink' ? { blink: act.value } : act.type === 'pick' ? { pick: act.value } : act.type === 'equip' ? { equip: act.value, giving: act.giving ? act.giving - 1 : undefined } : act.type === 'place' ? { place: { kind: act.kind, x: act.x, y: act.y } } : act.type === 'flag' ? { flag: true } : act.type === 'fire' ? { fire: true } : act.type === 'reroll' ? { reroll: true } : act.type === 'swap' ? swapOfAct(act) : { erase: act.id };

  function tickGhost() {
    const ghost = game.ghost;
    if (!ghost || ghost.phase === 'over') return;
    if (!takesInput(ghost)) { advance(ghost, biomes); return; }
    const act = rival.acts[game.ghostActAt];
    if (act && act.at === game.ghostAt) {
      game.ghostActAt++;
      const input = inputOfAct(act);
      if (input) advance(ghost, biomes, act.type === 'blink' ? { ...inputOf(rival.codes[game.ghostAt++]), ...input } : input);
      return;
    }
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
    if (game.echo && (game.echo.age += FRAME_MS) > ECHO.ms) game.echo = null;
    if (game.perfect && (game.perfect.age += FRAME_MS) > game.perfect.ms) game.perfect = null;
    if (game.fireworks > 0 && game.fireworks-- % FIREWORKS.every === 0) burst(60 + Math.random() * (WIDTH - 120), game.camera + 60 + Math.random() * HEIGHT * 0.5, FIREWORKS.colors[Math.floor(Math.random() * FIREWORKS.colors.length)], 26, 5);
    const { run } = game;
    if (game.editing && run.phase === 'play') {
      flyAbout(run);
      tickCamera();
      audio.update({ level: run.level, state: run.s });
      return;
    }
    if (game.notice && run.s?.frame > 420 && !(game.toast && game.toast.age < game.toast.ms)) { game.toast = { kind: null, text: game.notice, age: 0, ms: TIP_MS }; game.notice = null; }
    if (game.script && run.phase === 'play' && !game.pending) scriptFrame();
    if (game.pending && takesInput(run)) {
      const pending = game.pending;
      game.pending = null;
      const result = advance(run, biomes, pending);
      if (result) { game.recording.acts.push({ at: game.recording.codes.length, ...actOf(pending) }); react(result); }
    } else if (run.phase === 'play') {
      const input = { ...heldThisTick(), restart: game.restart };
      if (game.blink !== null) {
        input.blink = game.blink;
        game.recording.acts.push({ at: game.recording.codes.length, type: 'blink', value: game.blink });
      }
      game.restart = false;
      game.blink = null;
      game.recording.codes.push(codeOf(input));
      react(advance(run, biomes, input));
    } else {
      tapped.clear();
      react(advance(run, biomes));
    }
    if (custom) settleCustom(run);
    tickGhost();
    request('run', game.run);
    request('ghost', game.ghost);
    if (run.level) {
      tickCamera();
      audio.update({ level: run.level, state: run.s });
    }
  }

  function flyAbout(run) {
    const { s, level } = run, { w, h } = playerSize(level.rules);
    const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    run.s = { ...s, x: Math.max(0, Math.min(WIDTH - w, s.x + dx * FLY_SPEED)), y: Math.max(0, Math.min(level.height - h, s.y + dy * FLY_SPEED)), clock: s.clock + 1, frame: s.frame + 1, facing: dx || s.facing, grounded: false, vx: 0, vy: 0 };
  }

  function settleCustom(run) {
    run.lives = run.maxLives;
    if (run.phase !== 'gate') return;
    const seconds = (run.s.frame - game.startedAt) / 60, deaths = run.deaths;
    if (custom.editor) {
      enterBuild();
      Object.assign(game, { fireworks: FIREWORKS.frames, toast: { kind: null, text: `Cleared in ${seconds.toFixed(1)} s`, age: 0, ms: TIP_MS } });
      audio.play({ type: 'fanfare', links: 8 });
      return;
    }
    run.phase = 'over';
    custom.onCleared({ seconds, deaths });
  }

  function dockReach() {
    const { top, height } = canvas.getBoundingClientRect();
    return Math.max(0, HEIGHT - (custom.dockTop() - top) * (HEIGHT + BAR_H) / height);
  }

  function loadCustom(state) {
    const { run } = game, level = custom.current();
    if (run.level && run.level !== level) renderer.forget(run.level);
    Object.assign(run, { level, s: { ...initialState(level), ...state }, touched: [], phase: 'play', phaseAge: 0, elapsed: 0, deaths: 0 });
    announce(level);
  }

  function enterTest() {
    game.editing = false;
    game.builtFrom = { x: game.run.s.x, y: game.run.s.y };
    custom.refresh();
    loadCustom({});
    game.startedAt = game.run.s.frame;
    Object.assign(game, { drag: null, linking: null, trail: [], path: [], recent: [], echo: null, bannerAge: 0, moved: false });
    custom.onMode?.('test');
  }

  function enterBuild() {
    game.editing = true;
    custom.refresh();
    loadCustom({ ...game.builtFrom, grounded: false });
    custom.onMode?.('build');
  }

  function rebuilt() {
    const { x, y, facing, clock, frame } = game.run.s, rowsBefore = game.run.level.rows;
    custom.refresh();
    const grown = (custom.current().rows - rowsBefore) * TILE;
    game.camera += grown;
    loadCustom({ x, y: y + grown, facing, clock, frame, grounded: false });
  }

  function commitDrag(to, erasing) {
    const { editor } = custom, { drag } = game, rows = editor.blueprint.rows;
    if (to.r < 0 || to.r >= rows || to.c < 0 || to.c >= COLS) return;
    if (editor.tool === 'wire' && !erasing) return wireAt(to);
    editor.remember();
    if (erasing || editor.tool === 'erase') {
      const [c0, c1] = [Math.min(drag.from.c, to.c), Math.max(drag.from.c, to.c)], [r0, r1] = [Math.min(drag.from.r, to.r), Math.max(drag.from.r, to.r)];
      let changed = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) while (editor.eraseAt(c, r)) changed = true;
      if (changed) audio.play({ type: 'erase' });
      else editor.undoStack.pop();
    } else {
      const block = blockById(editor.tool);
      editor.place(block, rectFrom(block, drag.from, to, rows));
      audio.play({ type: 'place' });
    }
    editor.changed();
    rebuilt();
  }

  function wireAt(at) {
    const { editor } = custom, item = editor.itemAt(at.c, at.r);
    if (!isWirable(item)) { game.linking = null; return; }
    const first = game.linking && editor.blueprint.items.find(i => i.u === game.linking);
    if (!first || blockById(first.b).source === blockById(item.b).source) { game.linking = item.u; audio.play({ type: 'pick' }); return; }
    editor.remember();
    const [source, lock] = blockById(first.b).source ? [first, item] : [item, first];
    editor.connect(source, lock);
    game.linking = null;
    audio.play({ type: 'place' });
    editor.changed();
    rebuilt();
  }

  function editingView() {
    const { editor } = custom, at = game.pointer && cellOf(game.pointer.x, game.pointer.y + game.camera);
    const tool = editor.tool, block = blockById(tool);
    const erasing = tool === 'erase' || game.drag?.button === 2;
    const from = game.drag?.from ?? at;
    return {
      at, erasing, block: !erasing && tool !== 'wire' ? block : null, wiring: tool === 'wire', linking: game.linking,
      rect: at && block && !erasing ? rectFrom(block, from, at, editor.blueprint.rows) : at && { c: Math.min(from.c, at.c), r: Math.min(from.r, at.r), w: Math.abs(from.c - at.c) + 1, h: Math.abs(from.r - at.r) + 1 },
      items: editor.blueprint.items,
    };
  }

  function onPointerDown(event) {
    if (!game.editing || game.quitting) return;
    const at = renderer.pointer(event);
    game.pointer = at;
    game.drag = { from: cellOf(at.x, at.y + game.camera), button: event.button };
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerUp(event) {
    if (!game.editing || !game.drag) return;
    const at = renderer.pointer(event);
    commitDrag(cellOf(at.x, at.y + game.camera), game.drag.button === 2);
    game.drag = null;
  }

  function onWheel(event) {
    if (!game.editing) return;
    event.preventDefault();
    const { run } = game;
    run.s = { ...run.s, y: Math.max(0, Math.min(run.level.height - 26, run.s.y + event.deltaY * WHEEL_SCROLL)) };
  }

  function scriptFrame() {
    const script = game.script;
    if (script.at >= script.frames.length) {
      for (const name of script.held) keys[name] = false;
      game.script = null;
      script.resolve({ ...summarizeState(game.run), deaths: game.deaths.slice(script.deathsBefore) });
      return;
    }
    const frame = script.frames[script.at], want = new Set(frame.settle && !restful(game.run) ? [] : frame.keys);
    if (!frame.settle || restful(game.run)) script.at++;
    for (const name of want) if (!script.held.has(name)) hold(name);
    for (const name of script.held) if (!want.has(name)) keys[name] = false;
    script.held = want;
    if (frame.press) tap(frame.press);
  }

  const runScript = frames => new Promise(resolve => {
    game.tracing = true;
    game.script = { frames, at: 0, held: new Set(), resolve, deathsBefore: game.deaths.length };
  });

  const devTools = () => ({
    script: steps => runScript(Array.isArray(steps) ? framesOf(steps) : parseScript(steps)),
    state: () => summarizeState(game.run),
    level: () => summarizeLevel(game.run.level),
    solution: segment => (segment === undefined ? game.run.level.solution : game.run.level.segments[segment].inputs),
    proof: segment => {
      const { level } = game.run, { w, h } = playerSize(level.rules), { inputs, start } = level.segments[segment];
      return replay(level, inputs, start).map(s => ({ x: s.x + w / 2, y: s.y + h, clock: s.clock, grounded: s.grounded }));
    },
    grant: kind => { game.run.s = grant({ ...game.run.s }, kind); },
    summit: () => { game.run.s = summit(game.run.level, game.run.s); },
    music: () => audio.music,
    editor: () => custom?.editor,
    camera: () => game.camera,
    warp: (x, y) => { game.run.s = { ...game.run.s, x, y, vx: 0, vy: 0 }; },
    path: () => game.path,
    deaths: () => game.deaths,
    clear: () => { game.path = []; game.deaths = []; },
    trace: on => { game.tracing = on; },
  });

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
    if (!segment) return;
    const period = level.timed ? CLOCK_PERIOD : 1;
    const wait = wrap(segment.start.clock - s.clock, period);
    game.routeStates = replay(asProven(level), segment.inputs, segment.start);
    game.routeOffset = s.clock + wait - segment.start.clock;
    game.routeIndex = 0;
  }

  function architectView() {
    const { run } = game;
    if (run.hall || !paceOf(run.level)) return null;
    const states = chainOf(run.level);
    return { state: states[Math.min(run.elapsed, states.length - 1)], done: run.elapsed >= states.length, started: run.elapsed > 0 };
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

  const teleporting = () => !!game.run.level?.rules.blinkJump && game.run.phase === 'play';

  function blinkAim() {
    const { run } = game, { w, h } = playerSize(run.level.rules), s = run.s;
    if (game.pointer) return aimOf(game.pointer.x - (s.x + w / 2), game.pointer.y + game.camera - (s.y + h / 2));
    const across = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * (run.level.rules.mirror ? -1 : 1);
    return aimOf(across, keys.down ? 1 : -1);
  }

  function blinkPreview() {
    const s = game.run.s;
    if (!teleporting() || s.dead || s.teleports < 1) return null;
    return blinkDestination(game.run.level, s, blinkAim());
  }

  function aim() {
    const { run } = game;
    const kind = activeTrick();
    if (!game.building || !kind || !game.pointer || run.phase !== 'play') return null;
    const x = Math.round(game.pointer.x), y = Math.round(game.pointer.y + game.camera);
    if (kind === 'erase') return { kind, object: hazardAt(run.level, run.s, x, y), x, y };
    if (kind === 'flag') return { kind, ok: run.s.grounded, x, y };
    return { kind, rect: buildAt(run.level, run.s, kind, x, y), x, y };
  }

  function render(time) {
    const { run } = game;
    document.body.classList.toggle('armed', run.s?.arrows > 0);
    document.body.classList.toggle('teleporter', teleporting());
    if (!run.level) {
      renderer.drawLoading(buildingView(wantedBiome(run, 0), time));
      return;
    }
    const above = !run.hall && nextBiome(run, biomes);
    renderer.draw({
      level: run.level, state: run.s, time, seed, camera: game.camera,
      below: run.hall ? null : run.below, above: above && { level: above, state: restingState(above) },
      ghost: routeState(), rival: rivalView(), architect: architectView(), echo: game.echo, trail: game.trail, particles: game.particles,
      flash: game.flash, shake: game.shake, lives: run.lives, maxLives: run.maxLives, over: run.phase === 'over', quitting: game.quitting,
      altitude: run.altitude, best: game.best, record: game.record, perfect: game.perfect, biomeIndex: run.index, collected: run.collected, runes: run.runes, pointer: game.pointer, bannerAge: game.bannerAge, touched: run.touched.map(t => t.id),
      frozen: run.level.rules.superhot && run.phase === 'play' && run.s.clock === game.prevClock,
      building: run.phase === 'gate' ? buildingView(wantedBiome(run, run.index + 1), time) : null,
      giving: stallOf(run) === OUTFITTER ? game.giving : null,
      freeGear: run.index === 0 && !run.gear.length,
      god: DEV && !custom,
      fps: game.fps,
      light: roomAt(run.level, run.s.y) ? ROOM_LIGHT : lightOf(run.gear),
      gear: run.gear.map(id => ({ id, active: isPerk(id) || biomeOf(run).mutators.includes(id) })),
      keys, muted: audio.muted, toast: game.toast, levelUp: game.levelUp, avatar: game.avatar, wardrobe: game.dressing,
      points: run.points, combo: { links: run.combo.links, floor: run.combo.floor, pop: game.combo }, aim: aim(), blink: blinkPreview(), doubled: run.doubled === run.index,
      stall: stallView(time),
      inventory: inventoryView(), planted: run.touched.filter(t => t.flag).map(t => t.flag), path: game.path,
      editing: game.editing ? editingView() : null,
    });
  }

  function countFrame(now) {
    fpsFrames++;
    if (now - fpsSince < FPS_WINDOW_MS) return;
    game.fps = Math.round((fpsFrames * 1000) / (now - fpsSince));
    fpsFrames = 0;
    fpsSince = now;
  }

  function frame(now) {
    if (!game.running) return;
    accumulator += Math.min(100, now - lastTime);
    lastTime = now;
    const ticks = Math.floor(accumulator / FRAME_MS);
    for (let i = 0; i < ticks; i++) tick();
    accumulator -= ticks * FRAME_MS;
    if (ticks) { countFrame(now); render(now); }
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const over = game.run.phase === 'over';
    if (game.quitting) {
      if (event.code === 'Enter' || event.code === 'KeyY') leave();
      else if (event.code === 'Escape' || event.code === 'KeyN') game.quitting = false;
      else if (event.code === 'KeyR') resetBiome();
      return;
    }
    if (game.dressing) { dress(event.code); return; }
    if (event.code === 'Escape') {
      if (over) leave();
      else if (game.building) game.building = false;
      else if (custom?.editor) { if (game.editing) leave(); else enterBuild(); }
      else askToLeave();
      return;
    }
    if (over && event.code === 'KeyR') { newClimb(); return; }
    if (event.target.closest?.('button, input, select')) return;
    audio.resume();
    if (custom?.editor && editorKey(event)) return;
    if (event.code === 'KeyM') { audio.toggleMute(); return; }
    if (event.code === 'KeyF' && nearWardrobe()) { openDressing(); event.preventDefault(); return; }
    const action = KEYS[event.code];
    if (action) {
      for (const name of [action].flat()) hold(name);
      event.preventDefault();
      return;
    }
    if (over && event.code === 'Enter') newClimb();
    if (game.run.phase !== 'play') return;
    const digit = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7 }[event.code];
    if (digit && standingAt()) { useStall(digit); return; }
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
    tapped.clear();
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

  const atGod = () => DEV && game.run.phase === 'play' && nearGod(game.run.level, game.run.s);
  const standingAt = () => stallOf(game.run) ?? (atGod() ? GOD : null);

  function stallView(time) {
    const { run } = game, id = standingAt();
    if (id !== game.stall?.id) Object.assign(game, { stall: id && { id, since: time }, giving: null, godPage: 0 });
    if (!id) return null;
    const base = { id, age: time - game.stall.since, floor: run.level.height - TILE - game.camera };
    if (id === GOD) return { ...base, x: godX(run.level), gifts: GOD_PAGES[game.godPage].map(gift => ({ ...gift, owned: !!gift.rule && run.gear.includes(gift.rule) })) };
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
    if (standingAt() === GOD) {
      const gift = GOD_PAGES[game.godPage][n - 1];
      if (gift?.more) { game.godPage = (game.godPage + 1) % GOD_PAGES.length; audio.play({ type: 'pick' }); }
      else if (gift) { gift.give(game.run); audio.play({ type: 'item' }); game.flash = 0.25; }
      return;
    }
    if (stallOf(game.run) === MERCHANT) { game.pending = { pick: n }; return; }
    if (stallOf(game.run) === OUTFITTER) { game.pending = { equip: n, giving: game.giving ?? undefined }; return; }
    if (stallOf(game.run) === DICER) { if (n === 1) game.pending = { reroll: true }; return; }
    const row = stallRows()[n - 1];
    if (row) game.pending = { swap: { from: row.from, to: row.options[(row.options.indexOf(row.current) + 1) % row.options.length] } };
  }

  function resetBiome() {
    game.quitting = false;
    game.pending = { reset: true };
  }

  function editorKey(event) {
    const { editor } = custom;
    if (event.code === 'KeyP') { if (game.editing) enterTest(); else enterBuild(); return true; }
    if (!game.editing || !(event.metaKey || event.ctrlKey)) return false;
    if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); rebuilt(); return true; }
    if (event.code === 'KeyY') { event.preventDefault(); editor.redo(); rebuilt(); return true; }
    return false;
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
    if (game.editing) return;
    const at = renderer.pointer(event);
    game.pointer = at;
    if (game.dressing) {
      const hit = wardrobeHit(at.x, at.y);
      if (hit === 'done') closeDressing();
      else if (hit === 'shuffle') { game.dressing = shuffle(game.dressing); audio.play({ type: 'pick' }); }
      else if (hit) { game.dressing = browse(game.dressing, hit.row - game.dressing.row, hit.step); audio.play({ type: 'pick' }); }
      return;
    }
    if (game.quitting) { const hit = promptHit(at.x, at.y); if (hit === 'leave') leave(); else if (hit === 'stay') game.quitting = false; else if (hit === 'restart') resetBiome(); return; }
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

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onKeyUp(event) {
    const action = KEYS[event.code];
    if (action) for (const name of [action].flat()) keys[name] = false;
  }

  function press(name, down) {
    if (!(name in keys)) return;
    if (game.dressing) { if (down && TOUCH_WARDROBE[name]) dress(TOUCH_WARDROBE[name]); return; }
    if (down && name === 'interact' && nearWardrobe()) { openDressing(); return; }
    if (down && DIRECTIONS.has(name)) game.pointer = null;
    if (down) { audio.resume(); hold(name); } else keys[name] = false;
  }

  const tap = code => onKeyDown({ code, repeat: false, target: canvas, preventDefault() {} });

  function stop() {
    game.running = false;
    keepBest();
    audio.stop();
    worker.terminate();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', renderer.fit);
    window.visualViewport?.removeEventListener('resize', renderer.fit);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerMove);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  window.visualViewport?.addEventListener('resize', renderer.fit);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerMove);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  renderer.fit();
  newClimb();
  requestAnimationFrame(frame);
  if (DEV) window.shiftform = devTools();
  return { stop, restart: newClimb, press, tap, toggleTest: () => { if (game.editing) enterTest(); else enterBuild(); }, rebuilt, settingsChanged: () => { renderer.forget(game.run.level); rebuilt(); } };
}
