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

Die ergänzende Bereinigung vom 20. Oktober basiert auf
[`cfd911bc1`](https://github.com/ThonkTank/Salt-Marcher/tree/cfd911bc1db934cd1b0ddc121c6c21fb0eaeaaa7/tests).
Die entfernten Implementierungen sind weder über `desktop/` noch über
`src/app/` erreichbar; ihre Produktanforderungen werden dadurch nicht aufgehoben.

| Ergänzung | Grenze der Bereinigung |
| --- | --- |
| Acht alte Bedienlogik-Dateien entfernt: Materialfarbe/-alpha, Pfadbibliothek, Katalog-Debouncer, feste Kartengrößen, Objektgesten/-bibliothek und Session-Raum-Key-Suche | Diese Tests prüfen die früheren Obsidian-Werkzeuge. Aktuelle Desktop-Suche, Objektbearbeitung und Kartenbedienung behalten ihre eigenen Tests. |
| Alte Grid-/Exportoptionen und Prefab-Forget-Tests entfernt | Ausschließlich Bedienhelfer des historischen Adapters. Rasterencoder, Universal-VTT, ARGB- und Import-/Codecprüfungen bleiben erhalten. |
| Zwei alte City-History-/Draft-Dateien sowie neun Alt-Fälle aus Atlas-Grundlagen, Terrain und City-Fixture entfernt | Der aufgegebene In-Memory-History-Pfad wird nicht mehr als Desktop-Nachweis geführt. Die enthaltenen Format-, Chunk- und Fixtureprüfungen bleiben ausführbar. |
| Positive Abschnittsvalidierung der Itemquellen einmal je Fixture | 56 wiederholte Validierungen unveränderter Daten entfallen. Jeder gegenstandsspezifische Vergleich und jede beschädigte Variante bleibt geprüft. |
| Renderer-Browsergrenze auf `src/app/renderer.ts` umgestellt | Der alte Renderer-/Worker-Aufbau entfällt; die Prüfung gegen privilegierte Imports gilt dem aktuellen Desktop-Einstieg. |

Auch die Planprojektion verwendet den gemeinsamen Storage-Build. Die native
Kampfwechselprobe legt ihr Profil unter `TMPDIR` ab, damit ein Lauf auf diesem
Host ausdrücklich ein Verzeichnis auf Disk verwenden kann.

## Prüfung einzelner Fälle statt Bestandsschutz für Dateien

Die vertiefte Bereinigung verwendet den
[Ausgangsstand dieser zweiten Runde](https://github.com/ThonkTank/Salt-Marcher/tree/2ff783072c8f5cca26012b6cb005e606a49665ad/tests).
Ein Import eines weiterhin genutzten Modells schützt nicht automatisch die
Hosttests in derselben Datei. Die Prüfung beginnt bei den ausgeführten Aktionen
und Assertions. Die konservative Abhängigkeitsprüfung umfasst alle Module unter
`src/app/` und `desktop/`, einschließlich Typimports und dynamischer
Imports mit literalem Pfad; sie ersetzt keine Prüfung externer Formatverträge.

| Entfernte Prüfungen | Grund und erhaltene Grenze |
| --- | --- |
| Alte Campaign-Ownership-, Runtime-Manifest-, Save-Participant- und World-Notes-Commit-/Readerfälle | Sie führen die aufgegebenen Datei-/Vault-Besitzer aus. Die Snapshot-/Contextvalidierung bleibt direkt am gemeinsamen Vertrag erhalten. Aktuelle SQLite-, Archivtransfer-, Quellverweis- und Kampagnenkopietests bleiben bestehen. |
| Alter Atlas-Capture, Navigation, gemeinsame In-Memory-History und Hostinteraktion | Repository-/Renderer-/Gestenaktionen gehören zum früheren Host. Die vorhandenen World-/City-/Dungeon-/Location-Codecs, Draftformate, Fixturehashes und räumlichen Bezugsmaße bleiben erhalten. Reine Fixtureprüfungen benötigen keinen Pixi-Host mehr. |
| Alter City-Editor, Hit-/Renderer-/Gestenpfad, Location-Key-Panel und Katalog-Viewstate | Diese Implementierungen sind vom Desktop getrennt; insbesondere die alte Annahme von sechs nicht verfügbaren Katalogbereichen ist kein aktueller Produktvertrag. Desktopeditor-, Such-, Kontext- und Entwurfsfälle bleiben bestehen. |
| Alte Auswahl-, Building-, Floor-/Resize-, Volume- und Sessionaktionen | Gemeinsame Modell-/Parserprüfungen sowie direkt geprüfte Berechnungen aus `src/compute.ts` bleiben erhalten. Gemischte Altfälle mit eigenständigen Import-/Text-/Draftbelegen bleiben vorsichtshalber bestehen, unter anderem V2-Draftmigration, V4-Markdown und paketgebundene Assetdaten. |
| Unregistrierte Manifest-Consumer-Matrix | Die Datei war bereits kein Bestandteil von `npm test` und prüfte ausschließlich alte Manifest-/Atlasbesitzer. Ihre Entfernung wird nicht als eingesparter ausgeführter Test gezählt. |
| Fünf positive Item-Abschnitts-/Schematests | Der bestehende vollständige Pakettest ruft dieselben Validatoren mit denselben Daten auf. Die Abschnittszahlen werden dort explizit geprüft. Alle einzelnen Quelldatensätze, XML-/Lizenzbelege und beschädigten Varianten bleiben bestehen. |

Der vollständige Bestand wurde anhand der Testkörper, Imports, eingebundenen
Quellen und Schleifen inventarisiert. Ähnliche Backup-, Besitzerwechsel- und
verspätete-Antwort-Tests bleiben erhalten, wenn sie andere Tabellen, Writer oder
Zeitpunkte prüfen. Bei den übrigen aktuellen Fällen wurde keine ausreichende
Gleichwertigkeit für weitere Löschungen festgestellt. Das ist keine Behauptung,
dass jeder verbleibende Fall minimal oder notwendig ist.

Vier gezielte Fehler wurden in temporären Kopien bzw. virtuellen Builds vor und
nach der Kürzung geprüft: Alphawert 256 zulassen, falsche D-Abschnittszahl melden,
D-Datensatzvergleich auslassen und Schemaprüfung ausschalten. Beide Teststände
weisen alle vier Fehler zurück; unveränderte Kontrollläufe bestehen. Dieser
Nachweis gilt für diese Änderungen, nicht als allgemeiner Mutation-Score.
Historische Fixtures und Abnahmebelege bleiben unverändert. Die betroffenen
nativen Item- und Raumgruppenproben verwenden jetzt `TMPDIR` für ihre Profile.

Bei der anschließenden Einzelprüfung der Regel-UI erwiesen sich Gruppenwechsel,
erneute Aktivierung derselben Gruppe, Quellenrevision und Schreibantwort als
unterschiedliche Prüfgegenstände. Die A→B→A-Probe verwendet jetzt eine verspätete
Antwort mit höherer Revision: Mit einer niedrigeren Revision hatte der
Revisionsschutz einen defekten Aktivierungsschutz verdeckt. Eine Gegenprobe mit
reiner Identitätsprüfung besteht vor dieser Testkorrektur und scheitert danach.
Die Zahl der Fälle bleibt gleich; dies ist keine weitere Testeinsparung.

Die Integritätstests für Gruppen, Schatzentwürfe, NPCs und Szenentisch prüfen
weiterhin jede beschädigte Feldvariante direkt. Leser und Backup verwenden dort
dieselben Zeilenvalidatoren (`checkedDraftRow`, `checkedRow`, `recordRow`,
`readNpcDraftRow`, `checkedState` beziehungsweise `checkedTreasureRow`).
Eine explizit markierte Variante je Prüfpfad behält zusätzlich die vollständige
Backup-Kopie und den Bytevergleich des bisherigen Backupziels. Fehlende Tabellen,
NPC-Belege und die separate Gegenstandsauflösung bleiben eigenständige Prüfungen.

Damit entfallen in diesen vier Dateien 31 wiederholte Backup-Paare: gemessen
111 statt nun 49 Backup-Aufrufe bei unverändert 71 ausgeführten Fällen.
62 wiederholte Assertions entfallen; Feld-, Quellbyte-, Schreib-, Kopier- und
Wiederöffnungsprüfungen bleiben erhalten. Neun isolierte Fehler werden vor und
nach der Kürzung erkannt. Zwei weitere Gegenproben lassen jeweils nur die
NPC-Record- oder NPC-Draft-Schleife aus; andere Entwurfs-/Recoveryprüfungen
fangen die beschädigten Daten weiterhin ab. Diese beiden Gegenproben belegen
deshalb keine Erkennung einer ausgelassenen Schleife.
