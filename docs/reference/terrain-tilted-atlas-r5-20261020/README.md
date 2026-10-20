# R5 · Kippbarer Atlas und dieselben drei Landpinsel

R5 ist am 20.10.2026 im isolierten Arbeitsbaum `terrain-r2-qualification` lokal implementiert und automatisiert sowie nativ geprüft. Die Übernahme in die gemeinsame Arbeitskopie ist erfolgt: 58 betroffene Fälle, beide abschließenden Typprüfungen, Desktop-Build und Repository-Prüfung bestanden. Die nativen Belege gelten für den isolierten R5-Quellstand; zusätzliche parallele Änderungen sind damit nicht nativ qualifiziert. R6 und R7 bleiben offen; keine Main-/Candidate-CI-, Paket- oder Installationsqualifikation.

## Umsetzung und Zielabgleich

| R5-Anforderung | Umsetzung und Prüfung |
| --- | --- |
| Produktive Höhenabfragen | Derselbe kanonische Höhenbestand über den bestehenden begrenzten Preload-Bereichsabruf. Kein eigenes Autorenmodell im Renderer. |
| Kameranahe Koordinaten und Geometriedichte | Orthografisches Three.js-Netz mit Koordinaten relativ zum gemeinsamen Mittelpunkt. 193 × 193 Stützstellen über den dreifachen Ausschnitt; die Weltweite je Dreieck folgt dem Maßstab. Zoom erzeugt keine neuen Höhen. |
| Gemeinsame Auswahl, Kamera und History | Eingabe bleibt auf dem vorhandenen Atlascanvas; der GPU-Canvas ist eine abgeleitete Darstellung. Die bestehende Auswahl bleibt erhalten, Kamerabox und Befehls-/Undo-Pfad bleiben gemeinsam. |
| Sichtbare Oberfläche bearbeiten | Alle drei Landpinsel verwenden echte Dreieckstreffer. Eine für den Zug eingefrorene Projektion bindet die Sichtmaske an seinen Ausgangsstand. Main rekonstruiert das Dreiecksnetz aus kanonischen Höhen; vom Renderer kommen keine maßgeblichen Höhendaten. |
| Verdeckte Teile schützen | Sichtprüfung läuft über die Zellen- und Diagonalkreuzungen des dargestellten Netzes; Hindernisse außerhalb des Pinsels zählen mit. Höhenknoten hinter Graten bleiben unverändert. Farbauftrag wird als sichtbare Weltfläche festgeschrieben, ohne dauerhafte Kameramaske. |
| Überhöhung rein visuell | Neigung 0–65°, Drehung und Überhöhung 0,25–8 ändern Darstellung und Trefferprojektion, keine Meterwerte. Modellprüfung gegen Three-Kamera und echte Dreieckstreffer. |
| Rückkehr zur Draufsicht | Direkt unter Ansicht. Andere Gelände-/Grundrisswerkzeuge und der bestehende Bildexport wechseln zur Draufsicht, bevor dort weitergearbeitet wird. Perspektivischer Export gehört zu R7. Bei aktiver Wissens-/Sichtmaske bleibt die bereits gefilterte Draufsicht maßgeblich. |
| Ressourcen begrenzen | Genau eine Bereichsabfrage und eine Vorschau im Flug; schnelle Kamerabewegungen werden gebündelt und veraltete Antworten verworfen. Netz höchstens 257 × 257 bei externen Befehlen, Bereichsdaten maximal 16 MiB; Farbraster höchstens 1024 × 1024. Worker, GPU-Geometrien und Texturen werden beim Verlassen freigegeben. |

Die drei Landwerkzeuge bleiben **Land formen**, **Land bemalen** und **Glätten**. Höhenkartenimport sowie besondere Gebirgs-, Tal- oder Plateauwerkzeuge sind entsprechend dem Nutzerentscheid gestrichen. Der gezeichnete R4-Stil wird als gemeinsame Oberflächentextur verwendet. Die ergänzende Darstellung von Baukörpern, Geländeankern und Höheninformationen folgt in R6.

