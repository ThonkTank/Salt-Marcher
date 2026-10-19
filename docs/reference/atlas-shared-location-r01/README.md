# #40 / Hex R01: Save eines neu angelegten Orts

Der [native H01-Befund](../atlas-shared-location-h01/README.md) und die
[D01-Ursachenprüfung](../atlas-shared-location-d01/README.md) bleiben historische,
unveränderte Belege. R01 repariert den dort belegten Save-Pfad im bestehenden
PR62. Beitrag: E2E-01 Nutzerzeile 13,
`E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`; Fixture `e2e01-spatial-v2`.

Der qualifizierte Campaign/Data-Eingang PR65 wurde auf tatsächlichem Head
`32dc3e8f205421dd8e7c6309b75868c7622cb79f` konsumiert: unabhängiger
[Chronik-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40#issuecomment-6101311818)
und [Exact-SHA-CI38079633498](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38079633498).
Vor Veröffentlichung kam Shared
`113e37f21670abb42c19b62f4f4480b511e65544` regulär dazu; dessen fremde Änderungen
bleiben erhalten. Keine Änderungen am Campaign-Producer.

## Reparatur und automatische Nachweise

- Die Navigation erkennt einen geschlossenen lokalen Ortsentwurf. Seine Bytes
  liefern noch keine Registryautorität. Beim ersten Zugriff lädt sie den echten
  Location-Source für den bestehenden Key-Editor.
- Der [native Atlasadapter](../../../src/features/atlas/atlas-campaign-save.ts)
  bindet neue kanonische `Orte/<UUID>.location`-Dateien mit `Before:null` an genau
  einen neuen World-Marker und sämtliche Section-IDs. Alle IDs sind kollisionsfrei;
  bestehende Dateien, Records und fremde Owner bleiben gebunden. Der
  [Closure-Prüfer](../../../src/features/atlas/atlas-location-save-extension.ts)
  weist fremde Pfade, fehlende Marker und unqualifizierte Detaillinks ab.
- Der Adapter liefert vollständige Before-/After-Inventory- und Ownerbelege an
  `verify` und `verifyExtension`, auch in Recovery. Location, World und Manifest
  laufen im vorhandenen Journal samt tatsächlichem Ack/Rollback. Kein neuer
  Speicherweg, keine neue History oder Kamera.
- Die [Kernregression](https://github.com/ThonkTank/Salt-Marcher/blob/c359cc5c890c3a34bc3ef66273081015d11d9ce8/tests/core/atlas-campaign-save.test.ts) verwendet
  die tatsächlichen Created-/Key-/Move-Daten aus H01. Sie prüft Save, weitere
  Saves, Undo/Redo, frisches Repository/Provider, den bearbeitbaren Mount nach
  autoritativem Rollback sowie Prepared-/Committed-Recovery und gefälschte Closure.
- Die [Hostregression](https://github.com/ThonkTank/Salt-Marcher/blob/c359cc5c890c3a34bc3ef66273081015d11d9ce8/tests/atlas-campaign-host.entry.ts) betätigt den
  tatsächlichen Save-Button im DOM-Host mit dem Vault-Adapter und seinen
  synchronen Pending-/nachfolgenden Resolved-Manifestevents. Repository, History,
  Renderer, Kamera, Context und Mountgeneration bleiben. Eine frische View öffnet
  den gespeicherten Key. Dieser Stub ist kein Obsidianprozess.

Typprüfung, Build und 551 Kern-/Host-/Copy-/Vault-Tests sind bestanden.
Prüfkommandos, Quellhashes, Loghashes und Erhaltung stehen im
[R01-Receipt](receipt.json); große Logs liegen am darin benannten lokalen QA-Ort.

## Nachweisgrenzen

Unabhängiger Review des veröffentlichten PR62-Heads, anschließend ein separat
tatsächlicher isolierter Obsidianlauf für Save und frischen Prozess auf dem
qualifizierten Integrationsstand. R01 war eine reine Vertragsprüfung. H01 bleibt
ein nativer FAIL; #40 und das Gesamtgate bleiben offen. Detaillinks, CITY,
physische Bedienung, Originalparität, Großkarten, Nutzervaultinstallation und
P02/P04 sind hier nicht abgenommen. Planung, Reparatur, Review, native Probe und
Aufräumen behalten ihre getrennten Läufe.
