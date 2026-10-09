# ADR-P01: Browsergrenze der Objekttexturen reparieren

Planlauf vom 09.10.2026 zum [P01-Prototyp](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md). Der erste isolierte Kandidat endete regelgemäß mit `No-Go: boundary`. Sein [Aggregatbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/candidate/adr-p01-linux/tools/adr-prototypes/evidence/p01-aggregate.json) bindet den fehlgeschlagenen Bundlegraphen an `d65538b`.

## Befund

`src/renderer.ts` zieht über `src/textures.ts` `node:buffer` und `pngjs` in den unprivilegierten Renderer. P01 darf diese Node-Module nicht externisieren oder dem Renderer Node-Rechte geben. Der zweite Buildfehler, `dungeon-compute-worker`, stammt aus dem nur im bisherigen Produktbuild definierten Worker-Alias; dessen Auflösung gehört in die eigene P01-Buildkonfiguration und erfordert keinen Produktedit.

## Getrennte Produktreparatur

1. `TexturePool.acquireColorableObject` und die Bibliotheksvorschau dekodieren PNG-Blobs mit derselben browserfähigen Routine. Der erste reine JavaScript-Kandidat überschritt das CE-01-Bundlebudget (`230.818` statt höchstens `180.000` Bytes Zuwachs). Der Canvas-Kandidat bestand nur an vier künstlichen Farbfeldern; ein echter 1024×1024-Paketasset zeigte abweichende Farbauswahl und Alpha. Der reparierte Pfad nutzt `png-tools` mit `fflate` für bytegenaue 8-Bit-RGBA-Dekodierung und Browserbild als Rückfall für andere gültige PNG-Formate. Cache-Key, Freigabe und Fehlerzustand bleiben fachlich gleich; keine Vaultdatei wird geändert.
2. Ein gezielter Browsertest vergleicht denselben PNG-Input vor und nach der Umstellung auf Pixel- und Alphaebene. Er belegt transparente und halbtransparente Farbfelder sowie ein echtes färbbares Paketasset. Ein isolierter Hostlauf prüft Platzieren, Rendern, Speichern und frische Neuöffnung.
3. `npm run check`, `npm test`, `npm run build` und ein separater P01-Renderer-Bundlegraph ohne `node:*`, `pngjs`, `obsidian` und `electron` sind Pflicht. Der P01-Kandidat wird erst nach dieser Reparatur auf neuem Branch wiederholt. Save, Crash-Recovery, Plattformmatrix und das gesamte P01-Tor bleiben bis zu ihren eigenen Belegen offen.

Planung, Umsetzung und unabhängiger Review sind getrennte Läufe. Die ursprünglichen Dateien und der erste No-Go-Beleg bleiben nachvollziehbar.

## Umsetzungskandidat

Die Rohdekodierung ist nach dem Canvas-Reviewbefund repariert. Im [frischen Chromium-Review](/home/aaron/.cache/dungeon-native-qa/p01-renderer-review-20261009/review-real-result.json) stimmen alle 1.048.576 Pixel des echten Paketassets für Alpha 255, 128 und 0 mit `pngjs` überein; der [Renderer-Bundlegraph](/home/aaron/.cache/dungeon-native-qa/p01-renderer-review-20261009/bundle-result.json) enthält keine privilegierten Imports. Ein frischer Worktree auf `2e9ea8c` bestand Typprüfung, 241 Tests und Build bei 149.097 Bytes Zuwachs. Der [aktuelle Obsidian-Hostlauf](/home/aaron/.cache/dungeon-native-qa/p01-texture-host-20261009/evidence/1791557663090-p01-browser-texture-edit/result.json) platzierte und speicherte das färbbare Objekt, die [frische Neuöffnung](/home/aaron/.cache/dungeon-native-qa/p01-texture-host-20261009/evidence/1791557672875-p01-browser-texture-reopen/result.json) behielt ID, Textur und Dateihash. Ein unabhängiger Hostreview auf frischem QA-Profil und das gesamte P01-Tor bleiben offen.

Der [getrennte Obsidian-Review](/home/aaron/.cache/dungeon-native-qa/p01-texture-review-20261009/review.md) wiederholte beide Läufe auf einem neuen QA-Profil. Der [Audit](/home/aaron/.cache/dungeon-native-qa/p01-texture-review-20261009/review-audit.json) bestätigt denselben Produktbundlehash, paarweise gleiche Platzierungs- und Neuöffnungsbilder sowie je Profil unveränderte V4-Dateibytes nach frischem Prozess. Die Renderergrenze und dieser Objektablauf sind im gemessenen Scope reviewt; Desktop-Shell, Utility-Speicherung, Fault- und OS-Matrix, physische Eingabe und das gesamte P01-Tor bleiben offen.
