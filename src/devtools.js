import { surfaces } from './life.js?v=56b76b7';
import { nearbyTriggers, objectRect, overlaps, floodLevel, phaseOn, slain, erased, HAZARD_TYPES } from './level.js?v=56b76b7';
import { playerSize, FALL_DAMAGE_SPEED } from './physics.js?v=56b76b7';
import { laserBeam } from './bodies.js?v=56b76b7';

const KEY_NAMES = new Set(['left', 'right', 'jump', 'dash', 'interact', 'up', 'down', 'teleport']);

function frameOf(keys, press = null) {
  for (const name of keys) if (!KEY_NAMES.has(name)) throw new Error(`unknown key "${name}"`);
  return { keys, press };
}

export function parseScript(text) {
  return text.split(',').flatMap(item => {
    const [head, arg] = item.trim().split(/\s+/);
    if (!head) return [];
    if (head === 'wait') return Array.from({ length: Number(arg) }, () => frameOf([]));
    if (head === 'tap') return [frameOf(arg.split('+'))];
    if (head === 'press') return [frameOf([], arg)];
    return Array.from({ length: Number(arg ?? 1) }, () => frameOf(head.split('+')));
  });
}

export const framesOf = inputs => inputs.map(input => frameOf(Object.keys(input).filter(name => input[name] && KEY_NAMES.has(name)), input.restart ? 'KeyR' : null));

export function summarizeLevel(level) {
  return {
    index: level.index, title: level.title, mutators: level.mutators, rows: level.rows, height: level.height,
    start: level.start, exit: level.exit,
    surfaces: surfaces(level),
    objects: level.objects.map(({ id, type, kind, x, y, w, h }) => ({ id, type, kind, x, y, w, h })),
    routes: level.segments.map(segment => segment.route),
  };
}

export function causeOfDeath(level, prev, s) {
  const { w, h } = playerSize(level.rules), g = s.gravDir;
  if (s.y > level.height + 40 || s.y < -h - 40) return 'fell out of the biome';
  if (s.y + h > floodLevel(level, s.tide)) return 'drowned in the flood';
  if (level.rules.fallDamage && prev.vy * g >= FALL_DAMAGE_SPEED) return 'fall damage';
  for (const o of nearbyTriggers(level, s.y)) {
    if (!HAZARD_TYPES.has(o.type) && o.type !== 'shot') continue;
    if (erased(s, o) || ((o.type === 'monster' || o.type === 'shot') && slain(s, o.type === 'shot' ? level.objects[o.source] : o))) continue;
    const zone = o.type === 'laser' ? (phaseOn(o, s.clock) ? laserBeam(level, o, s.bodies) : null) : objectRect(o, s.clock);
    if (zone && overlaps(s.x - 2, s.y - 2, w + 4, h + 4, zone)) return o.kind ? `${o.kind} (${o.type} #${o.id})` : `${o.type} #${o.id}`;
  }
  return 'unknown';
}

export function summarizeState(run) {
  const s = run.s;
  if (!s) return { phase: run.phase };
  const round = v => Math.round(v * 10) / 10;
  return {
    frame: s.frame, clock: s.clock, x: round(s.x), y: round(s.y), vx: round(s.vx), vy: round(s.vy), grounded: s.grounded, dead: s.dead, won: s.won,
    phase: run.phase, index: run.index, hall: !!run.hall, altitude: run.altitude, peak: run.peak, lives: run.lives, points: run.points, runes: run.runes,
    gear: run.gear, teleports: s.teleports, fuel: s.fuel, boots: s.boots, arrows: s.arrows, shield: s.shield, comet: s.comet,
  };
}
