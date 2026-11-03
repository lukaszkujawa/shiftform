import { BLOCKS, BLOCK_GROUPS, TOWER_HEIGHTS, blankBlueprint } from './blueprint.js';
import { THEMES } from '../art/themes.js';
import { MUTATORS, buildRules } from '../world/rules.js';
import { createLevel } from '../world/level.js';
import { drawBlockIcon } from './editor-art.js';

const ICON_SIZE = 80;
const ICON_ROWS = 20;
const SCREEN_ROWS = 18;
const $ = selector => document.querySelector(selector);

export function bindEditorUI(editor, { game, canvas, linkOf, leave }) {
  let group = BLOCK_GROUPS[0];
  const refocus = () => canvas.focus();
  const iconLevel = createLevel(buildRules([]), [], ICON_ROWS);
  const iconTheme = THEMES.find(theme => theme.id === 'country'), iconPalette = iconTheme.palette(200);

  function showTools() {
    $('#edit-erase').classList.toggle('on', editor.tool === 'erase');
    $('#edit-wire').classList.toggle('on', editor.tool === 'wire');
    $('#edit-timing').classList.toggle('on', editor.tool === 'timing');
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
    for (const name of document.querySelectorAll('.edit-name')) if (name.value !== bp.title) name.value = bp.title;
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
  for (const name of document.querySelectorAll('.edit-name')) name.oninput = () => { editor.set('title', name.value); showSettings(); refreshLink(); };
  $('#edit-new').onclick = () => {
    editor.remember();
    editor.blueprint = blankBlueprint(editor.blueprint.rows);
    editor.changed();
    applied();
  };
  function showPanel(panel) {
    for (const [id, button] of [['#edit-settings', '#edit-level'], ['#edit-sharing', '#edit-share']]) {
      $(id).hidden = id !== panel;
      $(button).classList.toggle('on', id === panel);
    }
  }
  $('#edit-level').onclick = () => { showSettings(); showPanel($('#edit-settings').hidden ? '#edit-settings' : null); };

  let latestLink = 0;
  async function refreshLink() {
    if ($('#edit-sharing').hidden) return;
    const asked = ++latestLink, link = await linkOf(editor.blueprint);
    if (asked !== latestLink) return;
    $('#edit-link').value = link;
    $('#edit-try').href = link;
    $('#edit-copy').textContent = 'Copy link';
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText($('#edit-link').value);
      $('#edit-copy').textContent = 'Copied ✓';
    } catch {
      $('#edit-copy').textContent = 'Copy link';
      $('#edit-link').select();
    }
  }

  $('#edit-copy').onclick = copyLink;
  $('#edit-send').hidden = !(navigator.share && matchMedia('(pointer: coarse)').matches);
  $('#edit-send').onclick = () => navigator.share({ title: editor.blueprint.title || 'Shiftform', url: $('#edit-link').value }).catch(() => {});
  $('#edit-link').onfocus = event => event.target.select();
  $('#edit-share').onclick = async () => {
    showSettings();
    showPanel($('#edit-sharing').hidden ? '#edit-sharing' : null);
    await refreshLink();
    if (!$('#edit-sharing').hidden) await copyLink();
  };

  const labelTest = mode => { $('#edit-test').textContent = mode === 'test' ? '■ Back to building' : '▶ Play'; };
  labelTest('build');
  $('#edit-test').onclick = () => { game().toggleTest(); showPanel(null); refocus(); };
  $('#edit-undo').onclick = () => { editor.undo(); game().rebuilt(); refocus(); };
  $('#edit-redo').onclick = () => { editor.redo(); game().rebuilt(); refocus(); };
  $('#edit-erase').onclick = () => choose('erase');
  $('#edit-wire').onclick = () => choose('wire');
  $('#edit-timing').onclick = () => choose('timing');
  $('#edit-exit').onclick = () => leave();
  showPanel(null);
  showBlocks();
  refocus();
  return { showMode: labelTest, sync: () => { showSettings(); refreshLink(); } };
}
