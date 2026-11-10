# Aktueller Stand

Stand: 11. November 2026. **P3.2 „Ein echtes Haus“ ist umgesetzt; der Haus- und Dateirundlauf ist bestanden. Die übergreifende Höhen-GPU-Abnahme bleibt FAIL.**
Der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan;
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Atlas V7 ist der reguläre Einstieg mit Format 22; der optionale
Electron-/Pixi-Editor verwendet jetzt Format 26 (`atlas-p3-house-1`).

## Arbeitsentscheidung und Umfang

Der Auftrag zum nächsten Planschritt setzt die freigegebene begrenzte
R5-Fortsetzung nach P3.1 mit P3.2 fort. Nur dessen benötigte P1/P2-Erweiterungen
sind enthalten. Die formale R4-Auswertung bleibt bestehen; ihre offene
Leistungsabnahme widerruft diese Nutzerentscheidung nicht. Vollständige
P0-Abnahme und bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

## P3.2 und Abschlusskriterien

Rechteckige Häuser besitzen eine stabile ID, Pose, Breite/Tiefe, Drehung und
Fundamentparameter. Platzieren, exaktes Auswählen und sichtbares Verschieben
verwenden dasselbe Dokument, Pendingjournal, History, Writer und dieselben
Dateiaktionen wie Höhe und Landschaft. Innenpayloads bleiben getrennt.

| Kriterium                     | Umsetzung und Nachweis                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stabile Autoren und Geometrie | Gedrehte Ecken, exakter Hit-Test statt AABB-Auswahl, Weltgrenzen und Eingangsvalidierung; 37 Hausmodellfälle.                                                                                        |
| Geste und gemeinsame History  | Sichtbare Zwischenpose, Abbruch vor Up, keine Rücknahme nach Up, No-op ohne History, gemischte Autorenreihenfolge, Save während Drag; Controller- und Sessiontests.                                  |
| Kaltes räumliches Laden       | Getrennte Hausabdeckung, alte Antworten nach Bewegung, gepinnte aktive/offene Header, Verdrängung und kalte Rückkehr; Modell, Controller und echter Desktop.                                         |
| Teilweise sichtbare Häuser    | Vollständige Grundfläche des getroffenen Hauses wird durch denselben Leseslot geladen; vergrößerte oder gedrehte Einstellungen laden ihren Bedarf vor der Übernahme und prüfen Session/Autor erneut. |
| Gemeinsame Datei              | Atomare gemischte Transaktionen, verlorenes ACK, Snapshot S mit späteren Änderungen, Neu/Open und frischer Prozess; echter Electron-/SQLite-Pfad.                                                    |
| Unabhängigkeit vom Terrain    | Echter Höhenstrich verändert Hausautoren nicht; direkte SQLite-Digests und Pixel prüfen Haus und Gelände getrennt.                                                                                   |
| Begrenzung                    | Höchstens 4.096 Header pro Ansicht/Read, keine Teilantwort als Leerebeleg, genaue REAL-Nachfilterung des RTree; gemeinsame Quellen-/History-/Pending- und Darstellungsbudgets.                       |

Die geländeabhängige Fundamentdarstellung gehört zu P3.3. P3.2 speichert ihre
Einstellungen und nennt diese Grenze auch in der Oberfläche. Keine neue
Behauptung über eine bestandene native Leistungsabnahme.

## Nachweise am aktuellen Stand

Geprüfter Produktquellhash (`product-inputs-v1`):

`196a55cbedfa8f238bd27016515abf10c5eb199aa2a1e5b2138e6068536c83cb`

| Prüfung                                               | Ergebnis                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Gesamte TypeScript-Typprüfung                         | Bestanden.                                                                             |
| Editor-Modell, Controller, Session und Darstellung    | 862/862 Tests in 27 Dateien bestanden, mit einem Testworker und unverändertem Timeout. |
| Tool-Typprüfung und frischer P0-Desktop-Build         | Bestanden.                                                                             |
| Echter Electron-/SQLite-Store und Skalierungsreferenz | 24/24 Tests bestanden.                                                                 |
| Vollständiger Electron-Smoke                          | 176/176 Prüfungen bestanden, darunter 29 Hausprüfungen.                                |
| GPU-Referenz einschließlich Gestennachweisen          | **FAIL:** letzter Lauf 3/6, erster Lauf 4/6. Keine geänderten Grenzwerte.              |
| Formatierung und Diffprüfung                          | 31 geänderte/neue Dateien sowie `git diff --check` bestanden.                          |

Der erste parallele Editorlauf hatte zwei Fünf-Sekunden-Timeouts in bestehenden
vollständigen Landschaftsreferenzen. Die serielle Wiederholung bestand alle
862 Fälle ohne geänderte Erwartungen oder Zeitlimits. Das ist ein Funktionsnachweis,
keine native Zeitmessung.

Ein erster vollständiger Desktoplauf erkannte korrekt eine ungeeignete
Lifecycle-Fixture: Beim Fall „Schließen mit ausstehenden Writes“ waren beide
Writes bereits bestätigt, bevor der Schließversuch begann. Die bisherige
Ein-Sekunden-Verzögerung ist durch einen kontrollierten Halt des ersten
Commits im ausdrücklichen Diagnosemodus ersetzt. Erst nach beobachtetem
nativem Schließen bei `fileAction && writing` und weiterhin gehaltenem Commit
wird er freigegeben. Die bisherigen Sequenz-/Inhaltsprüfungen und die
Zehn-Sekunden-Schließgrenze bleiben erhalten. Normale Starts besitzen diese
Diagnoseschnittstelle nicht.

