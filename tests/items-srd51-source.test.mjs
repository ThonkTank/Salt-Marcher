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
    crossReferences: [],
    helperDispositions: [],
  };
}

test("items source package is explicitly incomplete and fails closed by default", async () => {
  await assert.rejects(verifyItemsSourcePackage(), /S01 ist unvollständig/);
  const result = await verifyItemsSourcePackage({ allowIncomplete: true });
  assert.equal(result.complete, false);
  assert.equal(result.validation.occurrenceCount, 213);
  assert.equal(result.validation.recordCount, 213);
  assert.ok(result.blockers.length >= 5);
});

test("normalization expands ligatures and proven wrap artifacts while preserving punctuation", () => {
  assert.equal(normalizePdfText("  Wondrous\u00a0item, inter\u00ad\nnational — hero’s \uFB01ne  "),
    "Wondrous item, international — hero’s fine");
  assert.equal(normalizePdfText("Ladder (10-\u00ad\u2010foot)"), "Ladder (10-foot)");
  assert.equal(normalizePdfText("item—\n an orb, wand-\u2011like item—\n designed"),
    "item—an orb, wand-like item—designed");
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

test("adventuring gear inventory preserves all 99 physical table rows without group headers", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const rows = checkedInventory.occurrences.filter(item => item.sectionId === "adventuring-gear");
  assert.equal(rows.length, 99);
  assert.deepEqual(rows.map(row => row.sourceLabel), [
    "Abacus", "Acid (vial)", "Alchemist’s fire (flask)", "Arrows (20)", "Blowgun needles (50)",
    "Crossbow bolts (20)", "Sling bullets (20)", "Antitoxin (vial)", "Crystal", "Orb", "Rod", "Staff",
    "Wand", "Backpack", "Ball bearings (bag of 1,000)", "Barrel", "Basket", "Bedroll", "Bell", "Blanket",
    "Block and tackle", "Book", "Bottle, glass", "Bucket", "Caltrops (bag of 20)", "Candle",
    "Case, crossbow bolt", "Case, map or scroll", "Chain (10 feet)", "Chalk (1 piece)", "Chest",
    "Climber’s kit", "Clothes, common", "Clothes, costume", "Clothes, fine", "Clothes, traveler’s",
    "Component pouch", "Crowbar", "Sprig of mistletoe", "Totem", "Wooden staff", "Yew wand", "Fishing tackle",
    "Flask or tankard", "Grappling hook", "Hammer", "Hammer, sledge", "Healer’s kit", "Amulet", "Emblem",
    "Reliquary", "Holy water (flask)", "Hourglass", "Hunting trap", "Ink (1 ounce bottle)", "Ink pen",
    "Jug or pitcher", "Ladder (10-foot)", "Lamp", "Lantern, bullseye", "Lantern, hooded", "Lock",
    "Magnifying glass", "Manacles", "Mess kit", "Mirror, steel", "Oil (flask)", "Paper (one sheet)",
    "Parchment (one sheet)", "Perfume (vial)", "Pick, miner’s", "Piton", "Poison, basic (vial)",
    "Pole (10-foot)", "Pot, iron", "Potion of healing", "Pouch", "Quiver", "Ram, portable", "Rations (1 day)",
    "Robes", "Rope, hempen (50 feet)", "Rope, silk (50 feet)", "Sack", "Scale, merchant’s", "Sealing wax",
    "Shovel", "Signal whistle", "Signet ring", "Soap", "Spellbook", "Spikes, iron (10)", "Spyglass",
    "Tent, two-person", "Tinderbox", "Torch", "Vial", "Waterskin", "Whetstone",
  ]);
  assert.deepEqual(rows.map(row => row.id),
    Array.from({ length: 99 }, (_, index) => `srd51:equipment:adventuring-gear:${index + 1}`));
  assert.equal(rows.every(row => row.firstPdfPage === 69 && row.lastPdfPage === 69), true);
  assert.equal(rows[75].sourceLabel, "Potion of healing");
  assert.equal(rows[75].mergeIntoId, null);
  assert.equal(rows.some(row => ["Ammunition", "Arcane focus", "Druidic focus", "Holy symbol",
    "Container Capacity"].includes(row.sourceLabel)), false);
  const reordered = structuredClone(checkedInventory);
  [reordered.occurrences[50], reordered.occurrences[51]] = [reordered.occurrences[51], reordered.occurrences[50]];
  assert.throws(() => validateTranscriptData(checkedTranscript, reordered, { allowIncomplete: true }),
    /lückenlose physische Reihenfolge/);
});

test("adventuring gear transcript preserves all 99 rows, exact omissions and source categories", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const records = checkedTranscript.records.filter(record => record.id.includes(":adventuring-gear:"));
  assert.equal(records.length, 99);
  assert.deepEqual(records.map(record => record.id), checkedInventory.occurrences
    .filter(item => item.sectionId === "adventuring-gear").map(item => item.id));
  assert.deepEqual(records.find(record => record.name === "Crossbow bolts (20)").weight,
    { sourceText: "1½ lb.", pounds: "1.5" });
  assert.equal("weight" in records.find(record => record.name === "Antitoxin (vial)"), false);
  assert.deepEqual(records.find(record => record.name === "Waterskin").weight,
    { sourceText: "5 lb. (full)" });
  assert.deepEqual(records.find(record => record.name === "Caltrops (bag of 20)").cost,
    { sourceText: "1 gp", copperPieces: 100 });
  assert.deepEqual(records.find(record => record.name === "Spikes, iron (10)").cost,
    { sourceText: "1 gp", copperPieces: 100 });
  assert.equal(records.find(record => record.name === "Climber’s kit").subcategory, "kit");
  assert.equal(records.find(record => record.name === "Crystal").subcategory, "arcane-focus");
  assert.equal(records.find(record => record.name === "Amulet").subcategory, "holy-symbol");
});

