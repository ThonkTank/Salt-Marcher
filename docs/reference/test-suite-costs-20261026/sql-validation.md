# Suiteweite SQL-Kosten und aufrufgebundene Definitionsvalidierung

Status: Gemessener Teilabschluss von Abschnitt 2; Ziel unter 300 Sekunden weiterhin offen.
Owner: project
Last Reviewed: 2026-10-26
Source of Truth: [Messdaten und Quellhashes](sql-validation-measurements.json), betroffene Fachtests und unveränderte reguläre Testsuite.

## Diagnostische Aufnahme

Auf Main `822fab25172ecaf207e1cee26368619e96cb2ef3` wurde einmal die gesamte
Suite mit vorgeschalteter SQL-Instrumentierung ausgeführt. Alle 4660 Tests
bestanden; ein bestehender optionaler Skip blieb. Die 472,4 Sekunden inklusive
Vorbereitung sind **kein** Performance-Nachherlauf. Der unveränderte normale
Vergleichslauf brauchte 377,015 Sekunden. Die Instrumentierung ergänzt
Stackerfassung, Zähler, AsyncLocalStorage und begrenzte Aggregation; ihre
selbst gemessenen Zusatzabschnitte summieren sich auf mindestens 286,570
Sekunden über die Prozesse. Weitere Wrapper-/Iterator-/Ausgabeaufwände sind
darin nicht vollständig enthalten. Zeitdifferenzen sind deshalb nicht
unmittelbar Produktkosten oder eine Korrekturformel.

Erfasst werden Queryhash und SQL-Befehlsklasse, Codebesitzer, Verbindung,
Transaktionscallback beziehungsweise benannter Store-Validierungsaufruf,
Prepare- und Ausführungsanzahl/-zeit, Wiederholungen innerhalb dieser Grenzen
und Prepare-bis-Ausführungsverzögerung. SQL-Text, Datenbankpfade und Bindungswerte
werden nicht ausgegeben. Iteratorzeit wird bei `next()` erfasst. Die Instrumentierung
hält keine Statementobjekte fest; ihre Zuordnung benutzt WeakMaps. Eine
Kontrollprobe prüft zwei unabhängige Verbindungen, wiederverwendete Statements,
Iteration, Rollback und Ablehnung nach Close. Sentinelwerte erscheinen nicht
in ihren Protokollen.

Die native interne BEGIN/COMMIT/ROLLBACK-Verwaltung umgeht die öffentlichen
Prepare-Wrapper. Auch native interne Pragma-, Backup- und Serialisierungsarbeit
ist nicht als vollständig erfasst behauptet. Mehrfach-SQL in `exec` zählt als
ein öffentlicher Aufruf, nicht als einzeln aufgeschlüsselte native Statements.
Verbindungsdauer beginnt beim instrumentierten Konstruktor, bei anderweitig
entstandenen Verbindungen erst mit der ersten beobachteten Operation.
Statementverzögerung belegt keine GC-/Finalisierungsdauer. Private freie
Validierungsfunktionen werden anhand ihres Stacks fachlich zugeordnet;
sie haben nicht alle eine separat instrumentierte Aufruf-ID.

## Grenzen und gezielte Vervollständigung

Die erste Aufnahme begrenzt Detailgruppen auf 20.000 je Prozess. Zehn große
Testdateien erreichten diese Grenze: 301.976 Detailzuordnungen wurden sichtbar
als Überlauf erfasst, nicht stillschweigend als Null behandelt. Diese zehn
Dateien wurden anschließend gezielt mit drei statt acht Stackframes pro
Besitzer aufgenommen. Nur Core benötigte danach noch eine einzelne Wiederholung
mit einer festen Grenze von 50.000 Gruppen. Alle gezielten Tests bestanden.
Es gab keine zweite diagnostische Gesamtsuite und keine anschließende offene
Profilierungsserie.

Die ergänzte Zuordnung enthält keinen Überlauf. Ihre Zahlen ersetzen die
abgeschnittenen Dateien durch gezielte Aufnahmen bei anderer Last. Sie sind
somit eine zusammengesetzte Kosten-/Häufigkeitsaufnahme und keine neue
vergleichbare Suitezeit. Die ursprüngliche Aufnahme bleibt separat erhalten.

| Öffentliche SQL-Beobachtung | Ursprüngliche Suite, mit Detaillücken | Ergänzte Zuordnung |
| --- | ---: | ---: |
| Prepare-Aufrufe | 3.137.781 | 3.405.483 |
| Ausführungen | 8.546.329 | 8.995.292 |
| Prepare-Zeit | 142,462 s | 132,881 s |
| Ausführungszeit | 254,672 s | 241,727 s |
| Wiederholte Prepares innerhalb Verbindung und Besitzer | 1.888.744 | 2.169.006 |
| Wiederholte Prepares innerhalb instrumentiertem Scope und Besitzer | 1.296.614 | 1.396.879 |

234 Prozess-/Threadberichte erfassen SQL; nicht jede der 409 ausgewählten
Testdateien verwendet SQLite. 5259 Verbindungen werden beobachtet, 5257
regulär geschlossen. Die beiden übrigen Berichte gehören zu den absichtlich
beendeten `lost-answer`-/`before-write`-Worker-Fixtures aus
`tests/catalog/desktop-store-worker.test.mjs`, nicht zu einem behaupteten
regulären Close. Erwartete SQL-Fehler aus Negativtests sind getrennte Zähler;
die Tests selbst sind grün.

