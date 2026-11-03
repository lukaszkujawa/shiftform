import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { sample } from './render-fixtures.js';
import { addObject, HEIGHT, TILE } from '../src/world/level.js';
import { initialState } from '../src/world/physics.js';
import { PATTERNS } from '../src/art/tile-patterns.js';
import { THEMES } from '../src/art/themes.js';
import { createAvatar, DROWSY_FRAMES, ASLEEP_FRAMES } from '../src/art/avatar.js';
import { hallOf, STALLS } from '../src/world/tunnel.js';
import { BLOCKS, blankBlueprint, levelFrom } from '../src/builder/blueprint.js';
import { createEditor } from '../src/builder/editor.js';
import { generateBiome } from '../src/generation/generator.js';
import { createRun, advance } from '../src/world/run.js';

const SAVED = new URL('../.fingerprint.json', import.meta.url);
const GENERATED = [['print-a', 0], ['print-a', 1], ['print-b', 0], ['print-b', 2], ['print-c', 3]];
const KEYS = { left: false, right: false, jump: false, dash: false, interact: false, up: false, down: false };
const STUB = Symbol('stub');
const isStub = value => typeof value === 'function' && value[STUB];
const written = value => (isStub(value) ? '#' : typeof value === 'function' ? 'fn' : value && typeof value === 'object' ? JSON.stringify(value) : String(value));

function recorder() {
  const hash = createHash('sha1');
  let calls = 0;
  const note = line => { calls++; hash.update(`${line}\n`); };
  const context = () => {
    const values = {};
    const stub = new Proxy(() => stub, {
      get(_, key) {
        if (key === STUB) return true;
        if (key === Symbol.toPrimitive) return () => 0;
        if (key in values) return values[key];
        if (key === 'measureText') return text => { note(`measure ${text}`); return { width: 10 }; };
        return (...args) => { note(`${String(key)} ${args.map(written).join()}`); return stub; };
      },
      set(_, key, value) { note(`${String(key)}= ${written(value)}`); values[key] = value; return true; },
      apply: () => stub,
    });
    return stub;
  };
  const canvas = () => { const ctx = context(); return { width: 0, height: 0, style: {}, getContext: () => ctx }; };
  return { context, canvas, result: () => `${calls}:${hash.digest('hex')}` };
}

