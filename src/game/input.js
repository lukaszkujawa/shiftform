import { playerSize } from '../world/physics.js?v=c6cd642';
import { levelIndex, overlaps } from '../world/level.js?v=c6cd642';
import { promptHit, inventoryHit } from '../ui/hud.js?v=c6cd642';
import { stallHit } from '../ui/stall-ui.js?v=c6cd642';
import { PLACEABLE } from '../world/tricks.js?v=c6cd642';
import { cheer, wear } from '../art/avatar.js?v=c6cd642';
import { homeOf, atWardrobe } from '../world/home.js?v=c6cd642';
import { saveOutfit, openWardrobe, browse, shuffle, wardrobeHit } from '../ui/wardrobe.js?v=c6cd642';

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyX: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash',
  KeyF: 'interact',
  KeyT: 'teleport',
};
const MENU_MOVES = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
const WARDROBE_CLOSE = new Set(['Enter', 'Escape', 'KeyF', 'Space', 'KeyZ']);
const CLIMB_REACH = 6;
const DIRECTIONS = new Set(['left', 'right', 'up', 'down']);

export function createInput({ game, keys, canvas, audio, renderer, custom, newClimb, leave, enterBuild, editorKey, teleporting, blinkAim, ownedKinds, aim, toggleRoute, standingAt, stallView, useStall }) {
  const tapped = new Set();
  const hold = name => {
    keys[name] = true;
    tapped.add(name);
    if (name === 'teleport' && teleporting()) game.blink = blinkAim();
  };
  function heldThisTick() {
    const input = { ...keys };
    for (const name of tapped) input[name] = true;
    tapped.clear();
    return input;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const over = game.run.phase === 'over';
    if (game.quitting) {
      if (event.code === 'Enter' || event.code === 'KeyY') leave();
      else if (event.code === 'Escape' || event.code === 'KeyN') game.quitting = false;
      else if (event.code === 'KeyR') resetBiome();
      return;
    }
    if (game.dressing) { dress(event.code); return; }
    if (event.code === 'Escape') {
      if (over) leave();
      else if (game.building) game.building = false;
      else if (custom?.editor) { if (game.editing) leave(); else enterBuild(); }
      else askToLeave();
      return;
    }
    if (over && event.code === 'KeyR') { newClimb(); return; }
    if (event.target.closest?.('button, input, select')) return;
    audio.resume();
    if (custom?.editor && editorKey(event)) return;
    if (event.code === 'KeyM') { audio.toggleMute(); return; }
    if (event.code === 'KeyF' && nearWardrobe()) { openDressing(); event.preventDefault(); return; }
    const action = KEYS[event.code];
    if (action) {
      for (const name of [action].flat()) hold(name);
      event.preventDefault();
      return;
    }
    if (over && event.code === 'Enter') newClimb();
    if (game.run.phase !== 'play') return;
    const digit = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7 }[event.code];
    if (digit && standingAt()) { useStall(digit); return; }
    if (event.code === 'KeyB' && game.run.tricks.length) {
      if (!game.building) { game.building = true; game.active = 0; }
      else if (game.active + 1 < ownedKinds().length) game.active += 1;
      else game.building = false;
      return;
    }
    if (event.code === 'Tab' && game.building) { game.active = (game.active + 1) % ownedKinds().length; event.preventDefault(); return; }
    if (event.code === 'KeyR') game.restart = true;
    if (event.code === 'KeyV' && game.run.s?.arrows > 0) game.pending = { fire: true };
    if (event.code === 'KeyH') toggleRoute();
  }

  function onPointerMove(event) {
    game.pointer = event.type === 'pointerleave' ? null : renderer.pointer(event);
  }

  const nearWardrobe = () => game.run.phase === 'play' && atWardrobe(homeOf(game.run.level), game.run.level, game.run.s);

  function releaseKeys() {
    for (const name of Object.keys(keys)) keys[name] = false;
    tapped.clear();
  }

  function openDressing() {
    game.dressing = openWardrobe(game.avatar);
    releaseKeys();
    audio.play({ type: 'pick' });
  }

  function closeDressing() {
    saveOutfit(game.dressing.outfit);
    Object.assign(game.avatar, wear(game.dressing.outfit));
    game.dressing = null;
    cheer(game.avatar);
    audio.play({ type: 'checkpoint' });
  }

  function dress(code) {
    const move = MENU_MOVES[code];
    if (move) { game.dressing = browse(game.dressing, ...move); audio.play({ type: 'pick' }); }
    else if (code === 'KeyR') { game.dressing = shuffle(game.dressing); audio.play({ type: 'pick' }); }
    else if (WARDROBE_CLOSE.has(code)) closeDressing();
  }

  function resetBiome() {
    game.quitting = false;
    game.pending = { reset: true };
  }

  function askToLeave() {
    game.quitting = true;
    releaseKeys();
  }

  function onClick(event) {
    const { run } = game;
    if (game.editing) return;
    const at = renderer.pointer(event);
    game.pointer = at;
    if (game.dressing) {
      const hit = wardrobeHit(at.x, at.y);
      if (hit === 'done') closeDressing();
      else if (hit === 'shuffle') { game.dressing = shuffle(game.dressing); audio.play({ type: 'pick' }); }
      else if (hit) { game.dressing = browse(game.dressing, hit.row - game.dressing.row, hit.step); audio.play({ type: 'pick' }); }
      return;
    }
    if (game.quitting) { const hit = promptHit(at.x, at.y); if (hit === 'leave') leave(); else if (hit === 'stay') game.quitting = false; else if (hit === 'restart') resetBiome(); return; }
    const tile = stallHit(stallView(performance.now()), at.x, at.y);
    if (tile) { useStall(tile); return; }
    const slot = inventoryHit(at.x, at.y, ownedKinds().length);
    if (slot !== null) { game.active = slot; game.building = true; return; }
    const target = aim();
    if (!target) return;
    if (target.kind === 'erase' && target.object) game.pending = { erase: target.object.id };
    else if (target.kind === 'flag' && target.ok) game.pending = { flag: true };
    else if (target.rect) game.pending = { place: { kind: PLACEABLE.indexOf(target.kind), x: target.x, y: target.y } };
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onKeyUp(event) {
    const action = KEYS[event.code];
    if (action) for (const name of [action].flat()) keys[name] = false;
  }

  function press(name, down) {
    if (!(name in keys)) return;
    if (down && name === 'interact' && nearWardrobe()) { openDressing(); return; }
    if (down && DIRECTIONS.has(name)) game.pointer = null;
    if (down) { audio.resume(); hold(name); } else keys[name] = false;
  }

  function syncTouchButtons() {
    const { run } = game, { classList } = document.body, s = run.s, level = run.level;
    classList.toggle('overlaid', !!(game.quitting || game.dressing) || run.phase === 'over');
    classList.toggle('muted', audio.muted);
    if (!level || !s) return;
    const { w, h } = playerSize(level.rules), index = levelIndex(level);
    const atClimb = o => overlaps(s.x, s.y, w, h + CLIMB_REACH, o);
    classList.toggle('can-climb', s.climbing || (s.rope >= 0 && !level.objects[s.rope].grip) || index.climbs.some(atClimb) || s.placed.some(o => o.kind === 'ladder' && atClimb(o)));
    classList.toggle('can-dash', !!level.rules.dash);
    classList.toggle('can-grab', index.hooks.length > 0 || index.crates.length > 0 || index.levers.length > 0 || nearWardrobe());
    classList.toggle('can-build', run.tricks.length > 0);
  }

  const tap = code => onKeyDown({ code, repeat: false, target: canvas, preventDefault() {} });

  return { syncTouchButtons, tapped, heldThisTick, hold, tap, press, onKeyDown, onKeyUp, onPointerMove, onClick, onContextMenu };
}
