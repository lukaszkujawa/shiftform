import { BLOCKS, BLOCK_GROUPS, TOWER_HEIGHTS, blankBlueprint } from './blueprint.js';
import { THEMES } from './themes.js';
import { MUTATORS, buildRules } from './rules.js';
import { createLevel } from './level.js';
import { drawBlockIcon } from './render.js';

const ICON_SIZE = 80;
const ICON_ROWS = 20;
const SCREEN_ROWS = 18;
const NOTE_MS = 2500;
const $ = selector => document.querySelector(selector);

export function bindEditorUI(editor, { game, canvas, share, leave }) {
  let group = BLOCK_GROUPS[0];
  const refocus = () => canvas.focus();
  const iconLevel = createLevel(buildRules([]), [], ICON_ROWS);
  const iconTheme = THEMES.find(theme => theme.id === 'country'), iconPalette = iconTheme.palette(200);

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
    icon.style.background = iconPalette.bgTop;
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
    for (const tile of $('#edit-theme').children) tile.classList.toggle('on', +tile.dataset.theme === bp.theme);
    for (const choice of $('#edit-height').children) choice.classList.toggle('on', +choice.dataset.rows === bp.rows);
    for (const chip of $('#edit-rules').children) chip.classList.toggle('on', bp.rules.includes(chip.dataset.rule));
  }

  const applied = () => { game().settingsChanged(); };

  function choice(text, onPick, dataset) {
    const button = Object.assign(document.createElement('button'), { textContent: text, onclick: onPick });
    Object.assign(button.dataset, dataset);
    return button;
  }

  $('#edit-theme').replaceChildren(...THEMES.map((theme, i) => {
    const tile = choice(theme.id, () => { editor.set('theme', i); applied(); }, { theme: i });
    const { bgTop, bgBottom } = theme.palette(200);
    tile.style.background = `linear-gradient(${bgTop}, ${bgBottom})`;
    tile.prepend(Object.assign(document.createElement('b'), { textContent: theme.emoji }));
    return tile;
  }));
  $('#edit-height').replaceChildren(...TOWER_HEIGHTS.map(rows => choice(rows / SCREEN_ROWS, () => { editor.set('rows', rows); applied(); }, { rows })));
  $('#edit-rules').replaceChildren(...MUTATORS.filter(m => !m.perk).map(m => {
    const chip = choice(m.title, () => {
      const { rules } = editor.blueprint;
      editor.set('rules', rules.includes(m.id) ? rules.filter(id => id !== m.id) : [...rules, m.id]);
      applied();
    }, { rule: m.id });
    chip.title = m.about;
    return chip;
  }));
  $('#edit-title').oninput = event => { editor.set('title', event.target.value); };
  $('#edit-new').onclick = () => {
    editor.remember();
    editor.blueprint = blankBlueprint(editor.blueprint.rows);
    editor.changed();
    applied();
  };
  const showPanel = open => { $('#edit-settings').hidden = !open; $('#edit-level').classList.toggle('on', open); };
  $('#edit-level').onclick = () => { showSettings(); showPanel($('#edit-settings').hidden); };

  const labelTest = mode => { $('#edit-test').textContent = mode === 'test' ? '■ Back to building' : '▶ Play'; };
  labelTest('build');
  $('#edit-test').onclick = () => { game().toggleTest(); showPanel(false); refocus(); };
  $('#edit-undo').onclick = () => { editor.undo(); game().rebuilt(); refocus(); };
  $('#edit-redo').onclick = () => { editor.redo(); game().rebuilt(); refocus(); };
  $('#edit-erase').onclick = () => choose('erase');
  $('#edit-wire').onclick = () => choose('wire');
  $('#edit-share').onclick = async () => {
    await share($('#edit-note'));
    refocus();
    setTimeout(() => { $('#edit-note').textContent = ''; }, NOTE_MS);
  };
  $('#edit-exit').onclick = () => leave();
  $('#edit-note').textContent = '';
  showPanel(false);
  showBlocks();
  refocus();
  return { showMode: labelTest, sync: showSettings };
}
