import { createGame } from './game.js?v=a5fdf48';
import { VERSION } from './version.js?v=a5fdf48';
import { today, dailyOn } from './daily.js?v=a5fdf48';
import { encodeGhost, decodeGhost } from './ghost.js?v=a5fdf48';
import { shareText } from './share.js?v=a5fdf48';
import { createTitleScene } from './title.js?v=a5fdf48';
import { bestOf, topClimbs } from './records.js?v=a5fdf48';
import { blankBlueprint, encodeBlueprint, decodeBlueprint, levelFrom } from './blueprint.js?v=a5fdf48';
import { createEditor } from './editor.js?v=a5fdf48';
import { bindEditorUI } from './editor-ui.js?v=a5fdf48';
import { drawLevelMap } from './render.js?v=a5fdf48';

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
    note.textContent = `Could not copy automatically. Copy this: ${text}`;
  }
}

function showResult(mode, summary) {
  $('#share').textContent = 'Share result';
  $('#dare').textContent = 'Challenge a friend';
  $('#again').textContent = 'Climb again';
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

const SAVED_LEVEL = 'shiftform:level';
const REPLACE_SAVED = 'Replace your saved level?';
const levelLink = code => `${location.origin}${location.pathname}#level=${code}`;

function beginPlaying() {
  scene.stop();
  title.hidden = true;
  result.hidden = true;
  document.body.classList.add('playing');
  goFullscreen();
  canvas.focus();
}

function backToTitle() {
  game = null;
  result.hidden = true;
  document.body.classList.remove('playing', 'editing', 'testing');
  showTitle();
}

async function savedBlueprint() {
  try {
    const saved = localStorage.getItem(SAVED_LEVEL);
    return saved ? await decodeBlueprint(saved) : blankBlueprint();
  } catch {
    return blankBlueprint();
  }
}

function buildLevel(blueprint) {
  let level = levelFrom(blueprint);
  const editor = createEditor(blueprint, async current => {
    try { localStorage.setItem(SAVED_LEVEL, await encodeBlueprint(current)); } catch {}
  });
  let panel = null;
  beginPlaying();
  document.body.classList.add('editing');
  game = createGame(canvas, {
    seed: 'custom', lives: 3,
    custom: {
      editor, current: () => level, refresh: () => { level = editor.level(); panel?.sync(); }, dockTop: () => $('#editor').getBoundingClientRect().top,
      onMode: mode => { document.body.classList.toggle('testing', mode === 'test'); panel?.showMode(mode); },
    },
    onClimb: () => {},
    onQuit: backToTitle,
  });
  panel = bindEditorUI(editor, {
    game: () => game,
    canvas,
    linkOf: async blueprint => levelLink(await encodeBlueprint(blueprint)),
    leave: () => { game.stop(); backToTitle(); },
  });
}

function playShared(blueprint) {
  const level = levelFrom(blueprint);
  const name = blueprint.title || 'A shared level';
  beginPlaying();
  game = createGame(canvas, {
    seed: 'custom', lives: 3,
    custom: {
      current: () => level, refresh: () => {},
      onCleared: ({ seconds, deaths }) => {
        document.body.classList.remove('playing');
        $('#result-title').textContent = `${name} · cleared`;
        $('#result-card').textContent = `${seconds.toFixed(1)} seconds · ${deaths} ${deaths === 1 ? 'death' : 'deaths'}`;
        $('#result-note').textContent = '';
        $('#share').textContent = 'Share level';
        $('#share').onclick = async () => share(`I cleared ${name} on Shiftform in ${seconds.toFixed(1)} s: ${levelLink(await encodeBlueprint(blueprint))}`, $('#result-note'));
        $('#dare').textContent = 'Remix it';
        $('#dare').onclick = () => { game.stop(); result.hidden = true; document.body.classList.remove('playing'); buildLevel(blueprint); };
        $('#again').textContent = 'Play again';
        $('#again').onclick = () => { result.hidden = true; document.body.classList.add('playing'); canvas.focus(); game.restart(); };
        $('#menu').onclick = () => { game.stop(); backToTitle(); };
        result.hidden = false;
        $('#again').focus();
      },
    },
    onClimb: () => {},
    onQuit: backToTitle,
  });
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
    seed: mode.seed, lives: mode.lives, rival: ghost, focus: params.get('focus'), notice: iphoneInSafari() && !sessionStorage.getItem('shiftform:install-nudged') ? 'Fullscreen on iPhone: Share, then Add to Home Screen.' : null,
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

function remix(blueprint, code) {
  const saved = localStorage.getItem(SAVED_LEVEL);
  if (saved && saved !== code && $('#remix').textContent !== REPLACE_SAVED) {
    $('#remix').textContent = REPLACE_SAVED;
    return;
  }
  buildLevel(blueprint);
}

async function readSharedLevel(code) {
  try {
    const blueprint = await decodeBlueprint(code);
    $('#challenge-text').textContent = blueprint.title ? `Someone built ${blueprint.title} for you.` : 'Someone built a level for you.';
    drawLevelMap($('#level-map'), blueprint);
    $('#level-map').hidden = false;
    $('#race').textContent = 'Play it';
    $('#race').onclick = () => playShared(blueprint);
    $('#remix').hidden = false;
    $('#remix').onclick = () => remix(blueprint, code);
  } catch {
    $('#challenge-text').textContent = 'This level link is damaged or from a newer version of the game.';
    $('#race').hidden = true;
  }
  $('#challenge').hidden = false;
  $('#race').focus();
}

async function readChallenge(params) {
  if (params.get('level')) return readSharedLevel(params.get('level'));
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
$('#race').onclick = () => start(rival.mode, rival.recording);
$('#build-level').addEventListener('click', async () => buildLevel(await savedBlueprint()));
$('#play').addEventListener('click', () => start(modeOf(seedInput.value.trim() || randomSeed())));
$('#random').addEventListener('click', () => { seedInput.value = randomSeed(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') $('#play').click(); });
showTitle();
readChallenge(params);
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#level=')) location.reload(); });
