import { createGame } from './game.js?v=56b76b7';
import { VERSION } from './version.js?v=56b76b7';
import { today, dailyOn } from './daily.js?v=56b76b7';
import { encodeGhost, decodeGhost } from './ghost.js?v=56b76b7';
import { shareText } from './share.js?v=56b76b7';
import { createTitleScene } from './title.js?v=56b76b7';
import { bestOf, topClimbs } from './records.js?v=56b76b7';

const DAILY_LIVES = 3;
const $ = selector => document.querySelector(selector);
const canvas = $('#game'), title = $('#title'), result = $('#result'), seedInput = $('#seed');
let game = null, rival = null;
const themeName = theme => `${theme.emoji} ${theme.id[0].toUpperCase()}${theme.id.slice(1)}`;
const scene = createTitleScene([$('#back-a'), $('#back-b')], theme => { $('#theme-tag').textContent = themeName(theme); });

const metres = n => `${n.toLocaleString('en')} m`;
const titleOf = mode => (mode.daily ? `Daily #${mode.daily.number}` : `seed "${mode.seed}"`);
const dailyMode = daily => ({ seed: daily.seed, daily, lives: DAILY_LIVES });
const seedMode = seed => ({ seed, daily: null });
const DAILY_SEED = 'daily-';
const modeOf = seed => (seed.startsWith(DAILY_SEED) && dailyOn(seed.slice(DAILY_SEED.length)) ? dailyMode(dailyOn(seed.slice(DAILY_SEED.length))) : seedMode(seed));

const nameOf = mode => (mode.daily ? `Daily #${mode.daily.number}` : mode.seed);

function climbRow({ seed, metres: height }, i) {
  const mode = modeOf(seed), row = document.createElement('tr');
  row.tabIndex = 0;
  row.append(...[`${i + 1}`, nameOf(mode), metres(height)].map(text => Object.assign(document.createElement('td'), { textContent: text })));
  row.addEventListener('click', () => start(mode));
  row.addEventListener('keydown', event => { if (event.key === 'Enter') start(mode); });
  return row;
}

function showClimbs() {
  const climbs = topClimbs(), empty = !climbs.length;
  $('#records-summary').hidden = empty;
  $('#records-table').hidden = empty;
  $('#records-empty').hidden = !empty;
  $('#records-summary').textContent = empty ? '' : `Your best climbs · ${metres(climbs[0].metres)}`;
  $('#records-body').replaceChildren(...climbs.map(climbRow));
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
  $('#menu').onclick = () => { result.hidden = true; game.stop(); game = null; document.body.classList.remove('playing'); showTitle(); };
  result.hidden = false;
  $('#again').focus();
}

const touchDevice = () => document.body.classList.contains('touch-device');

function detectTouch() {
  const set = on => document.body.classList.toggle('touch-device', on);
  set(navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  window.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') set(true); else if (event.pointerType === 'mouse') set(false); }, { capture: true, passive: true });
  window.addEventListener('touchstart', () => set(true), { capture: true, passive: true, once: true });
}

function lockGestures() {
  const playing = () => document.body.classList.contains('playing');
  let lastTap = 0;
  document.addEventListener('gesturestart', event => event.preventDefault());
  document.addEventListener('touchmove', event => { if (playing()) event.preventDefault(); }, { passive: false });
  document.addEventListener('touchend', event => {
    const now = Date.now();
    if (playing() && now - lastTap < 350) event.preventDefault();
    lastTap = now;
  }, { passive: false });
}

async function goFullscreen(forced = false) {
  if (!(forced || touchDevice()) || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
}

function start(mode, ghost = null) {
  scene.stop();
  title.hidden = true;
  result.hidden = true;
  document.body.classList.add('playing');
  goFullscreen();
  canvas.focus();
  if (!ghost) history.replaceState(null, '', link(mode));
  game = createGame(canvas, {
    seed: mode.seed, lives: mode.lives, rival: ghost, notice: iphoneInSafari() && !sessionStorage.getItem('shiftform:install-nudged') ? 'Fullscreen on iPhone: Share, then Add to Home Screen.' : null,
    onClimb: () => { result.hidden = true; document.body.classList.add('playing'); nudged(); },
    onOver: summary => { document.body.classList.remove('playing'); showResult(mode, summary); },
    onQuit: () => { game = null; result.hidden = true; document.body.classList.remove('playing'); showTitle(); },
  });
}

const iphoneInSafari = () => /iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

function nudged() {
  try { sessionStorage.setItem('shiftform:install-nudged', '1'); } catch {}
}

function showTitle() {
  $('#install-note').hidden = !iphoneInSafari();
  const todays = today();
  const best = bestOf(todays.seed);
  $('#daily').textContent = `Daily Climb #${todays.number}`;
  $('#daily-note').textContent = `Today's tower, the same for everyone. ${DAILY_LIVES} lives.${best ? ` Your best today: ${metres(best)}.` : ''}`;
  showClimbs();
  title.hidden = false;
  scene.start();
  if (!touchDevice()) seedInput.focus();
}

async function readChallenge(params) {
  const daily = dailyOn(params.get('daily'));
  const mode = daily ? dailyMode(daily) : params.get('seed') && seedMode(params.get('seed'));
  if (!mode || !params.get('ghost')) return;
  try {
    rival = { mode, recording: await decodeGhost(params.get('ghost')) };
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

function bindTouch() {
  for (const button of document.querySelectorAll('#touch [data-input]')) {
    const names = button.dataset.input.split(' ');
    const hold = down => event => {
      event.preventDefault();
      if (down) try { button.setPointerCapture(event.pointerId); } catch {}
      button.classList.toggle('down', down);
      for (const name of names) game?.press(name, down);
    };
    button.addEventListener('pointerdown', hold(true));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, hold(false));
  }
  for (const button of document.querySelectorAll('#touch [data-key]')) {
    button.addEventListener('pointerdown', event => { event.preventDefault(); game?.tap(button.dataset.key); });
  }
  $('#touch').addEventListener('contextmenu', event => event.preventDefault());
  $('#fullscreen').hidden = !document.documentElement.requestFullscreen;
  $('#fullscreen').addEventListener('pointerdown', event => { event.preventDefault(); goFullscreen(true); });
}

window.addEventListener('error', event => { try { localStorage.setItem('shiftform:crash', `${VERSION} ${new Date().toISOString()}\n${event.error?.stack ?? event.message}`); } catch {} });
const params = new URLSearchParams(location.hash.slice(1));
detectTouch();
lockGestures();
bindTouch();
$('#version').textContent = `version ${VERSION}`;
seedInput.value = params.get('seed') || randomSeed();
$('#daily').addEventListener('click', () => start(dailyMode(today())));
$('#race').addEventListener('click', () => start(rival.mode, rival.recording));
$('#play').addEventListener('click', () => start(modeOf(seedInput.value.trim() || randomSeed())));
$('#random').addEventListener('click', () => { seedInput.value = randomSeed(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('#play').click(); });
showTitle();
readChallenge(params);
