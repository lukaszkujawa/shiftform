import { generateBiome } from '../src/generation/generator.js';
import { initialState } from '../src/world/physics.js';
import { HEIGHT, objectRect } from '../src/world/level.js';
import { hallOf } from '../src/world/tunnel.js';
import { THEMES } from '../src/art/themes.js';
import { createAvatar } from '../src/art/avatar.js';
import { createRenderer } from '../src/gl/renderer.js';

const params = new URLSearchParams(location.hash.slice(1));
const seed = params.get('seed') ?? 'amber-1', index = +(params.get('index') ?? 0);
const themeId = params.get('theme');
const theme = themeId ? THEMES.findIndex(t => t.id === themeId) : null;
const base = generateBiome(seed, index, 2);
const level = params.has('hall') ? hallOf(base) : base;
if (theme !== null) Object.assign(level, { theme }), Object.assign(base, { theme });
const state = { ...initialState(level), clock: +(params.get('clock') ?? 0), lurkers: [] };
const focus = params.get('type') && level.objects.find(o => o.type === params.get('type') && (!params.get('kind') || o.kind === params.get('kind')));
const target = focus ? objectRect(focus, 0) : null;
const camera = Math.max(0, Math.min(level.height - HEIGHT, target ? target.y - HEIGHT / 2 : +(params.get('y') ?? level.height - HEIGHT)));
if (params.has('px')) Object.assign(state, { x: +params.get('px'), y: +params.get('py') });
const canvas = document.querySelector('#game');
const renderer = createRenderer(canvas);
renderer.fit();
const avatar = createAvatar(seed);
const ticking = params.get('still') === null;
const startedAt = performance.now();

function frame(now) {
  if (ticking) state.clock = +(params.get('clock') ?? 0) + (now - startedAt) / (1000 / 60);
  renderer.draw({
    level, state, time: now, seed, camera, above: null, below: null, avatar, backdrop: true,
    trail: [], particles: [], touched: [], planted: [], path: [], keys: {}, altitude: 0, difficulty: +(params.get('difficulty') ?? 2), freeSkill: true,
  });
  requestAnimationFrame(frame);
}

window.gallery = { level, state, objects: () => level.objects.map(({ id, type, kind, x, y, w, h }) => ({ id, type, kind, x, y, w, h })) };
requestAnimationFrame(frame);
