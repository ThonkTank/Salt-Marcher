# Plugin Bootstrap Review

## Kontext
Der Plugin-Bootstrap (`src/app/`) bündelt derzeit View-Registrierung, Terrain-Dateninitialisierung, CSS-Injektion und optionale Integrationen. Die Verantwortlichkeiten verschwimmen teilweise mit den Feature-Workspaces, wodurch Fehlerszenarien schwer testbar sind. Diese Notiz sammelt Investigationspunkte, bevor Refactorings geplant werden.

## Betroffene Module
- `salt-marcher/src/app/main.ts`
- `salt-marcher/src/core/terrain-store.ts`
- `salt-marcher/src/core/terrain.ts`

## Status-Update (Prototyp März 2024)
- Terrain-Bootstrap wurde in `src/app/bootstrap-services.ts` extrahiert. `createTerrainBootstrap` kapselt Priming, Watcher-Registrierung und Logging. Fehler beim Laden des Terrains verhindern das Plugin nicht mehr vollständig – Defaults bleiben aktiv, bis ein Event erfolgreich verarbeitet wurde.
- `watchTerrains` akzeptiert jetzt `TerrainWatcherOptions` (`onChange`, `onError`) und fängt Exceptions intern ab. Integrationstests (`tests/app/terrain-bootstrap.test.ts`, `tests/app/terrain-watcher.test.ts`, `tests/app/main.integration.test.ts`) sichern das Verhalten mit Obsidian-Mocks ab.

## Offene Fragen & Untersuchungen
- **Teststrategie:** Wie können wir Bootstrap-Sequenzen mit Vitest oder Integrationstests abdecken? Benötigen wir Mocks für Obsidian-`App` und Plugin-Manager, um optionale Integrationen deterministisch zu testen?
- **Plugin-Konfiguration:** Welche Teile der Bootstrap-Initialisierung sollten über Obsidian-Settings konfigurierbar sein (z. B. automatische Cartographer-Öffnung, CSS-Opt-Out)? Welche Persistenz ist dafür vorgesehen?
- **Verantwortungsschnitt:** Welche Initialisierungen können in Feature-spezifische Module verschoben werden, damit der Bootstrap schlanker und wartbarer bleibt?

## Nächste Schritte
Erstelle Proof-of-Concept-Tests für den Terrain-Watcher. Aus den Ergebnissen ableiten, ob der Bootstrap in Service-Klassen zerlegt werden sollte.
