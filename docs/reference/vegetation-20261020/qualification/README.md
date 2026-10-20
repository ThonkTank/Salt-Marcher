# Vegetation V3 – Zielabgleich und Bedienqualifikation

Diese Nachprüfung ergänzt den [ursprünglichen Beleg](../README.md) und dessen
[Wiederholung](../current-regression/result.json). Maßgeblich ist die
[Vegetationsroadmap](../../../plans/maps/vegetation.md), nicht die eigenständige
Relief-Roadmap. Der vollständige ursprüngliche Entwurf liegt temporär unter
`.build/vegetation-roadmap-original.md`.

## Änderungen aus der Prüfung

- **Bewuchs auswählen** hält die Auswahlwerkzeuge im Landschaftsbereich
  erreichbar. In Karte und räumlicher Ansicht lassen sich Bäume, Felsen oder
  Unterwuchs getrennt treffen. Felsen unter Kronen bleiben bearbeitbar; Gelände
  verdeckt auch bei aktivem Filter tatsächlich darunter liegende Objekte.
- Die begrenzte Rasterübersicht verwendet am Übergang bei 2 m/Pixel keine
  unbeschränkte lokale Bestandsdarstellung. Geschützte Objekte bleiben innerhalb
  des Antwortbudgets als auswählbare Objekte erhalten.
- Regional werden Vertreter aus verschiedenen Positionen weltfester Zellen
  gewählt. Ihre Kennungen und Positionen gehören weiterhin zum lokalen Bestand.
  Breitere Kronen verbessern die Übersicht; sie verändern keine gespeicherten
  Objekte. Regelmäßige Baumreihen behalten ihre absichtliche Ordnung.
- Beim räumlichen Zoomen folgt die Kamera sofort dem Mausrad. Weitere Gesten
  bleiben während des Nachladens möglich. Es gibt höchstens eine aktive
  Bereichsabfrage und eine vorgemerkte Anfrage für den letzten Ausschnitt;
  veraltete Antworten setzen die Kamera nicht zurück. Schreiben bleibt bis
  zur aktuellen Antwort gesperrt. Eine laufende reine Leseabfrage verhindert
  das Schließen der räumlichen Ansicht nicht.

## Abgleich mit dem ursprünglichen Entwurf

| Anforderung | Umsetzung und konkrete Prüfung |
| --- | --- |
| Sechs Vorlagen; Boden, Geländeart und Bestand gemeinsam | `vegetationPresets`, `vegetationControls`, kanonische Writer-Validierung; Vorlagen-, Projektions- und Bodenrasterfälle in `tests/vegetation.test.mjs`; ursprüngliche native Malprobe. |
| Fläche malen und umgrenzen, Bestand verändern | Gemeinsame Autorenbefehle; native Flächen- und Pinselprobe, neues Speichern/Rücknehmen in beiden Ansichten. |
| Ausdünnen, Verdichten, dauerhafte Lichtung | Gespeicherte lokale Korrekturpolygone; Tests für Lichtung, lokale Kandidaten und geschützte Ausnahmen; ursprüngliche native Lichtung. |
| Reihen und natürliche Säume | Gleicher Bestand mit Linienverteilung, Breite und Meterabstand; Datenfall für lange Reihen, native Linie und Abbruchprüfung im ursprünglichen Beleg. |
| Einzelobjekte verschieben, drehen, skalieren, austauschen, löschen, mit Ort verbinden | Gemeinsamer Inspektor und geschützte Korrekturen; native Bearbeitung sowie Datenfälle für Löschvermerke und Ortsverweise beim Kampagnentransfer. |
| Wasser, Straßen, Gebäude, Hangneigung; vorlagenabhängige Abstände | Geländeabfrage, Straßenbreite und objektgrößenabhängiger Abstand, Gebäudegrundfläche; Datenfälle für Sperren, neue Höhen, Straßen sowie gedrehte Gebäude und deren Entfernung. |
| Lokale Änderung ohne Wandern unveränderter Bäume | Weltadressierte Kandidaten; Vergleich der Kennungen und vollständigen Instanzen vor/nach Straßenänderung, Lichtung, Dichte- und Kamerawechsel. Dies behauptet keine ausschließliche Neuberechnung einzelner GPU-Instanzen. |
| Geschützte Objekte folgen dem Boden und behalten Konflikte | Höhen-/Wasserfälle und Straßenkonflikt; kein stilles Löschen. |
| Feine Arbeit bleibt unter grober Fläche erhalten | Priorität feiner Auflösung und eigener Verteilung im Datenfall. |
| Vorlagenstand bleibt fest; nur ausdrückliche Änderung | Kopierter Vorlagenstand in der Fläche, gemeinsame Speichern-Schaltfläche; Snapshot- und Transferfälle. Kein eigener Vorlagenbibliothekseditor erforderlich. |
| Gleicher Bestand nach Undo/Redo, Neustart und Transfer | Datenfälle für History, Fehlerrollback, neues Store-Öffnen und Kampagnenkopie; ursprüngliche native Probe startet frische Electron-Prozesse. |
| Drei Maßstäbe, zwei Ansichten, kein Neuwürfeln | Native Karten-/Raumaufnahmen lokal unter 2, regional bei 5,25 und weltweit bei 89,25 m/Pixel; zusätzlich Datenvergleich regionaler Vertreter mit lokalen Kandidaten. |
| Auswahl unter Kronen | Drei echte Three.js-Raycaster-Fälle ohne GPU; native Auswahl desselben geschützten Findlings in Karte und räumlicher Ansicht. |
| Editor und Ausgabe | Pixelvergleich räumlicher Draufsicht und PNG bei allen drei Maßstäben; gesonderte Prüfung der normalen Karten-PNG-Ausgabe. Verschiedene LODs werden nicht als pixelidentisch ausgegeben. |
| Gemeinsame History, Main/SQLite, begrenzte Bereichsabfrage | Writer-/Transaktionsfälle, Quellenzaun, Antwortbudgetfall und bestehende Landschafts-/Vorlagenregressionen. |
| Vorhandene Spielregeln, Symbole und Nutzerassets bleiben erhalten | Vegetation liefert die bestehende `values.terrain`-Zuordnung; keine neuen Reise-/Encounterregeln. Bestehende Landschafts-/Referenzbereichsfälle bleiben Teil der Regression. |

