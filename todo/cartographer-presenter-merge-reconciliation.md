# Cartographer presenter/docs merge reconciliation

## Problemstellung
Beim Zusammenführen des letzten Capability-Updates kollidierten `salt-marcher/docs/cartographer/presenter.md` und `salt-marcher/src/apps/cartographer/presenter.ts` mit bestehenden Änderungen. Die automatische Migration der Presenter-API und der Dokumentation wurde nicht abgeschlossen, wodurch der aktuelle Branch nicht sauber mit `main` zusammengeführt werden kann.

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/presenter.ts`, `salt-marcher/docs/cartographer/presenter.md`.
- **Auswirkung:** Merge-Konflikte blockieren das Einspielen des Capability-Registry-Updates; Presenter-Code und Dokumentation sind inkonsistent.
- **Risiko:** Verzögerte Bereitstellung, potenziell veraltete Dokumentation oder doppelte Capability-Guards im Presenter.

## Lösungsideen
1. Konflikte manuell auflösen und Presenter-Änderungen mit dem Registry-Interface synchronisieren.
2. Dokumentation (`presenter.md`) aktualisieren, damit sie die finalen Capability-Gates und den neuen Registrierungs-Workflow beschreibt.
3. Nach dem Merge Regressionstests (Presenter- und Registry-Vitest-Suites) ausführen, um sicherzustellen, dass die Anpassungen stabil bleiben.

## Nächste Schritte
- Merge-Konflikte identifizieren, gewünschte Zielstruktur abstimmen und Priorisierung mit dem Cartographer-Team klären.
- Danach dediziertes Follow-up erstellen, um Code und Dokumentation gemeinsam zu harmonisieren.
