import { BLOCKS, BLOCK_GROUPS, TOWER_HEIGHTS, blankBlueprint } from './blueprint.js';
import { THEMES } from './themes.js';
import { MUTATORS, buildRules } from './rules.js';
import { createLevel } from './level.js';
import { drawBlockIcon } from './render.js';

const ICON_SIZE = 80;
const ICON_ROWS = 20;
const $ = selector => document.querySelector(selector);

export function bindEditorUI(editor, { game, canvas, share, leave }) {
  let group = BLOCK_GROUPS[0];
  const refocus = () => canvas.focus();
  const iconLevel = createLevel(buildRules([]), [], ICON_ROWS);
  const iconTheme = THEMES.find(theme => theme.id === 'neon'), iconPalette = iconTheme.palette(200);

  function showTools() {
    $('#edit-erase').classList.toggle('on', editor.tool === 'erase');
    $('#edit-wire').classList.toggle('on', editor.tool === 'wire');
    for (const button of document.querySelectorAll('#edit-blocks button')) button.classList.toggle('on', button.dataset.block === editor.tool);
  }

  function choose(tool) {
    editor.tool = tool;
    showTools();
    refocus();
  }

  function blockButton(block) {
    const button = document.createElement('button');
    button.dataset.block = block.id;
    const icon = document.createElement('canvas');
    icon.width = icon.height = ICON_SIZE;
    drawBlockIcon(icon, block, iconLevel, iconTheme, iconPalette);
    const label = document.createElement('span');
    label.textContent = block.label;
    button.append(icon, label);
    button.onclick = () => choose(block.id);
    return button;
  }

  function showBlocks() {
    $('#edit-blocks').replaceChildren(...BLOCKS.filter(block => block.group === group).map(blockButton));
    for (const tab of $('#edit-tabs').children) tab.classList.toggle('on', tab.textContent === group);
    showTools();
  }

  $('#edit-tabs').replaceChildren(...BLOCK_GROUPS.map(name => {
    const tab = document.createElement('button');
    tab.textContent = name;
    tab.onclick = () => { group = name; showBlocks(); refocus(); };
    return tab;
  }));

  function showSettings() {
    const bp = editor.blueprint;
    $('#edit-title').value = bp.title;
    $('#edit-theme').value = bp.theme;
    $('#edit-height').value = bp.rows;
    for (const box of document.querySelectorAll('#edit-rules input')) box.checked = bp.rules.includes(box.value);
  }

  const applied = () => { game().settingsChanged(); };
  $('#edit-theme').replaceChildren(...THEMES.map((theme, i) => Object.assign(document.createElement('option'), { value: i, textContent: `${theme.emoji} ${theme.id}` })));
  $('#edit-height').replaceChildren(...TOWER_HEIGHTS.map(rows => Object.assign(document.createElement('option'), { value: rows, textContent: `${rows / 18} ${rows === 18 ? 'screen' : 'screens'}` })));
  $('#edit-rules').replaceChildren(...MUTATORS.filter(m => !m.perk).map(m => {
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: m.id });
    box.onchange = () => {
      const rules = box.checked ? [...editor.blueprint.rules, m.id] : editor.blueprint.rules.filter(id => id !== m.id);
      editor.set('rules', rules);
      applied();
    };
    const label = document.createElement('label');
    label.append(box, m.title);
    return label;
  }));
  $('#edit-title').oninput = event => { editor.set('title', event.target.value); };
  $('#edit-theme').onchange = event => { editor.set('theme', +event.target.value); applied(); refocus(); };
  $('#edit-height').onchange = event => { editor.set('rows', +event.target.value); applied(); refocus(); };
  $('#edit-new').onclick = () => {
    editor.remember();
    editor.blueprint = blankBlueprint(editor.blueprint.rows);
    editor.changed();
    showSettings();
    applied();
  };
  $('#edit-level').onclick = () => { showSettings(); $('#edit-settings').hidden = !$('#edit-settings').hidden; };

  const labelTest = mode => { $('#edit-test').textContent = mode === 'test' ? '■ Back to building' : '▶ Play'; };
  labelTest('build');
  $('#edit-test').onclick = () => { game().toggleTest(); $('#edit-settings').hidden = true; refocus(); };
  $('#edit-undo').onclick = () => { editor.undo(); game().rebuilt(); refocus(); };
  $('#edit-redo').onclick = () => { editor.redo(); game().rebuilt(); refocus(); };
  $('#edit-erase').onclick = () => choose('erase');
  $('#edit-wire').onclick = () => choose('wire');
  $('#edit-share').onclick = () => { share($('#edit-note')); refocus(); };
  $('#edit-exit').onclick = () => leave();
  $('#edit-note').textContent = '';
  showBlocks();
  refocus();
  return { showMode: labelTest };
}
