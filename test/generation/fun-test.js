import { writeFileSync } from 'node:fs';
import { generateBiome } from '../../src/generation/generator.js';
import { DEFAULT_DESIGN } from '../../src/generation/design.js';
import { funScore, funSignals } from '../../src/generation/fun.js';
import { blueprintFromLevel, proofHolds } from '../../src/builder/from-level.js';
import { encodeBlueprint } from '../../src/builder/blueprint.js';

const POOL = +(process.argv[2] ?? 40);
const PICKS = 5;
const THEME = 12;
const OUT = new URL('../../.fun-test.html', import.meta.url);

const design = { ...DEFAULT_DESIGN, difficulty: 4, stretches: 2 };
const scored = [];
for (let k = 0; k < POOL; k++) {
  const level = generateBiome(`blind-${k}`, design.difficulty, null, [], null, () => {}, [], design);
  const blueprint = blueprintFromLevel(level, { title: 'Blind test', theme: THEME });
  if (proofHolds(level, blueprint)) scored.push({ blueprint, score: funScore(funSignals(level)), title: level.title });
  process.stderr.write(`\r${k + 1}/${POOL}`);
}
scored.sort((a, b) => b.score - a.score);
const picks = [...scored.slice(0, PICKS).map(entry => ({ ...entry, group: 'high' })), ...scored.slice(-PICKS).map(entry => ({ ...entry, group: 'low' }))];
const shuffled = picks.map((entry, k) => ({ entry, order: (k * 7 + 3) % picks.length })).sort((a, b) => a.order - b.order).map(({ entry }) => entry);
const rows = await Promise.all(shuffled.map(async ({ blueprint, score, group, title }, k) => ({ name: String.fromCharCode(65 + k), code: await encodeBlueprint(blueprint), score, group, title })));
writeFileSync(OUT, `<!doctype html><meta charset="utf-8"><title>Blind fun test</title>
<style>body{font:16px system-ui;background:#10101a;color:#eee;max-width:560px;margin:32px auto;padding:0 16px}li{margin:12px 0;list-style:none;display:flex;gap:12px;align-items:center}a{color:#7cf2ff;width:90px}input{width:160px}#key{white-space:pre-wrap;color:#aaa}</style>
<h1>Blind fun test</h1><p>Play each level, then rate it 1 to 5. Reveal only when you are done.</p><ol id="list"></ol><button id="reveal">Reveal</button><p id="key"></p>
<script>
const rows = ${JSON.stringify(rows)};
const rate = name => localStorage.getItem('fun-' + name) ?? '';
document.querySelector('#list').innerHTML = rows.map(r => '<li><a target="_blank" href="/#level=' + r.code + '">Level ' + r.name + '</a><input type="range" min="1" max="5" value="' + (rate(r.name) || 3) + '" data-name="' + r.name + '"><output>' + (rate(r.name) || '-') + '</output></li>').join('');
for (const input of document.querySelectorAll('input')) input.oninput = () => { localStorage.setItem('fun-' + input.dataset.name, input.value); input.nextElementSibling.textContent = input.value; };
document.querySelector('#reveal').onclick = () => {
  const mean = group => { const rated = rows.filter(r => r.group === group && rate(r.name)); return rated.length ? (rated.reduce((sum, r) => sum + +rate(r.name), 0) / rated.length).toFixed(1) : 'unrated'; };
  document.querySelector('#key').textContent = 'High scorers averaged ' + mean('high') + ', low scorers ' + mean('low') + '.\\n\\n' + rows.map(r => r.name + ': score ' + r.score + ' (' + r.group + '), ' + r.title + ', you gave ' + (rate(r.name) || '-')).join('\\n');
};
</script>`);
console.log(`\nwrote .fun-test.html from ${scored.length} levels; scores ${scored.at(-1).score} to ${scored[0].score}`);
