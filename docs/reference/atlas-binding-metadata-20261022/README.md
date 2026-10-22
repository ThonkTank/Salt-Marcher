# Objektgrenzen und Namen zusammen mit Atlasbindungen lesen

Lokale Änderung auf `d2857dae`, 22.10.2026. Ein großer Terrainstrich blieb auf
der gefüllten Welt mehrere Sekunden lang im Abschluss. Die neue native
[Zeitspur vor der Änderung](before-stages.json) zeigt nach dem ersten Loslassen
zwei Ausschnittsreads auf Revision 12, weil während des Abschlusses gezoomt wird.
Ihre summierte Worker-Lesezeit beträgt 2,14 s. Zwischen dem ersten Senden und
dem letzten Empfang liegen 2,86 s; diese Spanne enthält weitere Arbeit und ist
nicht mit der reinen Lesezeit gleichzusetzen. Main-Marker und Worker-Dauern
werden nicht über verschiedene Prozessuhren hinweg subtrahiert.

Der Ausschnittsreader lief vorher über 5.052 Bindungen und fragte ihre Grenzen
und Namen jeweils einzeln ab. Für Labels und anschließend erforderliches Raster
wurde diese Arbeit wiederholt. Die vorhandenen kleinen Tabellen `region_extent`
und `scope` werden jetzt per LEFT JOIN mitgelesen. Die Geschosswahl bleibt beim
aktiven Autorrahmen, alle anderen verwenden `ground`. Fehlende oder verborgene
Geometrie erzeugt weiterhin keinen Marker; der gewählte leere Autorrahmen bleibt
bearbeitbar. Namen und Grenzen stammen weiterhin aus demselben Snapshot.

Die Metadaten werden auch an die bestehende Ergebniszusammenstellung gereicht.
Deren Sonderpfad für den aktiv gewählten Rahmen und eingebettete Innenräume kann
weiterhin gezielt separat lesen. Die Geometrieabfragen behalten ihre räumliche
Rtree-Reihenfolge; der früher verworfene Owner-first-Join wird nicht reaktiviert.
Es gibt keinen neuen Cache, keine neue Tabelle und keine Änderung am Speicherformat.

## Direkter Vergleich

Die [Gegenmessung](paired-reads.json) baut die geänderte Datei und ihre exakte
Fassung aus `d2857dae`; alle anderen Abhängigkeiten sind gleich. Der synthetische
Weltbestand wird nur lesend geöffnet. Vollständige JSON-Antworten und darin
enthaltene Raster sind bei allen vier Ausschnitten bytegleich.

| Ausschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Welt | 1.213 ms | 969 ms |
| Region | 427 ms | 311 ms |
| Gebäude | 325 ms | 332 ms |
| Dungeon | 354 ms | 334 ms |

Dies sind einzelne CPU-/Datenbankmessungen auf diesem Host. Die große Welt ist
weiterhin viel zu teuer für unmittelbare Reaktion; weder diese Werte noch grüne
Einzeltests ersetzen die native Gesamtprüfung oder die Pentium-Abnahme.

## Regressionen und Abfrageumfang

76 lokale Fälle aus den Regions-, Cache- und Raumgruppentests bestanden. Der neue
Test prüft 20 unabhängige Gebäude, ein ausgewähltes Obergeschoss, Umbenennung,
verstecktes Geschoss und vollständigen Neuaufbau. Während des normalen Reads
verbietet er die früheren separaten Namen-/Grenzenabfragen. Die übrigen Tests
umfassen unter anderem gedrehte Legacy-Bindungen, leere Autorrahmen, defekte
Daten, Schnitte, Rtree-Ausfall, Rücknahme und echte Worker-Anfragen. Die vorhandene
Regression für viele Formen in einem einzigen Owner bleibt grün.

Das [SQL-Profil](query-profile.json) des vollen Weltreads zeigt zwei gebündelte
Bindungsabfragen und keine separaten Scope-Namen-/Grenzenabfragen mehr.
1.501 Abfragen für Geschosslisten bleiben erhalten. Der profilierte Durchlauf
kostet selbst weiterhin etwa 1,18 s; Instrumentierung und Hostschwankung sind
kein gleichwertiger Vergleich zu den uninstrumentierten Zahlen oben.
App- und Desktop-Typprüfung sowie Desktop-Build bestanden.

## Native Gesamtstrecke

Die [erneute Zeitspur](after-stages.json) zeigt für die beiden Ausschnittsreads
nach dem ersten Loslassen 1,83 s statt 2,14 s Worker-Lesezeit. Die vollständige
Zeit bis zur nächsten Bearbeitung bleibt im instrumentierten Ablauf jedoch
praktisch gleich: 5,18 s statt 5,17 s. Die frühere Vorlage wird währenddessen
durch den Zoom ersetzt; das System berechnet immer noch beide Ausschnitte.

Der separate [Lauf ohne zusätzliche Phasentraces](world.json) erreicht die
Bedienelementfreigabe nach 2,43 s, tatsächliche Bearbeitbarkeit erst nach 4,82 s.
Der zweite Strich ist nach 2,77 s wieder abgeschlossen. Alle 36 Detailkacheln
werden anschließend geladen; sichtbare und [gespeicherte Revision](persisted.json)
14 stimmen überein. Reguläres Prozessende mit verschwundenem PID, keine
Rendererfehler. Die elf Buildhashes der beiden endgültigen Läufe sind identisch
und wurden gegen den aktuellen Build geprüft.

Diese Änderung spart nachweisbar Metadatenabfragen und Rechenzeit innerhalb des
Ausschnittsreads. Sie belegt **keine kürzere gesamte UI-Wartezeit**. Ein früherer
uninstrumentierter Lauf des Ausgangsstands lag bei 4,24 s; die Wiederholungen
schwanken erheblich. Die Kopplung an vollständige, nicht unterbrechbare
Ausschnittsreads sowie zusätzliche Farb-/Geometriearbeit bleibt offen.

Die [Weltaufnahme](world.png) zeigt den synthetischen Lastbestand, keine fertig
gestaltete Fantasy-Karte. Erste Übersicht innerhalb zwei Sekunden, unmittelbare
Pinselreaktion, volle-Welt-p95/p99, Speicherplateau und physischer Pentium-Nachweis
werden hier nicht behauptet. Es gibt keinen neuen Release oder Main-Nachweis.

## Räume im normalen Atlas

Der [native Raumgruppenablauf](room-groups.json) erzeugt eine eingerichtete
Taverne und eine Krypta, benennt einen Raum um, skaliert die Gruppe, prüft
Undo/Redo, teilt den Raum und nimmt die Teilung zurück. Nach dem zweiten
Prozessstart sind Name und Objektidentitäten unverändert. Beide Prozesse
endeten mit Code 0, keine Rendererfehler; ihre Abwesenheit und die unveränderten
Desktop-Buildhashes wurden [anschließend geprüft](room-lifecycle.json).
Das Testprofil liegt im Disk-Cache und wurde über `tools/ui-session.py` begrenzt.

Die [frisch geöffnete Raumansicht](room-reopen.png) wurde visuell geprüft. Die
Fixture enthält keine ausgearbeitete Landschaft; das blaue Umfeld, die schlichten
Möbel und der vom Inspektor teilweise verdeckte Grundriss sind keine Abnahme
einer ansprechenden Fantasy-Karte. Dies ist ein gezielter Funktionsablauf und
ersetzt nicht die geforderte komplette Welt-bis-Gebäude-Autorenreise.
