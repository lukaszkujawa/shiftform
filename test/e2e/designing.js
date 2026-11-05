import { sleep } from './browser.js';

const pick = (ev, group, text) => ev(`[...document.querySelectorAll('#design-${group} button')].find(b => b.textContent === ${JSON.stringify(text)}).click()`);
const blueprint = ev => ev('shiftform.editor().blueprint');

export async function designing({ ev, until, open, check, state }) {
  await open('#');
  await ev(`document.querySelector('#build-level').click()`);
  await until(() => ev(`document.body.classList.contains('editing')`), 6000);
  await sleep(500);
  const lastRow = await ev(`Math.round(document.querySelector('#edit-exit').getBoundingClientRect().top - document.querySelector('#edit-test').getBoundingClientRect().top)`);
  check('the builder toolbar fits on one row', Math.abs(lastRow) < 12, `Exit is ${lastRow} px off`);
  await ev(`document.querySelector('#edit-design').click()`);
  check('the generate panel opens', await ev(`!document.querySelector('#edit-designer').hidden`));
  const before = (await blueprint(ev)).items.length;

  await ev(`document.querySelector('#design-seed').value = 'e2e-design'`);
  await ev(`(() => { const s = document.querySelector('#design-difficulty'); s.value = 6; s.dispatchEvent(new Event('input')); })()`);
  await pick(ev, 'stretches', 'Huge');
  await ev(`document.querySelector('#design-go').click()`);
  check('Generate shows progress and Cancel', await ev(`!document.querySelector('#design-progress').hidden && !document.querySelector('#design-cancel').hidden`));
  await ev(`document.querySelector('#design-cancel').click()`);
  await sleep(150);
  check('Cancel leaves your level alone', (await blueprint(ev)).items.length === before && await ev(`!document.querySelector('#design-go').hidden`));

  await pick(ev, 'budget', 'Fast');
  await pick(ev, 'stretches', 'Short');
  await pick(ev, 'monsters', 'None');
  await pick(ev, 'hazards', 'None');
  await ev(`document.querySelector('#design-go').click()`);
  const began = Date.now();
  const built = await until(() => ev(`document.querySelector('#design-go').hidden === false && /to climb/.test(document.querySelector('#design-note').textContent)`), 60000, 200);
  check('Fast comes back in about five seconds', Date.now() - began < 12000, `${Date.now() - began} ms`);
  check('a level gets generated', built, await ev(`document.querySelector('#design-note').textContent`));
  const level = await ev(`shiftform.editor().level().objects.map(o => o.type)`);
  const made = await blueprint(ev);
  check('Length sets the tower height', made.rows === 18, `rows ${made.rows}`);
  check('None means no monsters or hazards', !level.some(type => ['monster', 'lurker', 'saw', 'laser', 'spikes', 'shot'].includes(type)));
  check('it shows as proven', await ev(`!document.querySelector('#edit-proven').hidden`));

  await ev(`shiftform.editor().tool = 'erase'`);
  const item = made.items.find(i => i.b === 'made') ?? made.items.find(i => i.b !== 'start' && i.b !== 'goal');
  await ev(`(() => { const e = shiftform.editor(); e.remember(); e.eraseAt(${item.c}, ${item.r}); e.changed(); })()`);
  check('generated things can be erased', (await blueprint(ev)).items.length === made.items.length - 1);
  await ev(`shiftform.editor().undo()`);
  await ev(`shiftform.editor().undo()`);
  await sleep(100);
  check('undo brings the old level back', (await blueprint(ev)).items.length === before);
  await ev(`shiftform.editor().redo()`);
  await sleep(100);

  const full = (await blueprint(ev)).items.length;
  await ev(`document.querySelector('#edit-clear').click()`);
  await sleep(150);
  const cleared = await blueprint(ev);
  check('Clear empties the level but keeps its size', cleared.items.length === 2 && cleared.rows === made.rows && cleared.tiles.filter(Boolean).length === 32, `${cleared.items.length} items`);
  await ev(`document.querySelector('#edit-undo').click()`);
  await sleep(150);
  check('undo brings a cleared level back', (await blueprint(ev)).items.length === full);

  await pick(ev, 'budget', 'Keep going');
  await ev(`document.querySelector('#design-go').click()`);
  const offered = await until(() => ev(`document.querySelector('#design-use').disabled === false`), 40000, 100);
  check('Keep going offers the best so far', offered, await ev(`document.querySelector('#design-note').textContent`));
  await sleep(1500);
  const notes = await ev(`document.querySelector('#design-note').textContent`);
  await ev(`document.querySelector('#design-use').click()`);
  await sleep(200);
  check('Use best so far stops it and applies the level', await ev(`document.querySelector('#design-go').hidden === false && /Best of/.test(document.querySelector('#design-note').textContent)`), notes);

  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(500);
  const s = await state();
  check('the generated level plays', s.phase === 'play' && !s.dead, JSON.stringify({ phase: s.phase, y: s.y }));
  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(300);
}
