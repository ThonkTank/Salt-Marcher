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
Renderer und unveränderten elf Runtimeartefakten veröffentlicht. Ein neuer
Lauf entfernt vorherige Erfolgsdaten bereits vor dem Fixtureaufbau. Notfall-Cleanup
ist kein normaler Prozessabschluss. Profile liegen unter `~/.cache/saltmarcher/ui/` auf Disk, unabhängig vom
RAM-basierten `/tmp`.

Die Sitzung verwendet standardmäßig dieselbe Plattformwahl wie ein normaler
Electron-Start. `QA_OZONE_PLATFORM=x11`, `wayland` oder `auto` erlaubt einen
gezielten Vergleich; angeforderte Plattform und Desktop-Sitzung stehen im
Prozessbeleg. Der frühere feste X11-Schalter verzerrte auf diesem Wayland-Host
die Einordnung der Atlas-Framezeiten. [Vergleich, Trace und verbleibende
Grenzen](../reference/atlas-presentation-platform-20261022/README.md).

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

Bei Autonomieintervallen ersetzt die vorhandene Desktop-Matrix den doppelten
Core-Fall für beschädigte historische Jobsteuerung. Der verbleibende Fall schützt
ausdrücklich einen älteren Backupstand und zusätzlich den Kampagnenexport.
Catch-up und Kopierprüfung verwenden beide `checkedIntervalRow`; unterschiedliche
Intervallfehler bleiben direkt geprüft, die beiden Kopierwege jeweils einmal.
Aktuelle Jobidentität und Revision bleiben über Lesen und Zeitbestätigung geprüft;
die gespeicherten Steuerwerte prüfen weiterhin den gemeinsamen Backup-Einstieg.
Die Byteprüfung nach fehlerhaftem Lesen ersetzt die bisherige bloße Längenprüfung.
So entfallen ein ausgeführter Fall, 16 wiederholte Assertions und zwölf
Datenbankkopien. Bewegung, Fallenreset, Schaden und Fehler nach dem ersten von
mehreren Actors behalten ihre getrennten Rollback-/Wiederholungsprüfungen.

Die Autonomie-Kontextfixtures erzeugen eine zweite Kampagne nur für die drei
Kampagnenwechsel-Szenarien. In den acht anderen UI-Fällen entfallen dadurch acht
ungenutzte Kampagnen samt NPC-, Job- und Zeitaufbau: gemessen 22 → 14 Kampagnen
und 48 Aufbauaufrufe weniger. Alle 43 Kontext-/Zeit-/Reihenfolgefälle bleiben.
Zwei erneute Catch-up-Fehlerassertions nach unveränderten Backup-/Exportversuchen
und ein redundanter Sprachvergleich entfallen: Quellbytes werden weiterhin
verglichen, und beide Sprachen müssen jeweils denselben vollständigen Sollwert
liefern. Unterschiedliche Aktivierungen, Requestreihenfolgen, Abbruchzeitpunkte,
Clockowner und Reservierungsziele bleiben getrennte Prüfungen.

Der bestehende Flush-Wechseltest prüft zusätzlich, dass vor der Freigabe einer
zurückgehaltenen aktuellen Antwort kein weiterer Schreibauftrag gesendet wird.
Zuvor verdeckte die sofortige Antwortfreigabe einen fehlenden Schutz des neueren
Flushes. Diese Fehlergegenprobe besteht mit dem alten Test und scheitert mit
der zusätzlichen Assertion; fünf andere Fehler werden weiterhin erkannt.

Die übrigen sechs Integritätsdateien behalten ihre 87 Fälle. Bei Encountertabellen
prüft jede Feldvariante weiterhin den gemeinsamen `decodeTable`; die explizite
Variante mit doppelten Kreaturen behält zusätzlich Speichern, Papierkorb und
Fresh. Zehn zusätzliche Zeilenvergleiche entfallen, weil jeweils bereits die
gesamte Quelldatenbank bytegleich bleiben muss. Der isolierte Zeilenvergleich bei
absichtlich bearbeiteter anderer Kampagne bleibt bestehen.

