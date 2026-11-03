import { initialState, playerSize } from '../world/physics.js';
import { WIDTH, HEIGHT, TILE, COLS } from '../world/level.js';
import { barHeight } from '../ui/hud.js';
import { cellOf, rectFrom, isWirable, hoveredTimed, onDial } from '../builder/editor.js';
import { blockById } from '../builder/blueprint.js';
import { FIREWORKS, TIP_MS } from './reactions.js';

const FLY_SPEED = 8;
const WHEEL_SCROLL = 0.6;

export function createBuilder({ game, custom, canvas, audio, renderer, keys, announce }) {
  function flyAbout(run) {
    const { s, level } = run, { w, h } = playerSize(level.rules);
    const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    run.s = { ...s, x: Math.max(0, Math.min(WIDTH - w, s.x + dx * FLY_SPEED)), y: Math.max(0, Math.min(level.height - h, s.y + dy * FLY_SPEED)), clock: s.clock + 1, frame: s.frame + 1, facing: dx || s.facing, grounded: false, vx: 0, vy: 0 };
  }

  function settleCustom(run) {
    run.lives = run.maxLives;
    if (run.phase !== 'gate') return;
    const seconds = (run.s.frame - game.startedAt) / 60, deaths = run.deaths;
    if (custom.editor) {
      enterBuild();
      Object.assign(game, { fireworks: FIREWORKS.frames, toast: { kind: null, text: `Cleared in ${seconds.toFixed(1)} s`, age: 0, ms: TIP_MS } });
      audio.play({ type: 'fanfare', links: 8 });
      return;
    }
    run.phase = 'over';
    custom.onCleared({ seconds, deaths });
  }

  function dockReach() {
    const { top, height } = canvas.getBoundingClientRect();
    return Math.max(0, HEIGHT - (custom.dockTop() - top) * (HEIGHT + barHeight()) / height);
  }

  function loadCustom(state) {
    const { run } = game, level = custom.current();
    if (run.level && run.level !== level) renderer.forget(run.level);
    Object.assign(run, { level, s: { ...initialState(level), ...state }, touched: [], phase: 'play', phaseAge: 0, elapsed: 0, deaths: 0 });
    announce(level);
  }

  function enterTest() {
    game.editing = false;
    game.builtFrom = { x: game.run.s.x, y: game.run.s.y };
    custom.refresh();
    loadCustom({});
    game.startedAt = game.run.s.frame;
    Object.assign(game, { drag: null, linking: null, trail: [], path: [], recent: [], echo: null, bannerAge: 0, moved: false });
    custom.onMode?.('test');
  }

  function enterBuild() {
    game.editing = true;
    custom.refresh();
    loadCustom({ ...game.builtFrom, grounded: false });
    custom.onMode?.('build');
  }

  function rebuilt() {
    const { x, y, facing, clock, frame } = game.run.s, rowsBefore = game.run.level.rows;
    custom.refresh();
    const grown = (custom.current().rows - rowsBefore) * TILE;
    game.camera += grown;
    loadCustom({ x, y: y + grown, facing, clock, frame, grounded: false });
  }

  function commitDrag(to, erasing) {
    const { editor } = custom, { drag } = game, rows = editor.blueprint.rows;
    if (to.r < 0 || to.r >= rows || to.c < 0 || to.c >= COLS) return;
    if (editor.tool === 'wire' && !erasing) return wireAt(to);
    if (editor.tool === 'timing' && !erasing) return timeAt(to);
    editor.remember();
    if (erasing || editor.tool === 'erase') {
      const [c0, c1] = [Math.min(drag.from.c, to.c), Math.max(drag.from.c, to.c)], [r0, r1] = [Math.min(drag.from.r, to.r), Math.max(drag.from.r, to.r)];
      let changed = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) while (editor.eraseAt(c, r)) changed = true;
      if (changed) audio.play({ type: 'erase' });
      else editor.undoStack.pop();
    } else {
      const block = blockById(editor.tool);
      editor.place(block, rectFrom(block, drag.from, to, rows));
      audio.play({ type: 'place' });
    }
    editor.changed();
    rebuilt();
  }

  function timeAt(at) {
    const { editor } = custom;
    editor.remember();
    if (!editor.stepTiming(at.c, at.r)) { editor.undoStack.pop(); return; }
    audio.play({ type: 'pick' });
    editor.changed();
    rebuilt();
  }

  function wireAt(at) {
    const { editor } = custom, item = editor.itemAt(at.c, at.r);
    if (!isWirable(item)) { game.linking = null; return; }
    const first = game.linking && editor.blueprint.items.find(i => i.u === game.linking);
    if (!first || blockById(first.b).source === blockById(item.b).source) { game.linking = item.u; audio.play({ type: 'pick' }); return; }
    editor.remember();
    const [source, lock] = blockById(first.b).source ? [first, item] : [item, first];
    editor.connect(source, lock);
    game.linking = null;
    audio.play({ type: 'place' });
    editor.changed();
    rebuilt();
  }

  const dialUnder = (x, y) => {
    const { tool, blueprint } = custom.editor;
    return tool === 'wire' || tool === 'timing' || tool === 'erase' ? null : hoveredTimed(blueprint.items, x, y);
  };

  function editingView() {
    const { editor } = custom, at = game.pointer && cellOf(game.pointer.x, game.pointer.y + game.camera);
    const tool = editor.tool, block = blockById(tool);
    const erasing = tool === 'erase' || game.drag?.button === 2;
    const from = game.drag?.from ?? at;
    const dial = game.pointer && !(game.drag && !game.drag.dial) ? dialUnder(game.pointer.x, game.pointer.y + game.camera) : null;
    const pressing = dial && onDial(dial, game.pointer.x, game.pointer.y + game.camera);
    return {
      at: pressing ? null : at, dial, erasing, block: !erasing && tool !== 'wire' ? block : null, wiring: tool === 'wire', timing: tool === 'timing', linking: game.linking,
      rect: at && block && !erasing ? rectFrom(block, from, at, editor.blueprint.rows) : at && { c: Math.min(from.c, at.c), r: Math.min(from.r, at.r), w: Math.abs(from.c - at.c) + 1, h: Math.abs(from.r - at.r) + 1 },
      items: editor.blueprint.items,
    };
  }

  function onPointerDown(event) {
    if (!game.editing || game.quitting) return;
    const at = renderer.pointer(event);
    game.pointer = at;
    const dial = event.button === 0 ? dialUnder(at.x, at.y + game.camera) : null;
    game.drag = { from: cellOf(at.x, at.y + game.camera), button: event.button, dial: dial && onDial(dial, at.x, at.y + game.camera) ? dial : null };
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerUp(event) {
    if (!game.editing || !game.drag) return;
    const at = renderer.pointer(event), { dial } = game.drag;
    if (dial) { if (onDial(dial, at.x, at.y + game.camera)) timeAt(dial); }
    else commitDrag(cellOf(at.x, at.y + game.camera), game.drag.button === 2);
    game.drag = null;
  }

  function onWheel(event) {
    if (!game.editing) return;
    event.preventDefault();
    const { run } = game;
    run.s = { ...run.s, y: Math.max(0, Math.min(run.level.height - 26, run.s.y + event.deltaY * WHEEL_SCROLL)) };
  }

  function editorKey(event) {
    const { editor } = custom;
    if (event.code === 'KeyP') { if (game.editing) enterTest(); else enterBuild(); return true; }
    if (!game.editing || !(event.metaKey || event.ctrlKey)) return false;
    if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); rebuilt(); return true; }
    if (event.code === 'KeyY') { event.preventDefault(); editor.redo(); rebuilt(); return true; }
    return false;
  }

  return { flyAbout, settleCustom, dockReach, enterTest, enterBuild, rebuilt, editingView, onPointerDown, onPointerUp, onWheel, editorKey };
}
