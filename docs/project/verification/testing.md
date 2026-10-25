# Automatisierte Tests

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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

`npm test -- tests/runtime/desktop-combat-switch.test.mjs` bereitet die gemeinsamen
Testartefakte einmal neu vor und führt anschließend die ausgewählten Dateien aus.
Mehrere explizite Dateipfade sind erlaubt; doppelte Pfade werden nur einmal geprüft.
Fehlende Dateien, Verzeichnisse, unbekannte Optionen und leere Pfade werden vor dem
Build abgewiesen. Auch die benannten Node-Testskripte `test:desktop-*` verwenden
diese Vorbereitung. Native UI-Skripte bleiben separate Prüfwege.

`npm test -- --list` zeigt die vollständige aktive Auswahl ohne Build oder Tests;
Dateipfade und `--serial` lassen sich damit kombinieren. `tests/shared/core.test.ts`
wählt das gesamte vorbereitete Core-Bundle. Die Standardsuite entdeckt aktive
Node-Tests im Testwurzelverzeichnis und den Fachordnern `workspace`, `atlas`,
`campaign`, `runtime`, `catalog` und `shared`; ADR-Tests bleiben ausdrücklich
aufgelistet. Fixtures und native Referenztests werden nicht automatisch entdeckt.
Für direkte `node --test`-Aufrufe bleibt `node build.mjs --test` erforderlich.

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
  bleiben aktiv. Initialisierungs-, Formatgrenzen- und Reopen-Tests verwenden
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


## Vollständige Atlas-Referenzwelt

`tests/fixtures/atlas/mixed-world.sqlite.gz` bewahrt die fachlichen Inhalte der
Referenzwelt aus Commit `16eb0aa8807ac21704abfea5412ac3a22033a23a` im aktuellen
Schema 55. `mixed-world-manifest.json` daneben bindet die ursprüngliche Datei
per SHA-256 und alle kanonischen Tabellen per Anzahl und Inhaltsprüfsumme.
IDs, Payloads, Verknüpfungen und History gehören zur Referenz.

Wiederherstellung aus dem lokal vorhandenen Git-Objekt:

```sh
node tools/create-atlas-mixed-fixture.mjs tests/fixtures/atlas/mixed-world.sqlite.gz
```

Das Werkzeug akzeptiert ausschließlich diese bekannte Schema-54-Testdatei,
entfernt deren historische Migrationstabelle und setzt Schema 55. Es ist kein
Produktimport und erweitert nicht die unterstützten Anwendungsformate. Ein
Checkout ohne das historische Git-Objekt kann die eingecheckte Testwelt prüfen,
aber erst nach Beschaffung dieses Commits neu erzeugen.

Die Welt enthält 100.000 Geländequellen, 1.028 Höhenkacheln, 5.000 Ortsmarker,
1.024 Straßen, 1.024 Vegetationsobjekte, 5.000 Raumgruppen und 4.001 Räume im
großen Dungeon. Der kleine parametrische Generator `populateMixedWorld` erzeugt
nur ein Inventar für isolierte Tests; er ersetzt diese vollständige Welt nicht.

`tests/atlas/atlas-reference-fixture.test.mjs` prüft Inhaltstreue über Store-Neuöffnung
und gezielte Verluste. Die nativen Vergleiche in
`tools/test-desktop-atlas-mixed-workbench.mjs` prüfen fünf Maßstäbe bei 100/200 %,
sichtbare Kartenausschnitte, Neustart und Bildexport. Ihre Referenzbilder unter
`tests/fixtures/atlas/reference-images/` stammen vom Baseline-Lauf des genannten
Commits vor der Bereinigung; sie werden nicht aus dem Prüfling aktualisiert.
Die Bildmetadaten binden Runtime-Hashes, PNG-Prüfsummen und tatsächliche
Kameraausschnitte; jeder Zoomschritt muss vor dem nächsten abgeschlossen sein.
Die Bildprüfung vergleicht einen festen Kartenausschnitt ohne Bedienoberfläche,
mit begrenzter RGB-Abweichung und Mindestanteilen für Land, Wald, Straße und
Ortsmarker. Ladebereitschaft und Objektzahlen allein sind kein Bildnachweis.

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

Offener Befund aus Abschnitt 1: `tools/test-desktop-room-reads.mjs --regions`
erreicht nach der Navigationskorrektur Suchtreffer, gezieltes Haus-Edit samt
Detailread-Fehlerklärung sowie Verschieben und Undo. Beim Herauszoomen auf die
dichte Stadt scheitert weiterhin `Actual native screen paints the dense geometry
image`: Im nativen Screenshot bleibt die Stadtfläche leer. Das Fixture enthält
5.000 direkt eingesetzte Stadtobjekte; die nähere Ansicht zeigt deren Dächer.
Ob zusätzlich fehlende Raumgruppen im älteren Fixture beitragen, ist noch nicht
abschließend geklärt. Dieser Bild-/Fixturebefund bleibt offen, die Assertion
wurde nicht gelockert und der optionale Lauf wird nicht als bestanden gewertet.
