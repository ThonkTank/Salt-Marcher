# Cartographer presenter documentation merge blockers

## Problemstellung
Beim Zusammenführen der aktuellen Branches kollidiert `salt-marcher/docs/cartographer/presenter.md` mit parallelen Änderungen. Die Dokumentation beschreibt Capability- und Lifecycle-Details, die im Zielbranch bereits wieder anders umgesetzt wurden, wodurch automatische Merges scheitern.

## Kontext
- **Betroffene Datei:** `salt-marcher/docs/cartographer/presenter.md`.
- **Auswirkung:** Die Dokumentation kann nicht sauber übernommen werden und bleibt inkonsistent zum Stand der Implementierung.
- **Risiko:** Onboarding-Teams und Integrator:innen erhalten widersprüchliche Informationen über Presenter-Fähigkeiten und Hook-Verhalten.

## Lösungsideen
1. Zielzustand der Presenter-Dokumentation mit dem Cartographer-Team abstimmen (Capabilities, Registry-Verhalten, Hook-Signaturen).
2. Konfliktstellen in `presenter.md` manuell auflösen und dabei redundante oder veraltete Abschnitte konsolidieren.
3. Nach dem Merge die Referenzen zu Tests und Registry-APIs prüfen und bei Bedarf aktualisieren.

## Nächste Schritte
- Merge-Strategie festlegen (welche Branch-Version als Grundlage dient) und Verantwortliche benennen.
- Detailreview der betroffenen Abschnitte durchführen und anschließend die Dokumentations-Änderung als dedizierten PR vorbereiten.
