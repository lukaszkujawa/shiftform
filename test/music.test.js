import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { nextTrack, moodOf } from '../src/music.js';
import { THEMES } from '../src/themes.js';

test('the playlist never plays the same track twice in a row and reaches them all', () => {
  const tracks = ['a', 'b', 'c', 'd'], seen = new Set();
  let previous = null;
  for (let i = 0; i < 200; i++) {
    const track = nextTrack(tracks, previous);
    assert.notEqual(track, previous);
    seen.add(track);
    previous = track;
  }
  assert.equal(seen.size, tracks.length);
});

test('every theme has a mood with tracks on disk', () => {
  for (const theme of THEMES) {
    const mood = moodOf(theme.id);
    assert.ok(mood, `${theme.id} has no mood`);
    assert.ok(existsSync(new URL(`../music/${mood}/1.mp3`, import.meta.url)), `${mood} has no tracks`);
  }
});
