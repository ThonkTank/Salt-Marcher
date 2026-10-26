# Gesamtsuite: Initialisierungskosten am 26.10.2026

Status: Gemessener Teilabschluss; Ziel unter 300 Sekunden weiterhin offen.
Owner: project
Last Reviewed: 2026-10-26
Source of Truth: [Messdaten](measurements.json), `tools/measure-test-suite.py` und die unveränderte Auswahl von `tools/run-tests.mjs`.

Die anschließende [begrenzte Fortsetzung](continuation.md) untersucht UI-Retention
und primitive Transfervarianten; sie enthält einen weiteren vollständigen Vergleich.

## Vergleich und Grenze

Ein vollständiger Vorher-/Nachherlauf auf demselben Linux-Rechner: Pentium Gold
7505, zwei physische/vier logische CPUs, 7.657.568 KiB RAM, Btrfs im Checkout,
`/tmp` auf tmpfs, Node 22.19.0. Beide Läufe verwenden vier getrennte Testprozesse
und dieselben 408 Dateien. Während der Läufe liefen keine weiteren Builds,
Benchmarks oder nativen Proben. Die Desktopumgebung blieb aktiv. Dies ist ein
kontrollierter Einzelvergleich, keine statistische Laufzeitverteilung.

| Größe | Vorher | Nachher |
| --- | ---: | ---: |
| Gesamtzeit einschließlich Vorbereitung | 424,569 s | 388,080 s |
| Vorbereitung | 0,856 s | 0,789 s |
| Tests / bestanden / Fehler / Skips | 4656 / 4655 / 0 / 1 | 4657 / 4656 / 0 / 1 |
| User-CPU / System-CPU | 1354,24 / 95,06 s | 1214,13 / 92,85 s |
| Größter Prozess-RSS laut GNU time | 1.176.000 KiB | 1.148.276 KiB |
| Host-I/O-Druck, some / full | 5,148 / 0,882 s | 4,125 / 0,885 s |
| Host-Speicherdruck, some / full | 1,641 / 0,737 s | 1,366 / 1,220 s |

Die Suite spart 36,488 Sekunden (8,6 %). Alle bisherigen Testnamen bleiben
enthalten; hinzu kommt die Batch-/Rollbackregression. Der bestehende optionale
SRD-PDF-Skip bleibt bestehen. Weder Assertions noch Testdateien wurden entfernt.
Der Vorherstand ist `e9dc577da7845efd6e4ba57b4dddb401aedbec99`; der Nachherlauf
enthält den SQL-Patch auf diesem Stand, noch vor der Versionsanhebung. Die
Messdatei bindet die geänderten Quellen und die Dateiauswahl per SHA-256.

Der Host war insgesamt zu 98,9 beziehungsweise 98,5 % beschäftigt. Die verbleibenden
1.306,98 CPU-Sekunden entsprächen selbst bei idealer Verteilung auf vier logische
CPUs 326,745 Sekunden. Dies begrenzt **diese verbleibende Arbeit auf diesem Host**;
es beweist weder, dass weitere algorithmische Verbesserungen unmöglich wären,
noch einen Fehler oder eine universelle Mindestlaufzeit des Produkts. Das Ziel
unter 300 Sekunden ist nicht erreicht. Weniger Wartezeit allein würde nicht
reichen. Die größten verbleibenden Dateien enthalten unter anderem vollständige
Transfer-/Speicher-, dichte Raster- und UI-Szenarien; ihre Aussagen bleiben erhalten.

CI ist ein eigener Messraum: Der vorherige Candidate-Lauf
[40263355722](https://github.com/ThonkTank/Salt-Marcher/actions/runs/40263355722)
brauchte 410,3 Sekunden einschließlich 0,6 Sekunden Vorbereitung. Zeiten anderer
Runner werden nicht als derselbe lokale Vorher-/Nachhervergleich ausgegeben.

## Ursache und begrenzte Änderung

CPU-Profile der Core-, Regions- und Live-Fixtures zeigen wiederholtes SQL-Prepare
als erheblichen technischen Anteil. Im Core-Profil entfielen rund 4,76 Sekunden
allein auf Prepare in der SRD-Installation und ihrer Versionsaufzeichnung;
die Regionprobe zeigte denselben Pfad. Bisher bereitete jede Installation für
295 Definitionen sechs identische SQL-Anweisungen pro Definition neu vor.
Die Installation bereitet diese Anweisungen nun einmal pro Transaktion vor.
Auch die Prüfung aller erforderlichen Tabellen bei einer Wiederöffnung verwendet
eine Anweisung mit wechselnder Tabellenbindung. Es gibt keinen globalen
Statementcache und keine geteilte Datenbankverbindung.

Ein gezielter Vergleich von 30 echten neuen Dateidatenbanken mit Create,
Activate, Close und Reopen ergab 1.358 → 631 ms für die frischen Konstruktoren
und 372 → 232 ms für Reopen/Activate/Close. Die Gesamtzahl der Prepare-Aufrufe
fiel von 60.750 auf 2.130, ihre gemessene Zeit von 772 auf 83 ms. Fachliche
Validierung, Versionsvergleich, Prüfsummen, einzelne Writes, Transaktionen,
WAL/FULL-Sync und echte Konstruktor-/Reopenpfade bleiben bestehen. Die bestehenden
Schema-Fixturekopien wurden nicht auf weitere Tests ausgedehnt.

Die neue Regression scheitert am bisherigen Code mit 1.770 Prepare-Aufrufen.
Sie prüft außerdem einen echten SQLite-Abbruch nach 20 eingefügten Definitionen,
vollständigen Rollback aller drei Tabellen und bytegleichen erfolgreichen Retry.
Die vorhandenen Projektionstests erhalten historische Versionen, Autorenkopien
und den schreibfreien unveränderten Wiederanlauf.

Weitere untersuchte Kosten wurden nicht vorschnell verändert: Ein kleiner
Compilervergleich mit vier Prozessen und 20 Builds ergab 2,804 versus 2,717 s
bei begrenzter interner Go-Threadzahl und identische Ausgabehashes. Das reicht
nicht für eine belastbare globale Beschleunigungsbehauptung; Compiler- und
Testparallelität bleiben unverändert. Wiederholte UI-Modulladung hält alte
Modulobjekte fest, wurde aber ohne ausreichenden Nachweis eines wesentlichen
Gesamtnutzens nicht umgebaut. Bereits vorhandene einmalige Vorbereitung und
geteilter Store-Build sind keine neuen Maßnahmen dieser Änderung.

## Wiederholen

```sh
python3 tools/measure-test-suite.py .build/test-suite-measurement
```

Der Zielordner muss neu sein. Das Werkzeug führt das normale `npm test` aus,
erhält dessen Exitcode und sichert `test-run.json`, TAP, GNU-time-Ressourcen und
sekündliche Linux-Host-/Prozessbeobachtungen. Die Messung enthält Vorbereitung;
Installation, Typprüfung, Produktbuilds und native Bedienung sind getrennt.
`/proc`-Datei-/Prozesswerte sind beobachtete Untergrenzen, da kurze Prozesse
zwischen zwei Stichproben fehlen können. Hostdruck gilt systemweit. Die
ursprünglichen Rohdaten bleiben lokal in `.build/section2-before` und
`.build/section2-after`; die kompakte Vergleichsevidenz ist hier eingecheckt.

Dieser Nachweis ist keine native Bedien-, Installations- oder Owner-Abnahme.
Releasequalifikation und vollständige Candidate-CI bleiben separate Liefergates.
