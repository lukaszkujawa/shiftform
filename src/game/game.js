import { initialState } from '../world/physics.js?v=9b09a76';
import { deserializeLevel, roomAt, WIDTH, HEIGHT } from '../world/level.js?v=9b09a76';
import { MAX_LIVES } from '../world/climb.js?v=9b09a76';
import { createRun, advance, takesInput, wantedBiome, wantedChain, nextBiome } from '../world/run.js?v=9b09a76';
import { lightOf } from '../world/skills.js?v=9b09a76';
import { skillTip } from '../ui/tooltip.js?v=9b09a76';
import { biomeKey } from '../world/rules.js?v=9b09a76';
import { createRenderer } from '../art/render.js?v=9b09a76';
import { createAudio } from './audio.js?v=9b09a76';
import { themeFor } from '../art/themes.js?v=9b09a76';
import { createAvatar } from '../art/avatar.js?v=9b09a76';
import { loadOutfit } from '../ui/wardrobe.js?v=9b09a76';
import { chatter } from './chatter.js?v=9b09a76';
import { bestOf, saveBest } from './records.js?v=9b09a76';
import { createEffects } from './effects.js?v=9b09a76';
import { createViews } from './views.js?v=9b09a76';
import { createReactions, ECHO, FIREWORKS, TIP_MS } from './reactions.js?v=9b09a76';
import { createBuilder } from './builder-mode.js?v=9b09a76';
import { createTools, DEV } from './tools.js?v=9b09a76';
import { createStalls } from './stalls.js?v=9b09a76';
import { createInput } from './input.js?v=9b09a76';
import { codeOf, inputOf, actOf, inputOfAct } from './ghost.js?v=9b09a76';

const FRAME_MS = 1000 / 60;
const BIOMES_AHEAD = 2;
const CAMERA_LEAD = 0.55;
const CAMERA_EASE = 0.12;
const ROOM_LIGHT = 8;
const FPS_WINDOW_MS = 500;
const PHRASE_MS = 1600;
const PLANNING = { fraction: 0, stage: 'drawing up a plan' };
const FAILED = { fraction: 0, stage: 'this biome could not be built, try another seed' };

