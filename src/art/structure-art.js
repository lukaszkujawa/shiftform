import { WIDTH } from '../world/level.js?v=9b09a76';
import { levelRng } from '../world/rng.js?v=9b09a76';
import { alpha, shade } from './themes.js?v=9b09a76';
import { MATERIALS, box, dot } from './structure-materials.js?v=9b09a76';
import { BAYS } from './structure-bays.js?v=9b09a76';
import { ORNAMENTS, drawSpinning } from './structure-ornaments.js?v=9b09a76';
import { KITS } from './structure-kits.js?v=9b09a76';

const FAR_HAZE = 0.35;
const FRAME_HAZE = 0.3;
const NEAR_HAZE = 0.25;
const FAR_OPACITY = 0.4;
const FRAME_OPACITY = 0.6;
const NEAR_OPACITY = 0.72;
const LIT_OPACITY = 0.42;
const SECOND_CHOICE = 0.22;
const MAST_WIDTH = 38;
const WALLED = new Set(['film', 'city', 'factory', 'ship', 'office', 'lab', 'cathedral', 'ruins', 'library', 'lantern', 'dunes', 'lunar', 'ember', 'inferno', 'haunted', 'frost', 'candy', 'carnival', 'harbor', 'pirate', 'mine', 'country', 'crystal']);
const SETBACK = 10;
const WALL_SATURATION = 0.55;
const MEMBER_SATURATION = 0.6;
const BEAM_WIDTH = 10;
const TIE_WIDTH = 8;
const KNEE_WIDTH = 7;
const CROSS_WIDTH = 5;
const HANG_WIDTH = 6;
const SPINES = [8, 22, 38, 205, 150, 280, 350];

