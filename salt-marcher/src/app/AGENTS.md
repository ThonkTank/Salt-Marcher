# Ziele
- Initialisiert das Plugin-Lifecycle-Management, verbindet Obsidian-Hooks mit den Feature-Views und sorgt für belastbares Fehlerreporting.
- Bündelt die Terrain-Bootstrap-Logik, damit Apps und Tests konsistente Datenquellen erhalten.
- Liefert zentrale Telemetrie- und Style-Helfer, die wiederholt in `main.ts` verwendet werden können.

# Aktueller Stand
## Plugin-Lifecycle (`main.ts`)
- Registriert Cartographer-, Encounter- und Library-Views inklusive Ribbon- und Command-Shortcuts.
- Lädt und überwacht Terrain-Daten direkt im Plugin, meldet Fehler über `failIntegration` und entfernt Ressourcen beim Unload.
- Verdoppelt aktuell Teile der Bootstrap-Logik aus `bootstrap-services.ts`, wodurch Tests und Produktivcode auseinanderlaufen können.

## Service-Bootstrap (`bootstrap-services.ts`)
- `createTerrainBootstrap` kapselt `ensureTerrainFile`, `loadTerrains`, `setTerrains` und `watchTerrains` in einem Handle mit `start/stop`.
- Ein Standard-Logger schreibt strukturierte Konsoleinträge; Tests injizieren Fakes, um Fehlerpfade abzudecken.

## Integrations-Telemetrie (`integration-telemetry.ts`)
- Dediziert Fehler von View-/Command-/Ribbon-Registrierungen sowie Datensatz-Ladepfaden.
- Dedupliziert Notices pro Integrations-ID und Operation, stellt mit `__resetIntegrationIssueTelemetry` einen Test-Hook bereit.

## Styles (`css.ts`)
- Exportiert das komplette Stylesheet als String, das von `injectCss`/`removeCss` im Plugin verwaltet wird.

# ToDo
- [P2.33] CSS-Injektion absichern, indem vor dem Append vorhandene `hex-css`-Nodes entfernt werden, um Doppel-Einträge nach Fehler-Recovery zu vermeiden.
- [P2.65] Terrain-Bootstrap-Logger so erweitern, dass Vault-Änderungen über `watchTerrains.onError` Telemetrie- und Notice-Hooks triggern statt nur Konsolenfehler zu schreiben.
- [P2.66] Terrain-Bootstrap mit `this.register` am Plugin-Lifecycle anbinden, damit `stop()` auch nach abgebrochenen `onload`-Sequenzen zuverlässig läuft.

# Standards
- Einstiegspunkte dokumentieren Lifecycle-Schritte im Kopfkommentar.
- Bootstrap-Helfer kapseln Obsidian-IO in reine Funktionen und liefern strukturierte Logger-Hooks.
- CSS bleibt im TypeScript gebündelt, bis ein Build-Schritt existiert; Style-Injektion arbeitet idempotent mit festen Element-IDs.