Beim Session-Beuteausgleich liegt `checkedLedgerRow` vor der Gold-/Magieaufteilung.
Alle sechs beschädigten Felder bleiben geprüft; die Identitätsvariante prüft beide
Einstiege. Einzel- und Sammelübernahme verwenden dieselbe
`assertSessionRewardBasisCurrent`-Prüfung. Fünf wiederholte Sammelversuche mit nur
einem Vorschlag entfallen; die echten Zweierbatches behalten Ablehnung vor dem
ersten Write, Reihenfolge/Replay und Rückrollen nach dem ersten Gruppenwrite.
Narrative Empfänger und Szenen bleiben direkt geprüft; nur die wiederholte
Backupprüfung für Szenen entfällt. Die Empfängervariante schützt weiterhin den
gemeinsamen `checkedAward`-Backupaufruf. Separate Draft-, Status- und
Notizkontrollen im Backup bleiben erhalten.

Insgesamt entfallen 52 wiederholte Assertions, 14 Tabellen-Schreibversuche,
fünf Session-Schreibversuche, fünf Beuteausgleichsaufrufe, sieben Fresh-Verbindungen
und eine Backup-Kopie. Dies reduziert keine Testfälle. Zehn isolierte Fehler
werden vorher und nachher erkannt. Zwei weitere ausgelassene Einzelkontrollen
werden durch den Tabellen-Ergebnisleser beziehungsweise den gemeinsamen
Fortschrittsdecoder aufgefangen; deren Auslassung wird in beiden Testständen
nicht erkannt. Die Gegenproben belegen keine allgemeine Mutationsabdeckung.
Sessionkopie, Wetter und Legendary-Transfer behalten ihre unterschiedlichen
Writer-, Owner-, Zeit-, Recovery- und Replayprüfungen unverändert.

Die 57 positiven Einzelgoldens der Bags-/B-/C-/D-/E-Itemabschnitte entfallen.
Der bestehende Test `items source package is explicitly incomplete and fails
closed by default` in `items-srd51-source.test.mjs` vergleicht bereits sämtliche
vollständigen Referenzdatensätze und Inventarvorkommen mit dem eingecheckten
Paket, einschließlich fehlender Felder. Quellen-XML, Hashbelege, Tabellenzellen,
Seitenfortsetzungen, Flüche und gegenstandsspezifische Sonderregeln bleiben
separat geprüft.

Jeder Gegenstand behält eine beschädigte Prosa und eine beschädigte
Inventarzuordnung als Negativprobe. Die übrigen Feldvarianten stehen einmal
pro Abschnitt beim ersten Gegenstand: Jeder Abschnitt besitzt einen eigenen
Vergleichseinstieg. Die separaten Tabellen-/Reihenfolgefälle bleiben bestehen.
Fünf weitere positive Gesamtvalidierungen und zwölf wiederholte globale
Inventarassertions entfallen; deren konkrete Gegenstücke stehen im zentralen
Pakettest und im B-Abschnitt. Im Projektionstest entfällt ein erneutes Lesen
der bereits geprüften Revision nach einem nachweislich schreibfreien Startup.

Damit entfallen 57 ausgeführte Fälle und rechnerisch 823 Assertions; gemessen
243 tiefe Datenkopien. Der Teilbestand einschließlich zentralem Quellpakettest
sinkt von 195 auf 138 Fälle (jeweils ein optionaler PDF-Skip). In jedem der fünf
Abschnitte erkennen alte und reduzierte Tests eine falsche Referenzprojektion,
einen ausgelassenen Datensatz, ein ausgelassenes Inventarvorkommen und eine
ignorierte Attunementprüfung. Die 20 Fehlergegenproben und ihre 40 unveränderten
Kontrollläufe ersetzen keine vollständige PDF-, native UI- oder Owner-Abnahme.
Die beiden Reward-UI-Fälle bleiben getrennt: Katalogreferenzen und unfertige
freie Eingaben besitzen unterschiedliche Bearbeitungsregeln.

Die zentrale Item-Quelldatei prüft die positiven Ergebnisse von Opening Slice,
Animated Shield, Apparatus, Armor +1/+2/+3, Invulnerability und Healing-Merge
vollständig im vorhandenen Pakettest. Sechs zweite positive Validatoraufrufe
entfallen; die beiden reinen Wiederholungsfälle für Shield und Invulnerability
werden entfernt. Literale Quellenfakten, Hebelzuordnung, Varianten, Mergefehler
und die sieben unterschiedlichen Prüfungen physischer Tabellenzeilen bleiben.
Die gesonderte positive Schemakompilierung entfällt ebenfalls; der negative
Subkategorietest bleibt neben der vollständigen Paketprüfung.

