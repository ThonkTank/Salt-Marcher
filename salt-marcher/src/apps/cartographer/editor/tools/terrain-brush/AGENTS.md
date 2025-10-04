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
- `mountPanel` lädt Regionen sequentiell über `loadRegions(app)`, zeigt währenddessen Lade-/Fehlerstatus an, sperrt das Panel bei Refreshes und reagiert auf Workspace-Events (`salt:terrains-updated`, `salt:regions-updated`).
- Der Tool-Kontext reicht `getHandles()` und `getOptions()` weiter; bei `onActivate` und `onMapRendered` wird der Brush-Kreis jedes Mal neu angeheftet.
- `onHexClick` ruft `applyBrush` auf, das Fehler meldet, UI/Persistenz rollt und seit kurzem auch das Abort-Signal des Tool-Kontexts respektiert.

## Beobachtungen
- Der „Manage…“-Button deaktiviert sich bei fehlendem Library-Command, liefert Statusmeldungen zum Command-Aufruf und verweist auf den manuellen Weg über den Library-View.
- Parallel gestartete Panel-Reloads werden sequentiell verarbeitet; `applyBrush` meldet Schreibfehler, rollt UI/Persistenz bei Teilerfolgen zurück und bricht laufende Operationen nun über das Tool-Abort-Signal sauber ab.

# ToDo
- keine offenen ToDos.

# Standards
- Funktionen beschreiben ihren Effekt auf Terrain-Arrays in einem Satz vor der Implementierung.
- Mathematische Hilfen (`*-math`) bleiben frei von Seiteneffekten.
- Brush-spezifische Module validieren abhängige Commands/Services und degradieren mit sichtbaren Hinweisen.
- Asynchrone Operationen veröffentlichen Fortschritt, respektieren `AbortSignal` und räumen UI-Ressourcen deterministisch auf.
