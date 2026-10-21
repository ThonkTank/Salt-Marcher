# Weiche Bodenfarbe an Bewuchsrändern

21.10.2026. Teilschritt der gemeinsamen Atlas-Roadmap P4; Grundlage ist
`da562e109a3fe6c9ba62541d4568385cef0dfec9` mit den im
[nativen Ergebnis](main-atlas.json) aufgeführten lokalen Quellhashes.

## Änderung und Bildprüfung

Die Bodenfarbe von Landschaftsbeständen endete mit voller Deckkraft an der
Polygonkante. Sie läuft jetzt nach innen weich aus, auch an ausgeschnittenen
Lichtungen. Die vorhandene Randbreite der Vorlage bestimmt den Übergang;
bei positiven Werten erhält die Farbabtastung mindestens drei logische Pixel.
Randbreite null bleibt scharf. Die tatsächlichen Autorenflächen, ihre Auswahl,
Objektidentitäten und Wasserflächen verändern sich nicht.

[Isolierter Vergleich](comparison.png): links bisherige harte Bodenfarbe,
rechts weicher Verlauf, jeweils drei Maßstäbe. Die folgende native Prüfung
verwendet den normalen Hauptatlas, dieselbe Kamera und dessen Ausgabedialog:
[80-km-Übersicht](world.png), [1,2-km-Ausschnitt](village.png),
[geneigte 300-m-Ansicht](tilted.png), [gespeichertes PNG](export.png).
Die weichere Kante ist besonders nah sichtbar. Die Weltansicht bleibt eine
weitgehend einfarbige Fläche; die facettierten Kronen bleiben zu gleichförmig.
Dieser Schritt ist keine Abnahme der angestrebten Fantasy-Kartengestaltung.

## Implementierung und Prüfungen

Ein eigener Rasterhelfer berechnet Abstand zu den wirklichen Polygonrändern,
niemals zum Kachelrand. Besucht werden nur Zeilenabschnitte im Randbereich.
Unterhalb eines Viertels des Supersample-Abstands vereinfachte Anzeigekanten
begrenzen den Aufwand bei komplexen Flächen. Originalgeometrie bleibt erhalten.
Multipart-Flächen werden für die Darstellung vereinigt, damit überlappende
Teile keine inneren Farbsäume erzeugen. Vollständig innenliegende Kacheln
benötigen kein Abstandsfeld.

Die Farbberechnung gibt zwischen Arbeitsblöcken den Readonly-Worker frei.
Der gemeinsame paginierte Landschaftsleser übernimmt deshalb auch Bewuchs:
128 Sortierschlüssel pro Seite, jeweils ein Payload, kein offener SQL-Cursor
zwischen Records. Pigmentreihenfolge und große SQLite-IDs bleiben erhalten.

- [32 Regressionen](tests.log): äußere Ränder/Löcher, Wasser, scharfer Nullrand,
  überlappende Teile, unterbrechbare/synchrone Gleichheit, Nachbarkacheln,
  entfernte Ursprünge, komplexe Grenzen und genaue unabhängige Distanzprüfung;
  außerdem Bewuchsbestand, Pigmentkomposition und freigegebene SQL-Statements.
- [6 Farbkachelprüfungen](color-tests.log): tatsächlicher Projektionsleser gegen
  einzeln geladene Nachbarkacheln einschließlich Waldfläche/Lichtung/Höhenlinien.
- Beide TypeScript-Prüfungen und Desktopbuild bestanden.
- Native Probe: vier Maßstäbe, Neigung, Export, unveränderte Autorenzeilen und
  geschützte Identitäten, keine Rendererfehler, normaler Exit und beendete PID.
  Profilprozesse nach Abschluss separat als beendet geprüft.

Tatsächliche Testdateien:
[Randraster](../../../tests/landscape-cover-feather.test.mjs),
[SQL-Leser](../../../tests/terrain-pigment-stream.test.mjs),
[Farbkacheln](../../../tests/terrain-color-tiles.test.mjs),
[Hauptatlas](../../../tools/test-desktop-forest-style.mjs).

## Kosten und offene Arbeit

Die zusätzliche Randberechnung kostet Zeit. Eine kleine CPU-Probe mit
256×256 Ausgabepixeln verglich die HEAD-Basis und diesen Stand sequenziell;
20 Wiederholungen, Median der letzten fünf, keine parallele eigene UI-Prüfung.
[Messwerte](cost.json): innen 37,19 → 38,92 ms, einfacher Rand 28,31 → 41,02 ms,
2000-Punkte-Rand 39,14 → 60,42 ms. Das ist keine randomisierte Benchmarkserie
und kein Nachweis besserer Gesamt-Latenz. Gleiche innere Flächen behalten ihre
Pixel; Randpixel ändern sich beabsichtigt. Die gesamte Ladeleistung bleibt offen.

Waldtexturen und Kronengestaltung, weitere Geländearten, Feature-Werkzeuge,
Wasser-/Straßenabläufe und die vollständige Zoomqualifikation bleiben Arbeit.
Keine Paketinstallation oder Nutzerabnahme; keine der drei abschließenden
Gesamtuntersuchungen ist erreicht.
