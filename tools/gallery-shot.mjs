import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
};
const port = +option('port', 9450), origin = option('origin', 'http://localhost:8080'), out = option('out', tmpdir()), wait = +option('wait', 2500);
const zoom = option('zoom', null);
const hashes = args;
const sleep = ms => new Promise(done => setTimeout(done, ms));

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(process.env.HOME, 'Library/Caches/ms-playwright');
  const shell = readdirSync(cache).find(name => name.startsWith('chromium_headless_shell'));
  return join(cache, shell, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
}

const profile = mkdtempSync(join(tmpdir(), 'shiftform-gallery-'));
const chrome = spawn(chromePath(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-sandbox', '--mute-audio', '--use-angle=metal', '--enable-gpu', 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  target = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).then(list => list.find(t => t.type === 'page')).catch(() => null);
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(done => { socket.onopen = done; });
let id = 0;
const waiting = new Map(), errors = [];
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  if (waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
};
const cdp = (method, params = {}) => new Promise(done => { waiting.set(++id, done); socket.send(JSON.stringify({ id, method, params })); });
await cdp('Runtime.enable');
await cdp('Log.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

for (const [k, hash] of hashes.entries()) {
  await cdp('Page.navigate', { url: 'about:blank' });
  await sleep(100);
  await cdp('Page.navigate', { url: `${origin}/tools/gallery.html#${hash}` });
  await sleep(wait);
  const clip = zoom ? (([x, y, width, height]) => ({ x, y, width, height, scale: 2 }))(zoom.split(',').map(Number)) : undefined;
  const { result } = await cdp('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  const file = join(out, `gallery-${k}-${hash.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log(file);
}
if (errors.length) console.log('page errors:', errors.slice(0, 5));
chrome.kill();
rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
process.exit(0);
