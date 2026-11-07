import type { EncounterComposition } from '../campaign/generation/selector';
import type { GenerationRequest } from '../campaign/generation-contracts';
export const compositionPreferences = {
  amount: {
    label: 'Kreaturenanzahl',
    choices: [
      ['neutral', 'Keine Vorliebe'],
      ['few', 'Wenige'],
      ['standard', 'Standard'],
      ['many', 'Viele'],
    ],
  },
  balance: {
    label: 'Stärkeverteilung',
    choices: [
      ['neutral', 'Keine Vorliebe'],
      ['even', 'Ähnlich stark'],
      ['varied', 'Gemischte Stärke'],
    ],
  },
  diversity: {
    label: 'Statblock-Vielfalt',
    choices: [
      ['neutral', 'Keine Vorliebe'],
      ['low', 'Wenige verschiedene'],
      ['high', 'Viele verschiedene'],
    ],
  },
} as const;
export type CompositionPreference = keyof typeof compositionPreferences;
export function preferenceSelect(key: CompositionPreference, id: string, withPreset = false) {
  const select = document.createElement('select');
  select.id = id;
  const choices: readonly (readonly [string, string])[] = withPreset
    ? [['preset', 'Vorgabe des wirksamen Presets'], ...compositionPreferences[key].choices]
    : compositionPreferences[key].choices;
  for (const [value, label] of choices) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  return select;
}
/** Read the saved selector result. Never infer blocks from a concrete roster. */
export function renderEncounterComposition(
  root: HTMLElement,
  composition: EncounterComposition | undefined,
  preferences?: Pick<GenerationRequest, 'amount' | 'balance' | 'diversity'>,
  fixed = false,
) {
  const details = document.createElement('details');
  details.className = 'encounter-composition';
  const summary = document.createElement('summary');
  summary.textContent = 'Komposition und Zielabweichungen';
  details.append(summary);
  const line = (text: string) => {
    const p = document.createElement('p');
    p.textContent = text;
    details.append(p);
  };
  if (!composition) {
    line(
      'Für diese ältere Vorschau sind keine strukturierten Kompositionsdaten gespeichert. Gegner und Quellen bleiben verfügbar.',
    );
    root.append(details);
    return;
  }
  const m = composition.metrics,
    target = m.adjustedXp - m.xpDelta;
  line(
    m.monsterCount +
      ' Kreaturen · ' +
      m.statblockCount +
      ' Statblocks · ' +
      m.initiativeSlots +
      ' Initiativeplätze.',
  );
  line(
    'XP-Multiplikator ×' +
      m.xpMultiplier.toLocaleString('de-DE') +
      ' für ' +
      m.monsterCount +
      ' Gegner.',
  );
  line(
    'XP-Ziel ' +
      target +
      ' · Ergebnis ' +
      m.adjustedXp +
      ' · Abweichung ' +
      (m.xpDelta >= 0 ? '+' : '') +
      m.xpDelta +
      ' XP' +
      (target > 0 ? ' (' + Math.round((m.xpDelta / target) * 100) + ' %)' : '') +
      '.',
  );
  line(
    composition.fitCandidateCount +
      ' von ' +
      composition.candidateCount +
      ' untersuchten Kompositionen liegen im ±5%-XP-Zielband.',
  );
  if (fixed)
    line(
      'Die CR-Blöcke beschreiben die Ergänzung. Die Kennzahlen berücksichtigen feste Gegner und Ergänzung gemeinsam.',
    );
  const table = document.createElement('table'),
    caption = document.createElement('caption');
  caption.textContent = fixed ? 'CR-Blöcke der Ergänzung' : 'CR-Blöcke';
  table.append(caption);
  const head = document.createElement('tr');
  for (const text of ['Rolle', 'HG', 'Kreaturen', 'Statblocks']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    head.append(th);
  }
  const thead = document.createElement('thead');
  thead.append(head);
  table.append(thead);
  const body = document.createElement('tbody');
  const roles = {
    minion: 'Handlanger',
    support: 'Unterstützer',
    standard: 'Standard',
    elite: 'Elite',
    boss: 'Boss',
  };
  for (const block of composition.blocks) {
    const row = document.createElement('tr');
    for (const text of [
      roles[block.role],
      block.challengeRating,
      block.quantity,
      block.statblockSlots,
    ]) {
      const td = document.createElement('td');
      td.textContent = String(text);
      row.append(td);
    }
    body.append(row);
  }
  table.append(body);
  details.append(table);
  if (!composition.blocks.length)
    line('Keine zusätzlichen CR-Blöcke: Die feste Basis reicht bereits aus.');
  if (composition.diagnostics.length) {
    const list = document.createElement('ul');
    list.className = 'composition-diagnostics';
    const names = {
      statblocks: 'Statblocks',
      monsters: 'Kreaturen',
      initiativeSlots: 'Initiativeplätze',
    };
    for (const d of composition.diagnostics) {
      const item = document.createElement('li');
      item.textContent =
        names[d.constraint] +
        ': ' +
        d.value +
        ' statt ' +
        d.minimum +
        '–' +
        d.maximum +
        ' · normierter Abstand ' +
        d.normalizedDistance.toFixed(3);
      list.append(item);
    }
    details.append(list);
    line('Diese Wunschbereiche sind weich. Quellen, Rollen und Bestände bleiben bindend.');
  } else line('Alle weichen Kompositionsbereiche sind erfüllt.');
  if (preferences)
    line(
      'Gespeicherte Vorlieben: ' +
        (Object.keys(compositionPreferences) as CompositionPreference[])
          .map(
            (key) =>
              compositionPreferences[key].label +
              ': ' +
              (compositionPreferences[key].choices.find(([id]) => id === preferences[key])?.[1] ??
                preferences[key]),
          )
          .join(' · '),
    );
  line(
    'Zuerst zählt das XP-Zielband, dann der Abstand zu Kompositionsbereichen, danach Anzahl, Balance und Vielfalt, dann der absolute XP-Abstand. Seed und stabile Reihenfolge lösen erst verbleibende Gleichstände.',
  );
  root.append(details);
}
