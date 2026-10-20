# Gemeinsamer räumlicher Atlas: Ausgangsbasis und Prüfablauf

Arbeitsstand 20.10.2026, zu [P0 der Roadmap](unified-spatial-atlas.md#p0--umfang-und-vergleichbare-ausgangsbasis-sichern).
P0 ist in Arbeit. Native Leistungsmessungen, die vollständige große Prüfwelt
und vollständige Bearbeitungsabläufe sind noch offen.
Der externe Enginevergleich entfällt gemäß Nutzerentscheidung.
Die [ersten lokalen Prüfungen und der unvollständige native Lauf](../../reference/unified-atlas-p0-20261020/README.md)
halten bestätigte Ergebnisse, korrigierte Fixturefehler und offene Grenzen fest.

## Gesicherte Ausgangsstände

Die geteilte Arbeitskopie auf `e80b3bfb74673a8c08b6f896fc21522e4eb9e036`
enthält weitere nicht integrierte Terrainarbeiten. Sie wurde einschließlich
unversionierter, nicht ignorierter Dateien gesichert: 3.489 Dateien, SHA-256 je
Datei, binärer Git-Diff und Git-Status. Während der Sicherung änderte sich keine
erfasste Datei. Archiv und geprüft entpackte Quelle liegen auf diesem Host unter
`~/.cache/saltmarcher/unified-atlas/p0-baseline-20261020T190511Z/`.
Das ist eine Quellsicherung, kein reproduzierter nativer Leistungsbefund.

Die isolierte Umsetzung begann auf `origin/main` bei
`f83b04418f9822424c3ab6c3ae9610b314014e49`, Branch
`codex/unified-spatial-atlas`, Arbeitskopie
`~/.cache/saltmarcher/unified-atlas/implementation`.
Dieser neuere Integrationsstand enthält bereits gemeinsame Raumgruppen und
Regionen. Messungen beider Stände müssen ihre Quellen und Funktionen getrennt
ausweisen. Vor der Integration ist erneut aktuelles `origin/main` maßgeblich.

## Repository-Start und Zusammenführung (21.10.2026)

Der Nutzer startet aus `/home/aaron/Schreibtisch/projects/SaltMarcher` mit
`npm run start:desktop`. Dieser Projektordner verwendet jetzt
`codex/atlas-development-start` mit dem zusammengeführten Hauptatlas
auf `21a60b5e9`. Der [tatsächliche Entwicklungsstart ist nativ geprüft](../../reference/atlas-objects-main-20261021/repository-start.md):
Kampagne → Atlas, Neigung, Drehung und Mausradzoom behalten dieselbe Canvasfläche.
Die Prüfung verwendete eine isolierte Testkampagne; bestehende persönliche
Kampagnen und die vollständige Produktabnahme sind davon nicht umfasst.

Der frühere uncommittierte Stand auf `e80b3bfb7` ist unter
`archive/atlas-development-before-20261021` gesichert (Git-Snapshot
`b7ef1c63d1235c9ebcb5988c3b072c22cfafa789`). Alle 3.489 Dateien einschließlich
unversionierter Quellen wurden gegen die Git-Sicherung und das vorhandene
SHA-256-Archiv unter
`~/.cache/saltmarcher/unified-atlas/repository-start-20261020T215309Z/`
geprüft. Die Zusammenführung verwendete die vorhandene R7-Basis für den
dreiseitigen Abgleich. Benutzerprofile wurden nicht verändert.

Übernommen sind zunächst die gestreamten Terrainfelder, begrenzten abgeleiteten
Caches, lokale Invalidierung, additive Höhenbänder und die Vorbereitung großer
Pinsel im Readonly-Worker. Die gemeinsame Kamera verwendet diese begrenzte
Projektion bereits für normale Navigation. Kanonische Records werden erst bei
einer Autoren-Vorschau geladen. Die GPU-Höhenlinien bleiben unmittelbar
änderbar, ohne eine Textur erneut berechnen zu müssen.

Die ursprünglichen großen Pinsel bewegen feine Geländeformen mit, statt deren
Kacheln zu überschreiben. Submeter-Pinsel aus dem Kamerabranch bleiben möglich.
Die gemeinsame Schema-Version bleibt 53 einschließlich Raumgruppen, Regionen
und Reisehistory; eine ältere Schema-Erwartung aus dem Terrainstand darf diese
Bestände nicht zurückstufen.

Live-Pinselanzeige, partielle GPU-Updates und Höhenprofile sind jetzt an die
gemeinsame Hauptkamera angeschlossen und [lokal geprüft](../../reference/atlas-live-main-camera-20261021/README.md).
Objekt-Höhenbindung und perspektivische Ausgabe sind ebenfalls [an diese Hauptkamera angeschlossen und lokal geprüft](../../reference/atlas-objects-main-20261021/README.md). Die bisherigen Ausgabetests und Proben der separaten Ansicht werden dadurch nicht rückwirkend qualifiziert. Der oben verlinkte Nachweis dokumentiert Übernahme und Prüfung über den Repository-Start. Die drei abschließenden Produktaudits stehen weiterhin aus.

## Umfang und Quellenzuordnung

Die einzelnen sichtbaren Werkzeuge stehen in
[`atlas-tool-catalog.ts`](../../../src/app/atlas-tool-catalog.ts).
Die folgende Zuordnung schließt zusätzliche Einträge der
[`Atlasoberfläche`](../../../src/app/atlas-workspace-layout.ts) und Verbraucher
ein; die Werkzeugleiste allein ist keine vollständige Funktionsliste.
P6 muss jeden Eintrag in der gemeinsamen räumlichen Fläche nachweisen.

| Gruppe | Zu erhaltende Werkzeuge und Abläufe | Fachquelle / Lieferphase |
| --- | --- | --- |
| Navigation und Auswahl | Zoomen am Weltpunkt, Schieben, Rücksprung, Übersicht, Suche, präzise/mehrdeutige Treffer, Griffe, Größenvergleich, Maße und Einheiten, 200 % | HEX-05/08/22, P2/P3; [Darstellungsregeln](../../development/atlas-rendering.md) |
| Land und Daten | Formen, Glätten, Bodenfarbe, Geländeeigenschaften, Hexfüllung, Zurücksetzen, Maßstabswahl, Meeresspiegel | HEX-06/16, P5; [Relief](terrain-relief.md) |
| Bewuchs | Landschaft malen/umgrenzen, Baumreihe, Freihalten, Ausdünnen, Verdichten, Einzelbaum/Felsen, Einzelkorrektur/Auswahl | HEX-18, P5/P6; [Bewuchs](vegetation.md) |
| Gewässer und Trassen | Wasser setzen/entfernen/färben/radieren, Fluss und Straße zeichnen, Geländeprofil und Verlauf korrigieren | HEX-14/15/17, P4/P6; [Trassen](terrain-routes.md), [Landschaftswerkzeuge](landscape-tools.md) |
| Regionen und Namen | Regionenpinsel, Grenzen und Hierarchie, freie/gebundene Namen, Stil/Anker, Orte und Schlüssel | HEX-20, P4; [Kartografie](atlas-cartography.md) |
| Vorlagen und Assets | Referenzbilder importieren/ausrichten, Bibliothek, Symbole, freie Texte, Streuung | HEX-18/19/20, P6; [Landschaftswerkzeuge](landscape-tools.md) |
| Stadt | Anlegen, Viertel/Wasserflächen, Straße/Platz, Haus/Befestigung, Bebauungsvorschlag, Dichte/Größe/Nutzung, Inspektor/Personen/Fraktionen, SVG/JSON | CITY-03, HEX-22, P6; [Stadtplan](../../../ROADMAP-CITIES.md) |
| Räume und Gruppen | Rechteck/freies Polygon/Höhle, Radieren/Löcher, Generieren, Skalieren/Teilen, verknüpfte Keys, Einrichtung, Geschosse | HEX-05/22, P6; [Raumgruppen](room-groups.md) |
| Innenraumobjekte | Wand/Tür/Portal/Treppe, Terrain/Wasser/Pfad/Dach, Objekt/Streuung/Licht/Text/Feature, Bibliothek und Inspektor | P6; [Dungeonumfang](../dungeon/smr04-spatial-coverage.md) |
| Räumliche Zusatzwerkzeuge | Volumen, Graph, Wege/Passagen, Schnitt, Dächer, Triggerfelder, Dungeoninhalt, Binder und Raumsuche | P6; [Dungeonumfang](../dungeon/smr04-spatial-coverage.md) |
| Gemeinsamer Zustand | Werkzeug/Auswahl über Maßstäbe, Undo/Redo, Autosave, offene/unbekannte Bestätigung, Wiederherstellung/Neustart | P2/P5/P7; [Speichergrenze](../../../ARCHITECTURE.md) |
| Verbraucher | Reisevorschau/Partymarker/Eingänge, Wissensfilter, Spielerfenster, Bildexport, Kampagnenarchiv | P6/P7; [Reise](hex-travel.md), [Spieleranzeige](../runtime/player-projection.md) |

HEX-IDs bezeichnen die Lieferpakete in der [Atlas-Roadmap](../../../ROADMAP-HEX-ATLAS.md).
Das bestehende `acceptance.json` verwendet daneben konkrete Fälle, insbesondere
`E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`, `E2E01-HEX-SPACE-STORE-001` und
`E2E01-HEX-SPACE-HOST-001`. Diese werden nicht durch neue Tests automatisch
auf „bestanden“ gesetzt. Ursprüngliche Anforderungen in `docs/scope-sources.json`
bleiben unverändert. P0 muss die Laufzeit- und Verbraucherfälle weiter konkretisieren.

## Reproduzierbare kleine Prüfwelt

[`scene.ts`](../../../tools/atlas-benchmark/scene.ts) beschreibt die Geometrie
unabhängig vom Renderer. Ihre analytische Höhenfläche erzeugt 64 regionale und
16 lokale Höhenkacheln mit denselben Höhenwerten an gemeinsamen Punkten. Küste,
Insel, Gebirge und Tal liegen über positiven und negativen Koordinaten.
Hinzu kommen Straße, Fluss, Wald, zwei Ortsnamen, drei hierarchische Regionen,
36 eingerichtete Stadthäuser, eine mehrgeschossige Dorftaverne und eine Krypta.

[`seed.ts`](../../../tools/atlas-benchmark/seed.ts) schreibt ausschließlich über
den kanonischen Store. Geometrie, Rezepte und ihre SHA-256 sind reproduzierbar;
vom Store vergebene Kampagnen-/Stadt-/Gruppenkennungen stehen im Manifest.
Datenbankbytes sind wegen dieser Kennungen keine Determinismusbehauptung.
Der Erzeuger verlangt ein neues Verzeichnis und überschreibt keine Kampagne.

```sh
node build.mjs --test
node --test tests/atlas-benchmark.test.mjs
node tools/atlas-benchmark/create.mjs "$HOME/.cache/saltmarcher/atlas-pruefwelt-v1"
npm run build:desktop
python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 300s node tools/atlas-benchmark/native.mjs "$HOME/.cache/saltmarcher/atlas-pruefwelt-v1"
```

Die [Regression](../../../tests/atlas-benchmark.test.mjs) prüft Wasser/Land/Gebirge,
gleiche Höhen an groben/feinen Stützpunkten, Regionseltern, eingerichtete Geschosse,
Raumbearbeitung/Undo und unveränderte Kennungen/Geometrie nach frischem Store.
Die native Probe kopiert den Bestand in ein eigenes aufbewahrtes Profil, öffnet
1920 × 1080 Inhalt, zeigt die Übersicht und zoomt mit echten Wheel-Eingaben zur
Taverne. Sie sichert Viewports, Screenshots, Rendererfehler und Prozessende.
Region-ready-Zeiten und rAF-Abstände sind ausdrücklich keine Messung des ersten
veränderten Terrainpixels oder der Compositorpräsentation. Fremde Hostlast und
OS-Caches sind unkontrolliert. Kein schmaler Probelauf belegt bereits 60 FPS.

## Separater Speicherbefund: Hexzellen-Lookup

Der kanonische Zellwriter sucht für jede Zelle nach Kampagne, Karte, Stufe, q und r in `sourceCell`. Ein partieller SQLite-Ausdrucksindex aus `atlas-source-cell.ts`, aufgerufen von `installLandscape`, deckt diese vollständige Suche ab und wird beim Öffnen auch für bestehende Daten aufgebaut. Die [Regression](../../../tests/atlas-source-cell-index.test.mjs) prüft den tatsächlichen Queryplan sowie Aktualisieren ohne ID-Wechsel, Löschen und Wiederöffnen. Lokal bestanden; dies ist kein Leistungsnachweis der vollständigen 100.000-Hex-Welt und keine Voraussetzung für den Kameraanschluss.

## Offene P0-Arbeit

- Große Variante: 40.000 × 20.000 km, 100.000 Hexes, 5.000 Orte,
  50 Detailbereiche, Stadt mit 5.000 Gebäuden, Dungeon mit über 4.000 Entitäten,
  Volumenfall mit 100.000 Zellen. `buildings(5000)` allein ist keine solche Welt.
- Prüfwelt visuell auf fachliche Plausibilität prüfen: insbesondere Flusshöhen,
  Küstenanschluss und Platzierung von Wegen/Gebäuden; analytische Höhen sind
  noch kein Beleg für natürliche Gestaltung.
- Native Ausgangsmessungen mit den vollständigen Gesten, Pinseländerung und
  Wandänderung/Undo; 30 Minuten Ressourcenprüfung sowie tatsächliche Pixelreaktion.
- Bestehende Testdateien inhaltlich den vollständigen Verbraucherfällen zuordnen.
- P1 verbessert den vorhandenen Atlas anhand dieser Bestände und Abläufe. Große Fälle entstehen begleitend zu den jeweiligen Produktphasen; sie blockieren den frühen Kameraanschluss nicht.

Der Ausdrucksindex und sein Lookup prüfen `json_valid` innerhalb von `CASE`, bevor sie Quellfelder lesen. So bleibt beschädigtes JSON für Diagnosen erhalten und blockiert keine gesunden Kampagnen beim Öffnen. Der frühere ungeschützte Index wird gezielt ersetzt; Quellen werden dabei nicht geändert. Die Indexregression umfasst beschädigte Datensätze und dieses Upgrade.