function seededRandom(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

const baseView = (level, state, more = {}) => ({ level, state, time: 500, seed: 'print', camera: level.height - HEIGHT, below: null, above: null, ghost: null, rival: null, trail: [], particles: [], flash: 0, shake: 0, lives: 2, maxLives: 3, over: false, altitude: 100, best: 0, record: 0, biomeIndex: 1, bannerAge: 1e9, touched: [], frozen: false, building: null, keys: KEYS, muted: true, toast: null, collected: [], points: 42, runes: 2, skills: [], inventory: { kinds: [], counts: [], active: null }, combo: { links: 0, floor: null, pop: null }, planted: [], path: [], stall: null, ...more });

function themeViews(level, index) {
  const start = initialState(level);
  const placed = [{ kind: 'tomb', x: 200, y: 500, w: 26, h: 18, id: -1, from: 500, born: 0, path: [[200, 500]] }, { kind: 'plank', x: 300, y: 600, w: 90, h: 30, id: -1 }, { kind: 'trampoline', x: 400, y: 660, w: 60, h: 12, id: -1 }, { kind: 'ladder', x: 500, y: 500, w: 20, h: 180, id: -1 }];
  const avatar = mood => ({ ...createAvatar(`print-${index}`), ...mood });
  return [
    baseView(level, start, { time: 0, avatar: avatar({ joy: 10, hat: 'crown', glasses: 'round', pattern: 'spots' }), shop: { offer: ['jetpack', 'erase', 'plank'], bought: ['plank'], affordable: [true, false, false] }, toast: { kind: 'bow', text: 'Bow: five arrows', age: 400, ms: 3000 } }),
    baseView(level, { ...start, comet: 4, cometWait: 2, vy: -6, placed, flying: [{ x: 90, y: 700, w: 14, h: 4, vx: 6, vy: -1 }] }, { avatar: avatar({ still: DROWSY_FRAMES + 1, hat: 'tophat', glasses: 'monocle', pattern: 'stripes' }), rival: { index: 1, state: { ...start, x: start.x + 60 }, altitude: 140, done: false }, combo: { links: 5, floor: 700, pop: { links: 5, age: 3, word: 'great', wordAge: 3 } }, inventory: { kinds: ['plank', 'ladder', 'trampoline'], counts: [2, 1, 1], active: 'plank' }, planted: [{ x: 200, y: 860, w: 24, h: 40 }], aim: { kind: 'plank', rect: { kind: 'plank', x: 300, y: 500, w: 90, h: 30 }, x: 340, y: 510 }, flash: 0.3, shake: 4, trail: [{ x: 100, y: 800 }, { x: 110, y: 800 }], particles: [{ x: 90, y: 800, size: 3, life: 10, maxLife: 20, color: 'red' }, { x: 95, y: 805, size: 3, life: 10, maxLife: 20, color: 'blue', puff: true }], path: [{ x: 100, y: 800, frame: 1 }, { x: 110, y: 790, frame: 2, death: 'saw' }], echo: { points: [{ x: 100, y: 800 }, { x: 120, y: 780 }], age: 200, ms: 2600 }, blink: { x: 200, y: 700 }, architect: { state: { ...start, x: start.x + 40 }, started: true, done: false }, ghost: { ...start, x: start.x + 20 }, record: 40 }),
    baseView(level, { ...start, comet: 2, cometMissed: true, jetting: true, shield: true, invuln: 8 }, { time: 4000, avatar: avatar({ still: ASLEEP_FRAMES + 1, blink: 3, hat: null, accessory: 'bow', glasses: 'shades', pattern: 'belly', tint: 'hsl(35 90% 82% / 1)' }), rival: { index: 2, state: null, altitude: 900, done: true }, combo: { links: 3, floor: 900, pop: null }, quitting: true, inventory: { kinds: ['erase'], counts: [1], active: null }, aim: { kind: 'erase', object: level.objects.find(o => o.type === 'monster'), x: 70, y: 890 }, building: { fraction: 0.4, stage: 'proving stretch 2 of 4', phrase: 'Tuning the saws' }, doubled: true, frozen: true, levelUp: { ids: ['moon'], reward: { runes: 1, gold: 100 }, age: 1200, ms: 5200 }, perfect: { age: 10, ms: 2600 }, over: true }),
  ];
}

async function drawing(name, paint) {
  const { context, canvas, result } = recorder();
  globalThis.OffscreenCanvas = class { constructor() { return canvas(); } };
  globalThis.Path2D = class { constructor() { return context(); } };
  Math.random = seededRandom(97);
  const { createRenderer } = await import('../src/art/render.js');
  const { drawBlockIcon, drawLevelMap } = await import('../src/builder/editor-art.js');
  await paint({ canvas, renderer: createRenderer(canvas()), drawBlockIcon, drawLevelMap });
  return [`draw ${name}`, result()];
}

const drawings = [
  ...THEMES.map((theme, i) => () => drawing(`theme ${theme.id}`, ({ renderer }) => {
    const level = sample(i);
    for (const view of themeViews(level, i)) renderer.draw(view);
  })),
  ...THEMES.map((theme, i) => () => drawing(`flood ${theme.id}`, ({ renderer }) => {
    const level = sample(i);
    level.rules = { ...level.rules, flood: 1, darkness: true, baseGravDir: -1, jumpFlipChance: 0.5 };
    renderer.draw(baseView(level, { ...initialState(level), tide: 500 }, { light: 1.2 }));
  })),
  ...Object.keys(STALLS).map(id => () => drawing(`stall ${id}`, async ({ renderer }) => {
    const hall = hallOf(sample(3));
    const offers = { merchant: { offer: ['jetpack', 'plank', 'extraHeart'], bought: ['plank'], affordable: [true, false, false] }, trainer: { skills: [{ id: 'dash', level: 2, price: 3, affordable: true, tip: {} }, { id: 'torch', level: 0, price: 0, affordable: false, tip: {} }] }, dicer: { dice: true, affordable: true } };
    renderer.draw(baseView(hall, { ...initialState(hall), x: STALLS[id], y: 17 * TILE - 26 }, { camera: 0, stall: { id, age: 400, ...offers[id] } }));
  })),
  () => drawing('logic', ({ renderer }) => {
    const level = sample(0);
    level.wires = [];
    addObject(level, { type: 'cling', x: 30, y: 600, w: 12, h: 120 });
    ['and', 'or', 'xor'].forEach((op, i) => {
      const gate = { op, mask: 3, not: 2, x: 200 + i * 90, y: 700, dir: i % 2 ? -1 : 1 };
      addObject(level, { type: 'door', x: 200 + i * 90, y: 720, w: TILE, h: 60, bit: 3, gate });
      level.wires.push({ gate, points: [[gate.x, gate.y], [gate.x, 760]] });
    });
    level.wires.push({ bit: 2, points: [[100, 700], [100, 760]] });
    renderer.draw(baseView(level, initialState(level)));
    renderer.draw(baseView(level, { ...initialState(level), flags: 1 }));
    renderer.draw(baseView(level, initialState(level), { editing: { at: null, rect: null, erasing: false, wiring: false, timing: false, linking: null, items: [] }, toast: { kind: null, text: 'Cleared', age: 1, ms: 3000 }, quitting: true }));
    renderer.drawLoading({ fraction: 0.5, stage: 'proving', phrase: 'Tuning the saws' });
  }),
  () => drawing('patterns', ({ canvas }) => {
    const p = THEMES[0].palette(200), ctx = canvas().getContext();
    for (const paint of Object.values(PATTERNS)) paint(ctx, p, 30, 60, seededRandom(5));
  }),
  () => drawing('builder', ({ canvas, renderer, drawBlockIcon, drawLevelMap }) => {
    const editor = createEditor(blankBlueprint(72));
    BLOCKS.forEach((block, i) => editor.place(block, { c: 2 + (i % 12) * 2, r: 5 + Math.floor(i / 12) * 10, w: block.size?.[0] ?? 1, h: block.size?.[1] ?? 1 }));
    const level = levelFrom(editor.blueprint), theme = THEMES[0], p = theme.palette(200), items = editor.blueprint.items;
    const editing = { at: { c: 3, r: 3 }, rect: { c: 3, r: 3, w: 2, h: 1 }, erasing: false, wiring: false, timing: false, linking: null, items };
    for (const block of BLOCKS) {
      renderer.draw(baseView(level, initialState(level), { camera: 0, editing: { ...editing, block } }));
      const icon = canvas();
      icon.width = 48;
      drawBlockIcon(icon, block, level, theme, p);
    }
    renderer.draw(baseView(level, initialState(level), { camera: 0, editing: { ...editing, wiring: true, linking: items[0].u, block: null } }));
    renderer.draw(baseView(level, initialState(level), { camera: 0, editing: { ...editing, timing: true, block: null, erasing: true } }));
    drawLevelMap(canvas(), editor.blueprint);
  }),
];

function climbed(level, seed) {
  const biomes = () => level, run = createRun(3, seed), hash = createHash('sha1');
  advance(run, biomes);
  for (const segment of level.segments) {
    run.s = { ...segment.start, frame: run.s.frame, flipFrame: -100 };
    for (const input of segment.inputs) { advance(run, biomes, input); hash.update(JSON.stringify(run.s)); }
  }
  return hash.digest('hex');
}

function generated([seed, index]) {
  const level = generateBiome(seed, index, null, []);
  const body = createHash('sha1').update(JSON.stringify(level)).digest('hex');
  return [[`level ${seed}/${index}`, body], [`climb ${seed}/${index}`, climbed(level, seed)]];
}

const results = {};
for (const paint of drawings) {
  const [name, value] = await paint();
  results[name] = value;
}
if (!process.argv.includes('--draw')) for (const biome of GENERATED) for (const [name, value] of generated(biome)) results[name] = value;

if (process.argv.includes('--save')) {
  writeFileSync(SAVED, JSON.stringify(results, null, 1));
  console.log(`saved ${Object.keys(results).length} fingerprints`);
} else if (!existsSync(SAVED)) {
  console.error('no baseline: run with --save first');
  process.exit(2);
} else {
  const saved = JSON.parse(readFileSync(SAVED));
  const changed = Object.keys(results).filter(name => saved[name] !== results[name]);
  for (const name of changed) console.log(`changed: ${name}`);
  console.log(`${Object.keys(results).length - changed.length}/${Object.keys(results).length} fingerprints match`);
  if (changed.length) process.exit(1);
}