test("Potion of healing keeps its first physical occurrence as canonical magic identity", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const potion = checkedTranscript.records.find(record => record.name === "Potion of healing");
  const occurrence = checkedInventory.occurrences.find(item => item.id === potion.id);
  assert.equal(potion.id, "srd51:equipment:adventuring-gear:76");
  assert.equal(potion.category, "magic-item");
  assert.equal(potion.magic, true);
  assert.equal(potion.subcategory, "potion");
  assert.match(potion.description[0].text, /magical red fluid/);
  assert.equal(occurrence.mergeIntoId, null);
  assert.equal(checkedTranscript.complete, false);
});

test("equipment packs preserve physical order, exact costs and complete published contents", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(item => item.sectionId === "equipment-packs");
  const records = checkedTranscript.records.filter(record => record.subcategory === "equipment-pack");
  assert.deepEqual(occurrences.map(item => item.sourceLabel), [
    "Burglar’s Pack", "Diplomat’s Pack", "Dungeoneer’s Pack", "Entertainer’s Pack",
    "Explorer’s Pack", "Priest’s Pack", "Scholar’s Pack",
  ]);
  assert.deepEqual(records.map(record => record.id), occurrences.map(item => item.id));
  assert.deepEqual(records.map(record => record.cost.sourceText),
    ["16 gp", "39 gp", "12 gp", "40 gp", "10 gp", "19 gp", "40 gp"]);
  assert.equal(records.every(record => record.source.pdfPages.join() === "70"), true);
  assert.match(records[0].description[0].text, /10 feet of string/);
  assert.match(records[0].description[0].text, /5 days rations/);
  assert.match(records[5].description[0].text, /an alms box, 2 blocks of incense, a censer, vestments/);
  assert.match(records[6].description[0].text, /a little bag of sand, and a small knife/);
});