Die Sichtprüfung vergleicht lokale Bäume/Felsen, regionale Kronen und die ruhige
Weltfläche. Die Modelle bleiben einfache eigene Low-Poly-Geometrien. Dies ist
eine technische und gestalterische Eigenprüfung, keine Nutzerabnahme.

## Messung und Gültigkeitsgrenzen

Der [vollständige native Lauf](result.json) besteht sieben Prüfschritte und
endet regulär mit Code 0 ohne Signal; keine Rendererfehler.
[Protokoll](native.log). Die drei räumlichen PNG-Ausgaben stimmen jeweils
pixelgenau mit dem Canvas überein. Die normale Karten-PNG enthält den
geschützten Findling an seiner kanonischen Weltposition; die gespeicherten
Vegetationsdatensätze bleiben dabei unverändert.

| Ergebnis im vollständigen Lauf | Messwert |
| --- | --- |
| Kartenpinsel, 24 Ereignisse | maximal 33,7 ms, 95. Perzentil 33,0 ms |
| Räumlicher Pinsel, 24 Ereignisse | maximal 37,8 ms, 95. Perzentil 36,7 ms |
| Drehen, 168 Bildabstände | 60,19 FPS; 95. Perzentil 16,8 ms |
| Verschieben, 169 Bildabstände | 59,78 FPS; 95. Perzentil 17,5 ms |
| Öffnen bis zur geladenen Prüfkarte | 34,13 Sekunden |
| Normale Karten-PNG, 1024 × 876 Pixel | 53,86 Sekunden |

Die ursprüngliche Zoommessung im vollständigen Lauf enthält zusätzlich die
PNG-Kodierung der Messhilfe und meldet 179,8 ms (`targetMet: false`).
Diese Messung darf nicht als bestanden umgedeutet werden. Die korrigierte
Messhilfe nimmt das Vergleichsbild vor dem Eingabeereignis auf und erfasst
den Zeitpunkt des ersten veränderten Frames vor dessen nachfolgender
PNG-Kodierung. Ein erster [gezielter Nachlauf](navigation-before-queue.json)
misst damit 12,6 ms. Er zeigt außerdem, wie stark die Öffnungsdauer unter
Hostlast schwankt: 76,14 Sekunden statt 34,13 Sekunden im vollständigen Lauf.
Die anschließende Änderung für mehrere Gesten während des Nachladens wird
gesondert geprüft. Der erste [Überlappungsversuch](navigation-overlap-missed.json)
traf keinen als ausstehend beobachteten Lesevorgang und gilt als fehlgeschlagen.
Der reproduzierbare Folgetest verzögert ausschließlich die Zustellung der
echten Leseantwort um 250 ms, ohne Daten oder Autorenbefehle zu ersetzen.

**Der abschließende [Navigationsnachlauf](navigation-result.json) besteht
beide Prüfschritte**, einschließlich Malen und exakter Rücknahme nach den
überlappenden Gesten. [Protokoll](navigation.log). Zwei Mausradgesten
verkleinern den Ausschnitt von 600 auf gerundet 472 m; keine Geste geht verloren,
die Vegetationsdatensätze bleiben unverändert. Regulärer Prozessabschluss
mit Code 0 ohne Signal, keine Rendererfehler. Gemessen wurden 59,91 FPS beim
Drehen, 58,09 FPS beim Verschieben und 73,3 ms bis zum ersten geänderten Frame
beim Zoomen. Der absichtliche Leseantwortverzug ist kein Speicherzeitbenchmark.
Die App öffnete diese Prüfkarte in diesem Lauf nach 97,24 Sekunden.

