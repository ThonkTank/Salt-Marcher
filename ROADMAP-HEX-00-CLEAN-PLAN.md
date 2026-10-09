# HEX-00: begrenztes Aufräumen nach dem Referenzreview

R02 hat auf seiner Basis `7f43d7e` mit Produktbuild `346f607b` den frühen Referenzumfang und den Dungeon-Kern freigegeben. Der spätere integrierte Build `19d89351` besteht die Basisprüfungen; sein eigener Kernhost ist eine getrennte Integrationsprüfung. Die vollständige Wonderdraft-Parität bleibt offen. Grundlage sind [Nachbesserungsplan](ROADMAP-HEX-00-REPAIR-PLAN.md) und `acceptance.wonderdraftParity.coverageReview.cleanupFindings`.

## CLEAN-P01: konkreter Plan

Start und Abschluss der Planprüfung: `2026-10-09T16:53:25.745490+02:00`. Basis: `3c9444300e33f8f3df069864df2913006444f0ae`. Plan-/JSON-/Verweis-/Diffprüfung bestanden; keine Umsetzung oder Fachfreigabe aus dieser Planprüfung.

Einziger Pflichtbefund ist **HEX00-R01-C01**: `tools/wonderdraft/rfb.mjs` prüft Bildnamen, Koordinaten, Tasten und Text teilweise erst nach Verbindungsaufbau beziehungsweise Eingaben. Ein ungültiger späterer Parameter kann dadurch frühere gültige Eingaben bereits ausführen.

Die Umsetzung extrahiert einen wiederverwendbaren, lesenden Preflight. Er validiert sämtliche angegebenen Eingaben und den freien PNG-/JSON-Zielnamen, bevor Prozessprüfung und TCP-Verbindung beginnen. Der Ausführungshelfer verwendet danach ausschließlich die vorab geparsten Punkte, Tasten und Zeiten. Zusätzliche oder fehlende Komponenten in Zug-/Radparametern werden abgewiesen. Bereits erfasste Bilder, Metadaten, Karten und Originalprofile werden nicht geändert.

Begrenzt betroffene Dateien: `tools/wonderdraft/rfb.mjs`, neuer `rfb-preflight.mjs`, gezielte selbständige Tests, deren Einbindung in `package.json` sowie der Bedienhinweis im vorhandenen README. Keine Karten- oder Produktlogik, kein Umbau der Referenzinstrumente.

## CLEAN-I01: Umsetzung und gezielte Prüfung

- Pure Prüfungen für Grenzen, gültige Kombinationen, Drag-Escape, Unicode-Text und bestehende Zielnamen.
- CLI-Prüfungen mit einem eigenen lokalen Testlistener: Ungültige Bildnamen, bestehende PNG-/JSON-Dateien, ungültige spätere Punkte/Tasten/Texte müssen vor **jeder** Verbindung scheitern. Eine gültige frühe Eingabe zusammen mit einem ungültigen späteren Parameter prüft den konkreten Fehlerfall.
- Gültiger Test-Transport bestätigt Zeiger-/Tasteneingaben und Bild-/Metadatenablage. Diese künstlichen Bytes sind ausschließlich Helfertests und keine Originalabnahme.
- Danach Typprüfung, Testlauf und Build. Frühere Originalkarten/-frames bleiben mit ihren Hashes erhalten; keine negative Eingabeprobe an einer lebenden Originalkarte.

## CLEAN-R01: eigener Review und Abschluss

In einem getrennten Lauf prüfen: alle Eingabewege vor Verbindung, kein Verbindungsaufbau bei ungültigen Parametern, gültige Abläufe erhalten, Befund C01 nachvollziehbar aufgelöst. Strict-Inventarprüfung und Schutzhashes erneut prüfen; eigene Prozessbelege und zuletzt integrierter Kernhost bleiben getrennt dokumentiert. Bei Pflichtlücke folgen gezielte Nachbesserung und eigener Review.

Plan, Umsetzung und Review erhalten jeweils Start, Basiscommit und Ergebnis im eigenen `checkpoint.hexAtlasExecution`; jedes abgeschlossene Paket wird separat veröffentlicht. Nach bestandenem CLEAN-R01 beginnt unmittelbar **HEX-01**, danach **HEX-02 bis HEX-05**. Es folgt keine weitere allgemeine Wonderdraft-Inventur.

CLEAN-I01 abgeschlossen: `2026-10-09T16:59:47.900471+02:00`, Basis `1c1c0704d2737c22048dd3e234f8fd88d14aa62f`. Vollständiger lesender Preflight vor Transport,16 fehlerhafte CLI-Aufträge ohne Verbindung und gültiger künstlicher Transport bestanden. Typprüfung/241 lokale Tests/Build bestanden; kein negativer Liveversuch und keine Originalkarte geändert. Eigener CLEAN-R01 folgt. Nachweis: `/home/aaron/.cache/dungeon-native-qa/hex-00/r02-review-20261009-155338/cleanup-implementation.json`.

CLEAN-R01 abgeschlossen: `2026-10-09T17:03:50.235576+02:00`, Basis `c00bd417c6cb8c65d303fc7765e7b3b393405eab`. Ohne Restbefund: alle Eingabewege vor Transport,16 CLI-Fehlerfälle ohne Verbindung, gültiger Testtransport,525 Schutzhashes und unveränderte eigene R02-Karte bestätigt. Saubere tatsächliche Git-Basis c00bd41:245 Tests/Check/Build; Strict-Inventartor ohne frühe Blocker. C01 aufgelöst; HEX01 startet. Tiefe79 Pflichten und113 Altquellen bleiben sichtbar. Eigener Kernhost für später integrierten Produktbuildcc92 läuft getrennt. Beleg: `/home/aaron/.cache/dungeon-native-qa/hex-00/r02-review-20261009-155338/cleanup-review.json`.
