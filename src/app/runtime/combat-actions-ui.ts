import type { Creature, CreatureAction } from '../../features/catalog/creature-catalog';
import {
  creatureActionForRolls,
  creatureActionRolls,
  creatureAverageDamage,
  type CreatureRollPreset,
} from '../shared/dice-formula';
/** Compact action selector; the complete statblock remains a separate reference. */
export function renderCombatActions(
  root: HTMLElement,
  creature: Creature,
  onRoll: (action: CreatureAction, preset: CreatureRollPreset) => void,
  onDamage: (action: CreatureAction) => void,
  control: (action: CreatureAction) => { disabled: boolean; note: string } | null,
  onUse: (action: CreatureAction) => void,
) {
  const previous =
    root.dataset.creatureId === creature.id ? root.querySelector('select')?.value : null;
  root.replaceChildren();
  root.dataset.creatureId = creature.id;
  const label = document.createElement('label'),
    select = document.createElement('select'),
    tools = document.createElement('div'),
    description = document.createElement('details'),
    summary = document.createElement('summary'),
    text = document.createElement('p');
  select.id = 'fighter-action-select';
  select.setAttribute('aria-label', 'Monsteraktion');
  label.htmlFor = select.id;
  label.textContent = 'Aktion wählen';
  tools.className = 'toolbar';
  summary.textContent = 'Aktionsbeschreibung';
  description.append(summary, text);
  root.append(label, select, tools, description);
  for (const [title, actions] of [
    ['Aktionen', creature.actions],
    ['Legendäre Aktionen', creature.legendaryActions],
  ] as const) {
    const group = document.createElement('optgroup');
    group.label = title;
    for (const a of actions) {
      const option = document.createElement('option');
      option.value = a.id;
      option.textContent = a.name;
      group.append(option);
    }
    if (actions.length) select.append(group);
  }
  const all = [...creature.actions, ...creature.legendaryActions];
  const chosen = all.some((a) => a.id === previous) ? previous! : (all[0]?.id ?? '');
  const chosenOption = [...select.querySelectorAll('option')].find(
    (option) => option.value === chosen,
  );
  if (chosenOption) chosenOption.selected = true;
  const draw = () => {
    tools.replaceChildren();
    const original = all.find((a) => a.id === select.value);
    if (!original) return;
    const action = creatureActionForRolls(creature, original),
      presets = creatureActionRolls(action),
      state = control(action);
    text.textContent =
      original.description +
      (action.description !== original.description ? '\n' + action.description : '');
    const add = (label: string, fn: () => void) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = state?.disabled ?? false;
      button.dataset.statblockDisabled = String(state?.disabled ?? false);
      button.onclick = fn;
      tools.append(button);
    };
    const attack = presets.some((p) => p.kind === 'attack');
    if (
      (attack && presets.some((p) => p.kind === 'damage')) ||
      creatureAverageDamage(action) !== null
    )
      add(presets.some((p) => p.kind === 'save') ? 'Ziele & Schaden…' : 'Treffer eintragen…', () =>
        onDamage(action),
      );
    for (const p of presets.filter((p) => !attack || p.kind !== 'damage'))
      add(
        p.kind === 'attack'
          ? 'Angriff ' + p.formula
          : p.kind === 'damage'
            ? 'Schaden ' + p.formula
            : (p.kind === 'save' ? 'Rettungswurf' : 'Probe') + ' SG ' + p.dc,
        () => onRoll(action, p),
      );
    if (state) {
      const note = document.createElement('small');
      note.textContent = state.note;
      tools.append(note);
      if (!presets.length) add('Einsetzen', () => onUse(action));
    }
  };
  select.onchange = draw;
  draw();
}
