import { playerSize } from '../world/physics.js?v=c6cd642';
import { levelIndex, objectRect, hazardRect, HEIGHT, TILE } from '../world/level.js?v=c6cd642';
import { COMBO_FROM, MILESTONES } from '../world/combo.js?v=c6cd642';
import { TRICKS } from '../world/tricks.js?v=c6cd642';
import { KINDS } from '../world/items.js?v=c6cd642';
import { soundEvents } from './sounds.js?v=c6cd642';
import { createAvatar, stepAvatar, cheer } from '../art/avatar.js?v=c6cd642';
import { loadOutfit } from '../ui/wardrobe.js?v=c6cd642';
import { causeOfDeath } from './devtools.js?v=c6cd642';

const HIT_STOP = { stomp: 5, death: 9, cometPerfect: 3, crush: 4, fanfare: 2 };
export const ECHO = { frames: 90, ms: 2600 };
const PERFECT_MS = 2600;
const COIN_COLOR = 'hsl(48 95% 60% / 1)';
export const FIREWORKS = { frames: 100, every: 8, colors: [COIN_COLOR, 'hsl(0 90% 65% / 1)', 'hsl(200 90% 65% / 1)', 'hsl(130 80% 60% / 1)', 'hsl(0 0% 100% / 1)'] };
const TOAST_MS = 3200;
const LEVEL_UP_MS = 5200;
export const TIP_MS = 6000;
const isItem = kind => KINDS.some(([k]) => k === kind);
const cardText = kind => `${TRICKS[kind].title}: ${TRICKS[kind].text}`;

export function createReactions({ game, seed, audio, renderer, burst, spray, puff, architectView, ownedKinds, announce, keepBest, onOver }) {
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

  function stepped({ level, prev, s, checkpoint }) {
    game.prevClock = prev.clock;
    const palette = renderer.paletteFor(level);
    const { w, h } = playerSize(level.rules);
    const events = soundEvents(level, prev, s);
    for (const dust of stepAvatar(game.avatar, level, prev, s, events)) puff(dust, palette.dim);
    for (const event of events) {
      audio.play(event.type === 'jump' ? { ...event, links: game.run.combo.links } : event);
      game.freeze = Math.max(game.freeze, HIT_STOP[event.type] ?? 0);
      if (event.type === 'item') collected(event.kind);
      if (event.type === 'stomp') game.shake = 4;
      if (event.type === 'kick') burst(s.x + (event.side > 0 ? w : 0), s.y + h * 0.8, palette.dim, 8, 2);
      if (event.type === 'longJump') spray(s.x + w / 2, s.gravDir > 0 ? s.y + h : s.y, palette.accent, s.gravDir);
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
      game.levelUp = { ids: event.unlocked, reward: event.reward, raced: event.raced, age: 0, ms: LEVEL_UP_MS };
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
    } else if (event.type === 'learned') {
      audio.play({ type: 'item' });
      game.flash = 0.2;
    } else if (event.type === 'difficulty') {
      audio.play({ type: 'fanfare', links: 8 + event.difficulty * 4 });
      Object.assign(game, { flash: 0.3, shake: event.difficulty * 3, bannerAge: 0 });
    }
    if (event.type === 'restore' || event.type === 'reset' || event.type === 'difficulty') {
      game.prevGravDir = run.s.gravDir;
      game.avatar = createAvatar(seed, loadOutfit());
      game.trail = [];
      game.recent = [];
      game.ahead = false;
      if (event.type !== 'restore') Object.assign(game, { echo: null, path: [] });
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
      const rect = hazardRect(event.object, run.s);
      audio.play({ type: 'erase' });
      game.shake = 4;
      burst(rect.x + rect.w / 2, rect.y + rect.h / 2, renderer.paletteFor(run.level).hazard, 20, 4);
    } else if (event.type === 'over') {
      keepBest();
      audio.play({ type: 'gameOver' });
      onOver?.({ metres: run.peak, best: game.best, deaths: run.deaths, points: run.earned, path: run.path, recording: game.recording });
    }
  }

  return { react };
}
