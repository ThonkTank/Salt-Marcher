# Rasterarbeit auf den angeforderten Ausschnitt begrenzen

Lokaler P3-Teilbeleg vom 21.10.2026. Runtime-Änderung:
`9d80c25d`; der folgende Commit korrigiert nur den Messwerkzeug-Aufruf
auf die asynchrone esbuild-API. Keine Main-/Candidate-CI-, Paket-,
Installations- oder Nutzerabnahme. Das Gesamtziel bleibt offen.

## Ursache und Änderung

Nach dem Wechsel auf die gemeinsame blockweise Höhenabtastung dauerte
die GPU-Ausfall-Wiederherstellung der Binnenland-Fixture noch 10,625 s
im nativen Fenster. Der Fallback rasterte vier komplette Weltkacheln,
obwohl der angeforderte Bereich nur einen kleinen Teil davon benötigt.

`landscapeRasterSlice` begrenzt diese Kacheln auf den angeforderten Bereich,
auf 128-Pixel-Blöcke gerundet. Zahl der Kacheln, Pixelabstand und
Supersampling bleiben gleich; der bisherige Halo liefert Nachbarhöhen
und Küstenentscheidungen. Die Rasterbilder können jetzt rechteckig sein.
SQL-Sampleauswahl und Invalidierung berücksichtigen beide Dimensionen.
Kleine Panbewegungen innerhalb derselben Blockgrenzen behalten den Cache.

Zusätzlich überspringt `LandscapeRasterizer` die Schattierung vollkommen
ebener Nachbarschaften: Beleuchtung ist dort exakt eins, Kontur und
Gratzeichnung exakt null. Vorhandene Pigmente bleiben erhalten. Die
Höhenanalyse wird weiterhin ausgeführt. Dieser gemeinsame Kernel entlastet
auch die normalen Farbtiles; der Kachelzuschnitt betrifft den Bereichsraster.

## Geprüfte Bildgleichheit und Datenwege

- [29 Integrationsfälle](integration-tests.log): Rasterwiederverwendung,
  Höhenänderung, genaue Weltkachelgrenzen, neue rechteckige Ausschnitte,
  negative und entfernte Koordinaten, dünne Pigmente, Landschaftswerkzeuge,
  dichte Auswahl-/Zeichengrenzen und begrenzte Spielerprojektion.
- [23 weitere Regressionen](regression-tests.log): gemeinsame Höhenfelder,
  additive Bänder, Reliefstile, Schatten-/Kontur-/Küstenpixel, Farbtiles,
  Revisionen und verspätete Antworten. Die beiden abschließenden Auswahlen
  enthalten unterschiedliche Testdateien; zusammen 52 bestandene Fälle.
- Der neue Ausschnittstest vergleicht das gesamte ausgegebene Rechteck mit
  derselben Fläche einer vollständig gerenderten Kachel. Auch ein nur einen
  Unterpixel hoher Pigmentstreifen und Pan-Cachetreffer sind enthalten.
  Die erste Testfassung verglich gegen Autoren-Eingaben, obwohl der Writer
  beim Landmalen zusätzliche Höhen schreibt. Der Vergleich verwendet jetzt
  die tatsächlichen gespeicherten Records auf beiden Seiten.
- App- und Desktop-Typprüfungen bestanden.

## Gepaarte Messung

Reproduktion:

```sh
QA_EVIDENCE_DIR=.build/atlas-raster-slices-paired node tools/measure-atlas-raster-slices.mjs e2d061cd5c98a07087f5adce88ad500335c04a35
```

[Messdaten](paired.json). Der explizite Referenzstand liefert nur die beiden
geänderten Runtime-Dateien; Schema, Store und Binnenland-Fixture sind gleich.
Jeder Lauf hat einen neuen Readonly-Reader und leeren Rastercache. Reihenfolge:
Referenz, aktuell, aktuell, Referenz. Keine parallelen eigenen Builds, Tests
oder nativen Proben. Das Werkzeug prüft alle behaltenen Pixel gegen die
Referenzausgabe und die identische Weltauflösung.

