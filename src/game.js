import { initialState, playerSize, blinkDestination, aimOf, grant } from './physics.js?v=e18c5db';
import { replay, chainStates } from './solver.js?v=e18c5db';
import { deserializeLevel, levelIndex, objectRect, WIDTH, HEIGHT, TILE, CLOCK_PERIOD, wrap } from './level.js?v=e18c5db';
import { MAX_LIVES } from './climb.js?v=e18c5db';
import { createRun, advance, takesInput, hazardAt, paceOf, restful, RACE_RUNES, canBuy, currentRules, stallOf, shopOffer, swapPrice, outfitterOffer, canEquip, gearPrice, canReroll, wantedBiome, wantedChain, nextBiome, biomeOf } from './run.js?v=e18c5db';
import { swapOptions, RUNES_PER_BIOME } from './rulesmith.js?v=e18c5db';
import { replacedBy, lightOf } from './outfitter.js?v=e18c5db';
import { MUTATORS, biomeKey, isPerk } from './rules.js?v=e18c5db';
import { codeOf, inputOf } from './ghost.js?v=e18c5db';
import { createRenderer, promptHit, inventoryHit, gearHit } from './render.js?v=e18c5db';
import { paletteHit } from './hud.js?v=e18c5db';
import { stallHit } from './stall-ui.js?v=e18c5db';
import { MERCHANT, OUTFITTER, DICER } from './tunnel.js?v=e18c5db';
import { COMBO_FROM, MILESTONES } from './combo.js?v=e18c5db';
import { TRICKS, PLACEABLE, buildAt } from './tricks.js?v=e18c5db';
import { KINDS } from './items.js?v=e18c5db';
import { createAudio } from './audio.js?v=e18c5db';
import { soundEvents } from './sounds.js?v=e18c5db';
import { themeFor } from './themes.js?v=e18c5db';
import { createAvatar, stepAvatar, cheer, wear } from './avatar.js?v=e18c5db';
import { homeOf, atWardrobe } from './home.js?v=e18c5db';
import { loadOutfit, saveOutfit, openWardrobe, browse, shuffle, wardrobeHit } from './wardrobe.js?v=e18c5db';
import { chatter } from './chatter.js?v=e18c5db';
import { VERSION } from './version.js?v=e18c5db';
import { GOD_PAGES, godX, nearGod } from './god.js?v=e18c5db';
import { bestOf, saveBest } from './records.js?v=e18c5db';
import { parseScript, framesOf, summarizeLevel, summarizeState, causeOfDeath } from './devtools.js?v=e18c5db';
import { QA_SEED, BLOCKS, sandboxLevel, freshBody, removeAt } from './qa.js?v=e18c5db';

const FRAME_MS = 1000 / 60;
const DEV = VERSION === 'dev';
const GOD = 'god';
const BIOMES_AHEAD = 2;
const CAMERA_LEAD = 0.55;
const CAMERA_EASE = 0.12;
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

