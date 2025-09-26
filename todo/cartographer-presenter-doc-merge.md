# Cartographer presenter documentation merge blockers

## Kontext
- Dokumentation deckt Capability- und Lifecycle-Flows des Presenters ab.
- Parallel existieren Branches mit unterschiedlichen Begrifflichkeiten und Hook-Abfolgen.
- Verlinkte Stelle: [`salt-marcher/docs/cartographer/presenter.md`](../salt-marcher/docs/cartographer/presenter.md).

## Problemstellung
`presenter.md` kollidiert beim Merge mit konkurrierenden Aktualisierungen der Capability-Tabellen und Erweiterungsanleitungen. Die Abschnitte zu Registry-Events und Lifecycle-Diagrammen unterscheiden sich strukturell, wodurch automatische Zusammenführungen scheitern.

## Betroffene Inhalte
- Capability-Matrix sowie Beschreibung der `defineCartographerModeProvider`-Signatur.
- Ablaufdiagramme zu Mode-Wechseln und Save-Hooks.
- Verweise auf Tests (`tests/cartographer/presenter.test.ts`).

## Lösungsideen
1. Zielterminologie und Hook-Reihenfolge mit dem Presenter-/Registry-Team abstimmen, bevor der Merge erfolgt.
2. Konfliktabschnitte manuell zusammenführen und dabei veraltete oder doppelte Beschreibungen konsolidieren.
3. Nach der Harmonisierung sicherstellen, dass Referenzen auf Tests und Registry-Dokumente weiterhin korrekt sind.

## Folgeaktionen
- Verantwortliche Person für die Dokumentationszusammenführung bestimmen.
- Nach Abschluss der Zusammenführung Review durch UX/Docs-Team einplanen.
- Dokumentation erneut gegen den aktuellen Implementierungsstand validieren.
