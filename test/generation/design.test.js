import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { DEFAULT_DESIGN } from '../../src/generation/design.js';
import { BUILDER_STYLES } from '../../src/generation/focus.js';
import { FUN_FLAVORS, funScore, funSignals } from '../../src/generation/fun.js';
import { TILE, HAZARD_TYPES } from '../../src/world/level.js';
import { blueprintFromLevel, designSummary, proofHolds } from '../../src/builder/from-level.js';
import { checkBlueprint, encodeBlueprint, decodeBlueprint, levelFrom, isTimedItem } from '../../src/builder/blueprint.js';
import { createEditor, hoveredTimed } from '../../src/builder/editor.js';

const designed = (seed, over = {}) => {
  const design = { ...DEFAULT_DESIGN, ...over };
  return generateBiome(seed, design.difficulty, null, [], design.style, () => {}, [], design);
};
const killers = level => level.objects.filter(o => HAZARD_TYPES.has(o.type));
const isMonster = o => o.type === 'monster' || o.type === 'lurker';

test('the same seed and settings give the same level', () => {
  assert.deepEqual(JSON.stringify(designed('same')), JSON.stringify(designed('same')));
});

test('length picks the height, in whole screens', () => {
  for (const stretches of [1, 2, 3, 4]) assert.equal(designed(`tall-${stretches}`, { stretches }).rows, stretches * 18);
});

test('none means none, and more means more', () => {
  for (const seed of ['calm-a', 'calm-b', 'calm-c']) assert.deepEqual(killers(designed(seed, { monsters: 'none', hazards: 'none', difficulty: 6 })).map(o => o.type), [], seed);
  const total = (over, test) => ['more-a', 'more-b', 'more-c'].reduce((sum, seed) => sum + designed(seed, { difficulty: 5, ...over }).objects.filter(test).length, 0);
  assert.ok(total({ monsters: 'swarm' }, isMonster) > total({ monsters: 'some' }, isMonster));
  const danger = o => HAZARD_TYPES.has(o.type) && !isMonster(o);
  assert.ok(total({ hazards: 'lots' }, danger) > total({ hazards: 'some' }, danger));
});

test('switching a monster off keeps it out', () => {
  const kinds = DEFAULT_DESIGN.kinds.filter(kind => kind !== 'patroller' && kind !== 'flapper');
  for (const seed of ['kind-a', 'kind-b']) assert.ok(!designed(seed, { kinds, monsters: 'swarm', difficulty: 6 }).objects.some(o => ['patroller', 'flapper'].includes(o.kind)), seed);
});

test('coins, floods and synced devices do what they say', () => {
  assert.equal(designed('coins', { coins: 'none', flooded: 'always', stretches: 3 }).objects.filter(o => o.type === 'coin').length, 0);
  assert.ok(designed('flood', { flooded: 'always', stretches: 4 }).segments.some(s => s.sunken));
  assert.ok(!designed('flood', { flooded: 'never', stretches: 4 }).segments.some(s => s.sunken));
  const handles = designed('sync', { style: 'momentum', devices: 'synced', stretches: 3 }).objects.filter(o => o.grip && o.motion !== 'orbit');
  assert.ok(handles.length && handles.every(o => o.phase === 0));
});

test('every style survives becoming a blueprint with its proof intact', () => {
  for (const { id } of BUILDER_STYLES.slice(0, 8)) {
    const level = designed(`style-${id}`, { style: id, difficulty: 3 }), blueprint = blueprintFromLevel(level, { title: 'x', theme: 1 });
    assert.ok(proofHolds(level, blueprint), id);
    assert.ok(designSummary(level, blueprint, [], DEFAULT_DESIGN).proven, id);
  }
});

test('a generated level survives a share link, compactly', async () => {
  const blueprint = blueprintFromLevel(designed('share', { stretches: 4, difficulty: 6 }), { title: 'x', theme: 1 });
  const text = await encodeBlueprint(blueprint), back = await decodeBlueprint(text);
  assert.deepEqual(levelFrom(back).objects, levelFrom(blueprint).objects);
  assert.ok(text.length < 4000, `${text.length} characters`);
});

test('generated devices get a start dial, moved by whole positions', () => {
  const blueprint = blueprintFromLevel(designed('dial', { style: 'momentum', stretches: 3, difficulty: 3 }), { title: 'x', theme: 1 });
  const device = blueprint.items.find(item => item.b === 'made' && isTimedItem(item));
  assert.ok(device);
  assert.equal(hoveredTimed(blueprint.items, (device.c + 0.5) * TILE, (device.r + 0.5) * TILE)?.u !== undefined, true);
  const before = levelFrom(blueprint).objects.find(o => o.grip).phase;
  const editor = createEditor(blueprint);
  assert.equal(editor.stepTiming(device.c, device.r), true);
  assert.equal(device.p, 1);
  assert.ok(Number.isFinite(levelFrom(editor.blueprint).objects.find(o => o.grip).phase), `from ${before}`);
});

