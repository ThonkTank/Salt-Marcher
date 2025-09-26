# UI terminology consistency

## Original Finding
> Namensgebung und Kommentare wechseln zwischen Englisch und Deutsch (z. B. englische Fehlermeldungen neben deutschsprachigen Notices), was Konsistenz und Lesbarkeit beeinträchtigt.
>
> **Empfohlene Maßnahme:** UI-Texte und Kommentare sollten konsequent in einer Sprache gehalten werden, um Mischformen wie in `MapManager` und `LibraryView` zu vermeiden.

Quelle: [`architecture-critique.md`](../architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/ui/map-manager.ts`, `salt-marcher/src/apps/library/view.ts` sowie verbundene UI-Komponenten.
- **Auswirkung:** Uneinheitliche Sprache sorgt für kognitive Reibung, erschwert Übersetzungen und Review-Prozesse.
- **Risiko:** Verwirrung bei Nutzer:innen, inkonsistente Support-Anleitungen, erhöhter Pflegeaufwand für Textänderungen.

## Lösungsansätze
1. Entscheide projektspezifisch, ob UI und Kommentare primär Englisch oder Deutsch verwenden sollen, und dokumentiere die Wahl im Style Guide.
2. Überarbeite betroffene Komponenten, Notices und Tests, sodass Texte konsistent sind; nutze ggf. zentrale Übersetzungstabellen.
3. Ergänze Linting/Review-Checklisten, die Sprachmischungen erkennen, z. B. über Regex-Validierung in Vitest oder ESLint-Rules.

## Referenzen
- Map Manager: [`salt-marcher/src/ui/map-manager.ts`](../salt-marcher/src/ui/map-manager.ts)
- Library View: [`salt-marcher/src/apps/library/view.ts`](../salt-marcher/src/apps/library/view.ts)