Damit sind die funktionalen V3-Prüfungen und die genannten Ziele für die
Bedienung geladener Ansichten lokal erfüllt. **Die kalten Ladezeiten sind
weiterhin eine wesentliche Leistungsgrenze**: beobachtet wurden ungefähr
34 bis 97 Sekunden für das Öffnen und 54 Sekunden für die normale Kartenausgabe.
Dieser Abschluss behauptet keine flüssige Erstöffnung großer Bestände.
Host: Intel i5-8365U, Intel UHD Graphics 620, 38,8 GiB gemeldeter Gesamtspeicher.

**Automatisch bestanden:** [28 Fälle](tests.log), davon 16 Daten-/Speicherfälle,
drei räumliche Auswahlfälle und neun Werkzeughierarchiefälle; zusätzlich
[sieben Landschafts-/Referenzbereichsfälle](regions.log).
[App-Typprüfung](app-types.log), [Desktop-Typprüfung](desktop-types.log)
und [Appbuild](build.log) bestanden. Der native Lauf baut seine eigene
Desktop-App. Ein zwischenzeitlicher Typfehler während paralleler
Routenänderungen wurde durch den anschließend erfolgreichen aktuellen Lauf
abgelöst; die Belege werden nicht mit Candidate-CI gleichgesetzt.
Nach der Änderung an der Lesewarteschlange wurden die drei Auswahlfälle
[erneut erfolgreich geprüft](selection-final.log); sie sind keine drei
zusätzlichen unabhängigen Fälle. Die [Repositoryprüfung](repo-check.log)
und `git diff --check` bestanden ebenfalls.

| Sichtprüfung | Bilder |
| --- | --- |
| Lokaler Bestand und Lichtung | [Karte](01-local-map.png), [Draufsicht](local-top.png), [räumlich](local-tilted.png) |
| Regionale Kronen | [Karte](region-map.png), [räumlich](region-tilted.png); [früheres Punktraster](region-before.png) |
| Weltfläche | [Karte](world-map.png), [räumlich](world-tilted.png) |
| Auswahl unter Kronen | [Findling im Inspektor](02-rock-under-canopy.png) |
| Ausgabe | [Karten-PNG](map-export.png), [lokale räumliche PNG](local-export.png), [Region](region-export.png), [Welt](world-export.png) |

Die lokale Maßstabsangabe im vollständigen Ergebnis stammt noch aus der
Kartenkamera vor dem zusätzlichen räumlichen Verschieben/Zoomen. Das Bild
zeigt weiterhin die lokale Detailstufe; Region und Welt wurden nach Rückgabe
der Kamera gemessen. Der Probeablauf gleicht künftig vor der Aufnahme auch
die lokale Kamera ausdrücklich ab. Die Vorher-/Nachher-Bilder sind visuelle
Vergleiche, keine pixelgleichen Referenzpaare.

Die native Probe verwendet einen Weg, eine Lichtung, geschützte Objekte,
lokale Höhendetails und einen groben Regionalwald von ungefähr 56 × 38 km.
Sie bedient echte Electron-Steuerelemente in einer Wegwerfkampagne. Nur der
Dateidialog wird auf bekannte Prüfdateien gelenkt; Autorenänderungen erfolgen
über die Oberfläche.

Navigation und Pinselrückmeldung werden während tatsächlicher Mausgesten
gemessen. Sie sind von Ladezeit, vollständiger Bestandsneuberechnung und
Speicherabschluss getrennt. Der breite Prüfbestand benötigt merklich Zeit
beim Öffnen und Wechseln des Ausschnitts; eine allgemeine Ladezeitgrenze oder
beliebig große Welten werden damit nicht qualifiziert.
Die vorherige [Ausgabeprobe](map-export-timeout.json) überschritt ihr
60-Sekunden-Limit. Der Folgelauf verwendete eine begrenzte Wartezeit von
180 Sekunden für diese Ausgabe; die gemessene tatsächliche Dauer steht oben.
Eine isolierte kalte Rasterbereichsabfrage benötigte etwa 21 Sekunden.

Alle Aussagen gelten für den lokalen, uncommitteten Arbeitsstand. Exakte
Quell-/Bundlehashes, Hostdaten und regulärer Prozessabschluss gehören zum
jeweiligen Ergebnis. Candidate-CI, Integration in `main`, Paketinstallation
und Nutzerabnahme sind eigenständige Nachweise.
Der vollständige Lauf und der Navigationsnachlauf sind eigene Buildstände:
Währenddessen wurden gemeinsam genutzte Dateien für Geländerouten weiter
bearbeitet. [Hashvergleich](source-verification.json) hält diese Abweichungen
fest. Die Ergebnisse gelten für ihre aufgezeichneten Bundles, nicht pauschal
für jede spätere Änderung im gemeinsamen Checkout.
Nach dem abschließenden Navigationslauf stimmten alle zehn erfassten
[Quell-/Bundlehashes mit dem Checkout überein](navigation-source-verification.json).
