import { createGame } from './game.js';

const canvas = document.querySelector('#game');
const title = document.querySelector('#title');
const seedInput = document.querySelector('#seed');
const playButton = document.querySelector('#play');
const randomButton = document.querySelector('#random');
let game = null;

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  return { seed: params.get('seed') || '', level: Math.max(1, Number(params.get('level')) || 1) };
}

function writeHash(seed, level) {
  history.replaceState(null, '', `#seed=${encodeURIComponent(seed)}&level=${level}`);
}

function randomSeed() {
  const words = ['amber', 'comet', 'delta', 'ember', 'fjord', 'glyph', 'hazel', 'ionic', 'joust', 'karma', 'lumen', 'mango', 'nova', 'orbit', 'pixel', 'quark', 'rune', 'sonar', 'tango', 'umbra', 'vapor', 'wisp', 'xenon', 'yonder', 'zephyr'];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 1000)}`;
}

function start(seed, level) {
  title.hidden = true;
  canvas.focus();
  writeHash(seed, level);
  game = createGame(canvas, {
    seed,
    startLevel: level,
    onLevelChange: index => writeHash(seed, index),
    onQuit: () => { game = null; title.hidden = false; seedInput.focus(); },
  });
}

const initial = readHash();
seedInput.value = initial.seed || randomSeed();
playButton.addEventListener('click', () => start(seedInput.value.trim() || randomSeed(), initial.seed === seedInput.value.trim() ? initial.level : 1));
randomButton.addEventListener('click', () => { seedInput.value = randomSeed(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') playButton.click(); });
seedInput.focus();
