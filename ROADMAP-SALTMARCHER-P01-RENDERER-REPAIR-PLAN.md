# ADR-P01: Browsergrenze der Objekttexturen reparieren

Planlauf vom 09.10.2026 zum [P01-Prototyp](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md). Der erste isolierte Kandidat endete regelgemäß mit `No-Go: boundary`. Sein [Aggregatbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/candidate/adr-p01-linux/tools/adr-prototypes/evidence/p01-aggregate.json) bindet den fehlgeschlagenen Bundlegraphen an `d65538b`.

## Befund

`src/renderer.ts` zieht über `src/textures.ts` `node:buffer` und `pngjs` in den unprivilegierten Renderer. P01 darf diese Node-Module nicht externisieren oder dem Renderer Node-Rechte geben. Der zweite Buildfehler, `dungeon-compute-worker`, stammt aus dem nur im bisherigen Produktbuild definierten Worker-Alias; dessen Auflösung gehört in die eigene P01-Buildkonfiguration und erfordert keinen Produktedit.

## Getrennte Produktreparatur

1. `TexturePool.acquireColorableObject` und die Bibliotheksvorschau dekodieren PNG-Blobs mit Browser-Bild- und Canvas-APIs. Eine reine JavaScript-PNG-Bibliothek wurde als erster Umsetzungskandidat geprüft und überschritt das feste CE-01-Bundlebudget (`230.818` statt höchstens `180.000` Bytes Zuwachs). Canvas kann die RGB-Kanäle vollständig transparenter Pixel verlieren und halbtransparente Kanäle runden; die sichtbare Farbwirkung und Alpha müssen ungefähr gleichwertig bleiben. Cache-Key, Freigabe und Fehlerzustand bleiben fachlich gleich; keine Vaultdatei wird geändert.
2. Ein gezielter Browsertest vergleicht denselben PNG-Input vor und nach der Umstellung auf sichtbarer Farb- und Alphaebene. Er belegt mindestens ein transparentes und ein halbtransparentes Farbfeld. Ein isolierter Hostlauf prüft ein färbbares Objekt und frische Neuöffnung.
3. `npm run check`, `npm test`, `npm run build` und ein separater P01-Renderer-Bundlegraph ohne `node:*`, `pngjs`, `obsidian` und `electron` sind Pflicht. Der P01-Kandidat wird erst nach dieser Reparatur auf neuem Branch wiederholt. Save, Crash-Recovery, Plattformmatrix und das gesamte P01-Tor bleiben bis zu ihren eigenen Belegen offen.

Planung, Umsetzung und unabhängiger Review sind getrennte Läufe. Die ursprünglichen Dateien und der erste No-Go-Beleg bleiben nachvollziehbar.

## Umsetzungskandidat

`TexturePool` und die Bibliotheksvorschau verwenden nun denselben Browser-Dekoder. Der [Chromium-Pixelvergleich](/home/aaron/.cache/dungeon-native-qa/p01-browser-decode-20261009/result.json) erhält bei den vier geprüften Alpha-/Farbfeldern die zusammengesetzten Bildfarben; der [separate Renderer-Bundlegraph](/home/aaron/.cache/dungeon-native-qa/p01-browser-decode-20261009/bundle-result.json) hat keine Node-, Obsidian-, Electron- oder `pngjs`-Importe. Typprüfung, 240 Tests und Build bestehen; der Build wächst gegenüber der CE-01-Baseline um 136.444 Bytes und bleibt unter dem 180.000-Byte-Limit. Der vorhandene Obsidian-Objektprüfer verwendet noch das nicht mehr existente Feld „Paketobjekt“ und liefert deshalb keine Hostfreigabe. Unabhängiger Review und ein aktueller Obsidian-Edit-/Neuöffnungslauf bleiben offen.
