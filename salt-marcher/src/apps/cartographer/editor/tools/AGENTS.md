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
- Der Editor-Modus reicht `ToolContext`-Instanzen mit Datei-, Render- und Optionshandles sowie `setStatus` an den Manager, der sie ungeprüft an Tools weitergibt.
- `switchTo` leert das Panel, mountet das gewünschte Tool und ruft Hooks sequenziell nach Microtasks auf; Fehler werden ausschließlich über `console.error` protokolliert.
- Fällt ein Tool beim Panel-Mount oder Aktivieren aus, signalisiert der Manager dies weder per Statusmeldung noch per Telemetrie und hinterlässt ein leeres Panel.
- Der Terrain-Brush lädt Regionen asynchron, nutzt `loadRegions` und Workspace-Events, aktualisiert jedoch keine Statusanzeige bei Lade- oder Fehlerzuständen und verliert stillschweigend vorausgewählte Regionen.

# Beobachtungen
- Tool-Umschaltungen ohne Treffer (unbekannte ID, leere Tool-Liste) resultieren in stummen Rückgaben; ein sichtbarer Hinweis oder Telemetrie fehlt.
- `createToolManager` kennt keinen Hook, um Fehler an den Editor-Modus weiterzuleiten, obwohl `ToolContext.setStatus` für Panel-Feedback vorgesehen ist.
- Der Terrain-Brush meldet Ladefehler nur in der Konsole; Nutzer erkennen nicht, ob Regionen nachgeladen werden oder warum Dropdowns leer bleiben.
- Der „Manage…“-Button vertraut auf den globalen Command, prüft aber dessen Existenz nicht und kann Nutzer ohne Feedback zurücklassen.

# ToDo
- [P2.40] `tool-manager.ts`: Status-/Fallback-Hook ergänzen, der bei unbekannten Tool-IDs oder fehlgeschlagenem Mount eine Nutzerhinweis- und Telemetrie-Pipeline triggert.
- [P2.41] `terrain-brush/brush-options.ts`: Panel-Status (`ctx.setStatus`) während Regionsladezyklen nutzen, Fehlermeldungen anzeigen und verlorene Vorauswahl begründet zurücksetzen.
- [P2.42] `terrain-brush/brush-options.ts`: Command-Aufruf für „Manage…“ absichern (Existenz prüfen, andernfalls UI-Hinweis setzen).

# Standards
- Jede Tool-Datei startet mit Dateipfad plus einem Satz zur Nutzerinteraktion.
- Tool-Module räumen eigene DOM- und Workspace-Abos konsequent im Cleanup bzw. `onDeactivate` ab.
- Asynchrone Operationen veröffentlichen Fortschritt und Fehler über `ToolContext.setStatus` und nutzen `AbortSignal`, um Arbeiten nach Mode-Wechseln einzustellen.
- Buttons oder globale Integrationen validieren abhängige Commands/Services und degradieren andernfalls mit sichtbarem Hinweis.
