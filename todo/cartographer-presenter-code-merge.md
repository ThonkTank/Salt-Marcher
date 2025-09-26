# Cartographer presenter implementation merge blockers

## Problemstellung
`salt-marcher/src/apps/cartographer/presenter.ts` weist beim Mergen Konflikte auf. Der aktuelle Branch bringt Capability- und Registry-Anpassungen mit, die sich mit gleichzeitigen Umbauten (z. B. Abort-Handling, Lifecycle-Hooks) überschneiden. Automatische Merges scheitern und die Zielimplementierung ist unklar.

## Kontext
- **Betroffene Datei:** `salt-marcher/src/apps/cartographer/presenter.ts`.
- **Auswirkung:** Presenter-Refactorings können nicht integriert werden; das UI verhält sich je nach Branch unterschiedlich.
- **Risiko:** Regressionen in Mode-Lifecycle, fehlende Capability-Gates oder instabile Abort-Verknüpfungen.

## Lösungsideen
1. Konfliktbereiche markieren und mit dem Registry-/Presenter-Team den gewünschten Funktionsumfang abstimmen.
2. Gemeinsame Referenzimplementation herausarbeiten (Capability-Gates, Hook-Sequenzen, Signal-Verkettung) und Tests entsprechend anpassen.
3. Nach Konfliktauflösung Presenter- und Registry-Test-Suiten (`presenter.test.ts`, `mode-registry.test.ts`) ausführen.

## Nächste Schritte
- Verantwortliche für den Merge bestimmen und Arbeitsbranch anlegen.
- Konflikte manuell lösen, anschließend Code-Review und Tests durchführen, bevor die Änderungen in `main` einfließen.
