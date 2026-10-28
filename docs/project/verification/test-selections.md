# Gezielte Testdateien auswählen

Status: Current; Auswahlprüfung und Verhaltensnachweis sind getrennt.
Owner: project
Last Reviewed: 2026-10-28
Source of Truth: Ausführbare Aufrufe für den bestehenden `tools/run-tests.mjs`; tatsächliche Ablaufzuordnungen besitzt der gemeinsame Capability-Katalog.

Alle Aufrufe beginnen im Repositorywurzelverzeichnis mit Node 22. `--list`
prüft die Pfade und zeigt die Auswahl ohne Build oder Testlauf. Für die
Ausführung dasselbe Kommando ohne `--list` verwenden. `--serial` hält diese
gezielten Läufe bei einem Testprozess; die vorhandene lokale Speichergrenze
gilt weiterhin. Schwere Läufe, Builds und native Proben nacheinander starten.

Diese Aufrufe sind kleine Arbeitsauswahlen für Änderungen an den benannten
Anschlüssen. Ihre Assertions und Grenzen stehen in den Testdateien. Die
Auswahl ersetzt weder `npm test` mit sämtlichen aktiven Dateien noch die
Candidate-CI. Importbeziehungen oder die erfolgreiche Pfadprüfung beweisen
keine vollständige Verhaltensabdeckung. Native Bedienproben bleiben separat
und laufen ausschließlich bei 100 Prozent Appzoom.

## Kampagnenaktivierung und Ansichtswechsel

Produktive Aktivierung und Öffnung, Editorreihenfolge und Sicherung vor dem
Verlassen einer Arbeitsfläche:

```sh
npm test -- --serial --list \
  tests/workspace/desktop-editor-activation.test.mjs \
  tests/workspace/workspace-editor-registry.test.mjs \
  tests/atlas/desktop-atlas-opening.test.mjs \
  tests/shared/editor-session.test.mjs \
  tests/shared/desktop-editor-transition.test.mjs
```

## Preparation-, Live- und Welteditoren

Produktive Editorinstanzen, Eingaben während des Speicherns, späte Antworten
nach Kontextwechseln sowie Klärung verlorener Antworten:

```sh
npm test -- --serial --list \
  tests/campaign/desktop-preparation-owner.test.mjs \
  tests/runtime/desktop-live-owner-lifecycle.test.mjs \
  tests/runtime/desktop-world-owner-lifecycle.test.mjs
```

## Autorenverweise und Quellprüfung

SQLite-Alias-/Graphsuche, unveränderte Autorentexte bei Kopie/Fresh und
Unvollständigkeit beziehungsweise Änderungen der gelesenen Quellen. Der echte
Picker prüft zusätzlich die vor dem Einfügen verifizierte Quelle und den Alias:

```sh
npm test -- --serial --list \
  tests/campaign/desktop-text-reference-store.test.mjs \
  tests/campaign/desktop-text-reference-completeness.test.mjs \
  tests/campaign/desktop-text-reference-picker-owner.test.mjs \
  tests/catalog/desktop-text-reference-readers.test.mjs
```

## Runner und gemeinsamer Buildcache

Dateiauswahl, Fehler vor Vorbereitung, Cacheinvalidierung und konkurrierende
Veröffentlichung. Die Konkurrenztests erzeugen ihre eigenen isolierten
Cache-Fixtures; sie verlangen keine konkurrierenden vollständigen Testläufe:

```sh
npm test -- --serial --list \
  tests/shared/test-selection.test.mjs \
  tests/shared/test-assets.test.mjs \
  tests/shared/test-assets-concurrency.test.mjs \
  tests/shared/test-worker-build-asset.test.mjs \
  tests/shared/test-fixtures.test.mjs
```

## Regionsworker und unveränderte Fachfixtures

Echte Store-/Worker-Prozesse, lokale Edit-/Undogrenzen und dichte Geometrie.
Diese Auswahl prüft die Verbraucher der gemeinsam vorbereiteten Workerdatei:

```sh
npm test -- --serial --list \
  tests/atlas/terrain-projection-service.test.mjs \
  tests/atlas/terrain-color-service.test.mjs \
  tests/atlas/atlas-material-service.test.mjs \
  tests/atlas/atlas-geometry-overview-service.test.mjs \
  tests/atlas/terrain-scale-worker.test.mjs \
  tests/atlas/atlas-first-product-worker.test.mjs
```

## Auswahl kontrollieren

Die fünf Aufrufe wurden am 28.10.2026 mit dem tatsächlichen Runner und Node
22.19.0 geprüft: genau 5, 3, 4, 5 und 6 Dateien, ohne Wiederholung und jeweils
Teil der vollständigen aktiven Auswahl. Auch `npm test -- --list` wurde
verglichen. Dies bestätigt die Auswahl, keinen Test- oder nativen Erfolg.
`tests/shared/test-selection.test.mjs` prüft zusätzlich abgewiesene fehlende,
fremde und ungültige Pfade sowie einen CLI-Start ohne Buildvorbereitung.

Bei Umbenennungen die Aufrufe und die bestehenden Capabilitylinks gemeinsam
nachführen. Für die inverse Ansicht den vorhandenen Befehl verwenden:

```sh
codex-dungeon-capability --testuebersicht --repo .
```

Eine dort fehlende Zuordnung bleibt zur Inhaltsprüfung offen; sie begründet
keine Löschung. Prüfergebnisse mit den tatsächlichen Quelldateipfaden im
gemeinsamen Katalog und `--geprueft` festhalten. Die Aufrufe oben führen keine
zweite Abdeckungsliste und behaupten keine vollständige Abnahme.
