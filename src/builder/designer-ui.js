import { DEFAULT_DESIGN, MONSTER_KINDS, BUILDER_ONLY_KINDS } from '../generation/design.js';
import { BUILDER_STYLES } from '../generation/focus.js';
import { IDEAS } from '../generation/ideas.js';

const DIFFICULTIES = ['Gentle', 'Easy', 'Steady', 'Tricky', 'Hard', 'Harsh', 'Brutal', 'Merciless'];
const PURSUIT = 'flood';
const BUDGET_MS = { fast: 5000, good: 20000, best: 60000, endless: Infinity };
const REPEATABLE_TRIES = 6;
const FAILED = "Couldn't build that one. Try another seed or easier settings.";
const WORDS = ['moss', 'ember', 'gale', 'quartz', 'lumen', 'tide', 'thorn', 'comet', 'dusk', 'fable'];
const CHOICES = {
  stretches: [[1, 'Short'], [2, 'Medium'], [4, 'Long'], [8, 'Huge'], [12, 'Epic']],
  monsters: [['none', 'None'], ['some', 'Some'], ['swarm', 'Swarm']],
  hazards: [['none', 'None'], ['some', 'Some'], ['lots', 'Lots']],
  budget: [['fast', 'Fast'], ['good', 'Good'], ['best', 'Best'], ['endless', 'Keep going']],
  fun: [['balanced', 'Balanced'], ['flowing', 'Flowing'], ['acrobatic', 'Acrobatic'], ['dangerous', 'Dangerous']],
  repeatable: [[false, 'Off'], [true, 'On']],
  coins: [['none', 'None'], ['normal', 'Some'], ['lots', 'Lots']],
  flooded: [['never', 'Never'], ['auto', 'Maybe'], ['always', 'Always']],
  idea: [['never', 'None'], ['auto', 'Surprise me'], ...IDEAS.map(idea => [idea.id, idea.title])],
  timing: [['forgiving', 'Forgiving'], ['normal', 'Normal'], ['tight', 'Tight']],
  devices: [['random', 'Random'], ['synced', 'In sync']],
};

const $ = selector => document.querySelector(selector);
const randomSeed = () => `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 1000)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function describe(summary, score, tried) {
  const parts = [`${summary.title}: about ${summary.seconds} s to climb`, plural(summary.monsters, 'monster'), plural(summary.hazards, 'hazard'), plural(summary.coins, 'coin')].join(', ');
  const notes = [
    summary.droppedRules.length && `Couldn't fit: ${summary.droppedRules.join(', ')}.`,
    !summary.styleKept && "That style didn't fit, so it picked another.",
    summary.wantedFlood && !summary.flooded && 'Too short to flood; try Long or taller.',
    summary.wantedIdea && !summary.ideaKept && 'Couldn\'t fit that idea; try Long or taller.',
    summary.simplified && 'Some stretches came out plainer than you asked.',
  ].filter(Boolean);
  const dropped = notes.length ? ` ${notes.join(' ')}` : '';
  return `Best of ${plural(tried, 'try').replace('trys', 'tries')}, score ${score}. ${parts}.${dropped} ${summary.proven ? 'Proven climbable.' : 'Not proven climbable, so try it first.'}`;
}

export function bindDesigner(editor, { game, refocus }) {
  const design = { ...DEFAULT_DESIGN };
  let worker = null, found = null, tried = 0, deadline = 0, ticker = 0;

  function showChoices() {
    for (const [field, options] of Object.entries(CHOICES)) {
      const host = $(`#design-${field}`);
      if (host.tagName === 'SELECT') {
        if (!host.options.length) {
          host.replaceChildren(...options.map(([, text], i) => new Option(text, i)));
          host.onchange = () => { design[field] = options[+host.value][0]; };
        }
        host.value = options.findIndex(([value]) => value === design[field]);
        continue;
      }
      host.replaceChildren(...options.map(([value, text]) => {
        const button = Object.assign(document.createElement('button'), { textContent: text, onclick: () => { design[field] = value; showChoices(); } });
        button.classList.toggle('on', design[field] === value);
        return button;
      }));
    }
    $('#design-kinds').replaceChildren(...MONSTER_KINDS.filter(kind => !BUILDER_ONLY_KINDS.includes(kind)).map(kind => {
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
    $('#design-use').hidden = !busy;
    $('#design-use').disabled = true;
  }

  function finish(note) {
    worker?.terminate();
    worker = null;
    clearTimeout(deadline);
    clearInterval(ticker);
    setBusy(false);
    $('#design-note').textContent = note;
  }

  function adopt() {
    const session = game();
    if (!session) { finish(''); return; }
    const { blueprint, summary, score, tried, pursued } = found;
    const proven = summary.proven && !pursued;
    editor.adopt(pursued ? { ...blueprint, rules: [...blueprint.rules, PURSUIT] } : blueprint, proven);
    session.designed();
    finish(describe({ ...summary, proven }, score, tried));
    refocus();
  }

  function generate() {
    const { rules, title, theme } = editor.blueprint, pursued = rules.includes(PURSUIT), began = performance.now();
    const budget = design.repeatable ? Infinity : BUDGET_MS[design.budget];
    let due = false;
    found = null;
    worker?.terminate();
    worker = new Worker(new URL('../generation/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress' && !found) $('#design-note').textContent = data.stage;
      if (data.type === 'tried') {
        tried = data.tried;
        if (data.blueprint) found = { blueprint: data.blueprint, summary: data.summary, score: data.best, pursued };
        if (found) {
          found.tried = tried;
          $('#design-use').disabled = false;
          $('#design-note').textContent = `Tried ${tried}, best score ${found.score}`;
          if (due) adopt();
        }
      }
      if (data.type === 'finished') { if (found) adopt(); else finish(FAILED); }
    };
    worker.onerror = () => { if (found) adopt(); else finish(FAILED); };
    setBusy(true);
    $('#design-progress').removeAttribute('value');
    tried = 0;
    if (Number.isFinite(budget)) {
      $('#design-progress').value = 0;
      ticker = setInterval(() => { $('#design-progress').value = Math.min(1, (performance.now() - began) / budget); }, 200);
      deadline = setTimeout(() => { if (found) adopt(); else due = true; }, budget);
    }
    worker.postMessage({ type: 'design', seed: $('#design-seed').value, design, rules: rules.filter(id => id !== PURSUIT), keep: { title, theme }, ...(design.repeatable ? { tries: REPEATABLE_TRIES } : {}) });
  }

  $('#design-seed').value = randomSeed();
  $('#design-dice').onclick = () => { $('#design-seed').value = randomSeed(); };
  $('#design-difficulty').value = design.difficulty;
  $('#design-difficulty').oninput = event => { design.difficulty = +event.target.value; showChoices(); };
  $('#design-style').replaceChildren(new Option('Surprise me', ''), ...BUILDER_STYLES.map(({ id, title }) => new Option(title, id)));
  $('#design-style').onchange = event => { design.style = event.target.value || null; };
  $('#design-go').onclick = generate;
  $('#design-cancel').onclick = () => finish('Cancelled.');
  $('#design-use').onclick = () => { if (found) adopt(); };
  setBusy(false);
  showChoices();
  return { stop: () => finish('') };
}
