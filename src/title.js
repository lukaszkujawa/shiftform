import { createLevel, fillTiles, addObject, SOLID, ONE_WAY, TILE, WIDTH, HEIGHT } from './level.js?v=5f043fa';
import { buildRules } from './rules.js?v=5f043fa';
import { createRenderer } from './render.js?v=5f043fa';
import { step, initialState } from './physics.js?v=5f043fa';
import { createAvatar, stepAvatar } from './avatar.js?v=5f043fa';
import { THEMES } from './themes.js?v=5f043fa';

const SWITCH_MS = 9000;
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

export function createTitleScene(canvases, onTheme = () => {}) {
  const order = shuffled(THEMES.map((_, i) => i));
  let next = 0, live = 0, frame = 0, scene = null, startedAt = 0, lastAt = 0, carry = 0;

  function fit(canvas) {
    const k = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = WIDTH * k;
    canvas.height = HEIGHT * k;
    canvas.getContext('2d').setTransform(k, 0, 0, k, 0, 0);
  }

  function build(canvas) {
    fit(canvas);
    const theme = order[next++ % order.length];
    const level = sampleLevel(theme, Math.floor(Math.random() * 360));
    const s = initialState(level);
    onTheme(THEMES[theme]);
    return { renderer: createRenderer(canvas), level, s, avatar: createAvatar(String(Math.random())), at: 0, left: SCRIPT[0][0], since: performance.now() };
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

  function swap(now) {
    live = 1 - live;
    const canvas = canvases[live];
    scene = build(canvas);
    canvas.style.transition = 'none';
    canvas.style.opacity = '0';
    canvas.style.zIndex = '1';
    canvases[1 - live].style.zIndex = '0';
    void canvas.offsetWidth;
    canvas.style.transition = '';
    canvas.style.opacity = '1';
    scene.since = now;
  }

  function loop(now) {
    if (!frame) return;
    frame = requestAnimationFrame(loop);
    if (now - scene.since > SWITCH_MS) swap(now);
    carry += Math.min(100, now - lastAt);
    lastAt = now;
    if (carry < FRAME_MS) return;
    while (carry >= FRAME_MS) { advance(); carry -= FRAME_MS; }
    const camera = scene.level.height - HEIGHT - 30 - 30 * Math.sin((now - startedAt) / 5000);
    scene.renderer.draw({
      level: scene.level, state: scene.s, time: now, seed: 'title', camera, below: null, above: null, ghost: null, rival: null, trail: [], particles: [], flash: 0, shake: 0,
      lives: 5, over: false, altitude: 300, best: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, building: null, keys: IDLE, muted: true, toast: null, avatar: scene.avatar, backdrop: true,
    });
  }

  return {
    start() {
      if (frame) return;
      startedAt = lastAt = performance.now();
      scene = build(canvases[live]);
      canvases[live].style.opacity = '1';
      canvases[live].style.zIndex = '1';
      frame = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