Die Armor-/Arrow-Matrix prüft weiterhin jeden der vier Datensätze und jedes
Inventarvorkommen negativ; weitere Feldvarianten laufen einmal über denselben
vollständigen Zeilenvergleich. Die unveränderliche Original-XML-Datei wird
nur einmal gelesen; ihre fünf Identitäts-/Hashassertions liegen im bestehenden
Quellenbelegtest. Koordinaten- und Footeradversarien behalten ihre eigenen Fälle.
Vollständige Sollwertlisten ersetzen zusätzlich daraus bereits folgende
Längen-, Einzelwert- und Abwesenheitsassertions.

Gemessen sinken die Assertions dieser Datei von 332 auf 283, tiefe Kopien von
112 auf 85 und direkte Dateireads von 75 auf 64. Die 48 Fälle werden zu 46,
weiterhin mit einem optionalen vollständigen PDF-Lauf. Elf isolierte Fehler
werden vorher und nachher erkannt: sechs falsche Ergebniszusammenfassungen,
drei ausgelassene Armor-/Arrow-Kontrollen, eine umgangene Schemaprüfung und ein
falscher XML-Hashbeleg. Alle 22 unveränderten Kontrollläufe bestehen. Die
Zusammenfassung allein gilt nicht als Einsparung: Tatsächlich entfallen sieben
wiederholte positive Validatoraufrufe und die gemessenen Aufbau-/Prüfkosten.

Die semantische Prüfung von Item-Referenz und Item-Auswahl erhält alle 47 Fälle.
Öffentliche Quellenreferenz und bearbeitbare Definitionen haben unterschiedliche
Controller und Speichergrenzen; gleiche Gegenstandsnamen machen ihre Tests nicht
doppelt. Auswahl-, Query-, Aktivierungs-, Übergabe- und Kontextantworten sowie
Transport- und Speicherfehler bleiben separat. Der gemeinsame Auswahlaufbau legt
NPCs und Shops nur noch für die zwei Fälle mit vorhandenen, nicht ausgewählten
Shops beziehungsweise ausdrücklicher Bestandsübernahme an. Die anderen 30 Fälle
benötigen sie nicht. Gemessen entfallen 60 NPC- und 60 Shop-Schreibaufrufe im Aufbau;
beide Figuren, Definitionen und alle Assertions bleiben. Vier isolierte Fehler
(falsche Definitionsantwort, unerlaubte Shopabhängigkeit der Vergabe, ausgelassene
Bestandsübernahme und zu früh freigegebener Nutzungskontext) werden vorher/nachher
erkannt. Alle acht unveränderten Kontrollläufe bestehen. Die 47 lokalen Fälle
bestehen vor und nach der Änderung; daraus folgt keine kausale Laufzeitbehauptung.

Die Katalogphase beurteilt Buildasset, Kreaturprovider, Campaignkatalog, Query/
Kontext und XP-/Reaktionsprojektion gemeinsam: 105 Fälle werden zu 104. Ein
Detailfehler-Ablauf lief zweimal mit demselben `ok:false`-Pfad und nur anderem
Fehlertext; die verbleibende Variante prüft Anbietertext, gesperrte alte Aktionen
und erneute Auswahl. Vier andere Detailfälle benötigen keinen vorbereiteten
Encounter. Aktions-, Aktivierungs- und Rosterprüfungen behalten diesen Aufbau.
Gemessen fallen dessen Speicheraufrufe von acht auf drei, einschließlich des
entfallenen Falls; die Assertions der drei geänderten Dateien von 1.287 auf 1.269.

Der Buildassettest liest zwei Dateien direkt und verwendet den schon vorbereiteten
Payload. Drei zusätzliche Node-Hilfsprozesse und eine zweite Payloadvorbereitung
entfallen; echter Build, Revision, Grenzen, Quellenhash und Einbettungsassertions
bleiben. Das beschädigte Quellenfixture wird anschließend aufgeräumt. Die beiden
XP-/Reaktionsprüfungen teilen einen tief unveränderlichen Katalog statt ihn zweimal
zu konstruieren. Historische Quellenstände und vollständige Projektionen bleiben.
Sechs Fehler werden vorher/nachher erkannt; 14 unveränderte Kontrollläufe bestehen.
Ein einzeln entfernter später Fehlerguard bleibt in beiden Fassungen durch den
früheren Antwortguard verdeckt; der Ausfall beider Guards wird erkannt. Das ist ein
begrenzter Nachweis der betroffenen Pfade, keine allgemeine Mutationsquote.

