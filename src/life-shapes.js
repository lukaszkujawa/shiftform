const TAU = Math.PI * 2;

function branch(segments, x, y, len, angle, depth, rng, spread) {
  const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
  segments.push([x, y, ex, ey]);
  if (depth <= 0) return segments;
  const forks = rng.int(2, 3);
  for (let i = 0; i < forks; i++) branch(segments, ex, ey, len * rng.float(0.55, 0.75), angle + rng.float(-spread, spread), depth - 1, rng, spread);
  return segments;
}

const strokeSegments = segments => p => { for (const [x0, y0, x1, y1] of segments) { p.moveTo(x0, y0); p.lineTo(x1, y1); } };

function stemPoint(len, lean, t) {
  const u = 1 - t;
  return [2 * u * t * lean * len * 0.5 + t * t * lean * len, 2 * u * t * -len * 0.5 + t * t * -len];
}

function frond(p, len, leaflets, lean) {
  p.moveTo(0, 0);
  p.quadraticCurveTo(lean * len * 0.5, -len * 0.5, lean * len, -len);
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1), [sx, sy] = stemPoint(len, lean, t), w = len * 0.22 * (1 - t);
    for (const side of [-1, 1]) {
      p.moveTo(sx, sy);
      p.quadraticCurveTo(sx + side * w * 0.5, sy - w * 0.3, sx + side * w, sy - w * 0.1);
    }
  }
}

function blobPoints(cx, cy, r, wobble, rng, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU, rr = r * (1 + rng.float(-wobble, wobble));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
}

function blob(p, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  p.moveTo(...mid(pts[n - 1], pts[0]));
  for (let i = 0; i < n; i++) p.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
  p.closePath();
}

function polygon(p, cx, cy, r, sides, rot = 0, stretch = 1) {
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * stretch;
    if (i) p.lineTo(x, y);
    else p.moveTo(x, y);
  }
  p.closePath();
}

function segmented(g, count, spacing, radius, wave, t) {
  for (let i = 0; i < count; i++) {
    g.beginPath();
    g.arc(-i * spacing, Math.sin(t * 3 + i * 0.6) * wave, radius * (1 - i / (count + 2)), 0, TAU);
    g.fill();
  }
}

function wings(g, x, y, span, flap) {
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + side * span * 0.5, y - span * 0.6 * flap, x + side * span, y - span * 0.25 * flap);
    g.quadraticCurveTo(x + side * span * 0.5, y + span * 0.15, x, y);
    g.fill();
  }
}

function eye(g, x, y, r, open, ink) {
  g.fillStyle = ink;
  g.beginPath();
  g.ellipse(x, y, r, Math.max(0.2, r * open), 0, 0, TAU);
  g.fill();
}

const blink = (t, phase) => (Math.sin(t * 2.3 + phase) > 0.93 ? 0.1 : 1);
const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const part = (build, mode, color, width = 1.5) => ({ build, mode, color, width });

const PLANTS = {
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
};

