# Begrenzte SQL-Vorbereitung beim Landschaftsschreiben

21.10.2026, Ausgangsstand `bb9f2d091` / 0.182.0, normaler Atlas.

`putLandscape` bereitete für jede Zeile dieselben Abfragen für Vorzustand,
Reihenfolge, Höhenadresse und Upsert neu vor. Die nativen SQLite-Programme
belegen erheblich mehr Speicher als ihre kleinen JavaScript-Wrapper. Ein großer
Schreibauftrag erzeugte dadurch viele Programme, bevor die Garbage Collection
sie freigab. Die vorhandenen Datenbankindizes waren bereits wirksam;
`EXPLAIN QUERY PLAN` bestätigte die Indizes für Reihenfolge und Höhenadresse.

Der Writer hält jetzt genau vier vorbereitete Programme je Verbindung in einer
WeakMap. Er speichert keine Abfrageergebnisse. Konflikte, Reihenfolge,
Transaktionen, Rollback und Höhenadressprüfung verwenden weiter dieselben SQL-
Abfragen mit aktuellen Parametern. Andere Verbindungen besitzen eigene Programme.

## Isolierter Schreibversuch

Je ein frischer Node-Prozess mit 5.000 Geländezuordnungen, anschließend einem
eingerichteten Gebäude und kleinen Detailbereichen. Explizite Garbage Collection
vor der Messung und nach dem Aufbau; während der Schreibschleife keine erzwungene
Sammlung. [Vorher](before.json), [nachher](after.json).

| Messwert | Vorher | Nachher |
| --- | ---: | ---: |
| Transaktion der 5.000 Geländezuordnungen | 2.636 ms | 542 ms |
| RSS vor dem Aufbau | 100,0 MB | 98,1 MB |
| RSS nach dem Aufbau | 409,9 MB | 131,8 MB |
| RSS nach expliziter Sammlung | 409,3 MB | 131,2 MB |

Dezimale MB; RSS sind Momentaufnahmen, kein gemessener Spitzenwert. Dieser
Versuch belegt weder Bildintervalle noch Eingabe-bis-Pixel-Latenz, ein
30-Minuten-Speicherplateau oder die Zielhardware des Nutzers.
Reproduzierbarer aktueller Versuch:
`node --expose-gc tools/measure-landscape-writes.mjs`.

Die neue Regression scheiterte vorher an 200 Vorbereitungen derselben Abfrage
für 200 Änderungen. Sie prüft nun die begrenzte Vorbereitung sowie Reihenfolge,
Revisionen, Rollback, Konflikte, zweite Verbindung und doppelte Höhenadressen.
43 betroffene Tests einschließlich Live-History und Terrain-Worker bestanden;
beide Typprüfungen, Desktop-Build und Repositoryprüfung bestanden.

## Gemischte Prüfwelt und Grenzen

`WORLD_MIXED=1 WORLD_LARGE=1 WORLD_POPULATED=1` erweitert die normale
Welt-Navigationsprobe um 100.000 Hex-Geländezuordnungen mit echten Quellschlüsseln,
5.000 eingerichtete unabhängige Raumgruppen, 50 verteilte Detailbereiche und einen
Dungeon mit 4.001 Räumen. Die vorhandenen 5.000 Ortsmarker, breiten Höhenfelder,
Wälder und Straßen bleiben enthalten. Es entstehen keine Stadtdokumente.
Wiederöffnung und gezieltes Lesen der Innenräume sind zusätzlich in einer
kleinen Regression geprüft.

Die Geländezuordnungen sind reine Eigenschaften über einem unabhängig
geformten Höhenfeld. Das ist ausdrücklich **kein Nachweis für 100.000 separate
feine Reliefbearbeitungen**. Die erste Vorbereitung über den alten Hexwriter
formte unbeabsichtigt pro Hex neue Höhenkacheln und wurde vor dem nativen Start
abgebrochen. Auch der erste Eigenschaftenlauf wurde wegen stark wachsendem
Speicher vor dem App-Start beendet. Diese Läufe lieferten den Anlass zur
Writerdiagnose und zählen nicht als bestandene native Proben.

Die gemischte Probe ersetzt weder den visuellen Autorenweg vom Kontinent zum
Gebäude noch die übrigen Leistungs- und Gestaltungskriterien der Roadmap.

## Öffnung der großen Kampagne

Mit den wiederverwendeten SQL-Programmen wurde der vollständige
[Bestand](mixed-inventory.json) aufgebaut: 15.701 Räume, 48.670 Zeichenelemente,
5.051 Orte mit Dokumenten, 5.000 zusätzliche Kartenmarker und 1.028 Höhenkacheln.
Die Hex-Transaktion benötigte 17,65 s, die Gebäudeerzeugung 35,06 s. Danach blieb
die echte App über 15 s auf [„Arbeitsfläche wird geladen“](opening-before.png);
die [Probe scheiterte](opening-before-failure.json) vor der Navigationsmessung.
Der Notabschluss wurde nicht als normaler nativer Abschluss gewertet;
Prozess 3185449 war anschließend verschwunden.