test('editing clears the proven mark, renaming does not, and undo restores it', () => {
  const blueprint = blueprintFromLevel(designed('mark'), { title: 'x', theme: 1 });
  const editor = createEditor(blueprintFromLevel(designed('plain'), { title: 'y', theme: 1 }));
  editor.adopt(blueprint, true);
  assert.equal(editor.blueprint.proven, true);
  editor.set('title', 'renamed');
  assert.equal(editor.blueprint.proven, true);
  editor.remember();
  editor.changed();
  assert.equal(editor.blueprint.proven, undefined);
  editor.undo();
  assert.equal(editor.blueprint.proven, true);
});

test('a tampered share link is refused rather than crashing the game', async () => {
  const blueprint = blueprintFromLevel(designed('tamper'), { title: 'x', theme: 1 });
  const raw = JSON.parse(new TextDecoder().decode(await (await import('../../src/game/ghost.js')).decodeBytes(await encodeBlueprint(blueprint))));
  const madeAt = raw.i.findIndex(item => item[0] === 'made');
  for (const bad of [[{ type: 'start', x: 0, y: 0, w: 1, h: 1 }], [{ type: 'monster', kind: 'nope', x: 0, y: 0, w: 1, h: 1 }], [{ type: 'saw', x: 'a', y: 0, w: 1, h: 1 }], [{ type: 'saw', x: 0, y: 0, w: 1, h: 1, extra: {} }], [{ type: 'shot', sourceAt: 9, x: 0, y: 0, w: 1, h: 1 }], [], 'x']) {
    const copy = structuredClone(raw);
    copy.i[madeAt][8] = bad;
    assert.throws(() => checkBlueprint(copy), JSON.stringify(bad));
  }
});

test('the score reads how a level plays, each flavour weighs it differently, and it stays in range', () => {
  const signals = funSignals(designed('score', { stretches: 2, difficulty: 4 }));
  for (const value of Object.values(signals)) assert.ok(value >= 0 && value <= 1, JSON.stringify(signals));
  const scores = Object.keys(FUN_FLAVORS).map(flavor => funScore(signals, flavor));
  assert.ok(scores.every(score => score >= 0 && score <= 100));
  assert.ok(new Set(scores).size > 1, scores.join());
  assert.equal(funScore({ variety: 1, rhythm: 1, waiting: 1, chains: 1, closeCalls: 1, spikes: 1, space: 1 }), 100);
  assert.equal(funScore({ variety: 0, rhythm: 0, waiting: 0, chains: 0, closeCalls: 0, spikes: 0, space: 0 }), 0);
});

test('long levels keep their tracked things within the slots the game can count', () => {
  for (const [seed, over] of [['epic-a', { stretches: 12, monsters: 'swarm', difficulty: 6 }], ['epic-b', { stretches: 8, style: 'momentum' }]]) {
    const level = designed(seed, over);
    assert.equal(level.rows, over.stretches * 18);
    for (const type of ['monster', 'coin', 'item', 'refill']) assert.ok(level.objects.filter(o => o.type === type).length <= 31, `${seed} ${type}`);
    assert.ok(proofHolds(level, blueprintFromLevel(level, { title: 'x', theme: 1 })), seed);
  }
});

test('flooded stretches respect None too, and eels and jellyfish can be switched off', () => {
  const calm = designed('calm-flood', { flooded: 'always', stretches: 3, monsters: 'none', hazards: 'none' });
  assert.ok(calm.segments.some(segment => segment.sunken));
  assert.deepEqual(killers(calm).map(o => o.type), []);
  const kinds = DEFAULT_DESIGN.kinds.filter(kind => kind !== 'eel' && kind !== 'jelly');
  assert.ok(!designed('no-eels', { flooded: 'always', stretches: 3, kinds }).objects.some(o => o.kind === 'eel' || o.kind === 'jelly'));
});

test('a generated level is proven from where the climber really starts', () => {
  const level = designed('real-start'), blueprint = blueprintFromLevel(level, { title: 'x', theme: 1 });
  assert.equal(levelFrom(blueprint).start.x, level.start.x);
  assert.equal(levelFrom(blueprint).start.y, level.start.y);
});

