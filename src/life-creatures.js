import { TAU, polygon, segmented, wings, eye, blink, dot, oval, poly, members } from './life-kit.js';

export const CREATURES = {
  jelly: rng => {
    const r = rng.float(10, 22), arms = rng.int(4, 7), phase = rng.float(0, TAU);
    return {
      kind: 'jelly', height: r * 3,
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
      kind: 'moth', height: span,
      draw(g, t, c) {
        const flap = 0.4 + 0.6 * Math.abs(Math.sin(t * rate + phase));
        g.fillStyle = c.primary;
        wings(g, 0, 0, span, flap);
        g.fillStyle = c.ink;
        oval(g, 0, 1, span * 0.12, span * 0.4);
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
      kind: 'beetle', height: r * 2,
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
        oval(g, 0, 0, r, r * 1.3);
        g.fillStyle = c.primary;
        oval(g, 0, r * 0.3, r * 0.7, r * 0.8);
      },
    };
  },
  bird: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'bird', height: r * 2.5,
      draw(g, t, c) {
        const turn = Math.sin(t * 0.8 + phase) * r * 0.3;
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.4, r, 0.2);
        dot(g, r + turn, -r * 0.9, r * 0.6);
        poly(g, -r * 1.2, 0, -r * 2.2, r * 0.4, -r * 2, -r * 0.3);
        g.fillStyle = c.ink;
        poly(g, r * 1.5 + turn, -r * 0.9, r * 2.1 + turn, -r * 0.7, r * 1.5 + turn, -r * 0.6);
        eye(g, r * 1.1 + turn, -r, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  prismBug: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'prismBug', height: r * 2,
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
      kind: 'lavaWorm', height: r * 4,
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
      kind: 'hare', height: r * 3,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.4, r);
        dot(g, r * 1.3, -r * 0.7, r * 0.65);
        for (const side of [-1, 1]) {
          const twitch = side > 0 && Math.sin(t * 7 + phase) > 0.8 ? 0.3 : 0;
          oval(g, r * 1.3 + side * r * 0.25, -r * 1.9, r * 0.22, r * 0.8, side * 0.15 + twitch);
        }
        dot(g, -r * 1.4, -r * 0.2, r * 0.3);
        eye(g, r * 1.5, -r * 0.8, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  owl: rng => {
    const r = rng.float(7, 12), phase = rng.float(0, TAU);
    return {
      kind: 'owl', height: r * 3,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 0.9, r * 1.3);
        dot(g, 0, -r * 1.5, r * 0.8);
        g.fillStyle = c.secondary;
        oval(g, 0, r * 0.2, r * 0.5, r * 0.9);
        const open = blink(t, phase);
        for (const side of [-1, 1]) {
          g.fillStyle = c.secondary;
          dot(g, side * r * 0.35, -r * 1.55, r * 0.3);
          eye(g, side * r * 0.35, -r * 1.55, r * 0.15, open, c.ink);
        }
        g.fillStyle = c.ink;
        poly(g, -r * 0.12, -r * 1.35, r * 0.12, -r * 1.35, 0, -r * 1.1);
      },
    };
  },
  whale: rng => {
    const len = rng.float(40, 90), phase = rng.float(0, TAU);
    return {
      kind: 'whale', height: len * 0.4,
      draw(g, t, c) {
        g.rotate(Math.sin(t * 0.5 + phase) * 0.06);
        g.fillStyle = c.secondary;
        g.beginPath();
        g.moveTo(-len * 0.5, 0);
        g.bezierCurveTo(-len * 0.3, -len * 0.3, len * 0.3, -len * 0.3, len * 0.5, 0);
        g.bezierCurveTo(len * 0.3, len * 0.18, -len * 0.3, len * 0.18, -len * 0.5, 0);
        g.fill();
        const tail = Math.sin(t * 1.2 + phase) * len * 0.08;
        poly(g, -len * 0.45, 0, -len * 0.65, -len * 0.14 + tail, -len * 0.65, len * 0.14 + tail);
        poly(g, 0, len * 0.1, -len * 0.1, len * 0.28, len * 0.12, len * 0.12);
        eye(g, len * 0.32, -len * 0.04, 2, blink(t, phase), c.ink);
      },
    };
  },
  satellite: rng => {
    const s = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'satellite', height: s * 2,
      draw(g, t, c) {
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
      },
    };
  },
  butterfly: rng => {
    const span = rng.float(9, 15), phase = rng.float(0, TAU), rate = rng.float(6, 9);
    return {
      kind: 'butterfly', height: span * 1.4,
      draw(g, t, c) {
        const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * rate + phase));
        g.fillStyle = c.primary;
        wings(g, 0, -1, span, flap);
        g.fillStyle = c.secondary;
        wings(g, 0, 2, span * 0.6, -flap);
        g.fillStyle = c.ink;
        oval(g, 0, 0, span * 0.1, span * 0.45);
      },
    };
  },
  frog: rng => {
    const r = rng.float(6, 10), phase = rng.float(0, TAU);
    return {
      kind: 'frog', height: r * 2,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.3, r * 0.8);
        oval(g, -r * 0.9, r * 0.5, r * 0.6, r * 0.35, 0.4);
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
      kind: 'vulture', height: span * 0.6,
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
      kind: 'lizard', height: len * 0.3,
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
      kind: 'fish', height: len * 0.6,
      draw(g, t, c) {
        const wag = Math.sin(t * 7 + phase) * len * 0.12;
        g.fillStyle = c.primary;
        oval(g, 0, 0, len * 0.5, len * 0.25);
        poly(g, -len * 0.4, 0, -len * 0.75, -len * 0.2 + wag, -len * 0.75, len * 0.2 + wag);
        eye(g, len * 0.28, -len * 0.05, 1.4, 1, c.ink);
      },
    };
  },
  crab: rng => {
    const r = rng.float(6, 10), phase = rng.float(0, TAU);
    return {
      kind: 'crab', height: r * 2,
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
        for (const side of [1, -1]) eye(g, side * r * 0.3, -r * 0.8, 1.2, blink(t, phase), c.ink);
      },
    };
  },
  blimp: rng => {
    const r = rng.float(18, 28), phase = rng.float(0, TAU);
    return {
      kind: 'blimp', height: r * 1.4,
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        oval(g, 0, 0, r * 1.5, r * 0.55);
        g.fillStyle = c.ink;
        poly(g, -r * 1.3, 0, -r * 1.8, -r * 0.5, -r * 1.6, 0, -r * 1.8, r * 0.5);
        g.beginPath(); g.rect(-r * 0.3, r * 0.5, r * 0.6, r * 0.2); g.fill();
        if (Math.sin(t * 3 + phase) > 0) { g.fillStyle = c.primary; dot(g, r * 1.4, 0, 2); }
      },
    };
  },
  cat: rng => {
    const r = rng.float(6, 9), phase = rng.float(0, TAU);
    return {
      kind: 'cat', height: r * 2.4,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.4, r * 0.75);
        dot(g, r * 1.4, -r * 0.6, r * 0.6);
        for (const dx of [1.05, 1.6]) { poly(g, r * dx, -r * 0.9, r * (dx + 0.15), -r * 1.5, r * (dx + 0.35), -r * 0.95); }
        g.strokeStyle = c.primary;
        g.lineWidth = r * 0.3;
        g.beginPath(); g.moveTo(-r * 1.3, -r * 0.2); g.quadraticCurveTo(-r * 2.2, -r * 0.4, -r * 2 + Math.sin(t * 2 + phase) * r * 0.4, -r * 1.4); g.stroke();
        eye(g, r * 1.6, -r * 0.7, 1, blink(t, phase), c.ink);
      },
    };
  },
  bee: rng => {
    const r = rng.float(4, 7), phase = rng.float(0, TAU);
    return {
      kind: 'bee', height: r * 2.5,
      draw(g, t, c) {
        const flap = Math.abs(Math.sin(t * 30 + phase));
        g.fillStyle = c.secondary;
        for (const side of [-1, 1]) { oval(g, side * r * 0.3, -r * (0.8 + 0.3 * flap), r * 0.5, r * 0.8, side * 0.4); }
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.1, r * 0.7);
        g.strokeStyle = c.ink;
        g.lineWidth = r * 0.3;
        g.beginPath(); for (const x of [-0.3, 0.25]) { g.moveTo(r * x, -r * 0.65); g.lineTo(r * x, r * 0.65); } g.stroke();
      },
    };
  },
  sheep: rng => {
    const r = rng.float(7, 10), phase = rng.float(0, TAU);
    return {
      kind: 'sheep', height: r * 2.6,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = r * 0.25;
        g.beginPath(); for (const x of [-0.8, -0.3, 0.4, 0.9]) { g.moveTo(r * x, r * 0.5); g.lineTo(r * x, r * 1.2); } g.stroke();
        g.fillStyle = c.secondary;
        for (const [x, y] of [[-0.8, 0], [0, -0.35], [0.8, 0], [-0.4, 0.3], [0.4, 0.3], [0, 0.1]]) dot(g, r * x, r * y, r * 0.6);
        g.fillStyle = c.ink;
        const nod = Math.sin(t * 1.5 + phase) * 0.15;
        oval(g, r * 1.45, -r * 0.2 + nod * r, r * 0.45, r * 0.6, 0.5);
      },
    };
  },
  drone: rng => {
    const s = rng.float(5, 8), phase = rng.float(0, TAU);
    return {
      kind: 'drone', height: s * 2,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-s * 2, 0); g.lineTo(s * 2, 0); g.stroke();
        g.fillStyle = c.ink;
        g.beginPath(); g.rect(-s * 0.7, -s * 0.4, s * 1.4, s * 0.9); g.fill();
        g.fillStyle = c.secondary;
        const spin = 0.3 + 0.7 * Math.abs(Math.sin(t * 25 + phase));
        for (const side of [-1, 1]) { oval(g, side * s * 2, -s * 0.3, s * spin, s * 0.2); }
        if (Math.sin(t * 4 + phase) > 0.3) { g.fillStyle = c.primary; dot(g, 0, s * 0.6, 1.5); }
      },
    };
  },
  robot: rng => {
    const s = rng.float(6, 9), phase = rng.float(0, TAU);
    return {
      kind: 'robot', height: s * 4,
      draw(g, t, c) {
        const bob = Math.abs(Math.sin(t * 6 + phase)) * s * 0.1;
        g.fillStyle = c.ink;
        g.beginPath(); g.rect(-s * 0.9, s * 1.1, s * 1.8, s * 0.5); g.fill();
        g.fillStyle = c.secondary;
        g.beginPath(); g.rect(-s * 0.8, -s * 0.2 - bob, s * 1.6, s * 1.3); g.fill();
        g.beginPath(); g.rect(-s * 0.55, -s * 1.3 - bob, s * 1.1, s * 0.9); g.fill();
        g.strokeStyle = c.secondary;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, -s * 1.3 - bob); g.lineTo(0, -s * 1.9 - bob); g.stroke();
        g.fillStyle = c.primary;
        dot(g, s * 0.25, -s * 0.85 - bob, s * 0.18);
        dot(g, 0, -s * 1.95 - bob, s * 0.15);
      },
    };
  },
  wrappedCandy: rng => {
    const r = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'wrappedCandy', height: r * 2,
      draw(g, t, c) {
        g.rotate(t * 0.8 + phase);
        g.fillStyle = c.secondary;
        for (const side of [-1, 1]) { poly(g, side * r, 0, side * r * 2, -r * 0.8, side * r * 2, r * 0.8); }
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.1, r * 0.8);
      },
    };
  },
  gummyBear: rng => {
    const r = rng.float(6, 9);
    return {
      kind: 'gummyBear', height: r * 3.4,
      draw(g, t, c) {
        g.fillStyle = c.primary;
        oval(g, 0, r * 0.3, r * 0.9, r * 1.05);
        dot(g, 0, -r * 1.1, r * 0.75);
        for (const side of [-1, 1]) { dot(g, side * r * 0.55, -r * 1.7, r * 0.3); dot(g, side * r * 0.85, r * 0.05, r * 0.32); dot(g, side * r * 0.55, r * 1.25, r * 0.38); }
        eye(g, r * 0.25, -r * 1.15, 1, 1, c.ink);
      },
    };
  },
  paperPlane: rng => {
    const s = rng.float(8, 13);
    return {
      kind: 'paperPlane', height: s,
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        poly(g, s * 1.1, 0, -s * 1.1, -s * 0.5, -s * 0.6, 0, -s * 1.1, s * 0.35);
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(s * 1.1, 0); g.lineTo(-s * 0.6, 0); g.stroke();
      },
    };
  },
  roomba: rng => {
    const r = rng.float(8, 12), phase = rng.float(0, TAU);
    return {
      kind: 'roomba', height: r * 0.8,
      draw(g, t, c) {
        g.fillStyle = c.ink;
        oval(g, 0, 0, r * 1.1, r * 0.4);
        g.fillStyle = c.secondary;
        oval(g, 0, -r * 0.12, r * 0.8, r * 0.22);
        if (Math.sin(t * 5 + phase) > 0) { g.fillStyle = c.primary; dot(g, r * 0.5, -r * 0.15, 1.5); }
      },
    };
  },
  glitchCube: rng => {
    const s = rng.float(5, 9), phase = rng.float(0, TAU);
    return {
      kind: 'glitchCube', height: s * 2,
      draw(g, t, c) {
        const tick = Math.floor(t * 8 + phase * 4);
        for (let k = 0; k < 3; k++) {
          const shift = ((tick * (k + 3)) % 5) - 2;
          g.fillStyle = k === 1 ? c.secondary : c.primary;
          g.beginPath(); g.rect(-s + shift, -s + (k * 2 * s) / 3, s * 2, (s * 2) / 3); g.fill();
        }
      },
    };
  },
  crawler: rng => {
    const r = rng.float(3, 5), phase = rng.float(0, TAU);
    return {
      kind: 'crawler', height: r * 3,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i < 4; i++) { const x = -i * r * 1.4, kick = Math.sin(t * 12 + i + phase) * r * 0.5; g.moveTo(x, 0); g.lineTo(x + kick, r * 1.4); }
        g.stroke();
        g.fillStyle = c.primary;
        segmented(g, 4, r * 1.4, r, r * 0.15, t + phase);
      },
    };
  },
  bat: rng => {
    const span = rng.float(8, 14), phase = rng.float(0, TAU), rate = rng.float(10, 14);
    return {
      kind: 'bat', height: span,
      draw(g, t, c) {
        const flap = Math.sin(t * rate + phase) * span * 0.5;
        g.fillStyle = c.ink;
        g.beginPath();
        g.moveTo(0, 0);
        for (const side of [-1, 1]) { g.moveTo(0, 0); g.quadraticCurveTo(side * span * 0.5, -flap - span * 0.2, side * span, -flap); g.lineTo(side * span * 0.7, span * 0.1); g.lineTo(side * span * 0.45, -span * 0.05); g.lineTo(side * span * 0.2, span * 0.2); g.closePath(); }
        g.fill();
        dot(g, 0, 0, span * 0.2);
      },
    };
  },
  rocket: rng => {
    const s = rng.float(6, 10), phase = rng.float(0, TAU);
    return {
      kind: 'rocket', height: s * 2,
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        g.beginPath(); g.moveTo(s * 2.2, 0); g.quadraticCurveTo(s * 1.2, -s * 0.8, -s * 1.5, -s * 0.6); g.lineTo(-s * 1.5, s * 0.6); g.quadraticCurveTo(s * 1.2, s * 0.8, s * 2.2, 0); g.fill();
        g.fillStyle = c.ink;
        for (const side of [-1, 1]) { poly(g, -s * 0.8, side * s * 0.5, -s * 1.6, side * s * 1.1, -s * 1.5, side * s * 0.4); }
        g.fillStyle = c.primary;
        const flame = s * (1 + 0.4 * Math.sin(t * 20 + phase));
        poly(g, -s * 1.5, -s * 0.4, -s * 1.5 - flame, 0, -s * 1.5, s * 0.4);
      },
    };
  },
  astronaut: rng => {
    const r = rng.float(6, 9), phase = rng.float(0, TAU);
    return {
      kind: 'astronaut', height: r * 3.6,
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        g.beginPath(); g.rect(-r * 0.7, -r * 0.4, r * 1.4, r * 1.4); g.fill();
        g.beginPath(); g.rect(-r * 1.05, -r * 0.3, r * 0.4, r * 1.1); g.fill();
        for (const dx of [-0.45, 0.15]) { g.beginPath(); g.rect(dx * r, r, r * 0.35, r * 0.8); g.fill(); }
        dot(g, 0, -r, r * 0.75);
        g.fillStyle = c.primary;
        oval(g, r * 0.25, -r, r * 0.45, r * 0.32);
        if (Math.sin(t * 2 + phase) > 0.6) { g.fillStyle = c.ink; dot(g, -r * 0.85, -r * 0.4, 1.2); }
      },
    };
  },
  gull: rng => {
    const span = rng.float(10, 15), phase = rng.float(0, TAU), rate = rng.float(3, 5);
    return {
      kind: 'gull', height: span * 0.6,
      draw(g, t, c) {
        const flap = Math.sin(t * rate + phase) * span * 0.35;
        g.strokeStyle = c.ink;
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(-span, -flap); g.quadraticCurveTo(-span * 0.4, -span * 0.5, 0, 0); g.quadraticCurveTo(span * 0.4, -span * 0.5, span, -flap); g.stroke();
        g.fillStyle = c.primary;
        dot(g, span * 0.15, span * 0.05, 1.5);
      },
    };
  },
  ghost: rng => {
    const r = rng.float(9, 15), phase = rng.float(0, TAU);
    return {
      kind: 'ghost', height: r * 2.6,
      draw(g, t, c) {
        g.fillStyle = c.ink;
        g.beginPath();
        g.moveTo(-r, 0);
        g.arc(0, 0, r, Math.PI, TAU);
        g.lineTo(r, r * 1.3);
        for (let k = 3; k >= 0; k--) { const x = -r + (k * 2 * r) / 3, wave = Math.sin(t * 4 + phase + k) * r * 0.15; g.quadraticCurveTo(x + r / 3, r * 1.0 + wave, x, r * 1.3 + wave); }
        g.closePath();
        g.fill();
        eye(g, -r * 0.35, -r * 0.1, r * 0.15, blink(t, phase), c.primary);
        eye(g, r * 0.35, -r * 0.1, r * 0.15, blink(t, phase), c.primary);
      },
    };
  },
  spider: rng => {
    const r = rng.float(4, 6), phase = rng.float(0, TAU);
    return {
      kind: 'spider', height: r * 3,
      draw(g, t, c) {
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < 4; k++) for (const side of [-1, 1]) { const kick = Math.sin(t * 10 + k + phase) * r * 0.3; g.moveTo(0, 0); g.quadraticCurveTo(side * r * (1 + k * 0.4), -r * 1.2, side * r * (1.4 + k * 0.5) + kick, r * 1.3); }
        g.stroke();
        g.fillStyle = c.primary;
        dot(g, 0, 0, r);
        dot(g, r * 0.9, -r * 0.2, r * 0.55);
      },
    };
  },
  vinyl: rng => {
    const r = rng.float(8, 13), phase = rng.float(0, TAU);
    return {
      kind: 'vinyl', height: r * 2,
      draw(g, t, c) {
        g.fillStyle = c.ink;
        dot(g, 0, 0, r);
        g.fillStyle = c.primary;
        dot(g, 0, 0, r * 0.35);
        g.strokeStyle = c.secondary;
        g.lineWidth = 1;
        const a = t * 3 + phase;
        g.beginPath(); g.arc(0, 0, r * 0.7, a, a + 1); g.stroke();
      },
    };
  },
  snail: rng => {
    const r = rng.float(5, 8), phase = rng.float(0, TAU);
    return {
      kind: 'snail', height: r * 2.6,
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        oval(g, 0, r * 0.75, r * 1.9, r * 0.35);
        g.strokeStyle = c.secondary;
        g.lineWidth = 1;
        const look = Math.sin(t * 1.5 + phase) * r * 0.2;
        g.beginPath(); g.moveTo(r * 1.5, r * 0.6); g.lineTo(r * 1.9 + look, -r * 0.4); g.moveTo(r * 1.3, r * 0.6); g.lineTo(r * 1.5 + look, -r * 0.3); g.stroke();
        g.fillStyle = c.primary;
        dot(g, -r * 0.2, 0, r);
        g.strokeStyle = c.ink;
        g.beginPath(); for (let a = 0; a < TAU * 2; a += 0.3) { const rr = r * (1 - a / (TAU * 2)) * 0.85; g.lineTo(-r * 0.2 + Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke();
      },
    };
  },
  kite: rng => {
    const s = rng.float(9, 14), phase = rng.float(0, TAU);
    return {
      kind: 'kite', height: s * 4,
      draw(g, t, c) {
        g.rotate(Math.sin(t * 1.4 + phase) * 0.25);
        g.fillStyle = c.primary;
        poly(g, 0, -s * 1.3, s * 0.8, 0, 0, s * 1.2, -s * 0.8, 0);
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, -s * 1.3); g.lineTo(0, s * 1.2); g.moveTo(-s * 0.8, 0); g.lineTo(s * 0.8, 0);
        g.moveTo(0, s * 1.2); for (let k = 1; k <= 4; k++) g.quadraticCurveTo((k % 2 ? 1 : -1) * s * 0.4, s * (1.2 + k * 0.4 - 0.2), Math.sin(t * 3 + k) * s * 0.2, s * (1.2 + k * 0.4));
        g.stroke();
      },
    };
  },
  fox: rng => {
    const r = rng.float(6, 9), phase = rng.float(0, TAU);
    return {
      kind: 'fox', height: r * 2.4,
      draw(g, t, c) {
        const wag = Math.sin(t * 2 + phase) * r * 0.3;
        g.fillStyle = c.primary;
        oval(g, 0, 0, r * 1.5, r * 0.75);
        poly(g, r * 1.1, -r * 0.3, r * 2.4, -r * 0.1, r * 1.3, -r * 1.3);
        for (const dx of [1.15, 1.7]) poly(g, r * dx, -r, r * (dx + 0.15), -r * 1.8, r * (dx + 0.4), -r * 1.05);
        g.strokeStyle = c.primary;
        g.lineWidth = r * 0.55;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(-r * 1.4, -r * 0.1); g.quadraticCurveTo(-r * 2.4, -r * 0.3, -r * 2.6 + wag, -r * 1.1); g.stroke();
        g.strokeStyle = c.ink;
        g.lineWidth = r * 0.3;
        g.beginPath(); g.moveTo(-r * 2.6 + wag, -r * 1.1); g.lineTo(-r * 2.75 + wag, -r * 1.35); g.stroke();
        eye(g, r * 1.7, -r * 0.6, 1, blink(t, phase), c.ink);
        dot(g, r * 2.4, -r * 0.1, r * 0.18);
      },
    };
  },
};

