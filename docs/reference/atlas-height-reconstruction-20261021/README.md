# Gemeinsame begrenzte Höhenrekonstruktion

Stand: 21.10.2026. Produkt- und nativer Prüfstand: `60cd73b5fabd98f066b39655c2b56927f7f85ec6`; Speicheranschluss: `171bc194d4812b7187747a7f9489b1288b976ad0`. Der bestehende Hauptatlas aus `npm run start:desktop` verwendet jetzt dieselbe begrenzte kubische Kurve in Punktabfragen und gestreamten Höhen. Der [isolierte Vorvergleich](../atlas-height-lattice-20261021/README.md) bleibt als historischer Beleg erhalten.

## Kurve, Daten und Nachbarschaft

Der gemeinsame Kernel erhält Knotenwerte, affine Innenflächen und Plateaugrenzen. Fehlende absolute Knoten erben den gröberen Wert am Abfragepunkt; additive Lücken bleiben null. Die Reihenfolge ist immer x, dann y. Geometrie, Farbe, Wasserentscheidung und Höhenabfragen verwenden dieselbe Rekonstruktion. Sichtbare Treffer bleiben an die tatsächlich gezeichneten Netzdreiecke gebunden.

Gespeicherte Höhenwerte, Revisionen und Autorenpolygone bleiben unverändert. Abgeleitete Suchgrenzen und präzise Invalidierung umfassen jetzt zwei Nachbarknoten. Schema 54 erweitert vorhandene Grenzen einschließlich der History-Zeilen. Nur bekannte alte History-Fingerabdrücke werden umgesetzt; Konflikte bleiben erhalten. Ein Fehler bricht die Migration atomar ab. Archivvorschauen ändern das Original nicht; die Übernahme migriert ihre Arbeitskopie.

Der Stream sammelt benötigte Quellknoten einmal pro Auflösung und begrenztem Band. Horizontale Zwischenwerte werden wiederverwendet. Nur Zeilen mit fehlenden Knoten hängen vom geerbten Wert des jeweiligen Ausgabepunkts ab und werden dort neu berechnet; vollständige Nachbarzeilen bleiben auch in gemischten Zellen erhalten. Weltkoordinaten bleiben Float64, und keine vollständigen Autorenkacheln werden im Feldkern aufbewahrt.

## Numerik und Regressionen

[Neue Regressionen](../../../tests/terrain-reconstruction.test.mjs) prüfen exakte Knoten, affine Innenflächen, begrenzte Extrema, kontinuierliche Flanken, echte SQL-Nachbarlesungen, bestehendes Undo/Redo, Konflikte, Rollback, Archivkopie sowie warme Höhen-/Farb-/Mesh-Caches nach einer Änderung außerhalb der bisherigen Nachbarschaft. Der RMSE am analytischen Hügel mit 16-m-Knoten sinkt von 0,16344 auf unter 0,022 m. Das ist ein numerischer Vergleich, keine Aussage zur gesamten Gestaltung.

Die [erste breite Prüfung](terrain-tests-first.log) enthält 306 Fälle: 303 bestanden unmittelbar. Drei Abweichungen wurden gezielt behandelt und erneut geprüft:

- Die Reiseprüfung verwendete ein veraltetes gemeinsames Store-Bundle. Nach `node build.mjs --test` bestehen [alle 45 Reisefälle](travel-tests.log).
- Neue Kurven verändern die Konturpixel. Die neun aktuellen Pixelgoldens stehen getrennt in `tests/fixtures/terrain-reconstruction-goldens.json`; historische Referenzen bleiben erhalten. Der [visuelle Vergleich](pixel-comparison.png) zeigt je Stil links bilinear/rechts kubisch, in den Zeilen ohne/automatische/feste Konturen. Die historischen Hashes werden beim Erzeugen ebenfalls geprüft. [Reproduzierbares Werkzeug](../../../tools/render-terrain-reconstruction-goldens.mjs).
- Die Differenz zweier gebrochener Eingangshöhen war 20,000000000000014 statt 20 m. Nur diese Translationsprüfung verwendet jetzt eine Toleranz von 10⁻¹⁰ m. Gebäude-, Raum-, History- und Höhenbindungen bleiben exakt geprüft.

