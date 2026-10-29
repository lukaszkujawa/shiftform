import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatter } from '../src/chatter.js';

test('waiting phrases are seeded nonsense that keeps changing', () => {
  assert.equal(chatter('amber-1', 2, 7), chatter('amber-1', 2, 7));
  const phrases = Array.from({ length: 12 }, (_, tick) => chatter('amber-1', 2, tick));
  assert.ok(new Set(phrases).size >= 8, phrases.join(' | '));
  assert.notEqual(chatter('amber-1', 3, 0), chatter('amber-1', 2, 0));
  for (const phrase of phrases) {
    assert.match(phrase, /^[A-Z][^\s].*[^\s.]$/, phrase);
    assert.ok(phrase.length <= 48, phrase);
  }
});
