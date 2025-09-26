# Cartographer presenter/docs merge reconciliation

## Kontext
- Sowohl Implementierung (`presenter.ts`) als auch Dokumentation (`presenter.md`) haben konkurrierende Capability-Updates erhalten.
- Merge-Konflikte blockieren die Bereitstellung des Registry-Refactors.
- Relevante Dateien:
  - [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts)
  - [`salt-marcher/docs/cartographer/presenter.md`](../salt-marcher/docs/cartographer/presenter.md)

## Problemstellung
Es existiert kein gemeinsamer Zielstand für Capability-Metadaten, Lifecycle-Hooks und Registry-Events. Ohne abgestimmte Referenz lassen sich die Konflikte nicht auflösen, wodurch `main` keine konsistente Presenter-Version erhält.

## Betroffene Bereiche
- Capability-Normalisierung zwischen Registry und Presenter.
- Dokumentation der Erweiterungs-Workflows.
- Tests, die Capability- oder Hook-Änderungen voraussetzen.

## Lösungsideen
1. Workshop zwischen Registry-, Presenter- und Docs-Team ansetzen, um Zielmodell (Capabilities, Provider-Signatur, Lifecycle) zu definieren.
2. Auf Basis der Ergebnisse gemeinsamen Merge-Branch erstellen, Konflikte manuell auflösen und Tests/Dokumentation synchron halten.
3. Review-Checkliste definieren, damit Capability-Änderungen künftig gleichzeitig in Code, Tests und Doku gepflegt werden.

## Folgeaktionen
- Merge-Branch tracken und Fortschritt im Standup berichten.
- Nach Abschluss die To-Dos `cartographer-presenter-code-merge` und `cartographer-presenter-doc-merge` schließen bzw. aktualisieren.
- Lessons Learned im Cartographer-Wiki dokumentieren.