Die Regel-/Textreferenzphase prüft zehn Dateien mit 112 bisherigen Fällen und
behält 110. Der gemockte reine Autorenlink-Handoff entfällt zugunsten des bereits
vorhandenen Store-/UI-Falls mit exakten Textbytes und Gruppenbesitzer. Die einfache
Ortsauswahl steckt im ausführlicheren Navigationsfall; ihre Dokumenttextassertion
prüft dort weiterhin genau die erste Auswahl. Alle Quellen-, Recovery-, Kopier-,
Readonly- und historischen Regelzustände bleiben separat.

Acht unterschiedliche Literalformen bleiben einzeln im Textparser geprüft.
Die drei unveränderten Verbraucher für Klartext, Kopier-Remap und Dokumentverweise
laufen auf dessen leerem Ergebnis einmal statt achtmal. Gemessen sinken in dieser
Matrix 32 Assertions auf elf und 40 Parseraufrufe auf zwölf. Positive Umformung,
CRLF/Autorenbytes, lange Quellen und unbegrenztes Kopieren behalten eigene Fälle.
Acht isolierte Fehler werden vorher/nachher erkannt: drei Parsergrenzen, die drei
Verbraucher, das gerenderte Ortsziel und unveränderte Übergabeprosa. Alle 16
unveränderten Kontrollläufe bestehen. Bei der Ortsdarstellung trägt die übernommene
Assertion die bisherige Fehlererkennung. Das ist kein nativer Fokus-/Tastaturnachweis.

Die Notizphase behält alle 84 Fälle in sieben Dateien: Suche, Editorbesitz,
Auszüge, Merge, Lesetext und Quellenwiederherstellung prüfen unterschiedliche
Zustände. Die Suchfixtures erzeugen nur benötigte Treffer und Gegenbeispiele:
Für drei Seiten genügen 40 + 40 + 2 Notizen. Bei der Regelsuche bleibt eine zum
Suchtext passende Nichtregel vor den 45 Regeln; 84 nicht passende Notizen
entfallen. Allgemeine Suchfälle behalten ein Gegenbeispiel dort, wo sie es prüfen.
Die dritte Recovery-Quelle wird nur für die spätere neue Beziehung angelegt.
Gemessen sinken neue Notizschreibaufrufe in beiden Dateien von 257 auf 150.
Die Recovery-Datei nutzt außerdem den bereits vorbereiteten Store statt ihn
zusammen mit dem kleinen Editierhelfer nochmals vollständig zu kompilieren.

Acht isolierte Fehler bleiben vorher/nachher erkannt: fehlender Regeltypfilter,
Filterung erst nach der Seitengrenze, ignorierter Suchtext, ignorierter Seitenoffset, gekürzte letzte Seite, fehlende Kampagnenfilterung,
ignorierte History-Prüfsumme und eine fälschlich verfügbare Papierkorbquelle.
Alle 16 unveränderten Kontrollläufe bestehen. Assertions und unterschiedliche
Fälle bleiben erhalten; diese Kürzung belegt eingesparten Aufbau, keine native
Abnahme und keinen aus einzelnen Laufzeiten abgeleiteten Geschwindigkeitsgewinn.

Die Notizmappen-/Raumverwendungsphase behält alle 107 Fälle aus fünf Dateien.
21 reine Lese-, Papierkorb- und Validierungsfälle erstellen keinen ungenutzten
Spielabend mehr. Die zehn Fälle mit tatsächlichem Besuchs- oder Planwriter behalten
den bestehenden Plan und beide Besuche. Fünf ungültige Seitenoffsets benötigen
keine Kindnotizen. Gemessen sinken Notizschreibaufrufe von 532 auf 517 und
Plan-Schreibaufrufe von 35 auf 14; die Zahlen schließen geprüfte Replayaufrufe ein.

ID-, Revisions- und Löschstatusschäden bleiben jeweils in Mappe, Vorbereitung und
Restore geprüft. Ihr gemeinsamer Zeilenvalidator wird im Backup einmal angebunden
statt dreimal: zwei Backupaufrufe und vier wiederholte Assertions entfallen.
Sieben isolierte Fehler bleiben vorher/nachher erkannt; alle 14 Kontrollläufe
bestehen. Ohne Offsetvalidierung wurden früher zwei Fehler durch einen späteren
Indexierungsfehler verdeckt. Die fünf Offsetfälle verlangen jetzt die beabsichtigte
Validierungsfehlermeldung, sodass alle fünf die entfernte Prüfung erkennen.
Unterschiedliche DOM-Besitzer, Fehlerzeitpunkte, Scan-/Seitengrenzen und beschädigte
Raumquellen bleiben unverändert. Diese Phase liefert keinen neuen nativen Nachweis.

