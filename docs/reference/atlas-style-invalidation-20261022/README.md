# Atlas: unnötige Style- und Textinvalidierungen beim Navigieren

22.10.2026. Normaler Repository-Start auf Fedora/Wayland, Electron 44.7.0,
Intel Core i5-8365U; keine Pentium-7505- oder Gesamtproduktabnahme.
Anschluss: [gemeinsamer Atlas, P0/P5/P8](../../plans/maps/unified-spatial-atlas.md),
Gelände-R7 / HEX-06, HEX-08, HEX-16.

## Ursache und gewählter Ansatz

Der [verworfene Größen-Cache](../atlas-viewport-size-20261022/README.md)
verschob nur Layoutarbeit. Eine zusätzliche Chromium-Aufzeichnung mit
`disabled-by-default-devtools.timeline.invalidationTracking` zeigt die
Schreibursachen: Textknoten werden bei wiederholten Ausschnittsabfragen
ersetzt; ein dokumentweiter `body:has(>#campaign-atlas:not([hidden]))`-Selektor
löst dadurch weitere Styleprüfungen aus. Das betrifft auch Schaltflächen und
Felder außerhalb der gerade geänderten Meldung.

Der [Ausgangstrace](before/invalidation-summary.json) enthält 105 Auslöser
von `BODY :has`, unter anderem durch `refresh` und `renderTravel`. Die
betroffenen Selektoren stehen im Rohtrace, nicht nur in einer Quellcodevermutung.
Drei Optionen: gleiche Textzuweisungen vermeiden, die globale Abfrage durch
vorhandenen Zustand ersetzen oder neue Layoutisolation einführen. Der
vorhandene Zustand vermeidet zusätzliche Besitzer und trifft die belegte
Ursache; anschließend werden die verbleibenden gleichen Textzuweisungen entfernt.

## Dauerhafte Änderung

`AtlasWorkspaceLayout.setActive` setzt und entfernt bereits `body.atlas-workspace`
für den normalen Editor und dessen Verlassen. Der Live-Dock verwendet seinen
eigenen Layoutbesitzer. Die zwei alten `body:has(...)`-Regeln nutzen nun diese
vorhandene Klasse. Kein neuer Zustand, kein Größen-Cache, keine globale Änderung
aller `:has`-Selektoren.

`campaign-atlas-ui.ts` erhält eine lokale Textzuweisung mit Gleichheitsprüfung
für den Ladehinweis und die wiederholt aktualisierten Reisefelder. Werte und
Fehler-/Ladeübergänge bleiben erhalten; gleiche Textknoten werden weiterverwendet.
Der bisherige doppelte Statusaufruf erzeugt so keinen zweiten DOM-Umbau.

## Prüfweg und Grenzen

Die volle Weltprobe enthält 100.000 Biomezuordnungen, 5.000 Orte und 5.000
möblierte Gebäude, 50 Details und 4.001 Dungeonräume; insgesamt 108.076
Landschaftsrecords. Das sind keine 100.000 feinen Höhenbearbeitungen. Zwei
Sculpt-Züge mit 2.500 Meilen Radius, Readback aus, CPU-Profiling und Trace an.
Die zusätzliche Invalidierungsaufzeichnung verändert Messkosten; kein
Eingabe-bis-verändertem-Pixel-Nachweis und keine Gerätequalifikation.

Die Zwischenprobe mit ausschließlich geänderter CSS-Regel liegt unter
[css-only](css-only/result.json). Die dokumentweiten Auslöser fallen bereits
auf null; Stylearbeit und Frameausreißer bleiben. Der erneute Sculpt-p95
verschlechtert sich dort von 24,4 auf 33,3 ms. Deshalb wurde dieser Zwischenstand
nicht als fertige Leistungsverbesserung gewertet.

102 bestehende Canvas-/Werkzeug-/Navigations-/Sitzungsfälle bestanden. Der
[native Größen-/Trefferablauf](../../../tools/test-desktop-atlas-viewport.mjs)
prüft Seitenleisten, Fenstergrößen, 200 % Browserzoom, Raumauswahl und Rückkehr
aus der Kampagnenübersicht. Auf dem CSS-Zwischenstand sind alle Kamerawerte
identisch zum Ausgangsstand; eine Aufnahme ist pixelgleich, die zweite hat
zwei abweichende Pixel von 1.126.400. Die [finale Probe](viewport-final/result.json) besteht ebenfalls mit normalem
Ende und abwesender PID. Alle Kamerawerte bleiben identisch, die Aufnahmen
unterscheiden sich um vier bzw. null Pixel ([Vergleich](viewport-final/comparison.json));
die finale Raumaufnahme wurde betrachtet. TypeScript, Desktop-TypeScript,
Desktopbuild und Repositoryprüfung bestanden.

