import { objectRect, phaseOn, slain, cycleAt, doorOpen, lockPowered } from '../world/level.js';
import { playerSize, hookAnchor, cannonAim } from '../world/physics.js';
import { laserBeam, bodyRects } from '../world/bodies.js';
import { alpha, shade } from './themes.js';
import { glow, lit, sprite, stamp } from './sprites.js';
import { drawMonster, drawLurker } from './monsters.js';
import { drawSpring, drawBumper, drawSaw, drawConveyor } from './gadgets.js';
import { drawSpikes, drawFlame, KILLER_ART } from './hazard-art.js';
import { ITEM_COLORS, COIN_COLOR, REFILL_COLOR, drawItemIcon } from './icons.js';
import { drawArm, drawHookRope, swayOf } from './rigging.js';
import { TAU, glint, roundRect, slab, strokeDashed } from './paint.js';
import { drawPlatform, drawRivets, CAST_INK, SHEEN, drawClimb } from './object-parts.js';

function playerOf(level, state) {
  const { w, h } = playerSize(level.rules);
  return { x: state.x, y: state.y, w, h };
}

const touchersOf = (level, state) => [playerOf(level, state), ...bodyRects(level, state.bodies)];

function paintGate(ctx, p, theme, level, o, state, time) {
  const on = phaseOn(o, state.clock);
  const t = cycleAt(o, state.clock);
  const soon = on ? o.on - t < 30 : o.period - t < 30;
  ctx.lineWidth = 2;
  if (on) {
    glow(ctx, theme, p.accent, 10);
    roundRect(ctx, o.x, o.y, o.w, o.h, 4);
    ctx.fillStyle = soon && Math.floor(time / 80) % 2 ? p.rockDeep : p.accentSoft;
    ctx.fill();
    ctx.shadowBlur = 0;
    slab(ctx, o.x, o.y, o.w, o.h, 4, 'hsl(0 0% 100% / 0)', p.accent, 2);
  } else {
    ctx.strokeStyle = soon ? p.accent : alpha(p.ink, 0.4);
    strokeDashed(ctx, [6, 6], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4));
  }
}

function orbShape(g, p) {
  g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = p.accentDeep;
  g.beginPath(); g.arc(0, 0, 6.2, 0.2, Math.PI * 0.85); g.closePath(); g.fill();
  glint(g, -2.4, -2.6, 1.5);
  g.strokeStyle = p.accent;
  g.beginPath(); g.ellipse(0, 0, 12, 3.6, -0.35, -0.1, Math.PI + 0.1); g.stroke();
}

function hourglassShape(g, p) {
  g.beginPath();
  g.moveTo(-6, -8); g.lineTo(6, -8); g.lineTo(1.2, 0); g.lineTo(6, 8); g.lineTo(-6, 8); g.lineTo(-1.2, 0);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = p.accentDeep;
  g.beginPath(); g.moveTo(-4.5, 7); g.lineTo(4.5, 7); g.lineTo(0, 2.5); g.closePath(); g.fill();
  for (const y of [-10.5, 8]) { g.beginPath(); roundRect(g, -8, y, 16, 2.5, 1); g.fill(); g.stroke(); }
}

function keyShape(g, p) {
  g.beginPath();
  g.arc(0, -5, 5.5, 0, TAU);
  g.rect(-1.6, -0.5, 3.2, 11.5);
  g.rect(1.6, 5.5, 3.5, 2.2);
  g.rect(1.6, 8.8, 2.6, 2.2);
  g.fill(); g.stroke();
  g.fillStyle = p.accentDeep;
  g.beginPath(); g.arc(0, -5, 2.2, 0, TAU); g.fill();
  glint(g, -2.8, -7.2, 1.3);
}

const PICKUP_SHAPES = { orb: orbShape, timer: hourglassShape, key: keyShape };

function paintPickup(ctx, p, theme, level, o, state, time) {
  if (state.flags & o.bit) return;
  const blur = lit(theme, 18);
  const image = sprite(`${o.type}:${p.accent}:${theme.outline}:${blur}`, 60, g => {
    g.shadowColor = p.accent;
    g.shadowBlur = blur;
    g.fillStyle = p.accent;
    g.strokeStyle = theme.outline ? p.ink : p.accentDeep;
    g.lineWidth = 1.5;
    PICKUP_SHAPES[o.type](g, p);
  });
  stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3);
}

