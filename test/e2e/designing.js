import { sleep } from './browser.js';

const pick = (ev, group, text) => ev(`[...document.querySelectorAll('#design-${group} button')].find(b => b.textContent === ${JSON.stringify(text)}).click()`);
const blueprint = ev => ev('shiftform.editor().blueprint');

export async function designing({ ev, until, open, check, state }) {
  await open('#');
  await ev(`document.querySelector('#build-level').click()`);
  await until(() => ev(`document.body.classList.contains('editing')`), 6000);
  await sleep(500);
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

  await pick(ev, 'stretches', 'Short');
  await pick(ev, 'monsters', 'None');
  await pick(ev, 'hazards', 'None');
  await ev(`document.querySelector('#design-go').click()`);
  const built = await until(() => ev(`document.querySelector('#design-go').hidden === false && /to climb/.test(document.querySelector('#design-note').textContent)`), 60000, 200);
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

  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(500);
  const s = await state();
  check('the generated level plays', s.phase === 'play' && !s.dead, JSON.stringify({ phase: s.phase, y: s.y }));
  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(300);
}
