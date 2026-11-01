import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fakeNode = () => new Proxy(function () {}, {
  get: (target, name) => {
    if (name === 'connect') return into => into;
    if (name === 'getChannelData') return () => new Float32Array(8);
    if (name === Symbol.toPrimitive) return () => 1;
    if (!(name in target)) target[name] = fakeNode();
    return target[name];
  },
  set: (target, name, value) => { target[name] = value; return true; },
  apply: () => fakeNode(),
});

globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.AudioContext = class {
  currentTime = 0;
  sampleRate = 8;
  state = 'running';
  destination = fakeNode();
  createGain = () => fakeNode();
  createOscillator = () => fakeNode();
  createBiquadFilter = () => fakeNode();
  createBufferSource = () => fakeNode();
  createMediaElementSource = () => fakeNode();
  createBuffer = () => fakeNode();
  resume() {}
  suspend() {}
  close() {}
};

const { createAudio } = await import('../src/audio.js');
const source = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('const SOUNDS = {'), source.indexOf('function loop(build, out)'));
const soundNames = [...body.matchAll(/^ {4}(\w+)(?:: | ?\()/gm)].map(match => match[1]);

test('every sound effect plays without throwing', () => {
  assert.ok(soundNames.length > 20, `found ${soundNames.length} sounds`);
  const audio = createAudio();
  audio.resume();
  for (const type of soundNames) {
    for (const links of [2, 30]) {
      assert.doesNotThrow(() => audio.play({ type, links, combo: links, kind: 'wood', material: 'wood', speed: 8, dir: 1, side: 1 }), type);
    }
  }
  audio.stop();
});

test('every frame of a biome updates the sound without throwing', () => {
  const audio = createAudio();
  audio.resume();
  audio.setBiome('paper');
  for (const flood of [0, 0.33]) {
    const level = { rows: 18, height: 540, hall: false, rules: { size: 1, flood } };
    assert.doesNotThrow(() => audio.update({ level, state: { x: 0, y: 0, tide: 10, jetting: false } }));
  }
  audio.stop();
});
