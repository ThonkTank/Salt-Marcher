# Ziele
- Bündelt alle Editortools, die Kartenfelder selektieren oder verändern, und dokumentiert deren Verträge.
- Beschreibt, wie Tool-Lifecycle, Panel-Mounting und UI-Statusmeldungen ineinandergreifen.
- Stellt sicher, dass neue Tools konsistent an `modes/editor.ts` andocken und sich sauber bereinigen.

# Aktueller Stand
## Strukturüberblick
- `brush-core.ts` liefert Radius-/Distanzmathematik sowie `applyBrush`, das Persistenz und Live-Fills kapselt.
- `brush-circle.ts` rendert den Vorschaukreis über SVG, throttlet Pointer-Events und unterstützt dynamische Radien.
- `terrain-brush/` bündelt Panel, Options-State, Regions-Loading und Hex-Anwendung auf Basis des Brush-Cores.

## Lifecycle & Datenflüsse
- Der Editor-Modus reicht Datei-, Render- und Optionshandles sowie `setStatus` direkt an das Brush-Panel weiter.
- Das Panel mountet UI, lädt Regionen, reagiert auf Workspace-Events und steuert über `setDisabled`/`handleHexClick` den Brush-Kreis sowie `applyBrush`.
- Der Terrain-Brush zeigt Statusmeldungen für Lade-, Fehler- und Reset-Zustände an, validiert den „Manage…“-Button gegen das Command und blendet bei Bedarf Hinweise zur manuellen Pflege ein.

# Beobachtungen
- Der Terrain-Brush blockt Panel & Statusmeldungen sauber und deaktiviert den „Manage…“-Button bei fehlendem Command.
- `applyBrush` meldet Fehler über Telemetrie und respektiert Abort-Signale, liefert aber weiterhin keine automatische Recovery jenseits des Rollbacks.
- Der Terrain-Brush erklärt Nutzer*innen, wie sie Regionen im Library-View anlegen, muss aber weiterhin Fehler der Schreiblogik und Abort-Signale adressieren.

# ToDo
- keine offenen ToDos.

# Standards
- Jede Tool-Datei startet mit Dateipfad plus einem Satz zur Nutzerinteraktion.
- Tool-Module räumen eigene DOM- und Workspace-Abos konsequent im Cleanup bzw. in `destroy`/`setDisabled(false)` ab.
- Asynchrone Operationen veröffentlichen Fortschritt und Fehler über die vom Modus gereichten Status-Helfer und nutzen `AbortSignal`, um Arbeiten nach Mode-Wechseln einzustellen.
- Buttons oder globale Integrationen validieren abhängige Commands/Services und degradieren andernfalls mit sichtbarem Hinweis.
