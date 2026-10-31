import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBiome } from '../../src/generator.js';
import { createRun, advance } from '../../src/run.js';
import { causeOfDeath } from '../../src/devtools.js';
import { fixedBiomes } from '../fixed-biomes.js';
import { assertChains } from './helpers.js';

const BANES = ['heavy', 'flipjump', 'bouncy', 'ice', 'mirror', 'momentum', 'tiny', 'giant', 'dark', 'sprint', 'rubber', 'glass', 'flood', 'hyper'];
const GEAR = ['moon', 'double', 'triple', 'walls', 'dash', 'superhot', 'glide', 'slowair', 'blink', 'grip', 'flywheel'];
const COMBOS = [['heavy', 'double'], ['ice', 'grip'], ['mirror', 'dash'], ['flood', 'walls'], ['bouncy', 'glide'], ['hyper', 'superhot'], ['tiny', 'triple'], ['giant', 'heavy'], ['momentum', 'moon'], ['glass', 'slowair'], ['flipjump', 'flywheel'], ['sprint', 'ice', 'double']];
const FIXTURES = [[], ...BANES.map(id => [id]), ...GEAR.map(id => [id]), ...COMBOS];

function playThrough(level, label) {
  const run = createRun(5, label), biomes = fixedBiomes([[0, level]]);
  advance(run, biomes);
  assert.equal(run.phase, 'play');
  level.segments.forEach((segment, k) => {
    if (k > 0) advance(run, biomes, { restart: true });
    segment.inputs.forEach((input, i) => {
      const prev = run.s;
      advance(run, biomes, input);
      assert.ok(!run.s.dead, `${label}: died on stretch ${k + 1} frame ${i} from ${causeOfDeath(level, prev, run.s)} at (${Math.round(run.s.x)}, ${Math.round(run.s.y)})`);
    });
  });
  return run;
}

for (const mutators of FIXTURES) {
  const label = mutators.length ? mutators.join('+') : 'plain';
  test(`the proof climbs a ${label} biome through the live run`, () => {
    const level = ['', '-b', '-c'].map(suffix => generateBiome(`fixture-${label}${suffix}`, 2, null, mutators)).find(built => built.mutators.length === mutators.length);
    assert.ok(level, `${label}: one of three seeds keeps its rules`);
    assertChains(level, label);
    const run = playThrough(level, label);
    assert.equal(run.phase, 'gate', `${label}: the last stretch reaches the gate`);
    assert.equal(run.deaths, 0);
  });
}
