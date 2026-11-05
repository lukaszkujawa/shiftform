import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generation/generator.js';
import { DEFAULT_DESIGN } from '../../src/generation/design.js';
import { IDEAS } from '../../src/generation/ideas.js';
import { blueprintFromLevel, proofHolds } from '../../src/builder/from-level.js';
import { assertChains } from './helpers.js';

const asking = (idea, seed) => generateBiome(seed, 3, null, [], null, () => {}, [], { ...DEFAULT_DESIGN, idea, stretches: 4 });
const layout = level => level.tiles.join('');

for (const { id, title } of IDEAS) {
  test(`${title} is proven in a real climb, varies by seed and survives the builder`, () => {
    const levels = [`${id}-a`, `${id}-b`, `${id}-c`].map(seed => asking(id, seed)).filter(level => level.segments.some(segment => segment.idea === id));
    assert.ok(levels.length >= 2, `${levels.length} of 3 kept the idea`);
    for (const level of levels) assertChains(level);
    assert.notEqual(layout(levels[0]), layout(levels[1]));
    assert.ok(proofHolds(levels[0], blueprintFromLevel(levels[0])));
  });
}

test('asking for no set piece leaves them out', () => {
  assert.ok(!asking('never', 'no-idea').segments.some(segment => segment.idea));
});
