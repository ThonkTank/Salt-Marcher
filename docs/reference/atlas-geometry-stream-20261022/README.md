# Tatsächliche Geometrie beim Zoom, dichte Bereiche einmal lesen

Lokale Änderung auf `7e1c92c2`, 22.10.2026. Betrifft den normalen Atlas,
Bereichsworker und PNG-Ausgabe; keine weitere Kartenfläche. Anschluss an P3/P4
und die weiterhin offene R7-Leistungsqualifikation.

## Verhalten und Ursache

Weltgebundene Raumgruppen wurden bisher bei geringer Bildschirmgröße durch
Kreise und automatisch erzeugte Gruppennamen ersetzt. In der gemischten Welt
entstanden dadurch über 5.000 künstliche Marker. Das widerspricht der Vorgabe,
dass unabhängige Geometrie auf derselben Landschaft liegt und gemalte Gebiete
keine Städte besitzen oder definieren.

Diese Ersatzmarker und Gruppennamen entfallen. Unter zwei Bildpunkten entlang
der längeren Ausdehnung wird eine Raumgruppe ausgeblendet. Darüber bleibt ihre
tatsächliche Geometrie sichtbar. Die Regel gilt für Bereichslesung, die
Hauptfläche und den Export eines noch gehaltenen Detailframes. Ein gewählter
Autorenrahmen bleibt als Metadatum vorhanden; Suche/Fokus bleiben erreichbar.
Raumnamen und explizite gemalte Gebiete sind weiterhin eigene Informationen.

Das Entfernen der Marker legte einen weiteren Engpass offen: Dichte reale
Geometrie wurde für Beschriftungen und Raster zweimal gelesen. Zusätzlich
bereitete jeder Raum dieselben beiden SQL-Abfragen für Stil und Geheimstatus
neu vor. Der Reader hält jetzt nur seinen bereits begrenzten Vektoranfang.
Beim Überschreiten des Budgets rastert er diesen Anfang und danach weitere
Objekte direkt in derselben Malreihenfolge. `AtlasGeometryRaster` besitzt
allein diesen Übergang und das begrenzte Bild. Es gibt keinen zweiten SQL-
Durchlauf und keinen neuen dauerhaften Geometriecache.

Die zwei SQL-Programme für Raumstile werden pro Verbindung wiederverwendet.
Ihre Ergebnisse werden bei jeder Lesung neu ermittelt und validiert. Damit
bleiben geänderte Farben, Geheimstatus, Undo/Redo und beschädigte Nutzdaten
aktuell. Abbruchsignale verlassen auch den Rasterübergang ohne Teilantwort.

## Kontrollierte Vergleiche

[Vier Ausschnitte gegen 7e1c92c2](paired-visibility.json), derselbe lesend
geöffnete synthetische Bestand, Index jeweils vorher aufgebaut:

| Ausschnitt | Vorher | Nachher | Ergebnis |
| --- | ---: | ---: | --- |
| Welt | 1.102 ms | 703 ms | 5.051 Ersatzmarker entfallen |
| Region | 354 ms | 46 ms | 5.001 Ersatzmarker entfallen |
| Gebäude | 313 ms | 314 ms | Vollständige Antwort bytegleich |
| Dungeon-Nähe | 369 ms | 340 ms | Vollständige Antwort bytegleich |

Die Landschaft bleibt in allen vier Ansichten bytegleich. Der neue opt-in-
Prüfmodus im Messwerkzeug prüft die beabsichtigte Sichtbarkeitsänderung explizit;
der normale Vergleich verlangt weiterhin vollständige Gleichheit.

[Getrennter Vergleich des Geometriedurchlaufs](paired-stream.json): Der
Kontrollbuild enthält bereits die Markerentfernung, aber noch zwei Durchläufe
und wiederholtes SQL-Prepare. Dieser lokale Zwischenbuild ist unter
`.build/geometry-only-before-raster.cjs` mit dem im JSON erfassten Hash erhalten;
er ist kein veröffentlichter Versionsstand. Der aktuelle Build liefert für
Welt, zwei mittlere Dungeonansichten und Raumdetail jeweils **bytegleiche
vollständige Antworten einschließlich PNG**. Die beiden Ansichten mit 4.001
Räumen sinken von 3.167/3.382 auf 1.505/1.542 ms.

