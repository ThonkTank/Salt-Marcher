# Atlas: gemeinsamer Darstellungspfad

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Ziel

Ein durchgehend bearbeitbarer Atlas verbindet Welt, Städte, Gebäude und Räume.
Navigation, Auswahl, Bearbeitung, Reise, Spieleranzeige und Export verwenden
konsistente Daten. Die vollständigen fachlichen Anforderungen bleiben über
[Produktumfang](../../project/requirements/scope.md), [Quellenregister](../../project/requirements/sources.json) und
[Atlasfunktionen](../requirements/atlas.md) gebunden.

Der Nutzerauftrag vom 24.10.2026 ersetzt die frühere verbindliche M0–M8-Reihenfolge
und die Pflicht, alle damals ausgewählten technischen Ansätze zu verbauen.
Technik besitzt keinen Bestandsschutz. Vorhandene Testbestände dürfen neu erzeugt
werden; produktive Nutzerdaten bestehen nicht. Historische Arbeitsberichte gehören
in die Git-Historie, nicht in den aktuellen Arbeitsplan.

## Aktueller Arbeitsstand

Für die nächste Lieferung gilt der am 25.10.2026 eingegrenzte
[Terrain-/Wasserfokus](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser).
Andere Atlasfunktionen sind vorerst zurückgestellt. Umfang und Istbefund sind
geklärt; der [Terrain-/Wasserplan](terrain-water/plan.md) führt die konkrete
Reihenfolge und den Stand seiner unabhängigen Planprüfung. Produktabnahme bleibt offen.

Die [Performance-Roadmap A0–A7](performance-roadmap.md) beschreibt den breiteren
Gesamtplan für Architekturvergleich, Umsetzung und Messziele. Für den nächsten
Lieferumfang und dessen Reihenfolge ist der Terrain-/Wasserplan maßgeblich.
Alle Meilensteine sind offen; die Roadmap ist keine Umsetzungs- oder Abnahmebehauptung.

Der gemeinsame metrische deck.gl-Pfad zeichnet Weltgeometrie, Gebäude, Räume
und Ausgabe. Canvas bleibt für Bedienüberlagerungen zuständig. Kamera und
Eingabesteuerung benötigen keine zusätzliche Rendererschicht.

`CampaignAtlasWorkbench` verbindet Sitzungen und Oberfläche. `AtlasRegions`
besitzt Anfragegeneration, bestätigte Projektion und Schreibrevisionen;
`AtlasJourney` besitzt Vorschau, Reisebereitschaft und Wiedergabe. Autoren-Gesten
besitzen gemeinsame Entwurfs-, Abbruch- und Kontextwechselregeln in `AtlasAuthor`.
Pfadvorschau und Commit teilen `atlasPathPreview`; die Darstellung schreibt keine
Autoren-Geometrie. `AtlasOutput` besitzt Bereichswahl und Exportauftrag.

Der [technische Einstieg](rendering.md) erklärt Datenfluss und Prüfwege.
Das [Datenformat](../../project/contract/data-format.md) gilt für Datenbank,
Kampagnenarchive und Build-Metadaten. Frühere Testbestände werden nicht migriert.

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

[Bedienung](../guide.md) · [Technischer Einstieg](rendering.md)

## Funktionsumfang

| Gruppe | Zu erhaltende Werkzeuge und Abläufe | Fachquelle |
| --- | --- | --- |
| Navigation und Auswahl | Zoomen am Weltpunkt, Schieben, Rücksprung, Übersicht, Suche, präzise/mehrdeutige Treffer, Griffe, Größenvergleich, Maße und Einheiten, 200 % | HEX-05/08/22, [Darstellungsregeln](rendering.md) |
| Land und Daten | Formen, Glätten, Bodenfarbe, Geländeeigenschaften, Hexfüllung, Zurücksetzen, Maßstabswahl, Meeresspiegel | HEX-06/16, [Relief](../requirements/terrain-relief.md) |
| Bewuchs | Landschaft malen/umgrenzen, Baumreihe, Freihalten, Ausdünnen, Verdichten, Einzelbaum/Felsen, Einzelkorrektur/Auswahl | HEX-18, [Bewuchs](../requirements/vegetation.md) |
| Gewässer und Trassen | Wasser setzen/entfernen/färben/radieren, Fluss und Straße zeichnen, Geländeprofil und Verlauf korrigieren | HEX-14/15/17, [Trassen](../contract/terrain-routes.md), [Landschaftswerkzeuge](../contract/landscape-tools.md) |
| Regionen und Namen | Regionenpinsel, Grenzen und Hierarchie, freie/gebundene Namen, Stil/Anker, Orte und Schlüssel | HEX-20, [Kartografie](../contract/atlas-cartography.md) |
| Vorlagen und Assets | Referenzbilder importieren/ausrichten, Bibliothek, Symbole, freie Texte, Streuung | HEX-18/19/20, [Landschaftswerkzeuge](../contract/landscape-tools.md) |
| Stadt | Anlegen, Viertel/Wasserflächen, Straße/Platz, Haus/Befestigung, Bebauungsvorschlag, Dichte/Größe/Nutzung, Inspektor/Personen/Fraktionen, SVG/JSON | CITY-03, HEX-22, [Stadtplan](../../city/requirements/city.md) |
| Räume und Gruppen | Rechteck/freies Polygon/Höhle, Radieren/Löcher, Generieren, Skalieren/Teilen, verknüpfte Keys, Einrichtung, Geschosse | HEX-05/22, [Raumgruppen](../contract/room-groups.md) |
| Innenraumobjekte | Wand/Tür/Portal/Treppe, Terrain/Wasser/Pfad/Dach, Objekt/Streuung/Licht/Text/Feature, Bibliothek und Inspektor | [Dungeonumfang](../../dungeon/requirements/smr04-spatial-coverage.md) |
| Räumliche Zusatzwerkzeuge | Volumen, Graph, Wege/Passagen, Schnitt, Dächer, Triggerfelder, Dungeoninhalt, Binder und Raumsuche | [Dungeonumfang](../../dungeon/requirements/smr04-spatial-coverage.md) |
| Gemeinsamer Zustand | Werkzeug/Auswahl über Maßstäbe, Undo/Redo, Autosave, offene/unbekannte Bestätigung, Wiederherstellung/Neustart | [Speichergrenze](../../project/architecture/overview.md) |
| Verbraucher | Reisevorschau/Partymarker/Eingänge, Wissensfilter, Spielerfenster, Bildexport, Kampagnenarchiv | [Reise](../contract/hex-travel.md), [Spieleranzeige](../../runtime/contract/player-projection.md) |


Die reproduzierbaren Prüfwelt-Erzeuger stehen in `tools/atlas-benchmark/`.
Die große Mischwelt liegt unter `tests/fixtures/atlas/mixed-world.sqlite.gz`.
