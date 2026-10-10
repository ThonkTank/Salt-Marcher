# Ursprüngliche Atlas-Speicher- und Wiederherstellungsbelege

Datierter Zugang vom 10.10.2026 für den bestehenden integrierten Review zu [E2E01-PROMOTION-01 / #39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39), E2E-01 Zeile 13, Gate `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`. Diese Veröffentlichung enthält vorhandene Originale; sie erteilt keine unabhängige Freigabe.

## Die damaligen vier Läufe

[Originalreceipt](raw/native-evidence.json): SHA256 `3ccb22c6dba8a3c5ae102a90e3e6b48e0ae189bce7425c69b8a62a65cb123b69`. Alle 46 darin gehashten Ergebnis-, Build-, Prozess-, Screenshot- und Zustandsdateien liegen bytegleich unter `raw/`. Historische absolute Pfade im Receipt bleiben erhalten; [binding.json](binding.json) ordnet sie den zugänglichen relativen Dateien zu. [ARTIFACTS.json](ARTIFACTS.json) bindet die gesamte Veröffentlichung mit Größe und SHA256, ohne sich selbst zu hashen.

| Originalprobe | Probe-Quellstand | Ergebnis im Original |
| --- | --- | --- |
| Save, erster nativer CAS-Fehler, vollständiger Rollback, neuer Retry, Undo/Redo nach Save | `11ba72c540959e86a1a1c8ce80dfaba8bbf526b1` | `passed:true`, normales Prozessende |
| Neuer Obsidianprozess öffnet gespeicherte Dateien und Haus-/Raum-Key | derselbe Stand | `passed:true`, eigenes normales Prozessende |
| Zweifach fehlgeschlagenes Committed-Cleanup; After-Bytes und Journal erhalten, alter Mount blockiert | `fe10f6218e235ef373757b09354840d0b8e8d7df` | `passed:true`, normales Prozessende |
| Neuer Obsidianprozess führt Forward-Recovery aus und öffnet bestätigte After-Bytes | derselbe Stand | `passed:true`, eigenes normales Prozessende |

Keiner dieser vier Prozesse wurde zwangsbeendet. Der frühere [fehlgeschlagene Diagnoseversuch](raw/failed-recovery-diagnostic.json), sein ursprüngliches Ergebnis/Prozessreceipt und die zwei vorläufigen Ergebnisse bleiben separat zugänglich. Dieser Fehler wurde beim Serialisieren vollständiger Mountobjekte im Harness beobachtet; die Diagnose wurde auf skalare Angaben reduziert. Er zählt nicht als bestandene Probe und nicht als neu diagnostizierter Produktfehler.

## Tatsächlicher Build und gespeicherte Quelle

Die installierten Tripel beider Laufpaare wurden am aufbewahrten isolierten QA-Vault gegen ihre Originalreceipts geprüft. main.js hat SHA256 `db2c32299d223de6cbe3af88cd73b148be6306a45b979be3caf9ed698cb07a8a` bei 1.612.715 Bytes. Manifest und Styles sind separat im Binding gehasht. Die ursprünglichen [Save-Buildangaben](raw/post-save-history-build.log) und [Recovery-Buildangaben](raw/recovery-diagnostics-build.log) nennen den Befehl `npm run build` (`node build.mjs`), Node 22.22.0 und `dirty:false`. Die Herkunft des damaligen Node-Binaries wurde nicht protokolliert; der Lockfile-Eingang bindet esbuild 0.25.12. Ein damaliger zlib-Wert wurde nicht protokolliert; die Veröffentlichung erfindet keinen. Der Katalogpayload und sein dekomprimierter SRD-Quelldigest sind direkt aus beiden erhaltenen Bundles ermittelt.

Die beiden Probe-SHAs und der ursprüngliche Typ-/637-Test-/Buildstand `2449d05f49825f223d8d815fedfb8f52a4873f45` unterscheiden sich in `src`, `tests`, Buildskript, Package/Lock, Manifest und Styles nicht vom produktiven Save-Stand `86bbbbfac44233509f084ac836e6dafa07b11a16`. Das Binding nennt die tatsächlichen Harness-/Metadatenänderungen; die beiden Harnesspatches und der aus Git abgeleitete Produkt-Quellenindex liegen unter `provenance/`. Dieser Index ist keine neu erfasste Sourcemap. Bundles, Sourcemaps und große Testlogs bleiben am historischen externen QA-Ort. Es wurde nichts neu gebaut oder gestartet.

Alle 16 Before-/After-Eingaben der bestehenden Fixture `tests/fixtures/atlas-e2e-spatial-v2` wurden gegen die damalige Vorbereitung und den Save-Quellstand geprüft. Sie sind bereits im Repo zugänglich und im Binding einzeln referenziert; zusätzliche Fixturekopien sind unnötig. Auch die 19 eingefrorenen Matrixdateien bleiben hashgleich.

## Enger Vergleich mit dem aktuellen Kandidaten

Die ursprüngliche Save-Quelle ist nicht bytegleich mit dem heutigen Produkt. [saved-to-current.patch](saved-to-current.patch) und das Binding nennen die sieben tatsächlichen Änderungen bis `5fd5463560c99e884e76dabcb5dd5fa0ebd8b91c`: vier Atlasdateien mit der R01-Navigationsvorbereitung/Current-Guards und entfernter doppelter Host-Capture, sowie drei qualifizierte Shared-Katalogdaten. Buildskript und Lock sind unverändert. Der heutige Produkt-/Host-/Fixturepfad stimmt dagegen mit dem bereits unabhängig geprüften H02-Stand überein. Das Testwerkzeug `tools/host-test.cjs` wurde nach H02 außerdem durch den qualifizierten Shared-Commit `e4261ac899dadddffab1226b23eb3c8612dfead2` so geändert, dass Haupt-/Shutdownfehler im Ergebnis erhalten bleiben. Es ist nicht bytegleich mit dem alten Harness. [Der vollständige Harnessvergleich](provenance/saved-harness-to-current.patch) liegt bei; die vier damaligen erfolgreichen Prozesse besitzen eigene normale Abschlussreceipts ohne Zwangsbeendigung. Diese Veröffentlichung selbst ändert keinen dieser Pfade.

Der bestehende integrierte Chronik-Reviewer erhält damit den fehlenden zugänglichen Eingang und kann entscheiden, welchen Save/Fresh/Rollback/Committed-Recovery-Scope diese Originale in der aktuellen Komposition decken. #38/R01/H02 bleibt geschlossen. Bis zu dieser unabhängigen Entscheidung bleibt #39 ohne Promotion. Keine neue allgemeine Reviewrunde und keine automatische GUI-Wiederholung.

Grenzen: kleine synthetische Fixture, echte isolierte Obsidianprozesse mit synthetischen Gesten und kontrollierter Fehlerauslösung. Keine physische Eingabe, Originalparität, Großkarte, Nutzervaultinstallation, Stromausfalldauerhaftigkeit oder vollständige E2E-Freigabe.
