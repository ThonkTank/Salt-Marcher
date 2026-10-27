# Automatisierte Tests

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-27 (native Sitzungen, Einstiegskatalog und Suitebereinigung; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

`npm test` führt die aktive Auswahl lokal standardmäßig mit einem Testprozess aus.
Auf Linux startet der Runner dafür eine eigene systemd-Benutzerscope mit
`MemoryHigh=2G` und `MemoryMax=3G`, sofern bereits geerbte tatsächliche
Cgroup-Grenzen nicht mindestens ebenso eng sind. Ein Startfehler führt zum
Abbruch; es gibt keinen unbeschränkten Ersatzstart. Der bestehende
`codex-chat-protection@UID`-Dienst schützt die App separat und wird nicht verändert.
Andere schwere Prüfungen laufen mit `npm run verify:local -- npm run check`
(entsprechend für `check:desktop`, `build` und `build:desktop`).

`--concurrency=N` verlangt eine positive ganze Zahl innerhalb des ermittelten
CPU-/Speicherbudgets; `--serial` erzwingt eins. CI bleibt ohne systemd-Abhängigkeit
und verwendet höchstens vier Prozesse, begrenzt durch CPU und verfügbaren
Speicher inklusive geerbter Cgroup-Grenzen. Nicht-Linux-Systeme laufen portabel;
der Launcher behauptet dort keine Betriebssystem-Speichergrenze.

Jeder Lauf schreibt `.build/test-runs/UUID/report.json` und `tests.tap` mit
Commit, Dirty-Status, Auswahl, Parallelität, effektiven Speichergrenzen,
Vorbereitungs-/Test-/Gesamtdauer und Ergebnis. Asset-Einträge enthalten
Cachetreffer, Grund, Schlüssel und Zeit. Unter Linux enthält der Bericht außerdem
die Cgroup und ihren Speicherhöchststand. `.build/test-run.json` verweist durch
seinen Inhalt auf den letzten abgeschlossenen Lauf. Nur Zeiten desselben Standes
unter vergleichbarer Last vergleichen. Ziel unter 300 Sekunden für die gesamte
Suite bleibt offen; der vollständige Candidate-Check bleibt erforderlich.

## Pauschale Bereinigung vom 27.10.2026

Der Nutzerauftrag verlangt höchstens die Hälfte von Testcode und Testdefinitionen,
mit einem groben Schnitt statt einer vollständigen Einzelprüfung aller Fälle.
Entfernt wurden der historische TypeScript-Core-Sammelrunner samt ausschließlich
zugehöriger Helfer, ADR-/Hostreferenztests, externe Referenzwerkzeugtests und breite
synthetische UI-Matrizen aus Atlas, Kampagne, Katalog und Live-Spiel. Manche dieser
Matrizen prüften weiterhin vorhandene Funktionen: die Kürzung ist ausdrücklich
keine Behauptung, alle entfernten Tests seien fachlich überholt oder redundant.

Erhalten bleiben die aktuellen Terrain-/Deck-Grenzen, Commit-Recovery,
Store-/Transferverträge, Host-/Renderertrennung, Workspace-Aktivierung und die
separaten nativen Desktopproben. Die früheren Detailprüfungen von UI-Races,
Entwürfen und Kontextwechseln werden dadurch nicht vollständig ersetzt.
Historische Testverweise sind auf den Ausgangscommit gepinnt; das Quellenregister
und Abnahmebehauptungen wurden nicht umgeschrieben. Entfernte Testdateien sind
wirklich gelöscht, nicht lediglich ausgeblendet oder als Skip markiert.

Die Messung zählt `.mjs`- und `.ts`-Quellen unter `tests/` einschließlich Helfern,
aber keine Binärfixtures, nativen Skripte unter `tools/` oder Buildausgaben.
Testdefinitionen sind syntaktische `test`-/`it`-/`t.test`-Aufrufe; parametrisch
entstehende Laufzeitfälle werden gesondert durch den Runner berichtet.

| Maß | Ausgangsstand `4eab71004` | Bereinigt | Restumfang |
| --- | ---: | ---: | ---: |
| Testcode einschließlich Helfer | 158.888 Zeilen | 75.294 Zeilen | 47,4 % |
| Statische Testdefinitionen | 3.916 | 1.704 | 43,5 % |

Die früheren Laufzeiten unten gehören zum früheren Bestand und sind kein
Beschleunigungsnachweis für die verkleinerte Suite.

Lokale Prüfung: alle 280 aktiven Dateien, 2.213 bestandene Laufzeitfälle,
keine Fehler und ein optionaler SRD-PDF-Fall ohne `SRD51_SOURCE_PDF` übersprungen.
Node 22.22.0, ein Testprozess, 836,0 Sekunden einschließlich Vorbereitung;
Report `.build/test-runs/349fb8ed-c1ae-42c4-8a2f-e37aa45b13f0/report.json`.
Der blockierte systemd-Scope-Start wurde nicht verändert: ausschließlich der
Prüfprozess lief in einer temporären Cgroup mit nachgewiesenen 2/3-GiB-Grenzen;
Speicherhöchststand 1.444.696.064 Bytes, regulärer Exit 0, Cgroup danach entfernt.
Repositoryprüfung, vollständige Typ-/Umgebungsprüfung, tatsächliche Store-Testvorbereitung,
Formatprüfung der geänderten JS-Dateien und `git diff --check` bestehen ebenfalls.
Dies ist lokale Testqualifikation, keine neue native Produkt- oder Candidate-Abnahme.


## Gemessene Initialisierungskosten

Der [Vergleich vom 26.10.2026](../../reference/test-suite-costs-20261026/README.md)
misst auf demselben Vier-Thread-Host 424,6 → 388,1 Sekunden einschließlich
Vorbereitung, mit unveränderter Dateiauswahl und einer zusätzlichen Regression.
Die SRD-Installation und Tabellenprüfung verwenden ihre SQL-Anweisungen nun
innerhalb desselben Aufbaus wieder. Echte neue SQLite-Dateien, Konstruktoren,
Validierung und Reopen bleiben erhalten. Das Ziel unter 300 Sekunden bleibt
offen; die Evidenz beschreibt verbleibende CPU-Arbeit und Hostgrenzen.
`python3 tools/measure-test-suite.py .build/neue-messung` zeichnet den normalen
Gesamtlauf einschließlich Vorbereitung und Linux-Hostlast auf.

### Gezielte Cachemessung am 27.10.2026

Gleicher Dirty-Checkout auf Basis `ee58456ab`, Node 22, ein Prozess,
Linux-Scope 2/3 GiB. „Kalt“ bedeutet noch kein Artefakt zum aktuellen
Inhaltsschlüssel, nicht geleerten Betriebssystem-Dateicache. Zeiten beginnen
im Runner nach dem Scope-Start; eine systemd-Startwartezeit ist nicht enthalten.

| Auswahl | Kalt / warm gesamt | Asset-Vorbereitung kalt / warm | Tests je Lauf |
| --- | --- | --- | --- |
| Core | 36,39 / 34,73 s | 1375 / 93 ms | 414 bestanden |
| Note-Merge + Schema-Isolation | 3,09 / 3,28 s | Store 520 / 49 ms, weiterer Treffer 59 / 78 ms | 17 bestanden |
| Runner-/Cache-Regressionen | 1,59 s | kein Core-/Store-Build | 16 bestanden |

Core erzeugte kalt genau ein Core-Bundle und warm keines; Store-Auswahl kalt
nur ein Store-Bundle und warm keines. Die Store-Gesamtzeit wurde trotz
vermiedenen Builds nicht kürzer; daraus folgt keine allgemeine Beschleunigung
der Fachtests. Höchster gemessener Scope-Speicher: 725 MiB (Core kalt).
Diese Stichprobe ist kein neuer vollständiger Suite-Benchmark und keine native
Produktabnahme. Die lokalen Detailbelege liegen unter `.build/test-runs/`:
`5322173f-ee3a-4eeb-8e2c-deae5377876b`,
`af798b82-aae7-4f62-8a01-696f0fc406ae`,
`7b8d55dd-a205-4e1f-a954-a3310a9d2b74`,
`c6522471-24d4-4a8c-b442-e889352f55bb` und
`f4061def-682c-4cec-a918-4e47f4a7e86f`.

## Einzelne Abläufe prüfen

`npm test -- tests/atlas/desktop-atlas-commit-recovery.test.mjs` bereitet nur tatsächlich benötigte gemeinsame
Testartefakte vor und führt anschließend die ausgewählten Dateien aus.
Mehrere explizite Dateipfade sind erlaubt; doppelte Pfade werden nur einmal geprüft.
Fehlende Dateien, Verzeichnisse, unbekannte Optionen und leere Pfade werden vor dem
Build abgewiesen. Auch die benannten Node-Testskripte `test:desktop-*` verwenden
diese Vorbereitung. Native UI-Skripte bleiben separate Prüfwege.

`npm test -- --list` zeigt die vollständige aktive Auswahl ohne Build oder Tests;
Dateipfade und `--serial` lassen sich damit kombinieren. Die Standardsuite entdeckt
aktive Node-Tests im Testwurzelverzeichnis und den Fachordnern `workspace`, `atlas`,
`campaign`, `runtime`, `catalog` und `shared`. Es gibt keinen Core-Sammelrunner und
keine zusätzlich eingeschleusten ADR-Tests mehr. Alle verbleibenden aktiven Tests
sind direkt auswählbare `.test.mjs`-Dateien; Fixtures werden nicht als Tests entdeckt.
Für direkte `node --test`-Aufrufe bereitet `node build.mjs --test` weiterhin
Store und Katalog vor (unter Linux über `verify:local`).

- Store wird erst beim tatsächlichen Standard-Store-Build im Testhelfer vorbereitet.
  Katalogdateien für individuelle Fixtures werden ohne Bundle-Build bereitgestellt.
  Abweichende Buildoptionen bleiben individuelle esbuild-Aufrufe; jede Testdatei
  läuft in einem eigenen Prozess.
- `.build/test-assets` enthält nach Inhalten adressierte Artefakte. Schlüssel
  berücksichtigen Quelldateien einschließlich Hinzufügen/Entfernen, Helfer,
  Konfiguration, Lockfile, Node und esbuild. Ausgabehashes werden vor jedem
  Treffer geprüft. Ein fehlgeschlagener oder während Quelländerung erzeugter
  Build wird nicht veröffentlicht. Kurze Locks koordinieren nur die jeweilige
  Asset-Vorbereitung; sie sperren keine Rollen oder Testläufe. Verwaiste Locks
  mit nachweislich beendetem Besitzer werden zurückgewonnen; unklare Besitzer
  führen nach 30 Sekunden zum Fehler. Automatische Cachebereinigung gibt es
  nicht; bei beendeten Prüfungen kann `.build/test-assets` entfernt werden.
- Gemeinsame Fixture-Ausgabepfade individueller Builds sind weiterhin nicht für
  mehrere gleichzeitig laufende vollständige Suiten isoliert. Schwere lokale
  Prüfungen deshalb nacheinander ausführen. Änderungen direkt in `node_modules`
  ohne passende Lockfile-/Versionsänderung gehören nicht zum Cachevertrag.
- Die DOM-Hilfe verwendet das vollständige Original-HTML und die echten
  UI-Module. Ein mutationsgebundener ID-Index ersetzt lediglich die lineare
  Suche von linkedom. Er wird auch vor synchronen Abfragen aktualisiert;
  doppelte IDs nutzen weiterhin die ursprüngliche Suche. Die Regressionen
  prüfen Ersetzen, Verschieben, Umbenennen, Entfernen und Fragmente.
- Die verbleibende Schema-Fixture kopiert ein im selben Prozess erzeugtes,
  geschlossenes leeres Datenbankschema. Jede Kopie erhält einen eigenen Dateipfad
  und eigene Verbindungen. WAL, FULL-Sync und die Reopen-Isolationsprüfung bleiben.

Testdateien dem geprüften Ablauf im gemeinsamen Capability-Katalog zuordnen.
Umbenennungen einschließlich alter Links nachführen. Fehlende Zuordnung ist
kein Grund zum Löschen. Eine automatisierte Prüfung belegt keine native
Bedienabnahme oder Owner-Abnahme.

## Gemeinsame native Sitzungen

`tools/native-session.mjs` besitzt das isolierte Profil, den Busproxy, Start,
echten Browserzoom, frische Fensteraufnahmen und reguläres Close/Fresh. Ein
Ergebnis wird erst nach normalen Prozessenden, verschwundenen PIDs, fehlerfreiem
Renderer und unveränderten zwanzig Runtimeartefakten veröffentlicht. Ein neuer
Lauf entfernt vorherige Erfolgsdaten bereits vor dem Fixtureaufbau. Notfall-Cleanup
ist kein normaler Prozessabschluss. Profile liegen unter `~/.cache/saltmarcher/ui/` auf Disk, unabhängig vom
RAM-basierten `/tmp`.

Die Sitzung verwendet standardmäßig dieselbe Plattformwahl wie ein normaler
Electron-Start. `QA_OZONE_PLATFORM=x11`, `wayland` oder `auto` erlaubt einen
gezielten Vergleich; angeforderte Plattform und Desktop-Sitzung stehen im
Prozessbeleg. Der frühere feste X11-Schalter verzerrte auf diesem Wayland-Host
die Einordnung der Atlas-Framezeiten. [Vergleich, Trace und verbleibende
Grenzen](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/atlas-presentation-platform-20261022/README.md).

Vorbereitung/Generierung, narrative Beuteverteilung, Kampfverstärkung und manuelle
Timeline teilen diesen Unterbau. Die Skripte behalten ihre tatsächlichen
Bedienaktionen, Fehlerprovokationen und Fachassertionen. Aufruf weiterhin über
`python tools/ui-session.py node tools/test-desktop-….mjs`; der äußere Wrapper
räumt ausschließlich die eigenen, markierten UI-Prozesse auf. `QA_EVIDENCE_DIR`
trennt Vergleichsläufe; `GM_QA_ZOOM=2` wiederholt manuelle Timeline und Verstärkung
bei 200 Prozent. Die Gegenprobe gegen falsche Prozesserfolge steht in
`tests/shared/desktop-editor-transition.test.mjs`. Native Evidenz und menschliche
Bedienabnahme bleiben getrennt.


### Einheitlicher Prozessbesitz und Sonderprotokolle

`runNativeProbe` veröffentlicht den Erfolgsbeleg erst nach Rückkehr des ganzen
Szenarios. Auch SQLite-Assert nach dem Schließen und die vollständige
Busproxy-Bereinigung gehören damit vor den Erfolg. Der gemeinsame Unterbau
nimmt vor jedem normalen Schließen ein frisches, nicht leeres Fensterbild auf.
Notfallbeendigung wartet auf Prozessende und PID-Verschwinden und bleibt ein
Fehlerpfad. Fehlerbelege werden nach dem Cleanup mit dessen tatsächlichem
Ergebnis aktualisiert, auch bei manuellen Sitzungsaufrufen mit `fail` vor `finally`/`dispose`; Profile bleiben zur Diagnose erhalten. Wiederholtes
oder gleichzeitiges `dispose` wartet auf dasselbe vollständige Cleanup. Ein
vorzeitig beendeter Busproxy und eine erforderliche SIGKILL-Eskalation verhindern
die Qualifikation auch dann, wenn die Fachassertionen bereits bestanden haben.

`tools/native-process.mjs` besitzt begrenztes Warten, beobachtetes ChildProcess-Ende,
exakten Profilbesitz und eskalierendes Cleanup. Electron schreibt unter Linux
seinen Prozesstitel um; auch diese Form wird nur mit vollständigem Profilpfad
zugeordnet. Der Update-Adapter registriert seinen vom Produkt gestarteten
Nachfolger zusätzlich mit PID-Startidentität. `tools/ui-session.py` bleibt die
äußere Absicherung und meldet einen vermeintlich erfolgreichen Lauf mit noch
lebenden eigenen Prozessen als Fehler. Native Sitzungen registrieren ihre genauen
Erfolgsdateien beim Wrapper, einschließlich eigener Ergebnisnamen. Bei Fehler,
Abbruch oder nötiger äußerer Bereinigung entfernt er diese Dateien und schreibt
`wrapper-failure.json`; die temporäre Registrierung endet mit diesem Wrapper.
Fachliche Fehlerbelege und Screenshots bleiben erhalten.

`node tools/native-probes.mjs` liefert die aktuelle Einstiegsübersicht.
`check:repo` verbietet direkte Starter und eigene Kill-/Close-Pfade in normalen
Produktproben. Ausnahmen sind ausdrücklich im selben Modul beschrieben:
Entwicklung nutzt das stdin-Neustartprotokoll; Paketupdates beobachten den vom
Updater gestarteten Nachfolger. Beide verwenden die gemeinsamen Prozessprimitive.
Entwicklung bindet jeden gestarteten Prozess an die Artefakthashes seiner
Generation und ein frisches sichtbares Bild. Der Update-Adapter bindet die
signierten Testpakete, installierten Laufzeiten und beide Prozessenden an den
Beleg. Die Baseline orchestriert nur andere Proben. Sie registriert jedes Wrapperkind,
leitet Abbruch genau einmal weiter und wartet dessen begrenzte Bereinigung ab. `test-desktop-relief-prototype.mjs`
ist ein historischer R0-Prototyp und zählt nicht als aktuelle Produktqualifikation.
Die gemeinsame Artefaktliste umfasst auch nachgeladene Atlas-/Einstellungsbundle
und die getrennte Spieleranzeige. Kopierte vollständige Laufzeiten und Paketläufe benötigen explizite
`launchConfigured`-Adapter; ihre tatsächlich gestarteten Dateien werden gehasht
und bei Neustart sowie Abschluss erneut verglichen.

Jeder angeforderte Start wird vor seinen Vorbedingungen aufgezeichnet. Auch ein
von der Fachprobe abgefangener Start- oder Neustartfehler verhindert einen
Erfolgsbeleg; nur vollständig bereit gewordene Starts können qualifiziert werden.

Gezielte technische Gegenproben stehen in
`tests/shared/native-process.test.mjs`, `tests/shared/native-probes.test.mjs`
und `tools/native-session-check.mjs`. Die letzte läuft wie eine Produktprobe
seriell unter `verify:local` und `ui-session.py`; sie provoziert Fixture-, Start-,
Renderer-, nachgelagerte Assert- und Notfallfehler (einschließlich erzwungenem
SIGKILL bei verweigertem SIGTERM) sowie unerwartetes Ende,
Close-Timeout, fehlgeschlagenen oder abgefangenen Neustart, Orchestratorabbruch,
manuelles Fehlerprotokoll vor dem Cleanup,
verlorenen Proxy und einen gleichzeitig
lebenden fremden Prozess. Die Node-Gegenprobe prüft zusätzlich, dass der äußere
Wrapper auch einen bereits geschriebenen Erfolg nach Prozessleck oder späterem
Abbruch zurücknimmt. Ein grüner Unterbautest ersetzt
keine erfolgreiche Fachprobe. Veraltete Selektoren, fachliche Erwartungsfehler
und nicht abgeschlossene Ausgangsfixtures werden als solche berichtet.


### Abgrenzung der nativen Umstellungsbelege vom 27.10.2026

Alle 80 direkt migrierten Produktproben wurden aufgerufen: 32 bestanden,
46 scheiterten an fachlichen beziehungsweise Fixture-/UI-Erwartungen und zwei
blieben an Ausgangsfixtures blockiert; 77 erreichten einen nativen Startauftrag.
Bei 26 roten Fällen belegt der Vergleich mit dem ursprünglichen Skript keinen
identischen Vorfehler. Diese Fälle sind offen, nicht als regressionsfrei freigegeben.
Die letzte zentrale Fehlerbelegkorrektur wurde mit 29 Unterbautests und 15 echten
nativen Negativfällen geprüft; danach wurden nicht sämtliche 80 Fachproben erneut
aufgerufen. Die positiven Fachbelege gehören daher zu ihren jeweiligen Laufständen.

Der erneuerte kontinuierliche Referenzwelt-Bildlauf bestand bei 100 Prozent.
Bei 200 Prozent blieb der Maßstab 64 rot: 2534 gemessene statt 4461 erwarteter
Kontrastkanten unterschreiten die unverändert verlangten 65 Prozent. Ob Ursache
im Renderer oder in der DPI-abhängigen Vergleichsmethode liegt, ist offen.
Technische Prozessqualifikation und diese Teilbelege sind keine vollständige
Produkt-, Darstellungs- oder menschliche Bedienabnahme.


## Vollständige Atlas-Referenzwelt

`tests/fixtures/atlas/mixed-world.sqlite.gz` verwendet die übrigen fachlichen Inhalte der
Referenzwelt aus Commit `16eb0aa8807ac21704abfea5412ac3a22033a23a` im aktuellen
Schema 55. `mixed-world-manifest.json` daneben bindet die ursprüngliche Datei
per SHA-256 und alle kanonischen Tabellen per Anzahl und Inhaltsprüfsumme.
Die 100.000 alten hexagonalen Gelände-Zellen werden durch unregelmäßige freie
Eigenschaftsflächen ersetzt; alte Zellquellen bleiben nicht Teil des Prüfszenarios.
`originalTables` bindet die Herkunft, `tables` die aktuelle kontinuierliche Testwelt.
Übrige IDs, Payloads, Verknüpfungen und History bleiben erhalten.

Wiederherstellung aus dem lokal vorhandenen Git-Objekt:

```sh
node tools/create-atlas-mixed-fixture.mjs tests/fixtures/atlas/mixed-world.sqlite.gz
```

Das Werkzeug akzeptiert ausschließlich diese bekannte Schema-54-Testdatei,
entfernt deren historische Migrationstabelle, ersetzt das alte Gelände und setzt Schema 55. Es ist kein
Produktimport und erweitert nicht die unterstützten Anwendungsformate. Ein
Checkout ohne das historische Git-Objekt kann die eingecheckte Testwelt prüfen,
aber erst nach Beschaffung dieses Commits neu erzeugen.

Die Welt enthält 100.000 kontinuierliche Geländeflächen, 1.028 Höhenkacheln, 5.000 Ortsmarker,
1.024 Straßen, 1.024 Vegetationsobjekte, 5.000 Raumgruppen und 4.001 Räume im
großen Dungeon. Der kleine parametrische Generator `populateMixedWorld` erzeugt
nur ein Inventar für isolierte Tests; er ersetzt diese vollständige Welt nicht.

`tests/atlas/atlas-reference-fixture.test.mjs` prüft Inhaltstreue über Store-Neuöffnung
und gezielte Verluste. Die nativen Vergleiche in
`tools/test-desktop-atlas-mixed-workbench.mjs` prüfen fünf Maßstäbe bei 100/200 %,
sichtbare Kartenausschnitte, Neustart und Bildexport. Ihre Referenzbilder unter
`tests/fixtures/atlas/reference-images/` gehören zur kontinuierlichen Testwelt. Eine ausdrückliche Neuerzeugung mit
`--refresh-reference` prüft zuerst Inventar, sichtbare Populationen, Neustart und
Export; normale Prüfläufe ändern diese Bildreferenzen nicht.
Ohne Auswahl läuft die Probe bei 200 und 100 Prozent; `GM_QA_ZOOM=1` oder `2`
prüft einen Zoomfaktor, ohne Fachassertionen zu ändern. Der neue technische
Referenzstand ersetzt keine Besitzerabnahme der Darstellung.
Die Bildmetadaten binden Runtime-Hashes, PNG-Prüfsummen und tatsächliche
Kameraausschnitte; jeder Zoomschritt muss vor dem nächsten abgeschlossen sein.
Der 200-%-Vergleich braucht reale 2560 × 1704 Inhaltspixel bei unverändertem
CSS-Viewport. Die Probe setzt dazu die tatsächlichen nativen Mindest- und Höchstmaße
(einschließlich gemessenem Fensterrahmen) und prüft Inhaltsmaße, CSS-Viewport,
Kamera und Zoom erneut nach dem Öffnen. Dadurch kann die Fensterverwaltung das
Vergleichsfenster nicht nachträglich auf die Bildschirmgröße begrenzen.

Die Bildprüfung vergleicht einen festen Kartenausschnitt ohne Bedienoberfläche,
mit begrenzter RGB-Abweichung, Mindestanteilen für Land, Wald, Straße und
Ortsmarker sowie einer zusätzlichen Waldstrukturprüfung. Ladebereitschaft und Objektzahlen allein sind kein Bildnachweis.

## Kleiner nativer Basissatz

Nach `npm run build:desktop` führt `node tools/test-desktop-baseline.mjs` drei
Proben seriell auf dem aktiven Display aus. Node.js 22, Electron, Python 3,
`xdg-dbus-proxy` und ein Sitzungsbus müssen verfügbar sein. `QA_EVIDENCE_DIR`
setzt den Ergebnisordner (Vorgabe `.build/native-baseline`); der Runner startet
jede Probe über `tools/ui-session.py` mit eigenem Profil und Prozessbesitz.

| Probe | Erhaltene fachliche Aussagen |
| --- | --- |
| `tools/test-desktop-room-reads.mjs` | 4.000 Räume, vollständige Suchseiten, gezielte private Textreads, langer Raum-Identifier, Text speichern, ungültigen Rohentwurf nach Auswahlwechsel wiederfinden, frisch öffnen, beschädigte Raumbytes erhalten und anderen Raum öffnen |
| `tools/test-desktop-region-export.mjs` | Land/Orte/Fluss/Straße zeichnen, Eigenschaften und Pfadänderungen rücknehmen/wiederholen, messen ohne Mutation, PNG mit Land/Ufern/Fluss und Beschriftung über Kachelgrenzen, frischer Prozess bei 100/200 % |
| `tools/test-desktop-player-focus.mjs --cue --handout` | Bereichs- und Szenenwechsel, verspätete Freigabe abweisen, nach Neustart leer bleiben, abgewiesenen Write klären, richtige Gruppe ausdrücklich freigeben, GM-Texte und Handout-Dateiname nicht veröffentlichen |

Der Runner entfernt vor dem ersten Start alle alten Erfolgsdateien dieses
Basissatzes. `failure.json` nennt die gescheiterte Probe und bereits beendete
Proben; die Kindprobe nennt den erreichten Schritt, Fehler und verfügbaren
Oberflächenzustand. Erfolgsdateien entstehen erst nach regulärem Close und
verschwundenen PIDs. Auch Fehler im Spielerfenster verhindern den Erfolg.
Profile bleiben zur Diagnose erhalten. Screenshots allein sind kein Pass.

Die Regionprobe scheiterte auf `766a3f8e5` an einem exakten RGB-Vergleich:
3.299.480 Pixel im 2048×1801-Export hatten `(237,228,206)` statt der unbeleuchteten
Landfarbe `(238,229,207)`. Der GPU-Materialpfad beleuchtet die Landfarbe vor der
8-Bit-Ausgabe. Die Probe erlaubt nun höchstens einen Schritt je Farbkanal und
verlangt weiterhin deckende Pixel, mehr als 10 % Land, mehr als 500 Uferpixel
und mehr als 30 Flusspixel. Fläche, Fluss, Beschriftung und Schreibfreiheit
bleiben getrennte Assertions. Das war eine veraltete Pixelannahme, kein Nachweis
fehlenden Landes. Die 250 ms Pinselkontakt sind eine definierte Eingabedauer
für Stärke in Metern/Sekunde, keine Bereitschaftspause.

Der Basissatz ersetzt weder die große Mischwelt noch sämtliche optionalen
Raum-/Stadtprüfungen, Paket-/Installationsprüfung oder menschliche Produktabnahme.

Die dichte Stadtprobe (`tools/test-desktop-room-reads.mjs --regions --zoom=1`
und `--zoom=2`) legt 5.000 Gebäude mit unveränderten Haus-IDs, Positionen und
privaten Texten über den Fachwriter an. Die frühere SQL-Fixture ließ Raumgruppen,
Geschosse und Eingänge aus. Der gültige Bestand deckte einen Produktfehler auf:
Gebäude und Eingangsanker überschritten gemeinsam das Projektionsbudget, obwohl
die Gebäude allein noch hineinpassten. Die Regionsregression erzeugt 751 Häuser
und prüft den Wechsel auf Rastergeometrie samt sichtbaren Daten und genauem Treffer.

Weitere Ursachen des früheren Bildbefunds waren Testannahmen: leeres Gelände liegt
bei −100 m unter Meeresspiegel; Stadtpapier ist keine Atlasgeometrie; 24 feste
Zoomschritte unterschritten die vorhandene Zwei-Pixel-Grenze für Gebäude.
Die Probe erzeugt trockenes Gelände und prüft 2,5 m je CSS-Pixel. Erst nach
bestätigten Rasterdaten und vollständig geladener aktueller Geländekamera nimmt
sie das native Bild auf. Mehr als 100 sichtbare Pixel müssen innerhalb der
bestätigten Dachflächen vom benachbarten unbebauten Gelände abweichen; zusätzlich
werden vier projizierte Hauspositionen geprüft. Dieser Vergleich berücksichtigt
die vorhandene Flächenalpha-Mischung statt eine ungemischte Papier-/Dachfarbe
zu verlangen. Bereitschaftsflags allein erfüllen den Bildnachweis nicht.

Die trockene Fixture deckte außerdem eine fehlende Höhenauflösung freier
Raumgruppen auf: Liegt deren Ursprung außerhalb geladener Geländekacheln, darf
das Geschoss nicht auf Höhe 0 zurückfallen. Höhenreferenzen vom Typ `scope`
werden deshalb über denselben begrenzten Main-Projektionsweg kanonisch aufgelöst;
sie erzeugen weder Körper noch Marker oder Trefferziele. Anzeige und Export
verwenden diese gemeinsame Geschossbasis. `tests/atlas/terrain-objects.test.mjs`
prüft den entfernten Ursprung, Höhenänderung und ausbleibende Scheingeometrie.

Die Quellenwiederaufnahme wartet außerdem auf den bereits lesenden
Geometrieeigentümer: Derselbe überholte Quellenstand darf nicht erneut an
Gelände-/Objektprojektion gehen und deren Fehlerzustand verriegeln.
`tests/atlas/atlas-presentation-source.test.mjs` prüft beide Lesewege und die
Wiederaufnahme mit neuer bestätigter Quelle.

Der parallel gestartete Atlas beim Bereichswechsel behandelt abgewiesene
Leseantworten über den Status des noch aktuellen Arbeitsbereichs. Auch die
reguläre Schließsperre darf dabei keinen unbehandelten Promise-Fehler erzeugen.
Die native Raumlese-Probe behält ihre Fehler- und Prozessabschlussprüfungen.

Die Probe setzt die Maßeinheit vor Koordinateneingaben ausdrücklich auf Meter.
Hausbewegung erfolgt über den Inspektor; Undo und frischer Prozess müssen alle
Gebäude-, Raumgruppen-, Geschoss-, Bindungs-, Geometrie- und privaten Textdaten
erhalten. Der Rasterklick wählt ein anderes Haus als den zuvor geöffneten
Innenraum. Beim Umhängen derselben Canvas in Live bleiben Weltmittelpunkt und
horizontaler Maßstab erhalten; die obere Kante darf sich mit dem Seitenverhältnis
ändern. Vor dem Wechsel wartet die Probe auf die Zielkamera des gewählten
Raums, nicht nur dessen bereits aktualisierten Namen. Vier Innenpunkte der
Live-Raumfläche müssen sich sichtbar vom benachbarten unbebauten Gelände
abheben; ein Raumname allein genügt nicht. Native Ergebnisdateien, vollständige Candidate-CI und Produktabnahme
bleiben getrennte Aussagen.

## Architekturprüfungen und Fachanschlüsse

[Tests an Fachinstanzen, Zyklusgrenzen und getrennte TypeScript-Umgebungen](../architecture/test-boundaries.md) beschreiben die aktuellen Regeln und ihre Grenzen.
`npm run check` führt die vollständige Typprüfung und die drei zusätzlichen
Umgebungsprüfungen aus; `check:repo` prüft die benannten Modulgrenzen einschließlich
neuer zyklischer Kanten. Testzuordnungen bleiben im Capability-Katalog.

Die Main-Zusammensetzungsprobe wartet auf das tatsächliche Lade-/Fehlersignal
mit einer Zeitgrenze, nicht auf eine feste Anzahl Event-Loop-Durchläufe. Der
Gesamtlauf nach `fd62011ae` zeigte lokal einen Startfehler nach nur 100 Durchläufen
(55 ms); weil die Fixture ihr Cleanup erst anschließend registrierte, hielt der
später gestartete Backup-Timer den Prozess offen. Der diagnostische Lauf wurde
nach 525 Sekunden durch gezieltes Beenden dieses Testkindes beendet und zählt
nicht als bestanden. Cleanup wird nun vor dem Start registriert; ein späterer
Start nach Fixturefreigabe ist gesperrt. Zwei Regressionen prüfen verzögerte
Bereitschaft und Aufräumen nach Startfehler. Die fachlichen IPC-/Drain-Assertions
und der tatsächliche Main-Einstieg bleiben erhalten.

Die erfolgreiche Candidate-Suite für `76703e1b4` benötigte 434 Sekunden; sie
belegt das Ziel unter 300 Sekunden nicht. Auch breit unveränderte Tests waren
langsamer als im vorherigen CI-Lauf. Ein einzelner Lauf erlaubt deshalb keine
isolierte Leistungszuschreibung an die Architekturprüfung. Funktionsergebnis,
Testbereitschaft und Laufzeitziel werden getrennt berichtet.

## Aktiver Build und historische Referenz

`npm run build` baut dieselbe Electron-Anwendung wie `npm run build:desktop`
unter `.build/desktop`. Der Candidate führt entsprechend den geltenden
Integrationsregeln weiterhin beide Befehle aus; keiner baut den Obsidian-Adapter.
`node build.mjs --test` bleibt die gemeinsame Testvorbereitung.

Der historische Adapter ist mit `npm run build:legacy:obsidian` ausdrücklich
baubar; Bundle, Sourcemap und historisches Kataloginventar liegen getrennt unter
`.build/legacy-obsidian`. Der optionale Adapter-Testaufruf wurde entfernt. Die Datei [obsidian-build.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/legacy-reference/obsidian-build.test.mjs) ist nur noch über die Git-Historie verfügbar. Allgemeine Katalogidentitäts-, Quellhash- und
Payloadprüfungen bleiben in `tests/catalog/catalog-build-asset.test.mjs` aktiv.
Historische `main.js`-Budgetwerte sind keine Budgets der Desktopanwendung.
Auch diese optionalen schweren Aufrufe lokal über `verify:local` ausführen.

## Kurzer Desktop-Entwicklungszyklus

`npm run dev` installiert bei Bedarf die deklarierte Electron-Runtime, startet den
vorhandenen lokalen Ressourcenrahmen und beobachtet `src/`, `desktop/` und
`resources/`. Der erste Build und spätere Änderungen laufen seriell. Die Anwendung
verwendet `.build/desktop-dev/runtime` und ein dauerhaftes, pro Checkout getrenntes
Profil unter `$XDG_DATA_HOME/saltmarcher/development/<Checkout-Hash>` (ersatzweise
`~/.local/share`). Produktprofile und `.build/desktop` werden dabei nicht verwendet.

CSS wird nach erfolgreichem Build an seiner vorhandenen Kaskadenposition ersetzt;
auch entfernte Regeln verschwinden. DOM, Fokus und offene Eingaben bleiben erhalten.
TypeScript, HTML-Dokumente, Preloads und Worker starten die Anwendung erst nach
einem erfolgreichen vollständigen Änderungsstand neu. Der normale Schließpfad
sichert Entwürfe und wartet auf laufende Speicheraufträge. Ein blockierter
Schließvorgang wartet auf dessen fachliche Klärung; der Starter erzwingt keinen
Prozessabbruch. Ein Neustart setzt die normale Startoberfläche voraus; flüchtige
Navigation und nicht von einem Entwurfsbesitzer gesicherte Eingaben werden nicht
zusätzlich gespeichert.

Buildfehler lassen den letzten erfolgreichen Stand laufen; ein korrigierter oder
neu angelegter Import löst den nächsten Versuch aus. Änderungen werden gebündelt,
und ein während des Builds überholter Stand wird verworfen. Konsolenmeldungen
zeigen geänderte Dateien sowie Build- und Gesamtzeit. Änderungen an Paket-/Lock-,
Datenformat- und Buildkonfiguration verlangen einen Neustart des Entwicklungsbefehls;
der laufende Watcher übernimmt danach keine weiteren Generationen. `Ctrl+C` und
das normale Schließen des Fensters beenden auch den Watcher. Nach einem abgestürzten
Starter bleibt gegebenenfalls `.build/desktop-dev/session.lock`: erst den dort
vermerkten Prozess prüfen und die Datei nur entfernen, wenn dieser beendet ist.

Die gemeinsame Bundleliste in `tools/desktop-build-plan.mjs`, der vorhandene
Dokumentausgabe und die CSS-Bündelung dienen sowohl Produktions- als auch Devbuild.
Dev-Bundles enthalten eingebettete Sourcemaps; Node-Stacks werden auf TypeScript
zurückgeführt. Der Entwicklungsanschluss nutzt ausschließlich geerbte Prozesspipes;
es gibt keinen Entwicklungsserver und keine zusätzliche Renderer-/Preload-API.
Produktionsbuilds enthalten diesen Anschluss und die Sourcemaps nicht.

`tests/shared/development-{queue,child}.test.mjs` prüft Bündelung, Fehlererholung,
Serialisierung und bestätigtes Schließen. Die native Probe
`tools/test-desktop-development.mjs` arbeitet mit kopierten Quellen und einem
eigenen Profil: CSS/Fokus, ungültiger NPC-Entwurf beim Neustart, Syntaxfehler und
Korrektur, HTML, neue/gelöschte Imports, Preload, Worker und Sourcemaps. Sie wird
wie andere native Prüfungen im Ressourcenrahmen und unter `tools/ui-session.py`
gestartet. Ergebnisse und gemessene Zeiten liegen unter
`.build/development-evidence/`; sie sind technische Nachweise, keine Fachabnahme.