Eine gesonderte [Diagnose am kopierten Bestand](opening-profile.json) beobachtete
die Öffnung länger und zeichnete CPU-Profile auf. Die Arbeitsfläche wurde nach
19,45 s freigegeben, während die Terrainanzeige weiter lud. Hauptprozess und
Renderer waren dabei überwiegend inaktiv. Prozess 3186525 schloss normal mit
Code 0 und verschwand; keine Rendererfehler. Diese Profilprobe ist keine
Bildlatenzmessung. Der Host hatte bereits belegten Swap und begrenzten freien
Speicher; [Ausgangszustand](host-memory.json). Absolute Laufzeiten sind deshalb
keine Qualifikation des Pentium 7505.

`renderer.reopenView` wartete auf `CampaignAtlasWorkbench.open`, damit auf den
ersten Regionenauftrag. Die gesamte Arbeitsfläche blieb dadurch `inert`.
Der Atlas startet nun beim Wiederöffnen im Hintergrund. Sein bestehender
Lade-/Fehlerzustand und die Sperre für Autorentreffer bleiben maßgeblich.
Eine späte Fehlermeldung darf nur die noch aktuelle Aktivierung und Ansicht
erreichen. Die native gemischte Probe prüft zusätzlich die Kamera vor Abschluss
des ersten Kartenauftrags und führt Öffnungs- und Terrainbereitschaftszeit getrennt.

Die Regression führt den tatsächlichen `reopenView`-Koordinator mit verzögerten
Antworten aus. Vorher blieb die Öffnung unerledigt, jetzt ist sie unabhängig vom
Regionenauftrag. Weitere Fälle prüfen späte Fehler, Kampagnen-/Ansichtswechsel
und unverändertes Warten bei anderen Arbeitsbereichen. Insgesamt 101 betroffene
Tests bestanden (43 Writer-/Terrainfälle, 53 bisherige Einstieg-/Navigationsfälle,
fünf neue Koordinatorfälle).

## Ergebnis der gemischten nativen Probe

[Messung und Fehler](mixed-world.json), [sichtbarer Stand nach dem Pinselzug](mixed-world-brush.png):

| Beobachtung | Ergebnis |
| --- | ---: |
| Arbeitsfläche freigegeben | 1.070 ms |
| Zoom während erster Regionenauftrag noch lädt | Kamerawert geändert; Canvas noch leer |
| Erste Terrainbereitschaft | 21.894 ms |
| Navigation RAF p95 / p99 | 24,6 / 116,6 ms |
| Sculpting RAF p95 / p99 | 39,1 / 41,5 ms |
| Erste gemessene Änderung in der Pinselinnenfläche | 205,6 ms |

Kamerawerte und Terrainbereitschaft sind keine Compositor-Pixelmessungen.
Die Pinselwerte verwenden asynchrones GPU-Auslesen und enthalten Messaufwand.
Keine parallelen eigenen Builds während dieser Probe. Die neue Freigabe ist
sichtbar wirksam, aber die erste nutzbare Weltübersicht verfehlt weiterhin das
Zwei-Sekunden-Ziel.

**Die Probe ist nicht bestanden:** Nach Loslassen und einem Zoomversuch wartete
die Zustandsabfrage über 15 s auf die Oberfläche. Deshalb wurden vollständige
Verfeinerung, nachgelagerte GPU-Gegenproben und normaler Abschluss hier nicht
erreicht. Prozess 3190131 wurde im Fehlerpfad geschlossen und war anschließend
verschwunden. Keine gemeldeten Rendererfehler ersetzen diesen fehlenden
Ablaufnachweis. Die Pause nach dem Pinselzug bleibt ein konkreter Folgefehler.

Die bestehende [native Pinselbedienprobe](brush-ux.json) bestand alle neun Gruppen:
schmales Fenster/200 %, Vorlagen und Radius, aktiver Zug mit Undo/Redo, weitere
Pinselfamilien, Shift-Rad, Neigung, Reliefstil, PNG und frische Wiederöffnung.
Prozesse 3192313 und 3192939 endeten normal mit Code 0 und verschwanden;
keine Rendererfehler. Diese kleinere Bedienprobe hebt den Fehler der gemischten
Welt nicht auf.

Der [Autorenweg](authoring.json) bestand ebenfalls alle acht Schritte vom ersten
Kontinent über Relief, Wald, ein unabhängiges Königreich und Straßen/Gebäude bis
zum benannten Innenraum und dessen frischer Wiederöffnung. Prozesse 3193502 und
3194577 endeten normal mit Code 0 und sind verschwunden; keine Rendererfehler.
Die Bilder von [Kontinenten](authoring-continents.png) und
[Königreich](authoring-kingdom.png) bleiben gestalterisch unzureichend: breite
glatte Küstenformen, kaum erkennbares kontinentales Relief und flächiger Wald.
Der bestandene Funktionsablauf ist keine Abnahme einer ansprechenden Fantasykarte.
