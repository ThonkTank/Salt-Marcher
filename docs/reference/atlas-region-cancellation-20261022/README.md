# Überholte Kameraausschnitte abbrechen

Lokale Änderung auf `2c360dcf`, 22.10.2026. Der normale Atlas wartete bei
Kamerabewegungen auf eine bereits laufende Bereichslesung. Auf der großen
synthetischen Welt kostete diese etwa eine Sekunde; danach begann die nächste
Lesung für die inzwischen veränderte Kamera. Die frühere Metadatenbündelung
verkürzte die Lesung etwas, beseitigte diese Warteschlange aber nicht.

## Änderung

Die Oberfläche merkt sich die laufende Zielabfrage. Bei gleicher Auflösung und
einer Bewegung innerhalb ihres Puffers darf sie fertig werden. Eine andere
Zielauflösung oder ein nicht mehr abgedeckter Ausschnitt erzeugt nach dem
bestehenden 120-ms-Takt eine neue Anfrage. Die bereits gezeichnete Karte bleibt
sichtbar. Antwortgenerationen schützen weiterhin vor alten Bildern, Fehlern
und der Freigabe überholter Autorentreffer.

Der vorhandene Worker erhält pro Kameraauftrag ein gemeinsames 4-Byte-
Abbruchsignal. Main kann es setzen, während der Worker synchron liest.
Prüfpunkte zwischen Bindungen, Geometrieobjekten, Landschaftsobjekten und
Rasterteilen beenden überholte Arbeit. Ein Cachetreffer für die aktuelle Kamera
verwirft ebenfalls ältere laufende und wartende Kameraarbeit. Wartende
Objektauswahl bleibt erhalten; der Export benutzt weiterhin seinen eigenen
Workerbesitzer.

Ein Abbruch verlässt die SQLite-Iterationen vollständig und liefert kein
Teilbild, auch keine scheinbar erfolgreiche Landschaftsfehler-Ebene. Die
bereits abgeschlossene TEMP-Indexpflege wird bestätigt und der Quellcursor
beibehalten. Die nächste Kamera muss deshalb nicht den Weltindex neu aufbauen.
Ein echter Lese-/Synchronisationsfehler behält seinen bisherigen Rollbackweg.
Der komplette Read bleibt in einem Snapshot; es gibt keine pausierten Cursor
über Transaktionsgrenzen hinweg und keine neue Datentabelle.

## Messung mit echtem Worker

[Kontrollierter Vergleich](paired-worker.json), identische lesend geöffnete
Welt, Index jeweils vorher aufgebaut, neue Kamera 40 ms nach Lesestart:

| Beobachtung | Vorher | Nachher |
| --- | ---: | ---: |
| Ende der alten Arbeit nach neuer Anfrage | 1.034 ms | 0,745 ms |
| Aktueller Ausschnitt nach neuer Anfrage | 1.863 ms | 1.009 ms |
| Workerstarts | 1 | 1 |

Der neue Worker bestätigt den tatsächlichen Abbruch. Er unterdrückt nicht
bloß eine fertig berechnete Antwort. Seine folgende Indexsynchronisation dauert
0,20 ms. Das vollständige aktuelle Ergebnis einschließlich Raster ist
bytegleich. Das sind Einzelmessungen auf dem Entwicklungshost, keine garantierte
Abbruchlatenz für jedes Objekt und keine Pentium-Abnahme.

[Vier weitere Ausschnitte](paired-reads.json) – Welt, Region, Gebäude, Dungeon –
liefern ebenfalls bytegleiche JSON-Antworten und Raster. Ihre reguläre Lesezeit
ändert sich nicht wesentlich: Die aktuelle Weltabfrage braucht weiterhin rund
1.000 ms. Abgebrochen wird überholte Arbeit; die Arbeit für das aktuelle Bild
bleibt noch zu teuer.

## Normaler Atlas

Der [native Vergleich](native-comparison.json) benutzt private Kopien desselben
Bestands mit 100.000 Geländezuordnungen, 5.000 Orten, 5.000 eingerichteten
Raumgruppen und einem Dungeon mit mehr als 4.000 Räumen. Ein Pinsel mit
2.500 Meilen Radius, Zoom während des Abschlusses, erneuter Strich vor der
vollständigen Verfeinerung und Nachladen aller 36 Detailteile wurden ausgeführt.

| Beobachtung | Vorher | Nachher |
| --- | ---: | ---: |
| Öffnen bis Autorenbereitschaft | 10,94 s | 10,82 s |
| Erster Strich: Steuerelemente frei | 2,84 s | 2,98 s |
| Erster Strich: tatsächlich wieder bearbeitbar | 5,18 s | 4,46 s |
| Zweiter Strich: tatsächlich wieder bearbeitbar | 3,01 s | 2,73 s |

Vorher wurden nach dem ersten Strich zwei Regionsreads ausgeführt; nachher nur
einer. In diesem UI-Lauf ersetzte die aktuelle Anfrage die alte bereits vor
deren Worker-Ausführung. Der gezielte Vergleich oben prüft zusätzlich den
Abbruch während der tatsächlichen Berechnung. Die Einzelvergleiche belegen
keine statistische Gesamtbeschleunigung. Der erste neue Diagnoselauf
`.build/region-cancellation-world` überlappte mit einer Typprüfung; die Tabelle
verwendet ausschließlich die anschließend isolierte Wiederholung.

Der letzte angezeigte und bearbeitbare Stand stimmt mit der lesend geprüften
[SQLite-Revision 14](persisted.json) überein. PID 3458636 endete normal und wurde
als abwesend geprüft. Alle elf Build-Artefakthashes stimmen mit dem geprüften
Build überein. Fehlerlisten und verworfene Zeitspurereignisse sind leer.

[Der normale Wald-/Exportweg](normal-atlas.json) prüft 80 km → 60 km → 6 km →
1,2 km → 300 m, Neigen derselben Hauptkamera und beide PNG-Ausgaben. Der
Autorenbestand einschließlich geschützter Eiche bleibt erhalten. Beide
Exportbilder, Weltansicht und Übergangsbild sind bytegleich zum zuvor geprüften
Stand. Vier weitere Bildschirmbilder wurden erneut angesehen. PID 3459903
endete normal, ist abwesend und benutzte dieselben elf Artefakte.

## Offene Grenzen

93 betroffene Speicher-/Worker-/Oberflächenfälle, beide Typprüfungen,
Desktopbuild und Repositoryprüfung: siehe [Prüfmanifest](tests.json).

Die aktuelle Abfrage selbst, der kalte Indexaufbau und einzelne große
Raster-/PNG-Operationen sind noch synchron. Es gibt keine allgemeine
Zeitbudgetgarantie und keine Unterbrechung eines laufenden Reads zugunsten einer
Auswahl ohne Kamera-Nachfolger. Im großen nativen Lauf bleiben ein 435-ms-
Longtask und eine aufgezeichnete Bildpause von 450 ms. Öffnen und großer Pinsel
verfehlen weiterhin das Ziel unmittelbarer Reaktion. 30-Minuten-Speicherplateau,
physischer Pentium, vollständige Weltqualifikation und drei Abschlussaudits
bleiben offen.

Die Bilder [Welt](world.png) und [geneigte Hauptkamera](tilted.png) sind technische
Proben. Regelmäßige Testflächen, harte Waldgrenzen, einfache Straßen und Bäume
auf der Trasse erfüllen noch nicht das ästhetische Ziel einer D&D-Karte. Der
kurze Waldtest ersetzt nicht die fällige vollständige Autorenreise.