Die Beziehungsphase prüft vier `core/world-links`-Dateien mit 65 Fällen und
behält 64. Der Einzelfall zur verspäteten Einweg-Draftantwort nach erneutem Öffnen
mit demselben Token wiederholt den Single-/Draftfall der Writer-Matrix. Seine
zusätzliche Revisionsassertion bleibt dort erhalten. Unterschiedliche Writer,
Antwortzeitpunkte, fremde Entwürfe und Recoveryzustände bleiben separat.

Die zusätzliche Familienkopie wird im vorhandenen History-Kopierfall geprüft:
Er kopiert jetzt ebenfalls nach einem Undo-/Redo-Zyklus und prüft beide
Gegenrichtungen einschließlich Typ, Beschriftung und neuer Ziel-ID exakt.
Der direkte Familientest behält Paarvalidierung, Graph und Undo/Redo. Gemessen
sinken Snapshotaufrufe von sieben auf sechs, unabhängige Importe von sechs auf
fünf, Storeinstanzen von 73 auf 71 und neue Notizschreibaufrufe von 127 auf 125.
Für den erhaltenen Zustand kommen zwei Historyaufrufe hinzu (17 → 19).
Vier direkte wiederholte Assertions entfallen; drei weitere werden übernommen.

Drei isolierte Fehler bleiben vorher/nachher erkannt: fehlender Dialogbesitz
bei verspäteter Draftantwort sowie veränderte Familientypen und Beschriftungen
beim Kopieren. Alle sechs unveränderten Kontrollläufe bestehen. Die Kopierfehler
werden nach der Bereinigung durch die übernommenen Assertions erkannt.
Das belegt die genannten Überschneidungen, keine vollständige Fehlerabdeckung,
keine aus Einzelmessungen abgeleitete Beschleunigung und keine native Abnahme.

Die Weltquellenphase prüft drei Dateien mit 41 Fällen und behält 40. Die einfache
Fraktionshaupttabellenanzeige wird bereits zu Beginn der Inline-Tabellenanlage
geprüft; ihre beiden zusätzlichen Assertions zu Ortscheckboxen und Bestand
stehen jetzt dort. Rohtexte, Hintergrundrefresh, Escape/Abbrechen, Schreibantworten
und alte Callbacks bleiben eigene Prüfungen.

Alle zehn beschädigten Quellenfelder und drei Fremdkampagnenbindungen bleiben
im Leser geprüft. Leser und Backup verwenden dieselben Funktionen `sourceRow`
und `sourceReferences`; ungültige Haltung und fremder Owner prüfen deren
Backupanbindung einschließlich unverändertem Sicherungsziel. Elf wiederholte
Backup-Paare entfallen, gemessen 31 → 9 Backupaufrufe. Fehlende Tabelle,
archivierte Bindung, Stock-Pruning und tatsächliche Kopie/Fresh behalten ihre
eigenen Backups. Insgesamt entfallen 23 wiederholte Assertions; zwei werden
übernommen.

Fixtures erstellen nur benötigte Fraktionen, Orte und Tabellen. Gemessen sinken
Notiz-Neuschreibaufrufe 44 → 35, Orts-Neuschreibaufrufe 27 → 8, Tabellenwrites
44 → 31 und Quellenwrites 62 → 46. Kopierte Vorschauen behalten Ortsfilter und
beide Zustände: unverändert übernehmbar sowie bereits vor der Kopie veraltet.
Die Constraintprüfung nutzt den vorbereiteten Store und baut nur ihren direkten
Resolver separat; ein erneuter vollständiger Store-Build und zwei zusätzliche
Katalogkopien entfallen.

Acht isolierte Fehler bleiben vorher/nachher erkannt: ausgelassene Backupprüfung,
ungültige Haltung, fremde Fraktions-/Tabellenbesitzer, ignorierte ausgewählte
Fraktion, unveränderte Stockbasis, übersprungene Quellenprüfsumme und eine
fälschliche Ortscheckbox für die Fraktionshaupttabelle. Alle 16 unveränderten
Kontrollläufe bestehen. Diese Belege qualifizieren die genannten Testkürzungen,
keine native Abnahme und keine kausale Laufzeitverbesserung.
