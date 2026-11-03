import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openBrowser, sleep } from './browser.js';
import { playing } from './playing.js';
import { building } from './building.js';
import { flooded } from './flooded.js';
import { controls } from './controls.js';
import { phone } from './phone.js';

const PORT = 8097;
const ORIGIN = `http://localhost:${PORT}`;
const TIME_LIMIT_MS = 600000;

const server = spawn('node', [fileURLToPath(new URL('../../serve.js', import.meta.url))], { env: { ...process.env, PORT }, stdio: 'ignore' });
await sleep(400);
const browser = await openBrowser(ORIGIN);
const finish = code => {
  browser.close();
  server.kill();
  process.exit(code);
};
setTimeout(() => { console.log('timed out'); finish(2); }, TIME_LIMIT_MS);

for (const suite of [playing, building, flooded, controls, phone]) await suite(browser);

const failed = browser.results.filter(result => !result.ok).length;
console.log(`\n${browser.results.length - failed}/${browser.results.length} passed, ${browser.errors.length} page errors`);
for (const error of browser.errors.slice(0, 6)) console.log(`  ${error.slice(0, 220)}`);
finish(failed || browser.errors.length ? 1 : 0);
