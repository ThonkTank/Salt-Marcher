# Ziele
- Bündelt alle Editortools, die Kartenfelder selektieren oder verändern, und dokumentiert deren Verträge.
- Beschreibt, wie Tool-Lifecycle, Panel-Mounting und UI-Statusmeldungen ineinandergreifen.
- Stellt sicher, dass neue Tools konsistent an `modes/editor.ts` andocken und sich sauber bereinigen.

# Aktueller Stand
## Strukturüberblick
- `tools-api.ts` definiert `ToolModule`, den gemeinsam genutzten `ToolContext` (inklusive `setStatus`) sowie die Manager-Signatur.
- `tool-manager.ts` schaltet Tools, mountet deren Panels, ruft Lifecycle-Hooks (`onActivate`, `onDeactivate`, `onMapRendered`) und verwaltet Abbruch-Controller.
- `brush-circle.ts` rendert den Vorschaukreis über SVG, throttlet Pointer-Events und unterstützt dynamische Radien.
- `terrain-brush/` stellt das einzige derzeit aktive Tool mit Panel, Options-State, Regions-Loading, Brush-Mathematik und Hex-Anwendung bereit.

## Lifecycle & Datenflüsse
- Der Editor-Modus reicht `ToolContext`-Instanzen mit Datei-, Render- und Optionshandles sowie `setStatus` an den Manager, der sie an Tools weitergibt und Status-/Fallback-Metadaten via Hooks zurückmeldet.
- `switchTo` leert das Panel, mountet das gewünschte Tool, ruft Hooks sequenziell nach Microtasks auf und informiert den Editor über Telemetrie- sowie Fallback-Hooks.
- Der Terrain-Brush zeigt Statusmeldungen für Lade-, Fehler- und Reset-Zustände an, validiert den „Manage…“-Button gegen das Command und blendet bei Bedarf Hinweise zur manuellen Pflege ein.

# Beobachtungen
- Tool-Umschaltungen ohne Treffer (unbekannte ID, leere Tool-Liste) melden ihren Fallback inzwischen an den Editor; der Terrain-Brush blockt Panel & Statusmeldungen sauber und deaktiviert den „Manage…“-Button bei fehlendem Command.
- `createToolManager` reicht Telemetrie an den Editor weiter; `brush.ts` sendet allerdings weiterhin keine Fehler- oder Abort-Hooks zurück.
- Der Terrain-Brush erklärt Nutzer*innen nun, wie sie Regionen im Library-View anlegen, muss aber weiterhin Fehler der Schreiblogik und Abort-Signale adressieren.

# ToDo
- keine offenen ToDos.

# Standards
- Jede Tool-Datei startet mit Dateipfad plus einem Satz zur Nutzerinteraktion.
- Tool-Module räumen eigene DOM- und Workspace-Abos konsequent im Cleanup bzw. `onDeactivate` ab.
- Asynchrone Operationen veröffentlichen Fortschritt und Fehler über `ToolContext.setStatus` und nutzen `AbortSignal`, um Arbeiten nach Mode-Wechseln einzustellen.
- Buttons oder globale Integrationen validieren abhängige Commands/Services und degradieren andernfalls mit sichtbarem Hinweis.
