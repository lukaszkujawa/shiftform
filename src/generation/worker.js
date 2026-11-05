import { generateBiome } from './generator.js';
import { serializeLevel } from '../world/level.js';
import { biomeKey } from '../world/rules.js';
import { blueprintFromLevel, designSummary } from '../builder/from-level.js';
import { funScore, funSignals } from './fun.js';

const lanes = new Map();
const exits = new Map();
const profiles = new Map();
let busy = false;

const MOST_DESIGN_TRIES = 500;
const DOOMED_AFTER = 8;

function design({ seed, design: asked, rules, keep, tries }) {
  let best = -Infinity, misses = 0;
  for (let tried = 0; tried < (tries ?? MOST_DESIGN_TRIES); tried++) {
    try {
      const level = generateBiome(tried ? `${seed}/${tried}` : seed, asked.difficulty, null, rules, asked.style, (fraction, stage) => { if (!tried) self.postMessage({ type: 'progress', fraction, stage }); }, [], asked);
      const blueprint = blueprintFromLevel(level, keep), summary = designSummary(level, blueprint, rules, asked), score = funScore(funSignals(level), asked.fun);
      const better = summary.proven && score > best;
      if (better) best = score;
      misses = 0;
      self.postMessage({ type: 'tried', tried: tried + 1, best, ...(better ? { blueprint, summary } : {}) });
    } catch (error) {
      console.error(error);
      if (++misses >= DOOMED_AFTER) break;
    }
  }
  self.postMessage({ type: 'finished' });
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