export function createGame(canvas, { seed, lives = MAX_LIVES, rival = null, notice = null, focus = null, custom = null, onClimb, onOver, onQuit }) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  audio.resume();
  const worker = custom ? null : new Worker(new URL('../generation/worker.js?v=9b09a76', import.meta.url), { type: 'module' });
  const made = new Map();
  const building = new Map();
  const restingStates = new WeakMap();
  if (worker) worker.onmessage = ({ data }) => {
    if (data.type === 'level') { made.set(data.key, deserializeLevel(data.level)); building.delete(data.key); }
    else if (data.type === 'failed') building.set(data.key, FAILED);
    else building.set(data.key, { fraction: data.fraction, stage: data.stage });
  };
  if (worker) worker.onerror = () => { game.failed = true; };
  const keyOf = want => biomeKey(want.index, want.entryCol, want.rules);
  const biomes = custom ? want => (want.index === 0 ? custom.current() : null) : want => made.get(keyOf(want)) ?? null;
  const buildingView = (want, time) => ({ ...(game.failed ? FAILED : building.get(keyOf(want)) ?? PLANNING), phrase: chatter(seed, want.index, Math.floor(time / PHRASE_MS)) });
  const restingState = level => restingStates.get(level) ?? restingStates.set(level, initialState(level)).get(level);
  const posted = {};
  function request(lane, run) {
    if (custom || !run || run.phase === 'over') return;
    const job = { lane, seed, focus: DEV ? focus : null, ...wantedChain(run, BIOMES_AHEAD) }, text = JSON.stringify(job);
    if (posted[lane] === text) return;
    posted[lane] = text;
    worker.postMessage(job);
  }

  const keys = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false, teleport: false };
  const game = {
    run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, blink: null, quitting: false, pending: null, pointer: null, godPage: 0, active: 0, building: false, ghost: null, ghostAt: 0, ghostActAt: 0, combo: null, failed: false,
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

  const { burst, spray, puff, tickParticles } = createEffects(game);
  const { routeState, toggleRoute, architectView, rivalView, ownedKinds, inventoryView, teleporting, blinkAim, blinkPreview, aim } = createViews({ game, keys });
  const { react } = createReactions({ game, seed, audio, renderer, burst, spray, puff, architectView, ownedKinds, announce, keepBest, onOver });
  const { designed, flyAbout, settleCustom, dockReach, enterTest, enterBuild, rebuilt, editingView, onPointerDown, onPointerUp, onWheel, editorKey } = createBuilder({ game, custom, canvas, audio, renderer, keys, announce });
  const { standingAt, stallView, useStall } = createStalls({ game, audio });
  const { releaseKeys, syncTouchButtons, tapped, heldThisTick, hold, tap, press, onKeyDown, onKeyUp, onPointerMove, onClick, onContextMenu } = createInput({ game, keys, canvas, audio, renderer, custom, newClimb, leave, enterBuild, editorKey, teleporting, blinkAim, ownedKinds, aim, toggleRoute, standingAt, stallView, useStall });
  const { scriptFrame, devTools } = createTools({ game, keys, hold, tap, audio, custom });

  function newClimb() {
    Object.assign(game, { run: createRun(lives, seed), recording: { codes: [], acts: [] }, restart: false, blink: null, quitting: false, pending: null, active: 0, building: false, ghost: rival && createRun(lives, seed), ghostAt: 0, ghostActAt: 0, combo: null, trail: [], particles: [], freeze: 0, avatar: createAvatar(seed, loadOutfit()), routeStates: null, moved: false, dressing: null, levelUp: null, recent: [], echo: null, ahead: false, record: bestOf(seed), perfect: null, fireworks: 0 });
    onClimb?.();
  }

  function tickCamera() {
    const { level, s, below } = game.run;
    const low = !game.run.hall && nextBiome(game.run, biomes) ? -HEIGHT / 2 : 0;
    const high = level.height - HEIGHT + (below ? HEIGHT / 2 : 0) + (game.editing ? dockReach() : 0);
    const room = roomAt(level, s.y);
    const target = room ? (room.top + room.bottom - HEIGHT) / 2 : Math.max(low, Math.min(high, s.y - HEIGHT * CAMERA_LEAD));
    game.camera += (target - game.camera) * CAMERA_EASE;
  }

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

  function render(time) {
    const { run } = game;
    document.body.classList.toggle('armed', run.s?.arrows > 0);
    document.body.classList.toggle('teleporter', teleporting());
    syncTouchButtons();
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
      freeSkill: run.index === 0 && !Object.keys(run.skills).length,
      god: DEV && !custom,
      fps: game.fps,
      light: roomAt(run.level, run.s.y) ? ROOM_LIGHT : lightOf(run.skills),
      skills: Object.entries(run.skills).map(([id, level]) => ({ id, level, tip: skillTip(id, run.skills) })),
      keys, muted: audio.muted, toast: game.toast, levelUp: game.levelUp, avatar: game.avatar, wardrobe: game.dressing,
      difficulty: run.difficulty, points: run.points, combo: { links: run.combo.links, floor: run.combo.floor, pop: game.combo }, aim: aim(), blink: blinkPreview(), doubled: run.doubled === run.index,
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

  function leave() {
    stop();
    onQuit?.();
  }

  function stop() {
    game.running = false;
    keepBest();
    audio.stop();
    worker?.terminate();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', releaseKeys);
    document.removeEventListener('visibilitychange', releaseKeys);
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
  window.addEventListener('blur', releaseKeys);
  document.addEventListener('visibilitychange', releaseKeys);
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
  return { stop, restart: newClimb, press, tap, designed, toggleTest: () => { if (game.editing) enterTest(); else enterBuild(); }, rebuilt, settingsChanged: () => { renderer.forget(game.run.level); rebuilt(); } };
}
