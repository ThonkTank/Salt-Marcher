# Bemalte Terrainfarbe unterbrechen und fortsetzen

Lokaler P3-Teilstand vom 21.10.2026, Runtime `b3022b51`, finale Kontextgröße und erweiterte Paginationprobe `ebfa5ee3`. Der normale Atlas
und sein vorhandener Readonly-Worker bleiben die Ausführungspfade.
Keine Main-/Candidate-CI-, Paket-, Installations- oder Nutzerabnahme.
Das Gesamtziel und die drei abschließenden kritischen Untersuchungen bleiben offen.

## Ursache und Änderung

Die bisherigen Raster-Haltepunkte unterbrachen Höhenabtastung und Schattierung,
aber nicht die Verarbeitung einer einzelnen großen Farbschicht. Zwölf
überlagerte Füllflächen hielten den Worker im abschließenden gepaarten Versuch
bis zu 641 ms am Stück fest. Eine Auswahl musste auf das Ende dieses
Schrittes warten, obwohl sie in der Warteschlange Vorrang besitzt.

`LandscapeRasterizer.paintColorSteps` teilt Polygonrasterung, Pinselabdeckung
und kumulative Komposition in unterbrechbare Schritte. Der synchrone Pfad
verbraucht denselben Generator. Nur fertig berechnete Rasterteile dürfen
in den Cache und zur Anzeige gelangen. Füllflächen erzeugen keine unnötigen
Pinselstempel oder Abdeckungspuffer; konstante Pigmentfarben bleiben außerhalb
des Maskenpuffers, sodass dessen vollständiger Farbumschreibedurchlauf entfällt.

Ein Unterbrechungspunkt darf keinen SQLite-Iterator offen halten.
`landscape-record-stream.ts` liest deshalb höchstens 128 schmale Sortierschlüssel
je Seite, danach genau einen Autoren-Payload mit einer abgeschlossenen Abfrage.
Die Fortsetzung verwendet den letzten vollständigen Schlüssel, kein OFFSET.
Ein partieller Index enthält ausschließlich Farbschichten. Alte Schichten,
Auflösung, Reihenfolge, große Row-IDs und verknüpfte Ortsnamen behalten ihre
Bedeutung. Der Worker beendet weiterhin seinen WAL-Schnappschuss und prüft
vor jeder Fortsetzung die Quelle; ein zwischenzeitlicher Commit verwirft die
alte Antwort.

Kontextprojektionen behalten ihre 64er-Pakete; eigenständige Farbkacheln
verwenden weiterhin 128er-Pakete. Die Invalidierungsstücke bleiben 32 Pixel groß.
Ein [Vergleich größerer Kontextpakete](context-experiment.json) zeigte zwar
2,41–2,90 statt 2,97–2,98 s Gesamtzeit, aber längere Worker-Schritte: p95
18,2–19,3 statt 12,2–13,1 ms, Maximum bis 82,8 statt 17,8 ms. Die probeweise
Vergrößerung wurde deshalb vor der nativen Prüfung zurückgenommen. Die größere
Paketgröße betrifft somit nur diesen dokumentierten Versuch, nicht den finalen
Kontextpfad. Die fünf Projektionsservice-Fälle wurden anschließend erneut
[bestanden](context-final-services.log).

## Regressionen

49 unterschiedliche Fälle aus den beiden abschließenden Testauswahlen
([Services](services.log), [Regressionen](regressions.log)) bestanden:
Farb- und Projektionsservice, Quellenwechsel, lokale Invalidierung, Rastercache,
Höhenstream, Farbkacheln und getrennte Farb-/Geometriebearbeitung.
Die neue Pigmentprobe prüft 301 alte und aktuelle Schichten einschließlich
Row-IDs oberhalb der JavaScript-Integergrenze. Ein Indexwechsel während des
pausierten Streams belegt, dass kein aktiver SELECT zurückbleibt.

Texturierte Pinselzüge, Füllung, alte Schichten und Radierer stimmen außerdem
mit einem SHA-256-Pixelorakel des vorigen Renderers `9842ac876` überein.
Der entsprechende [Test](golden.log) wurde nach Hinzufügen des Orakels erneut bestanden.
Die Prüfung der feinen Fallbackauflösung misst den Weltabstand pro Pixel;
der Kachelzuschnitt aus dem vorigen Teilschritt verändert diese Dichte nicht.
[App-](check.log) und [Desktop-Typprüfungen](check-desktop.log) bestanden. Ein früherer Typprüfungsprozess endete
mit Signal 15 ohne TypeScript-Fehlerausgabe; der vollständige Wiederholungslauf
endete mit Exit 0.

[Repositoryprüfung](check-repo.log) bestanden. Die Testdateien sind an den
Kamera- und direkten Pinselablauf im gemeinsamen Capability-Katalog gebunden;
beide Prüfungen sind mit `--geprueft` vermerkt. Diese Links ersetzen keine
vollständige Workflowabdeckung.

## Gepaarte Worker-Messung

