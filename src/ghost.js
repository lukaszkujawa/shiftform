const BITS = ['left', 'right', 'jump', 'dash', 'interact', 'up', 'down', 'restart'];
const INPUTS = Array.from({ length: 1 << BITS.length }, (_, code) => Object.fromEntries(BITS.map((key, i) => [key, ((code >> i) & 1) === 1])));

export const codeOf = input => BITS.reduce((code, key, i) => (input[key] ? code | (1 << i) : code), 0);
export const inputOf = code => INPUTS[code];

function pack(codes) {
  const bytes = [];
  for (let i = 0; i < codes.length;) {
    let run = 1;
    while (codes[i + run] === codes[i]) run++;
    bytes.push(codes[i]);
    for (let n = run; ; n >>>= 7) {
      if (n < 0x80) { bytes.push(n); break; }
      bytes.push((n & 0x7f) | 0x80);
    }
    i += run;
  }
  return new Uint8Array(bytes);
}

function unpack(bytes) {
  const codes = [];
  for (let i = 0; i < bytes.length;) {
    const code = bytes[i++];
    let run = 0;
    for (let shift = 0; ; shift += 7) {
      if (i >= bytes.length) throw new Error('truncated ghost');
      const b = bytes[i++];
      run |= (b & 0x7f) << shift;
      if (b < 0x80) break;
    }
    for (let k = 0; k < run; k++) codes.push(code);
  }
  return codes;
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

export async function encodeGhost(codes) {
  return toBase64Url(await through(pack(codes), new CompressionStream('deflate-raw')));
}

export async function decodeGhost(text) {
  return unpack(await through(fromBase64Url(text), new DecompressionStream('deflate-raw')));
}
