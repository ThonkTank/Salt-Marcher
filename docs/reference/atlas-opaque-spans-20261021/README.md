# Deckende Rasterflächen direkt setzen

Lokaler P3-Teilstand vom 21.10.2026, Runtime `b682c02e`. Bestehender Atlas,
gleiche Pixel und Autorenmodelle. Keine Main-/Candidate-CI-, Paket-,
Installations- oder Nutzerabnahme. Die vollständige Atlasroadmap bleibt offen.

## Änderung und Schutzregeln

Das CPU-Profil der Farbberechnung zeigte erheblichen Aufwand in der
Polygonfüllung. Auch vollkommen deckende Pigmentmasken berechneten für jeden
Pixel die Alpha-Komposition mit dem Hintergrund. `polygonSteps` setzt jetzt
deckende Zeilenabschnitte unmittelbar über eine gepackte Sicht auf denselben
RGBA-Puffer. Es entsteht kein zweiter Bildpuffer. Die gepackte Farbe verwendet
die Byte-Reihenfolge der Plattform, keine angenommene Endianness.

Nur Deckkraft eins ohne Land-/Wasserfilter verwendet diesen Weg. Transparente
Flächen und gefilterte Pixel behalten die bisherige Komposition. Ein eventuell
gleichzeitig geschriebenes Wasserflag wird im selben Abschnitt gesetzt.
Vollständig außerhalb liegende Abschnitte werden vor dem Zugriff verworfen;
negative Typed-Array-Indizes dürfen nicht auf das Pufferende zurückfallen.
Polygone, Löcher, Scanline-Positionen und Haltepunkte bleiben unverändert.

## Regressionen

[Drei neue Fälle](opaque-tests.log) vergleichen die Ausgabe bei positiven,
negativen und weit entfernten Weltkoordinaten mit vier unabhängigen
Autoren-Punktabfragen je Ausgabepixel. Sie prüfen Löcher, schräge halbtransparente
Überlagerung, vollständig links/rechts abgeschnittene Flächen und RGBA-Farben.
Das bestehende Pigmentorakel bleibt pixelgleich.

Die [erste Auswahl](initial-tests.log) bestand 28 Farb-/Pinsel-Fälle und zwei
Küstenfälle. Zwei weitere Küstentests scheiterten auch im unveränderten
[Referenzstand `ff144fe68`](baseline-coast-tests.log): Sie erwarteten noch den breiten Küstensaum vor der
bereits dokumentierten schmalen Kontur. Ihre Erwartungen prüfen jetzt genaue
Mischpixel beider Uferseiten sowie unveränderte direkte Nachbarn, Seeufer und
Zeichenreihenfolge über Pigment und unter Flüssen. Es wurde kein Küstenstil
geändert und keine Fehlerschwelle pauschal gelockert.

[Alle sieben Küstenfälle](coast-tests.log) bestehen danach. Zusammen sind
38 unterschiedliche Fälle bestanden. [App-](check.log) und
[Desktop-Typprüfung](check-desktop.log) endeten mit Exit 0.

[Repositoryprüfung](check-repo.log) bestanden. Kamera- und Pinselablauf im
gemeinsamen Capability-Katalog enthalten die tatsächlichen neuen Testdateien
und einen aktualisierten `--geprueft`-Vermerk.

## Gepaarter Worker-Vergleich

[Messdaten](paired.json): Referenz `ff144fe68`, aktuell `b682c02e`. Vier neue
Worker in der Reihenfolge Referenz, aktuell, aktuell, Referenz; jeweils gleiche
aufgewärmte Geometrie, kalte Detailfarbe, zwölf überlagerte Pigmentflächen und
24 Farbkacheln. Auswahlabfragen laufen wiederholt während der Berechnung.
Alle vollständigen Pixelpuffer besitzen denselben SHA-256.

| Lauf | Detailfarbe vollständig | Auswahl p95 | Auswahl maximal | Worker-Schritt maximal |
| --- | ---: | ---: | ---: | ---: |
| baseline | 30.29 s | 11.9 ms | 23.5 ms | 32.6 ms |
| current | 17.36 s | 11.9 ms | 47.8 ms | 50.0 ms |
| current | 16.68 s | 11.9 ms | 46.8 ms | 59.4 ms |
| baseline | 26.18 s | 10.5 ms | 44.3 ms | 48.1 ms |

Die beiden aktuellen Läufe benötigen im Mittel rund 40 % weniger Zeit.
Es liefen keine eigenen parallelen Builds, Tests oder nativen Proben. Andere
Arbeit auf dem geteilten Rechner blieb aktiv. Einzelne Maxima steigen; diese
Messung ist keine 16-ms-Zeitgarantie. Die bisherige Unterbrechbarkeit bleibt
erhalten, ersetzt aber keine vollständige Latenzqualifikation.

Reproduktion mit einer behaltenen Referenzquelle unter `~/.cache/saltmarcher/`:

```sh
TERRAIN_BASELINE_SOURCE=/path/to/retained-source TERRAIN_PIGMENT_PROBE=1 QA_EVIDENCE_DIR=.build/opaque-paired node tools/measure-terrain-colour-cost.mjs
```

## Nativer Hauptatlas

Der [wörtliche Repository-Entwicklungsstart](main-result.json) auf `b682c02e`
besteht: Übersicht vor Detailfarbe, Zoom während Nachladung, gleiche Fläche
bei Neigung/Rotation, automatische Konturen, GPU-Ausfall und ausdrücklicher
Wiederanlauf, weite Horizontabdeckung und Exportpixel. Regulärer Exit 0,
anschließend abwesender PID und keine Rendererfehler. Main, Preload, Renderer
und HTML sind im Ergebnis gehasht. Die [gekippte Hauptfläche](main-02-repository-tilt-zoom.png)
ist visuell geprüft; dieser Schritt verändert keine Gestaltung.

[Direkte Formen-, Glättungs- und Farbbearbeitung](live-result.json) besteht
ebenfalls, einschließlich Profilabfrage, Escape/Fokusverlust, geneigter
Hauptkamera, einem Undo pro Pinselzug und Wiederöffnung im frischen Prozess.
Beide Starts endeten mit Exit 0 und abwesenden PIDs, ohne Rendererfehler. Die
vier gemeinsamen Build-Hashes stimmen mit der Entwicklungsstart-Probe überein.
Der Dirty-Vermerk betrifft Dokumentation und vorhandene ungetrackte Belege;
der Runtime-Stand blieb unverändert. Die [gespeicherte Farbe](live-02-color-stopped.png)
ist visuell geprüft. Diese funktionalen Proben sind keine allgemeine
Bildraten- oder Eingabelatenzqualifikation.

## Verbleibende Arbeit

Auch 17 Sekunden vollständige Verfeinerung erfüllen das Ziel noch nicht.
Höhensampling, Schattierung, kumulative Pigmentkomposition, Wiederverwendung
zwischen Kacheln und weitere synchrone Arbeit bleiben zu untersuchen. Der
Pixelvergleich belegt Kompatibilität, keine Verbesserung der Kartengestaltung.
Die drei abschließenden vollständigen Audits haben noch nicht begonnen.
