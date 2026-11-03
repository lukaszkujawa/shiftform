import { objectRect, levelIndex, crushed, gateOutput, gatePins } from '../world/level.js?v=dd78f3b';
import { alpha, tint } from './themes.js?v=dd78f3b';
import { TAU } from './paint.js?v=dd78f3b';
import { OBJECT_PAINTERS } from './object-painters.js?v=dd78f3b';

const SIGNAL_HUES = [0, 150, 70, 240];
const signalPalettes = new Map();

export function signalPalette(p, bit) {
  const shift = SIGNAL_HUES[Math.log2(bit) % SIGNAL_HUES.length];
  if (!shift) return p;
  const key = `${p.accent}:${shift}`;
  if (!signalPalettes.has(key)) signalPalettes.set(key, { ...p, accent: tint(p.accent, shift), accentSoft: tint(p.accentSoft, shift), accentDeep: tint(p.accentDeep, shift) });
  return signalPalettes.get(key);
}

function wireLive(level, wire, state) {
  if (wire.gate) return gateOutput(wire.gate, state.flags | state.pressed);
  return wire.bit ? ((state.flags | state.pressed) & wire.bit) !== 0 : state.timers[wire.timer] >= 0 && state.clock - state.timers[wire.timer] < levelIndex(level).timers[wire.timer].open;
}

export function drawWires(ctx, p, theme, level, state, time) {
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const wire of level.wires ?? []) {
    const color = wire.gate ? p.ink : wire.bit ? signalPalette(p, wire.bit).accent : p.accent, live = wireLive(level, wire, state);
    ctx.strokeStyle = live ? color : alpha(color, 0.6);
    ctx.setLineDash(live ? [8, 6] : [2, 5]);
    ctx.lineDashOffset = live ? -time / 40 : 0;
    ctx.beginPath();
    wire.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

const GATE_OUTLINES = {
  and(ctx) { ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, 0); ctx.arc(0, 0, 10, 0, Math.PI); ctx.closePath(); },
  or(ctx) { ctx.moveTo(-10, -8); ctx.quadraticCurveTo(0, -3, 10, -8); ctx.quadraticCurveTo(10, 3, 0, 10); ctx.quadraticCurveTo(-10, 3, -10, -8); ctx.closePath(); },
  xor(ctx) { GATE_OUTLINES.or(ctx); },
};

function drawGate(ctx, palette, o, state) {
  const { gate } = o, bits = state.flags | state.pressed, on = gateOutput(gate, bits);
  for (const pin of gatePins(gate)) {
    const color = signalPalette(palette, pin.bit).accent, inputOn = (bits & pin.bit) !== 0;
    ctx.fillStyle = inputOn ? color : alpha(color, 0.35);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pin.at[0], pin.at[1], pin.negated ? 3.5 : 2.5, 0, TAU);
    if (pin.negated) { ctx.fillStyle = palette.rockEdge; ctx.fill(); ctx.stroke(); } else ctx.fill();
  }
  ctx.save();
  ctx.translate(gate.x, gate.y);
  ctx.scale(1, gate.dir);
  ctx.fillStyle = on ? palette.ink : palette.rockEdge;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  GATE_OUTLINES[gate.op](ctx);
  ctx.fill();
  ctx.stroke();
  if (gate.op === 'xor') {
    ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(0, -7, 10, -12); ctx.stroke();
  }
  ctx.restore();
}

export function drawObject(ctx, palette, theme, level, o, state, time) {
  const p = o.gate ? { ...palette, accent: palette.ink, accentSoft: alpha(palette.ink, 0.25), accentDeep: palette.ink } : o.bit ? signalPalette(palette, o.bit) : palette;
  if (crushed(level, state, o)) {
    ctx.fillStyle = o.type === 'saw' ? p.hazardGlow : p.dim;
    const rect = objectRect(o, state.clock);
    ctx.fillRect(rect.x, rect.y + rect.h - 4, rect.w, 4);
    return;
  }
  OBJECT_PAINTERS[o.type]?.(ctx, p, theme, level, o, state, time);
  if (o.gate) drawGate(ctx, palette, o, state);
}
