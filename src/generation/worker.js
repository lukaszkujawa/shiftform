import { generateBiome } from './generator.js';
import { serializeLevel } from '../world/level.js';
import { biomeKey } from '../world/rules.js';
import { blueprintFromLevel, designSummary } from '../builder/from-level.js';

const lanes = new Map();
const exits = new Map();
const profiles = new Map();
let busy = false;

function design({ seed, design: asked, rules, keep }) {
  try {
    const level = generateBiome(seed, asked.difficulty, null, rules, asked.style, (fraction, stage) => self.postMessage({ type: 'progress', fraction, stage }), [], asked);
    const blueprint = blueprintFromLevel(level, keep);
    self.postMessage({ type: 'designed', blueprint, summary: designSummary(level, blueprint, rules) });
  } catch (error) {
    self.postMessage({ type: 'failed', message: error.message });
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'design') { design(data); return; }
  lanes.set(data.lane, { ...data, at: 0 });
  if (!busy) { busy = true; setTimeout(work); }
};

const pending = lane => lane && lane.at < lane.plans.length;

function build(job, index, rules, key) {
  try {
    const level = generateBiome(job.seed, index, job.entryCol, rules, job.focus ?? null, (fraction, stage) => self.postMessage({ type: 'progress', key, fraction, stage }), job.history);
    exits.set(key, level.exitCol);
    profiles.set(key, level.profiles);
    self.postMessage({ type: 'level', key, level: serializeLevel(level) });
    return true;
  } catch (error) {
    self.postMessage({ type: 'failed', key, message: error.message });
    lanes.delete(job.lane);
    return false;
  }
}

function work() {
  const job = [lanes.get('run'), ...lanes.values()].find(pending);
  if (!job) { busy = false; return; }
  const index = job.index + job.at, rules = job.plans[job.at], key = biomeKey(index, job.entryCol, rules);
  if (exits.has(key) || build(job, index, rules, key)) {
    job.entryCol = exits.get(key);
    job.history = profiles.get(key) ?? [];
    job.at++;
  }
  setTimeout(work);
}