Eine relevante Grenze bleibt: In einer vorherigen [Übergangsmessung](marker-transition.json)
war der alte einzelne Dungeon-Ersatzmarker bei 47,9 km Sichtbreite mit 937 ms
billiger als die jetzt korrekte echte Geometrie mit 1.476 ms. Bei 9,58 km sank
die reale Darstellung von 3.863 auf 1.590 ms. Die Markerentfernung ist daher
keine Beschleunigung in jeder Zoomstufe. Mittelgroße dichte Geometrie bleibt
zu teuer. Alle Zahlen sind Einzelmessungen des Entwicklungshosts.

## Native Bedienung

[Normaler Such-/Zoom-/Exportablauf](native-geometry.json): private Kampagne,
80-km-Ansicht, eingerichtete Taverne per Raumsuche öffnen, PNG ausgeben und
wieder auf 80 km zoomen. Dieselbe Hauptfläche bleibt bestehen. In der Nähe
erscheinen neun Räume und 36 Einrichtungsobjekte, weit entfernt keine
Raumgruppengeometrie oder automatischen Gruppennamen. Der ausgewählte
Autorenrahmen bleibt erreichbar. Kanonische Raum-, Objekt-, Gruppen- und
Bindungsdaten bleiben unverändert. Prozess 3486976 endet normal und ist weg;
keine Rendererfehler. [Raumsuche](room-search.png), [PNG](building.png),
[ausgewählte Gruppe auf Weltmaßstab](selected-world.png).

Die letzte Aufnahme zeigt weiterhin die Hilfsanzeige des ausgewählten Raums
mit Größenkarte und Griff. Das ist kein automatisch erzeugter Stadtmarker,
aber eine offene Maßstabs-/Bedienfrage der Autorenhilfen. Die einfache
Testtaverne und ihre leere Landschaft sind keine gestalterische Abnahme und
ersetzen nicht den vollständigen Fantasy-Autorenweg.

[Große Welt](native-world.json): derselbe gemischte Ausgangsbestand in einer
privaten Kopie; 2.500-Meilen-Pinsel, Zoom nach Loslassen, zweiter Strich vor
fertiger Feinauflösung, anschließend alle 36 Detailteile.

| Beobachtung | Vorher (7e1) | Nachher |
| --- | ---: | ---: |
| Öffnen bis bearbeitbar | 10,82 s | 10,57 s |
| Erster Strich: Steuerelemente frei | 2,98 s | 1,86 s |
| Erster Strich: tatsächlich wieder bearbeitbar | 4,46 s | 4,14 s |
| Zweiter Strich: tatsächlich wieder bearbeitbar | 2,73 s | 2,85 s |

Die erste aktuelle Bereichslesung dauert 611 ms. Nach dem ersten Strich gibt
es weiterhin mehrere Regionsreads mit insgesamt rund 1,57 s statt einer
Lesung im früheren Lauf; ihre genaue Anforderungsursache ist noch zu klären.
Maximale erfasste Rendererblockade: 405 ms; größter erfasster Frameabstand:
467 ms. Kein Nachweis flüssiger Navigation oder unmittelbarer Bearbeitung.
Der letzte sichtbare/bearbeitbare Stand 13 stimmt mit der [kanonischen,
readonly geprüften Datenbank](persisted.json) überein. Prozess 3487366 endet
normal und ist weg, keine Rendererfehler, keine verworfenen Trace-Einträge.
Alle elf Bundlehashes beider nativen Läufe stimmen mit dem geprüften Build
überein. Die unterschiedliche Zahl bestätigter Zwischenrevisionen ist kein
vergleichbarer Geschwindigkeitswert.

## Prüfungen und offene Lieferung

[193 betroffene Fälle bestanden](tests.json), einschließlich einmaligem Lesen
von 5.000 Räumen, genau zwei SQL-Programmen, aktuellem Stil/Geheimstatus,
Undo/Redo, Rasterlöchern und Malreihenfolge, beschädigten Datensätzen,
Rtree-Fallback, Abbruch während/nach dem Rasterübergang, Auswahl und PNG.
Ein neuer Test verwendete zunächst den alten Drawing-History-Einstieg mit
Atlas-Undo; nach Korrektur auf den tatsächlichen Atlas-Einstieg bestand er.
Beide Typprüfungen und Desktop-Build bestanden. Der Capability-Katalog trägt
die tatsächlichen Testdateien; Links allein sind keine Vollabnahme.

Main/Candidate-CI, Paket und Release sind für diese Änderung noch offen.
Pentium Gold 7505, volle Zielwelt, 30-Minuten-Speicherplateau, p95/p99-Ziele und
die geforderte Gestaltung/Werkzeugvollständigkeit sind weiterhin nicht
qualifiziert. Der Gesamtauftrag bleibt offen.
