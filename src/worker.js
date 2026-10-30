import { generateBiome } from './generator.js?v=751319b';
import { serializeLevel } from './level.js?v=751319b';

let seed = null, next = 0, entryCol = null, target = -1;

self.onmessage = event => {
  if (event.data.seed !== seed) {
    seed = event.data.seed;
    next = 0;
    entryCol = null;
    target = -1;
  }
  target = Math.max(target, event.data.upTo);
  while (next <= target) {
    const index = next;
    const level = generateBiome(seed, index, entryCol, null, null, (fraction, stage) => self.postMessage({ type: 'progress', index, fraction, stage }));
    entryCol = level.exitCol;
    self.postMessage({ type: 'level', index, level: serializeLevel(level) });
    next++;
  }
};
