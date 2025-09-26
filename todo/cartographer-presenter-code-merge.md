# Cartographer presenter implementation merge blockers

## Kontext
- Konflikte betreffen Capability-/Lifecycle-Änderungen rund um `CartographerPresenter`.
- Mehrere Branches führen unterschiedliche Registry- und Abort-Handling-Flows ein.
- Verlinkte Stellen: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts).

## Problemstellung
`presenter.ts` lässt sich aktuell nicht automatisch mit `main` zusammenführen. Capability-Gates, Registry-Abonnements und Abort-Verkettung wurden in konkurrierenden Branches unterschiedlich umgesetzt, wodurch die Konfliktmarker unterschiedliche Zielstrukturen aufweisen.

## Betroffene Module
- Presenter-State-Machine (`CartographerPresenter`).
- Mode-Registry-Abos (`subscribeToModeRegistry`).
- Test-Suites: `tests/cartographer/presenter.test.ts`, `tests/cartographer/mode-registry.test.ts`.

## Lösungsideen
1. Konfliktsegmente identifizieren (Lifecycle, Capability-Gates, Registry-Metadaten) und mit Registry-Team den Zielzustand abstimmen.
2. Gemeinsame Referenzimplementierung ableiten (z. B. priorisieren, ob Capability-Metadaten in Presenter oder Registry normalisiert werden) und Tests entsprechend aktualisieren.
3. Merge manuell durchführen, anschließend Presenter- und Registry-Tests ausführen, um Regressionen auszuschließen.

## Folgeaktionen
- Verantwortliche Person bestimmen und Arbeitsbranch für die manuelle Zusammenführung erstellen.
- Nach erfolgreichem Merge Architektur-Review einplanen, damit Capability-Verträge dokumentiert bleiben.
- Ergebnisse zurück in die Dokumentation spiegeln (`docs/cartographer/presenter.md`).
