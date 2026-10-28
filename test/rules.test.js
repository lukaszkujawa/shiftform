import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, jumpProfile, chargedProfile, compatible, mutatorById } from '../src/rules.js';

test('flywheel rule is off by default and on with the mutator', () => {
  assert.equal(buildRules([]).flywheel, false);
  assert.equal(buildRules(['flywheel']).flywheel, true);
});

test('a charged jump is about 1.5x higher and about 2x longer than a standing one', () => {
  const rules = buildRules(['flywheel']);
  const standing = jumpProfile(rules), charged = chargedProfile(rules);
  assert.ok(charged.height / standing.height > 1.5 && charged.height / standing.height < 1.65);
  assert.ok(charged.reach / standing.reach > 1.8 && charged.reach / standing.reach < 2);
});

test('flywheel excludes Caffeine and Blink', () => {
  const flywheel = mutatorById('flywheel');
  assert.equal(compatible([flywheel], mutatorById('sprint')), false);
  assert.equal(compatible([flywheel], mutatorById('dash')), false);
  assert.equal(compatible([flywheel], mutatorById('moon')), true);
});
