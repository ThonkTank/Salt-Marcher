import type { Creature, CreatureAction } from '../../features/catalog/creature-catalog';
import { creatureActionRolls, type CreatureRollPreset } from '../shared/dice-formula';

/** Shared statblock rendering. Optional combat controls act on the encounter, never catalog truth. */
export function renderCreatureDetail(
  root: HTMLElement,
  c: Creature,
  onRoll?: (action: CreatureAction, preset: CreatureRollPreset) => void,
  actionControl?: (action: CreatureAction) => { disabled: boolean; note: string } | null,
  onUse?: (action: CreatureAction) => void,
) {
  root.replaceChildren();
  root.classList.add('creature-statblock');
  const heading = document.createElement('h3');
  heading.textContent = c.name;
  root.append(heading);
  const line = (name: string, text: string) => {
    if (!text) return null;
    const p = document.createElement('p'),
      strong = document.createElement('strong');
    strong.textContent = name + ': ';
    p.append(strong, document.createTextNode(text));
    root.append(p);
    return p;
  };
  line(
    'Art',
    c.size + ' ' + c.type + (c.subtype ? ' (' + c.subtype + ')' : '') + ' · ' + c.alignment,
  );
  line('HG / XP', c.challengeRating + ' / ' + c.xp);
  line('Rüstungsklasse / HP', c.ac + ' / ' + c.hp + ' (' + c.hitDice + ')');
  line('Bewegung', c.speed);
  const abilities = document.createElement('dl');
  abilities.className = 'creature-abilities';
  abilities.setAttribute('aria-label', 'Attribute und Modifikatoren');
  for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
    const score = c.abilities[key];
    if (!Number.isFinite(score)) continue;
    const cell = document.createElement('div'),
      label = document.createElement('dt'),
      value = document.createElement('dd'),
      modifier = document.createElement('span');
    label.textContent = key.toUpperCase();
    const mod = Math.floor((score - 10) / 2);
    modifier.textContent = '(' + (mod >= 0 ? '+' : '') + mod + ')';
    modifier.title = 'Attributsmodifikator';
    value.append(String(score) + ' ', modifier);
    cell.append(label, value);
    abilities.append(cell);
  }
  if (abilities.children.length) root.append(abilities);
  line('Rettungswürfe', c.savingThrows);
  line('Fertigkeiten', c.skills);
  line('Sinne', c.senses);
  line('Sprachen', c.languages);
  line('Verwundbar', c.damageVulnerabilities);
  line('Resistenzen', c.damageResistances);
  line('Immunitäten', c.damageImmunities);
  line('Zustandsimmunitäten', c.conditionImmunities);
  for (const [title, actions] of [
    ['Eigenschaften', c.traits],
    ['Aktionen', c.actions],
    ['Legendäre Aktionen', c.legendaryActions],
  ] as const) {
    if (!actions.length) continue;
    const h = document.createElement('h4');
    h.textContent = title;
    root.append(h);
    for (const a of actions) {
      const p = line(a.name, a.description),
        presets = onRoll ? creatureActionRolls(a) : [],
        control = actionControl?.(a) ?? null;
      if (p && (presets.length || control)) {
        const tools = document.createElement('span');
        tools.className = 'toolbar statblock-rolls';
        for (const preset of presets) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent =
            preset.kind === 'attack'
              ? 'Angriff ' + preset.formula
              : preset.kind === 'damage'
                ? 'Schaden ' + preset.formula
                : (preset.kind === 'save' ? 'Rettungswurf' : 'Probe') + ' SG ' + preset.dc;
          button.disabled = control?.disabled ?? false;
          if (control) button.dataset.statblockDisabled = String(control.disabled);
          button.onclick = () => onRoll!(a, preset);
          tools.append(button);
        }
        if (control && !presets.length && onUse) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Einsetzen';
          button.disabled = control.disabled;
          button.dataset.statblockDisabled = String(control.disabled);
          button.onclick = () => onUse(a);
          tools.append(button);
        }
        if (control) {
          const status = document.createElement('small');
          status.textContent = control.note;
          tools.append(status);
        }
        p.append(tools);
      }
    }
  }
  const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
  if (
    c.details &&
    ![...c.traits, ...c.actions, ...c.legendaryActions].some(
      (action) => normalized(action.description) === normalized(c.details),
    )
  )
    line('Weitere Angaben', c.details);
  line('Quelle', c.sourceLabel + ' · ' + c.sourceVersion + ' · CC BY 4.0');
}

const detailRequests = new WeakMap<HTMLElement, number>();
/** Read one catalog statblock into its owning pane, with an explicit local retry. */
export async function loadCreatureDetail(
  root: HTMLElement,
  id: string,
  current: () => boolean = () => true,
): Promise<void> {
  const request = (detailRequests.get(root) ?? 0) + 1;
  detailRequests.set(root, request);
  const owns = () => root.isConnected && current() && detailRequests.get(root) === request;
  if (!owns()) return;
  root.replaceChildren();
  root.setAttribute('aria-busy', 'true');
  root.setAttribute('role', 'status');
  root.textContent = 'Statblock wird geladen …';
  try {
    const response = await window.campaign.creature(id);
    if (!owns()) return;
    if (!response.ok) throw new Error(response.error);
    if (response.value.id !== id) throw new Error('Statblock gehört zu einer anderen Kreatur.');
    root.removeAttribute('role');
    renderCreatureDetail(root, response.value);
  } catch (error) {
    if (!owns()) return;
    root.replaceChildren();
    root.setAttribute('role', 'alert');
    const message = document.createElement('p');
    message.textContent = 'Statblock nicht verfügbar: ' + (error as Error).message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Statblock erneut laden';
    retry.onclick = () => {
      if (retry.isConnected && owns()) void loadCreatureDetail(root, id, current);
    };
    root.append(message, retry);
  } finally {
    if (owns()) root.setAttribute('aria-busy', 'false');
  }
}
