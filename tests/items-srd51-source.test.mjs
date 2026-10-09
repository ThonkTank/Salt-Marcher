import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizePdfText,
  validateJsonSchemas,
  validateTranscriptData,
  verifyItemsSourcePackage,
} from "../tools/items-srd51-source-verify.mjs";

const dataRoot = new URL("../src/features/catalog/data/", import.meta.url);

const occurrence = Object.freeze({
  id: "srd51:magic-item:magic-items-a-z:2",
  feed: "magic-item",
  sectionId: "magic-items-a-z",
  sourceKind: "detail-heading",
  sourceTable: "Magic Items A–Z",
  sourceLabel: "Ammunition, +1, +2, or +3",
  firstPdfPage: 207,
  lastPdfPage: 207,
  firstPrintedPage: 207,
  lastPrintedPage: 207,
  ordinal: 2,
  variantId: null,
  mergeIntoId: null,
});

function transcript(rarity) {
  return {
    schemaVersion: 1,
    complete: true,
    source: {},
    records: [{
      id: occurrence.id,
      name: occurrence.sourceLabel,
      category: "magic-item",
      magic: true,
      rarity,
      attunement: "not-required",
      properties: [],
      description: [{ text: "Beleg", occurrenceId: occurrence.id }],
      source: { pdfPages: [207], printedPages: [207], occurrenceIds: [occurrence.id] },
    }],
  };
}

function inventory(...occurrences) {
  return {
    inventoryVersion: 1,
    complete: true,
    expectedPrimaryOccurrences: occurrences.length,
    capturedPrimaryOccurrences: occurrences.length,
    sections: [{ id: "magic-items-a-z", feed: "magic-item", sourceKind: "detail-heading",
      firstPdfPage: 207, lastPdfPage: 207, firstPrintedPage: 207, lastPrintedPage: 207,
      expectedOccurrences: occurrences.length, capturedOccurrences: occurrences.length, complete: true }],
    occurrences,
  };
}

test("items source package is explicitly incomplete and fails closed by default", async () => {
  await assert.rejects(verifyItemsSourcePackage(), /S01 ist unvollständig/);
  const result = await verifyItemsSourcePackage({ allowIncomplete: true });
  assert.equal(result.complete, false);
  assert.equal(result.validation.occurrenceCount, 50);
  assert.equal(result.validation.recordCount, 50);
  assert.ok(result.blockers.length >= 5);
});

test("normalization expands ligatures and proven wrap artifacts while preserving punctuation", () => {
  assert.equal(normalizePdfText("  Wondrous\u00a0item, inter\u00ad\nnational — hero’s \uFB01ne  "),
    "Wondrous item, international — hero’s fine");
  assert.equal(normalizePdfText("co\u00adoperate – −"), "co\u00adoperate – −");
});

test("variable rarity golden preserves ordered, sourced +1/+2/+3 choices", () => {
  const rarity = {
    kind: "varies",
    sourceText: "uncommon (+1), rare (+2), or very rare (+3)",
    choices: ["uncommon", "rare", "very-rare"].map((value, index) => ({
      variantId: `${occurrence.id}#variant:${index + 1}`,
      label: `+${index + 1}`,
      value,
      occurrenceId: occurrence.id,
    })),
  };
  const result = validateTranscriptData(transcript(rarity), inventory(occurrence));
  assert.equal(result.recordCount, 1);
});

test("rarity varies golden may preserve source text without inventing a choice", () => {
  const result = validateTranscriptData(transcript({ kind: "varies", sourceText: "rarity varies", choices: [] }),
    inventory(occurrence));
  assert.equal(result.complete, true);
});

test("variant identities and occurrence references fail closed", () => {
  const rarity = { kind: "varies", sourceText: "rarity varies", choices: [{
    variantId: `${occurrence.id}#variant:9`, label: "Wrong", value: "rare", occurrenceId: occurrence.id,
  }] };
  assert.throws(() => validateTranscriptData(transcript(rarity),
    inventory(occurrence)), /ordinale Variant-ID/);
  const bad = transcript({ kind: "fixed", value: "rare" });
  bad.records[0].source.occurrenceIds = ["srd51:magic-item:missing:1"];
  assert.throws(() => validateTranscriptData(bad,
    inventory(occurrence)), /unbekannte Occurrence/);
});

test("Draft 2020-12 schemas validate the checked-in equipment inventory and transcript", async () => {
  const [schema, checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-schema-v1.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  assert.doesNotThrow(() => validateJsonSchemas(schema, checkedTranscript, checkedInventory));
  const damaged = structuredClone(checkedTranscript);
  damaged.records[0].subcategory = "invented-category";
  assert.throws(() => validateJsonSchemas(schema, damaged, checkedInventory), /Transkript verletzt JSON Schema/);
});

test("armor source goldens preserve cost, missing values and literal AC semantics", async () => {
  const checkedTranscript = JSON.parse(await readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8"));
  const byName = new Map(checkedTranscript.records.map(record => [record.name, record]));
  assert.deepEqual(byName.get("Padded Armor").cost, { sourceText: "5 gp", copperPieces: 500 });
  assert.equal(byName.get("Padded Armor").armor.stealthRuleText, "Disadvantage");
  assert.equal(byName.get("Hide Armor").armor.armorClassText, "12 + Dex modifier (max 2)");
  assert.equal(byName.get("Chain Mail").armor.strengthRequirementText, "Str 13");
  assert.equal(byName.get("Shield").armor.armorClassText, "+2");
  assert.equal("strengthRequirementText" in byName.get("Padded Armor").armor, false);
});

test("weapon source goldens preserve ordered properties, literal damage and missing values", async () => {
  const checkedTranscript = JSON.parse(await readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8"));
  const byName = new Map(checkedTranscript.records.map(record => [record.name, record]));
  assert.deepEqual(byName.get("Spear").damage,
    { diceText: "1d6", typeText: "piercing", versatileDiceText: "1d8" });
  assert.deepEqual(byName.get("Spear").properties.map(({ name, description }) => ({ name, description })), [
    { name: "Thrown", description: "range 20/60" },
    { name: "Versatile", description: "1d8" },
  ]);
  assert.equal(byName.get("Blowgun").damage.diceText, "1");
  assert.equal("weight" in byName.get("Sling"), false);
  assert.equal("damage" in byName.get("Net"), false);
  assert.deepEqual(byName.get("Net").properties.map(({ name, description }) => ({ name, description })), [
    { name: "Special", description: undefined },
    { name: "Thrown", description: "range 5/15" },
  ]);
  assert.deepEqual(byName.get("Net").source.pdfPages, [65, 66]);
  assert.equal(checkedTranscript.records.some(record => record.properties.some(property => property.name === "Monk")),
    false);
});