## Automatisierte Prüfung

51 betroffene Fälle bestanden: `terrain-spatial`, `terrain-spatial-storage`, `terrain-brush`, `terrain-height`, `terrain-relief`, `desktop-land-color-separation` und `desktop-atlas-tool-hierarchy`. Neue Prüfdateien:

- [Projektion, Dreiecksinterpolation, Sichtschutz, Farbe und Vorschau](../../../tests/terrain-tilted-atlas.test.mjs)
- [Kanonischer Speicher, Vorschaugleichheit, verdeckte Knoten, History, Neustart und Farbauftrag](../../../tests/terrain-tilted-atlas-storage.test.mjs)
- [Nativer Bedienablauf](../../../tools/test-desktop-terrain-tilted-atlas.mjs)

Vorschau und gespeicherte Felder werden bei identischen Renderparametern auf gleiche Höhen und Pixel geprüft. Auch ein breiter Glättungspinsel liest die nötigen Nachbarkacheln außerhalb des dargestellten Netzes. Ein Datenwechsel verwirft den alten Vorschau-Grundstand; verspätete Entwürfe und bereits gespeicherte Gesten können ihn nicht erneut überlagern. Der native Ablauf verwendet reale Werkzeugeingaben, einen isolierten SSD-Datenordner und regulären Prozessabschluss. Alle acht nativen Ablaufprüfungen bestanden mit regulärem Prozessabschluss und unveränderten Quell-/Bundlehashes: [Ergebnis](native/result.json), [Quellbindung](verification.json), [Ablaufprotokoll](native.log).

## Grenzen

- R7-Ziele (30 FPS, Pinselrückmeldung innerhalb 100 ms, Großbestand auf 16-GiB-Zielgerät) sind nicht qualifiziert. Die aufwendige vollständige Texturvorschau ist ein gezielter Optimierungspunkt für R7; begrenzte Speicherbelegung allein ist kein Latenznachweis.
- Das Netz ist eine begrenzte Darstellungsauflösung. Kanonische Höhenabfragen und feine bearbeitete Knoten bleiben maßgeblich. Sichtschutz bezieht sich auf dieses dargestellte Netz und seine Ausgangsprojektion je Geste. Farbe wird konservativ in begrenzter Zellauflösung ausgeschnitten.
- Gebäude, vollständige Objektbeschriftung, Wasserstände als räumliche Oberfläche, Geländeanker, Profile und Höhennutzer gehören zu R6. Perspektivischer Export und vollständige Spielerqualifikation folgen in R7.
- Keine zusätzliche Nutzerabnahme behauptet. Die Arbeit läuft auf ausdrückliche Anweisung ohne Abnahmepausen weiter.

## Native Befunde und Phasenabschluss

- Pass bei (-700, -700) in gekippter Ansicht von rund 565 m auf -20 m abgesenkt; gespeicherte Abfrage meldet Wasser. Draufsicht behält dieselbe Kamerabox und dieselben Höhen. Ein Undo/Redo nimmt genau den Zug zurück beziehungsweise stellt ihn wieder her.
- Rotation, Neigung und Überhöhung verändern keine Höhen. Escape stellt den aktuellen Grundstand wieder her. Glätten, Farbe und Farbradierung durch dieselben drei Werkzeuge sind im echten Fenster geprüft.
- Navigation, gemeinsame Ortsauswahl und erneutes Öffnen erhalten die Autorenwerte. Der vorhandene Wissensmasken-Handler wurde zusätzlich programmgesteuert im nativen Fenster ausgelöst: räumliche Ansicht schließt, gefilterte Draufsicht bleibt verfügbar. Das ist keine vollständige R7-Spielerabnahme.
- WebGL2 läuft auf der Intel UHD Graphics 620. Die gemessene erste vollständige Pinselvorschau benötigte 1961 ms in diesem Lauf; das 100-ms-Ziel ist ausdrücklich offen.

