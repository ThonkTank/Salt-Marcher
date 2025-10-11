# Ziele
- Bündelt die Nutzeroberflächen (Cartographer, Encounter, Library) und hält ihre Entry-Points für das Plugin bereit.
- Dokumentiert, wie jede App an `src/app/main.ts` und die gemeinsamen `core/`-Dienste angedockt wird.
- Sichert konsistente Standards für Dokumentation, Dateistrukturen und View-Hilfsfunktionen über alle Apps hinweg.

# Aktueller Stand
## Strukturüberblick
- `cartographer/` verwaltet Karten, Modi und Datei-Interaktionen. `index.ts` exportiert View, View-Typ-Konstanten sowie Öffnungs-
  und Detach-Helfer, die das Plugin nutzt, um Obsidian-Leaves aufzubauen.
- `encounter/` synchronisiert Reisebegegnungen aus dem Travel-Modus, stellt einen Presenter bereit und aktualisiert Sessions in
  Echtzeit innerhalb des Views.
- `library/` kapselt Nachschlagewerke, Create-Dialoge und Views. `view/index.ts` exponiert die `LibraryView`, die Ribbon- und
  Command-Hooks aus `src/app/main.ts` konsumiert.
- Jede App bringt eine eigene `AGENTS.md` und README-Struktur mit, die Detail-Regeln zu Modi, Domains und UI-Flows enthält.

## Integrationspunkte
- `src/app/main.ts` registriert alle Views und Commands direkt über die von hier exportierten Klassen und Hilfsfunktionen (z.B.
  `openCartographer`). Das erfordert konsistente View-Metadaten (Typ, Icon, Display-Text) innerhalb jeder App.
- Cartographer-Modi interagieren mit Encounter über Gateways in `session-runner/view/controllers/encounter-gateway` sowie den
  `encounter/session-store`. Library greift für Persistenz und Datenimporte auf `core/persistence` und die gemeinsamen Terrain-
  Ressourcen zu.
- Ribbon-Icons und Commands existieren bisher als redundante Definitionen in `src/app/main.ts`. Änderungen an Bezeichnern müssen
  daher sowohl hier als auch in den jeweiligen Apps gepflegt werden.

## Dokumentationsstand
- `apps/README.md` beschreibt Event-Flows und verlinkt auf die App-spezifischen READMEs. Änderungen an Export-Signaturen werden
  bisher nicht separat nachgehalten.
- Tests spiegeln die App-Struktur über `salt-marcher/tests/*` wider, fokussieren jedoch auf Feature-Ebene und validieren keine
  gemeinsamen View-Verträge.

# ToDo
- [P2.34] Kapsle View-Metadaten (Typ, Icon, Display-Name, Ribbon-Konfiguration) in einem gemeinsamen Manifest (`apps/view-manifest.ts`) und nutze es in `src/app/main.ts`, um Registrierungen, Ribbons und Commands generisch aufzubauen.

# Standards
- Komponenten- und Controller-Dateien starten mit einem Kontextsatz zum Workflow.
- UI-spezifische Typen leben lokal innerhalb der App.
- Jede App exportiert ihren View-Typ (`VIEW_*`), den `ItemView`-Nachfolger sowie Öffnungs-/Detach-Helfer aus einem zentralen
  Entry-Point, damit `src/app/main.ts` ohne relative Deep-Imports arbeiten kann.
- Änderungen an Icons, Namen oder Commands einer App werden gleichzeitig im gemeinsamen Manifest, in den App-spezifischen
  READMEs und in den Release-Notes dokumentiert.
