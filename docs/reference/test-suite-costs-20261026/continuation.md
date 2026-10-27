# Fortsetzung: Fixture-Lebensdauer und primitive Transfervarianten

Status: Gemessener Teilabschluss; Ziel unter 300 Sekunden bleibt offen.
Owner: project
Last Reviewed: 2026-10-26
Source of Truth: [Messdaten](continuation-measurements.json), Quellhashes und vollständige Dateiauswahl darin.

## Ergebnis des vollständigen Laufs

Auf demselben Linux-Host mit Node 22.19.0 und unverändert vier isolierten
Testprozessen sinkt `npm test` einschließlich Vorbereitung von 388,080 auf
377,015 Sekunden: 11,066 Sekunden beziehungsweise 2,85 %. Die Vorbereitung
braucht 0,789 beziehungsweise 0,768 Sekunden. Der Vergleich verwendet den
bereits dokumentierten SQL-Nachherlauf als Basis; dessen Produktänderung ist
in `a0aa36fe8dc4e079897fb61d378dcdaa72540c6c` enthalten. Der neue Lauf enthält
auf diesem Commit die hier per SHA-256 gebundenen Änderungen. Es ist ein
Einzelvergleich, keine statistische Verteilung oder ausschließlich einem
Teilpatch zurechenbare Beschleunigung. Währenddessen liefen keine weiteren
Builds, Profile oder nativen Proben; die Desktopumgebung blieb aktiv.

| Größe | Bisheriger Nachherlauf | Fortsetzung |
| --- | ---: | ---: |
| Gesamtzeit | 388,080 s | 377,015 s |
| User-/System-CPU | 1214,13 / 92,85 s | 1184,41 / 91,50 s |
| Größter Prozess-RSS (GNU time) | 1.148.276 KiB | 1.026.912 KiB |
| Tests / bestanden / Fehler / Skip | 4657 / 4656 / 0 / 1 | 4661 / 4660 / 0 / 1 |
| Ausgewählte Dateien | 408 | 409 |
| Host-Speicherdruck some / full | 1,366 / 1,220 s | 0,640 / 0,242 s |

Alle bisherigen Testnamen und Dateien bleiben enthalten. Vier Tests einschließlich
eines Untertests kommen hinzu; der bestehende optionale SRD-PDF-Skip bleibt.
Die neue Datei prüft Modulzustandsisolation und abgewartetes Aufräumen. Die
Transferregression prüft die tatsächlich optimierten primitiven Varianten.
Hostdruck ist systemweit und kein Beweis einer exklusiven Verursachung.
Das Laufzeitziel bleibt offen; die verbleibende CPU-Arbeit ist kein externer
Nutzerblocker und schließt weitere algorithmische Verbesserungen nicht aus.

## UI-Ladung, Speicherbindung und Fachszenarien getrennt

Ein temporärer `Module._load`-Messadapter erfasst nur die beiden vorhandenen
Fixture-Bundles. `PerformanceObserver` erfasst GC; `process.resourceUsage()`
erfasst CPU und RSS. Erst nach Erfassung von Laufzeit und CPU erfolgt ein
expliziter diagnostischer GC zur Bestimmung des weiterhin gebundenen Heaps.
Der eigentliche Testhelper erzwingt keinen GC. CPU-Profile und Heap-Snapshots
bleiben lokal unter `.build/section2b`; ihre Auswertung folgt starken Kanten,
nicht schwachen oder Ephemeron-Kanten.

| Gezielter Lauf | Zeit / CPU | Bundleladung | GC | Gebundener Heap nach Diagnose-GC |
| --- | ---: | ---: | ---: | ---: |
| Live vorher | 18,577 / 23,663 s | 1,687 s, 127 Ladungen | 1,973 s | 834,4 MiB |
| Live nur Parent lösen | 18,401 / 23,505 s | 1,658 s, 127 Ladungen | 1,944 s | 834,4 MiB |
| Live Parent und Cleanup lösen | 17,569 / 21,485 s | 1,617 s, 127 Ladungen | 1,692 s | 53,8 MiB |
| Travel vorher | 18,292 / 26,402 s | 0,103 s, 63 Ladungen | 3,006 s | 461,7 MiB |
| Travel Parent lösen | 17,861 / 26,279 s | 0,088 s, 63 Ladungen | 3,015 s | 93,9 MiB |