| Weg | Lauf 1 | Lauf 2 | Ausgabepixel |
| --- | ---: | ---: | ---: |
| vollständige Weltkacheln | 15,064 s | 12,048 s | 4.194.304 |
| zugeschnittene Kacheln | 3,802 s | 3,664 s | 786.432 |

Behaltene Pixel sind exakt identisch, nicht nur visuell ähnlich. Die
Berechnung entfällt für 81,25 % der bisherigen Ausgabepixel. Dies sind
zwei lokale Läufe je Variante, keine p95- oder Großweltqualifikation.
Der Dirty-Vermerk der Messung betrifft die Korrektur am Messwerkzeug;
der Runtime-Stand ist `9d80c25d`.

## Native Wiederherstellung

[Repository-Start](repository.json) auf
`0ec2466cc55bf8d759f9d3cb42bd060baceb3491`: wörtliches
`npm run start:desktop`, normale Kampagnenoberfläche → Atlas.
Zoom während Verfeinerung, gemeinsame gekippte Kamera, automatische
GPU-Konturen, tatsächlicher Kontextverlust, [vollständiger Fallback](fallback.png)
und [explizite Kamera-Wiederaufnahme](recovered.png) sind bestanden.
Auch die vorherige Horizont-/Exportkachel-Pixelprüfung bleibt grün.
Keine Rendererfehler, normaler Exit 0, Produktprozess danach nicht vorhanden.

Die native Fallback-Wiederherstellung dauert jetzt **3,344 s** statt
10,625 s in der vorigen Prüfung derselben Fixture. Es bleibt eine
merkliche Wartezeit. Der normale erste vollständige Detailstand erscheint
bei Rendererzeit 10,506 s; dieser Wert ist weder eine Verbesserung
noch die Laufzeit des gesamten npm-Starts. Eine schnelle kalte
Detailversorgung ist damit ausdrücklich nicht belegt.

## Relief-/Exportprobe

Die bestehende native Probe wartete zunächst beim Pinselzug auf den alten
Text „Vorschau“. Der aktuelle direkte Schreibablauf benutzt diese Anzeige
nicht; die Probe hielt deshalb den Pinsel unnötig 30 Sekunden gedrückt.
Sie prüft jetzt einen tatsächlich veröffentlichten neueren Terrainstand
und gespeicherte Höhen vor dem Loslassen sowie das anschließende Undo.
Prozessende wird bei beiden Starts zusätzlich über Exit-Code und fehlende
PID geprüft. Dieser Testwechsel verändert keine Produktfunktion.

[Abschließender Lauf](relief.json): drei Stile, Maßstabswechsel,
[gespeicherter Live-Pinselzug](live-brush.png) mit Undo, [PNG-Ausgabe](export.png)
und frischer Prozess bestanden. Keine Rendererfehler; beide Exits mit
Code 0 und jeweils fehlender PID belegt. Derselbe Runtime-Stand wie beim
Repository-Start; der Dirty-Vermerk betrifft Prüftool und Dokumentation.
Die Sichtprüfung zeigt weiterhin grobe Konturen und vergrößerte
Farbtexturen in dieser Fixture. Bildgleichheit ist keine abschließende
Qualitätsabnahme. Repositoryprüfung bestanden.

## Grenzen

Weitere Datenreads, normale kalte Terrainverfeinerung, dichte Objekte,
neue Namen und große Weltbestände bleiben zu qualifizieren. Der Zuschnitt
kann bei einer Verschiebung über Blockgrenzen einen neuen Rastercache-Eintrag
erfordern; er ist kein vollständiger inkrementeller Weltkachelcache.
Die drei vollständigen kritischen Abschlussprüfungen haben nicht begonnen.