const CREATURES = {
  jelly: rng => {
    const r = rng.float(10, 22), arms = rng.int(4, 7), phase = rng.float(0, TAU);
    return {
      kind: 'jelly', width: r * 2, height: r * 3,
      draw(g, t, c) {
        const pulse = 1 + 0.08 * Math.sin(t * 2 + phase);
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * pulse, r * 0.8 / pulse, 0, Math.PI, TAU);
        g.closePath();
        g.fill();
        g.strokeStyle = c.secondary;
        g.lineWidth = 1.5;
        for (let i = 0; i < arms; i++) {
          const x = (i / (arms - 1) - 0.5) * r * 1.6, sway = Math.sin(t * 1.5 + phase + i) * 6;
          g.beginPath();
          g.moveTo(x, 0);
          g.quadraticCurveTo(x + sway, r, x - sway * 0.5, r * 2.2);
          g.stroke();
        }
      },
    };
  },
  moth: rng => {
    const span = rng.float(8, 16), phase = rng.float(0, TAU), rate = rng.float(9, 14);
    return {
      kind: 'moth', width: span * 2, height: span,
      draw(g, t, c) {
        const flap = 0.4 + 0.6 * Math.abs(Math.sin(t * rate + phase));
        g.fillStyle = c.primary;
        wings(g, 0, 0, span, flap);
        g.fillStyle = c.ink;
        g.beginPath();
        g.ellipse(0, 1, span * 0.12, span * 0.4, 0, 0, TAU);
        g.fill();
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -span * 0.3); g.lineTo(-span * 0.3, -span * 0.7);
        g.moveTo(0, -span * 0.3); g.lineTo(span * 0.3, -span * 0.7);
        g.stroke();
      },
    };
  },
  beetle: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'beetle', width: r * 3, height: r * 2,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
          const kick = Math.sin(t * 4 + phase + i) * 2;
          g.beginPath();
          g.moveTo(side * r * 0.6, i * r * 0.5);
          g.lineTo(side * r * 1.5, i * r * 0.5 + kick);
          g.stroke();
        }
        g.fillStyle = c.ink;
        g.beginPath();
        g.ellipse(0, 0, r, r * 1.3, 0, 0, TAU);
        g.fill();
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, r * 0.3, r * 0.7, r * 0.8, 0, 0, TAU);
        g.fill();
      },
    };
  },
  bird: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'bird', width: r * 3, height: r * 2.5,
      draw(g, t, c) {
        const turn = Math.sin(t * 0.8 + phase) * r * 0.3;
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * 1.4, r, 0.2, 0, TAU);
        g.fill();
        dot(g, r + turn, -r * 0.9, r * 0.6);
        g.beginPath();
        g.moveTo(-r * 1.2, 0); g.lineTo(-r * 2.2, r * 0.4); g.lineTo(-r * 2, -r * 0.3);
        g.closePath();
        g.fill();
        g.fillStyle = c.ink;
        g.beginPath();
        g.moveTo(r * 1.5 + turn, -r * 0.9); g.lineTo(r * 2.1 + turn, -r * 0.7); g.lineTo(r * 1.5 + turn, -r * 0.6);
        g.closePath();
        g.fill();
        eye(g, r * 1.1 + turn, -r, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  prismBug: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'prismBug', width: r * 3, height: r * 2,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * r * 0.5, -r * 0.5);
          g.lineTo(side * r * 1.3, -r * 1.4 + Math.sin(t * 5 + phase + side) * 1.5);
          g.stroke();
          for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(side * r * 0.7, i * r * 0.5); g.lineTo(side * r * 1.5, i * r * 0.8); g.stroke(); }
        }
        g.fillStyle = Math.sin(t * 3 + phase) > 0.6 ? c.secondary : c.primary;
        g.beginPath();
        polygon(g, 0, 0, r, 6, t * 0.2 + phase);
        g.fill();
        g.stroke();
      },
    };
  },
  lavaWorm: rng => {
    const count = rng.int(6, 10), r = rng.float(3, 6), phase = rng.float(0, TAU);
    return {
      kind: 'lavaWorm', width: count * r * 1.4, height: r * 4,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        segmented(g, count, r * 1.4, r, r * 0.8, t + phase);
        g.fillStyle = c.secondary;
        dot(g, 0, Math.sin((t + phase) * 3) * r * 0.8, r * 0.6);
        eye(g, r * 0.3, Math.sin((t + phase) * 3) * r * 0.8 - r * 0.3, 1, 1, c.ink);
      },
    };
  },
  fireMoth: rng => {
    const moth = CREATURES.moth(rng);
    return { ...moth, kind: 'fireMoth', draw: (g, t, c) => moth.draw(g, t * 1.4, { ...c, primary: c.secondary }) };
  },
  hare: rng => {
    const r = rng.float(6, 11), phase = rng.float(0, TAU);
    return {
      kind: 'hare', width: r * 3, height: r * 3,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * 1.4, r, 0, 0, TAU);
        g.fill();
        dot(g, r * 1.3, -r * 0.7, r * 0.65);
        for (const side of [-1, 1]) {
          const twitch = side > 0 && Math.sin(t * 7 + phase) > 0.8 ? 0.3 : 0;
          g.beginPath();
          g.ellipse(r * 1.3 + side * r * 0.25, -r * 1.9, r * 0.22, r * 0.8, side * 0.15 + twitch, 0, TAU);
          g.fill();
        }
        dot(g, -r * 1.4, -r * 0.2, r * 0.3);
        eye(g, r * 1.5, -r * 0.8, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  owl: rng => {
    const r = rng.float(7, 12), phase = rng.float(0, TAU);
    return {
      kind: 'owl', width: r * 2, height: r * 3,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * 0.9, r * 1.3, 0, 0, TAU);
        g.fill();
        dot(g, 0, -r * 1.5, r * 0.8);
        g.fillStyle = c.secondary;
        g.beginPath();
        g.ellipse(0, r * 0.2, r * 0.5, r * 0.9, 0, 0, TAU);
        g.fill();
        const open = blink(t, phase);
        for (const side of [-1, 1]) {
          g.fillStyle = c.secondary;
          dot(g, side * r * 0.35, -r * 1.55, r * 0.3);
          eye(g, side * r * 0.35, -r * 1.55, r * 0.15, open, c.ink);
        }
        g.fillStyle = c.ink;
        g.beginPath();
        g.moveTo(-r * 0.12, -r * 1.35); g.lineTo(r * 0.12, -r * 1.35); g.lineTo(0, -r * 1.1);
        g.closePath();
        g.fill();
      },
    };
  },
  whale: rng => {
    const len = rng.float(40, 90), phase = rng.float(0, TAU);
    return {
      kind: 'whale', width: len, height: len * 0.4,
      draw(g, t, c) {
        g.save();
        g.rotate(Math.sin(t * 0.5 + phase) * 0.06);
        g.fillStyle = c.secondary;
        g.beginPath();
        g.moveTo(-len * 0.5, 0);
        g.bezierCurveTo(-len * 0.3, -len * 0.3, len * 0.3, -len * 0.3, len * 0.5, 0);
        g.bezierCurveTo(len * 0.3, len * 0.18, -len * 0.3, len * 0.18, -len * 0.5, 0);
        g.fill();
        const tail = Math.sin(t * 1.2 + phase) * len * 0.08;
        g.beginPath();
        g.moveTo(-len * 0.45, 0); g.lineTo(-len * 0.65, -len * 0.14 + tail); g.lineTo(-len * 0.65, len * 0.14 + tail);
        g.closePath();
        g.fill();
        g.beginPath();
        g.moveTo(0, len * 0.1); g.lineTo(-len * 0.1, len * 0.28); g.lineTo(len * 0.12, len * 0.12);
        g.closePath();
        g.fill();
        eye(g, len * 0.32, -len * 0.04, 2, blink(t, phase), c.ink);
        g.restore();
      },
    };
  },
  satellite: rng => {
    const s = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'satellite', width: s * 5, height: s * 2,
      draw(g, t, c) {
        g.save();
        g.rotate(t * 0.15 + phase);
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        g.rect(-s * 0.5, -s * 0.5, s, s);
        g.rect(-s * 2.5, -s * 0.3, s * 1.6, s * 0.6);
        g.rect(s * 0.9, -s * 0.3, s * 1.6, s * 0.6);
        g.moveTo(0, -s * 0.5); g.lineTo(0, -s * 1.4);
        g.stroke();
        g.fillStyle = c.primary;
        dot(g, 0, -s * 1.4, s * 0.25);
        g.restore();
      },
    };
  },
  butterfly: rng => {
    const span = rng.float(9, 15), phase = rng.float(0, TAU), rate = rng.float(6, 9);
    return {
      kind: 'butterfly', width: span * 2, height: span * 1.4,
      draw(g, t, c) {
        const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * rate + phase));
        g.fillStyle = c.primary;
        wings(g, 0, -1, span, flap);
        g.fillStyle = c.secondary;
        wings(g, 0, 2, span * 0.6, -flap);
        g.fillStyle = c.ink;
        g.beginPath();
        g.ellipse(0, 0, span * 0.1, span * 0.45, 0, 0, TAU);
        g.fill();
      },
    };
  },
  frog: rng => {
    const r = rng.float(6, 10), phase = rng.float(0, TAU);
    return {
      kind: 'frog', width: r * 3, height: r * 2,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * 1.3, r * 0.8, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(-r * 0.9, r * 0.5, r * 0.6, r * 0.35, 0.4, 0, TAU);
        g.fill();
        for (const dx of [0.4, 0.9]) dot(g, r * dx, -r * 0.7, r * 0.35);
        const throat = 0.5 + 0.5 * Math.sin(t * 5 + phase);
        g.fillStyle = c.secondary;
        dot(g, r * 0.9, r * 0.3, r * 0.25 * throat + 0.5);
        for (const dx of [0.4, 0.9]) eye(g, r * dx, -r * 0.75, r * 0.15, blink(t, phase), c.ink);
      },
    };
  },
  vulture: rng => {
    const span = rng.float(16, 26), phase = rng.float(0, TAU);
    return {
      kind: 'vulture', width: span * 2, height: span * 0.6,
      draw(g, t, c) {
        const tip = Math.sin(t * 0.9 + phase) * span * 0.15;
        g.strokeStyle = c.ink;
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-span, tip); g.quadraticCurveTo(-span * 0.5, -span * 0.25, 0, 0); g.quadraticCurveTo(span * 0.5, -span * 0.25, span, tip);
        g.stroke();
        g.fillStyle = c.ink;
        dot(g, span * 0.12, -1, span * 0.1);
      },
    };
  },
  lizard: rng => {
    const len = rng.float(18, 28), phase = rng.float(0, TAU);
    return {
      kind: 'lizard', width: len * 1.6, height: len * 0.3,
      draw(g, t, c) {
        const wag = Math.sin(t * 6 + phase);
        g.strokeStyle = c.primary;
        g.lineCap = 'round';
        g.lineWidth = len * 0.2;
        g.beginPath();
        g.moveTo(len * 0.5, 0); g.quadraticCurveTo(0, wag * 2, -len * 0.4, 0);
        g.stroke();
        g.lineWidth = len * 0.08;
        g.beginPath();
        g.moveTo(-len * 0.4, 0); g.quadraticCurveTo(-len * 0.8, wag * len * 0.2, -len * 1.1, -wag * len * 0.1);
        for (const [x, s] of [[len * 0.3, 1], [-len * 0.2, -1]]) for (const side of [-1, 1]) { g.moveTo(x, 0); g.lineTo(x + side * wag * s * len * 0.12, len * 0.18); }
        g.stroke();
        eye(g, len * 0.45, -len * 0.04, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  fish: rng => {
    const len = rng.float(14, 26), phase = rng.float(0, TAU);
    return {
      kind: 'fish', width: len * 1.3, height: len * 0.6,
      draw(g, t, c) {
        const wag = Math.sin(t * 7 + phase) * len * 0.12;
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, len * 0.5, len * 0.25, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(-len * 0.4, 0); g.lineTo(-len * 0.75, -len * 0.2 + wag); g.lineTo(-len * 0.75, len * 0.2 + wag);
        g.closePath();
        g.fill();
        eye(g, len * 0.28, -len * 0.05, 1.4, 1, c.ink);
      },
    };
  },
  crab: rng => {
    const r = rng.float(6, 10), phase = rng.float(0, TAU);
    return {
      kind: 'crab', width: r * 4, height: r * 2,
      draw(g, t, c) {
        g.strokeStyle = c.primary;
        g.lineWidth = 1.5;
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const kick = Math.sin(t * 8 + phase + i) * 2;
          g.beginPath();
          g.moveTo(side * r * 0.6, r * 0.2);
          g.lineTo(side * r * (1.2 + i * 0.25), r * 0.9 + kick);
          g.stroke();
        }
        g.fillStyle = c.primary;
        g.beginPath();
        g.ellipse(0, 0, r * 1.1, r * 0.7, 0, Math.PI, TAU);
        g.closePath();
        g.fill();
        const snap = Math.abs(Math.sin(t * 2 + phase)) * r * 0.3;
        for (const side of [-1, 1]) dot(g, side * r * 1.5, -r * 0.6 - snap, r * 0.4);
        eye(g, r * 0.3, -r * 0.8, 1.2, blink(t, phase), c.ink);
        eye(g, -r * 0.3, -r * 0.8, 1.2, blink(t, phase), c.ink);
      },
    };
  },
};

const members = (rng, count, spread) => Array.from({ length: count }, (_, i) => ({ dx: i * spread * 0.9 + rng.float(-spread * 0.3, spread * 0.3), dy: Math.sin(i * 1.3) * spread * 0.5 + rng.float(-6, 6), phase: rng.float(0, TAU) }));

const DRIFTERS = {
  jellyDrift: rng => ({ ...CREATURES.jelly(rng), kind: 'jellyDrift', speed: rng.float(8, 14), members: members(rng, rng.int(1, 2), 40) }),
  mothFlock: rng => ({ ...CREATURES.moth(rng), kind: 'mothFlock', speed: rng.float(30, 45), members: members(rng, rng.int(5, 9), 18) }),
  birdFlock: rng => {
    const r = rng.float(4, 7), rate = rng.float(5, 8);
    return {
      kind: 'birdFlock', speed: rng.float(45, 65), members: members(rng, rng.int(5, 9), 22),
      draw(g, t, c) {
        const flap = Math.sin(t * rate) * r;
        g.strokeStyle = c.ink;
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-r * 1.5, flap); g.quadraticCurveTo(-r * 0.6, -r * 0.3, 0, r * 0.3); g.quadraticCurveTo(r * 0.6, -r * 0.3, r * 1.5, flap);
        g.stroke();
      },
    };
  },
  seeds: rng => ({
    kind: 'seeds', speed: rng.float(18, 28), members: members(rng, rng.int(4, 7), 26),
    draw(g, t, c) {
      g.strokeStyle = c.ink;
      g.lineWidth = 1;
      g.save();
      g.rotate(Math.sin(t * 1.3) * 0.3);
      g.beginPath();
      g.moveTo(0, 6); g.lineTo(0, -4);
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; g.moveTo(0, -4); g.lineTo(Math.cos(a) * 7, -4 + Math.sin(a) * 7); }
      g.stroke();
      g.fillStyle = c.ink;
      dot(g, 0, 6, 1.5);
      g.restore();
    },
  }),
  shardDrift: rng => {
    const r = rng.float(3, 7), sides = rng.int(3, 5);
    return {
      kind: 'shardDrift', speed: rng.float(14, 22), members: members(rng, rng.int(3, 5), 30),
      draw(g, t, c) {
        g.fillStyle = c.primary;
        g.beginPath();
        polygon(g, 0, 0, r, sides, t * 0.6, 1.6);
        g.fill();
      },
    };
  },
  ashDrift: rng => ({
    kind: 'ashDrift', speed: rng.float(16, 24), members: members(rng, rng.int(6, 10), 14),
    draw(g, t, c) {
      g.fillStyle = c.secondary;
      dot(g, 0, Math.sin(t * 2) * 2, 1.5 + Math.abs(Math.sin(t * 1.7)));
    },
  }),
  whaleDrift: rng => ({ ...CREATURES.whale(rng), kind: 'whaleDrift', speed: rng.float(7, 11), members: members(rng, 1, 0) }),
  fireflies: rng => ({
    kind: 'fireflies', speed: rng.float(10, 18), members: members(rng, rng.int(6, 10), 24),
    draw(g, t, c) {
      g.fillStyle = c.primary;
      g.globalAlpha *= 0.3 + 0.7 * Math.abs(Math.sin(t * 2.5));
      dot(g, Math.sin(t * 1.7) * 6, Math.cos(t * 1.3) * 5, 2);
    },
  }),
  tumbleweed: rng => {
    const r = rng.float(10, 16), loops = Array.from({ length: 7 }, () => [rng.float(0.4, 1), rng.float(0, TAU)]);
    return {
      kind: 'tumbleweed', speed: rng.float(40, 60), members: members(rng, rng.int(1, 2), 70),
      draw(g, t, c) {
        g.save();
        g.translate(0, -Math.abs(Math.sin(t * 2.2)) * r);
        g.rotate(t * 3);
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        for (const [k, a] of loops) g.ellipse(0, 0, r * k, r, a, 0, TAU);
        g.stroke();
        g.restore();
      },
    };
  },
  fishSchool: rng => {
    const fish = CREATURES.fish(rng);
    return { ...fish, kind: 'fishSchool', speed: rng.float(25, 40), members: members(rng, rng.int(6, 10), 16), draw: (g, t, c) => { g.scale(0.5, 0.5); fish.draw(g, t, c); } };
  },
  petals: rng => ({
    kind: 'petals', speed: rng.float(20, 32), members: members(rng, rng.int(6, 10), 22),
    draw(g, t, c) {
      g.fillStyle = c.secondary;
      g.rotate(t * 1.5);
      g.beginPath();
      g.ellipse(0, 0, 4, 2, 0, 0, TAU);
      g.fill();
    },
  }),
};