export function createGame(canvas, { seed, lives = MAX_LIVES, rival = null, notice = null, focus = null, onClimb, onOver, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = new Worker(new URL('./worker.js?v=e18c5db', import.meta.url), { type: 'module' });
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
  const qa = DEV && seed === QA_SEED ? { blocks: BLOCKS, active: 0, level: sandboxLevel() } : null;
  const biomes = qa ? want => (want.index === 0 ? qa.level : null) : want => made.get(keyOf(want)) ?? null;
  const buildingView = (want, time) => ({ ...(game.failed ? FAILED : building.get(keyOf(want)) ?? PLANNING), phrase: chatter(seed, want.index, Math.floor(time / PHRASE_MS)) });
  const restingState = level => restingStates.get(level) ?? restingStates.set(level, initialState(level)).get(level);
  const chainOf = level => chains.get(level) ?? chains.set(level, chainStates(level)).get(level);
  const posted = {};
  function request(lane, run) {
    if (qa || !run || run.phase === 'over') return;
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
    camera: 0, best: bestOf(seed), record: bestOf(seed), perfect: null, fireworks: 0,
    trail: [], particles: [], flash: 0, shake: 0, freeze: 0, avatar: createAvatar(seed, loadOutfit()), bannerAge: 0, toast: null, moved: false,
    routeStates: null, routeOffset: 0, routeIndex: 0, running: true, prevGravDir: 1, prevClock: 0, notice, script: null, tracing: false, path: [], deaths: [],
    recent: [], echo: null, ahead: false,
  };
  let lastTime = performance.now();
  let accumulator = 0;

  function announce(level) {
    const theme = themeFor(level).id;
    audio.setBiome(theme);
    audio.play({ type: 'biome', theme });
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
    const high = level.height - HEIGHT + (below ? HEIGHT / 2 : 0);
    const falling = s.comet ? Math.min(COMET_CAMERA_MAX, Math.max(0, s.vy * s.gravDir) * COMET_CAMERA_LEAD) * s.gravDir : 0;
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
      if (s.frame % 30 === 0) saveBest(seed, game.best);
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
      saveBest(seed, game.best);
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
    tickGhost();
    request('run', game.run);
    request('ghost', game.ghost);
    if (run.level) {
      tickCamera();
      audio.update({ level: run.level, state: run.s, altitude: run.altitude });
    }
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
    const period = level.timed ? CLOCK_PERIOD : 1;
    const wait = wrap(segment.start.clock - s.clock, period);
    game.routeStates = replay(level, segment.inputs, segment.start);
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
      god: DEV,
      light: lightOf(run.gear),
      gear: run.gear.map(id => ({ id, active: isPerk(id) || biomeOf(run).mutators.includes(id) })),
      keys, muted: audio.muted, toast: game.toast, levelUp: game.levelUp, avatar: game.avatar, wardrobe: game.dressing,
      points: run.points, combo: { links: run.combo.links, floor: run.combo.floor, pop: game.combo }, aim: aim(), blink: blinkPreview(), doubled: run.doubled === run.index,
      stall: stallView(time),
      inventory: inventoryView(), planted: run.touched.filter(t => t.flag).map(t => t.flag), path: game.path,
      qa: qa && { blocks: qa.blocks.map(b => b.id), active: qa.active },
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
      else if (event.code === 'KeyR') resetBiome();
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
    if (qa && (event.code === 'BracketLeft' || event.code === 'BracketRight')) qa.active = (qa.active + (event.code === 'BracketRight' ? 1 : qa.blocks.length - 1)) % qa.blocks.length;
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
    if (game.quitting) { const hit = promptHit(at.x, at.y); if (hit === 'leave') leave(); else if (hit === 'stay') game.quitting = false; else if (hit === 'restart') resetBiome(); return; }
    const worn = stallOf(run) === OUTFITTER ? gearHit(at.x, at.y, run.maxLives) : null;
    if (worn !== null && run.gear[worn]) { game.giving = game.giving === worn ? null : worn; audio.play({ type: 'pick' }); return; }
    const tile = stallHit(stallView(performance.now()), at.x, at.y);
    if (tile) { useStall(tile); return; }
    const slot = inventoryHit(at.x, at.y, ownedKinds().length);
    if (slot !== null) { game.active = slot; game.building = true; return; }
    if (qa && run.phase === 'play' && !run.hall) {
      const pick = paletteHit(at.x, at.y, qa.blocks.length);
      if (pick !== null) qa.active = pick; else build(at.x, at.y + game.camera);
      return;
    }
    const target = aim();
    if (!target) return;
    if (target.kind === 'erase' && target.object) game.pending = { erase: target.object.id };
    else if (target.kind === 'flag' && target.ok) game.pending = { flag: true };
    else if (target.rect) game.pending = { place: { kind: PLACEABLE.indexOf(target.kind), x: target.x, y: target.y } };
  }

  function build(x, y) {
    const { run } = game, placed = qa.blocks[qa.active].place(run.level, x, y);
    if (placed?.type === 'crate') run.s = { ...run.s, bodies: [...run.s.bodies, freshBody(placed)] };
    renderer.forget(run.level);
    audio.play({ type: 'place' });
  }

  function onContextMenu(event) {
    event.preventDefault();
    const { run } = game;
    if (!qa || run.phase !== 'play' || run.hall) return;
    const at = renderer.pointer(event);
    run.s = removeAt(run.level, run.s, at.x, at.y + game.camera);
    renderer.forget(run.level);
    audio.play({ type: 'erase' });
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
    canvas.removeEventListener('contextmenu', onContextMenu);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', renderer.fit);
  window.visualViewport?.addEventListener('resize', renderer.fit);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerMove);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onContextMenu);
  renderer.fit();
  newClimb();
  requestAnimationFrame(frame);
  if (DEV) window.shiftform = devTools();
  return { stop, restart: newClimb, press, tap };
}