test("pack-only helper dispositions are explicit and cannot invent primary identities", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const packOnly = checkedInventory.helperDispositions.filter(item => item.disposition === "pack-prose-only");
  assert.deepEqual(packOnly.map(item => item.helperIndex), [
    "string-10-feet", "alms-box", "block-of-incense", "censer", "vestments",
    "little-bag-of-sand", "small-knife",
  ]);
  assert.equal(packOnly.every(item =>
    item.disposition === "pack-prose-only" && item.canonicalId === null), true);
  const invented = structuredClone(checkedInventory);
  invented.helperDispositions[0].canonicalId = "srd51:equipment:equipment-packs:1";
  assert.throws(() => validateTranscriptData(checkedTranscript, invented, { allowIncomplete: true }),
    /keine kanonische Primär-ID erfinden/);
  const unknownSource = structuredClone(checkedInventory);
  unknownSource.helperDispositions[0].sourceOccurrenceIds = ["srd51:equipment:equipment-packs:99"];
  assert.throws(() => validateTranscriptData(checkedTranscript, unknownSource, { allowIncomplete: true }),
    /unbekannte Occurrence/);
});

test("tools preserve all 35 leaf rows, physical order, categories and optional weights", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(item => item.sectionId === "tools");
  const records = checkedTranscript.records.filter(record => record.id.includes(":tools:"));
  assert.equal(occurrences.length, 35);
  assert.deepEqual(occurrences.map(item => item.id),
    Array.from({ length: 35 }, (_, index) => `srd51:equipment:tools:${index + 1}`));
  assert.deepEqual(records.map(record => record.id), occurrences.map(item => item.id));
  assert.deepEqual(records.reduce((counts, record) => ({
    ...counts, [record.subcategory]: (counts[record.subcategory] ?? 0) + 1,
  }), {}), {
    "artisans-tools": 17,
    kit: 4,
    "gaming-set": 2,
    "musical-instrument": 10,
    "other-tools": 2,
  });
  const byName = new Map(records.map(record => [record.name, record]));
  assert.deepEqual(byName.get("Alchemist’s supplies").cost, { sourceText: "50 gp", copperPieces: 5000 });
  assert.deepEqual(byName.get("Dice set").cost, { sourceText: "1 sp", copperPieces: 10 });
  assert.deepEqual(byName.get("Playing card set").cost, { sourceText: "5 sp", copperPieces: 50 });
  assert.equal("weight" in byName.get("Dice set"), false);
  assert.equal("weight" in byName.get("Playing card set"), false);
  assert.equal(records.filter(record => record.weight !== undefined).length, 33);
  assert.equal(byName.has("Calligrapher's supplies"), true);
  assert.equal(byName.has("Calligrapher’s supplies"), false);
  assert.match(byName.get("Alchemist’s supplies").description[0].text, /Each type of artisan’s tools/);
  assert.match(byName.get("Dice set").description[0].text, /Three-Dragon Ante/);
  assert.match(byName.get("Navigator’s tools").description[0].text, /navigator's tools.*ship's course/);
  assert.match(byName.get("Thieves’ tools").description[0].text, /narrow-bladed scissors/);
});

test("Tools Vehicles row remains a sourced cross-reference without a primary item identity", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  assert.deepEqual(checkedInventory.crossReferences, [{
    id: "srd51:equipment:tools:cross-reference:1",
    feed: "equipment",
    sectionId: "tools",
    sourceKind: "cross-reference",
    sourceTable: "Tools",
    sourceLabel: "Vehicles (land or water)",
    sourceText: "* See the “Mounts and Vehicles” section.",
    firstPdfPage: 70,
    lastPdfPage: 70,
    firstPrintedPage: 70,
    lastPrintedPage: 70,
    targetSectionIds: ["mounts-other-animals", "tack-harness-drawn-vehicles", "waterborne-vehicles"],
  }]);
  assert.equal(checkedInventory.occurrences.some(item => item.sourceLabel === "Vehicles (land or water)"), false);
  assert.equal(checkedTranscript.records.some(record => record.name === "Vehicles (land or water)"), false);
  const damaged = structuredClone(checkedInventory);
  damaged.crossReferences[0].targetSectionIds.push("missing-section");
  assert.throws(() => validateTranscriptData(checkedTranscript, damaged, { allowIncomplete: true }),
    /unbekannten Zielabschnitt missing-section/);
});

