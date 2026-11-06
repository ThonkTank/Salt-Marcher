# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

LOD03/P1 vereinheitlicht normale Straßensichtbarkeit und Übersichtstreffer.
Verborgene normale Straßen geben Auswahl/Pan und freien Doppelklick frei;
ein vorhandener ausgewählter exakter Header ersetzt ausschließlich seinen
vereinfachten Kacheltreffer. Aktuelle Daten bleiben Voraussetzung für Writes.
Painterbedingungen, Rankingproxy, Labels, Skalen, Budgets, Loader/Workflow,
Rust, generierte Typen und Persistenz bleiben erhalten.

Geprüft: Typprüfung und 99 gezielte Frontendtests bestanden. Der gezielte
Browserlauf mit neun Dateien bestand alle 40 Fälle mit Exit 0. Die neue reale
Straßenzugcoverage belegt 5/2-Unsichtbarkeit gegenüber einer Landreferenz,
sichtbare 5/12, Klick/Pan/verankerten Zoom, zurückgehaltene Header, ausgewählte
kurze exakte Straße mit genau einem Insert/Undo sowie eine gefüllte Karte mit
Pixeln und aktuellen Labels. Werkzeuge und exakte Policyhysterese bleiben
bei erhaltenem Straßenzugnamen bedienbar. Die zuletzt ergänzten tatsächlichen
Wasserkonturen und gesperrten Haus-/Landschaftsdrags bestanden zusätzlich.
Das ist keine vollständige Phase-2-Werkzeug-, große oder native Abnahme.
Belege und Entwicklungsfehler: `src-tauri/target/cleanup/lod-review/lod03/P1/E2/`.
Die unabhängige LOD03-Prüfung fand keinen konkreten Produktbefund; sie bestätigte
99 Frontendtests und die drei neuen Browserfälle erneut mit Exit 0 und prüfte
die gefüllte Karte auch visuell. Eine G-Korrektur war nicht erforderlich.
Nächster Schritt ist die reguläre Checkpointveröffentlichung; kein Mainmerge
aus diesen Teilprüfungen. Beleg: `src-tauri/target/cleanup/lod-review/lod03/F/`.

Cleanup01 bleibt erhalten: räumlich vorbereitete Hausplattformen bei lokaler
Reihenfolge, keine ungenutzte Level-0-Höhenübersicht, Featureprojektion je
Anfrage/Level, parentweiser Höhen-/Groundimport und stabile Schichtreferenzen.
Frühere unabhängige Prüfungen fanden darin keine konkrete semantische Regression.
Arbeitszähler belegen weniger Arbeit, keine große Release-/native Zeitverbesserung;
zusätzlicher Featurecache und SQLite-Sortierspeicher bleiben Tradeoffs.
Groundrollback belegt keine Fehlerstelle nach mehreren neuen Inserts.
Der frühere G-Durchgang korrigierte Clippy-Teststellen und die aktuelle
Basisframe-Textprobe; fünf Darstellungsproben bestanden, ohne frühere
wechselhafte Labelausfälle rückwirkend zu erklären.

Der letzte Gesamtcheck blieb rot: Contracts, Typprüfung, 317 Frontendtests,
Rust-Suites, Clippy, Format und Webbuild bestanden; Browser 215 bestanden,
zwei große Fälle übersprungen, zwei Fehler. Bei gedrehtem teilweise belegtem
Obergeschoss (`editor.spec.ts:593`) und zurückgehaltenen Etagenreads
(`interaction-lifecycle.spec.ts:183`) blieb das Basisbild nach Abschalten der
unteren Darstellung identisch. Ursache/Zuordnung bleiben ungeklärt,
Folgeassertionen unerreicht; `check:all` Exit 1. Keine zweite Cleanup01-G-Runde
und keine neue Gesamtprüfung in LOD03/P1.

Die drei früheren Erstgestenfälle bestanden zuletzt, ihre Ursachen erhielten
keinen kausalen Fix. Kartografische Ergänzungsbestätigungen für Raum, Haus und
Grundstück bleiben offen; Innenräume bleiben ausdrücklich geöffnet.
V0a/V0b bleiben ohne vollständigen großen Releasevergleich unvollständig.
Der echte CI-Lauf des vorherigen Checkpoints `6b2031c6` endete inzwischen
mit failure; für den neuen Stand liegt noch kein Required-Check-Erfolg vor.
Aktuelle native Bedienungs-/RPM-Abnahme, echte CI-/Mainfreigabe und die begonnene
Phase-4-Zeichenplanung bleiben offen. Aus lokalen Teilprüfungen folgt keine
Remote- oder Mainfreigabe.
