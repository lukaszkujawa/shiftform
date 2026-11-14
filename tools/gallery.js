import { generateBiome } from '../src/generation/generator.js';
import { initialState } from '../src/world/physics.js';
import { HEIGHT, objectRect } from '../src/world/level.js';
import { hallOf } from '../src/world/tunnel.js';
import { PURSUIT } from '../src/world/pursuit.js';
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
if (params.has('flood')) Object.assign(level.rules, { flood: 1 }), Object.assign(level, { pursuit: null }), Object.assign(state, { tide: level.height + PURSUIT.below - +params.get('flood') });
const canvas = document.querySelector('#game');
const renderer = createRenderer(canvas);
renderer.fit();
const avatar = createAvatar(seed);
const frozen = params.has('at') ? +params.get('at') : null, ticking = !params.has('still') && frozen === null;
const startedAt = performance.now();

function frame(clockNow) {
  const now = frozen ?? clockNow;
  if (ticking) state.clock = +(params.get('clock') ?? 0) + (now - startedAt) / (1000 / 60);
  renderer.draw({
    level, state, time: now, seed, camera, above: null, below: null, avatar, backdrop: true,
    trail: [], particles: [], touched: [], planted: [], path: [], keys: {}, altitude: +(params.get('altitude') ?? 0), difficulty: +(params.get('difficulty') ?? 2), freeSkill: true,
  });
  requestAnimationFrame(frame);
}

window.gallery = { level, state, objects: () => level.objects.map(({ id, type, kind, x, y, w, h }) => ({ id, type, kind, x, y, w, h })) };
requestAnimationFrame(frame);
