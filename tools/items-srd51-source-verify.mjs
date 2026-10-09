import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = resolve(root, "src/features/catalog/data");
const paths = Object.freeze({
  attribution: resolve(root, "src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md"),
  inventory: resolve(dataRoot, "items-srd51-inventory.json"),
  manifest: resolve(dataRoot, "items-srd51-source-manifest.json"),
  schema: resolve(dataRoot, "items-srd51-schema-v1.json"),
  transcript: resolve(dataRoot, "items-srd51-transcript.json"),
});

export const OFFICIAL_PDF_SHA256 = "2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0";
export const PINNED_HELPER_COMMIT = "3f5593ea004c4f5a2af95603087ce4de72689d9f";
export const OFFICIAL_ATTRIBUTION = `This work includes material taken from the System Reference Document 5.1
("SRD 5.1") by Wizards of the Coast LLC and available at
https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is
licensed under the Creative Commons Attribution 4.0 International License
available at https://creativecommons.org/licenses/by/4.0/legalcode.`;

const rarityValues = new Set(["common", "uncommon", "rare", "very-rare", "legendary", "artifact"]);
const attunementValues = new Set(["required", "not-required", "unspecified"]);
const occurrencePattern = /^srd51:(equipment|magic-item):[a-z0-9-]+:[0-9]+$/;

export function normalizePdfText(value) {
  return value.normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[\u00a0\u2000-\u200b\u202f\u2060]/g, " ")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} muss ein Objekt sein.`);
  return value;
}

function nonEmpty(value, label) {
  invariant(typeof value === "string" && value.length > 0 && value === value.normalize("NFC"),
    `${label} muss ein nichtleerer NFC-String sein.`);
}

function validateRarity(rarity, label) {
  object(rarity, label);
  if (rarity.kind === "fixed") {
    invariant(rarityValues.has(rarity.value), `${label}.value ist ungültig.`);
    return;
  }
  invariant(rarity.kind === "varies", `${label}.kind ist ungültig.`);
  nonEmpty(rarity.sourceText, `${label}.sourceText`);
  invariant(Array.isArray(rarity.choices), `${label}.choices muss eine Liste sein.`);
  const ids = new Set();
  for (const [index, choice] of rarity.choices.entries()) {
    object(choice, `${label}.choices[${index}]`);
    nonEmpty(choice.variantId, `${label}.choices[${index}].variantId`);
    invariant(choice.variantId === `${choice.occurrenceId}#variant:${index + 1}`,
      `${label}.choices[${index}] hat keine ordinale Variant-ID.`);
    invariant(!ids.has(choice.variantId), `${label} enthält eine doppelte Variant-ID.`);
    ids.add(choice.variantId);
    nonEmpty(choice.label, `${label}.choices[${index}].label`);
    invariant(rarityValues.has(choice.value), `${label}.choices[${index}].value ist ungültig.`);
    invariant(occurrencePattern.test(choice.occurrenceId), `${label}.choices[${index}].occurrenceId ist ungültig.`);
  }
}