Bilder: [gekippter Atlas](native/01-tilted.png), [Absenkvorschau](native/02-lower-preview.png), [gespeicherter Pass](native/03-lowered.png), [derselbe Stand von oben](native/04-top-same-pass.png), [gedreht](native/05-rotated.png), [sichtbarer Farbauftrag](native/06-painted.png), [neu geöffnet](native/07-reopened.png).

Die erhaltenen Fehlversuche unter `attempts/` dokumentieren Initialisierung/Workerfreigabe, ungeeignete Prüfpositionen und Bereitschaftsbedingungen, das eingehaltene Rasterlimit, die korrigierte alte Vorschaugrundlage sowie einen Lauf unter konkurrierender Hostlast. Sie zählen nicht als bestandene Prüfungen.

**Zielabgleich:** R5 erfüllt die integrierte Geländeansicht und Bearbeitung mit den drei vorhandenen Werkzeugen. Es wurden weder Höhenkartenimport noch Spezialformenwerkzeuge eingeführt. R6 (Objekte und Höhennutzer) sowie R7 (Ausgabe, Großbestand, Leistungs- und vollständige Produktqualifikation) bleiben getrennte offene Phasen. Der Gesamtauftrag ist noch nicht abgeschlossen.

Die gemeinsame Arbeitskopie erhielt parallel eigene Tests für die räumliche Bewuchsansicht unter denselben ursprünglichen Dateinamen. Deshalb heißen diese R5-Prüfdateien nach der Qualifikation `terrain-tilted-atlas…`; nur Test-/Treiber-/Ausgabepfade wurden umbenannt, keine Produktlogik oder Bedienprüfung. Die exakt ausgeführten Treiber-/Testtexte liegen als `qualified-…txt` neben dem Befund; alte und aktuelle Namen/Hashes sind in `verification.json` zugeordnet. Die parallele räumliche Bewuchsansicht bleibt erhalten und ist noch nicht mit dieser integrierten Terrainansicht zusammengeführt.

## Übernahme in die gemeinsame Arbeitskopie

Die Übernahme erhält die parallel entstandenen Geländewege und die räumliche Bewuchsansicht. Gemeinsame Stellen wurden gezielt zusammengeführt: Wegkopplung bleibt im Höhenwriter, der kanonische Bereichsleser liefert seine Wegabhängigkeiten mit, und der Terraincontroller entfernt doppelte Datensätze nach ID mit Vorrang für die kanonische Antwort. Während der anschließenden Prüfung wurden Modell, Ansicht und Worker zusätzlich von den parallelen Wegarbeiten verändert. Diese Erweiterungen gehören nicht zum oben nativ qualifizierten R5-Stand.

Mit Node 22.22.0 bestanden im gemeinsamen Arbeitsbaum **58/58 betroffene Fälle**, `npm run build:desktop`, `npm run check:repo` sowie abschließend `npm run check` und `npm run check:desktop`. Der erste Typprüflauf hatte noch Fehler in parallel bearbeiteten Weg-/Bewuchseinstiegen; beide späteren Läufe bestanden nach deren Weiterbearbeitung. [Prüfprotokolle](shared/results.json), [abschließende Typprüfungen](shared/recheck-results.json) und [Übernahmehashes](shared/installed.json) bleiben getrennt vom isolierten nativen Beleg. Keine erneute native Qualifikation der gemeinsamen Arbeitskopie und keine Integration nach Main behauptet.

Die gemeinsame Arbeitskopie änderte sich auch während der abschließenden Typprüfungen. Die bestandenen Befehle sind daher Einzelbelege ihrer jeweiligen Läufe und kein unveränderlicher, gemeinsam vollständig qualifizierter Quellstand. Die betroffenen Dateinamen und aktuellen Übernahmehashes stehen in `verification.json` unter `sharedCopy`.
