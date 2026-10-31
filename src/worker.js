import { generateBiome } from './generator.js';
import { serializeLevel } from './level.js';
import { biomeKey } from './rules.js';

const lanes = new Map();
const exits = new Map();
let busy = false;

self.onmessage = ({ data }) => {
  lanes.set(data.lane, { ...data, at: 0 });
  if (!busy) { busy = true; setTimeout(work); }
};

const pending = lane => lane && lane.at < lane.plans.length;

function build(job, index, rules, key) {
  try {
    const level = generateBiome(job.seed, index, job.entryCol, rules, null, (fraction, stage) => self.postMessage({ type: 'progress', key, fraction, stage }));
    exits.set(key, level.exitCol);
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
    job.at++;
  }
  setTimeout(work);
}
