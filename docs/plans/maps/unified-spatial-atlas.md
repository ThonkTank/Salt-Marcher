# Atlas: gemeinsamer Darstellungspfad

## Ziel

Ein durchgehend bearbeitbarer Atlas verbindet Welt, Städte, Gebäude und Räume.
Navigation, Auswahl, Bearbeitung, Reise, Spieleranzeige und Export verwenden
konsistente Daten. Die vollständigen fachlichen Anforderungen bleiben über
[Produktumfang](../../SCOPE.md), [Quellenregister](../../scope-sources.json) und
[Atlasfunktionen](../../../ROADMAP-HEX-ATLAS.md) gebunden.

Der Nutzerauftrag vom 24.10.2026 ersetzt die frühere verbindliche M0–M8-Reihenfolge
und die Pflicht, alle damals ausgewählten technischen Ansätze zu verbauen.
Technik besitzt keinen Bestandsschutz. Vorhandene Testbestände dürfen neu erzeugt
werden; produktive Nutzerdaten bestehen nicht. Historische Arbeitsberichte gehören
in die Git-Historie, nicht in den aktuellen Arbeitsplan.

## Aktueller Arbeitsstand

Der Atlas verwendet einen gemeinsamen metrischen deck.gl-Pfad für Gelände,
Zeichnung, Gebäude, Räume, Beschriftung, Auswahl und Ausgabe. Spielerinhalte
verwenden dieselben Zeichenbausteine mit einer getrennten öffentlichen Quelle.
Die frühere Three-Szene, ihr Renderer-Worker und die Rust/WASM-Reduktion entfallen.
Three bleibt für CPU-Mathematik und Triangulation erhalten.

Regionen besitzen Quellenstand und Nachladung, die Ausgabe ihren Auftrag,
die Reise ihren Arbeitszustand. Workeraufträge sind typisiert; Terrain, Material
und Geometrie teilen die begrenzte Cachemechanik. Quellenwechsel und Abbruch
entwerten alte Leseantworten, ohne Schreibaufträge zu wiederholen.

Historische Atlasberichte und ersetzte Prototypen liegen in der Git-Historie.
Die erhaltenen Anforderungen und Quellenbindungen bleiben maßgeblich.
Der [technische Einstieg](../../development/atlas-rendering.md) nennt die
Produktionsmodule und ausführbaren Prüfwege.

## Regressionsziele

Dieselben Nutzerabläufe bestehen vor und nach dem Umbau: Landschaft bearbeiten,
Straßen/Flüsse und Bewuchs anlegen, Regionen beschriften, Gebäude und Räume ändern,
Geschosse wechseln, auswählen, suchen, reisen, rückgängig machen, ausgeben und
frisch wiederöffnen. Öffentliche Ausgaben enthalten keine GM-Daten.

Kleine Waldstreifen, Inseln, Löcher und Küsten bleiben über Maßstäbe sichtbar;
Kachelwechsel erzeugen keine Löcher oder doppelten Eltern-/Kindflächen. Normale
und geneigte Ansichten erhalten maßhaltige Geometrie und richtige Verdeckung.
Abbruch, Quellenwechsel, GPU-Verlust und ungeklärte Schreibantworten sind geprüft.

Native Abläufe bei 100 % und 200 % Skalierung sowie große Mischwelt werden mit der
Ausgangsbasis verglichen. Integration verlangt die grüne exakte Candidate-SHA;
Releasepflicht und Paketprüfung bleiben unverändert.

## Weitere Produktarbeit

Noch nicht implementierte Werkzeuge und vollständige Vergleichs-/Zielgeräteabnahmen
bleiben fachliche Aufgaben. Der technische Umstieg erklärt sie nicht für erledigt.
Es werden keine weiteren Bibliotheken, Worker oder Zwischenspeicher vorsorglich
verpflichtend gemacht.

[Bedienung](../../ATLAS.md) · [Technischer Einstieg](../../development/atlas-rendering.md)

## Funktionsumfang

| Gruppe | Zu erhaltende Werkzeuge und Abläufe | Fachquelle |
| --- | --- | --- |
| Navigation und Auswahl | Zoomen am Weltpunkt, Schieben, Rücksprung, Übersicht, Suche, präzise/mehrdeutige Treffer, Griffe, Größenvergleich, Maße und Einheiten, 200 % | HEX-05/08/22, [Darstellungsregeln](../../development/atlas-rendering.md) |
| Land und Daten | Formen, Glätten, Bodenfarbe, Geländeeigenschaften, Hexfüllung, Zurücksetzen, Maßstabswahl, Meeresspiegel | HEX-06/16, [Relief](terrain-relief.md) |
| Bewuchs | Landschaft malen/umgrenzen, Baumreihe, Freihalten, Ausdünnen, Verdichten, Einzelbaum/Felsen, Einzelkorrektur/Auswahl | HEX-18, [Bewuchs](vegetation.md) |
| Gewässer und Trassen | Wasser setzen/entfernen/färben/radieren, Fluss und Straße zeichnen, Geländeprofil und Verlauf korrigieren | HEX-14/15/17, [Trassen](terrain-routes.md), [Landschaftswerkzeuge](landscape-tools.md) |
| Regionen und Namen | Regionenpinsel, Grenzen und Hierarchie, freie/gebundene Namen, Stil/Anker, Orte und Schlüssel | HEX-20, [Kartografie](atlas-cartography.md) |
| Vorlagen und Assets | Referenzbilder importieren/ausrichten, Bibliothek, Symbole, freie Texte, Streuung | HEX-18/19/20, [Landschaftswerkzeuge](landscape-tools.md) |
| Stadt | Anlegen, Viertel/Wasserflächen, Straße/Platz, Haus/Befestigung, Bebauungsvorschlag, Dichte/Größe/Nutzung, Inspektor/Personen/Fraktionen, SVG/JSON | CITY-03, HEX-22, [Stadtplan](../../../ROADMAP-CITIES.md) |
| Räume und Gruppen | Rechteck/freies Polygon/Höhle, Radieren/Löcher, Generieren, Skalieren/Teilen, verknüpfte Keys, Einrichtung, Geschosse | HEX-05/22, [Raumgruppen](room-groups.md) |
| Innenraumobjekte | Wand/Tür/Portal/Treppe, Terrain/Wasser/Pfad/Dach, Objekt/Streuung/Licht/Text/Feature, Bibliothek und Inspektor | [Dungeonumfang](../dungeon/smr04-spatial-coverage.md) |
| Räumliche Zusatzwerkzeuge | Volumen, Graph, Wege/Passagen, Schnitt, Dächer, Triggerfelder, Dungeoninhalt, Binder und Raumsuche | [Dungeonumfang](../dungeon/smr04-spatial-coverage.md) |
| Gemeinsamer Zustand | Werkzeug/Auswahl über Maßstäbe, Undo/Redo, Autosave, offene/unbekannte Bestätigung, Wiederherstellung/Neustart | [Speichergrenze](../../../ARCHITECTURE.md) |
| Verbraucher | Reisevorschau/Partymarker/Eingänge, Wissensfilter, Spielerfenster, Bildexport, Kampagnenarchiv | [Reise](hex-travel.md), [Spieleranzeige](../runtime/player-projection.md) |


Die reproduzierbaren Prüfwelt-Erzeuger stehen in `tools/atlas-benchmark/`.
Die große Mischwelt liegt unter `tests/fixtures/atlas/mixed-world.sqlite.gz`.
