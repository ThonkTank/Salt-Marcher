import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  CreatureCatalog,
  SRD_5_1_ARTIFACT_SHA256,
  SRD_5_1_NOTICE,
  bundledCreatureCatalog,
} from "../../src/features/catalog/creature-catalog";

test("bundled SRD catalog preserves provenance and stable creature details", () => {
  assert.equal(bundledCreatureCatalog.manifest.license, "CC-BY-4.0");
  assert.equal(bundledCreatureCatalog.manifest.catalogVersion, "v5.10.0");
  assert.equal(bundledCreatureCatalog.creatures.length, 334);
  const aboleth = bundledCreatureCatalog.detail("aboleth");
  assert.equal(aboleth?.name, "Aboleth");
  assert.equal(aboleth?.rulesVersion, "2014");
  assert.equal(aboleth?.legacy, true);
  assert.equal(aboleth?.sourceId, "srd-5.1");
  assert.match(SRD_5_1_NOTICE, /creativecommons\.org\/licenses\/by\/4\.0/);
  const bytes = readFileSync("src/features/catalog/data/srd-5.1.generated.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), SRD_5_1_ARTIFACT_SHA256);
});

test("combined D&D Beyond catalog filters form an intersection", () => {
  const page = bundledCreatureCatalog.search({
    text: "dragon",
    crMin: 5,
    crMax: 10,
    sizes: ["Large"],
    types: ["Dragon"],
    habitats: ["Mountain"],
    acMin: 17,
    hpMin: 100,
    movement: "fly",
    senses: "blindsight",
    immunities: "fire",
    sourceIds: ["srd-5.1"],
    rulesVersions: ["2014"],
    legacy: true,
    sort: "cr",
  });
  assert.ok(page.total > 0);
  for (const creature of page.rows) {
    assert.match(creature.name, /dragon/i);
    assert.ok(creature.cr >= 5 && creature.cr <= 10);
    assert.ok(creature.ac >= 17);
    assert.ok(creature.hp >= 100);
    assert.equal(creature.size, "Large");
    assert.equal(creature.type, "Dragon");
    assert.ok(creature.biomes.includes("Mountain"));
    assert.match(creature.speed, /fly/i);
    assert.match(creature.senses, /blindsight/i);
    assert.match(creature.damageImmunities, /fire/i);
    assert.equal(creature.sourceId, "srd-5.1");
    assert.equal(creature.rulesVersion, "2014");
    assert.equal(creature.legacy, true);
  }
});

test("catalog supports paging, deterministic sorting and an empty-query reset", () => {
  const first = bundledCreatureCatalog.search({ sort: "hp", direction: "desc", limit: 7 });
  const second = bundledCreatureCatalog.search({ sort: "hp", direction: "desc", offset: 7, limit: 7 });
  assert.equal(first.rows.length, 7);
  assert.equal(second.rows.length, 7);
  assert.equal(first.total, bundledCreatureCatalog.creatures.length);
  assert.ok(first.rows[0]!.hp >= first.rows[1]!.hp);
  assert.notDeepEqual(first.rows.map((row) => row.id), second.rows.map((row) => row.id));
  const filtered = bundledCreatureCatalog.search({ text: "aboleth" });
  assert.ok(filtered.total < first.total);
  assert.equal(bundledCreatureCatalog.search({}).total, first.total);
});

test("catalog rejects damaged manifests, duplicate ids and invalid ranges", () => {
  const good = {
    manifest: bundledCreatureCatalog.manifest,
    creatures: [],
  };
  assert.doesNotThrow(() => new CreatureCatalog(good));
  assert.throws(() => new CreatureCatalog({ ...good, manifest: { ...good.manifest, sourceHash: "b".repeat(64) } }), /gepinnten SRD-5\.1-Artefakt/);
  assert.throws(() => bundledCreatureCatalog.search({ crMin: 5, crMax: 1 }), /minimale HG/);
  assert.throws(() => bundledCreatureCatalog.search({ offset: Number.NaN }), /query\.offset/);
  assert.throws(() => bundledCreatureCatalog.search({ crMin: Number.POSITIVE_INFINITY }), /query\.crMin/);
  assert.throws(() => bundledCreatureCatalog.search({ sort: "broken" as "name" }), /query\.sort/);
  const aboleth = bundledCreatureCatalog.creatures[0]!;
  const raw = { ...aboleth } as Record<string, unknown>;
  for (const key of ["sourceId", "sourceLabel", "sourceVersion", "rulesVersion", "legacy"])
    delete raw[key];
  assert.throws(() => new CreatureCatalog({ ...good, creatures: [raw, raw] }), /Doppelte Kreaturenkennung/);
});

test("catalog reference truth is deeply immutable", () => {
  const creature = bundledCreatureCatalog.detail("aboleth")!;
  assert.ok(Object.isFrozen(creature));
  assert.ok(Object.isFrozen(creature.abilities));
  assert.ok(Object.isFrozen(creature.biomes));
  assert.ok(Object.isFrozen(creature.actions));
  assert.ok(Object.isFrozen(creature.actions[0]));
  assert.throws(() => (creature.biomes as string[]).push("Changed"), TypeError);
});
