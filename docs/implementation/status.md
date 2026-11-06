# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

LOD05/P1 präzisiert den kartographischen Zweck von „Dorf / Stadtteil“, die
vereinfachte Ortsübersicht und ihre Werkzeuggrenzen. Die LOD04-Präzisierung
bleibt erhalten. Geändert wurden nur Produktvertrag und Status; Laufzeitcode
und Tests bleiben unverändert. Neu geprüft wurden ausschließlich Quellen- und
Dateiumfangsabgleich, Markdownformat beider Dokumente und `git diff --check`.
Der Quellenabgleich belegt Dokumentkonsistenz, keine Bildqualität. Gefüllte
kartographische und Phase-2-Abnahme sowie große und native Abnahme bleiben
offen; eine Beschleunigung ist nicht nachgewiesen. Die unabhängige Prüfung
bestätigte Quellenabgleich, Umfang und Dokumentchecks ohne korrekturbedürftigen
Befund; G war nicht erforderlich. Der Stand ist für die reguläre
Checkpointveröffentlichung vorbereitet, nicht für eine vorweggenommene
Mainfreigabe. Belege: `src-tauri/target/cleanup/lod-review/lod05/P1/E2/`
und `src-tauri/target/cleanup/lod-review/lod05/F/`.

LOD03/P1 vereinheitlicht normale Straßensichtbarkeit und Übersichtstreffer;
verborgene normale Straßen geben Auswahl/Pan und freien Doppelklick frei.
Ein ausgewählter exakter Header ersetzt nur seinen vereinfachten Kacheltreffer;
Writes benötigen aktuelle Daten. Checkpoint `a99335094` wurde veröffentlicht.
Der letzte hier vorliegende Remote-Snapshot aus LOD03/H vom 6. November,
21:22 UTC, zeigte dessen CI noch laufend; dies beschreibt keinen aktuellen
CI-/Mainzustand. Die CI des vorherigen Checkpoints `6b2031c6` endete mit failure.
Eine aktuelle Required-Check-/Mainfreigabe ist nicht belegt. Beleg:
`src-tauri/target/cleanup/lod-review/lod03/H/`.

Ältere LOD03-Teilprüfungen: Typprüfung, 99 gezielte Frontendtests und 40
Browserfälle bestanden, einschließlich Straßensichtbarkeit, Klick/Pan/Zoom,
zurückgehaltener Header, kurzer exakter Auswahlstraße mit Insert/Undo sowie
gefüllter Karte mit Labels, Wasserkonturen und gesperrten Haus-/Landschaftsdrags.
Die unabhängige Prüfung bestätigte 99 Frontendtests und drei finale Browserfälle
erneut und prüfte die gefüllte Karte visuell; kein konkreter Produktbefund,
keine G-Korrektur erforderlich. Keine vollständige Phase-2-, große oder native
Abnahme. Belege: `src-tauri/target/cleanup/lod-review/lod03/P1/E2/` und
`src-tauri/target/cleanup/lod-review/lod03/F/`.

Cleanup01 bleibt erhalten: lokal vorbereitete Hausplattformen, entfallene
ungenutzte Level-0-Höhenübersicht, Featureprojektion je Anfrage/Level,
parentweiser Höhen-/Groundimport und stabile Schichtreferenzen. Frühere
unabhängige Prüfungen fanden keine konkrete semantische Regression.
Arbeitszähler belegen weniger Arbeit, keine große Release-/native
Zeitverbesserung; Featurecache und SQLite-Sortierspeicher bleiben Tradeoffs.
Groundrollback belegt keine Fehlerstelle nach mehreren neuen Inserts.
Der frühere G-Durchgang korrigierte Clippy-Teststellen und die Basisframe-Textprobe;
fünf Darstellungsproben bestanden, ohne wechselhafte Labelausfälle kausal zu erklären.

Der letzte Gesamtcheck blieb rot: Contracts, Typprüfung, 317 Frontendtests,
Rust-Suites, Clippy, Format und Webbuild bestanden; Browser 215 bestanden,
zwei große Fälle übersprungen, zwei Fehler. Bei gedrehtem teilweise belegtem
Obergeschoss (`editor.spec.ts:593`) und zurückgehaltenen Etagenreads
(`interaction-lifecycle.spec.ts:183`) blieb das Basisbild nach Abschalten der
unteren Darstellung identisch. Ursache/Zuordnung bleiben ungeklärt,
Folgeassertionen unerreicht; `check:all` Exit 1. Keine zweite Cleanup01-G-Runde
und keine neue Gesamtprüfung in LOD03/P1, LOD04/P1 oder LOD05/P1.

Die drei früheren Erstgestenfälle bestanden zuletzt ohne kausalen Fix ihrer
Ursachen. Kartographische Ergänzungsbestätigungen für Raum, Haus und Grundstück
sowie die Ortsbilder LOD04 und LOD05 und Phase 2 bleiben offen; Innenräume werden
ausdrücklich geöffnet. V0a/V0b bleiben ohne vollständigen großen Releasevergleich unvollständig.
Aktuelle native Bedienungs-/RPM-Abnahme, echte CI-/Mainfreigabe und die begonnene
Phase-4-Zeichenplanung bleiben offen. Lokale Teilprüfungen begründen keine
Remote- oder Mainfreigabe.
