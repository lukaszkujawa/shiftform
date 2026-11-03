import { blockById } from './blueprint.js?v=dd78f3b';
import { dialSpot } from './editor.js?v=dd78f3b';
import { TILE, COLS, WIDTH, HEIGHT, ONE_WAY, EMPTY, WATER_TILE, START_POSITIONS, addObject } from '../world/level.js?v=dd78f3b';
import { initialState } from '../world/physics.js?v=dd78f3b';
import { THEMES, alpha } from '../art/themes.js?v=dd78f3b';
import { BRIGHT_TEXT } from '../art/icons.js?v=dd78f3b';
import { TAU, font } from '../art/paint.js?v=dd78f3b';
import { drawCrate, drawFlag } from '../art/object-parts.js?v=dd78f3b';
import { OBJECT_PAINTERS } from '../art/object-painters.js?v=dd78f3b';
import { signalPalette } from '../art/object-art.js?v=dd78f3b';

const PREVIEW_ALPHA = 0.6;
const HOVER_DIAL = 9;

export function drawEditorNote(ctx, text) {
  ctx.font = font(800, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.fillText(text, WIDTH / 2, 60);
}

const MAP_CELL = 5;
const MAP_HUE = 200;
const ICON_TRAVEL = 30;
const ICON_ZOOM = 2;
const ICON_CANNON_ZOOM = 1;

function previewOf(level, block, rect) {
  const fake = { ...level, objects: [], timed: false };
  block.make(rect, level, {}).forEach(shape => addObject(fake, { ...shape }));
  return { fake, state: initialState(fake) };
}

function drawPreview(ctx, p, theme, level, block, rect, time) {
  ctx.save();
  ctx.globalAlpha = PREVIEW_ALPHA;
  if (block.tile !== undefined) {
    ctx.fillStyle = p.rock;
    ctx.fillRect(rect.c * TILE, rect.r * TILE, rect.w * TILE, block.tile === ONE_WAY ? TILE / 3 : rect.h * TILE);
  } else {
    const { fake, state } = previewOf(level, block, rect);
    for (const o of fake.objects) {
      if (o.type === 'crate') drawCrate(ctx, theme, p, o.kind, o.x, o.y, o.w);
      else if (o.type === 'checkpoint') drawFlag(ctx, p, o, false, time);
      else OBJECT_PAINTERS[o.type]?.(ctx, o.bit ? signalPalette(p, o.bit) : p, theme, fake, o, state, time);
    }
  }
  ctx.restore();
}

function drawTimingDial(ctx, p, x, y, step, r = 11) {
  ctx.fillStyle = alpha(p.bgTop, 0.9);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + (TAU * step) / START_POSITIONS); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}

export function drawEditing(ctx, p, theme, level, editing, camera, time) {
  const { at, rect, erasing, block, wiring, timing, linking, items, dial } = editing;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEIGHT);
  ctx.clip();
  ctx.translate(0, -camera);
  ctx.strokeStyle = alpha(p.ink, 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * TILE, camera); ctx.lineTo(c * TILE, camera + HEIGHT); }
  const firstRow = Math.floor(camera / TILE);
  for (let r = firstRow; r <= firstRow + HEIGHT / TILE + 1; r++) { ctx.moveTo(0, r * TILE); ctx.lineTo(WIDTH, r * TILE); }
  ctx.stroke();
  if (wiring) {
    for (const item of items.filter(i => i.u === linking)) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(item.c * TILE - 2, item.r * TILE - 2, item.w * TILE + 4, item.h * TILE + 4);
    }
  }
  if (timing) for (const item of items.filter(i => blockById(i.b).timed)) drawTimingDial(ctx, p, (item.c + 0.5) * TILE, (item.r + 0.5) * TILE, item.p ?? 0);
  if (at && rect) {
    if (block) drawPreview(ctx, p, theme, level, block, rect, time);
    ctx.strokeStyle = erasing ? p.hazard : p.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.c * TILE, rect.r * TILE, rect.w * TILE, rect.h * TILE);
  }
  if (dial) drawTimingDial(ctx, p, dialSpot(dial).x, dialSpot(dial).y, dial.p ?? 0, HOVER_DIAL);
  ctx.restore();
}

export function drawBlockIcon(canvas, block, level, theme, p) {
  const g = canvas.getContext('2d'), size = canvas.width;
  g.clearRect(0, 0, size, size);
  g.save();
  if (block.tile !== undefined) {
    const left = size * 0.15, top = size * 0.3, across = size * 0.7, lip = size * 0.1;
    g.fillStyle = block.tile === WATER_TILE ? p.water : p.rock;
    g.fillRect(left, top, across, block.tile === ONE_WAY ? lip * 1.6 : size * 0.45);
    g.fillStyle = block.tile === WATER_TILE ? p.waterLine : p.rockEdge;
    g.fillRect(left, top, across, block.tile === WATER_TILE ? lip / 3 : lip);
    g.restore();
    return;
  }
  const [w, h] = block.size ?? [1, 1];
  const { fake, state } = previewOf(level, block, { c: 4, r: 8, w, h });
  const o = fake.objects[0];
  if (o.type === 'toggle') o.on = false;
  const shrink = Math.min(1, ICON_TRAVEL / Math.max(Math.abs(o.dx ?? 0), Math.abs(o.dy ?? 0), 1));
  const dx = (o.dx ?? 0) * shrink, dy = (o.dy ?? 0) * shrink;
  if (o.dx !== undefined) Object.assign(o, { dx, dy });
  const sweep = o.motion ? 2 : 1;
  const scale = Math.min(o.type === 'cannon' ? ICON_CANNON_ZOOM : ICON_ZOOM, (size - 8) / Math.max(o.w + sweep * Math.abs(dx), o.h + sweep * Math.abs(dy)));
  g.translate(size / 2, size / 2);
  g.scale(scale, scale);
  g.translate(-(o.x + o.w / 2 + (o.motion ? 0 : dx / 2)), -(o.y + o.h / 2 + (o.motion ? 0 : dy / 2)));
  for (const object of fake.objects) {
    if (object.type === 'crate') drawCrate(g, theme, p, object.kind, object.x, object.y, object.w);
    else if (object.type === 'checkpoint') drawFlag(g, p, object, false, 0);
    else OBJECT_PAINTERS[object.type]?.(g, p, theme, fake, object, state, 0);
  }
  g.restore();
}

export function drawLevelMap(canvas, blueprint) {
  const p = THEMES[blueprint.theme].palette(MAP_HUE), rows = blueprint.rows;
  canvas.width = COLS * MAP_CELL;
  canvas.height = rows * MAP_CELL;
  const g = canvas.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, p.bgTop);
  sky.addColorStop(1, p.bgBottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = p.ink;
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (blueprint.tiles[r * COLS + c] !== EMPTY) g.fillRect(c * MAP_CELL, r * MAP_CELL, MAP_CELL, MAP_CELL);
  for (const item of blueprint.items) {
    g.fillStyle = blockById(item.b).group === 'Hazards' || blockById(item.b).group === 'Monsters' ? p.hazard : p.accent;
    g.fillRect(item.c * MAP_CELL, item.r * MAP_CELL, item.w * MAP_CELL, item.h * MAP_CELL);
  }
}
