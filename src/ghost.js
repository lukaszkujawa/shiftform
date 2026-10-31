const BITS = ['left', 'right', 'jump', 'dash', 'interact', 'up', 'down', 'restart'];
const INPUTS = Array.from({ length: 1 << BITS.length }, (_, code) => Object.fromEntries(BITS.map((key, i) => [key, ((code >> i) & 1) === 1])));

export const codeOf = input => BITS.reduce((code, key, i) => (input[key] ? code | (1 << i) : code), 0);
export const inputOf = code => INPUTS[code];

const ACT_TYPES = ['pick', 'place', 'erase', 'flag', 'fire', 'swap', 'equip', 'reroll', 'blink'];
const ACT_FIELDS = { pick: ['value'], place: ['kind', 'x', 'y'], erase: ['id'], flag: [], fire: [], swap: ['from', 'to'], equip: ['value', 'giving'], reroll: [], blink: ['value'] };

function varint(bytes, n) {
  for (; ; n >>>= 7) {
    if (n < 0x80) { bytes.push(n); return; }
    bytes.push((n & 0x7f) | 0x80);
  }
}

function pack({ codes, acts = [] }) {
  const bytes = [];
  varint(bytes, codes.length);
  for (let i = 0; i < codes.length;) {
    let run = 1;
    while (codes[i + run] === codes[i]) run++;
    bytes.push(codes[i]);
    varint(bytes, run);
    i += run;
  }
  varint(bytes, acts.length);
  for (const act of acts) {
    varint(bytes, act.at);
    bytes.push(ACT_TYPES.indexOf(act.type));
    for (const field of ACT_FIELDS[act.type]) varint(bytes, Math.max(0, Math.round(act[field])));
  }
  return new Uint8Array(bytes);
}

function unpack(bytes) {
  let i = 0;
  const byte = () => { if (i >= bytes.length) throw new Error('truncated ghost'); return bytes[i++]; };
  const read = () => { let n = 0; for (let shift = 0; ; shift += 7) { const b = byte(); n |= (b & 0x7f) << shift; if (b < 0x80) return n >>> 0; } };
  const codes = [];
  const count = read();
  while (codes.length < count) {
    const code = byte(), run = read();
    for (let k = 0; k < run; k++) codes.push(code);
  }
  const acts = [];
  for (let n = read(); n > 0; n--) {
    const at = read(), type = ACT_TYPES[byte()];
    if (!type) throw new Error('unknown act');
    acts.push(Object.fromEntries([['at', at], ['type', type], ...ACT_FIELDS[type].map(field => [field, read()])]));
  }
  return { codes, acts };
}

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64Url(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function encodeGhost(recording) {
  return toBase64Url(await through(pack(recording), new CompressionStream('deflate-raw')));
}

export async function decodeGhost(text) {
  return unpack(await through(fromBase64Url(text), new DecompressionStream('deflate-raw')));
}