Die [zwölf wiederholten Farb-/Objektfälle](corrected-tests.log) bestehen. Nach der zusätzlichen Wiederverwendung vollständiger Zeilen bestehen [24 Kern-, SQL-, Migrations- und Pixelregressionen](kernel-tests.log), einschließlich exakter Float32-Übereinstimmung von Punktabfragen und Stream an negativen Kachelgrenzen, mit Lücken, additiven Bändern, Seen/Trassen und weit entfernten Koordinaten. [App](check.log), [Desktop](check-desktop.log) und [Repositoryprüfung](check-repo.log) bestehen. Der normale Entwicklungsstart baut die finalen Desktopartefakte neu.

## Aufwand und normale Hauptkarte

Die [gepaarte Kernmessung](kernel-result.json) verarbeitet jeweils 1.048.576 Samples; Reihenfolge vorwärts und rückwärts. Historische Kerne sind auf Gitstände festgelegt, die aktuelle Variante enthält zusätzlich Quellenhashes. Es liefen keine eigenen nativen Proben oder CPU-Prüfungen parallel; andere Hostarbeit wurde nicht verändert.

| Feld | Ursprünglicher bilinearer Kern | Zuletzt optimierte bilineare Sammlung | Aktuelle begrenzte kubische Kurve |
| --- | ---: | ---: | ---: |
| Vollständiger Hügel | 333 / 294 ms | 121 / 89 ms | 92 / 74 ms |
| Drei Auflösungen mit absoluten/additiven Lücken | 823 / 752 ms | 336 / 323 ms | 576 / 489 ms |

Der Lückenfall bleibt gegenüber der zuletzt optimierten bilinearen Sammlung teurer. Die [erste integrierte kubische Fassung](first-kernel-result.json) benötigte dafür noch 1.228/1.200 ms; die Wiederverwendung vollständiger Nachbarzeilen verringert diesen Zusatzaufwand. Das sind Feldkernzeiten, keine Bildraten oder garantierten Eingabelatenzen.

- [Repository-Start](repository-result.json): normale Kampagnennavigation, Zoom während des Nachladens, Neigen/Drehen auf derselben Fläche, tatsächliche GPU-Pixelprüfung, Grafikverlust und Wiederanlauf. Die Übersicht erscheint in diesem Lauf nach 2.060 ms, die erste feine Farbe nach 2.409 ms, die vollständige Verfeinerung nach 6.609 ms. Kaltes Laden bleibt damit eine mehrsekündige Aufgabe. [Geneigter Hauptatlas](main-tilted.png), [Canvasfallback](graphics-fallback.png).
- [Live-Bearbeitung](live-result.json): Formen, Glätten, kumulative Farbe, Escape, Fokusverlust, Höhenprofil, geneigter Pinselzug, frisches Öffnen und einmaliges Undo. [Bild während des geneigten Pinselzugs](main-live.png).
- [Küste](coast-result.json): schrittweises Nachladen, geneigte Darstellung derselben Hauptfläche und tatsächliche GPU-Upload-Pixel. [Hauptkarte mit Küste](main-coast.png).
- [Objekte und Ausgabe](objects-result.json): Dachauswahl, Höhenänderung ohne Raumänderung, gekachelter perspektivischer PNG-Export und frisches Öffnen. [Ausgabebild](building-export.png).

Alle vier finalen nativen Abläufe verwenden identische Main-, Preload-, Renderer- und HTML-Builds. Sie liefen nacheinander, endeten normal mit verschwundenen PIDs und enthalten keine Rendererfehler. Die Produktänderungen waren committed; `dirty: true` umfasst Belege und die erhaltenen historischen ungetrackten Verzeichnisse.

## Offener Gesamtumfang

Die visuelle Prüfung zeigt rundere grobe Höhenlinien. Feine Unregelmäßigkeiten im geneigten Geländenetz, grobe Formen gemalter Plateaus, weiche Küsten und der weichere Canvasfallback bleiben sichtbar. Glatte Rekonstruktion allein liefert keine fertige Kartengestaltung.

P3/P4 und die übrige [Roadmap](../../plans/maps/unified-spatial-atlas.md) bleiben offen: kalte Ladezeit, weitere Lückenfeldkosten, weltweite Geometrie-LOD, Küstenschärfe, semantische Straßen-/Fluss-/Bewuchs-/Objekt-/Namensstufen, Innenräume, Spieleranzeige sowie große Welten und lange Sitzungen. Candidate-CI, Main-Integration, Paket, Installation und Nutzerabnahme sind nicht erfolgt. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