Der erste GPU-Lauf bestand vier von sechs Fällen; die Wiederholung am
identischen Produktquellhash bestand drei von sechs. Im Fall
`normal-zoom-level9` fehlen bei der dritten Anhebung innerhalb der unveränderten
fünf Sekunden die `brush-submit`-Nachweise für elf Intervalle. Alle acht
Pixel-/Autorencheckpoints und die wiederhergestellte Quellenidentität dieses
Falls bestehen. `all-22-levels` überschritt zunächst nach einer bereits
gespeicherten Aktion die 20-Sekunden-Grenze für die vollständige Darstellung.
In der Wiederholung durchläuft der Fall alle 176 Aktionen und sämtliche
Inhaltscheckpoints; sechs Gesten scheitern an den Fünfsekundennachweisen.
`ordinary-22-level-cancellation` überschreitet im letzten Lauf bereits beim
Ansichtswechsel die 20-Sekunden-Grenze. Es fehlen dabei keine Quellen; die
Terrainkomposition arbeitet weiter. Der Prüfer behält jetzt die genaue
Strichbewertung und Fehlerereignisse. Produktquellen, Eingaben,
Erfolgsbedingungen und Zeitlimits wurden für die Wiederholung nicht geändert.

Der anschließende kontrollierte Vergleich verwendet bytegleiche Kopien des
sauberen P3.1-Builds und des aktuellen Builds sowie denselben Diagnoserunner,
nur auf `normal-zoom-level9` begrenzt. **Beide isolierten Läufe bestehen.**
Das ersetzt die roten vollständigen Läufe nicht und belegt weder eine behobene
Höhenrückmeldung noch eine native Leistungsfreigabe. Der Einfluss der
Laufbedingungen beziehungsweise der vorhergehenden Fälle auf diese Zeitfehler
bleibt offen; aus den vorliegenden Belegen ist keine neue Hausregression
nachgewiesen.

Eine isolierte Negativkontrolle blendet ausschließlich das Haus im generierten
Renderer einer Testkopie aus. Autoren-/Historychecks bestehen weiterhin;
der unabhängige Grundflächen-Pixelcheck setzt den zentralen Smoke auf FAIL
und Exit 1. Die normalen Produktdateien bleiben unverändert.

Rohbelege liegen ignoriert unter `src-tauri/target/diagnostics/p3-house-final/`
und `src-tauri/target/diagnostics/p3-house-negative-control/`.
Die GitHub-CI wird für den jeweiligen veröffentlichten PR-Head separat
geprüft; der erfolgreiche Ausgangscommit ersetzt dessen Ergebnis nicht.

## Offene Messbefunde

Der letzte R4-Haltebefund bleibt **FAIL**: Bei zehn Sekunden auf Level 4,
Scale 0,01 und 16-Pixel-Pinsel erreichte das Zentrum 200 statt 40.038,4
Referenzwirkung, ungefähr 0,5 Prozent. Während des Haltens wurde kein neues
Terrainpaket eingereicht. Die bisherige Codeableitung benennt wiederholt
verworfene Übersichtsvorbereitung mit mindestens 133 Schritten bei höchstens
128 Schritten je RAF. P3.2 ist keine neue Abnahme dieses Höhenfalls.

Der aktuelle Zoomfall präzisiert zusätzlich zwei bestehende Höhenpfade:
`Observation.dose` verlangt das Gesamt-Rechteck einer Materialisierung,
während der lokale Renderbeleg nur die tatsächlich beeinflussten Teilflächen
bestätigt. Zwei unveränderte Eckbereiche verhindern dadurch die Zuordnung
bereits dargestellter früher Intervalle. Für den restlichen Autorenstand erstellt
`freezeBrushRender` nach `work.complete` keine weitere lokale Gruppe; diese
Darstellung läuft über Hintergrundkacheln weiter. Die betroffenen Funktionen
sind gegenüber dem P3.1-Ausgangscommit unverändert. Eine saubere eigene Korrektur
muss dieselben tatsächlichen Regionslisten durch Materialisierung, Invalidierung,
Intervall- und Commitnachweis führen sowie die letzte ausstehende Rendergruppe
abschließen. Die strenge Überdeckungsprüfung darf dafür nicht gelockert werden.

Der native Hardware-/20-ms-Ergebnistakt und die vollständige
Eingabe→Präsentationsabnahme bleiben offen. Funktions-/Pixelprüfungen ersetzen
keine native Leistungsabnahme.

## Nächster Planschritt

**P3.3 „Vorbereitete Gewässer und Ableitungen“:** echte Seemaske/Pegel und ein
kleines bestätigtes Flussprofil, sichtbare aktuelle Fundamentableitung und
auffindbarer Veraltet-Status. Inhaltsidentitäten müssen Quelle A → B → Undo(A)
überstehen; keine weltweite Nachführung entfernter Häuser oder Gewässer.
Danach folgen die echte Fachkonkurrenz und der gemeinsame P3-Rundlauf.
Vollständige Haus-/Parzellen- und Innenraumwerkzeuge bleiben P5/P6.
K1–K6 bleiben erledigt; zusätzliche allgemeine Konsolidierung ist keine
vorgeschaltete Aufgabe.
