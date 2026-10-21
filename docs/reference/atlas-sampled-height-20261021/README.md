# Begrenzte Höhenlesevorgänge im Weltmaßstab

Eine Weltansicht hat eine begrenzte Zahl von Höhen- und Farbsamples. Bislang
las der Terrainstream trotzdem alle überlappenden Höhenpayloads, auch wenn kein
Sample ihre Interpolationsumgebung berührte. Viele kleine bearbeitete Gebiete
kosteten dadurch in der Weltübersicht unnötig Datenbank- und JSON-Arbeit.

Der Stream übergibt nun die Abmessungen seiner tatsächlichen regulären
Samplefläche. Der SQLite-Leser verwirft vor dem Laden der Payloads die
Höhenkacheln ohne betroffenen Samplepunkt. Die gespeicherten Einflussgrenzen
enthalten bereits den benötigten Hermite-Nachbarschaftsrand. Reihenfolge,
additive Höhenbänder und Vererbung gröberer Werte bleiben erhalten.
Kanonische Sichtprüfung, räumliche Projektion und deren Farbberechnung nutzen
denselben Anschluss. Straßen und Wasserflächen bleiben unverändert lesbar.

`tests/terrain-sample-filter.test.mjs` vergleicht die Ergebnisse exakt mit dem
ungefilterten Stream: 1.025 Höhenrecords werden für 36 weit verteilte Samples
auf 10 gelesene Payloads reduziert. Zusätzlich werden Mischauflösungen,
additive Bänder, Löcher, Teilblöcke, gebrochene Koordinaten und Ursprünge jenseits
der 32-Bit-Grenze geprüft. Direkter SQLite-Geländeleser und der normale
Atlasleser liefern dieselben Werte.

Das begrenzt gelesene Payloads, nicht die gesamte Metadatensuche. Der Test
beweist weder eine konstante Gesamtlaufzeit bei beliebiger Weltgröße noch
unmittelbare Pinselreaktion auf dem Pentium Gold 7505. Die vollständige
Autorenreise und die Abnahme einer ausgearbeiteten Welt bleiben offen.

## Lokaler nativer Gegencheck

21 Stream-/Cache-/Filtertests sowie beide TypeScript-Prüfungen und Desktopbuild
bestanden. Die normale Atlasprobe mit 3.076 Gelände-/Wald-/Straßenrecords
bestand ebenfalls, einschließlich GPU-Orakeln und beendetem Prozess.
[Messdaten](world.json): Navigation RAF p95 34,5 ms, Maximum 250,1 ms;
Pinsel RAF p95 16,8 ms, erste bestätigte Änderung aber weiterhin 2.283 ms.
Das ist keine nachgewiesene Verbesserung der Pinselreaktion. Die Probe enthält
überwiegend grobe Höhenkacheln und profitiert entsprechend wenig von der neuen
Filterung feiner, zwischen Samples liegender Daten.

Gemessen auf i5-8365U/Intel UHD 620, 1440×900, DPR 1, mit Profiler und Traces.
Die unscharfe grobe Weltfarbe bleibt ein sichtbarer offener Mangel.