## Genau ein Entwurf

Die beiden aktuellen Definitionsabfragen sind die größten Prepare-Gruppen.
Innerhalb `validateItemsBackup` wurden je 267.824 Aufrufe beobachtet. Zusammen
entfallen dort in der ergänzten Zuordnung 17,681 Sekunden auf Prepare und
10,623 Sekunden auf Ausführung. Andere Aufrufe derselben Queries, weitere
Tabellenvalidierung, Rasterarbeit und tatsächliche Writes werden dem Entwurf
nicht zugeschlagen. Das ist ein belegter Kostenanteil, keine garantierte
Wandzeiteinsparung.

`validateCurrentItemDefinitions` verwendet pro Aufruf und Verbindung eine
lokale, bei Bedarf gefüllte Statementmap. Der bisherige Leser und die
Batchvalidierung teilen denselben Decoder und dieselben Fehlerpfade. Jede
Definition wird weiterhin gelesen, per Prüfsumme und Fachvalidator geprüft,
mit ihrer Revision abgeglichen und mit dem aufgezeichneten historischen Stand
verglichen. Legacy-Fallback, Prüfung sämtlicher historischer Versionen und
Shopvalidierung bleiben erhalten. Es gibt keinen globalen Cache und keinen
über Aufrufe oder Verbindungen geteilten Statementbestand. Kein Readresultat
wird gecacht. Konstruktoren, Close/Reopen, Transaktionen und Durability bleiben.

Ein unbelasteter Direktvergleich mit 100 vollständigen Validierungen ergibt
59.100 → 300 Prepares, 797,0 → 11,5 ms Prepare-Zeit und 2440,1 → 1078,1 ms
Gesamtzeit. Er wird nicht mit der Zahl aller Queries zu einem suiteweiten
Versprechen hochgerechnet. Der vollständige unverfälschte Nachherlauf bleibt
die maßgebliche lokale Vergleichsmessung.

Drei neue Regressionen prüfen frische Statementobjekte je Aufruf, Zuordnung
zur richtigen Verbindung, unveränderte Bytes beim Lesen, beschädigte aktuelle
und historische Prüfsummen, widersprechende gültig gehashte Fassungen,
Revisionsfehler, Transaktionsrollback samt erfolgreicher erneuter Validierung,
Legacy-Konflikte und zwei echte schreibgeschützte Wiederöffnungen. Der gezielte
Lauf mit Transferverträgen enthält 17 erfolgreiche Tests.

## Rohdaten und Einordnung

Die lokalen Rohdaten liegen unter `.build/section2d`: ursprüngliche
`full-instrumented`-/`full-sql`-Aufnahme, gezielte `recovered-sql` und
`recovered-core`, Instrumentierung samt Kontrollprobe, Queryaggregate und
Direktvergleich. Die kompakte eingecheckte Evidenz bindet Instrumentversionen
und Produktquellen per SHA-256. Es wurden keine Anforderungen, Quellenbindungen
oder Owner-Abnahmen umgeschrieben. Weitere Optimierungsentwürfe werden aus
dieser Aufnahme nicht umgesetzt; die 300-Sekunden-Bedingung bleibt unverändert.

## Unverfälschter vollständiger Vergleich

Auf demselben Host, Node 22.19.0 und weiterhin vier isolierten Testprozessen
braucht das normale `npm test` einschließlich Vorbereitung **377,015 → 370,562 s**:
6,453 s beziehungsweise 1,71 % weniger im Einzelvergleich. Vorbereitung:
0,768 → 0,821 s. User-/System-CPU: 1184,41/91,50 → 1159,65/90,97 s,
also zusammen 25,29 CPU-s weniger. Maximaler Prozess-RSS: 1.026.912 →
1.023.776 KiB. Keine parallelen Builds, Profile oder nativen Proben liefen;
die Desktopumgebung blieb aktiv. Es ist keine statistische Laufzeitverteilung.

Die Dateiauswahl ist mit 409 Dateien und gleichem Auswahlhash unverändert.
Alle bisherigen Testnamen bleiben erhalten, drei Regressionen kommen hinzu:
4664 Tests, 4663 bestanden, 0 Fehler, ein bestehender optionaler SRD-PDF-Skip.
Das Ziel bleibt um 70,562 s verfehlt. Die Diagnose wurde nicht als Performance-
Nachherlauf verwendet; weitere Optimierungen wurden aus ihr nicht angehängt.

## Lieferprüfung

`check:repo`, `check`, `check:desktop`, `build`, `build:desktop` und
`format:check` sind grün. Die [native Transferprobe](sql-validation-native.json)
prüft Main/Preload/SQLite mit Export, Import, unabhängiger Notiz-/Kartenänderung
und frischem Prozess. Beide Prozesse enden regulär mit Code 0, ohne Signal;
ihre PIDs sind anschließend abwesend, `errors` bleibt leer und das Archiv
unverändert. Entwicklungsbuild bei 100 % Zoom; keine Paketinstallation oder
Owner-Abnahme behauptet. Die tatsächlichen Testquellen wurden im gemeinsamen
Capability-Katalog verknüpft und mit `--geprueft` nachgeführt.
