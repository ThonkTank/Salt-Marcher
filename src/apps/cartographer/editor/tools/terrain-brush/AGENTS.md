# Ziele
- Definiert Verhalten, Parameter und Nutzerflüsse des Terrain-Pinsels im Cartographer-Editor.
- Dokumentiert, wie UI-Panel, Brush-Geometrie und Dateischreiblogik zusammenspielen.
- Stellt sicher, dass Fehlerzustände sichtbar bleiben und nachgelagerte ToDos klar beschrieben sind.

# Aktueller Stand
## Strukturüberblick
- `brush-options.ts` baut das Options-Panel (Radius, Region, Mode) auf, lädt Regionsdaten aus `core/regions-store`, steuert den Brush-Vorschaukreis und reicht Interaktionen an den Editor zurück.
- `brush-core.ts` bündelt Distanzberechnungen sowie `applyBrush`, das Terrain/Region-Daten persistiert, `RenderHandles` live aktualisiert und Hex-Koordinaten dedupliziert.

## Lifecycle & Datenflüsse
- `mountBrushPanel` hält lokalen State für Radius, Region, Terrain und Modus und synchronisiert UI-Interaktionen direkt in diese Struktur.
- Das Panel lädt Regionen sequentiell über `loadRegions(app)`, zeigt währenddessen Lade-/Fehlerstatus an, sperrt das Panel bei Refreshes und reagiert auf Workspace-Events (`salt:terrains-updated`, `salt:regions-updated`).
- Der Editor reicht `getHandles()` und `getOptions()` direkt weiter; bei Aktivierung und `onMapRendered` wird der Brush-Kreis neu angeheftet.
- `handleHexClick` ruft `applyBrush` auf, das Fehler meldet, UI/Persistenz rollt und das Abort-Signal des Editor-Lifecycles respektiert.

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
