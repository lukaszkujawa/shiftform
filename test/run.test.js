import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../src/generator.js';
import { addObject } from '../src/level.js';
import { createRun, advance, takesInput } from '../src/run.js';
import { codeOf, inputOf, encodeGhost, decodeGhost } from '../src/ghost.js';
import { dailyOn, today } from '../src/daily.js';
import { shareText, climbLine } from '../src/share.js';

test('inputs survive the trip through a ghost link', async () => {
  const codes = Array.from({ length: 5000 }, (_, i) => (i % 97 < 60 ? 2 : i % 7 === 0 ? 4 | 2 : 0) | (i === 4321 ? 128 : 0));
  const text = await encodeGhost(codes);
  assert.match(text, /^[A-Za-z0-9_-]+$/, 'url-safe');
  assert.ok(text.length < codes.length / 4, `${text.length} characters for ${codes.length} frames`);
  assert.deepEqual(await decodeGhost(text), codes);
  assert.deepEqual(inputOf(codeOf({ left: true, jump: true, restart: true })), { left: true, right: false, jump: true, dash: false, interact: false, up: false, down: false, restart: true });
  await assert.rejects(decodeGhost('not-a-ghost'));
});

test('a recorded climb replays as a ghost that ends exactly where the player did', async () => {
  const level = generateBiome('ghost-race', 0, null);
  const { x, y } = level.start;
  for (const dx of [-150, 150]) addObject(level, { type: 'spikes', x: x + dx, y: y + 12, w: 60, h: 14, dir: -1 });
  const biomes = new Map([[0, level]]);
  const inputs = [...level.solution.slice(0, 900), { restart: true }, ...Array(200).fill({ right: true }), ...Array(200).fill({ left: true }), ...level.solution.slice(0, 600)];
  const player = createRun(3), recording = [];
  for (let t = 0; t < 3000; t++) {
    if (takesInput(player) && recording.length < inputs.length) {
      const input = inputs[recording.length];
      recording.push(codeOf(input));
      advance(player, biomes, inputOf(codeOf(input)));
    } else if (!takesInput(player)) {
      advance(player, biomes);
    }
  }
  const codes = await decodeGhost(await encodeGhost(recording));
  const ghost = createRun(3);
  let at = 0;
  for (let t = 0; t < 3000; t++) {
    if (!takesInput(ghost)) advance(ghost, biomes);
    else if (at < codes.length) advance(ghost, biomes, inputOf(codes[at++]));
  }
  const pick = run => ({ phase: run.phase, index: run.index, lives: run.lives, deaths: run.deaths, peak: run.peak, x: run.s.x, y: run.s.y, frame: run.s.frame, taken: run.s.taken });
  assert.deepEqual(pick(ghost), pick(player));
  assert.ok(player.peak > 0, 'the climb went somewhere');
  assert.ok(player.deaths >= 2, `died ${player.deaths} times on the way`);
});

test('every day has its own numbered daily tower', () => {
  assert.deepEqual(dailyOn('2026-10-29'), { key: '2026-10-29', number: 1, seed: 'daily-2026-10-29' });
  assert.equal(dailyOn('2026-11-29').number, 32);
  assert.equal(dailyOn('nonsense'), null);
  assert.equal(today(new Date(Date.UTC(2026, 10, 2, 23, 30))).key, '2026-11-02');
});

test('the share card reads at a glance', () => {
  const path = [{ theme: 'country', comet: false }, { theme: 'candy', comet: true }, { theme: 'factory', comet: false }];
  assert.equal(climbLine(path), '🌻🍭☄️🏭💀');
  const text = shareText({ daily: dailyOn('2026-10-31'), seed: 'daily-2026-10-31', metres: 1284, best: 1402, deaths: 3, path }, 'https://example.com/#daily=2026-10-31');
  assert.equal(text, 'Shiftform Daily #3 — 1,284 m\n🌻🍭☄️🏭💀\n3 deaths · 1 comet skip · best 1,402 m\nhttps://example.com/#daily=2026-10-31');
  assert.match(shareText({ daily: null, seed: 'amber-1', metres: 10, best: 10, deaths: 1, path: path.slice(0, 1) }, 'u'), /^Shiftform · seed "amber-1" — 10 m\n🌻💀\n1 death\nu$/);
});
