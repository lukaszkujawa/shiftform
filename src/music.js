const MOODS = {
  warm: ['paper', 'country', 'blossom', 'candy', 'mushroom', 'sky', 'autumn', 'savanna', 'carnival', 'lantern', 'library'],
  machine: ['neon', 'city', 'matrix', 'synthwave', 'factory', 'lab', 'office', 'ship', 'hive'],
  glass: ['crystal', 'frost', 'lunar', 'void'],
  deep: ['ember', 'inferno', 'ruins', 'haunted', 'mine', 'cathedral', 'deep'],
  wild: ['jungle', 'dunes', 'bayou', 'harbor', 'pirate'],
};
const TRACK_COUNTS = { warm: 4, machine: 4, glass: 4, deep: 4, wild: 4, underpass: 2 };
export const UNDERPASS = 'underpass';
const MOOD_OF_THEME = new Map(Object.entries(MOODS).flatMap(([mood, themes]) => themes.map(theme => [theme, mood])));
export const moodOf = theme => MOOD_OF_THEME.get(theme);
const tracksOf = mood => Array.from({ length: TRACK_COUNTS[mood] }, (_, i) => new URL(`../music/${mood}/${i + 1}.mp3`, import.meta.url).href);

const FADE_IN = 4;
const FADE_OUT = 4;
const REST_MS = 8000;
const START_DELAY_MS = 5000;
const SWITCH_FADE = 1.5;
const SWITCH_REST_MS = 500;
const MIN_STAY = 150;
const MAX_FAILURES = 4;
const RETRY_EVENTS = ['pointerdown', 'keydown'];

export function nextTrack(tracks, previous, random = Math.random) {
  const options = tracks.filter(track => track !== previous);
  return options[Math.floor(random() * options.length)];
}

export function createMusic(ctx, out) {
  const live = new Set();
  const memory = {};
  let current = null, wanted = null, failures = 0, waiting = false, rest = null;

  function ramp(track, target, seconds) {
    const { gain } = track.level, at = ctx.currentTime;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(gain.value, at);
    gain.linearRampToValueAtTime(target, at + seconds);
  }

  function letGo(track, seconds, restMs) {
    current = null;
    ramp(track, 0, seconds);
    rest = setTimeout(() => {
      discard(track);
      rest = setTimeout(advance, restMs);
    }, seconds * 1000);
  }

  function finish(track, seconds) {
    if (track !== current) return;
    memory[track.mood].stayed += track.element.currentTime;
    memory[track.mood].at = 0;
    letGo(track, seconds, REST_MS);
  }

  function switchAway(track) {
    memory[track.mood].at = track.element.currentTime;
    letGo(track, SWITCH_FADE, SWITCH_REST_MS);
  }

  function discard(track) {
    if (!live.delete(track)) return;
    track.element.pause();
    track.element.removeAttribute('src');
    track.element.load();
    track.source.disconnect();
    track.level.disconnect();
  }

  function advance() {
    if (failures >= MAX_FAILURES) return;
    const mood = wanted, spot = memory[mood] ??= { url: null, stayed: 0, at: 0 };
    if (!spot.url || spot.stayed >= MIN_STAY) Object.assign(spot, { url: nextTrack(tracksOf(mood), spot.url), stayed: 0, at: 0 });
    const element = new Audio(spot.url);
    if (spot.at) element.addEventListener('loadedmetadata', () => { element.currentTime = spot.at; }, { once: true });
    const track = { mood, element, source: ctx.createMediaElementSource(element), level: ctx.createGain() };
    track.level.gain.value = 0;
    track.source.connect(track.level).connect(out);
    live.add(track);
    current = track;
    element.addEventListener('playing', () => {
      failures = 0;
      if (track === current) ramp(track, 1, FADE_IN);
    });
    element.addEventListener('timeupdate', () => {
      if (element.duration - element.currentTime <= FADE_OUT) finish(track, FADE_OUT);
    });
    element.addEventListener('ended', () => finish(track, 0.01));
    element.addEventListener('error', () => {
      if (!live.has(track)) return;
      failures++;
      spot.stayed = MIN_STAY;
      discard(track);
      if (track === current) { current = null; advance(); }
    });
    attempt(element);
  }

  function attempt(element) {
    element.play().catch(error => { if (error.name === 'NotAllowedError') waitForGesture(); });
  }

  function waitForGesture() {
    if (waiting) return;
    waiting = true;
    RETRY_EVENTS.forEach(type => window.addEventListener(type, unlock));
  }

  function unlock() {
    waiting = false;
    RETRY_EVENTS.forEach(type => window.removeEventListener(type, unlock));
    ctx.resume();
    live.forEach(track => attempt(track.element));
  }

  return {
    setMood(mood) {
      if (mood === wanted) return;
      const first = !wanted;
      wanted = mood;
      if (first) rest = setTimeout(advance, START_DELAY_MS);
      else if (current) switchAway(current);
    },
    pause() { live.forEach(track => track.element.pause()); },
    resume() { live.forEach(track => attempt(track.element)); },
    stop() {
      RETRY_EVENTS.forEach(type => window.removeEventListener(type, unlock));
      clearTimeout(rest);
      [...live].forEach(discard);
      current = null;
    },
    get status() {
      return current && { mood: current.mood, src: current.element.currentSrc, time: current.element.currentTime, duration: current.element.duration, paused: current.element.paused, level: current.level.gain.value, context: ctx.state };
    },
  };
}
