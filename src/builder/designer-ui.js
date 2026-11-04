import { DEFAULT_DESIGN, MONSTER_KINDS } from '../generation/design.js';
import { BUILDER_STYLES } from '../generation/focus.js';

const DIFFICULTIES = ['Gentle', 'Easy', 'Steady', 'Tricky', 'Hard', 'Harsh', 'Brutal', 'Merciless'];
const PURSUIT = 'flood';
const WORDS = ['moss', 'ember', 'gale', 'quartz', 'lumen', 'tide', 'thorn', 'comet', 'dusk', 'fable'];
const CHOICES = {
  stretches: [[1, 'Short'], [2, 'Medium'], [3, 'Tall'], [4, 'Huge']],
  monsters: [['none', 'None'], ['some', 'Some'], ['swarm', 'Swarm']],
  hazards: [['none', 'None'], ['some', 'Some'], ['lots', 'Lots']],
  effort: [['quick', 'Quick'], ['normal', 'Normal'], ['thorough', 'Thorough']],
  coins: [['none', 'None'], ['normal', 'Some'], ['lots', 'Lots']],
  flooded: [['never', 'Never'], ['auto', 'Maybe'], ['always', 'Always']],
  timing: [['forgiving', 'Forgiving'], ['normal', 'Normal'], ['tight', 'Tight']],
  devices: [['random', 'Random'], ['synced', 'In sync']],
};

const $ = selector => document.querySelector(selector);
const randomSeed = () => `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 1000)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function describe(summary) {
  const parts = [`${summary.title}: about ${summary.seconds} s to climb`, plural(summary.monsters, 'monster'), plural(summary.hazards, 'hazard'), plural(summary.coins, 'coin')].join(', ');
  const dropped = summary.droppedRules.length ? ` Couldn't fit: ${summary.droppedRules.join(', ')}.` : '';
  return `${parts}.${dropped} ${summary.proven ? 'Proven climbable.' : 'Not proven climbable, so try it first.'}`;
}

export function bindDesigner(editor, { game, refocus }) {
  const design = { ...DEFAULT_DESIGN };
  let worker = null;

  function showChoices() {
    for (const [field, options] of Object.entries(CHOICES)) {
      $(`#design-${field}`).replaceChildren(...options.map(([value, text]) => {
        const button = Object.assign(document.createElement('button'), { textContent: text, onclick: () => { design[field] = value; showChoices(); } });
        button.classList.toggle('on', design[field] === value);
        return button;
      }));
    }
    $('#design-kinds').replaceChildren(...MONSTER_KINDS.map(kind => {
      const on = design.kinds.includes(kind);
      const chip = Object.assign(document.createElement('button'), { textContent: kind, onclick: () => { design.kinds = on ? design.kinds.filter(k => k !== kind) : [...design.kinds, kind]; showChoices(); } });
      chip.classList.toggle('on', on);
      return chip;
    }));
    $('#design-difficulty-name').textContent = DIFFICULTIES[design.difficulty - 1];
  }

  function setBusy(busy) {
    $('#design-go').hidden = busy;
    $('#design-cancel').hidden = !busy;
    $('#design-progress').hidden = !busy;
  }

  function finish(note) {
    worker?.terminate();
    worker = null;
    setBusy(false);
    $('#design-note').textContent = note;
  }

  function adopt(blueprint, summary, pursued) {
    const session = game();
    if (!session) return;
    const proven = summary.proven && !pursued;
    editor.adopt(pursued ? { ...blueprint, rules: [...blueprint.rules, PURSUIT] } : blueprint, proven);
    session.designed();
    finish(describe({ ...summary, proven }));
    refocus();
  }

  function generate() {
    const { rules, title, theme } = editor.blueprint, pursued = rules.includes(PURSUIT);
    worker?.terminate();
    worker = new Worker(new URL('../generation/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { $('#design-progress').value = data.fraction; $('#design-note').textContent = data.stage; }
      else if (data.type === 'designed') adopt(data.blueprint, data.summary, pursued);
      else if (data.type === 'failed') finish("Couldn't build that one. Try another seed or easier settings.");
    };
    worker.onerror = () => finish("Couldn't build that one. Try another seed or easier settings.");
    setBusy(true);
    $('#design-progress').value = 0;
    worker.postMessage({ type: 'design', seed: $('#design-seed').value, design, rules: rules.filter(id => id !== PURSUIT), keep: { title, theme } });
  }

  $('#design-seed').value = randomSeed();
  $('#design-dice').onclick = () => { $('#design-seed').value = randomSeed(); };
  $('#design-difficulty').value = design.difficulty;
  $('#design-difficulty').oninput = event => { design.difficulty = +event.target.value; showChoices(); };
  $('#design-style').replaceChildren(new Option('Surprise me', ''), ...BUILDER_STYLES.map(({ id, title }) => new Option(title, id)));
  $('#design-style').onchange = event => { design.style = event.target.value || null; };
  $('#design-go').onclick = generate;
  $('#design-cancel').onclick = () => finish('Cancelled.');
  setBusy(false);
  showChoices();
  return { stop: () => { worker?.terminate(); worker = null; } };
}
