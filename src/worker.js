import { generateBiome } from './generator.js';
import { serializeLevel } from './level.js';

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
    const level = generateBiome(seed, next, entryCol);
    entryCol = level.exitCol;
    self.postMessage({ index: next, level: serializeLevel(level) });
    next++;
  }
};
