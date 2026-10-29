# Atlas: gemeinsamer Darstellungspfad

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-29 (Architektur und Ausführung getrennt; Fachabnahme separat)
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

Dieses Dokument besitzt die dauerhafte Atlasarchitektur. Der
[Ausführungsauftrag](../delivery/terrain-water-execution.md) besitzt die bestätigte
Terrain-/Wasserplanung; die [fachliche Lieferpriorität](../../project/delivery/roadmap.md#nächste-begrenzte-lieferung-terrain-und-meer)
steht in der Produktroadmap.
[rendering.md](rendering.md) besitzt Codeeinstiege und Prüfwege,
[guide.md](../guide.md) die aktuelle Bedienung. Fachverträge besitzen Wirkung und
Datenregeln. Die [Atlasanforderungen](../requirements/atlas.md) erhalten den
vollständigen Zielumfang, ohne einen zweiten technischen Arbeitsplan zu führen.

Für die nächste Lieferung gilt der bestätigte
[Terrain-/Meerfokus](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser).
Andere Atlasfunktionen bleiben erhalten und vorerst zurückgestellt. Technische
Entscheidungen werden am aktuellen Code und an diesem Nutzerablauf geprüft.
Die aufgehobene M0–M8-Folge ist keine verbindliche Ausführungsreihenfolge; die
Abhängigkeiten des bestätigten Terrain-/Wasserauftrags bleiben verbindlich.

Der gemeinsame metrische deck.gl-Pfad zeichnet Weltgeometrie, Gebäude, Räume
und Ausgabe. Canvas bleibt für Bedienüberlagerungen zuständig. Kamera und
Eingabesteuerung benötigen keine zusätzliche Rendererschicht.

`CampaignAtlasWorkbench` verbindet Sitzungen und koordiniert angenommene Übergänge.
`AtlasTerrainEdits` besitzt Queue, Recovery und die Entscheidung über gehaltene
Terrainzüge; `AtlasAuthor` besitzt fachliche Auswahl, Stadt-/Raumgruppen-/Geschosskontext,
Platzierung und Gesten. Die [Zuständigkeitstabelle und Übergangsreihenfolge](rendering.md#zustandsbesitzer-und-übergänge)
binden Leser, Schreiber und Abmeldung. `AtlasRegions`
besitzt Anfragegeneration, bestätigte Projektion und Schreibrevisionen;
`AtlasJourney` besitzt Vorschau, Reisebereitschaft und Wiedergabe. Autoren-Gesten
besitzen gemeinsame Entwurfs-, Abbruch- und Kontextwechselregeln in `AtlasAuthor`.
Pfadvorschau und Commit teilen `atlasPathPreview`; die Darstellung schreibt keine
Autoren-Geometrie. `AtlasOutput` besitzt Bereichswahl und Exportauftrag.

Der [technische Einstieg](rendering.md) erklärt Datenfluss und Prüfwege.
Das [Datenformat](../../project/contract/data-format.md) gilt für Datenbank,
Kampagnenarchive und Build-Metadaten. Frühere Testbestände werden nicht migriert.

## Dauerhafte Architekturgrenzen

Eine gemeinsame metrische Kamera besitzt Projektion und Auswahlstrahlen für
Welt bis Raum. Kamerabewegung ändert die Transformation, keine Autorendaten.
Kanonische Weltpositionen bleiben doppelt genau; ein naher Ursprung hält lokale
GPU-Puffer präzise. [Geometrie und Auswahl](rendering.md#geometrie-material-und-auswahl)
sowie [quellengültige Bilder und LOD-Übergänge](rendering.md#quellenstand-und-veröffentlichung)
binden Anzeige, Treffer und Bearbeitungsberechtigung an denselben gültigen Stand.

Der Renderer verwendet ausschließlich geprüfte Fähigkeiten der Preload-Brücke;
Main besitzt native Fähigkeiten, der [kanonische Store-Worker](../../project/architecture/canonical-store-worker.md)
SQLite und die Speichergrenze. Darstellung, Cache und Kamera erhalten keine
zusätzliche Schreibautorität. Fachliche Writer und ihre atomaren Grenzen stehen
in der [Speicherzuständigkeit](../../project/architecture/storage-ownership.md).

Abgeschlossene Gesten gehen geordnet an die kanonischen Writer; jede Geste bleibt
ein Historyschritt. Ungeklärte Schreibantworten dürfen keine erneute oder verlorene
Annahme erzeugen. Der [Speicherklärungsvertrag](rendering.md#speicherklärung-im-atlas)
regelt Queue, Receipt, Quellenbindung und Folgezüge; der
[Editor-Lebenszyklus](../../project/architecture/editor-lifecycle.md) bindet Entwurf,
Abbruch und Kontextwechsel. Fachverträge besitzen die jeweilige Undo-/Redo-Wirkung.

## Terrain-/Wasserlieferung: Umsetzungsplan

Der [bestätigte Ausführungsauftrag](../delivery/terrain-water-execution.md)
besitzt P01–P15/M1–M5, Rollen, Modelle, Delegation, Reviewfolge, Zeitrahmen und
Git-Synchronisation. Herkunft, Geltung und historische Zeitbasis sind dort
zusammengeführt; der Umzug startet keine Frist oder pausierte Automation neu.
Nutzerwirkungen bleiben im [Terrainvertrag](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser)
und im [Flussvertrag](../contract/terrain-routes.md#begrenzter-flussabschluss).

Bisherige Abschnittsanker bleiben als Weiterverweise erhalten:

| Bisheriger Einstieg | Zuständiger Abschnitt des Ausführungsauftrags |
| --- | --- |
| <a id="nächster-produktnachweis-und-entscheidung"></a>Produktnachweis und Entscheidung | [Nächster Produktnachweis und Entscheidung](../delivery/terrain-water-execution.md#nächster-produktnachweis-und-entscheidung) |
| <a id="meilensteine-und-zuständigkeit"></a>Meilensteine und Zuständigkeit | [Meilensteine und Zuständigkeit](../delivery/terrain-water-execution.md#meilensteine-und-zuständigkeit) |
| <a id="eingaben-und-schnittstellen"></a>Eingaben und Schnittstellen | [Eingaben und Schnittstellen](../delivery/terrain-water-execution.md#eingaben-und-schnittstellen) |
| <a id="vollständig-zerlegte-pakete"></a>Vollständig zerlegte Pakete | [Vollständig zerlegte Pakete](../delivery/terrain-water-execution.md#vollständig-zerlegte-pakete) |
| <a id="struktur--und-terminplan"></a>Struktur- und Terminplan | [Struktur- und Terminplan](../delivery/terrain-water-execution.md#struktur--und-terminplan) |
| <a id="wiederverwendung-release-und-ablage"></a>Wiederverwendung, Release und Ablage | [Wiederverwendung, Release und Ablage](../delivery/terrain-water-execution.md#wiederverwendung-release-und-ablage) |

## Regressionsziele

Dieselben Nutzerabläufe bestehen vor und nach dem Umbau: Landschaft bearbeiten,
Straßen/Flüsse und Bewuchs anlegen, Regionen beschriften, Gebäude und Räume ändern,
Geschosse wechseln, auswählen, suchen, reisen, rückgängig machen, ausgeben und
frisch wiederöffnen. Öffentliche Ausgaben enthalten keine GM-Daten.

Kleine Waldstreifen, Inseln, Löcher und Küsten bleiben über Maßstäbe sichtbar;
Kachelwechsel erzeugen keine Löcher oder doppelten Eltern-/Kindflächen. Normale
und geneigte Ansichten erhalten maßhaltige Geometrie und richtige Verdeckung.
Abbruch, Quellenwechsel, GPU-Verlust und ungeklärte Schreibantworten sind geprüft.

Native Abläufe bei 100 Prozent Skalierung sowie große Mischwelt werden mit der
Ausgangsbasis verglichen. [Integration und lokale Prüfung](../../../AGENTS.md#delivery)
sowie [Release- und Paketpflichten](../../project/delivery/github-updates.md)
bleiben verbindlich.

## Weitere Produktarbeit

Noch nicht implementierte Werkzeuge und vollständige Vergleichs-/Zielgeräteabnahmen
bleiben fachliche Aufgaben. Der technische Umstieg erklärt sie nicht für erledigt.
Es werden keine weiteren Bibliotheken, Worker oder Zwischenspeicher vorsorglich
verpflichtend gemacht.

[Bedienung](../guide.md) · [Technischer Einstieg](rendering.md)

## Funktionsumfang

| Gruppe | Zu erhaltende Werkzeuge und Abläufe | Fachquelle |
| --- | --- | --- |
| Navigation und Auswahl | Zoomen am Weltpunkt, Schieben, Rücksprung, Übersicht, Suche, präzise/mehrdeutige Treffer, Griffe, Größenvergleich, Maße und Einheiten, 100 % | HEX-05/08/22, [Darstellungsregeln](rendering.md) |
| Land und Daten | Formen, Glätten, Bodenfarbe, Geländeeigenschaften, kontinuierliche Pinselstriche, Zurücksetzen, Maßstabswahl, Meeresspiegel | HEX-06/16, [Relief](../requirements/terrain-relief.md) |
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