const walker = (kind, foot, hop) => rng => {
  const creature = CREATURES[kind](rng);
  return { ...creature, foot: creature.height * foot, hop: creature.height * hop };
};

const WALKERS = {
  hare: walker('hare', 1 / 3, 0.35),
  bird: walker('bird', 0.4, 0.2),
  owl: walker('owl', 0.43, 0.08),
  lavaWorm: walker('lavaWorm', 0.25, 0),
  frog: walker('frog', 0.4, 1.4),
  lizard: walker('lizard', 0.6, 0),
  crab: walker('crab', 0.45, 0),
};

const family = (plants, flyers, walkers, drifters) => ({
  plants: plants.map(k => PLANTS[k]),
  flyers: flyers.map(k => CREATURES[k]),
  walkers: walkers.map(k => WALKERS[k]),
  drifters: drifters.map(k => DRIFTERS[k]),
});

export const FAMILIES = {
  neon: family(['kelp', 'anemone', 'grass'], ['jelly', 'moth'], [], ['jellyDrift', 'mothFlock']),
  paper: family(['fern', 'dandelion', 'grass'], ['beetle', 'moth'], ['bird'], ['birdFlock', 'seeds']),
  crystal: family(['cluster', 'geodeFlower', 'grass'], ['prismBug', 'moth'], [], ['shardDrift']),
  ember: family(['deadTree', 'emberShrub', 'grass'], ['fireMoth'], ['lavaWorm'], ['mothFlock', 'ashDrift']),
  frost: family(['pine', 'birch', 'grass'], ['moth'], ['hare', 'owl'], ['birdFlock']),
  void: family(['nebulaFlower', 'urchin', 'anemone'], ['whale', 'satellite', 'jelly'], [], ['whaleDrift']),
  jungle: family(['monstera', 'fern', 'grass'], ['butterfly', 'moth'], ['frog'], ['fireflies']),
  dunes: family(['cactus', 'grass', 'deadTree'], ['vulture'], ['lizard'], ['tumbleweed', 'seeds']),
  deep: family(['kelp', 'coral', 'anemone'], ['fish', 'jelly'], ['crab'], ['fishSchool']),
  blossom: family(['bamboo', 'blossomTree', 'grass'], ['butterfly'], ['hare'], ['petals']),
};
