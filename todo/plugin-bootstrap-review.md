# Plugin Bootstrap Review

## Kontext
Der Plugin-Bootstrap (`src/app/`) bündelt derzeit View-Registrierung, Terrain-Dateninitialisierung, CSS-Injektion und optionale Integrationen. Die Verantwortlichkeiten verschwimmen teilweise mit den Feature-Workspaces, wodurch Fehlerszenarien schwer testbar sind. Diese Notiz sammelt Investigationspunkte, bevor Refactorings geplant werden.

## Betroffene Module
- `salt-marcher/src/app/main.ts`
- `salt-marcher/src/app/layout-editor-bridge.ts`
- `salt-marcher/src/core/terrain-store.ts`
- `salt-marcher/src/core/terrain.ts`

## Offene Fragen & Untersuchungen
- **Watcher-Error-Handling:** Welche Fehlerzustände kann `watchTerrains` auslösen (z. B. gelöschte Dateien, Berechtigungen)? Wie werden Views informiert, und braucht es Retry-/Backoff-Strategien?
- **Teststrategie:** Wie können wir Bootstrap-Sequenzen mit Vitest oder Integrationstests abdecken? Benötigen wir Mocks für Obsidian-`App` und Plugin-Manager, um die Layout-Bridge deterministisch zu testen?
- **Plugin-Konfiguration:** Welche Teile der Bootstrap-Initialisierung sollten über Obsidian-Settings konfigurierbar sein (z. B. automatische Cartographer-Öffnung, CSS-Opt-Out)? Welche Persistenz ist dafür vorgesehen?
- **Verantwortungsschnitt:** Welche Initialisierungen können in Feature-spezifische Module verschoben werden, damit der Bootstrap schlanker und wartbarer bleibt?

## Nächste Schritte
Erstelle Proof-of-Concept-Tests für den Terrain-Watcher und eine Mock-API für den Layout-Editor. Aus den Ergebnissen ableiten, ob der Bootstrap in Service-Klassen zerlegt werden sollte.
