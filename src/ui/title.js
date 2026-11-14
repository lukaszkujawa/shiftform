import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, WIDTH, HEIGHT } from '../world/level.js';
import { buildRules } from '../world/rules.js';
import { createRenderer } from '../gl/renderer.js';
import { step, initialState } from '../world/physics.js';
import { createAvatar, stepAvatar } from '../art/avatar.js';
import { THEMES } from '../art/themes.js';

const SWITCH_MS = 9000;
const FADE_MS = 900;
const DRIFT = { span: 260, ms: 18000 };
const SIGN_LIGHT = { power: 1700, flicker: 0.12, chase: 140 };
const FRAME_MS = 1000 / 60;
const IDLE = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
const SCRIPT = [
  [90, {}], [26, { right: true }], [70, {}], [20, { left: true }], [16, { left: true, jump: true }], [50, {}], [120, {}],
  [14, { right: true }], [16, { jump: true }], [40, {}], [18, { left: true }], [100, {}],
];

function sampleLevel(theme, palette) {
  const level = createLevel(buildRules([]), [], 36);
  Object.assign(level, { index: 1, palette, theme, title: '', segments: [], entryCol: 4, exit: { x: 0, y: -300, w: 0, h: 0 } });
  fillTiles(level, 0, 31, 32, 5, SOLID);
  for (const [c, r, w] of [[1, 27, 5], [26, 27, 4], [11, 24, 4], [18, 21, 5], [25, 18, 5], [6, 18, 4], [13, 15, 6], [22, 11, 4], [2, 12, 5]]) fillTiles(level, c, r, w, 1, SOLID);
  fillTiles(level, 9, 21, 3, 1, ONE_WAY);
  addObject(level, { type: 'crate', kind: 'wood', x: 27 * TILE + 1, y: 27 * TILE - 28, w: 28, h: 28 });
  addObject(level, { type: 'climb', x: 19 * TILE + 5, y: 15 * TILE, w: 20, h: 6 * TILE });
  addObject(level, { type: 'monster', kind: 'patroller', x: 18 * TILE + 2, y: 21 * TILE - 20, w: 22, h: 20, dx: 120, dy: 0, period: 300, phase: 0 });
  addObject(level, { type: 'monster', kind: 'hopper', motion: 'hop', x: 11 * TILE + 2, y: 24 * TILE - 20, w: 22, h: 20, dx: 4 * TILE - 26, dy: 0, lift: 60, period: 240, phase: 60 });
  addObject(level, { type: 'monster', kind: 'flapper', x: 9 * TILE, y: 17 * TILE, w: 22, h: 20, dx: 0, dy: 90, period: 240, phase: 30 });
  addObject(level, { type: 'spring', x: 7 * TILE + 4, y: 31 * TILE - 12, w: TILE - 8, h: 12, dir: -1, vel: 13 });
  for (let i = 0; i < 4; i++) addObject(level, { type: 'coin', x: (12 + i * 1.3) * TILE, y: 22 * TILE - 40 - Math.abs(i - 1.5) * 12, w: 14, h: 14 });
  addObject(level, { type: 'item', kind: ['jetpack', 'bow', 'boots', 'shield'][palette % 4], x: 27 * TILE, y: 18 * TILE - 24, w: 20, h: 20 });
  addObject(level, { type: 'checkpoint', x: 4 * TILE, y: 12 * TILE - 40, w: 24, h: 40 });
  level.start = { x: 3 * TILE, y: 31 * TILE - 26 };
  return level;
}

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function createTitleScene(canvas, sign, onTheme = () => {}) {
  const order = shuffled(THEMES.map((_, i) => i));
  let next = 0, frame = 0, scene = null, renderer = null, startedAt = 0, lastAt = 0, carry = 0, fadingAt = 0;
  const fit = () => renderer?.fit();

  function build(now) {
    const theme = order[next++ % order.length];
    const level = sampleLevel(theme, Math.floor(Math.random() * 360));
    onTheme(THEMES[theme]);
    renderer.forget(scene?.level);
    return { level, s: initialState(level), avatar: createAvatar(String(Math.random())), at: 0, left: SCRIPT[0][0], since: now };
  }

  function input() {
    if (--scene.left <= 0) { scene.at = (scene.at + 1) % SCRIPT.length; scene.left = SCRIPT[scene.at][0]; }
    return { ...IDLE, ...SCRIPT[scene.at][1] };
  }

  function advance() {
    const prev = scene.s;
    scene.s = step(scene.level, prev, input());
    if (scene.s.dead) scene.s = initialState(scene.level);
    stepAvatar(scene.avatar, scene.level, prev, scene.s, []);
  }

  function loop(now) {
    if (!frame) return;
    frame = requestAnimationFrame(loop);
    if (!fadingAt && now - scene.since > SWITCH_MS) { fadingAt = now; renderer.fade(true); }
    if (fadingAt && now - fadingAt > FADE_MS) { fadingAt = 0; scene = build(now); renderer.fade(false); }
    carry += Math.min(100, now - lastAt);
    lastAt = now;
    while (carry >= FRAME_MS) { advance(); carry -= FRAME_MS; }
    const camera = scene.level.height - HEIGHT - 60 - DRIFT.span * (0.5 - 0.5 * Math.cos(((now - startedAt) / DRIFT.ms) * Math.PI * 2));
    renderer.draw({
      level: scene.level, state: scene.s, time: now, seed: 'title', camera, below: null, above: null, ghost: null, rival: null, trail: [], particles: [], flash: 0, shake: 0,
      lives: 3, over: false, altitude: 300, best: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, building: null, keys: IDLE, muted: true, toast: null, avatar: scene.avatar, backdrop: true,
    });
    const box = sign.getBoundingClientRect(), flicker = Math.floor(now / SIGN_LIGHT.chase) % 3 === 0 ? 1 - SIGN_LIGHT.flicker : 1;
    renderer.beacon(box.left + box.width / 2, box.top + box.height / 2, SIGN_LIGHT.power * flicker);
  }

  return {
    start() {
      if (frame) return;
      startedAt = lastAt = performance.now();
      renderer = createRenderer(canvas, { cover: true });
      fit();
      window.addEventListener('resize', fit);
      scene = build(startedAt);
      frame = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('resize', fit);
      renderer?.stop();
      renderer = scene = null;
    },
  };
}
