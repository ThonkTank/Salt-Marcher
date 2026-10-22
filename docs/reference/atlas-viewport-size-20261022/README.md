# Atlas: verworfener Cache für die Ausschnittsgröße

22.10.2026, normaler Repository-Entwicklungsstart, Electron 44.7.0,
Fedora/Wayland, Intel Core i5-8365U. Kein Nachweis auf dem Pentium Gold 7505.
Anschluss: [gemeinsamer Atlas, P0/P5/P8](../../plans/maps/unified-spatial-atlas.md)
und Gelände-R7 / HEX-06, HEX-08, HEX-16.

## Ausgangsbefund und Auswahl

Die [Präsentationsgegenprobe](../atlas-presentation-platform-20261022/README.md)
zeigte synchrone Layoutarbeit beim Lesen der Ausschnittsgröße. Die erneute
[Ausgangsmessung](before/result.json) bestätigt sieben Styleberechnungen mit
54,68 ms und sieben Layouts mit 6,30 ms unter `regionQuery → refresh`.
Navigation: p95 23,4 ms, p99 109,7 ms, Maximum 199,9 ms.

Drei nächste Optionen: vorhandene ResizeObserver-Größe wiederverwenden
(direkt belegter Engpass, Größen-/Trefferprüfung nötig), Bedienfeldänderungen
bündeln (breitere Eingriffe, mögliche weitere Layoutreduktion) oder Terrain
mit GPU-Höhenfeldern aufbauen (größeres Potenzial, bislang kein gleichwertiger
End-to-End-Nachweis). Zuerst wird die beobachtete Layoutunterbrechung geprüft.

## Geprüfter und anschließend entfernter Versuch

Im Versuch verwendete `CampaignAtlasWorkbench` die bereits vorhandene Größenbeobachtung
auch für Bereichsabfragen, maximale Zoomweite und Darstellungsmaßstab. Die
gelieferte Größe wird vor der Kamerabenachrichtigung aktualisiert. Beim ersten
Öffnen und nach einer beobachteten unsichtbaren Fläche bleibt eine aktuelle
DOM-Messung als Rückfall. Die Canvasfläche hat weder Padding noch Rahmen;
die ganzzahlig gerundete `contentRect`-Größe entspricht ihrer Clientgröße.
Trefferprüfung und Bereitschaft in `AtlasCanvas` behalten ihre frische DOM-Messung.
Keine zweite Größenbeobachtung und kein neuer allgemeiner Cache-Unterbau.

Der Versuch wurde nach dem Vergleich **aus dem Produktcode entfernt**.
[`rejected-cache.patch`](rejected-cache.patch) erhält ihn zur Reproduktion
auf dem Ausgangscode. Die folgende Funktionsprüfung betrifft den Versuch;
sie beweist keinen Leistungsgewinn.

## Ergebnis und Aufräumen

| Ablauf, p95 / p99 / Maximum ms | Vorher | Cache-Versuch |
| --- | --- | --- |
| Navigation | 23,4 / 109,7 / 199,9 | 23,7 / 150,0 / 233,3 |
| Sculpt | 30,5 / 66,7 / 100,0 | 24,4 / 83,3 / 116,7 |
| Erneuter Sculpt | 24,1 / 66,7 / 99,9 | 24,2 / 83,4 / 135,7 |

[Vorher](before/result.json), [Versuch](after/result.json). Beide normal
beendet, alle PIDs abwesend, keine Rendererfehler. Alle elf Runtimeartefakte
stimmen überein, außer der geänderten Rendererdatei. Beide Weltbilder wurden
betrachtet; die bekannten unvollständig nachgeladenen Farbkacheln bleiben.

Die erzwungenen Layouts verschwinden aus `regionQuery`, treten aber jetzt unter
`updateCamera → reframe → changed` auf: sechs Styleberechnungen mit 44,67 ms
und sechs Layouts mit 5,93 ms. Weitere Stylearbeit verlagert sich nach
`placeCanvas → sync → render`. Der erste Sculpt-p95 fällt besser aus, der
Wiederholungszug bleibt gleich, alle drei p99-Werte sind schlechter. Diese
Einzelmessung liefert **keinen belastbaren Gesamtgewinn**. Sie rechtfertigt
den zusätzlichen Größen-Zustand samt Invalidierungsregeln nicht.

