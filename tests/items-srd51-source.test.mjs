import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePdfText,
  validateTranscriptData,
  verifyItemsSourcePackage,
} from "../tools/items-srd51-source-verify.mjs";

const occurrence = Object.freeze({
  id: "srd51:magic-item:magic-items-a-z:2",
  sourceLabel: "Ammunition, +1, +2, or +3",
  firstPdfPage: 207,
  lastPdfPage: 207,
  firstPrintedPage: 207,
  lastPrintedPage: 207,
  ordinal: 2,
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
      source: { occurrenceIds: [occurrence.id] },
    }],
  };
}

test("items source package is explicitly incomplete and fails closed by default", async () => {
  await assert.rejects(verifyItemsSourcePackage(), /S01 ist unvollständig/);
  const result = await verifyItemsSourcePackage({ allowIncomplete: true });
  assert.equal(result.complete, false);
  assert.equal(result.validation.occurrenceCount, 0);
  assert.ok(result.blockers.length >= 5);
});

test("normalization covers PDF ligatures, soft hyphens, spacing and typographic punctuation", () => {
  assert.equal(normalizePdfText("  Wondrous\u00a0item, very\u00ad rare — hero’s  "),
    "Wondrous item, very rare - hero's");
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
  const result = validateTranscriptData(transcript(rarity), { inventoryVersion: 1, complete: true,
    occurrences: [occurrence] });
  assert.equal(result.recordCount, 1);
});

test("rarity varies golden may preserve source text without inventing a choice", () => {
  const result = validateTranscriptData(transcript({ kind: "varies", sourceText: "rarity varies", choices: [] }),
    { inventoryVersion: 1, complete: true, occurrences: [occurrence] });
  assert.equal(result.complete, true);
});

test("variant identities and occurrence references fail closed", () => {
  const rarity = { kind: "varies", sourceText: "rarity varies", choices: [{
    variantId: `${occurrence.id}#variant:9`, label: "Wrong", value: "rare", occurrenceId: occurrence.id,
  }] };
  assert.throws(() => validateTranscriptData(transcript(rarity),
    { inventoryVersion: 1, complete: true, occurrences: [occurrence] }), /ordinale Variant-ID/);
  const bad = transcript({ kind: "fixed", value: "rare" });
  bad.records[0].source.occurrenceIds = ["srd51:magic-item:missing:1"];
  assert.throws(() => validateTranscriptData(bad,
    { inventoryVersion: 1, complete: true, occurrences: [occurrence] }), /unbekannte Occurrence/);
});