const lightnessOf = color => +/hsl\([^ ]+ [^ ]+ ([\d.]+)%/.exec(color)[1];

const muted = (color, keep, dl) => shade(color.replace(/hsl\(([^ ]+) ([\d.]+)%/, (_, h, s) => `hsl(${h} ${+s * keep}%`), dl);

const TIMBER = { mine: 'hsl(28 34% 24% / 1)' };

const withTimber = (colors, id) => (TIMBER[id] ? { ...colors, body: TIMBER[id], hi: shade(TIMBER[id], 8), lo: shade(TIMBER[id], -8) } : colors);

const colorsOf = (p, theme) => withTimber({
  wall: muted(p.bgBottom, WALL_SATURATION, lightnessOf(p.bgBottom) > 50 ? -9 : 5), wallLip: muted(p.bgBottom, WALL_SATURATION, lightnessOf(p.bgBottom) > 50 ? -14 : 9), body: muted(p.rock, MEMBER_SATURATION, -5), hi: muted(p.rock, MEMBER_SATURATION, 5), lo: muted(p.rockDeep, MEMBER_SATURATION, -4), ink: p.ink, trim: muted(p.accent, 0.6, -7), wire: alpha(p.rockEdge, theme.hollow ? 0.72 : 0.55),
  mist: alpha(p.rockDeep, 0.5), rope: shade(p.rockEdge, -8), leaf: muted(p.accent, 0.62, -12), leafDeep: muted(p.accent, 0.55, -22), leafLight: muted(p.accent, 0.7, -3), bulb: muted(p.accent, 0.75, 4), window: muted(p.accentLight ?? p.accent, 0.8, 0), glowLine: muted(p.rockEdge, 0.7, -6),
  glass: [p.accent, p.hazard, p.rockEdge, p.waterLine], spines: SPINES.map(h => `hsl(${h} 38% ${theme.outline ? 62 : 32}% / 1)`), far: alpha(p.rockDeep, 0.32), lit: null, spinning: null,
}, theme.id);

function hazed(canvasOf, paint, haze, p) {
  const canvas = canvasOf();
  const ctx = canvas.getContext('2d');
  paint(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const fade = ctx.createLinearGradient(0, 0, 0, canvas.height);
  fade.addColorStop(0, alpha(p.bgTop, haze));
  fade.addColorStop(1, alpha(p.bgBottom, haze));
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function along(ctx, x0, y0, x1, y1, draw) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 2) return;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
  draw(ctx, L);
  ctx.restore();
}

const favourite = (rng, options) => {
  const [first, ...rest] = rng.shuffle(options);
  return () => (rest.length && rng.chance(SECOND_CHOICE) ? rng.pick(rest) : first);
};

const ROLE_OF_SPOT = { top: 'tops', mast: 'ornaments', prop: 'ornaments', tie: 'ornaments' };

export function renderStructure(level, theme, p, structure) {
  const kit = KITS[theme.id];
  const rng = levelRng(level, 'structure-art', 29, 3);
  const c = colorsOf(p, theme);
  const lit = [], spinning = [];
  const fresh = () => new OffscreenCanvas(WIDTH, level.height);
  const pushing = ctx => ({ push: fn => lit.push({ fn, at: ctx.getTransform() }) });
  const matMast = favourite(rng, kit.mast), matProp = favourite(rng, kit.prop), matBeam = favourite(rng, kit.beam), matHang = favourite(rng, kit.hang);
  const bayOrder = rng.shuffle(kit.bays), ornOrder = { ornaments: rng.shuffle(kit.ornaments), tops: rng.shuffle(kit.tops) };
  const use = (ctx, name, L, w) => MATERIALS[name](ctx, L, w, c, rng);
  const far = hazed(fresh, ctx => {
    c.lit = pushing(ctx);
    structure.bays.forEach(b => {
      ctx.save();
      ctx.translate(b.x0, b.y0);
      if (WALLED.has(theme.id)) {
        ctx.fillStyle = c.wall;
        ctx.fillRect(0, 0, b.x1 - b.x0, b.y1 - b.y0);
        ctx.fillStyle = c.wallLip;
        ctx.fillRect(0, 0, b.x1 - b.x0, SETBACK);
      }
      BAYS[bayOrder[Math.floor(b.pick * bayOrder.length)]](ctx, b.x1 - b.x0, b.y1 - b.y0, c, rng);
      ctx.restore();
    });
  }, FAR_HAZE, p);
  const frame = hazed(fresh, ctx => {
    c.lit = pushing(ctx);
    for (const m of structure.crosses) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, CROSS_WIDTH));
    for (const m of structure.ties) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, TIE_WIDTH));
    for (const m of structure.masts) along(ctx, m.x, m.top, m.x, m.bottom, (g, L) => use(g, matMast(), L, MAST_WIDTH));
  }, FRAME_HAZE, p);
  const near = hazed(fresh, ctx => {
    c.lit = pushing(ctx);
    c.spinning = { push: s => { const at = ctx.getTransform(); spinning.push({ ...s, x: at.e + s.x, y: at.f + s.y }); } };
    for (const m of structure.rails) {
      along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => { box(g, -2, -5, 4, L + 10, c.lo); box(g, -5, -5, 10, 3, c.hi); box(g, -5, L + 2, 10, 3, c.hi); });
    }
    for (const t of structure.trestles) {
      along(ctx, t.x0, t.top, t.x0b, t.bottom, (g, L) => use(g, matProp(), L, 13));
      along(ctx, t.x1, t.top, t.x1b, t.bottom, (g, L) => use(g, matProp(), L, 13));
      for (let y = t.top + t.step, flip = false; y < t.bottom; y += t.step, flip = !flip) {
        const f = (y - t.top) / (t.bottom - t.top), l = t.x0 + (t.x0b - t.x0) * f, r = t.x1 + (t.x1b - t.x1) * f;
        const g2 = (y - t.step - t.top) / (t.bottom - t.top), l2 = t.x0 + (t.x0b - t.x0) * g2, r2 = t.x1 + (t.x1b - t.x1) * g2;
        along(ctx, l, y, r, y, (g, L) => use(g, matBeam(), L, 8));
        along(ctx, flip ? l : r, y, flip ? r2 : l2, y - t.step, (g, L) => use(g, matBeam(), L, 5));
      }
    }
    for (const m of structure.struts) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, m.w));
    for (const m of structure.forks) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, m.w));
    for (const m of structure.knees) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, KNEE_WIDTH));
    for (const m of structure.beams) along(ctx, m.x0, m.y0, m.x1, m.y1, (g, L) => use(g, matBeam(), L, BEAM_WIDTH));
    for (const m of structure.props) along(ctx, m.x, m.top, m.x, m.bottom, (g, L) => use(g, matProp(), L, m.w));
    for (const m of structure.hangers) along(ctx, m.x, m.top, m.x, m.bottom, (g, L) => use(g, matHang(), L, HANG_WIDTH));
    for (const j of structure.joints) { dot(ctx, j.x, j.y, 5, c.lo); dot(ctx, j.x, j.y, 2.2, c.hi); }
    for (const f of structure.feet) { box(ctx, f.x - f.w / 2, f.y - 6, f.w, 6, c.lo); box(ctx, f.x - f.w / 2 + 3, f.y - 10, f.w - 6, 4, c.body); }
    for (const s of structure.spots) {
      const list = ornOrder[ROLE_OF_SPOT[s.on]];
      ctx.save();
      ctx.translate(s.x, s.y);
      ORNAMENTS[list[Math.floor(s.pick * list.length)]](ctx, c, rng);
      ctx.restore();
    }
  }, NEAR_HAZE, p);
  const canvas = fresh();
  const out = canvas.getContext('2d');
  for (const [layer, opacity] of [[far, FAR_OPACITY], [frame, FRAME_OPACITY], [near, NEAR_OPACITY]]) {
    out.globalAlpha = opacity;
    out.drawImage(layer, 0, 0);
  }
  out.globalAlpha = LIT_OPACITY;
  for (const { fn, at } of lit) {
    out.save();
    out.setTransform(at);
    fn(out);
    out.restore();
  }
  return { canvas, spinning, colors: c };
}

export function drawStructureMotion(ctx, art, top, bottom, time) {
  for (const s of art.spinning) if (s.y + s.r >= top && s.y - s.r <= bottom) drawSpinning(ctx, s, art.colors, time);
}
