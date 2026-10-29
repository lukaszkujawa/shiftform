import { createGame } from './game.js';
import { VERSION } from './version.js';

const canvas = document.querySelector('#game');
const title = document.querySelector('#title');
const seedInput = document.querySelector('#seed');
const playButton = document.querySelector('#play');
const randomButton = document.querySelector('#random');
let game = null;

function readSeed() {
  return new URLSearchParams(location.hash.slice(1)).get('seed') || '';
}

function randomSeed() {
  const words = ['amber', 'comet', 'delta', 'ember', 'fjord', 'glyph', 'hazel', 'ionic', 'joust', 'karma', 'lumen', 'mango', 'nova', 'orbit', 'pixel', 'quark', 'rune', 'sonar', 'tango', 'umbra', 'vapor', 'wisp', 'xenon', 'yonder', 'zephyr'];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 1000)}`;
}

function start(seed) {
  title.hidden = true;
  canvas.focus();
  history.replaceState(null, '', `#seed=${encodeURIComponent(seed)}`);
  game = createGame(canvas, {
    seed,
    onQuit: () => { game = null; title.hidden = false; seedInput.focus(); },
  });
}

document.querySelector('#version').textContent = `version ${VERSION}`;
seedInput.value = readSeed() || randomSeed();
playButton.addEventListener('click', () => start(seedInput.value.trim() || randomSeed()));
randomButton.addEventListener('click', () => { seedInput.value = randomSeed(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') playButton.click(); });
seedInput.focus();
