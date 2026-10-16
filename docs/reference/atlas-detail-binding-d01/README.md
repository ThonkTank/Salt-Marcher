# HEX-04: belegter Save-Eingang für Dungeonverortung

E2E-01, Nutzerzeile13, `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`. [Quellgebundene Quittung](receipt.json) und [vier Modellfälle](result.json) belegen den untersuchten Fehlerstand.

Save übernimmt einen Detaillink am bestehenden Ort und den geänderten Parent einer bestehenden Dungeonplatzierung. Die Registry deklariert danach weiterhin die bisherigen Referenzen: der Dungeon fehlt am Ort, der neue Ort fehlt an der Dungeonplatzierung, alte City-/Buildingreferenzen bleiben dort stehen. Eine frische **Modell-Repositoryinstanz** und ihr Capture lesen den gespeicherten Zustand und belegen den Unterschied. Undo/Redo erhält die Änderungen exakt; die Dungeondatei bleibt bytegleich. Unveränderter No-op ist die Kontrollprobe. Die zusätzliche Identitätsänderung wird ohne Save-Schreibwirkung und mit erhaltenem Draft abgewiesen; daraus entsteht kein Auftrag, Kennungen umzuschreiben.

Ursache ist die unveränderte Übernahme von `r.references` in `AtlasCampaignManifestSave.owners`. Der untersuchte Stand besitzt außerdem keinen sichtbaren Anschluss zur Verortung einer bestehenden Dungeonkarte.

[Reproduzierer](diagnostic.entry.ts), aus dem Repositoryroot mit den bestehenden Dependencies (Ausgaben in einen eigenen QA-Ordner außerhalb des Vaults):

```sh
./node_modules/esbuild/bin/esbuild docs/reference/atlas-detail-binding-d01/diagnostic.entry.ts --bundle --platform=node --outfile=/tmp/hex-detail-d01.cjs
node /tmp/hex-detail-d01.cjs /tmp/hex-detail-d01.json
```

Alle Produktoperationen verwenden einen speicherinternen synthetischen Store. Das Skript schreibt nur die ausdrücklich angegebene JSON-Ausgabe; Repositoryfixture, Nutzervault und native H02-Belege bleiben erhalten. Dies ist ein diagnostischer Modellnachweis, kein UI-/Electron-/physischer-/Original-/Installations-/Gesamt-E2E-PASS. Die gesetzten Assertions beschreiben den gebundenen Fehlerstand; nach einer Reparatur ist die Regression entsprechend auf korrekte Referenzclosure umzustellen.
