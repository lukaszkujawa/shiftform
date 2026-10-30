import { generateBiome } from './generator.js?v=5f043fa';
import { serializeLevel } from './level.js?v=5f043fa';
import { biomeKey } from './rules.js?v=5f043fa';

const lanes = new Map();
const exits = new Map();
let busy = false;

self.onmessage = ({ data }) => {
  lanes.set(data.lane, { ...data, at: 0 });
  if (!busy) { busy = true; setTimeout(work); }
};

const pending = lane => lane && lane.at < lane.plans.length;

function work() {
  const job = [lanes.get('run'), ...lanes.values()].find(pending);
  if (!job) { busy = false; return; }
  const index = job.index + job.at, rules = job.plans[job.at], key = biomeKey(index, job.entryCol, rules);
  if (!exits.has(key)) {
    const level = generateBiome(job.seed, index, job.entryCol, rules, null, (fraction, stage) => self.postMessage({ type: 'progress', key, fraction, stage }));
    exits.set(key, level.exitCol);
    self.postMessage({ type: 'level', key, level: serializeLevel(level) });
  }
  job.entryCol = exits.get(key);
  job.at++;
  setTimeout(work);
}
