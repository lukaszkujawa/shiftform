import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeBlueprint } from '../src/builder/blueprint.js';
import { chunkFrom } from '../src/generation/chunk.js';

const LIBRARY = fileURLToPath(new URL('../src/generation/chunks.js', import.meta.url));
const TEST_SEEDS = ['a', 'b', 'c'];
const USAGE = `usage:
  node tools/chunk.mjs add <level link or code> --id <id> [--title "<title>"]
  node tools/chunk.mjs list
  node tools/chunk.mjs remove <id>`;

const flag = (args, name) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const codeOf = text => text.replace(/^.*#level=/, '');
const line = (indent, text) => `${' '.repeat(indent)}${text}`;

function render(chunks) {
  const rows = chunks.map(chunk => [
    line(2, '{'),
    line(4, `id: ${JSON.stringify(chunk.id)},`),
    line(4, `title: ${JSON.stringify(chunk.title)},`),
    line(4, `rows: ${chunk.rows},`),
    line(4, `start: ${JSON.stringify(chunk.start)},`),
    line(4, `goal: ${JSON.stringify(chunk.goal)},`),
    line(4, `steps: ${JSON.stringify(chunk.steps)},`),
    line(4, 'tiles: ['),
    ...chunk.tiles.map(row => line(6, `'${row}',`)),
    line(4, '],'),
    line(4, 'items: ['),
    ...chunk.items.map(item => line(6, `${JSON.stringify(item)},`)),
    line(4, '],'),
    line(2, '},'),
  ].join('\n').replaceAll('"', "'"));
  return `export const CHUNKS = [\n${rows.join('\n')}\n];\n`;
}

const load = async () => (await import(`${pathToFileURL(LIBRARY).href}?${Date.now()}`)).CHUNKS;
const save = chunks => writeFileSync(LIBRARY, render(chunks));

async function prove(id) {
  const { generateBiome } = await import(`../src/generation/generator.js?${Date.now()}`);
  const { DEFAULT_DESIGN } = await import('../src/generation/design.js');
  const kept = [], times = [];
  for (const seed of TEST_SEEDS) {
    const began = performance.now();
    const level = generateBiome(`${id}-${seed}`, 3, null, [], null, () => {}, [], { ...DEFAULT_DESIGN, idea: id, stretches: 4 });
    times.push(Math.round(performance.now() - began));
    if (level.segments.some(segment => segment.idea === id)) kept.push(seed);
  }
  return { kept: kept.length, of: TEST_SEEDS.length, times };
}

async function add(args) {
  const [source] = args, id = flag(args, 'id');
  if (!source || !id || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(USAGE);
  const blueprint = await decodeBlueprint(codeOf(source.trim()));
  const { dropped, ...chunk } = chunkFrom(blueprint, id, flag(args, 'title'));
  const before = await load(), chunks = before.filter(other => other.id !== id);
  save([...chunks, chunk]);
  console.log(`${chunk.title}: ${chunk.rows} rows, ${chunk.steps.length} footsteps, ${chunk.items.length} blocks${dropped ? `, ${dropped} below the Start left out` : ''}`);
  const { kept, of, times } = await prove(id);
  console.log(`kept in ${kept} of ${of} test biomes (${times.join(', ')} ms)`);
  if (kept) return;
  save(before);
  console.log('not added: no test biome could prove a climb through it. Put a Footstep every few rows along the way, on a ledge to stand on or in the air to pass through, and keep the Start near the middle.');
}

async function list() {
  for (const chunk of await load()) console.log(`${chunk.id}\t${chunk.title}\t${chunk.rows} rows, ${chunk.steps.length} footsteps, ${chunk.items.length} blocks`);
}

async function remove([id]) {
  const chunks = await load();
  if (!chunks.some(chunk => chunk.id === id)) throw new Error(`no chunk called ${id}`);
  save(chunks.filter(chunk => chunk.id !== id));
  console.log(`removed ${id}`);
}

const [command, ...rest] = process.argv.slice(2);
const commands = { add, list, remove };
if (!commands[command]) { console.error(USAGE); process.exit(1); }
commands[command](rest).catch(error => { console.error(error.message); process.exit(1); });
