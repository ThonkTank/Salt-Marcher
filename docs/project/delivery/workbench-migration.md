# SaltMarcher übernimmt die Kampagnenwerkstatt

Status: aktuelle Codebasis; Main-Integration durch den Übernahme-PR dokumentiert
Owner: SaltMarcher
Last Reviewed: 2026-10-16
Source of Truth: Nutzerauftrag vom 16. Oktober 2026, archivierter Dungeon-Stand 29c37326670a2d71b5996c3a3da458ba53ae14b0 und vorheriger SaltMarcher-Main 9de85c1a26f526acbc1af332ac5962e185c0aab2

## Codebasis und Historie

Das eigenständige Electron-/TypeScript-/SQLite-Dungeon-Tool, bisher
Kampagnenwerkstatt, wird unter dem Namen **SaltMarcher** im Repository
`ThonkTank/Salt-Marcher` weiterentwickelt. Gemeinsamer Integrationszweig ist
`main`. Die bisherige SaltMarcher-Implementierung wird dadurch abgelöst.

Übernommener veröffentlichter Dungeon-Stand:
`29c37326670a2d71b5996c3a3da458ba53ae14b0`.
GitHub verlangt eine lineare Main-Historie. Der Quellbaum wird daher als
linearer Import auf dem bisherigen SaltMarcher-Main übernommen. Die frühere
SaltMarcher-Historie bleibt dort und unter
`archive/saltmarcher-before-workbench-20261016` zugänglich. Der vollständige
Dungeon-Verlauf bleibt unter `archive/dungeon-tool-20261016` erhalten.
Originalanforderungen, Lizenzen und unveränderliche Quellenbindungen bleiben
erhalten. Links auf frühere Issues und Belege bezeichnen weiterhin deren
ursprüngliche Quellen; sie sind keine neuen Veröffentlichungsziele.

## Daten und Kompatibilität

Der sichtbare Appname und Linux-Paketname lauten SaltMarcher. Der lokale
Datenordner bleibt `CampaignWorkbench`, einschließlich `workbench.sqlite`.
Bestehende Kampagnenwerkstatt-Daten und Archive benötigen durch die Umbenennung
keine Datenmigration. `.kwcampaign`, `.kwmusic` sowie die bisherigen Format-
und Schemaidentifikatoren bleiben unverändert.

Datenbanken und Nutzerinhalte der früheren SaltMarcher-App werden weder
überschrieben noch automatisch importiert. Ihre Migration ist eine eigene,
noch nicht als abgeschlossen bestätigte Fähigkeit. Die Übernahme behauptet
keine vollständige Funktionsparität oder Produktabnahme. Maßgeblich bleiben
[Produktziele](../requirements/product.md), [Umfang](../requirements/scope.md) und `acceptance.json`.

## Zusammenarbeit und Lieferung

Neue Arbeiten, PRs und Integration gehen an `ThonkTank/Salt-Marcher`, `main`.
Offene Rollen- und Testkopien des alten Dungeon-Repositories bleiben erhalten;
ihre Eigentümer übertragen ausschließlich ihre eigenen fertigen Änderungen
auf einen Zweig des neuen Repositories. Keine pauschale Übernahme verschmutzter
Arbeitskopien. Die lokalen Projektpfade und Rollenverzeichnisse stehen weiter
im installierten `PROJECT.json`, außerhalb des Repositories.

Der npm-basierte Build und die Exact-SHA-Baseline-CI der übernommenen Anwendung
ersetzen den früheren pnpm-/AppImage-Handoff dieser abgelösten Implementierung.
Ein Linux-Ordnerpaket und ein erfolgreicher Start belegen keine Windows-/macOS-
Qualifikation oder Migration alter Nutzerdaten.

## Verifikation der Übernahme

Repositoryprüfung, beide Typprüfungen, Adapter- und Desktopbuild sowie das
Linux-Paket bestanden lokal. Das Paket und die installierte Kopie wurden mit
einer synthetischen Kampagne jeweils zweimal gestartet, regulär geschlossen
und erneut geöffnet. Nutzerdaten wurden dabei nicht geöffnet.

Sechs fehlgeschlagene Fälle der anfänglichen Gesamtsuite wurden auch am
unveränderten Quellstand reproduziert. Ihre Testaufbauten wurden an die aktuelle
Implementierung angeschlossen: vorhandene Sichtbarkeitszeile, gemeinsamer
Atlas-Schreibvertrag, gezielte Chronikabfragen mit Cursor und bestehender Atlas.
Die Erwartungen an Datenschutz, Personen, Orte und Wiederaufnahme bleiben
bestehen; alle sechs gezielten Prüfungen bestanden danach.

Der erste vollständige Kandidatenlauf erfasste weitere 113 Fehler. Die
überwiegend älteren Testaufbauten wurden auf den bereits angelegten kanonischen
Atlas, dessen Hexgröße und aktuelle Schreib-/Leseverträge umgestellt. Veraltete
Testpakete werden gemäß dem bestehenden Produktvertrag abgewiesen, ihre Bytes
bleiben erhalten. Auch der Öffnungsweg ist korrigiert: Eine fehlende Tabelle
für Verfolgungsentwürfe führt bei allen bekannten aktuellen Schemas vor
weiteren Schreibschritten zum Abbruch; eine unbekannte neuere Version bleibt
ein eigener Fehlerfall.

Der Übernahme-PR dokumentiert den genauen Kandidaten und dessen vollständige
CI. Eine grüne technische Migration ersetzt keine fachliche Produktabnahme.
