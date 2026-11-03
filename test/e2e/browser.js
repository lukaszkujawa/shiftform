import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEBUG_PORT = 9390;
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };
const KEY_CODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32, KeyZ: 90, KeyF: 70, KeyR: 82, KeyV: 86, Escape: 27, Digit1: 49, Digit2: 50, KeyX: 88, Enter: 13 };
const IGNORED_LOGS = /favicon|gtag|googletag|ERR_/;

export const sleep = ms => new Promise(done => setTimeout(done, ms));

const keyName = code => ({ Space: ' ', Escape: 'Escape', Enter: 'Enter' }[code] ?? (code.startsWith('Key') ? code[3].toLowerCase() : code.startsWith('Digit') ? code[5] : code));

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(process.env.HOME, 'Library/Caches/ms-playwright');
  const shell = readdirSync(cache).find(name => name.startsWith('chromium_headless_shell'));
  if (!shell) throw new Error('set CHROME to a Chromium binary');
  return join(cache, shell, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
}

export async function openBrowser(origin) {
  const profile = mkdtempSync(join(tmpdir(), 'shiftform-e2e-'));
  const chrome = spawn(chromePath(), [`--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--no-sandbox', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then(r => r.json()).then(list => list.find(t => t.type === 'page')).catch(() => null);
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(done => { socket.onopen = done; });

  let id = 0;
  const waiting = new Map(), errors = [], results = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error' && !IGNORED_LOGS.test(message.params.entry.text + message.params.entry.url)) errors.push(`console: ${message.params.entry.text}`);
    if (waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
  };

  const cdp = (method, params = {}) => new Promise(done => { waiting.set(++id, done); socket.send(JSON.stringify({ id, method, params })); });
  const ev = async expression => {
    const { result } = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result?.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description ?? '').slice(0, 300));
    return result.result.value;
  };
  const down = code => cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: keyName(code), windowsVirtualKeyCode: KEY_CODES[code] });
  const up = code => cdp('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName(code), windowsVirtualKeyCode: KEY_CODES[code] });
  const tap = async (code, ms = 40) => { await down(code); await sleep(ms); await up(code); };
  const until = async (test, ms = 8000, step = 60) => {
    const began = Date.now();
    while (Date.now() - began < ms) {
      const value = await test();
      if (value) return value;
      await sleep(step);
    }
    return null;
  };
  const open = async hash => {
    await cdp('Page.navigate', { url: 'about:blank' });
    await sleep(150);
    await cdp('Page.navigate', { url: `${origin}/${hash}` });
    await sleep(1800);
  };
  const start = async hash => {
    await open(hash);
    await ev(`document.querySelector('#play').click()`);
    return until(async () => (await ev('window.shiftform?.state().phase')) === 'play', 45000, 300);
  };
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
  };
  const close = () => {
    chrome.kill();
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride', VIEWPORT);
  return { cdp, ev, down, up, tap, until, open, start, check, close, state: () => ev('shiftform.state()'), errors, results };
}
