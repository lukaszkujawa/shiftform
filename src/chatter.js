import { Rng, mix, hashString } from './rng.js?v=751319b';

const VERBS = ['Sanding', 'Calibrating', 'Teaching', 'Hiding', 'Oiling', 'Rehearsing', 'Untangling', 'Measuring', 'Polishing', 'Rerouting', 'Sharpening', 'Tuning', 'Arguing with', 'Double-checking', 'Counting', 'Warming up', 'Bolting down', 'Whispering to'];
const THINGS = ['the ledges', 'gravity', 'the saws', 'the patrollers', 'a comet', 'the trampolines', 'every metre', 'the crates', 'the hatch', 'the checkpoints', 'the lasers', 'the vines', 'the flappers', 'the wind', 'the springs', 'the sky', 'the spitters', 'the flood'];
const TAILS = ['', '', '', ' again', ' for the third time', ' by hand', ' in the dark', ' with a ruler', ' very carefully', ' before you arrive', ' one more time'];

export function chatter(seed, index, tick) {
  const rng = new Rng(mix(hashString(`${seed}/${index}`), tick));
  return `${rng.pick(VERBS)} ${rng.pick(THINGS)}${rng.pick(TAILS)}`;
}