test("mounts preserve eight physical rows and reconcile the Donkey or mule helper expansion", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(item => item.sectionId === "mounts-other-animals");
  const records = checkedTranscript.records.filter(record => record.subcategory === "mount-or-animal");
  assert.deepEqual(occurrences.map(item => item.sourceLabel), [
    "Camel", "Donkey or mule", "Elephant", "Horse, draft", "Horse, riding", "Mastiff", "Pony", "Warhorse",
  ]);
  assert.deepEqual(occurrences.map(item => item.id),
    Array.from({ length: 8 }, (_, index) => `srd51:equipment:mounts-other-animals:${index + 1}`));
  assert.deepEqual(occurrences.map(item => [item.firstPdfPage, item.lastPdfPage]), [
    [71, 71], [71, 71], [71, 71], [72, 72], [72, 72], [72, 72], [72, 72], [72, 72],
  ]);
  assert.deepEqual(records.map(record => record.id), occurrences.map(item => item.id));
  assert.deepEqual(records.map(record => record.cost.sourceText),
    ["50 gp", "8 gp", "200 gp", "50 gp", "75 gp", "25 gp", "30 gp", "400 gp"]);
  assert.deepEqual(records.map(record => record.speed), [
    { sourceText: "50 ft.", unit: "ft/round", value: "50" },
    { sourceText: "40 ft.", unit: "ft/round", value: "40" },
    { sourceText: "40 ft.", unit: "ft/round", value: "40" },
    { sourceText: "40 ft.", unit: "ft/round", value: "40" },
    { sourceText: "60 ft.", unit: "ft/round", value: "60" },
    { sourceText: "40 ft.", unit: "ft/round", value: "40" },
    { sourceText: "40 ft.", unit: "ft/round", value: "40" },
    { sourceText: "60 ft.", unit: "ft/round", value: "60" },
  ]);
  assert.deepEqual(records.map(record => record.carryingCapacity), [
    { sourceText: "480 lb.", pounds: 480 }, { sourceText: "420 lb.", pounds: 420 },
    { sourceText: "1,320 lb.", pounds: 1320 }, { sourceText: "540 lb.", pounds: 540 },
    { sourceText: "480 lb.", pounds: 480 }, { sourceText: "195 lb.", pounds: 195 },
    { sourceText: "225 lb.", pounds: 225 }, { sourceText: "540 lb.", pounds: 540 },
  ]);
  assert.equal(records.every(record => !("weight" in record)), true);
  assert.equal(records.filter(record => record.name === "Donkey or mule").length, 1);
  const expansions = checkedInventory.helperDispositions.filter(item =>
    item.disposition === "expanded-primary-occurrences"
    && item.canonicalId === "srd51:equipment:mounts-other-animals:2");
  assert.deepEqual(expansions.map(item => [item.helperIndex, item.helperName]),
    [["donkey", "Donkey"], ["mule", "Mule"]]);
  assert.equal(expansions.every(item => item.sourceText === "Donkey or mule"
    && item.canonicalId === "srd51:equipment:mounts-other-animals:2"
    && item.sourceOccurrenceIds.join() === item.canonicalId), true);
  assert.match(records[0].description[0].text, /base carrying capacity/);

  const missingCanonical = structuredClone(checkedInventory);
  missingCanonical.helperDispositions.find(item => item.helperIndex === "donkey").canonicalId = null;
  assert.throws(() => validateTranscriptData(checkedTranscript, missingCanonical, { allowIncomplete: true }),
    /kanonische Primär-ID/);
  const mismatchedSpeed = structuredClone(checkedTranscript);
  mismatchedSpeed.records.find(record => record.name === "Camel").speed.value = "40";
  assert.throws(() => validateTranscriptData(mismatchedSpeed, checkedInventory, { allowIncomplete: true }),
    /speed stimmt nicht/);
  const mismatchedCapacity = structuredClone(checkedTranscript);
  mismatchedCapacity.records.find(record => record.name === "Elephant").carryingCapacity.pounds = 132;
  assert.throws(() => validateTranscriptData(mismatchedCapacity, checkedInventory, { allowIncomplete: true }),
    /carryingCapacity\.pounds stimmt nicht/);
});

