# Bewuchs und Felsen · lokaler Prüfstand 20.10.2026

Implementiert ist der [Vertrag für Landschaftsvorlagen](../../plans/maps/vegetation.md):
Flächen mit Bodenbild und Geländeart, stabile automatische Bestände, lokale
Korrekturen, geschützte Einzelobjekte und eine räumliche Bearbeitungsansicht.

Dieser Beleg stammt aus dem gemeinsamen lokalen Arbeitsstand auf
`e80b3bfb74673a8c08b6f896fc21522e4eb9e036` mit uncommitteten Änderungen,
einschließlich der bereits vorhandenen Relief-/Landwerkzeuge. Die genaue
Quell- und Buildidentität steht in [source-manifest.json](source-manifest.json).
Dies ist kein Main-/Candidate-CI-, Paketinstallations- oder Nutzerabnahmebeleg.

Die [V3-Nachprüfung mit vollständigem Anforderungsabgleich](qualification/README.md)
ergänzt drei Maßstäbe, die Auswahl unter Kronen, räumliche und normale
Kartenausgabe sowie gemessene Pinsel- und Kamerabedienung. Sie dokumentiert
auch lange Ladezeiten und den kontrollierten Test überlappender Kameragesten.
Die folgenden früheren Belege bleiben als eigene Prüfstände erhalten.

## Nachprüfung am gemeinsamen Arbeitsstand

Nach den Erweiterungen der räumlichen Bewuchsansicht um das gezeichnete
Bodenbild, ein auflösungsabhängiges Geländenetz und gemeinsame Landpinsel
wurde der Vegetationsablauf erneut vollständig ausgeführt:
**13/13 Datentests und 10/10 native Prüfschritte bestanden**.
[Aktueller Lauf](current-regression/result.json),
[Datentests](current-regression/tests.log),
[native Bedienung](current-regression/native.log) und
[räumliches Ergebnis](current-regression/07-spatial-painted.png).
Alle sechs im Lauf erfassten Quell-/Bundlehashes waren nach Abschluss
unverändert; alle drei Electron-Prozesse endeten regulär mit Code 0 ohne Signal.
App-/Desktop-Typprüfung und Repositoryprüfung bestanden ebenfalls.
Die Zuordnung im gemeinsamen Fähigkeitskatalog wurde aktualisiert.

Dieser Nachlauf qualifiziert die Vegetationsabläufe mit den zusätzlichen
Ansichtsfunktionen. Er ersetzt nicht die gesonderte R5-Prüfung der
Relief-Roadmap, insbesondere den Schutz verdeckter Geländeanteile bei
Landpinselzügen. Die folgenden ursprünglichen Belege bleiben erhalten.

## Native Bedienprobe

`python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-vegetation.mjs`

Die Probe baut eine eigene App unter `.build/vegetation-desktop`, erzeugt eine
synthetische Kampagne unter `~/.cache/saltmarcher/` und bedient echte
Electron-Steuerelemente mit Maus und Tastatureingaben. Autorenmutationen
werden nicht durch `page.evaluate` ersetzt. Nur die Dateiauswahl beim Export
wird auf einen bekannten Prüfpfad gelenkt. Der isolierte Prototyp läuft vor
der Produktprobe; die abschließende Wiederöffnung startet einen neuen Prozess.

[result.json](result.json) und [Laufprotokoll](vegetation-native.log):
zehn Prüfschritte bestanden, keine Rendererfehler, drei reguläre
Prozessabschlüsse mit Code 0 ohne Signal.

- Isolierter Prototyp: gleicher Bestand in Draufsicht und räumlicher Ansicht.
- Pinselzug mit gemeinsamem Boden, Geländeart und Bewuchs.
- Dauerhafte Lichtung.
- Geschützter, manuell platzierter Findling.
- Sichtbaren Findling auswählen, verschieben, vergrößern und drehen.
- Gemeinsames Undo/Redo in der räumlichen Ansicht.
- Bewuchs unmittelbar auf dem räumlichen Gelände malen.
- Flächen und Reihen zeichnen; Entwurf bei Werkzeugwechsel erhalten;
  Abbrechen ohne Speicheränderung.
- PNG über den nativen Speicheranschluss.
- Frische App erhält Flächen und Einzelkorrekturen unverändert.

| Ansicht | Beleg |
| --- | --- |
| Prototyp mit Wald am Hang, Lichtung und Geröll | [Räumlich](00-prototype-tilted.png), [Draufsicht](01-prototype-top.png) |
| Gemalter Wald in der Kartenansicht | [Karte](03-painted.png) |
| Einzelbearbeitung | [Findling](04-object-edited.png) |
| Gemeinsamer Bestand im Produkt | [Räumlich](04-product-tilted.png), [Draufsicht](05-product-top.png) |
| In der räumlichen Ansicht ergänzte Fläche und Baumreihe | [Bearbeitung](07-spatial-painted.png), [ausgegebenes PNG](spatial-export.png) |
| Neuer Prozess | [Wiederöffnung](06-reopened.png) |

## Automatische Prüfungen

`node --test tests/vegetation.test.mjs`: **13/13 bestanden**.
[Protokoll](vegetation-tests.log). Prüft stabile Kandidaten/Kennungen, Wasser,
Straßen, Hangneigung und Gebäude, geschützte Korrekturen, Löschvermerke,
Auflösungspriorität, Transaktionsfehler, Undo/Redo, Reopen, readonly
Quellenstand, Kartenprojektion und Raster, Writer-Validierung, sechs Vorlagen,
lange Reihen mit begrenztem lokalen Lesen, unveränderte Felspositionen beim
Detailwechsel, Seehöhe, automatische Aktualisierung nach Höhenänderungen und
gedrehter Stadtbebauung sowie Kampagnenkopie mit unveränderten
Verteilungskennungen und korrekt remappten Ortsverweisen.

Zusätzliche gezielte Läufe bestanden mit 105/105 und 60/60 Fällen
([Landschaft/Canvas](vegetation-regressions.log),
[Speicher/Regionen](vegetation-storage-regressions.log)); diese Zahlen
überlappen sich mit den Bewuchsfällen und sind nicht zu addieren.
TypeScript-Prüfungen für App/Desktop, Repositoryprüfung, Appbuild und der
isolierte Desktopbuild bestanden. `git diff --check` war sauber.
Die tatsächlichen Testdateien sind im gemeinsamen Fähigkeitskatalog
zugeordnet und der Ablauf ist als geprüft vermerkt.

## Leistungsbeobachtung und verbleibende Grenzen

Der isolierte Prototyp zeichnete **880 Bestandsobjekte in 6 Draw Calls**.
Bei 79 gemessenen Bildabständen während einer Kameradrehung: durchschnittlich
60,16 Bilder/s, 95. Perzentil des Bildabstands 17,7 ms; 95. Perzentil der
CPU-Zeit für `render()` 0,8 ms. Dies qualifiziert diese kleine lokale Szene,
nicht die Lade-/Neuberechnungszeit großer Bestände oder die allgemeine
100-ms-Eingabegrenze. Quelle: `performance` in `result.json`.

Große Weltbestände, alle GPU-/Hostkonfigurationen, vollständige Material-/
Dachdarstellung und gestalterische Nutzerabnahme bleiben offen. Die
räumlichen Modelle sind einfache eigene Low-Poly-Geometrien; diese Lieferung
schließt die gesonderte vollständige Relief-R5-Abnahme nicht ab.
