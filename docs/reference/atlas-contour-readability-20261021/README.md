# Lesbare Höhenlinien im normalen Atlas

Stand: 21.10.2026. Produktänderung `f7f7a53f4`, nativer Prüfstand `8bdb6d29280d92d8ed83dfe9ce0b3e1bf944acee`. Der normale Repository-Einstieg `npm run start:desktop` und die vorhandene Hauptkamera wurden geprüft. Die separate Geländeansicht bleibt entfernt.

## Änderung und gestalterische Entscheidung

Automatische Höhenlinien richten ihre Dichte nach **logischen Anzeigepixeln**. Der Zielabstand steigt von 12 auf 24 px; verschachtelte Zweierintervalle werden weiterhin weich überblendet und behalten ihre tatsächlichen Höhen. Die lokale Steigung bestimmt das Intervall. Hauptlinien bleiben stärker als Zwischenlinien. Feste Meterintervalle und „Aus“ bleiben verfügbar.

Der [isolierte Vorvergleich](comparison-result.json) verwendete den Produktrenderer mit derselben Projektion, Farbe und Kamera. Nur die Abstands-Konstante wurde im Prüfbundle auf 12/24/36 gesetzt. Vier Szenen in zwei Kameraneigungen ergeben 24 Bilder; acht aussagekräftige Bilder sind hier erhalten. Das Werkzeug [test-desktop-contour-readability.mjs](../../../tools/test-desktop-contour-readability.mjs) erzeugt den vollständigen Vergleich. Dies war ein technischer Stilversuch, kein zusätzlicher Produkteinstieg.

| Motiv | Vorher: 12 px | Gewählt: 24 px | Verworfen: 36 px |
| --- | --- | --- | --- |
| Geneigter Hügel | [Bild](hill-12-45.png) | [Bild](hill-24-45.png) | [Bild](hill-36-45.png) |
| Mit Pinseln angelegtes Relief | [Bild](painted-region-12-45.png) | [Bild](painted-region-24-45.png) | [Bild](painted-region-36-45.png) |

24 px hält die Flanken lesbar und verringert die enge Linienschraffur. 36 px verliert stellenweise zu viel Höheninformation. Diese Auswahl ist eine Implementierungsentscheidung, keine Nutzerabnahme der endgültigen Kartengestaltung.

Der Renderer übergibt seine tatsächliche Pixeldichte an das Konturenmaterial. Der gemeinsame CPU-Kern berücksichtigt seine zweifache Abtastdichte je Achse. Damit bleiben Intervallwahl und Strichbreiten auf den logischen Bildmaßstab bezogen; die Kantenglättung arbeitet weiterhin mit physischen Pixeln. Breiten und Deckkräfte stehen gemeinsam in `terrain-contour-style.ts`. Die perspektivische Ausgabe arbeitet mit Pixeldichte 1 bei ihrer angeforderten Bildauflösung.

## Prüfung im erreichbaren Atlas

- [Repository-Start](repository-result.json): normale Kampagnennavigation, Zoom während des Nachladens, Neigen/Drehen auf derselben Fläche, tatsächlicher Grafikverlust mit vollständigem Canvasfallback und ausdrücklicher Wiederanlauf. Die [geneigte Hauptkarte](main-tilted.png) zeigt den integrierten Atlas.
- Die GPU-Pixelprobe im selben Lauf prüft vier automatische Maßstäbe, feste Intervalle, Wasserflächen und gekachelte Ausgabe. Sechs Kombinationen aus zwei Maßstäben und Pixeldichten 1/1,5/2 stimmen exakt mit den erwarteten 8-Bit-Farbwerten überein. Der Vergleich kompletter und geteilter Ausgabe hat maximalen Pixelfehler 0.
- [Hauptatlas bei 100/200 %](display-result.json): dieselbe 900-m-Kartenbreite, derselbe Weltmittelpunkt, reale Menüwechsel zwischen automatisch, aus und 50 m. Beide Dichten zeigen **37 automatische und vier feste Linienkreuzungen** in der untersuchten Bildzeile. Die Positionen weichen höchstens 0,5 logische Pixel ab. Bilder: [100 %](display-100.png), [200 %](display-200.png). Der Renderer verwendet dabei tatsächlich 1 beziehungsweise seine begrenzten 1,5 Pixel je logischem Pixel.
- Die erste Displayprobe scheiterte an einer [zu strikten Höhen-Gleichheitsprüfung](display-rounding-failure.json): Fensterrundung ergibt 717 beziehungsweise 716 logische Kartenpixel. Die korrigierte Probe toleriert ausschließlich diesen einen Pixel, prüft gleiche Weltbreite und gleichen Mittelpunkt sowie die tatsächlichen Linienpositionen. Sie verändert keine Produktdarstellung.
- [Objekte und Ausgabe](objects-result.json): Dachauswahl, kanonische Gebäudehöhen mit unveränderten Räumen, gekachelter [perspektivischer PNG-Export](building-export.png) und Wiederöffnung im frischen Prozess.

