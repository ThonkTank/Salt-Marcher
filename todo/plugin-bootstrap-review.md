# Plugin Bootstrap Review

## Kontext
Der Plugin-Bootstrap (`src/app/`) bündelt derzeit View-Registrierung, Terrain-Dateninitialisierung, CSS-Injektion und optionale Integrationen. Die Verantwortlichkeiten verschwimmen teilweise mit den Feature-Workspaces, wodurch Fehlerszenarien schwer testbar sind. Diese Notiz sammelt Investigationspunkte, bevor Refactorings geplant werden.

## Betroffene Module
- `salt-marcher/src/app/main.ts`
- `salt-marcher/src/app/layout-editor-bridge.ts`
- `salt-marcher/src/core/terrain-store.ts`
- `salt-marcher/src/core/terrain.ts`

## Status-Update (Stand Mai 2024)
- Terrain-Bootstrap wurde in `src/app/bootstrap-services.ts` extrahiert. `createTerrainBootstrap` kapselt Priming, Watcher-Registrierung und Logging; die Vitest-Suite deckt Erfolg, Fehler und Restart-Verhalten ab.【F:salt-marcher/src/app/bootstrap-services.ts†L1-L118】【F:salt-marcher/tests/app/terrain-bootstrap.test.ts†L1-L106】
- Die Layout-Editor-Bridge arbeitet jetzt mit einer getypten Lifecycle-API, deduplizierter Telemetrie und eigenen Tests, wodurch Integrationsfehler sichtbar bleiben.【F:salt-marcher/src/app/layout-editor-bridge.ts†L31-L133】【F:salt-marcher/tests/app/layout-editor-bridge.test.ts†L1-L146】
- `main.ts` bindet den Terrain-Service noch nicht an, was zu doppelter Bootstrap-Logik führt (siehe [Main bootstrap service integration](main-bootstrap-service-integration.md)).【F:salt-marcher/src/app/main.ts†L1-L65】

## Offene Fragen & Untersuchungen
- **Service-Handover:** Welche Sequenz sichert zu, dass Terrain-Bootstrap (`start()`/`stop()`), Layout-Bridge und CSS-Injektion deterministisch orchestriert werden, sobald `main.ts` auf Services umstellt?
- **Teststrategie:** Integrationstests decken den Legacy-Bootstrap ab, während Service-Start/Stop nur indirekt geprüft wird. Wir benötigen einen Plan, wie Obsidian-`App`-Mocks gemeinsam mit Service-Spies eingesetzt werden.
- **Plugin-Konfiguration:** Welche Teile der Bootstrap-Initialisierung sollten über Obsidian-Settings konfigurierbar sein (z. B. automatische Cartographer-Öffnung, CSS-Opt-Out)? Welche Persistenz ist dafür vorgesehen?
- **Verantwortungsschnitt:** Welche Initialisierungen können in Feature-spezifische Module verschoben werden, damit der Bootstrap schlanker und wartbarer bleibt?

## Nächste Schritte
- Proof-of-Concept für Service-orientierten Bootstrap fertigstellen (`main.ts` + Tests), anschließend die verbleibenden Fragen priorisieren.
