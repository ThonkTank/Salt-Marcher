# Cartographer presenter capability alignment backlog

## Kontext
- Die Mode-Registry exportiert seit kurzem Capability-Metadaten (`mapInteraction`, `persistence`, `sidebar`).
- Die Presenter-Implementierung und begleitende Dokumentation mussten wegen Merge-Problemen zurückgesetzt werden.
- Relevante Stellen: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts), [`salt-marcher/docs/cartographer/presenter.md`](../salt-marcher/docs/cartographer/presenter.md), [`todo/README.md`](README.md), Tests unter [`salt-marcher/tests/cartographer/`](../salt-marcher/tests/cartographer/).

## Problemstellung
Der Presenter wertet die neuen Capability-Metadaten aktuell nicht aus. Dokumentation und To-Do-Index spiegeln den neuen Workflow ebenfalls nicht wider. Dadurch bleibt unklar, wie Registry-Anbieter ihre Fähigkeiten deklarieren und wie der Presenter Hex-Klicks bzw. Save-Hooks konditional behandeln soll.

## Betroffene Module
- Presenter-State-Machine und Lifecycle (`CartographerPresenter`).
- Mode-Registry-Abonnements und Capability-Wrapping.
- Dokumentation im Cartographer-Bereich.
- Test-Suites `presenter.test.ts` und `mode-registry.test.ts`.
- Backlog-Übersicht (`todo/README.md`).

## Lösungsideen
1. Presenter anpassen, damit Registry-Events Capability-Metadaten liefern und Hooks entsprechend ge-gatet werden.
2. Dokumentation aktualisieren (Presenter- und Registry-Guides) und auf Capability-Anforderungen hinweisen.
3. Tests ergänzen/reaktivieren, die `onSave`/`onHexClick` in Abhängigkeit von Metadaten validieren.
4. Backlog-Index (`todo/README.md`) erweitern, um den Capability-Abgleich sichtbar zu halten.

## Folgeaktionen
- Verantwortliche Person bestimmen und Branch für die Capability-Integration erstellen.
- Nach Umsetzung Architektur-/Docs-Review einplanen.
- Abschließend den neuen Workflow im User-Wiki referenzieren.