Alle finalen nativen Abläufe verwenden identische Produktbuilds, enden normal mit verschwundenen PIDs und enthalten keine Rendererfehler. Sie liefen nacheinander ohne eigene parallele Builds/CPU-Prüfungen. `dirty: true` umfasst die Belegdokumente, die Korrektur der Displayprobe und erhaltene historische ungetrackte Verzeichnisse; die Produktquellen sind committed. Diese Stichprobe prüft keine laufenden Wechsel zwischen Monitoren.

## Automatisierte Regressionen

[30 Kontur-, Relief-, Kachel- und Quellenfälle](contour-tests.log) und [23 Kamera-, Treffer-, Delta- und Ausgabefälle](camera-output-tests.log) bestehen. Darunter: kontinuierliche Intervallgrenzen, unveränderte Haupthöhen bei höherer Pixeldichte, konstante logische Strichbreite, Wasserunterdrückung, nachträgliche Antworten, nahtlose Farbkacheln, gefrorene Pinsel-Trefferflächen und Exportkachelprojektion. App- und Desktop-Typechecks sind grün ([App](check.log), [Desktop](check-desktop.log)); [Repositoryprüfung](check-repo.log) besteht.

Die drei konturlosen Farbgoldens bleiben unverändert gegen `terrain-color-goldens.json`. Die sechs absichtlich geänderten Konturbilder liegen separat in [terrain-contour-goldens.json](../../../tests/fixtures/terrain-contour-goldens.json); die alte Referenzdatei bleibt erhalten. Zwei ältere Treffer-Tests erwarteten noch zeilenweise Texturupdates. Sie prüfen jetzt den bestehenden Rechteckpfad einschließlich Zieltextur, aktuellem CPU-Puffer und tatsächlichen Rechteckkoordinaten. Die reale GPU-Pixelgleichheit prüft weiterhin der native Repository-Lauf.

## Verbleibende Grenzen

Eckige Höhenlinien sind bei groben kanonischen Höhendaten weiterhin sichtbar. Im Nahvergleich zeigt derselbe analytische Hügel mit [16-m-Quelldaten](close-coarse-24-0.png) deutlich polygonale, mit [4-m-Quelldaten](close-fine-24-0.png) wesentlich glattere Konturen. Das ist eine Ursachenprobe, keine nachträgliche Verfeinerung gespeicherter Landschaften. Das gemalte Relief zeigt weiterhin Treppen und Plateaukanten. Gelände, sichtbare Konturen und Pinsel-Trefferfläche müssen gemeinsam verbessert werden.

Die [Canvasdarstellung nach Grafikverlust](graphics-fallback.png) bleibt sichtbar gröber und weicher als die GPU-Linien. Küstenschärfe, kalte Ladezeit, Horizontabdeckung und semantische Objekt-/Namensstufen werden durch diesen Schritt nicht gelöst. Große Welten, lange Sitzungen, Spieleranzeige und die übrige [Roadmap](../../plans/maps/unified-spatial-atlas.md) bleiben offen. Candidate-CI, Main-Integration, Paket, Installation und Nutzerabnahme sind nicht erfolgt. Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
