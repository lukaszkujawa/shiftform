import { COLS, EMPTY, TILE, overlaps } from './level.js';
import { blockById, levelFrom } from './blueprint.js';

const UNDO_LIMIT = 60;
const LOCK_OR_SOURCE = item => blockById(item.b).lock || blockById(item.b).source;

export const cellOf = (x, y) => ({ c: Math.floor(x / TILE), r: Math.floor(y / TILE) });

export function rectFrom(block, from, to, rows) {
  const stretch = block.stretch ?? 'none';
  const [dw, dh] = block.size ?? [1, 1];
  const dragged = from.c !== to.c || from.r !== to.r;
  const wide = stretch === 'w' || stretch === 'both', tall = stretch === 'h' || stretch === 'both';
  const c = wide && dragged ? Math.min(from.c, to.c) : to.c, r = tall && dragged ? Math.min(from.r, to.r) : to.r;
  const w = wide && dragged && from.c !== to.c ? Math.abs(from.c - to.c) + 1 : dw;
  const h = tall && dragged && from.r !== to.r ? Math.abs(from.r - to.r) + 1 : dh;
  const clampedC = Math.max(0, Math.min(COLS - w, c));
  const top = !dragged && h > 1 ? r - h + 1 : r;
  return { c: clampedC, r: Math.max(0, Math.min(rows - h, top)), w, h };
}

const snapshot = blueprint => JSON.stringify(blueprint);

export function createEditor(blueprint, onChange = () => {}) {
  const editor = {
    blueprint, undoStack: [], redoStack: [], tool: 'rock', linking: null,
    remember() {
      editor.undoStack.push(snapshot(editor.blueprint));
      if (editor.undoStack.length > UNDO_LIMIT) editor.undoStack.shift();
      editor.redoStack = [];
    },
    changed() { onChange(editor.blueprint); },
    undo() { swap(editor.undoStack, editor.redoStack); },
    redo() { swap(editor.redoStack, editor.undoStack); },
    place(block, rect) {
      const bp = editor.blueprint;
      if (block.tile !== undefined) { fillTiles(bp, rect, block.tile); return null; }
      if (block.only) bp.items = bp.items.filter(item => item.b !== block.id);
      const item = { b: block.id, ...rect, u: bp.next++ };
      bp.items.push(item);
      if (block.lock || block.source) autoWire(bp, item);
      return item;
    },
    eraseAt(c, r) {
      const bp = editor.blueprint;
      const hit = itemAt(bp, c, r);
      if (hit) {
        if (blockById(hit.b).only) return false;
        bp.items = bp.items.filter(item => item !== hit);
        for (const item of bp.items) if (item.to) item.to = item.to.filter(u => u !== hit.u);
        return true;
      }
      if (bp.tiles[r * COLS + c] === EMPTY) return false;
      bp.tiles[r * COLS + c] = EMPTY;
      return true;
    },
    itemAt: (c, r) => itemAt(editor.blueprint, c, r),
    connect(source, lock) {
      const to = source.to ?? [];
      source.to = to.includes(lock.u) ? to.filter(u => u !== lock.u) : [...to, lock.u];
    },
    set(field, value) {
      editor.remember();
      if (field === 'rows') resize(editor.blueprint, value);
      else editor.blueprint[field] = value;
      editor.changed();
    },
    level: () => levelFrom(editor.blueprint),
  };
  function swap(from, to) {
    if (!from.length) return;
    to.push(snapshot(editor.blueprint));
    editor.blueprint = JSON.parse(from.pop());
    editor.changed();
  }
  return editor;
}

function fillTiles(bp, { c, r, w, h }, tile) {
  for (let row = r; row < r + h; row++) for (let col = c; col < c + w; col++) bp.tiles[row * COLS + col] = tile;
}

function itemBox(item) {
  const block = blockById(item.b);
  const [dw, dh] = block.size ?? [item.w, item.h];
  return { x: item.c, y: item.r, w: Math.max(item.w, block.stretch ? 1 : dw), h: Math.max(item.h, block.stretch ? 1 : dh) };
}

function itemAt(bp, c, r) {
  return bp.items.filter(item => overlaps(c, r, 1, 1, itemBox(item))).at(-1) ?? null;
}

function autoWire(bp, fresh) {
  const wired = new Set(bp.items.flatMap(item => item.to ?? []));
  const sources = bp.items.filter(item => blockById(item.b).source);
  if (blockById(fresh.b).lock) {
    const free = sources.filter(item => !item.to?.length).at(-1);
    if (free) free.to = [fresh.u];
    return;
  }
  const lock = bp.items.filter(item => blockById(item.b).lock && !wired.has(item.u)).at(-1);
  if (lock) fresh.to = [lock.u];
}

function resize(bp, rows) {
  const grown = rows - bp.rows;
  const tiles = new Array(COLS * rows).fill(EMPTY);
  for (let row = 0; row < bp.rows; row++) {
    const target = row + grown;
    if (target < 0) continue;
    for (let col = 0; col < COLS; col++) tiles[target * COLS + col] = bp.tiles[row * COLS + col];
  }
  bp.tiles = tiles;
  bp.items = bp.items.filter(item => item.r + grown >= 0 || blockById(item.b).only).map(item => ({ ...item, r: Math.max(0, item.r + grown) }));
  bp.rows = rows;
}

export const isWirable = item => !!item && LOCK_OR_SOURCE(item);