[Messdaten](pigment-paired.json): Referenz `9842ac876`, aktuell `b3022b51`;
Reihenfolge Referenz, aktuell, aktuell, Referenz. Jeweils neuer Worker, gleiche
aufgewärmte Geometrie und kalte Detailfarbe. 24 weltfeste Farbkacheln mit zwölf
überlagerten Füllflächen. Während jeder Kachel werden wiederholt Auswahlabfragen
gestellt; die nächste Abfrage folgt nach Antwort und kurzer Pause. Der schnellere
Antwortweg bedient damit mehr Abfragen, nicht nur dieselbe Zahl schneller.
Alle vier vollständigen Pixelausgaben besitzen denselben SHA-256.

| Lauf | Komplette Detailfarbe | Auswahl p95 | Auswahl maximal | Worker-Schritt maximal | Abfragen |
| --- | ---: | ---: | ---: | ---: | ---: |
| baseline | 38.66 s | 406.1 ms | 631.4 ms | 640.7 ms | 269 |
| current | 35.95 s | 14.1 ms | 72.6 ms | 91.0 ms | 1208 |
| current | 37.17 s | 14.0 ms | 55.5 ms | 62.9 ms | 1257 |
| baseline | 35.19 s | 408.5 ms | 553.3 ms | 557.2 ms | 261 |

Es liefen keine eigenen parallelen Tests, Builds oder nativen Proben. Auf dem
geteilten Rechner lief während der Messung eine fremde TypeScript-Prüfung.
Die Zeitwerte sind lokale Beobachtungen und keine isolierte Hardwarequalifikation.
Ein klarer Durchsatzgewinn ist hier nicht belegt; die unterbrechbare Komposition
reduziert vor allem die Wartezeit für Eingaben. Auch die Maxima bleiben über
einem 16-ms-Framebudget.

Reproduktion nach Extraktion von `src`, `desktop` und `tsconfig.json` aus der
Referenzrevision in ein eigenes Verzeichnis unter `~/.cache/saltmarcher/`:

```sh
TERRAIN_BASELINE_SOURCE=/path/to/retained-source TERRAIN_PIGMENT_PROBE=1 QA_EVIDENCE_DIR=.build/pigment-paired node tools/measure-terrain-colour-cost.mjs
```

## Native Hauptfläche

Der tatsächliche `npm run start:desktop`-Aufruf auf `ebfa5ee3` ist
[geprüft](main-result.json): Kampagne öffnen, Übersicht vor Detailfarbe,
Zoom während Nachladung, gleiche Kartenfläche bei Neigung und Rotation,
automatische Konturen über vier Maßstäbe, tatsächlicher GPU-Verlust,
vollständiger Canvas-Boden und ausdrücklicher Kamerawiederanlauf.
Steile Neigung und Drehung sowie Horizont-/Exportpixelprüfung bestehen.
Der Prozess endet mit Exit 0, sein PID ist anschließend abwesend; keine
Rendererfehler. Main, Preload, Renderer und HTML sind im Ergebnis gehasht.

Die [gekippte Hauptkarte](main-02-repository-tilt-zoom.png) und der
[Grafikfallback](main-04-graphics-fallback.png) wurden visuell geprüft.
Die absichtlich einfache Hügel-Fixture belegt den normalen App-Anschluss
und Kontinuität, keine ansprechende vollständige Landschaft. Die geladene
Detailfarbe erscheint hier erst bei Rendererzeit 11,73 s. Auch diese Probe
belegt daher keine sofortige Kaltladung.

Die [direkte Bearbeitung](live-result.json) auf demselben gebauten Stand besteht:
Formen während gedrückter Maustaste, Profilabfrage ohne Schreiben, Glätten,
kumulative halbtransparente Farbe, Escape, Fokusverlust, gekipptes Formen,
frischer Prozess und jeweils ein Undo für den ganzen Pinselzug. Beide Starts
enden regulär mit Exit 0 und abwesenden PIDs; keine Rendererfehler. Die vier
gemeinsamen Build-Hashes stimmen mit der Entwicklungsstart-Probe überein.
Der Dirty-Vermerk betrifft Dokumentation und vorhandene ungetrackte Belege,
keine nachträgliche Runtime-Änderung.

Die [gespeicherte Farbe](live-02-color-stopped.png) ist visuell geprüft;
[gekipptes Live-Gelände](live-04-tilted-live.png) bleibt in derselben Atlasfläche.
Die Funktionstests sind keine Nachweise für Pinseleingabelatenz oder flüssige
Bildausgabe auf beliebig großen Welten.

## Grenzen

Die Zeitabfragen prüfen Worker-Reaktionsfähigkeit, keine Bildschirm-Framerate.
Weitere synchrone Arbeit wie komplexe Basispolygone, Bewuchs, Geometrieaufbau,
Indexpflege und Live-Schnappschüsse besitzt damit keine allgemeine Zeitgarantie.
Die vollständige Kaltladezeit und große Autorenbestände müssen weiter verbessert
und qualifiziert werden. Dieser Schritt verändert keine kartografischen Stile.