export function validateTranscriptData(transcript, inventory, { allowIncomplete = false } = {}) {
  object(transcript, "Transkript");
  object(inventory, "Inventar");
  invariant(transcript.schemaVersion === 1, "Transkript-Schemaversion ist nicht 1.");
  invariant(inventory.inventoryVersion === 1, "Inventarversion ist nicht 1.");
  invariant(typeof transcript.complete === "boolean" && typeof inventory.complete === "boolean",
    "Vollständigkeitsflags fehlen.");
  if (!allowIncomplete) invariant(transcript.complete && inventory.complete,
    "S01 ist unvollständig; Produktartefakt, Provider und UI bleiben gesperrt.");
  invariant(Array.isArray(inventory.occurrences) && Array.isArray(transcript.records),
    "Inventar und Transkript benötigen Listen.");
  const occurrences = new Map();
  for (const occurrence of inventory.occurrences) {
    object(occurrence, "Occurrence");
    invariant(occurrencePattern.test(occurrence.id), `Ungültige Occurrence-ID ${occurrence.id}.`);
    invariant(!occurrences.has(occurrence.id), `Doppelte Occurrence-ID ${occurrence.id}.`);
    nonEmpty(occurrence.sourceLabel, `${occurrence.id}.sourceLabel`);
    for (const field of ["firstPdfPage", "lastPdfPage", "firstPrintedPage", "lastPrintedPage", "ordinal"])
      invariant(Number.isSafeInteger(occurrence[field]) && occurrence[field] > 0, `${occurrence.id}.${field} ist ungültig.`);
    invariant(occurrence.firstPdfPage <= occurrence.lastPdfPage, `${occurrence.id} hat umgekehrte PDF-Seiten.`);
    invariant(occurrence.firstPrintedPage <= occurrence.lastPrintedPage, `${occurrence.id} hat umgekehrte Druckseiten.`);
    occurrences.set(occurrence.id, occurrence);
  }
  const records = new Set();
  for (const record of transcript.records) {
    object(record, "Record");
    invariant(occurrencePattern.test(record.id), `Ungültige Record-ID ${record.id}.`);
    invariant(!records.has(record.id), `Doppelte Record-ID ${record.id}.`);
    records.add(record.id);
    nonEmpty(record.name, `${record.id}.name`);
    invariant(record.category === "equipment" || record.category === "magic-item", `${record.id}.category ist ungültig.`);
    invariant(typeof record.magic === "boolean", `${record.id}.magic ist ungültig.`);
    invariant(attunementValues.has(record.attunement), `${record.id}.attunement ist ungültig.`);
    if (record.rarity !== undefined) validateRarity(record.rarity, `${record.id}.rarity`);
    invariant(Array.isArray(record.properties) && Array.isArray(record.description), `${record.id} benötigt Textlisten.`);
    object(record.source, `${record.id}.source`);
    invariant(Array.isArray(record.source.occurrenceIds) && record.source.occurrenceIds.length > 0,
      `${record.id} benötigt Quellenerscheinungen.`);
    for (const occurrenceId of record.source.occurrenceIds)
      invariant(occurrences.has(occurrenceId), `${record.id} verweist auf unbekannte Occurrence ${occurrenceId}.`);
    for (const sourced of [...record.properties, ...record.description]) {
      object(sourced, `${record.id}.Textfakt`);
      invariant(occurrences.has(sourced.occurrenceId), `${record.id} hat unbelegte Textfakten.`);
    }
  }
  return Object.freeze({ occurrenceCount: occurrences.size, recordCount: records.size, complete: transcript.complete });
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyItemsSourcePackage({ pdfPath, allowIncomplete = false } = {}) {
  const [manifest, inventory, schema, transcript, attribution] = await Promise.all([
    json(paths.manifest), json(paths.inventory), json(paths.schema), json(paths.transcript), readFile(paths.attribution, "utf8"),
  ]);
  invariant(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "Schema ist nicht Draft 2020-12.");
  invariant(schema.properties?.schemaVersion?.const === 1, "Schema v1 ist nicht gebunden.");
  invariant(manifest.extractionHelper?.commit === PINNED_HELPER_COMMIT,
    "Extraktionshilfe ist nicht auf den von SaltMarcher belegten Commit fixiert.");
  invariant(manifest.extractionHelper?.equipmentSha256 === "aa5e99e4dad50143467568a3de653d53d1d39c2c2aa6ac74b172f457f6315ac1",
    "Hash der fixierten Equipment-Extraktionshilfe stimmt nicht.");
  invariant(manifest.extractionHelper?.magicItemsSha256 === "9a6f928cbf36b268b02e09dc116995efce8a74380df0450e197117886b64993d",
    "Hash der fixierten Magic-Item-Extraktionshilfe stimmt nicht.");
  invariant(attribution.includes(OFFICIAL_ATTRIBUTION), "Offizieller Attributionstext fehlt oder wurde verändert.");
  invariant((attribution.match(/Wizards of the Coast/g) ?? []).length === 1,
    "Attributionsasset enthält zusätzliche Wizards-Attribution.");
  invariant(manifest.complete === inventory.complete && manifest.complete === transcript.complete,
    "Manifest, Inventar und Transkript widersprechen sich beim Vollständigkeitsstatus.");
  invariant(manifest.coverage.inventoryOccurrences === inventory.occurrences.length,
    "Manifest-Inventarcount stimmt nicht.");
  invariant(manifest.coverage.transcriptRecords === transcript.records.length,
    "Manifest-Transkriptcount stimmt nicht.");
  const validation = validateTranscriptData(transcript, inventory, { allowIncomplete });
  let pdf;
  if (pdfPath) {
    const bytes = await readFile(resolve(pdfPath));
    invariant(sha256(bytes) === OFFICIAL_PDF_SHA256, "Offizieller SRD-5.1-PDF-Hash stimmt nicht.");
    invariant(bytes.length === manifest.source.pdfBytes, "Offizielle SRD-5.1-PDF-Größe stimmt nicht.");
    const info = execFileSync("pdfinfo", [resolve(pdfPath)], { encoding: "utf8" });
    invariant(new RegExp(`^Pages:\\s+${manifest.source.pdfPages}$`, "m").test(info), "PDF-Seitenzahl stimmt nicht.");
    pdf = Object.freeze({ sha256: OFFICIAL_PDF_SHA256, bytes: bytes.length, pages: manifest.source.pdfPages });
  }
  return Object.freeze({
    complete: manifest.complete,
    validation,
    pdf,
    hashes: Object.freeze({
      attribution: sha256(Buffer.from(attribution)),
      inventory: sha256(await readFile(paths.inventory)),
      manifest: sha256(await readFile(paths.manifest)),
      schema: sha256(await readFile(paths.schema)),
      transcript: sha256(await readFile(paths.transcript)),
    }),
    blockers: Object.freeze([...manifest.blockingOpenSections]),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pdfFlag = process.argv.indexOf("--pdf");
  const result = await verifyItemsSourcePackage({
    pdfPath: pdfFlag >= 0 ? process.argv[pdfFlag + 1] : undefined,
    allowIncomplete: process.argv.includes("--allow-incomplete"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
