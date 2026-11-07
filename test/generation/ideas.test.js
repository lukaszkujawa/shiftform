import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { DEFAULT_DESIGN } from '../../src/generation/design.js';
import { IDEAS } from '../../src/generation/ideas.js';
import { blueprintFromLevel, proofHolds } from '../../src/builder/from-level.js';
import { assertChains } from './helpers.js';
import { createLevel, fillTiles, SOLID } from '../../src/world/level.js';
import { buildRules } from '../../src/world/rules.js';
import { Rng } from '../../src/world/rng.js';
import { solve } from '../../src/generation/solver.js';
import { initialState, playerSize } from '../../src/world/physics.js';

const asking = (idea, seed) => generateBiome(seed, 3, null, [], null, () => {}, [], { ...DEFAULT_DESIGN, idea, stretches: 4 });
const layout = level => level.tiles.join('');
const IDEA_SEEDS = ['a', 'b', 'c', 'd', 'e'];

for (const { id, title } of IDEAS) {
  test(`${title} is proven in a real climb, varies by seed and survives the builder`, () => {
    const levels = IDEA_SEEDS.map(suffix => asking(id, `${id}-${suffix}`)).filter(level => level.segments.some(segment => segment.idea === id));
    assert.ok(levels.length >= 2, `${levels.length} of ${IDEA_SEEDS.length} kept the idea`);
    for (const level of levels) assertChains(level);
    assert.notEqual(layout(levels[0]), layout(levels[1]));
    assert.ok(proofHolds(levels[0], blueprintFromLevel(levels[0])));
  });
}

test('asking for a set piece keeps it at every length, and Free Flight flies every stretch', () => {
  for (const stretches of [1, 2]) {
    const level = generateBiome(`short-${stretches}`, 4, null, [], null, () => {}, [], { ...DEFAULT_DESIGN, idea: 'flight', stretches });
    assert.deepEqual(level.segments.map(segment => segment.idea), Array(stretches).fill('flight'));
    assert.ok(generateBiome(`short-${stretches}`, 4, null, [], null, () => {}, [], { ...DEFAULT_DESIGN, idea: 'fork', stretches }).segments.some(segment => segment.idea === 'fork'));
  }
});

test('asking for no set piece leaves them out', () => {
  assert.ok(!asking('never', 'no-idea').segments.some(segment => segment.idea));
});

test('the Fork seals each side: no way across between the tunnels, and no way back down from the top', () => {
  const rules = buildRules([]), size = playerSize(rules), entry = { col: 6, row: 33, w: 4, kind: 'tiles' };
  const level = createLevel(rules, [], 36);
  fillTiles(level, entry.col, entry.row, entry.w, 3, SOLID);
  const fork = IDEAS.find(idea => idea.id === 'fork').raise({ level, rng: new Rng(7), rules, size, design: DEFAULT_DESIGN, cave: false, clearance: 4, difficulty: 0.5 }, entry, 5, 0.5);
  const easy = fork.route[3], greedy = fork.alternates[0][3], top = fork.route.at(-1);
  const reaches = (from, to) => !!solve(level, { start: { ...initialState(level), x: from.x - size.w / 2, y: from.y - size.h / 2, grounded: true }, goal: s => Math.abs(s.x + size.w / 2 - to.x) <= to.w / 2 && Math.abs(s.y + size.h / 2 - to.y) <= size.h / 2 + 4, route: [to], maxNodes: 40000 });
  for (const [from, to] of [[easy, greedy], [greedy, easy], [top, easy], [top, greedy]]) assert.equal(reaches(from, to), false);
});
