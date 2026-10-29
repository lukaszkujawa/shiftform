import { createGame } from './game.js';
import { VERSION } from './version.js';
import { today, dailyOn } from './daily.js';
import { encodeGhost, decodeGhost } from './ghost.js';
import { shareText } from './share.js';

const DAILY_LIVES = 3;
const $ = selector => document.querySelector(selector);
const canvas = $('#game'), title = $('#title'), result = $('#result'), seedInput = $('#seed');
const todays = today();
let game = null, rival = null;

const metres = n => `${n.toLocaleString('en')} m`;
const titleOf = mode => (mode.daily ? `Daily #${mode.daily.number}` : `seed "${mode.seed}"`);
const dailyMode = daily => ({ seed: daily.seed, daily, lives: DAILY_LIVES });
const seedMode = seed => ({ seed, daily: null });

function bestOf(seed) {
  try { return Number(localStorage.getItem(`shiftform:best:${seed}`)) || 0; } catch { return 0; }
}

function link(mode, extra = {}) {
  const hash = new URLSearchParams(mode.daily ? { daily: mode.daily.key } : { seed: mode.seed });
  for (const [key, value] of Object.entries(extra)) hash.set(key, value);
  return `${location.origin}${location.pathname}#${hash}`;
}

function randomSeed() {
  const words = ['amber', 'comet', 'delta', 'ember', 'fjord', 'glyph', 'hazel', 'ionic', 'joust', 'karma', 'lumen', 'mango', 'nova', 'orbit', 'pixel', 'quark', 'rune', 'sonar', 'tango', 'umbra', 'vapor', 'wisp', 'xenon', 'yonder', 'zephyr'];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 1000)}`;
}

async function share(text, note) {
  try {
    if (matchMedia('(pointer: coarse)').matches && navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); note.textContent = 'Copied. Paste it anywhere.'; }
  } catch {
    note.textContent = 'Could not copy automatically. Select the text above and copy it.';
  }
}

function showResult(mode, summary) {
  const text = shareText({ ...mode, ...summary }, link(mode));
  $('#result-title').textContent = `${titleOf(mode)} · ${metres(summary.metres)}`;
  $('#result-card').textContent = text;
  $('#result-note').textContent = '';
  const ghostLink = encodeGhost(summary.recording).then(ghost => link(mode, { ghost, m: summary.metres, v: VERSION }));
  $('#share').onclick = () => share(text, $('#result-note'));
  $('#dare').onclick = async () => share(`I climbed ${metres(summary.metres)} on Shiftform ${titleOf(mode)}. Race my ghost: ${await ghostLink}`, $('#result-note'));
  $('#again').onclick = () => { canvas.focus(); game.restart(); };
  $('#menu').onclick = () => { result.hidden = true; game.stop(); game = null; showTitle(); };
  result.hidden = false;
  $('#again').focus();
}

function start(mode, ghost = null) {
  title.hidden = true;
  result.hidden = true;
  canvas.focus();
  history.replaceState(null, '', `#${new URLSearchParams(mode.daily ? { daily: mode.daily.key } : { seed: mode.seed })}`);
  game = createGame(canvas, {
    seed: mode.seed, lives: mode.lives, rival: ghost,
    onClimb: () => { result.hidden = true; },
    onOver: summary => showResult(mode, summary),
    onQuit: () => { game = null; result.hidden = true; showTitle(); },
  });
}

function showTitle() {
  const best = bestOf(todays.seed);
  $('#daily').textContent = `Daily Climb #${todays.number}`;
  $('#daily-note').textContent = `Today's tower, the same for everyone. ${DAILY_LIVES} lives.${best ? ` Your best today: ${metres(best)}.` : ''}`;
  title.hidden = false;
  seedInput.focus();
}

async function readChallenge(params) {
  const daily = dailyOn(params.get('daily'));
  const mode = daily ? dailyMode(daily) : params.get('seed') && seedMode(params.get('seed'));
  if (!mode || !params.get('ghost')) return;
  try {
    rival = { mode, codes: await decodeGhost(params.get('ghost')) };
  } catch {
    $('#challenge-text').textContent = 'This ghost link is damaged, so there is no ghost to race.';
    $('#race').hidden = true;
    $('#challenge').hidden = false;
    return;
  }
  const drift = params.get('v') && params.get('v') !== VERSION ? ' It was recorded on another version of the game, so the ghost may wander off course.' : '';
  $('#challenge-text').textContent = `Someone climbed ${metres(Number(params.get('m')) || 0)} on ${titleOf(mode)}. Race their ghost up the same tower.${drift}`;
  $('#challenge').hidden = false;
}

const params = new URLSearchParams(location.hash.slice(1));
$('#version').textContent = `version ${VERSION}`;
seedInput.value = params.get('seed') || randomSeed();
$('#daily').addEventListener('click', () => start(dailyMode(todays)));
$('#race').addEventListener('click', () => start(rival.mode, rival.codes));
$('#play').addEventListener('click', () => start(seedMode(seedInput.value.trim() || randomSeed())));
$('#random').addEventListener('click', () => { seedInput.value = randomSeed(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('#play').click(); });
showTitle();
readChallenge(params);
