# ADR-P01: Browsergrenze der Objekttexturen reparieren

Planlauf vom 09.10.2026 zum [P01-Prototyp](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md). Der erste isolierte Kandidat endete regelgemäß mit `No-Go: boundary`. Sein [Aggregatbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/candidate/adr-p01-linux/tools/adr-prototypes/evidence/p01-aggregate.json) bindet den fehlgeschlagenen Bundlegraphen an `d65538b`.

## Befund

`src/renderer.ts` zieht über `src/textures.ts` `node:buffer` und `pngjs` in den unprivilegierten Renderer. P01 darf diese Node-Module nicht externisieren oder dem Renderer Node-Rechte geben. Der zweite Buildfehler, `dungeon-compute-worker`, stammt aus dem nur im bisherigen Produktbuild definierten Worker-Alias; dessen Auflösung gehört in die eigene P01-Buildkonfiguration und erfordert keinen Produktedit.

## Getrennte Produktreparatur

1. `TexturePool.acquireColorableObject` dekodiert die vorhandenen PNG-Blobdaten mit Browser-Bild- und Canvas-APIs zu RGBA. Eingaben, Alpha, Farbumrechnung, Cache-Key, Freigabe und Fehlerzustand bleiben fachlich gleich; keine Vaultdatei wird geändert.
2. Ein gezielter Browsertest vergleicht denselben PNG-Input vor und nach der Umstellung auf Pixel- und Alphaebene. Er belegt mindestens ein transparentes und ein halbtransparentes Farbfeld. Ein isolierter Hostlauf prüft ein färbbares Objekt und frische Neuöffnung.
3. `npm run check`, `npm test`, `npm run build` und ein separater P01-Renderer-Bundlegraph ohne `node:*`, `pngjs`, `obsidian` und `electron` sind Pflicht. Der P01-Kandidat wird erst nach dieser Reparatur auf neuem Branch wiederholt. Save, Crash-Recovery, Plattformmatrix und das gesamte P01-Tor bleiben bis zu ihren eigenen Belegen offen.

Planung, Umsetzung und unabhängiger Review sind getrennte Läufe. Die ursprünglichen Dateien und der erste No-Go-Beleg bleiben nachvollziehbar.
