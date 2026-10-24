# Komplexe Bewuchsflächen und Legacy-Pigment

M2-Zwischenschritt auf `b1e7390b`, 24.10.2026.
[Aktuelle Roadmap](../../plans/maps/unified-spatial-atlas.md).
Die Änderungen betreffen isolierte Prototypen. Produktdarstellung, kanonische
Autorendaten und persistentes Kachelformat sind noch nicht umgestellt.

## Implementiert und nachgearbeitet

[general-feather.mjs](../../../tools/atlas-prototypes/general-feather.mjs)
vereinigt die Autorenpolygone vor der Randmessung. Nur die verbleibenden Außen-
und Lochkanten gehen in einen hierarchischen Segmentindex ein. Überlappende und
aneinanderliegende Teile erzeugen deshalb keine künstlichen Innenränder; eine
gefüllte Teilfläche entfernt auch den entsprechenden bisherigen Lochrand.
Konvexe Komponenten bis 64 Eckpunkte behalten die direkte Polynomintegration.
Andere Komponenten verwenden den wirklichen Segmentabstand und adaptive
Flächenintegration mit konservativer Fehlerschranke.

Im [Quellenadapter](../../../tools/atlas-prototypes/material-sources.mjs) bleibt
der Autorenradius in Weltmetern maßgeblich. Wasser beschneidet die sichtbare
Abdeckung nach der Randbestimmung und erzeugt selbst keinen neuen Autorenrand.
Bei konkaven Ecken ist der Abstand nicht überall linear: Der Adapter lässt den
Polynomgrad deshalb unbekannt, statt fälschlich kubische Integration freizugeben.
Für Bodenfarbe gilt die Schranke 1,17/Radius, für Wald höchstens 1/Radius;
überlagerte Quellen addieren diese Schranken konservativ.

Die unabhängige Prüfung fand ein numerisches Risiko im ersten Segmentindex:
Quadrierte Radien können bei endlichen Eingaben über- oder unterlaufen. Die
Nacharbeit verwendet relative, normierte Koordinaten und robuste Distanzen ohne
Radiusquadrat. Nicht darstellbare relative Größen werden ausdrücklich abgewiesen.
4096 Eingabeeckpunkte, 16384 Vereinigungseckpunkte und 1024 Komponenten begrenzen
die geometrische Komplexität. Die Vereinigung bleibt synchron; diese Grenzen
sind keine harte Laufzeitgarantie und noch keine vollständige Weltdatenfreigabe.

Legacy-Pigment verwendet den injizierten echten
[colorParts-Helfer](../../../src/app/landscape-brush.ts), also seine ursprünglichen
24-Punkt-Abdrücke, sechs weichen Bänder und deterministische Texturkontur. Die
Abdeckung wird innerhalb eines Datensatzes gesammelt, bevor dessen Deckkraft
einmal angewandt wird. Ein zuerst eingebautes Vorrunden jeder Banddeckkraft war
falsch: Die Referenz rundet erst die zusammengesetzte Abdeckung je Teil.
Eine unterscheidende Gegenprobe liefert korrekt 156/255 statt 155/255.
Der Zwischenkanal wird nach Bewuchs zurückgesetzt. Pigment bleibt getrennt von
Boden und Wald; Version-2-Radierung bleibt auf Pigment beschränkt.

## Nachweise

[48 bestandene Tests](tests-48.log.gz): 16 Flächen-, acht konvexe Rand-,
15 Quellenadapter-, sechs allgemeine Rand- und drei komplexe Quellenprüfungen.
Die neuen Prüfungen liegen in
[allgemeinen Randtests](../../../tests/atlas-material-general-feather.test.mjs),
[komplexen Quellenprüfungen](../../../tests/atlas-material-complex-source.test.mjs)
und den erweiterten
[Adaptertests](../../../tests/atlas-material-source-adapter.test.mjs).

Geprüft werden unter anderem L-Fläche, Loch, überlappende und berührende Teile,
teilweise und vollständig gefüllte Löcher, explizite Komplexitätsgrenzen,
Weltmaßstäbe von 10^-6 bis 10^6, Translationen bis 10^9 und sehr kleine/große
Radien. Ein Quadrat mit quadratischem Loch hat ein unabhängiges analytisches
Waldintegral; dessen adaptive Fehlergrenze und tatsächlicher Fehler werden
getrennt geprüft. Legacy-Füllung sowie runde, weiche und texturierte Abdrücke
werden an geometrisch inneren Pixeln gegen den tatsächlichen Rasterizer
verglichen. Wasserziel, leerer Strich, einmalige Gesamtdeckkraft und
Teilpixelabdeckung sind zusätzlich geprüft. Finale Float-Komposition und
8-Bit-Referenz sind nicht für beliebig viele übereinanderliegende Datensätze
als byteidentisch bewiesen; die konkreten Farbfixtures erlauben 1,1 Byte.

## Entscheidende Restkostenprobe

[Reproduzierbares Werkzeug](../../../tools/measure-atlas-material-complex.mjs),
[Rohdaten einschließlich Quellhashes](complex-cost.json.gz):
Ein 6×6-m-Quadrat mit mittigem 2×2-m-Loch, Autorenradius 0,5 m, Dichte 0,4,
eine Ausgabezelle. Das analytische normierte Waldmittel beträgt 0,33432686035.

| Angeforderte Toleranz | Ergebnis |
| --- | --- |
| 0,08 | 0,33432566997; tatsächlicher Fehler 0,00000119; erklärte Schranke 0,05119; 131073 Auswertungen und 305896 Arbeitsschritte |
| 0,02 | Arbeitsbudget von 2000000 überschritten; kein Ergebnis veröffentlicht |
| 1/255 | Arbeitsbudget von 2000000 überschritten; kein Ergebnis veröffentlicht |

Dies ist eine isolierte Einzelprobe, weder ein 256²-Kachelbenchmark noch eine
native Atlas-Latenz. Die kleine tatsächliche Abweichung bei grober Toleranz
rechtfertigt keine stillschweigende Lockerung der Fehlergarantie.
Die gleichmäßige Unterteilung bleibt der nachgewiesene Engpass: Auch gesättigte
Innenbereiche tragen die globale Rand-Schranke. Nächster Schritt ist eine
konservative lokale Unterscheidung von konstanten Innenflächen und variierenden
Rändern. Der Flächenansatz bleibt bestehen; der gemessene Engpass rechtfertigt
keinen Wechsel zurück zu einer punktabgetasteten Abdeckungsmaske.

Version-2-Pinselzüge mit Kreis-/Texturgrenzen, Feld-/Quellenseitenanschluss,
Produktkacheln, volle Weltlast und native Abnahme bleiben offen. M2 ist damit
nicht abgeschlossen. Kein neuer Desktopbuild, keine Integration und kein
nativer Produktgewinn werden behauptet. Die tatsächlichen Testdateien wurden
im Capability-Katalog mit `--geprueft` ergänzt; das qualifiziert nicht dessen
gesamte Save-/Undo-/Restart-Kette.

[Repositoryprüfung](check-repo.log.gz), Syntaxprüfung und `git diff --check`
ergänzen die gezielten Tests.