Nur `require.cache` zu leeren lässt frühere Module in `parent.children` stehen.
Das gezielte Lösen reduziert diese Referenzen von 127/63 auf jeweils eine.
Bei Live reicht dies nicht: Der Node-Testressourcenbestand hält den erledigten
`TestHook.fn` und dadurch dessen Fixture-Closure mit DOM/UI weiter fest. Der
Helper gibt diese Closure beim Beginn der weiterhin vollständig abgewarteten
Bereinigung frei und bewahrt deren Ergebnis beziehungsweise Fehler.

Eine Wiederholung in umgekehrter Reihenfolge bestätigt den Speicherbefund:
Live geändert 53,8 MiB Heap / 445,9 MiB maximaler RSS, vorher 834,4 / 1142,1 MiB.
CPU beträgt 22,590 gegenüber 23,731 Sekunden; die Wandzeit dagegen 19,231
gegenüber 18,674 Sekunden. Daher wird kein stabiler gezielter Wandzeitgewinn
behauptet. Reine Modulladezeit erklärt nur einen kleinen Teil der langen
Dateien; alle Fachszenarien werden weiterhin ausgeführt.

Nur die Live- und Travel-Fixtures verwenden den neuen gezielten Lader, nur
Live den Cleanup-Helper. Es gibt keine geteilte veränderliche UI-Instanz,
keinen globalen Cache-Purge, keine ausgelassenen SQLite-Konstruktoren oder
Wiederöffnungen und keinen pauschalen Umbau weiterer Testdateien.

## Vermeidbare Core-CPU-Arbeit

Das aktuelle Core-Profil nach dem bereits integrierten SQL-Patch zeigt noch
2,212 Sekunden Self-Time beim Konstruieren von `UnsupportedTransfer`. Gültige
Enums probieren bislang vorangehende Union-Alternativen über Exceptions aus.
Für ausschließlich primitive Literal-/Scalar-Alternativen kann die Zugehörigkeit
direkt geprüft werden: Sie sammeln und verändern keine Referenzen. Die übrigen
strukturellen und Referenz-Unions behalten ihren bisherigen Probeweg.

Bei unverändert 414 Core-Tests sinkt der gezielte Profil-Lauf von 28,135 auf
26,417 Sekunden, die genannte Error-Self-Time von 2,212 auf 0,467 Sekunden.
SQL-Prepare bleibt nahezu gleich (3,801 / 3,787 Sekunden), ebenso GC
(1,103 / 1,080 Sekunden). Dies ist ein gezielter Einzelvergleich. Die neue
Regression erhält exakte Werte, Nullprototyp-Ausgaben, Fehlerpfade sowie die
Referenzsammlung und -umschreibung nichtprimitiver Varianten.

Die begrenzte Untersuchung endet mit diesen belegten Änderungen. Sie beansprucht
weder vollständige Ausschöpfung sämtlicher Suitekosten noch Owner-Abnahme.
Native Qualifikation und exakte Candidate-CI bleiben separate Lieferbelege.

## Wiederholen und Beleggrenzen

`python3 tools/measure-test-suite.py .build/test-suite-next` führt unverändert
`npm test` einschließlich Vorbereitung aus. Der Ausgabeordner muss neu sein.
Rohdaten dieser Fortsetzung: `.build/section2b/full-after`. Gezielte Dateien:
[desktop-live-moment-context.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-live-moment-context.test.mjs),
[desktop-travel-target-dom.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-travel-target-dom.test.mjs),
`tests/atlas/desktop-transfer-contracts.test.mjs` und
`tests/shared/fixture-lifecycle.test.mjs`; vorher einmal `node build.mjs --test`.
Die Diagnoseprofile verändern nicht die produktive Testauswahl. Es wurden
keine Anforderungen, Quellenbindungen oder Abnahmestatus umgeschrieben.

## Lokale Lieferprüfung

`check:repo`, `check`, `check:desktop`, `build`, `build:desktop` und
`format:check` sind grün. Die [native Transferprobe](continuation-native.json)
verwendet Main, Preload und echte SQLite-Daten: Export, Import, unabhängige
Bearbeitung verknüpfter Notizen und Karte sowie erneutes Öffnen in einem frischen
Prozess. Beide Prozesse enden mit Code 0 ohne Signal; beide PIDs sind anschließend
abwesend, `errors` ist leer, das Archiv bleibt unverändert. Geprüft wurde der
lokale Entwicklungsbuild bei 100 % Zoom, kein installiertes Paket und keine
Owner-Abnahme. Die tatsächlichen Testquellen wurden im gemeinsamen
Capability-Katalog verknüpft und mit `--geprueft` erfasst.