Rohdaten sind verlustfrei gzip-komprimiert. `summarize-invalidations.mjs`
liest Selektor-/Schreibursachen; `../atlas-viewport-size-20261022/summarize-layout.mjs`
fasst Layoutdauern zusammen. Dauern können überlappen und sind keine additiven
CPU-Kosten. `../atlas-presentation-platform-20261022/summarize-results.mjs`
erstellt lesbare Ergebniszusammenfassungen, vollständige Framearrays bleiben im Archiv.

Zum Reproduzieren nach `npm ci` und `npm run build:desktop` den beigefügten
`build-world-invalidation-trace.mjs` nach `.build/` kopieren und ausführen:

```sh
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=1 WORLD_LAYOUT_TRACE=1 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/style-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node .build/world-invalidation-trace.mjs
QA_EVIDENCE_DIR=.build/style-viewport-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-atlas-viewport.mjs
```

Nur ein nativer Prozessablauf zur Zeit; tatsächliches Ende prüfen. Für den
Ausgangszustand beide Produktdateien auf `2060a03053abb34d7972bf907d5bfeedcf90f880`
zurücksetzen, ausschließlich in einer isolierten Arbeitskopie. Für den
CSS-Zwischenstand bleibt nur die TypeScript-Datei auf diesem Ausgangsstand.

## Ergebnis des kombinierten Stands

| Ablauf, p95 / p99 / Maximum ms | Ausgang | CSS und gleiche Texte erhalten |
| --- | --- | --- |
| Navigation | 24,4 / 166,6 / 200,0 | 20,9 / 24,7 / 99,9 |
| Sculpt | 23,4 / 50,0 / 116,7 | 22,7 / 66,7 / 133,2 |
| Erneuter Sculpt | 24,4 / 83,3 / 83,4 | 24,8 / 83,3 / 100,0 |

[Ausgang](before/result.json), [finaler Vergleich](after/result.json).
Beide Prozesse je Lauf normal beendet, PIDs abwesend, keine Rendererfehler.
Alle elf Runtimeartefakte stimmen überein, außer der beabsichtigt geänderten
CSS- und Rendererdatei. Beide Weltaufnahmen wurden betrachtet; unterschiedliche
bereits geladene Farbkacheln sind weiterhin sichtbar. Beide Läufe erreichen
abschließend 48/48 Farben; die Aufnahmen selbst sind kein Pixelgleichheitsbeleg.

Im kritischen `regionQuery → refresh`-Pfad fallen acht Styleberechnungen mit
71,73 ms auf eine mit 6,84 ms; acht Layouts mit 6,03 ms auf eines mit 0,70 ms.
Die dokumentweiten `BODY :has`-Auslöser fallen von 105 auf null, aufgezeichnete
Style-Recalc-Invalidierungen von 604 auf 36. Anders als beim verworfenen
Größen-Cache erscheint die gleiche Arbeit nicht nur bei einem anderen Leser.
Die gültigen Textwechsel beim Ladebeginn/-ende bleiben vorhanden.

Das ist ein belegter Rückgang unnötiger Hauptthreadarbeit und ein besserer
Navigationslauf, keine allgemeine Prozentzusage. Sculpt bleibt praktisch auf
dem bisherigen Niveau, einzelne Maxima und der erste Sculpt-p99 sind schlechter.
Weitere Wiederholungen, echte Eingabe-Pixel-Latenz und der Pentium-Laptop bleiben
notwendig; weder 60 fps durchgehend noch vollständige Weltkartenabnahme erreicht.

Aufgeräumt: vorhandenen Layoutzustand wiederverwendet, überflüssige dokumentweite
Selektoren ersetzt, gleiche Statusknoten behalten. Kein neuer Cache und keine
zweite Größenbeobachtung. Die CSS-Zwischenmessung ist ausdrücklich getrennt vom
finalen Stand, sämtliche Rohtraces komprimiert; keine neue alternative Atlasansicht.