function paintShutDoor(ctx, p, o) {
  slab(ctx, o.x + 3, o.y, o.w - 6, o.h, o.plate ? 3 : 4, p.accentSoft, p.accent, 2);
  if (o.plate) {
    ctx.strokeStyle = p.accent;
    ctx.beginPath();
    for (let y = o.y + 10; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
    ctx.stroke();
    ctx.strokeStyle = SHEEN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = o.y + 11.5; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
    ctx.stroke();
    return;
  }
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU); ctx.fill();
  ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
  glint(ctx, o.x + o.w / 2 - 2, o.y + o.h / 2 - 6, 1.4);
}

const GRIP_GLOW = 60;

function drawGripPath(ctx, p, o, x, y, sway) {
  const px = o.x + o.w / 2, py = o.y + o.h / 2;
  ctx.lineCap = 'round';
  if (o.motion === 'orbit') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(p.ink, 0.35);
    ctx.beginPath(); ctx.arc(px, py, Math.abs(o.dx), 0, TAU); ctx.stroke();
  }
  const arm = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (o.motion) return drawArm(ctx, px, py, x, y, sway);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.lineTo(px + o.dx, py + o.dy); ctx.stroke();
  };
  arm(CAST_INK, o.motion ? 6 : 4.5);
  arm(o.motion ? p.rockEdge : alpha(p.ink, 0.6), o.motion ? 4 : 2.5);
  arm(SHEEN, 1);
  ctx.fillStyle = p.rockDeep;
  for (const [ex, ey] of o.motion ? [[px, py]] : [[px, py], [px + o.dx, py + o.dy]]) { ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); glint(ctx, ex - 2, ey - 2, 1.2); }
}

