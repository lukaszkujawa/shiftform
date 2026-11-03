export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mix(a, b) {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const levelRng = (level, name, stride, salt) => new Rng(mix(level.palette * 131 + (level.index ?? 0) * stride + salt, hashString(name)));

export class Rng {
  constructor(seed) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min, max) {
    return min + this.next() * (max - min);
  }

  chance(p) {
    return this.next() < p;
  }

  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted(items, weightOf) {
    const total = items.reduce((sum, item) => sum + weightOf(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weightOf(item);
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
