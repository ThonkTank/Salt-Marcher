# Campaign-B-Fixture reproduzieren

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Das synthetische [`e2e01-campaign-b-v1`](../../../tests/fixtures/atlas-e2e-campaign-b-v1/manifest.json) beschreibt eine zweite Kampagne mit eigenem Atlas, zwei Orten, Stadt, Dungeon und zwei Terrainchunks. Der historische Referenzstand ist [`eacf6abd57523a246c4d5399ac119bd9af2a0e03`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/eacf6abd57523a246c4d5399ac119bd9af2a0e03); für dessen exakte Reproduktion dort auschecken. Installation und Abhängigkeiten: [README](../../../README.md#lokal-entwickeln).

```bash
node tools/materialize-campaign-b-fixture.mjs
git diff --exit-code -- tests/fixtures/atlas-e2e-campaign-b-v1
node build.mjs --test
node --test --test-name-pattern='Campaign B' .build/tests.cjs
```

Erwartet: bytegleiches Materialisieren und zwei bestandene Tests. Der [Fixture-Test](../../../tests/shared/core/campaign-b-fixture.test.ts) prüft acht Dateien samt Manifest, Bytes/Hashes, parsebare Inhalte, Campaign-/Namespace-/Registry-/Owneridentitäten und ihre Digests, die Trennung von Campaign A sowie die Auffindbarkeit beider Kampagnen über die produktive Runtimequelle.

Das ist ein Modell- und Dateinachweis; ein tatsächlicher A→B→A-Hostlauf, Installation und physische Eingabe bleiben separat zu prüfen.
