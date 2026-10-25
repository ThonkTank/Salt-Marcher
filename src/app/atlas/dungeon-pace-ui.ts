import type { DungeonView } from './dungeon-contracts';
import type { DungeonPaceSettings } from '../runtime/dungeon-pace';
type Context = NonNullable<DungeonView['travelPace']>;
type Raw = {
  round: string;
  movement: string;
  group: string;
  members: { characterId: string; excluded: boolean; speed: string }[];
};
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let context: Context | null = null;
const fmt = (n: number | null) =>
  n === null ? 'offen' : n.toLocaleString('de-DE', { maximumFractionDigits: 3 }) + ' m/min';
function raw(): Raw | null {
  return context
    ? {
        round: el<HTMLInputElement>('dungeon-round-seconds').value,
        movement: el<HTMLSelectElement>('dungeon-movement').value,
        group: el<HTMLInputElement>('dungeon-group-speed').value,
        members: [
          ...el('dungeon-pace-members').querySelectorAll<HTMLElement>('[data-character-id]'),
        ].map((row) => ({
          characterId: row.dataset.characterId!,
          excluded: !row.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,
          speed: row.querySelector<HTMLInputElement>('input[type=number]')!.value,
        })),
      }
    : null;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function dungeonPaceDirty() {
  if (!context) return false;
  const settings = context.settings;
  const confirmed: Raw = {
    round: String(settings.explorationRoundSeconds ?? 600),
    movement: settings.movement,
    group: settings.groupMetersPerMinute === null ? '' : String(settings.groupMetersPerMinute),
    members: context.pace.members.map((member) => {
      const own = settings.members.find((m) => m.characterId === member.characterId);
      return {
        characterId: member.characterId,
        excluded: member.excluded,
        speed:
          own?.metersPerMinute === null || own?.metersPerMinute === undefined
            ? ''
            : String(own.metersPerMinute),
      };
    }),
  };
  return !equal(raw(), confirmed);
}
export function clearDungeonPace() {
  context = null;
  el('dungeon-pace-members').replaceChildren();
  el('dungeon-pace-controls').hidden = true;
}
export function dungeonPaceDraft() {
  const r = raw();
  if (!r || !context) throw new Error('Aktuelle Gruppe zuerst laden.');
  const rate = (s: string) => (s.trim() === '' ? null : Number(s));
  const settings: DungeonPaceSettings = {
    explorationRoundSeconds: Number(r.round),
    sceneId: context.settings.sceneId,
    revision: context.settings.revision,
    movement: r.movement as DungeonPaceSettings['movement'],
    groupMetersPerMinute: rate(r.group),
    members: r.members
      .filter((m) => m.excluded || m.speed.trim() !== '')
      .map((m) => ({
        characterId: m.characterId,
        excluded: m.excluded,
        metersPerMinute: rate(m.speed),
      })),
  };
  return { settings, expectedMembershipRevision: context.membershipRevision };
}
export function acceptDungeonPace(submitted: DungeonPaceSettings, next: Context) {
  if (!context) return;
  const now = dungeonPaceDraft().settings;
  if (equal(now, submitted)) {
    context = null;
  } else context = next; // Preserve edits made while this command was pending, using its acknowledged revision.
}
export function renderDungeonPace(next: Context | undefined, changed: () => void, reset = false) {
  if (!next) {
    clearDungeonPace();
    return;
  }
  const dirty = !reset && dungeonPaceDirty(),
    same = context?.settings.sceneId === next.settings.sceneId;
  el('dungeon-pace-controls').hidden = false;
  const summary = el('dungeon-pace-summary');
  summary.textContent =
    'Wirksam: ' +
    fmt(next.pace.metersPerMinute) +
    ' · ' +
    next.pace.reason +
    (dirty
      ? ' Offene Eingaben zuerst übernehmen oder verwerfen.'
      : ' Änderungen gelten für neue Vorschauen; bestätigte Routen behalten ihr Tempo.');
  const speed = el<HTMLInputElement>('dungeon-speed');
  speed.readOnly = true;
  speed.value = next.pace.metersPerMinute === null ? '' : String(next.pace.metersPerMinute);
  if (dirty && same) return;
  context = next;
  el<HTMLInputElement>('dungeon-round-seconds').value = String(
    next.settings.explorationRoundSeconds ?? 600,
  );
  const roundChoice = [60, 300, 600, 900, 1800].includes(
    next.settings.explorationRoundSeconds ?? 600,
  )
    ? String(next.settings.explorationRoundSeconds ?? 600)
    : 'custom';
  for (const option of el<HTMLSelectElement>('dungeon-round-preset').options)
    option.selected = option.value === roundChoice;
  el<HTMLSelectElement>('dungeon-movement').value = next.settings.movement;
  el<HTMLInputElement>('dungeon-group-speed').value =
    next.settings.groupMetersPerMinute === null ? '' : String(next.settings.groupMetersPerMinute);
  const root = el('dungeon-pace-members');
  root.replaceChildren();
  for (const member of next.pace.members) {
    const own = next.settings.members.find((m) => m.characterId === member.characterId),
      row = document.createElement('div'),
      include = document.createElement('input'),
      label = document.createElement('label'),
      override = document.createElement('label'),
      input = document.createElement('input'),
      facts = document.createElement('small');
    row.className = 'dungeon-pace-member';
    label.className = 'check-label';
    row.dataset.characterId = member.characterId;
    include.type = 'checkbox';
    include.checked = !member.excluded;
    include.setAttribute('aria-label', member.name + ' in Tempoberechnung');
    label.append(include, document.createTextNode(' ' + member.name + ' einbeziehen'));
    input.type = 'number';
    input.min = '0';
    input.max = '1000';
    input.step = 'any';
    input.placeholder = 'Profil';
    input.value =
      own?.metersPerMinute === null || own?.metersPerMinute === undefined
        ? ''
        : String(own.metersPerMinute);
    input.setAttribute('aria-label', 'Effektives Tempo ' + member.name);
    override.append(document.createTextNode('Vorgabe m/min'), input);
    facts.textContent =
      (member.feet === null ? 'Profil ohne Bewegung' : member.feet + ' ft im Charakterprofil') +
      ' · ' +
      fmt(member.metersPerMinute) +
      (member.excluded
        ? ' · ausgenommen'
        : next.pace.limitingIds.includes(member.characterId)
          ? ' · begrenzt die Gruppe'
          : '');
    const edit = () => {
      summary.textContent = 'Offene Tempovorgaben. Übernehmen, um neue Wege damit zu berechnen.';
      changed();
    };
    include.onchange = edit;
    input.oninput = edit;
    row.append(label, override, facts);
    root.append(row);
  }
}
