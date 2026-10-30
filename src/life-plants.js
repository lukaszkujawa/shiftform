import { TAU, branch, strokeSegments, frond, blobPoints, blob, polygon, part } from './life-kit.js?v=ea2fce6';

export const PLANTS = {
  kelp: rng => {
    const len = rng.float(60, 140), waves = rng.int(3, 5), bulbs = rng.int(2, 4);
    const stem = p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= waves; i++) {
        const y = -(len * i) / waves, cx = (i % 2 ? 1 : -1) * len * 0.12;
        p.quadraticCurveTo(cx, y + len / waves / 2, 0, y);
      }
    };
    const beads = p => { for (let i = 1; i <= bulbs; i++) { const y = -(len * i) / (bulbs + 0.5); p.moveTo(5, y); p.arc(0, y, 5, 0, TAU); } };
    return { kind: 'kelp', flex: 1, parts: [part(stem, 'stroke', 'rockEdge', 3), part(beads, 'fill', 'accent')] };
  },
  anemone: rng => {
    const arms = rng.int(10, 16), len = rng.float(25, 55);
    const spec = Array.from({ length: arms }, (_, i) => ({ a: -Math.PI * (0.1 + (0.8 * i) / (arms - 1)), r: len * rng.float(0.7, 1), bend: rng.float(-8, 8) }));
    const build = p => {
      for (const { a, r, bend } of spec) {
        p.moveTo(0, 0);
        p.quadraticCurveTo(Math.cos(a) * r * 0.5 + bend, Math.sin(a) * r * 0.5, Math.cos(a) * r, Math.sin(a) * r);
      }
    };
    return { kind: 'anemone', flex: 0.8, parts: [part(build, 'stroke', 'accent', 2)] };
  },
  fern: rng => {
    const spec = Array.from({ length: rng.int(2, 4) }, () => ({ len: rng.float(40, 90), leaflets: rng.int(5, 9), lean: rng.float(-0.8, 0.8) }));
    const build = p => { for (const { len, leaflets, lean } of spec) frond(p, len, leaflets, lean); };
    return { kind: 'fern', flex: 0.9, parts: [part(build, 'stroke', 'ink', 1.5)] };
  },
  dandelion: rng => {
    const len = rng.float(40, 80), rays = rng.int(12, 18), r = rng.float(10, 16);
    const build = p => {
      p.moveTo(0, 0);
      p.lineTo(0, -len);
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU;
        p.moveTo(0, -len);
        p.lineTo(Math.cos(a) * r, -len + Math.sin(a) * r);
        p.moveTo(Math.cos(a) * r + 2, -len + Math.sin(a) * r);
        p.arc(Math.cos(a) * r, -len + Math.sin(a) * r, 2, 0, TAU);
      }
    };
    return { kind: 'dandelion', flex: 1, parts: [part(build, 'stroke', 'ink', 1)] };
  },
  grass: rng => {
    const blades = rng.int(5, 9);
    const spec = Array.from({ length: blades }, (_, i) => ({ x: (i - blades / 2) * 5, h: rng.float(20, 45), lean: rng.float(-12, 12) }));
    const build = p => { for (const { x, h, lean } of spec) { p.moveTo(x, 0); p.quadraticCurveTo(x + lean * 0.3, -h * 0.6, x + lean, -h); } };
    return { kind: 'grass', flex: 1.2, parts: [part(build, 'stroke', 'ink', 1.5)] };
  },
  cluster: rng => {
    const shards = rng.int(3, 6);
    const spec = Array.from({ length: shards }, () => ({ a: -Math.PI / 2 + rng.float(-0.7, 0.7), r: rng.float(18, 50), sides: rng.int(4, 6), w: rng.float(0.25, 0.45) }));
    const build = p => { for (const s of spec) polygon(p, Math.cos(s.a) * s.r * 0.5, Math.sin(s.a) * s.r * 0.5, s.r * 0.5, s.sides, s.a, s.w); };
    return { kind: 'cluster', flex: 0, parts: [part(build, 'fill', 'rockEdge'), part(build, 'stroke', 'ink', 1)] };
  },
  geodeFlower: rng => {
    const petals = rng.int(5, 8), len = rng.float(30, 60), r = rng.float(8, 14);
    const stem = p => { p.moveTo(0, 0); p.lineTo(0, -len); };
    const head = p => { for (let i = 0; i < petals; i++) { const a = (i / petals) * TAU; polygon(p, Math.cos(a) * r, -len + Math.sin(a) * r, r * 0.7, 5, a); } };
    return { kind: 'geodeFlower', flex: 0.3, parts: [part(stem, 'stroke', 'ink', 2), part(head, 'fill', 'accent')] };
  },
  deadTree: rng => {
    const limbs = branch([], 0, 0, rng.float(30, 60), -Math.PI / 2 + rng.float(-0.2, 0.2), 4, rng, 0.55);
    return { kind: 'deadTree', flex: 0.3, parts: [part(strokeSegments(limbs), 'stroke', 'ink', 2)] };
  },
  emberShrub: rng => {
    const r = rng.float(18, 36), sparks = rng.int(3, 6), pts = blobPoints(0, -r, r, 0.25, rng, 9);
    const body = p => blob(p, pts);
    const glow = p => { for (let i = 0; i < sparks; i++) { const a = (i / sparks) * TAU; p.moveTo(Math.cos(a) * r * 0.5 + 2, -r + Math.sin(a) * r * 0.5); p.arc(Math.cos(a) * r * 0.5, -r + Math.sin(a) * r * 0.5, 2, 0, TAU); } };
    return { kind: 'emberShrub', flex: 0.6, parts: [part(body, 'fill', 'rockEdge'), part(glow, 'fill', 'accent')] };
  },
  pine: rng => {
    const tiers = rng.int(3, 5), w = rng.float(16, 30), h = rng.float(45, 90);
    const trunk = p => { p.moveTo(0, 0); p.lineTo(0, -h * 0.25); };
    const crown = p => { for (let i = 0; i < tiers; i++) { const y = -h * (0.2 + (0.8 * i) / tiers), s = w * (1 - i / (tiers + 1)); p.moveTo(-s, y); p.lineTo(s, y); p.lineTo(0, y - h / tiers - 6); p.closePath(); } };
    return { kind: 'pine', flex: 0.2, parts: [part(trunk, 'stroke', 'ink', 3), part(crown, 'fill', 'rockEdge')] };
  },
  birch: rng => {
    const h = rng.float(60, 120);
    const trunk = p => { p.moveTo(0, 0); p.quadraticCurveTo(4, -h * 0.5, 0, -h); };
    const limbs = branch([], 0, -h * 0.6, h * 0.3, -Math.PI / 2, 2, rng, 0.9);
    return { kind: 'birch', flex: 0.4, parts: [part(trunk, 'stroke', 'ink', 3), part(strokeSegments(limbs), 'stroke', 'ink', 1.2)] };
  },
  nebulaFlower: rng => {
    const petals = rng.int(6, 9), r = rng.float(9, 20);
    const head = p => { for (let i = 0; i < petals; i++) { const a = (i / petals) * TAU; p.moveTo(0, 0); p.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * 0.9, r * 0.4, a, 0, TAU); } };
    const core = p => { p.moveTo(r * 0.5, 0); p.arc(0, 0, r * 0.5, 0, TAU); };
    return { kind: 'nebulaFlower', flex: 0.5, parts: [part(head, 'fill', 'rockEdge'), part(core, 'fill', 'accent')] };
  },
  urchin: rng => {
    const r = rng.float(10, 22), spikes = rng.int(12, 20), pts = blobPoints(0, -r, r, 0.15, rng, 8);
    const body = p => blob(p, pts);
    const quills = p => { for (let i = 0; i < spikes; i++) { const a = (i / spikes) * TAU; p.moveTo(Math.cos(a) * r, -r + Math.sin(a) * r); p.lineTo(Math.cos(a) * r * 1.8, -r + Math.sin(a) * r * 1.8); } };
    return { kind: 'urchin', flex: 0.2, parts: [part(body, 'fill', 'rockEdge'), part(quills, 'stroke', 'ink', 1)] };
  },
  monstera: rng => {
    const leaves = Array.from({ length: rng.int(3, 5) }, () => ({ a: -Math.PI / 2 + rng.float(-1.1, 1.1), len: rng.float(30, 60), r: rng.float(10, 16) }));
    const tip = l => [Math.cos(l.a) * l.len, Math.sin(l.a) * l.len];
    const stalks = p => { for (const l of leaves) { const [x, y] = tip(l); p.moveTo(0, 0); p.quadraticCurveTo(x * 0.3, y * 0.7, x, y); } };
    const blades = p => { for (const l of leaves) { const [x, y] = tip(l); p.moveTo(x + Math.cos(l.a) * l.r, y + Math.sin(l.a) * l.r); p.ellipse(x, y, l.r, l.r * 0.6, l.a, 0, TAU); } };
    return { kind: 'monstera', flex: 0.6, parts: [part(stalks, 'stroke', 'ink', 2), part(blades, 'fill', 'rockEdge')] };
  },
  cactus: rng => {
    const h = rng.float(40, 80), w = rng.float(7, 11);
    const arms = Array.from({ length: rng.int(1, 2) }, (_, i) => ({ side: i ? -1 : 1, y: -h * rng.float(0.35, 0.6), up: h * rng.float(0.2, 0.35) }));
    const body = p => {
      p.moveTo(0, 0);
      p.lineTo(0, -h);
      for (const a of arms) { p.moveTo(0, a.y); p.lineTo(a.side * w * 1.8, a.y); p.lineTo(a.side * w * 1.8, a.y - a.up); }
    };
    const ribs = p => { p.moveTo(0, -4); p.lineTo(0, -h + 4); };
    return { kind: 'cactus', flex: 0.1, parts: [part(body, 'stroke', 'rockEdge', w), part(ribs, 'stroke', 'ink', 1)] };
  },
  coral: rng => {
    const limbs = branch([], 0, 0, rng.float(18, 30), -Math.PI / 2 + rng.float(-0.3, 0.3), 3, rng, 0.75);
    return { kind: 'coral', flex: 0.4, parts: [part(strokeSegments(limbs), 'stroke', 'accent', 4)] };
  },
  bamboo: rng => {
    const stalks = Array.from({ length: rng.int(2, 4) }, (_, i) => ({ x: (i - 1) * 8 + rng.float(-3, 3), h: rng.float(60, 120), lean: rng.float(-6, 6) }));
    const stems = p => { for (const s of stalks) { p.moveTo(s.x, 0); p.lineTo(s.x + s.lean, -s.h); } };
    const joints = p => { for (const s of stalks) for (let y = 18; y < s.h; y += 18) { const x = s.x + (s.lean * y) / s.h; p.moveTo(x - 3, -y); p.lineTo(x + 3, -y); } };
    const leaves = p => { for (const s of stalks) for (const d of [-1, 1]) { const x = s.x + s.lean, y = -s.h; p.moveTo(x, y + 6); p.quadraticCurveTo(x + d * 8, y, x + d * 16, y + 8); } };
    return { kind: 'bamboo', flex: 0.5, parts: [part(stems, 'stroke', 'rockEdge', 4), part(joints, 'stroke', 'ink', 1.5), part(leaves, 'stroke', 'accent', 2)] };
  },
  blossomTree: rng => {
    const limbs = branch([], 0, 0, rng.float(28, 45), -Math.PI / 2 + rng.float(-0.2, 0.2), 3, rng, 0.6);
    const blooms = limbs.slice(1).map(([, , x, y]) => ({ x, y, r: rng.float(3, 6) }));
    const flowers = p => { for (const b of blooms) { p.moveTo(b.x + b.r, b.y); p.arc(b.x, b.y, b.r, 0, TAU); } };
    return { kind: 'blossomTree', flex: 0.3, parts: [part(strokeSegments(limbs), 'stroke', 'rockDeep', 2.5), part(flowers, 'fill', 'rockEdge')] };
  },
  streetlamp: rng => {
    const h = rng.float(60, 95), reach = rng.float(10, 16);
    const pole = p => { p.moveTo(0, 0); p.lineTo(0, -h); p.quadraticCurveTo(0, -h - 8, reach, -h - 6); };
    const base = p => { p.moveTo(-6, 0); p.lineTo(6, 0); p.lineTo(2, -7); p.lineTo(-2, -7); p.closePath(); };
    const lamp = p => { p.moveTo(reach + 5, -h - 2); p.arc(reach, -h - 2, 5, 0, TAU); };
    return { kind: 'streetlamp', flex: 0, parts: [part(pole, 'stroke', 'ink', 2.5), part(base, 'fill', 'ink'), part(lamp, 'fill', 'accent')] };
  },
  hydrant: rng => {
    const s = rng.float(0.8, 1.3);
    const body = p => { p.rect(-5 * s, -16 * s, 10 * s, 16 * s); p.rect(-8 * s, -12 * s, 16 * s, 4 * s); p.moveTo(6 * s, -16 * s); p.arc(0, -16 * s, 6 * s, 0, Math.PI, true); };
    const bolt = p => { p.moveTo(2 * s, -22 * s); p.arc(0, -22 * s, 2 * s, 0, TAU); };
    return { kind: 'hydrant', flex: 0, parts: [part(body, 'fill', 'rockEdge'), part(bolt, 'fill', 'ink')] };
  },
  antenna: rng => {
    const h = rng.float(45, 85), bars = rng.int(3, 5);
    const mast = p => {
      p.moveTo(0, 0);
      p.lineTo(0, -h);
      for (let i = 0; i < bars; i++) { const y = -h + 6 + i * 8, w = 5 + i * 5; p.moveTo(-w, y); p.lineTo(w, y); }
    };
    const tip = p => { p.moveTo(2.5, -h); p.arc(0, -h, 2.5, 0, TAU); };
    return { kind: 'antenna', flex: 0.2, parts: [part(mast, 'stroke', 'ink', 1.5), part(tip, 'fill', 'accent')] };
  },
  sunflower: rng => {
    const h = rng.float(50, 90), r = rng.float(6, 9), petals = rng.int(9, 13);
    const stem = p => { p.moveTo(0, 0); p.quadraticCurveTo(4, -h / 2, 0, -h); p.moveTo(1, -h * 0.4); p.quadraticCurveTo(10, -h * 0.5, 14, -h * 0.42); };
    const ring = p => { for (let i = 0; i < petals; i++) { const a = (i / petals) * TAU; p.moveTo(Math.cos(a) * r * 1.9, -h + Math.sin(a) * r * 1.9); p.ellipse(Math.cos(a) * r * 1.4, -h + Math.sin(a) * r * 1.4, r * 0.55, r * 0.25, a, 0, TAU); } };
    const heart = p => { p.moveTo(r, -h); p.arc(0, -h, r, 0, TAU); };
    return { kind: 'sunflower', flex: 0.6, parts: [part(stem, 'stroke', 'rockEdge', 2.5), part(ring, 'fill', 'accent'), part(heart, 'fill', 'rockDeep')] };
  },
  wheat: rng => {
    const stalks = Array.from({ length: rng.int(3, 5) }, (_, i) => ({ x: (i - 2) * 4, h: rng.float(35, 60), lean: rng.float(-8, 8) }));
    const stems = p => { for (const s of stalks) { p.moveTo(s.x, 0); p.quadraticCurveTo(s.x, -s.h / 2, s.x + s.lean, -s.h); } };
    const grains = p => { for (const s of stalks) for (let k = 0; k < 4; k++) { const x = s.x + s.lean, y = -s.h - k * 4; p.moveTo(x + 3, y); p.ellipse(x, y, 3, 1.6, -0.9, 0, TAU); p.moveTo(x + 3, y + 2); p.ellipse(x, y + 2, 3, 1.6, 0.9, 0, TAU); } };
    return { kind: 'wheat', flex: 1, parts: [part(stems, 'stroke', 'accent', 1.2), part(grains, 'fill', 'accent')] };
  },
  haybale: rng => {
    const w = rng.float(24, 34), h = w * 0.7;
    const bale = p => p.rect(-w / 2, -h, w, h);
    const straw = p => { for (let y = -h + 5; y < 0; y += 6) { p.moveTo(-w / 2, y); p.lineTo(w / 2, y + 1); } p.moveTo(-w / 6, -h); p.lineTo(-w / 6, 0); p.moveTo(w / 6, -h); p.lineTo(w / 6, 0); };
    return { kind: 'haybale', flex: 0, parts: [part(bale, 'fill', 'accent'), part(straw, 'stroke', 'rockDeep', 1)] };
  },
  console: rng => {
    const w = rng.float(22, 32), h = rng.float(18, 28);
    const desk = p => { p.moveTo(-w / 2, 0); p.lineTo(-w / 2 + 3, -h * 0.7); p.lineTo(w / 2, -h); p.lineTo(w / 2, 0); p.closePath(); };
    const screen = p => { p.moveTo(-w / 2 + 6, -h * 0.68); p.lineTo(w / 2 - 3, -h * 0.92); p.lineTo(w / 2 - 3, -h * 0.55); p.lineTo(-w / 2 + 6, -h * 0.4); p.closePath(); };
    const keys = p => { for (let i = 0; i < 4; i++) { p.moveTo(-w / 2 + 7 + i * 5, -6); p.arc(-w / 2 + 6 + i * 5, -6, 1.3, 0, TAU); } };
    return { kind: 'console', flex: 0, parts: [part(desk, 'fill', 'rockDeep'), part(screen, 'fill', 'rockEdge'), part(keys, 'fill', 'accent')] };
  },
  pipe: rng => {
    const h = rng.float(40, 80), r = rng.float(6, 9);
    const run = p => { p.moveTo(0, 0); p.lineTo(0, -h); p.lineTo(18, -h); };
    const wheel = p => { p.moveTo(r, -h * 0.5); p.arc(0, -h * 0.5, r, 0, TAU); for (let k = 0; k < 3; k++) { const a = (k * TAU) / 3; p.moveTo(0, -h * 0.5); p.lineTo(Math.cos(a) * r, -h * 0.5 + Math.sin(a) * r); } };
    return { kind: 'pipe', flex: 0, parts: [part(run, 'stroke', 'ink', 5), part(wheel, 'stroke', 'accent', 2)] };
  },
  podPlant: rng => {
    const r = rng.float(12, 18);
    const base = p => p.rect(-r - 2, -5, r * 2 + 4, 5);
    const dome = p => { p.moveTo(-r, -5); p.arc(0, -5, r, Math.PI, TAU); };
    const sprout = p => { frond(p, r * 1.4, 4, -0.3); frond(p, r * 1.1, 3, 0.4); };
    return { kind: 'podPlant', flex: 0.3, parts: [part(base, 'fill', 'rockDeep'), part(sprout, 'stroke', 'accent', 1.5), part(dome, 'stroke', 'rockEdge', 1.5)] };
  },
  lollipop: rng => {
    const h = rng.float(35, 70), r = rng.float(9, 15);
    const stick = p => { p.moveTo(0, 0); p.lineTo(0, -h); };
    const candy = p => { p.moveTo(r, -h); p.arc(0, -h, r, 0, TAU); };
    const swirl = p => { p.moveTo(0, -h); for (let a = 0; a < TAU * 2.5; a += 0.25) { const rr = (a / (TAU * 2.5)) * r * 0.9; p.lineTo(Math.cos(a) * rr, -h + Math.sin(a) * rr); } };
    return { kind: 'lollipop', flex: 0.3, parts: [part(stick, 'stroke', 'rockEdge', 2.5), part(candy, 'fill', 'accent'), part(swirl, 'stroke', 'rockEdge', 2)] };
  },
  candyCane: rng => {
    const h = rng.float(40, 75), hook = rng.float(7, 11);
    const cane = p => { p.moveTo(0, 0); p.lineTo(0, -h); p.arc(hook, -h, hook, Math.PI, TAU); };
    const stripes = p => { for (let y = -6; y > -h; y -= 9) { p.moveTo(-3, y); p.lineTo(3, y - 4); } };
    return { kind: 'candyCane', flex: 0.1, parts: [part(cane, 'stroke', 'rockEdge', 6), part(stripes, 'stroke', 'accent', 2.5)] };
  },
  gumdrop: rng => {
    const drops = Array.from({ length: rng.int(2, 3) }, (_, i) => ({ x: (i - 1) * 14 + rng.float(-3, 3), r: rng.float(7, 11) }));
    const domes = p => { for (const d of drops) { p.moveTo(d.x - d.r, 0); p.quadraticCurveTo(d.x - d.r, -d.r * 1.8, d.x, -d.r * 1.8); p.quadraticCurveTo(d.x + d.r, -d.r * 1.8, d.x + d.r, 0); p.closePath(); } };
    const sugar = p => { for (const d of drops) for (let k = 0; k < 3; k++) { const x = d.x + (k - 1) * d.r * 0.4, y = -d.r * (0.6 + 0.3 * (k % 2)); p.moveTo(x + 1, y); p.arc(x, y, 1, 0, TAU); } };
    return { kind: 'gumdrop', flex: 0, parts: [part(domes, 'fill', 'accent'), part(sugar, 'fill', 'rockEdge')] };
  },
  pottedPlant: rng => {
    const r = rng.float(8, 12);
    const pot = p => { p.moveTo(-r, -r * 1.4); p.lineTo(r, -r * 1.4); p.lineTo(r * 0.7, 0); p.lineTo(-r * 0.7, 0); p.closePath(); };
    const leaves = p => { for (let k = 0; k < 4; k++) { p.moveTo(0, -r * 1.4); frond(p, r * rng.float(2.5, 4), 4, -0.9 + k * 0.6); } };
    return { kind: 'pottedPlant', flex: 0.5, parts: [part(leaves, 'stroke', 'accent', 1.5), part(pot, 'fill', 'rockDeep')] };
  },
  waterCooler: rng => {
    const s = rng.float(0.9, 1.2);
    const body = p => p.rect(-8 * s, -30 * s, 16 * s, 30 * s);
    const bottle = p => { p.moveTo(-6 * s, -30 * s); p.lineTo(-7 * s, -44 * s); p.quadraticCurveTo(0, -50 * s, 7 * s, -44 * s); p.lineTo(6 * s, -30 * s); p.closePath(); };
    const tap = p => { p.moveTo(3 * s, -20 * s); p.arc(0, -20 * s, 3 * s, 0, TAU); };
    return { kind: 'waterCooler', flex: 0, parts: [part(body, 'fill', 'rockDeep'), part(bottle, 'fill', 'accent'), part(tap, 'fill', 'ink')] };
  },
  deskLamp: rng => {
    const arm = rng.float(18, 28), bend = rng.float(0.3, 0.7);
    const frame = p => { p.moveTo(-8, 0); p.lineTo(8, 0); p.moveTo(0, 0); p.lineTo(-arm * bend, -arm); p.lineTo(arm * 0.5, -arm * 1.5); };
    const shade = p => { const x = arm * 0.5, y = -arm * 1.5; p.moveTo(x - 3, y - 3); p.lineTo(x + 12, y + 2); p.lineTo(x + 4, y + 10); p.closePath(); };
    return { kind: 'deskLamp', flex: 0, parts: [part(frame, 'stroke', 'ink', 2), part(shade, 'fill', 'accent')] };
  },
  dataPylon: rng => {
    const h = rng.float(55, 100), w = rng.float(8, 12);
    const frame = p => {
      p.moveTo(-w, 0); p.lineTo(0, -h); p.lineTo(w, 0);
      for (let y = -12; y > -h + 10; y -= 12) { const half = w * (1 + y / h); p.moveTo(-half, y); p.lineTo(half, y); }
    };
    const beacon = p => { p.moveTo(3, -h); p.arc(0, -h, 3, 0, TAU); };
    return { kind: 'dataPylon', flex: 0, parts: [part(frame, 'stroke', 'ink', 1.2), part(beacon, 'fill', 'accent')] };
  },
  glitchTree: rng => {
    const limbs = branch([], 0, 0, rng.float(22, 34), -Math.PI / 2, 3, rng, 0.8).map(([x0, y0, x1, y1]) => [Math.round(x0 / 4) * 4, Math.round(y0 / 4) * 4, Math.round(x1 / 4) * 4, Math.round(y1 / 4) * 4]);
    const trace = p => { for (const [x0, y0, x1, y1] of limbs) { p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); } };
    const nodes = p => { for (const [, , x, y] of limbs.slice(1)) p.rect(x - 2.5, y - 2.5, 5, 5); };
    return { kind: 'glitchTree', flex: 0, parts: [part(trace, 'stroke', 'rockEdge', 1.5), part(nodes, 'fill', 'accent')] };
  },
  serverRack: rng => {
    const h = rng.float(35, 60), w = rng.float(16, 22), units = Math.floor(h / 8);
    const rack = p => p.rect(-w / 2, -h, w, h);
    const lights = p => { for (let k = 0; k < units; k++) for (let j = 0; j < 2; j++) if ((k + j) % 3) { const x = -w / 2 + 4 + j * 4, y = -h + 5 + k * 8; p.moveTo(x + 1, y); p.arc(x, y, 1, 0, TAU); } };
    const slots = p => { for (let k = 1; k < units; k++) { p.moveTo(-w / 2, -h + k * 8); p.lineTo(w / 2, -h + k * 8); } };
    return { kind: 'serverRack', flex: 0, parts: [part(rack, 'fill', 'rockDeep'), part(slots, 'stroke', 'ink', 0.8), part(lights, 'fill', 'accent')] };
  },
  hellSpire: rng => {
    const h = rng.float(40, 80), w = rng.float(8, 13), jags = rng.int(3, 5);
    const spire = p => {
      p.moveTo(-w, 0);
      for (let k = 1; k <= jags; k++) { const y = -(h * k) / jags, half = w * (1 - k / (jags + 0.5)); p.lineTo(-half - 4, y + 6); p.lineTo(-half, y); }
      p.lineTo(0, -h - 6);
      for (let k = jags; k >= 1; k--) { const y = -(h * k) / jags, half = w * (1 - k / (jags + 0.5)); p.lineTo(half, y); p.lineTo(half + 4, y + 6); }
      p.lineTo(w, 0);
      p.closePath();
    };
    const vein = p => { p.moveTo(0, -4); p.lineTo(-2, -h * 0.4); p.lineTo(1, -h * 0.75); };
    return { kind: 'hellSpire', flex: 0, parts: [part(spire, 'fill', 'rockDeep'), part(vein, 'stroke', 'accent', 1.5)] };
  },
  dish: rng => {
    const h = rng.float(25, 45), r = rng.float(12, 18);
    const mast = p => { p.moveTo(-8, 0); p.lineTo(0, -h); p.lineTo(8, 0); };
    const bowl = p => { p.moveTo(-r, -h - r * 0.3); p.quadraticCurveTo(0, -h + r * 0.7, r, -h - r * 0.9); p.closePath(); };
    const feed = p => { p.moveTo(0, -h - r * 0.2); p.lineTo(r * 0.3, -h - r * 1.1); };
    return { kind: 'dish', flex: 0, parts: [part(mast, 'stroke', 'ink', 1.5), part(bowl, 'fill', 'rockEdge'), part(feed, 'stroke', 'ink', 1)] };
  },
  flagPole: rng => {
    const h = rng.float(45, 75), w = rng.float(14, 20);
    const pole = p => { p.moveTo(0, 0); p.lineTo(0, -h); };
    const flag = p => { p.moveTo(0, -h); p.quadraticCurveTo(w * 0.5, -h - 3, w, -h + 1); p.lineTo(w, -h + w * 0.6); p.quadraticCurveTo(w * 0.5, -h + w * 0.6 - 3, 0, -h + w * 0.6); p.closePath(); };
    return { kind: 'flagPole', flex: 0.3, parts: [part(pole, 'stroke', 'ink', 1.5), part(flag, 'fill', 'accent')] };
  },
  bollard: rng => {
    const s = rng.float(0.9, 1.3);
    const post = p => { p.rect(-6 * s, -16 * s, 12 * s, 16 * s); p.moveTo(8 * s, -17 * s); p.ellipse(0, -17 * s, 8 * s, 3 * s, 0, 0, TAU); };
    const rope = p => { p.moveTo(-6 * s, -10 * s); p.quadraticCurveTo(-18 * s, -2 * s, -26 * s, 0); };
    return { kind: 'bollard', flex: 0, parts: [part(post, 'fill', 'rockDeep'), part(rope, 'stroke', 'rockEdge', 2)] };
  },
  anchor: rng => {
    const h = rng.float(28, 42), w = h * 0.55;
    const body = p => { p.moveTo(0, -h + 8); p.lineTo(0, -4); p.moveTo(-w * 0.45, -h + 14); p.lineTo(w * 0.45, -h + 14); p.moveTo(-w, -12); p.quadraticCurveTo(-w * 0.8, 0, 0, -4); p.quadraticCurveTo(w * 0.8, 0, w, -12); };
    const ring = p => { p.moveTo(4, -h + 4); p.arc(0, -h + 4, 4, 0, TAU); };
    return { kind: 'anchor', flex: 0, parts: [part(body, 'stroke', 'ink', 3), part(ring, 'stroke', 'ink', 2)] };
  },
  barrel: rng => {
    const stack = rng.int(1, 2), r = rng.float(9, 12);
    const drums = p => { for (let k = 0; k < stack; k++) { const x = (k - (stack - 1) / 2) * r * 2.1; p.moveTo(x - r, 0); p.quadraticCurveTo(x - r * 1.25, -r * 1.3, x - r, -r * 2.6); p.lineTo(x + r, -r * 2.6); p.quadraticCurveTo(x + r * 1.25, -r * 1.3, x + r, 0); p.closePath(); } };
    const hoops = p => { for (let k = 0; k < stack; k++) { const x = (k - (stack - 1) / 2) * r * 2.1; for (const y of [-r * 0.6, -r * 2]) { p.moveTo(x - r * 1.1, y); p.lineTo(x + r * 1.1, y); } } };
    return { kind: 'barrel', flex: 0, parts: [part(drums, 'fill', 'rockEdge'), part(hoops, 'stroke', 'rockDeep', 2)] };
  },
  tombstone: rng => {
    const w = rng.float(14, 20), h = w * rng.float(1.2, 1.6), lean = rng.float(-0.12, 0.12);
    const stone = p => { p.moveTo(-w / 2, 0); p.lineTo(-w / 2 + lean * h, -h + w / 2); p.arc(lean * h, -h + w / 2, w / 2, Math.PI, TAU); p.lineTo(w / 2, 0); p.closePath(); };
    const cross = p => { const x = lean * h * 0.6, y = -h * 0.6; p.moveTo(x, y - 7); p.lineTo(x, y + 6); p.moveTo(x - 4, y - 3); p.lineTo(x + 4, y - 3); };
    return { kind: 'tombstone', flex: 0, parts: [part(stone, 'fill', 'rockDeep'), part(cross, 'stroke', 'ink', 1.5)] };
  },
  pumpkin: rng => {
    const r = rng.float(9, 14);
    const body = p => { for (const dx of [-0.5, 0, 0.5]) { p.moveTo(dx * r + r * 0.7, -r * 0.8); p.ellipse(dx * r, -r * 0.8, r * 0.7, r * 0.8, 0, 0, TAU); } };
    const face = p => { p.moveTo(-r * 0.5, -r * 1); p.lineTo(-r * 0.25, -r * 1.25); p.lineTo(-r * 0.05, -r * 1); p.closePath(); p.moveTo(r * 0.05, -r * 1); p.lineTo(r * 0.25, -r * 1.25); p.lineTo(r * 0.5, -r * 1); p.closePath(); p.moveTo(-r * 0.5, -r * 0.6); p.lineTo(r * 0.5, -r * 0.6); p.lineTo(0, -r * 0.35); p.closePath(); };
    const stem = p => { p.moveTo(0, -r * 1.55); p.quadraticCurveTo(2, -r * 1.9, 5, -r * 2); };
    return { kind: 'pumpkin', flex: 0, parts: [part(body, 'fill', 'accent'), part(face, 'fill', 'rockDeep'), part(stem, 'stroke', 'rockEdge', 2.5)] };
  },
  palm: rng => {
    const h = rng.float(60, 100), lean = rng.float(-14, 14), fronds = rng.int(5, 7);
    const trunk = p => { p.moveTo(0, 0); p.quadraticCurveTo(lean * 0.2, -h / 2, lean, -h); };
    const leaves = p => { for (let k = 0; k < fronds; k++) { const a = Math.PI + (k / (fronds - 1)) * Math.PI, len = rng.float(22, 32); p.moveTo(lean, -h); p.quadraticCurveTo(lean + Math.cos(a) * len * 0.6, -h + Math.sin(a) * len * 0.6 - 8, lean + Math.cos(a) * len, -h + Math.sin(a) * len * 0.4 + 10); } };
    return { kind: 'palm', flex: 0.4, parts: [part(trunk, 'stroke', 'rockDeep', 4), part(leaves, 'stroke', 'rockEdge', 2.5)] };
  },
  arcadeCabinet: rng => {
    const h = rng.float(40, 55), w = h * 0.45;
    const body = p => { p.moveTo(-w / 2, 0); p.lineTo(-w / 2, -h); p.lineTo(w / 2, -h); p.lineTo(w / 2, -h * 0.55); p.lineTo(w / 2 + 4, -h * 0.4); p.lineTo(w / 2, -h * 0.3); p.lineTo(w / 2, 0); p.closePath(); };
    const screen = p => p.rect(-w / 2 + 3, -h * 0.85, w - 6, h * 0.3);
    const buttons = p => { for (const dx of [-0.2, 0.15]) { p.moveTo(dx * w + 2, -h * 0.42); p.arc(dx * w, -h * 0.42, 2, 0, TAU); } };
    return { kind: 'arcadeCabinet', flex: 0, parts: [part(body, 'fill', 'rockDeep'), part(screen, 'fill', 'ink'), part(buttons, 'fill', 'accent')] };
  },
  boombox: rng => {
    const w = rng.float(26, 34), h = w * 0.5;
    const box = p => { p.rect(-w / 2, -h, w, h); p.moveTo(-w / 3, -h); p.lineTo(-w / 4, -h - 6); p.lineTo(w / 4, -h - 6); p.lineTo(w / 3, -h); };
    const speakers = p => { for (const dx of [-0.28, 0.28]) { p.moveTo(dx * w + h * 0.33, -h / 2); p.arc(dx * w, -h / 2, h * 0.33, 0, TAU); } };
    return { kind: 'boombox', flex: 0, parts: [part(box, 'fill', 'rockDeep'), part(speakers, 'stroke', 'ink', 2)] };
  },
  gear: rng => {
    const r = rng.float(12, 20), teeth = rng.int(8, 11);
    const cog = p => { polygon(p, 0, -r - 4, r + 4, teeth * 2, 0, 1); };
    const hub = p => { p.moveTo(r * 0.35, -r - 4); p.arc(0, -r - 4, r * 0.35, 0, TAU); };
    const stand = p => { p.moveTo(-r * 0.6, 0); p.lineTo(0, -r - 4); p.lineTo(r * 0.6, 0); };
    return { kind: 'gear', flex: 0, parts: [part(stand, 'stroke', 'ink', 2), part(cog, 'stroke', 'rockEdge', 4), part(hub, 'fill', 'rockDeep')] };
  },
  oilDrum: rng => {
    const r = rng.float(8, 11), h = r * 2.6;
    const drum = p => { p.rect(-r, -h, r * 2, h); };
    const bands = p => { for (const y of [-h * 0.33, -h * 0.66]) { p.moveTo(-r, y); p.lineTo(r, y); } };
    const mark = p => { polygon(p, 0, -h / 2, r * 0.45, 3, -Math.PI / 2); };
    return { kind: 'oilDrum', flex: 0, parts: [part(drum, 'fill', 'rockDeep'), part(bands, 'stroke', 'ink', 1.5), part(mark, 'fill', 'rockEdge')] };
  },
  toadstool: rng => {
    const h = rng.float(25, 55), r = rng.float(14, 24);
    const stalk = p => { p.moveTo(-4, 0); p.lineTo(-3, -h); p.lineTo(3, -h); p.lineTo(4, 0); p.closePath(); };
    const cap = p => { p.moveTo(-r, -h); p.quadraticCurveTo(-r, -h - r * 0.9, 0, -h - r * 0.9); p.quadraticCurveTo(r, -h - r * 0.9, r, -h); p.closePath(); };
    const spots = p => { for (const [x, y, k] of [[-0.45, 0.3, 0.16], [0.1, 0.55, 0.2], [0.5, 0.3, 0.14]]) { p.moveTo(r * x + r * k, -h - r * y); p.arc(r * x, -h - r * y, r * k, 0, TAU); } };
    return { kind: 'toadstool', flex: 0.2, parts: [part(stalk, 'fill', 'ink'), part(cap, 'fill', 'accent'), part(spots, 'fill', 'rockEdge')] };
  },
  glowShroom: rng => {
    const caps = Array.from({ length: rng.int(3, 5) }, (_, i) => ({ x: (i - 2) * 6 + rng.float(-2, 2), h: rng.float(10, 28), r: rng.float(4, 8) }));
    const stems = p => { for (const c of caps) { p.moveTo(c.x, 0); p.lineTo(c.x, -c.h); } };
    const tops = p => { for (const c of caps) { p.moveTo(c.x + c.r, -c.h); p.arc(c.x, -c.h, c.r, Math.PI, TAU); p.closePath(); } };
    return { kind: 'glowShroom', flex: 0.4, parts: [part(stems, 'stroke', 'ink', 1.5), part(tops, 'fill', 'rockEdge')] };
  },
  balloon: rng => {
    const h = rng.float(45, 80), r = rng.float(8, 12);
    const string = p => { p.moveTo(0, 0); p.quadraticCurveTo(6, -h / 2, 0, -h); };
    const ball = p => { p.moveTo(r, -h - r); p.ellipse(0, -h - r, r, r * 1.2, 0, 0, TAU); p.moveTo(-2, -h); p.lineTo(2, -h); p.lineTo(0, -h + 3); p.closePath(); };
    return { kind: 'balloon', flex: 1.2, parts: [part(string, 'stroke', 'ink', 1), part(ball, 'fill', 'accent')] };
  },
  pinwheel: rng => {
    const h = rng.float(35, 60), r = rng.float(9, 13), spin = rng.float(0, TAU);
    const stick = p => { p.moveTo(0, 0); p.lineTo(0, -h); };
    const blades = p => { for (let k = 0; k < 4; k++) { const a = spin + (k * TAU) / 4; p.moveTo(0, -h); p.lineTo(Math.cos(a) * r, -h + Math.sin(a) * r); p.lineTo(Math.cos(a + 0.9) * r * 0.6, -h + Math.sin(a + 0.9) * r * 0.6); p.closePath(); } };
    return { kind: 'pinwheel', flex: 0.5, parts: [part(stick, 'stroke', 'ink', 1.5), part(blades, 'fill', 'accent')] };
  },
  mapleTree: rng => {
    const h = rng.float(50, 90), r = rng.float(22, 36), pts = blobPoints(0, -h, r, 0.18, rng, 9);
    const trunk = p => { p.moveTo(-3, 0); p.lineTo(-2, -h * 0.7); p.lineTo(2, -h * 0.7); p.lineTo(3, 0); p.closePath(); };
    const limbs = p => { for (const a of [-0.9, -0.3, 0.5]) { p.moveTo(0, -h * 0.55); p.lineTo(Math.sin(a) * r * 0.8, -h * 0.55 - Math.cos(a) * r * 0.8); } };
    const canopy = p => blob(p, pts);
    return { kind: 'mapleTree', flex: 0.35, parts: [part(trunk, 'fill', 'ink'), part(limbs, 'stroke', 'ink', 1.5), part(canopy, 'fill', 'accent')] };
  },
  column: rng => {
    const h = rng.float(40, 90), w = rng.float(10, 15), broken = rng.chance(0.6);
    const shaft = p => {
      p.moveTo(-w / 2, 0); p.lineTo(-w / 2, -h);
      if (broken) { for (let i = 0; i <= 4; i++) p.lineTo(-w / 2 + (i * w) / 4, -h + (i % 2 ? rng.float(-6, 0) : rng.float(0, 5))); }
      else { p.lineTo(-w / 2 - 3, -h); p.lineTo(w / 2 + 3, -h); }
      p.lineTo(w / 2, -h); p.lineTo(w / 2, 0); p.closePath();
    };
    const flutes = p => { for (const x of [-w * 0.25, 0, w * 0.25]) { p.moveTo(x, -4); p.lineTo(x, -h + 8); } };
    return { kind: 'column', flex: 0, parts: [part(shaft, 'fill', 'rockEdge'), part(flutes, 'stroke', 'rockDeep', 1)] };
  },
  brazier: rng => {
    const h = rng.float(20, 34), flames = rng.int(3, 5);
    const bowl = p => { p.moveTo(-10, -h); p.lineTo(10, -h); p.lineTo(6, -h + 9); p.lineTo(-6, -h + 9); p.closePath(); p.moveTo(-2, -h + 9); p.lineTo(2, -h + 9); p.lineTo(4, 0); p.lineTo(-4, 0); p.closePath(); };
    const fire = p => { for (let i = 0; i < flames; i++) { const x = (i - (flames - 1) / 2) * 4, fh = rng.float(8, 16); p.moveTo(x - 3, -h); p.quadraticCurveTo(x - 1, -h - fh * 0.5, x, -h - fh); p.quadraticCurveTo(x + 1, -h - fh * 0.5, x + 3, -h); } };
    return { kind: 'brazier', flex: 0.6, parts: [part(bowl, 'fill', 'ink'), part(fire, 'fill', 'accent')] };
  },
  waxCells: rng => {
    const cells = rng.int(3, 6), r = rng.float(7, 11);
    const spec = Array.from({ length: cells }, (_, i) => ({ x: (i - cells / 2) * r * 1.7, y: -r - (i % 2) * r * 1.5 }));
    const build = p => { for (const c of spec) polygon(p, c.x, c.y, r, 6, Math.PI / 6); };
    const honey = p => { for (const c of spec.filter((_, i) => i % 2)) { p.moveTo(c.x + r * 0.5, c.y); p.arc(c.x, c.y, r * 0.5, 0, TAU); } };
    return { kind: 'waxCells', flex: 0, parts: [part(build, 'fill', 'rockEdge'), part(build, 'stroke', 'ink', 1), part(honey, 'fill', 'accent')] };
  },
  flask: rng => {
    const h = rng.float(26, 40), r = rng.float(9, 14), fill = rng.float(0.3, 0.6);
    const glass = p => { p.moveTo(-4, -h); p.lineTo(-4, -h + 10); p.quadraticCurveTo(-r, -r, -r, -r * 0.6); p.arc(0, -r * 0.6, r, Math.PI, 0, true); p.quadraticCurveTo(r, -r, 4, -h + 10); p.lineTo(4, -h); p.closePath(); };
    const liquid = p => { p.moveTo(r * 0.9, -r * 0.6 + r * (1 - fill)); p.arc(0, -r * 0.6, r * 0.9, Math.asin(1 - fill), Math.PI - Math.asin(1 - fill)); p.closePath(); };
    return { kind: 'flask', flex: 0, parts: [part(liquid, 'fill', 'accent'), part(glass, 'stroke', 'ink', 1.5)] };
  },
  treasureChest: rng => {
    const w = rng.float(22, 30), h = w * 0.6, open = rng.chance(0.5);
    const box = p => { p.moveTo(-w / 2, 0); p.lineTo(-w / 2, -h * 0.6); p.lineTo(w / 2, -h * 0.6); p.lineTo(w / 2, 0); p.closePath(); };
    const lid = p => { if (open) { p.moveTo(-w / 2, -h * 0.6); p.lineTo(-w / 2 - 4, -h * 1.3); p.lineTo(w / 2 - 6, -h * 1.45); p.lineTo(w / 2, -h * 0.75); p.closePath(); } else { p.moveTo(-w / 2, -h * 0.6); p.arc(0, -h * 0.6, w / 2, Math.PI, 0); p.closePath(); } };
    const gold = p => { if (!open) { p.moveTo(2, -h * 0.5); p.arc(0, -h * 0.5, 2, 0, TAU); return; } for (let i = 0; i < 5; i++) { const x = (i - 2) * w * 0.17; p.moveTo(x + 3, -h * 0.62 - (i % 2) * 3); p.arc(x, -h * 0.62 - (i % 2) * 3, 3, 0, TAU); } };
    return { kind: 'treasureChest', flex: 0, parts: [part(box, 'fill', 'rockDeep'), part(lid, 'fill', 'rockEdge'), part(lid, 'stroke', 'ink', 1), part(gold, 'fill', 'accent')] };
  },
  candle: rng => {
    const h = rng.float(18, 40), w = rng.float(4, 7);
    const stick = p => { p.moveTo(-w / 2, 0); p.lineTo(-w / 2, -h); p.lineTo(w / 2, -h + rng.float(0, 4)); p.lineTo(w / 2, 0); p.closePath(); };
    const flame = p => { p.moveTo(0, -h - 1); p.quadraticCurveTo(-3, -h - 6, 0, -h - 12); p.quadraticCurveTo(3, -h - 6, 0, -h - 1); };
    return { kind: 'candle', flex: 0.3, parts: [part(stick, 'fill', 'rockEdge'), part(flame, 'fill', 'accent')] };
  },
  statue: rng => {
    const h = rng.float(40, 70), w = rng.float(12, 18);
    const plinth = p => { p.moveTo(-w, 0); p.lineTo(-w, -8); p.lineTo(w, -8); p.lineTo(w, 0); p.closePath(); };
    const body = p => { p.moveTo(-w * 0.5, -8); p.lineTo(-w * 0.4, -h * 0.7); p.lineTo(w * 0.4, -h * 0.7); p.lineTo(w * 0.5, -8); p.closePath(); p.moveTo(w * 0.3, -h * 0.78); p.arc(0, -h * 0.78, w * 0.3, 0, TAU); };
    const wings = p => { for (const s of [-1, 1]) { p.moveTo(s * w * 0.4, -h * 0.65); p.quadraticCurveTo(s * w * 1.3, -h * 0.9, s * w * 1.1, -h * 0.35); p.lineTo(s * w * 0.45, -h * 0.4); } };
    return { kind: 'statue', flex: 0, parts: [part(plinth, 'fill', 'rockDeep'), part(wings, 'fill', 'rockDeep'), part(body, 'fill', 'rockEdge')] };
  },
};