Aufgeräumt: sämtliche Cacheänderungen aus dem Produkt entfernt; bestehender
Größen-/Treffervertrag bleibt erhalten. Die neue native Regression bleibt
als gezielter Prüfweg für künftige Größen-/Layoutänderungen erhalten, ohne
den umfangreichen allgemeinen Layoutablauf zu duplizieren. Rohdaten sind
komprimiert, der erfolglose Versuch liegt nur als reproduzierbarer Patch vor.
Nächster Prüfpunkt sind die invalidierenden DOM-Schreibvorgänge statt weiterer
Caches vor einzelnen Layoutlesern. Das Vollwelt-/Pentium-Ziel bleibt offen.

## Funktionsprüfung

105 bestehende Kamera-/Canvas-/Bereichsfälle bestanden. TypeScript und
Desktop-TypeScript bestanden; Desktopbuild erfolgreich.
[Native Prüfung](viewport/result.json) über
[`tools/test-desktop-atlas-viewport.mjs`](../../../tools/test-desktop-atlas-viewport.mjs):
Werkzeugbreite, Detailbereich schließen, Fenster 1600×900 und 960×720,
1280×880 bei 200 % und wieder 100 % Browserzoom. Jeweils bleiben Weltmittelpunkt
und Meter pro CSS-Pixel erhalten; das Seitenverhältnis stimmt. Raumdetails
werden vor der Auswahl geschlossen und müssen durch den Kartentreffer wieder
erscheinen. Rückkehr aus der Kampagnenübersicht und erneute Auswahl bestanden.
Normales Ende, PID abwesend, keine Rendererfehler; beide Aufnahmen betrachtet.

Nach dem Entfernen des Versuchs ist der Rendererhash wieder exakt gleich
dem Ausgangsstand. Dieselbe [native Regression auf dem wiederhergestellten
Produktcode](restored/result.json) bestand mit sieben Fällen, normalem Ende,
abwesender PID und ohne Rendererfehler.

Der erste native Versuch erreichte die Größen-/Trefferfälle, scheiterte dann
am veralteten direkten Zugriff auf den versteckten `live-tab`. Der finale
Prüfweg nutzt das sichtbare Atlasmenü und die Kampagnenkarte. Der Versuch ist
kein Produktfehler und keine bestandene Gesamtprobe. Rohdaten bleiben lokal
in `.build/atlas-viewport-native-20261022/` erhalten. Die TypeScript-Prüfung
verlangte außerdem eine Prüfung auf einen leeren Observer-Eintrag; diese ist
vor den finalen Prüfungen ergänzt worden.

## Messprotokoll

Volle Welt: 100.000 Biomezuordnungen, 5.000 Orte, 5.000 ausgestattete Gebäude,
50 Details, 4.001 Dungeonräume; 108.076 Landschaftsrecords. Keine 100.000
feinen Höhenbearbeitungen. 2.500-Meilen-Sculpt mit zwei Zügen; normale
Plattformwahl, Readback aus, CPU-Profiling und Chromium-Trace an. Kein
Eingabe-bis-verändertem-Pixel-Nachweis, keine vollständige Leistungsabnahme.
Keine parallelen nativen Proben oder lokalen Typ-/Buildprüfungen während
der gemessenen Navigation und Bearbeitung.

Rohdaten sind verlustfrei gzip-komprimiert. `summarize-layout.mjs VERZEICHNIS`
berechnet die Style-/Layoutgruppen. Die lesbaren Frame-Zusammenfassungen
erstellt `../atlas-presentation-platform-20261022/summarize-results.mjs`.
Tracezeiten überlappen und dürfen nicht als unabhängige CPU-Zeiten addiert werden.

Reproduktion nach `npm ci` und `npm run build:desktop`: den bestehenden
`build-world-presentation-trace.mjs` aus dem Präsentationsbeleg nach `.build/`
kopieren und ausführen, danach:

```sh
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=1 WORLD_LAYOUT_TRACE=1 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/viewport-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node .build/world-presentation-trace.mjs
QA_EVIDENCE_DIR=.build/viewport-resize-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-atlas-viewport.mjs
```

Die Ausgangsruntime stammt aus `9ed6a9ae`; sie wurde nach der Prüfhilfenkorrektur
gestartet. Quellstand und Runtimehashes sind getrennt aufgezeichnet. Die
Versuchslaufzeit enthält die obige Änderung; allein die Rendererdatei
unterscheidet sich zwischen den Weltproben. Für Reproduktion des Ausgangsstands ist
`QA_OZONE_PLATFORM=wayland` zu setzen, falls dessen alte Prüfhilfe verwendet wird.
