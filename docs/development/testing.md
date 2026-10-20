# Automatisierte Tests

`npm test` bereitet die Testartefakte neu vor und führt alle aktiven Node-Tests
mit höchstens vier getrennten Testprozessen aus, begrenzt durch die verfügbaren
CPU-Kapazitäten. Ziel: weniger als 300 Sekunden
einschließlich Vorbereitung auf einem unbelasteten Entwicklungsrechner und im
Candidate-Job. Installation, Typprüfungen, Produktbuilds und native UI-Proben
haben eigene Zeiten. `npm test -- --serial` dient der Diagnose von Isolation
und Parallelisierung; es wählt dieselben Dateien aus.

Der Lauf schreibt `.build/test-run.json` mit Commit, Dirty-Status, Node-Version,
Dateiauswahl, Parallelität, Vorbereitung, Gesamtdauer und Ergebnis sowie
`.build/tests.tap` mit den einzelnen Ergebnissen. Nur Zeiten desselben Standes
unter vergleichbarer Last vergleichen. Ein schneller fehlgeschlagener Lauf
erfüllt das Ziel nicht. Der erforderliche Candidate-Check bleibt vollständig.

## Einzelne Abläufe prüfen

Nach Änderungen am Quellcode zunächst `node build.mjs --test` ausführen, dann
beispielsweise `node --test tests/desktop-combat-switch.test.mjs`. Das bleibt
auch für die benannten `test:desktop-*`-Skripte erforderlich. Jeder vollständige
Lauf erneuert die Vorbereitung automatisch.

- Die unveränderte Storage-Buildkonfiguration verwendet ein gemeinsam
  vorbereitetes Bundle. Der Helfer schreibt atomare Weiterleitungen in die
  bisherigen Fixturepfade; abweichende Buildoptionen werden normal kompiliert.
  Jede Testdatei läuft weiterhin in einem eigenen Prozess.
- Die DOM-Hilfe verwendet das vollständige Original-HTML und die echten
  UI-Module. Ein mutationsgebundener ID-Index ersetzt lediglich die lineare
  Suche von linkedom. Er wird auch vor synchronen Abfragen aktualisiert;
  doppelte IDs nutzen weiterhin die ursprüngliche Suche. Die Regressionen
  prüfen Ersetzen, Verschieben, Umbenennen, Entfernen und Fragmente.
- Die drei umfangreichen Live-/Reise-/Vorbereitungs-Fixtures kopieren ein im
  selben Prozess erzeugtes, geschlossenes leeres Datenbankschema. Jede Kopie
  erhält einen eigenen Dateipfad und eigene Verbindungen. WAL und FULL-Sync
  bleiben aktiv. Initialisierungs-, Migrations- und Reopen-Tests verwenden
  weiterhin die tatsächlichen Konstruktorpfade.

Testdateien dem geprüften Ablauf im gemeinsamen Capability-Katalog zuordnen.
Umbenennungen einschließlich alter Links nachführen. Fehlende Zuordnung ist
kein Grund zum Löschen. Eine automatisierte Prüfung belegt keine native
Bedienabnahme oder Owner-Abnahme.

## Gemeinsame native Sitzungen

`tools/native-session.mjs` besitzt das isolierte Profil, den Busproxy, Start,
echten Browserzoom, frische Fensteraufnahmen und reguläres Close/Fresh. Ein
Ergebnis wird erst nach normalen Prozessenden, verschwundenen PIDs, fehlerfreiem
Renderer und unveränderten fünf Runtimeartefakten veröffentlicht. Ein neuer
Lauf entfernt vorherige Erfolgsdaten bereits vor dem Fixtureaufbau. Notfall-Cleanup
ist kein normaler Prozessabschluss. Profile folgen `TMPDIR`; bei großen Fixtures
ein eigenes Verzeichnis auf Disk statt eines RAM-Dateisystems verwenden.

Vorbereitung/Generierung, narrative Beuteverteilung, Kampfverstärkung und manuelle
Timeline teilen diesen Unterbau. Die Skripte behalten ihre tatsächlichen
Bedienaktionen, Fehlerprovokationen und Fachassertionen. Aufruf weiterhin über
`python tools/ui-session.py node tools/test-desktop-….mjs`; der äußere Wrapper
räumt ausschließlich die eigenen, markierten UI-Prozesse auf. `QA_EVIDENCE_DIR`
trennt Vergleichsläufe; `GM_QA_ZOOM=2` wiederholt manuelle Timeline und Verstärkung
bei 200 Prozent. Die Gegenprobe gegen falsche Prozesserfolge steht in
`tests/desktop-editor-transition.test.mjs`. Native Evidenz und menschliche
Bedienabnahme bleiben getrennt.

## Bereinigung der historischen Tests

Der [Stand vor der Bereinigung](https://github.com/ThonkTank/Salt-Marcher/tree/c359cc5c890c3a34bc3ef66273081015d11d9ce8/tests)
enthält die entfernten Quellen und bleibt für datierte Belege verfügbar.
Originalanforderungen, Quellenbindungen und historische Acceptance-Einträge
werden durch die Bereinigung nicht umgeschrieben.

| Änderung | Grund und verbleibende Prüfung |
| --- | --- |
| Elf alte UI-Entries samt exklusiven Obsidian-Stubs entfernt | Sie prüften ItemView/FileView, Vault-Host, alte Katalog-/Notizpanels und den ehemaligen Atlas-Host. Diese Implementierungen sind kein Desktop-Lieferziel. Aktuelle Oberflächen werden durch die `desktop-*`-Tests und separate native UI-Proben geprüft. |
| `dungeon-view-state` und `open-unique-view` entfernt | Ausschließlich Obsidian-Leaf-/Workspace-Lifecycle; kein unterstützter Desktop- oder Importvertrag. |
| Sieben alte Atlas-Repository-Testdateien entfernt | `atlas-file-transaction`, `atlas-copy-recovery`, `atlas-repository`, `atlas-mount-lease`, `atlas-campaign-save`, `atlas-location-repository` und `atlas-spatial-repository` prüften den aufgegebenen Vault-/Mehrdatei-Journal-Writer. Die kanonische SQLite-Grenze bleibt unter anderem durch [Atlas](../../tests/desktop-campaign-atlas.test.mjs), [Landschaft/Transfer](../../tests/desktop-atlas-region.test.mjs) und [Archivtransfer](../../tests/desktop-archive-transfer.test.mjs) geprüft. Weiterhin benötigte Codecs und Formatprüfungen bleiben bestehen. |
| Kampfwechsel-Dateien zusammengeführt | Vier identische Testkörper teilen ihren Aufbau; offene und abgeschlossene Zielkämpfe bleiben ausdrücklich getrennte Varianten. Alle weiteren Szenarien wurden übernommen. |
| Wiederholte Gesamt-Schemaprüfungen der Itemquellen zusammengeführt | Derselbe unveränderte Transkript-/Inventarbestand wird einmal pro Fixture geprüft. Item-spezifische Quellen, Werte und beschädigte Varianten bleiben geprüft. |

Löschungen folgen dem tatsächlichen Prüfgegenstand, nicht einem Testzahlziel.
Langsame aktuelle Produktfälle bleiben Teil des vollständigen Laufs.