export const OBJECT_PAINTERS = {
  start(ctx, p, theme, level, o) {
    ctx.fillStyle = alpha(p.accent, 0.35);
    roundRect(ctx, o.x - 6, o.y + 4, o.w + 12, 6, 3);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y - 12); ctx.lineTo(o.x + o.w / 2 + 7, o.y); ctx.lineTo(o.x + o.w / 2 - 7, o.y); ctx.closePath(); ctx.fill();
  },
  goal(ctx, p, theme, level, o, state, time) {
    const cx = o.x + o.w / 2;
    glow(ctx, theme, p.accent, 16);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(o.x + 4, o.y + o.h); ctx.lineTo(o.x + 4, o.y + o.h / 2); ctx.arc(cx, o.y + o.h / 2, o.w / 2 - 4, Math.PI, 0); ctx.lineTo(o.x + o.w - 4, o.y + o.h); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = alpha(p.accent, 0.18 + 0.1 * Math.sin(time / 300));
    ctx.fill();
  },
  cannon(ctx, p, theme, level, o, state, time) {
    const held = state.barrel === o.id;
    const aim = cannonAim(o, held ? state.barrelAge : time / 16.67);
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim);
    if (held) glow(ctx, theme, p.accent, 16);
    roundRect(ctx, -o.w / 2 - 3, -o.h / 2 + 2, o.w + 6, o.h - 4, 8);
    ctx.fillStyle = p.rockDeep;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = held ? p.accent : p.rockEdge;
    ctx.fillRect(-o.w / 2 + 6, -o.h / 2 + 2, 5, o.h - 4);
    ctx.fillRect(-1, -o.h / 2 + 2, 5, o.h - 4);
    slab(ctx, -o.w / 2 - 3, -o.h / 2 + 2, o.w + 6, o.h - 4, 8, 'hsl(0 0% 100% / 0)', held ? p.accent : p.ink, 2);
    slab(ctx, o.w / 2 - 2, -o.h / 2 - 2, 8, o.h + 4, 2, p.ink);
    ctx.fillStyle = alpha(p.accent, 0.8);
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(o.w / 2 + i * 14, -5); ctx.lineTo(o.w / 2 + i * 14 + 6, 0); ctx.lineTo(o.w / 2 + i * 14, 5); ctx.fill(); }
    ctx.restore();
  },
  refill(ctx, p, theme, level, o, state, time) {
    const spent = (state.spent & (1 << o.slot)) !== 0;
    const blur = spent ? 0 : lit(theme, 16);
    const image = sprite(`refill:${p.ink}:${spent}:${blur}`, 48, g => {
      const chevrons = () => { g.beginPath(); for (const y of [-3, 4]) { g.moveTo(-7, y + 4); g.lineTo(0, y - 3); g.lineTo(7, y + 4); } };
      g.lineCap = g.lineJoin = 'round';
      if (spent) {
        g.strokeStyle = alpha(p.ink, 0.3);
        g.lineWidth = 2;
        chevrons(); g.stroke();
        return;
      }
      g.strokeStyle = alpha(p.ink, 0.55);
      g.lineWidth = 6;
      chevrons(); g.stroke();
      g.shadowColor = REFILL_COLOR;
      g.shadowBlur = blur;
      g.strokeStyle = REFILL_COLOR;
      g.lineWidth = 3.5;
      chevrons(); g.stroke();
    });
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 3);
  },
  cling(ctx, p, theme, level, o) {
    ctx.strokeStyle = alpha(p.accent, 0.8);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = o.y + 8; y < o.y + o.h - 4; y += 14) { ctx.moveTo(o.x + 1, y); ctx.lineTo(o.x + o.w - 1, y + 6); }
    ctx.stroke();
  },
  mover(ctx, p, theme, level, o, state) {
    ctx.strokeStyle = alpha(p.ink, 0.3);
    strokeDashed(ctx, [4, 6], () => {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
    });
    drawRivets(ctx, alpha(p.ink, 0.4), [[o.x + o.w / 2, o.y + o.h / 2], [o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2]]);
    const rect = objectRect(o, state.clock);
    drawPlatform(ctx, p, theme, rect, p.rock);
    drawRivets(ctx, p.rockEdge, [[rect.x + 8, rect.y + rect.h / 2 + 1], [rect.x + rect.w - 8, rect.y + rect.h / 2 + 1]]);
  },
  conveyor: (ctx, p, theme, level, o, state) => drawConveyor(ctx, p, theme, o, state.clock),
  phase: paintGate,
  gate: paintGate,
  crumble(ctx, p, theme, level, o, state, time) {
    const gone = state.crumbled[o.slot];
    if (gone) {
      ctx.strokeStyle = alpha(p.ink, gone < 40 && Math.floor(time / 80) % 2 ? 0.7 : 0.18);
      ctx.lineWidth = 2;
      strokeDashed(ctx, [4, 6], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 5));
      return;
    }
    drawPlatform(ctx, p, theme, o, p.rock);
    const cracks = dx => {
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x + dx, o.y + 4); ctx.lineTo(x + 5 + dx, o.y + 14); ctx.lineTo(x - 2 + dx, o.y + o.h - 3); }
      ctx.stroke();
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = SHEEN;
    cracks(1.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.rockDeep;
    cracks(0);
    drawRivets(ctx, p.rockEdge, [[o.x + 6, o.y + o.h + 2], [o.x + o.w * 0.55, o.y + o.h + 3], [o.x + o.w - 9, o.y + o.h + 2]]);
  },
  door(ctx, p, theme, level, o, state) {
    if (o.timer !== undefined) {
      if (!doorOpen(o, state, state.clock)) return paintShutDoor(ctx, p, o);
      const left = o.open - (state.clock - state.timers[o.timer]);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, 9, -Math.PI / 2, -Math.PI / 2 + (TAU * left) / o.open); ctx.stroke();
      return;
    }
    if (lockPowered(o, state.flags | state.pressed)) return;
    paintShutDoor(ctx, p, o);
  },
  timer: paintPickup,
  toggle(ctx, p, theme, level, o, state) {
    const solid = lockPowered(o, state.flags | state.pressed) === o.on;
    ctx.lineWidth = 2;
    if (solid) {
      drawPlatform(ctx, p, theme, o, p.accentSoft);
      ctx.strokeStyle = p.accent;
      roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
      ctx.stroke();
    } else {
      ctx.strokeStyle = alpha(p.ink, 0.3);
      strokeDashed(ctx, [3, 7], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4));
    }
  },
  key: paintPickup,
  orb: paintPickup,
  lever(ctx, p, theme, level, o, state) {
    const on = (state.flags & o.bit) !== 0, cx = o.x + o.w / 2, base = o.y + o.h;
    slab(ctx, cx - 10, base - 7, 20, 7, 2, p.rockEdge, shade(p.rockEdge, -22), 1);
    const tipX = cx + (on ? 9 : -9), tipY = base - 21;
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, base - 6); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = on ? p.accent : p.dim;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, TAU); ctx.fill(); ctx.stroke();
    glint(ctx, tipX - 1.6, tipY - 1.8, 1.3);
  },
  switch(ctx, p, theme, level, o, state) {
    const pressed = (state.flags & o.bit) !== 0;
    slab(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4, pressed ? p.dim : p.accent, pressed ? null : p.accentDeep, 1);
    slab(ctx, o.x - 4, o.y + o.h - 6, o.w + 8, 6, 2, p.rockEdge, shade(p.rockEdge, -22), 1);
  },
  spikes: (ctx, p, theme, level, o, state, time) => drawSpikes(ctx, p, theme, o, time),
  monster: (ctx, p, theme, level, o, state, time) => drawMonster(ctx, p, theme, level, o, state, time, playerOf(level, state)),
  lurker: (ctx, p, theme, level, o, state, time) => drawLurker(ctx, p, theme, o, state, time, playerOf(level, state)),
  shot(ctx, p, theme, level, o, state) {
    if (slain(state, level.objects[o.source])) return;
    const rect = objectRect(o, state.clock), blur = lit(theme, 14);
    const image = sprite(`shot:${p.hazard}:${p.text}:${rect.w}:${blur}`, rect.w + 36, g => {
      g.shadowColor = p.hazard;
      g.shadowBlur = blur;
      g.fillStyle = p.hazard;
      g.beginPath(); g.arc(0, 0, rect.w / 2, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = alpha(p.text, 0.8);
      g.beginPath(); g.arc(0, 0, rect.w / 5, 0, TAU); g.fill();
    });
    stamp(ctx, image, rect.x + rect.w / 2, rect.y + rect.h / 2);
  },
  saw: (ctx, p, theme, level, o, state) => (KILLER_ART[o.kind] ? KILLER_ART[o.kind](ctx, p, o, state.clock) : drawSaw(ctx, p, theme, o, state.clock)),
  laser(ctx, p, theme, level, o, state, time) {
    if (o.kind === 'flame') return drawFlame(ctx, p, theme, o, state, time);
    const on = phaseOn(o, state.clock);
    const t = cycleAt(o, state.clock);
    const warming = !on && o.period - t < 24;
    const cx = o.x + o.w / 2;
    ctx.fillStyle = p.hazard;
    if (o.steady) slab(ctx, cx - 9, o.dir > 0 ? o.y : o.y + o.h - 5, 18, 5, 1.5, p.hazard);
    else { ctx.beginPath(); ctx.arc(cx, o.y + 4, 5, 0, TAU); ctx.arc(cx, o.y + o.h - 4, 5, 0, TAU); ctx.fill(); }
    if (on) {
      const beam = laserBeam(level, o, state.bodies);
      glow(ctx, theme, p.hazard, 16);
      ctx.fillStyle = p.hazard;
      ctx.fillRect(beam.x, beam.y, beam.w, beam.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.fillRect(cx - 1, beam.y, 2, beam.h);
    } else if (warming) {
      ctx.strokeStyle = p.hazardGlow;
      strokeDashed(ctx, [4, 8], () => { ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.lineTo(cx, o.y + o.h); });
    }
  },
  spring: (ctx, p, theme, level, o, state, time) => drawSpring(ctx, p, o, time, touchersOf(level, state)),
  bumper: (ctx, p, theme, level, o, state, time) => drawBumper(ctx, p, theme, o, time, touchersOf(level, state)),
  gravpad(ctx, p, theme, level, o) {
    const cx = o.x + o.w / 2;
    slab(ctx, o.x, o.y, o.w, o.h, 3, p.accent, p.accentDeep, 1);
    ctx.fillStyle = p.bgTop;
    ctx.beginPath();
    const tip = o.dir < 0 ? o.y + 1 : o.y + o.h - 1, base = o.dir < 0 ? o.y + o.h - 1 : o.y + 1;
    ctx.moveTo(cx - 5, base); ctx.lineTo(cx, tip); ctx.lineTo(cx + 5, base); ctx.closePath(); ctx.fill();
  },
  wind(ctx, p, theme, level, o, state, time) {
    const lift = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    lift.addColorStop(0, alpha(p.ink, o.ay < 0 ? 0.14 : 0.04));
    lift.addColorStop(1, alpha(p.ink, 0.03));
    ctx.fillStyle = lift;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = alpha(p.ink, 0.5);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.ay !== 0) {
      for (let i = 0; i < o.w / 18; i++) {
        const x = o.x + 9 + i * 18, phase = (time / 6 + i * 37) % o.h;
        const y = o.ay < 0 ? o.y + o.h - phase : o.y + phase;
        ctx.moveTo(x, y); ctx.lineTo(x, y + (o.ay < 0 ? 14 : -14));
      }
    } else {
      for (let i = 0; i < o.h / 18; i++) {
        const y = o.y + 9 + i * 18, phase = (time / 5 + i * 41) % o.w;
        const x = o.ax > 0 ? o.x + phase : o.x + o.w - phase;
        ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(o.ax) * 16, y);
      }
    }
    ctx.stroke();
  },
  water(ctx, p, theme, level, o, state, time) {
    ctx.fillStyle = p.water;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    const depth = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    depth.addColorStop(0, o.surface === false ? 'hsl(240 35% 8% / 0)' : 'hsl(0 0% 100% / 0.12)');
    depth.addColorStop(0.35, 'hsl(240 35% 8% / 0)');
    depth.addColorStop(1, 'hsl(240 35% 8% / 0.24)');
    ctx.fillStyle = depth;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = alpha(p.waterLine, 0.5);
    for (let k = 0; k * 34 < o.w; k++) {
      const rise = (time / 2400 + k * 0.29) % 1;
      ctx.beginPath(); ctx.arc(o.x + 12 + k * 34 + Math.sin(rise * 9 + k) * 3, o.y + o.h - 6 - rise * (o.h - 12), 1 + (k % 2) * 0.7, 0, TAU); ctx.fill();
    }
    if (o.surface === false) return;
    ctx.strokeStyle = p.waterLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = o.x; x <= o.x + o.w; x += 6) ctx.lineTo(x, o.y + Math.sin(x / 14 + time / 250) * 2);
    ctx.stroke();
  },
  plate(ctx, p, theme, level, o, state) {
    const down = (state.pressed & o.bit) !== 0;
    ctx.fillStyle = p.rockEdge;
    ctx.fillRect(o.x - 3, o.y + o.h - 2, o.w + 6, 2);
    if (down) glow(ctx, theme, p.accent, 12);
    slab(ctx, o.x, o.y + (down ? 3 : 0), o.w, o.h - (down ? 4 : 2), 2, down ? p.accent : p.accentSoft, p.accent, 1.5);
    ctx.shadowBlur = 0;
  },
  coin(ctx, p, theme, level, o, state, time) {
    if (state.coins & (1 << o.slot)) return;
    const blur = lit(theme, 10);
    const image = sprite(`coin:${blur}`, 40, g => {
      g.shadowColor = COIN_COLOR;
      g.shadowBlur = blur;
      g.fillStyle = COIN_COLOR;
      g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'hsl(40 90% 40% / 0.8)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'hsl(40 90% 42% / 0.55)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, 4, 0.2, Math.PI * 1.1); g.stroke();
      glint(g, -2.8, -3, 1.4);
    });
    const spin = Math.max(0.2, Math.abs(Math.cos(time / 180 + o.x / 40)));
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 2, spin);
  },
  item(ctx, p, theme, level, o, state, time) {
    if (state.taken & (1 << o.slot)) return;
    const image = sprite(`item:${o.kind}`, 48, g => {
      const halo = g.createRadialGradient(0, 0, 2, 0, 0, 22);
      halo.addColorStop(0, alpha(ITEM_COLORS[o.kind], 0.55));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo;
      g.fillRect(-22, -22, 44, 44);
      drawItemIcon(g, o.kind, 0, 0);
    });
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 280 + o.x) * 3);
  },
  hook(ctx, p, theme, level, o, state) {
    const anchor = hookAnchor(o, state.clock);
    const sway = o.grip ? swayOf(o, state) : null;
    const x = anchor.x + (sway?.x ?? 0), y = anchor.y + (sway?.y ?? 0);
    const { w, h } = playerSize(level.rules);
    if (o.grip) drawGripPath(ctx, p, o, x, y, sway);
    else drawHookRope(ctx, p, level, o, state);
    const near = state.rope < 0 && Math.hypot(state.x + w / 2 - anchor.x, state.y + h / 2 - anchor.y) <= (o.grip ? GRIP_GLOW : o.reach);
    if (near && !o.grip) {
      ctx.strokeStyle = alpha(p.accent, 0.25);
      strokeDashed(ctx, [3, 6], () => { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, o.reach, 0, TAU); });
    }
    const blur = lit(theme, near ? 14 : 4);
    const image = sprite(`hook:${p.accent}:${blur}`, 48, g => {
      g.shadowColor = p.accent;
      g.shadowBlur = blur;
      g.strokeStyle = p.accent;
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = p.accentDeep;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 6.8, 0.2, 2); g.stroke();
      glint(g, -4.2, -4.2, 1.2);
    });
    stamp(ctx, image, x, y);
  },
  climb: (ctx, p, theme, level, o, state, time) => drawClimb(ctx, p, theme.climb, o, time),
  portal(ctx, p, theme, level, o, state, time) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(time / 600);
    ctx.fillStyle = 'hsl(240 35% 8% / 0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    glow(ctx, theme, p.accent, 14);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.stroke();
    glint(ctx, -6, -11, 1.4);
    ctx.restore();
  },
};
