# Wiederkehrende Rechnung überlappender Pinselabdrücke teilen

Lokaler P3/P5-Teilstand vom 21.10.2026. Runtime `f1520ba2`. Der vorhandene
Atlas verwendet denselben Farbrasterkern für Nachladung, Vorschau und Ausgabe.
Keine Main-/Candidate-CI-, Paket-, Installations- oder Nutzerabnahme.

## Änderung

Bei weichen und texturierten Pinselzügen berechnete jeder Abdruck die
Weltkoordinaten aller überdeckten Samples erneut. Texturkoordinaten wurden
für jeden Überlappungsschritt nochmals quantisiert. Der CPU-Profiler zeigte
diese Arbeit innerhalb der dominierenden Strichabdeckung.

`landscape-pigment-coverage.ts` besitzt jetzt die Abdeckung eines Strichs;
`LandscapeRasterizer` bleibt Besitzer von Masken, Farbschichten und Komposition.
Das neue Modul berechnet Weltachsen einmal pro Strich in Float64, quadratische
x-Abstände einmal pro Abdruck und y-Abstände einmal pro Zeile. Texturachsen
werden vorab in die bisherigen ganzzahligen Hashanteile überführt. Die kleine
zusätzliche Ablage wächst mit Breite plus Höhe, nicht mit der Bildfläche.

Abdruckreihenfolge, Gleitkommaoperationen, Float32-Abdeckungsakkumulation,
Pinselspitze, Auftrag, Transparenz, Radierer und bestehende Masken bleiben
erhalten. Teilstriche und leere Teilstriche behalten ihre Semantik. Ganz
außerhalb liegende Abdrücke werden früh verworfen. Der Generator hält die
Unterbrechungspunkte mit ausschließlich eigenen Arrays aufrecht.

## Regressionen

[30 bestehende Fälle](tests.log) prüfen kumulative Farbe, alte Pigmente,
Radierer, Autoren-/Geometrietrennung, Undo, Wiederöffnung, den echten Farbworker
und veraltete Quellen. [Drei zusätzliche Pixelorakel](coverage-tests.log) aus
`bc8908757` prüfen die Weltursprünge 0 und ±1 Milliarde Meter. Jede Fixture
enthält weiche, runde und texturierte Züge, Löcher, mehrere Teilstriche,
wiederholte Punkte, entfernte Abdrücke, Wasserfarbe und Radierer. Alle Pixel
sind identisch; die Abdeckung bleibt unterbrechbar. Insgesamt 33 verschiedene
Fälle bestanden. [App-](check.log) und [Desktop-Typprüfung](check-desktop.log)
endeten mit Exit 0.

[Repositoryprüfung](check-repo.log) bestanden. Kamera- und Pinselablauf im
gemeinsamen Capability-Katalog sind mit den tatsächlichen neuen Testdateien
und `--geprueft` aktualisiert.

## Gepaarter Worker-Vergleich

[Messdaten](paired.json): neue Fixture mit sechs überlappenden Pinselzügen,
drei Spitzenarten, Wasserfarbe und Radierer. Beide Quellen erhalten dieselben
gespeicherten Polygone, Höhen und Anfragen. Referenz `bc8908757`, anschließend
committeter Runtime-Stand `f1520ba2`; die Messung entstand unmittelbar vor
diesem Commit mit unveränderten Runtime-Dateien. Reihenfolge: Referenz, aktuell,
aktuell, Referenz. Jeweils neuer Worker, gleiche vorbereitete Geometrie und
kalte Detailfarbe. 24 Kacheln, wiederholte Auswahlabfragen während der Arbeit.
Alle vollständigen Pixelpuffer besitzen denselben SHA-256.

| Lauf | Detailfarbe vollständig | Auswahl p95 | Auswahl maximal | Worker-Schritt maximal |
| --- | ---: | ---: | ---: | ---: |
| baseline | 9.02 s | 15.4 ms | 48.0 ms | 49.6 ms |
| current | 7.42 s | 13.1 ms | 25.5 ms | 28.1 ms |
| current | 7.62 s | 14.2 ms | 22.1 ms | 25.6 ms |
| baseline | 8.36 s | 15.1 ms | 22.0 ms | 26.0 ms |

Der aktuelle Stand benötigt im Mittel rund 13 % weniger Zeit. Es liefen keine
eigenen parallelen Builds, Tests oder nativen Proben. Zwei Läufe pro Variante
auf dem geteilten Rechner sind keine allgemeine Lastqualifikation. Die
Auswahlzeiten sind Worker-Antwortzeiten, keine Bildschirm-Framerate.

Reproduktion mit einer behaltenen Referenzquelle unter `~/.cache/saltmarcher/`:

```sh
TERRAIN_BASELINE_SOURCE=/path/to/retained-source TERRAIN_PIGMENT_PROBE=brush QA_EVIDENCE_DIR=.build/brush-paired node tools/measure-terrain-colour-cost.mjs
```

## Nativer Hauptatlas

Der [wörtliche Entwicklungsstart](main-result.json) auf `f1520ba2` besteht:
Kampagne öffnen, Übersicht vor Detailfarbe, Zoom während Nachladung, gleiche
Hauptfläche bei Neigung/Rotation, automatische Konturen, tatsächlicher
GPU-Ausfall und ausdrücklicher Wiederanlauf, Horizont-/Exportpixel.
Regulärer Exit 0, anschließend abwesender PID und keine Rendererfehler.
Main, Preload, Renderer und HTML sind im Ergebnis gehasht.

Die [gekippte Hauptkarte](main-02-repository-tilt-zoom.png) ist als Teil dieses
normalen App-Einstiegs festgehalten. Die einfache Hügel-Fixture qualifiziert
keine vollständige Kartengestaltung oder Großwelt.

[Direkte Terrain- und Farbbearbeitung](live-result.json) auf demselben Build
besteht: Formen vor dem Loslassen, Profil ohne Schreiben, Glätten, halbtransparente
kumulative Farbe, Escape, Fokusverlust, geneigte Hauptkamera, frischer Prozess
und jeweils ein Undo pro Pinselzug. Beide Starts endeten regulär mit Exit 0,
abwesenden PIDs und ohne Rendererfehler. Die gemeinsamen Main-/Preload-/Renderer-/
HTML-Hashes stimmen mit der Entwicklungsstart-Probe überein. Der Dirty-Vermerk
betrifft Dokumentation und vorhandene ungetrackte Belege; Runtime-Dateien wurden
zwischen den Proben nicht verändert. Die [gespeicherte Farbe](live-02-color-stopped.png)
ist visuell geprüft. Diese Probe belegt Funktion, keine allgemeine Eingabelatenz.

## Verbleibende Arbeit

Die vollständige kalte Detailfarbe bleibt zu langsam. Gemeinsame Schattierung,
Pigmentkomposition, Datenversorgung und große Autorenbestände sind weiter zu
verbessern. Dieser Schritt ändert keine Kartengestaltung und qualifiziert nicht
sämtliche Maßstäbe oder Autorenwerkzeuge. Die vollständige Roadmap und ihre
drei abschließenden kritischen Untersuchungen bleiben offen.
