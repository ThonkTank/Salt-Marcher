import type { SessionRun } from './session-contracts';
/** Display the saved calculation, never silently recalculate from today's rules. */
export function renderSessionOrigin(root: HTMLElement, run: SessionRun) {
  const details = document.createElement('details');
  details.className = 'session-origin';
  const heading = document.createElement('summary');
  heading.textContent = 'Gespeicherte Berechnungsgrundlage';
  details.append(heading);
  const text = (value: string) => {
    const p = document.createElement('p');
    p.textContent = value;
    details.append(p);
  };
  text('Vorschau ' + run.id + ' · Seed ' + run.seed + ' · Planungsrevision ' + run.profileRevision);
  const origin = run.origin;
  if (!origin) {
    text(
      'Diese ältere oder einzeln neu erzeugte Vorschau besitzt keinen vollständigen gemeinsamen Herkunftsbeleg. Ihre gespeicherten Szenen bleiben verfügbar.',
    );
    root.append(details);
    return;
  }
  text(
    'Gleiche Vorgaben und unveränderte Quellen öffnen diese Vorschau erneut, einschließlich eigener Bearbeitungen. Für einen weiteren Entwurf einen neuen Seed wählen.',
  );
  text(
    'Zielverteilung ' +
      (run.targets?.version ?? 'ältere Zielverteilung') +
      ' · ' +
      (run.targets?.fraction ?? '?') +
      ' Abenteuertage · ' +
      run.budget +
      ' Ziel-XP.',
  );
  for (const [index, encounter] of origin.encounters.entries()) {
    const section = document.createElement('section'),
      title = document.createElement('h4');
    title.textContent = 'Szene ' + (index + 1);
    section.append(title);
    const facts = document.createElement('p');
    facts.textContent =
      'Seed ' +
      encounter.seed +
      ' · Regeln ' +
      encounter.preset.name +
      ' r' +
      encounter.preset.revision +
      ' · Regelhash ' +
      encounter.preset.hash +
      ' · Kataloghash ' +
      encounter.catalogHash;
    section.append(facts);
    const reward = origin.rewards[index],
      loot = document.createElement('p');
    loot.textContent = reward
      ? 'Ursprüngliche Belohnung: ' +
        reward.poolXp +
        ' XP · ' +
        (reward.items
          .map(
            (item) => item.quantity + ' × ' + item.name + ' (' + item.valueGold + ' Gold je Stück)',
          )
          .join(', ') || 'keine Gegenstände')
      : 'Ursprünglich keine eigene Belohnung.';
    section.append(loot);
    if (JSON.stringify(reward) !== JSON.stringify(run.proposals[index]?.reward ?? null)) {
      const changed = document.createElement('p');
      changed.textContent = 'Die aktuelle Belohnung wurde seit dieser Berechnung bearbeitet.';
      section.append(changed);
    }
    details.append(section);
  }
  if (origin.itemCatalog)
    text(
      'Magiebeutekatalog bei Erstellung: ' +
        origin.itemCatalog.length +
        ' eigene Definitionen mit festgehaltenen Revisionen.',
    );
  text(
    'Gebundene Weltquellen: ' +
      origin.locations.length +
      ' Orte, ' +
      origin.notes.length +
      ' Welttexte. Die bei Erstellung gültigen Revisionen bleiben gespeichert.',
  );
  root.append(details);
}