const flock = (kind, base, speed, count, spread) => rng => ({
  ...CREATURES[base](rng),
  kind,
  speed: rng.float(...speed),
  members: members(rng, Array.isArray(count) ? rng.int(...count) : count, spread),
});

export const DRIFTERS = {
  jellyDrift: flock('jellyDrift', 'jelly', [8, 14], [1, 2], 40),
  mothFlock: flock('mothFlock', 'moth', [30, 45], [5, 9], 18),
  beeSwarm: flock('beeSwarm', 'bee', [35, 50], [6, 10], 14),
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
      g.rotate(Math.sin(t * 1.3) * 0.3);
      g.beginPath();
      g.moveTo(0, 6); g.lineTo(0, -4);
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; g.moveTo(0, -4); g.lineTo(Math.cos(a) * 7, -4 + Math.sin(a) * 7); }
      g.stroke();
      g.fillStyle = c.ink;
      dot(g, 0, 6, 1.5);
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
  whaleDrift: flock('whaleDrift', 'whale', [7, 11], 1, 0),
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
        g.translate(0, -Math.abs(Math.sin(t * 2.2)) * r);
        g.rotate(t * 3);
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath();
        for (const [k, a] of loops) g.ellipse(0, 0, r * k, r, a, 0, TAU);
        g.stroke();
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
      oval(g, 0, 0, 4, 2);
    },
  }),
  droneSwarm: flock('droneSwarm', 'drone', [25, 40], [3, 5], 34),
  cottonCloud: rng => {
    const r = rng.float(12, 18);
    return {
      kind: 'cottonCloud', speed: rng.float(6, 10), members: members(rng, rng.int(1, 2), 70),
      draw(g, t, c) {
        g.fillStyle = c.secondary;
        for (const [x, y, k] of [[-1.2, 0.2, 0.8], [0, -0.3, 1], [1.2, 0.2, 0.8], [0.5, 0.4, 0.7], [-0.5, 0.4, 0.7]]) dot(g, r * x, r * y, r * k);
      },
    };
  },
  paperSheets: rng => ({
    kind: 'paperSheets', speed: rng.float(14, 22), members: members(rng, rng.int(3, 5), 30),
    draw(g, t, c) {
      g.rotate(Math.sin(t * 1.2) * 0.6);
      g.fillStyle = c.secondary;
      g.beginPath(); g.rect(-6, -8, 12, 16); g.fill();
      g.strokeStyle = c.ink;
      g.lineWidth = 0.8;
      g.beginPath(); for (let y = -4; y < 7; y += 3) { g.moveTo(-4, y); g.lineTo(4, y); } g.stroke();
    },
  }),
  packets: rng => ({
    kind: 'packets', speed: rng.float(50, 75), members: members(rng, rng.int(4, 7), 24),
    draw(g, t, c) {
      g.strokeStyle = c.primary;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(-18, 0); g.stroke();
      g.fillStyle = c.primary;
      g.beginPath(); g.rect(-3, -3, 6, 6); g.fill();
    },
  }),
  batSwarm: flock('batSwarm', 'bat', [40, 60], [5, 9], 20),
  gullFlock: flock('gullFlock', 'gull', [25, 40], [3, 5], 34),
  meteors: rng => ({
    kind: 'meteors', speed: rng.float(80, 120), members: members(rng, rng.int(2, 4), 60),
    draw(g, t, c) {
      g.strokeStyle = c.secondary;
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -10); g.stroke();
      g.fillStyle = c.primary;
      dot(g, 0, 0, 2.5);
    },
  }),
  smokePuffs: rng => ({
    kind: 'smokePuffs', speed: rng.float(8, 14), members: members(rng, rng.int(3, 5), 40),
    draw(g, t, c) {
      g.fillStyle = c.secondary;
      for (const [x, y, k] of [[-10, 2, 9], [0, -4, 12], [11, 1, 8]]) dot(g, x, y + Math.sin(t + x) * 2, k * (1 + 0.08 * Math.sin(t * 0.7)));
    },
  }),
  hotAirBalloon: rng => {
    const r = rng.float(14, 20);
    return {
      kind: 'hotAirBalloon', speed: rng.float(6, 10), members: members(rng, rng.int(1, 2), 90),
      draw(g, t, c) {
        g.fillStyle = c.primary;
        g.beginPath(); g.moveTo(-r, 0); g.arc(0, 0, r, Math.PI, TAU); g.quadraticCurveTo(r, r * 0.8, r * 0.3, r * 1.3); g.lineTo(-r * 0.3, r * 1.3); g.quadraticCurveTo(-r, r * 0.8, -r, 0); g.fill();
        g.strokeStyle = c.secondary;
        g.lineWidth = 2;
        g.beginPath(); for (const x of [-0.45, 0, 0.45]) { g.moveTo(r * x, -r * Math.sqrt(1 - x * x)); g.quadraticCurveTo(r * x * 1.2, r * 0.4, r * x * 0.4, r * 1.3); } g.stroke();
        g.strokeStyle = c.ink;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(-r * 0.3, r * 1.3); g.lineTo(-r * 0.2, r * 1.75); g.moveTo(r * 0.3, r * 1.3); g.lineTo(r * 0.2, r * 1.75); g.stroke();
        g.fillStyle = c.ink;
        g.beginPath(); g.rect(-r * 0.25, r * 1.75, r * 0.5, r * 0.35); g.fill();
      },
    };
  },
};

const walker = (kind, foot, hop) => rng => {
  const creature = CREATURES[kind](rng);
  return { ...creature, foot: creature.height * foot, hop: creature.height * hop };
};

export const WALKERS = {
  hare: walker('hare', 1 / 3, 0.35),
  bird: walker('bird', 0.4, 0.2),
  owl: walker('owl', 0.43, 0.08),
  lavaWorm: walker('lavaWorm', 0.25, 0),
  frog: walker('frog', 0.4, 1.4),
  lizard: walker('lizard', 0.6, 0),
  crab: walker('crab', 0.45, 0),
  cat: walker('cat', 0.31, 0.05),
  sheep: walker('sheep', 0.46, 0.05),
  robot: walker('robot', 0.4, 0),
  gummyBear: walker('gummyBear', 0.48, 0.5),
  roomba: walker('roomba', 0.5, 0),
  crawler: walker('crawler', 0.47, 0),
  astronaut: walker('astronaut', 0.5, 0.9),
  spider: walker('spider', 0.43, 0),
  fox: walker('fox', 0.31, 0.12),
  snail: walker('snail', 0.42, 0),
};
