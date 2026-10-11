# H02: zugängliche Rohbelege und Buildprovenienz

Datierter Nachweis vom 10.10.2026 zum konkreten [Build-Befund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6099834538), Gate `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`. Keine neue GUI-Probe oder unabhängige Freigabe.

## Vorhandene Probe unverändert lesen

Das historische H02-Receipt hatte SHA256 `4ed1f2b2da15c5715498399a4c6c32369c6aaa36261a1382ebc5cdd359d34820`. Der [H02-Beleg](raw/native-aba-evidence.json) enthält dessen Produktdaten, Quellstand und historische Hostpfade. Alle zehn referenzierten Dateien liegen bytegleich unter `raw/`, einschließlich [Buildreceipt](raw/build.json), [Prozessabschluss](raw/process-lifecycle.json), [sechs Frames](raw/campaign-aba.json), [Dateiorakel](raw/native-input-bytes.json), [Ergebnis](raw/result.json) und [tatsächlichem Screenshot](raw/actual-picker-aba.png). Aktuelle Repositoryhashes stehen im Binding und Artefaktindex.

[ARTIFACTS.json](ARTIFACTS.json) bindet relative Pfade, Größen und SHA256 der veröffentlichten Dateien. [binding-r02.json](binding-r02.json) ordnet die historischen Pfade zu und nennt alle sechzehn vorhandenen, gegen das Originalorakel geprüften synthetischen Vaultdateien unter `native-input/`. Das zurückbehaltene installierte main.js/styles.css/manifest.json-Tripel wurde erneut direkt gegen das Originalreceipt geprüft. Große Bundles, Sourcemaps und vollständige Laufprotokolle bleiben am bestehenden externen QA-Ort.

## Zwei saubere Reproduktionen

Ein neuer isolierter Checkout von exakt `892e20d737c9e4868aa44b615f8da0f97d98fb39` erhielt `npm ci --ignore-scripts`; node_modules ist ein echtes Verzeichnis, kein Symlink. Derselbe saubere Checkout, dasselbe Lockfile (SHA256 `4d24810fe526acd198fbe5f3a08a883b7ead22aa7c3aaf22c53705d07ff9cea9`) und esbuild `0.25.12` wurden mit beiden Laufzeiten gebaut.

| Laufzeit | main.js SHA256 | Bytes |
| --- | --- | --- |
| Node 22.22.0 | `159e8db18b8e6f797c7414bdcf6899f156c63c422b18b3388f70d209c936aa13` | 1.613.448 |
| Node 22.22.2 | `159e8db18b8e6f797c7414bdcf6899f156c63c422b18b3388f70d209c936aa13` | 1.613.448 |

Vollständige Laufzeit-/Lock-/esbuild-Angaben stehen in [Node-22.22.0-Provenienz](node22.22.0-provenance.json) und [Node-22.22.2-Provenienz](node22.22.2-provenance.json); hinzu kommen die beiden originalen Buildinventare und das ursprüngliche H02-Inventar unter `raw/`. Beide frischen Builds haben `dirty:false`. Es wurde kein Produktcode angepasst.

Der Gzip-/Base64-Katalogpayload ist in beiden Builds identisch; Base64-SHA256 `a6c0c421c7a67436f0d26f70d507461b0be88e6594a0fd650955f977af874385`. Dekomprimiert entspricht er exakt dem geprüften SRD-Quelldigest. Unterschiedliche Node-/zlib-Patchstände oder die ursprüngliche Dependency-Verknüpfung erklären den abweichenden Vergleichshash damit nicht nachweislich. [build-inputs.json](build-inputs.json) enthält Pfad, Größe und Digest aller 563 im frischen Sourcemap enthaltenen Quelleingänge; Dependency-Pfade sind ab node_modules normalisiert.

Reproduktion im bestehenden Repository, ausschließlich in einem neuen isolierten Prüfcheckout:

```sh
git worktree add --detach /tmp/dungeon-h02-892e20d 892e20d737c9e4868aa44b615f8da0f97d98fb39
cd /tmp/dungeon-h02-892e20d
npm ci --ignore-scripts
npm exec --yes --package=node@22.22.0 -- node build.mjs
sha256sum main.js
npm exec --yes --package=node@22.22.2 -- node build.mjs
sha256sum main.js
```

Die Tabelle hält die hier tatsächlich beobachteten Ergebnisse fest; sie verspricht kein unverifiziertes Ergebnis auf einem anderen Host.

## Enger nächster Vergleich

Der Vergleichshash `a7f2db0b104804be4a14a10888ef34248a0310f2daedee6aa64009cd5143bae7` wurde auf diesem Host nicht reproduziert. Für eine Erklärung fehlen dessen tatsächliches `.build/catalog-build-inventory.json`, Quelleingangs-/Payloaddigests oder gebautes Artefakt. Dieser Nachweis klärt die Abweichung und vollständiges E2E nicht.

Die [Veröffentlichungskomposition](composition.json) bindet die vor Veröffentlichung zusätzlich übernommenen Shared-Werkzeuge/Dokumente an 108f104, 21 Strukturprüfungen und 682 vollständige Tests samt sauberem Build. Die ursprünglichen H02-/R02-Rohbytes bleiben unverändert.

Die H02-Probe nutzt synthetische Bedienung in einem echten isolierten Obsidianprozess. Ihr damaliger Build und normaler Prozessabschluss bleiben unverändert gebunden. Dieser Nachweis ersetzt keine physische, Originalparitäts-, Großwelt- oder Nutzervault-Abnahme.
