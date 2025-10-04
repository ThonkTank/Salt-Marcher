# Ziele
- Definiert Verhalten, Parameter und Nutzerflüsse des Terrain-Pinsels im Cartographer-Editor.
- Dokumentiert, wie UI-Panel, Brush-Geometrie und Dateischreiblogik zusammenspielen.
- Stellt sicher, dass Fehlerzustände sichtbar bleiben und nachgelagerte ToDos klar beschrieben sind.

# Aktueller Stand
## Strukturüberblick
- `brush-options.ts` baut das Options-Panel (Radius, Region, Mode) auf, lädt Regionsdaten aus `core/regions-store` und steuert den Brush-Vorschaukreis.
- `brush.ts` persistiert Terrain/Region-Daten über `saveTile`/`deleteTile`, aktualisiert `RenderHandles` live und dedupliziert Hex-Koordinaten innerhalb des Radius.
- `brush-math.ts` kapselt Distanz- und Radiusberechnungen für das odd-r-Grid und liefert deterministisch sortierte Koordinatenlisten.

## Lifecycle & Datenflüsse
- `createBrushTool` hält lokalen State für Radius, Region, Terrain und Modus und synchronisiert UI-Interaktionen direkt in diese Struktur.
- `mountPanel` lädt Regionen sequentiell über `loadRegions(app)` und reagiert auf Workspace-Events (`salt:terrains-updated`, `salt:regions-updated`), setzt aber keine Statusmeldungen im Panel.
- Der Tool-Kontext reicht `getHandles()` und `getOptions()` weiter; bei `onActivate` und `onMapRendered` wird der Brush-Kreis jedes Mal neu angeheftet.
- `onHexClick` ruft `applyBrush` ohne eigene Fehlerbehandlung auf; Ausnahmen landen nur in der Konsole, Abort-Signale aus dem Tool-Kontext werden nicht berücksichtigt.

## Beobachtungen
- Fehlschläge beim Laden der Regionen oder beim Command-Aufruf „Manage…“ bleiben für Nutzer unsichtbar, obwohl `ToolContext.setStatus` verfügbar wäre.
- Panel-Reloads können mehrfach parallel laufen (Event-Loop + manuelle Klicks); ältere Promises werden zwar durch `fillSeq` verworfen, aber es fehlt ein visuelles Feedback für laufende Aktualisierungen.
- `applyBrush` hat keinen Guard für aufeinanderfolgende Klicks und propagiert weder Partial-Fehler noch Telemetrie, wodurch inkonsistente Terrain-Zustände unbemerkt bleiben können.

# ToDo
- [P2.41] `brush-options.ts`: Statusmeldungen und Inline-Hinweise nutzen, um Lade-/Fehlerzustände sichtbar zu machen und das Panel während `loadRegions`-Zyklen zu sperren.
- [P2.42] `brush-options.ts`: Command-Aufruf für „Manage…“ absichern (Existenz prüfen, sonst degradieren) und Nutzer*innen erklären, wie sie Bibliothekseinträge nachpflegen.
- [P2.43] `brush.ts`: Fehler beim Anwenden des Brushes (save/delete) an den Tool-Kontext melden, Telemetrie auslösen und sicherstellen, dass UI/Hex-Fills bei Teilerfolg zurückgerollt werden.
- [P2.44] `brush.ts`: Abort-Signal des Tool-Kontexts berücksichtigen, um laufende Schreibvorgänge bei Toolwechseln abzubrechen und Race-Conditions zu vermeiden.

# Standards
- Funktionen beschreiben ihren Effekt auf Terrain-Arrays in einem Satz vor der Implementierung.
- Mathematische Hilfen (`*-math`) bleiben frei von Seiteneffekten.
- Brush-spezifische Module validieren abhängige Commands/Services und degradieren mit sichtbaren Hinweisen.
- Asynchrone Operationen veröffentlichen Fortschritt, respektieren `AbortSignal` und räumen UI-Ressourcen deterministisch auf.
