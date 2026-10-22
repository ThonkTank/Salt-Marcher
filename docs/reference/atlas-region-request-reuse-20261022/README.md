# Laufende Bereichsanfragen bei Geländeaktualisierungen erhalten

Lokale Änderung auf `d5054473`, 22.10.2026. Die vorangehende große Weltprobe
zeigte mehrere Regionsreads nach einem einzigen Pinselabschluss. Die Diagnose
zeichnet jetzt zusätzlich die tatsächlichen Abfrageboxen und Quellsequenzen
auf. Damit sind beabsichtigte Kamerawechsel von Wiederholungen unterscheidbar.

## Zwei Ursachen, vorhandene Besitzer beibehalten

Der Atlas löscht beim Start einer Regionslesung seine zuletzt geladene
Abfragekennung. Ein Neuzeichnen des Geländes verglich diese leere Kennung mit
der gewünschten Rasterdarstellung. Das wurde fälschlich als Wechsel zwischen
GPU- und Canvasdarstellung behandelt und ersetzte die laufende Abfrage.
`redrawSpatial` vergleicht jetzt die aktuelle angeforderte Darstellung, solange
deren Anfrage noch der aktive Besitzer ist. Ohne bekannte Abfrage bleiben
Öffnen, bestehender Refresh und ausdrücklicher Retry zuständig. Echte
Darstellungswechsel durch Grafikverlust oder Wiederherstellung fordern
weiterhin einen passenden Ausschnitt an.

Zusätzlich forderte eine veraltete Terrainantwort neue Geometrie an, während
die aktuelle Kameraabfrage bereits lief. `refreshSpatialSource` meldet in
diesem Fall, dass noch keine neue Quelle bestätigt ist. Die bestehende
Wiederherstellungssperre von `TerrainSpatialUI` wartet auf die bestätigte
Nachfolgerantwort. Sie gibt weder Bearbeitung frei noch wiederholt sie die
alte Terrainquelle. Wenn keine Regionslesung läuft, bleibt der normale
Refresh-/Fehler-/Retryweg erhalten. Es entsteht kein weiterer Cache und
keine neue Anfragewarteschlange.

## Native Messung auf der großen Welt

[Vorher, erster Teilschritt und Endstand](native-comparison.json) verwenden
private Kopien desselben synthetischen Bestands: 100.000 Geländezuordnungen,
5.000 Orte, 5.000 eingerichtete Raumgruppen und mehr als 4.000 Dungeonräume.
Nach dem 2.500-Meilen-Pinsel folgt Zoom und ein zweiter Strich vor fertiger
Feinauflösung. Alle Läufe erreichen anschließend 36/36 Detailteile.

Vorher: vier Regionsreads nach dem ersten Strich. Die alte Kamera und zwei
Anfragen für die bereits passende Zielkamera werden abgebrochen. Der reine
Neuzeichnungsfix reduziert dies auf drei Reads, verkürzt die gesamte Wartezeit
aber nicht erkennbar. Der vollständige Fix benötigt zwei Reads: die durch
Zoom überholte Kamera wird abgebrochen, die aktuelle Anfrage darf fertig
werden. Die winzigen Rundungsunterschiede der Boxen waren kein Grund, neue
fachliche Daten zu laden; eine Zahlenquantisierung wurde nicht eingeführt.

| Beobachtung | Vorher | Endstand |
| --- | ---: | ---: |
| Öffnen bis bearbeitbar | 10,83 s | 10,54 s |
| Erster Strich: Steuerelemente frei | 1,80 s | 1,65 s |
| Erster Strich: tatsächlich wieder bearbeitbar | 4,07 s | 3,84 s |
| Zweiter Strich: tatsächlich wieder bearbeitbar | 2,67 s | 2,78 s |
| Abgebrochene Reads nach erstem Strich | 3 | 1 |

Dies sind Einzelvergleiche auf dem Entwicklungshost, kein statistischer
Gesamtleistungsnachweis. Die aktuelle Regionslesung braucht im Endlauf noch
821 ms einschließlich Worker-Roundtrip. Größte erfasste Rendererblockade:
377 ms; größter erfasster Frameabstand: 434 ms. Die volle Welt reagiert damit
weiterhin nicht unmittelbar. Der zweite Strich ist in diesem Paar langsamer.

Die [gespeicherte Revision 13](persisted.json) stimmt mit sichtbarem und
bearbeitbarem Endstand überein. Prozess 3497429 beendet sich normal und ist
weg; keine Rendererfehler, keine verworfenen Trace-Einträge. Alle elf
Buildhashes wurden nach dem Lauf mit den verwendeten Artefakten abgeglichen.

## Prüfungen

[62 betroffene Tests](tests.json) bestanden. Sie prüfen unter anderem, dass
wiederholtes Neuzeichnen die laufende Anfrage weder ersetzt noch als
bearbeitbar freigibt; echte Grafikwechsel ersetzen sie weiter. Veraltete
Terrainantworten warten auf den aktuellen Besitzer. Fehler bleiben Fehler,
und ohne Besitzer funktioniert der reguläre Retry weiterhin. Vorhandene
Kamera-/Quellwechsel, späte Antworten und Terrainabschlussfälle bleiben
geprüft. Beide Typprüfungen und Desktop-Build bestanden.

Der [Repository-Entwicklungsstart](development.json) prüft denselben normalen
Atlas, frühe Übersicht und fortlaufende Detailkacheln, Zoom, Neigung/Drehung,
Höhenlinien in vier Maßstäben sowie echten GPU-Kontextverlust. Der
Canvas-Fallback erhält vollständiges Gelände; die erneuerte Hauptkamera
verzichtet wieder auf das doppelte Bodenraster. [Prozess-/Buildprüfung](development-lifecycle.json),
[Fallback](fallback.png), [wiederhergestellte Kamera](recovered.png).
Das ist eine technische Hügelprobe, keine Fantasy-Kartenabnahme.

Main/Candidate-CI, Paket, Release, Zielgerät, volle Zielwelt und die
vollständige Gestaltung/Werkzeugqualifikation bleiben offen. Dieser Befund
schließt weder R7 noch den Gesamtauftrag ab.