test("tack and drawn vehicles preserve formulas, missing weight and sourced Barding expansions", async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL("items-srd51-inventory.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("items-srd51-transcript.json", dataRoot), "utf8").then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(item => item.sectionId === "tack-harness-drawn-vehicles");
  const records = checkedTranscript.records.filter(record =>
    record.id.includes(":tack-harness-drawn-vehicles:"));
  assert.deepEqual(occurrences.map(item => item.sourceLabel), [
    "Barding", "Bit and bridle", "Carriage", "Cart", "Chariot", "Feed (per day)", "Exotic", "Military",
    "Pack", "Riding", "Saddlebags", "Sled", "Stabling (per day)", "Wagon",
  ]);
  assert.deepEqual(occurrences.map(item => item.id),
    Array.from({ length: 14 }, (_, index) => `srd51:equipment:tack-harness-drawn-vehicles:${index + 1}`));
  assert.deepEqual(records.map(record => record.id), occurrences.map(item => item.id));
  assert.deepEqual(records.map(record => record.name), [
    "Barding", "Bit and bridle", "Carriage", "Cart", "Chariot", "Feed (per day)", "Saddle, Exotic",
    "Saddle, Military", "Saddle, Pack", "Saddle, Riding", "Saddlebags", "Sled", "Stabling (per day)", "Wagon",
  ]);
  assert.deepEqual(records.map(record => record.cost.sourceText),
    ["×4", "2 gp", "100 gp", "15 gp", "250 gp", "5 cp", "60 gp", "20 gp", "5 gp", "10 gp", "4 gp",
      "20 gp", "5 sp", "35 gp"]);
  assert.deepEqual(records.map(record => record.weight.sourceText),
    ["×2", "1 lb.", "600 lb.", "200 lb.", "100 lb.", "10 lb.", "40 lb.", "30 lb.", "15 lb.",
      "25 lb.", "8 lb.", "300 lb.", "—", "400 lb."]);
  const byName = new Map(records.map(record => [record.name, record]));
  assert.equal("copperPieces" in byName.get("Barding").cost, false);
  assert.equal("pounds" in byName.get("Barding").weight, false);
  assert.equal("pounds" in byName.get("Stabling (per day)").weight, false);
  assert.deepEqual(byName.get("Saddle, Exotic").weight, { sourceText: "40 lb.", pounds: "40" });
  assert.match(byName.get("Barding").description[0].text, /cost is four times.*weighs twice/);
  assert.match(byName.get("Saddle, Military").description[0].text, /advantage.*remain mounted/);
  assert.match(byName.get("Saddle, Exotic").description[0].text, /aquatic or flying mount/);
  assert.equal(["Carriage", "Cart", "Chariot", "Sled", "Wagon"].every(name =>
    byName.get(name).description[0].text.startsWith("If you have proficiency with a certain kind of vehicle")), true);

  const bardingId = "srd51:equipment:tack-harness-drawn-vehicles:1";
  const barding = checkedInventory.helperDispositions.filter(item =>
    item.disposition === "expanded-primary-occurrences" && item.canonicalId === bardingId);
  assert.deepEqual(barding.map(item => item.helperIndex), [
    "barding-padded", "barding-leather", "barding-studded-leather", "barding-hide", "barding-chain-shirt",
    "barding-scale-mail", "barding-breastplate", "barding-half-plate", "barding-ring-mail",
    "barding-chain-mail", "barding-splint", "barding-plate",
  ]);
  assert.equal(barding.every((item, index) => item.sourceText === "Barding"
    && item.sourceOccurrenceIds[0] === bardingId
    && item.sourceOccurrenceIds[1] === `srd51:equipment:armor:${index + 1}`), true);

  const missingCanonicalSource = structuredClone(checkedInventory);
  missingCanonicalSource.helperDispositions.find(item => item.helperIndex === "barding-padded")
    .sourceOccurrenceIds = ["srd51:equipment:armor:1"];
  assert.throws(() => validateTranscriptData(checkedTranscript, missingCanonicalSource, { allowIncomplete: true }),
    /kanonische Primär-ID belegen/);
  const inventedFormula = structuredClone(checkedTranscript);
  inventedFormula.records.find(record => record.name === "Barding").cost.copperPieces = 400;
  assert.throws(() => validateTranscriptData(inventedFormula, checkedInventory, { allowIncomplete: true }),
    /cost ist nicht eindeutig umrechenbar/);
});
