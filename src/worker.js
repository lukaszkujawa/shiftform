import { generateLevel } from './generator.js';
import { serializeLevel } from './level.js';

self.onmessage = event => {
  const { seed, index } = event.data;
  self.postMessage({ index, level: serializeLevel(generateLevel(seed, index)) });
};
