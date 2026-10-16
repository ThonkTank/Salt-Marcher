# SaltMarcher übernimmt die Kampagnenwerkstatt

Status: WIP-Übernahme veröffentlicht; Main-Integration noch offen
Owner: SaltMarcher
Last Reviewed: 2026-10-16
Source of Truth: Nutzerauftrag vom 16. Oktober 2026 und die beiden Git-Eltern des Übernahmecommits

## Codebasis und Historie

Das eigenständige Electron-/TypeScript-/SQLite-Dungeon-Tool, bisher
Kampagnenwerkstatt, wird unter dem Namen **SaltMarcher** im Repository
`ThonkTank/Salt-Marcher` weiterentwickelt. Gemeinsamer Integrationszweig ist
`main`. Bis zur erfolgreichen Qualifikation liegt die neue Codebasis unter
`wip/saltmarcher-workbench`. Die bisherige SaltMarcher-Implementierung soll
dadurch abgelöst werden.

Übernommener veröffentlichter Dungeon-Stand:
`eb143c805f33fcfade80b005e4bfe5b949f51af0`.
Der Übernahmecommit verbindet beide Historien. Das frühere SaltMarcher bleibt
zusätzlich unter `archive/saltmarcher-before-workbench-20261016` zugänglich.
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
[Produktziele](../../PRODUCT.md), [Umfang](../../SCOPE.md) und `acceptance.json`.

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

## Offene Freigabe

Repositoryprüfung, beide Typprüfungen, Adapter- und Desktopbuild sowie das
Linux-Paket sind lokal erfolgreich. Das Paket wurde mit einer synthetischen
Kampagne zweimal gestartet, regulär geschlossen und erneut geöffnet.

Die Gesamtsuite wurde nach mindestens sechs Fehlern angehalten. Die betroffenen
Fälle betreffen Stadtpersonen, Chronik und Spieler-Mitgliedschaft. Die Übernahme
behauptet keinen grünen Gesamtlauf.

Der GitHub-Actions-Lauf des Quellstands wurde schon vor dem ersten Schritt
wegen fehlgeschlagener Kontozahlungen oder eines Ausgabenlimits abgewiesen.
Der genaue [Quelllauf](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38904500347)
bleibt als Beleg erhalten. Eine erforderliche Nutzeraktion betrifft die
GitHub-Kontoabrechnung; der Agent verändert keine Zahlungen oder Ausgabenlimits.
Die neue Codebasis bleibt bis zur erfolgreichen Qualifikation auf dem WIP-Zweig.
