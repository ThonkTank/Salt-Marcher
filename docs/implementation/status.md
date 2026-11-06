# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

Cleanup01 bereitet Hausplattformen räumlich vor, bewahrt ihre lokale Reihenfolge
und vermeidet ungenutzte Höhenübersichten bei Level 0. Kartenfeatures werden je
Anfrage und Level einmal projiziert; der zusätzliche Cache hält vollständige
Features neben den Antwortkopien. Höhen- und Groundimporte schreiben validierte
Autoren direkt und bauen ihre Pyramiden parentweise in der Kandidatentransaktion
auf. Regions-/Flussprojektionen behalten unveränderte Referenzen; vorbereitete
Cityfeatures werden beim Zeichnen wiederverwendet. Lade-/Fehlerzustände und echte
Darstellungsänderungen werden weiterhin publiziert.

Die unabhängige Prüfung fand keine konkrete semantische Regression in diesen
Produktänderungen. Feste Geometrie-/Auswahlprüfungen, kanonische bitgenaue
Höhenreferenz, bytegenauer Groundvergleich, Reopens und Fehleratomarität stützen
die Erhaltung. Die sortiert erzeugte Höhenreferenz ist fachlich zulässig; ein
zusätzlicher SELECT ist dafür nicht erforderlich. Der Groundrollbacktest belegt
die Rücknahme gelöschter Eltern, keinen Fehler nach mehreren neuen Inserts.
Arbeitszähler belegen weniger Geometrieaufrufe und Aggregatwrites, keine große
Release- oder native Zeitverbesserung. Zusätzlicher Featurecache und
SQLite-Sortierspeicher bleiben reale Speichertradeoffs.

Der einzige G-Durchgang korrigierte zwei Clippy-Teststellen und begrenzte die
Canvas-Textprobe auf den zuletzt gezeichneten Basisframe. Der Ghostroadtest prüft
zusätzlich die tatsächliche Überdeckung des Regionsankers. Produktcode und
Freigaberegeln wurden dabei nicht geändert. Alle fünf Darstellungsproben bestanden,
einschließlich Labelverdrängung, Hover, Sessionhysterese und echter Invalidierungen.
Das erklärt die früheren wechselhaften Labeltestfehler nicht rückwirkend.

Der anschließende einmalige Gesamtcheck bestand Contracts, Typprüfung, 317
Frontendtests, die Rust-Suites, Clippy, Formatprüfung und Webbuild. Browser:
215 bestanden, zwei reguläre große Performancefälle übersprungen, zwei Fehler.
Bei gedrehtem teilweise belegtem Obergeschoss (`editor.spec.ts:593`) und
zurückgehaltenen Etagenreads (`interaction-lifecycle.spec.ts:183`) blieb das
verglichene Basisbild nach Abschalten der unteren Darstellung identisch. Ursache
und etwaige Zuordnung zu diesem Cleanup sind ungeklärt; Folgeassertionen wurden
nicht erreicht. `check:all` endete mit Exit 1. Keine zweite G-Runde.

Raum, Haus und Grundstück bleiben äußere Nahansichten mit ausdrücklich geöffneten
Innenräumen. Die drei unveränderten Erstgestenfälle bestanden im Gesamtcheck;
P1 erhielt jedoch keinen kausalen Fix, frühere Ausfälle bleiben ungeklärt. Die
kartografische Coveragebeurteilung zu Zweck sowie sichtbaren, verborgenen und
vereinfachten Inhalten je LOD steht nach Cleanup noch aus.

V0a/V0b bleiben unvollständig, ohne vollständigen großen Releasevergleich.
Aktuelle native Bedienungs-/RPM-Abnahme, echte CI-Freigabe und die begonnene
Phase-4-Zeichenplanung bleiben offen. Belege liegen unter
`src-tauri/target/cleanup/lod-review/cleanup01/F/` und `G/`. Nächster Schritt ist
H zur ehrlichen Erhaltung/Veröffentlichung unter bestehenden Required-Checks;
keine Mainfreigabe aus diesem roten lokalen Gesamtcheck ableiten.
