# LIB-TD-0001 – Vertragstest-Harness

## Kurzüberblick
- Ziel: `createLibraryHarness` als gemeinsamen Einstiegspunkt für Renderer-, Storage-, Serializer- und Event-Ports etablieren.
- Legacy/v2-Adapter können pro Port gewechselt werden, ohne Testcode anzupassen.
- Deterministische Fixtures (Creatures, Items, Equipment, Terrains, Regions) dienen allen Ports als gemeinsame Datenbasis.

## Stakeholder
- **QA** (Mira Hoffmann): priorisiert Fixture-Abdeckung und Smoke-Subset (`library-contracts.test.ts`).
- **DevOps** (Jonas Krüger): verantwortet CI-Erweiterung (`npm run test:contracts`, Aggregator `npm run ci:tests`).
- **Library-Core** (Edda Nguyen): liefert Schema-Änderungen und telemetrische Anforderungen.

## Zeitplanung
- Ready-Abstimmung abgeschlossen (KW 32): QA/DevOps haben Harness-API, Fixture-Besitz und CI-Schritte freigegeben.
- Umsetzung & Review (KW 33): Implementierung Harness, Fixtures und Vertrags-Tests + Smoke-Run.
- Übergabe an QA für Finaltest (KW 34): gemeinsame Sichtung der Telemetrie-Hooks und Reportergebnisse.

## Vorbereitungen
- QA prüft Ownership-Tabelle der Fixtures und dokumentiert Abnahme im Test-Channel.
- DevOps aktualisiert Pipeline-Job auf Basis `npm run ci:tests` und bestätigt Laufzeit (< 2 min) im Build-Log.
- Library-Core liefert Telemetrie-Events, die über `telemetry.onEvent`/`onAdapterActivated` gebridged werden können.
- PR-Smoke-Subset: `library-contracts.test.ts` + bestehende `npm test` als kombinierter Vorab-Check.
