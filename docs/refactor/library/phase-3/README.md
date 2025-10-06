# Phase 3 – Library Refactor Planning

Dieses Verzeichnis enthält die Planungsartefakte der Phase 3 für das Library-Refactoring. Ziel ist es, aus den Analysen (Phase 1) und dem Zielbild (Phase 2) ein ausführbares Backlog für Phase 4 abzuleiten.

## Struktur
- `backlog.md` – Vollständige ToDo-Karten (Epics → Work Packages → ToDos) inkl. aller Pflichtfelder.
- `backlog.csv` – Maschinenlesbare Tabelle aller ToDos.
- `traceability.md` – Mapping von Technical Debts & Risks auf ToDo-IDs und Work Packages.
- `kanban.md` – Textbasierter Kanban-Export (Ready vs. Backlog).
- `planning-briefs/` – Einzelne Planning-Briefs pro ToDo (`LIB-TD-####.md`).
- `AGENTS.md` – Verzeichnisregeln und Standards.

## ToDo-Felder & Bedeutung
Jede ToDo-Karte in `backlog.md` enthält folgende Felder in fester Reihenfolge:
1. **ID** – laufende Kennung `LIB-TD-####`.
2. **Titel (imperativ)** – prägnante Handlungsanweisung.
3. **Kategorie** – Zuordnung {Architektur, Serializer, Renderer, Contracts, Persistenz/IO, Validation, Tests, Build/Infra, Cleanup}.
4. **Bezug (Trace)** – referenzierte Debts, Risks, ADRs und Work Package.
5. **Problem (Ist)** – aktueller Zustand mit Pfad-/Modulhinweisen.
6. **Zielzustand (Soll/Contract)** – erwarteter Contract bzw. Zielarchitektur.
7. **Scope & Out-of-Scope** – Umfangsgrenze.
8. **Entwurfsleitlinien (Planung)** – Planungsschritte, Schnittstellen, Migrationspfade, Testanker.
9. **Abhängigkeiten** – benötigte ToDos/Artefakte.
10. **Risiken & Mitigation** – erwartete Risiken inkl. Gegenmaßnahmen.
11. **Test-Impact & Ankermuster** – geplante Testtypen.
12. **Messgrößen (Erfolg)** – messbare Ziele/Metriken.
13. **Akzeptanzkriterien** – getrennt nach DoR (Ready für Phase 4) und DoD (Ergebnis Phase 4).
14. **Aufwand (T-Shirt)** – S/M/L als Planungsschätzung.
15. **Priorität (Score)** – Ranking nach ICE.
16. **Open Questions** – noch zu klärende Punkte.

## Priorisierungsmethode
Wir verwenden einen **ICE-Score**: `Impact × Confidence ÷ Effort`. Dabei gilt:
- Impact & Confidence werden auf einer Skala von 1–10 geschätzt.
- Effort basiert auf dem T-Shirt-Size-Mapping (S=1, M=2, L=3).
- Höhere Werte deuten auf höhere Priorität hin. Die Reihenfolge in `backlog.md` berücksichtigt zusätzlich die in `work-packages.md` festgelegte Sequenz.

## Nutzung in Phase 4
1. **Backlog Grooming** – Prüfen Sie für jedes ToDo die Planning-Briefs (`planning-briefs/`) und beantworten Sie offene Fragen.
2. **DoR-Check** – Stellen Sie sicher, dass sämtliche DoR-Punkte erfüllt sind, bevor ein ToDo nach „Ready for Phase 4“ verschoben wird.
3. **Umsetzung** – Arbeiten Sie die Entwurfsleitlinien Schritt für Schritt ab. Dokumentieren Sie Entscheidungen in den referenzierten ADRs oder ergänzen Sie neue.
4. **Testing & Metrics** – Validieren Sie die in den ToDos genannten Tests und Messgrößen. Aktualisieren Sie `success-metrics.md` falls erforderlich.
5. **Traceability** – Halten Sie `traceability.md` synchron, falls sich Zuordnungen durch neue Erkenntnisse ändern.

## Pflegehinweise
- Neue ToDos erhalten sofort eine Karte in `backlog.md`, einen CSV-Eintrag und einen Planning-Brief.
- Änderungen am Plan spiegeln sich in allen Artefakten wider (Backlog, CSV, Kanban, Traceability).
- Bei strukturellen Anpassungen erneut `npm run sync:todos` im Repo-Stamm ausführen (siehe `AGENTS.md` auf Root-Ebene).
