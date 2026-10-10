import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { validateArmorArrowsSlice, validateArmorArrowsPdfXml } from "./items-srd51-armor-arrows.mjs";
import { validateBagsSlice, validateBagsPdfXml } from "./items-srd51-bags.mjs";
import { validateBSectionSlice, validateBSectionPdfXml } from "./items-srd51-b-section.mjs";
import { validateCSectionSlice, validateCSectionPdfXml } from "./items-srd51-c-section.mjs";

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
  return value.normalize("NFC")
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/-\u00ad\u2010/g, "-")
    .replace(/-\u2011/g, "-")
    .replace(/—[^\S\r\n]*\r?\n[^\S\r\n]*/g, "—")
    .replace(/\u00ad[^\S\r\n]*\r?\n[^\S\r\n]*/g, "")
    .replace(/[\u00a0\u2000-\u200b\u202f\u2060]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlText(value) {
  return value.replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&").replaceAll("&quot;", "\"").replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

export function extractMagicItemAzHeadingsFromPdfXml(xml) {
  nonEmpty(xml, "Magic-Item-A–Z-XML");
  const fontSizes = new Map([...xml.matchAll(/<fontspec id="(\d+)" size="(\d+)"/g)]
    .map(match => [match[1], Number(match[2])]));
  const nodes = [...xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(match => ({
    font: /\bfont="(\d+)"/.exec(match[1])?.[1],
    bold: /<b>/.test(match[2]),
    italic: /<i>/.test(match[2]),
    text: normalizePdfText(decodeXmlText(match[2])),
  })).filter(node => node.text.length > 0);
  const headings = [];
  for (let index = 0; index < nodes.length;) {
    if (!nodes[index].bold || fontSizes.get(nodes[index].font) !== 18) {
      index += 1;
      continue;
    }
    const lines = [];
    while (index < nodes.length && nodes[index].bold && fontSizes.get(nodes[index].font) === 18) {
      lines.push(nodes[index].text);
      index += 1;
    }
    if (nodes[index]?.italic
      && /^(Armor|Potion|Ring|Rod|Scroll|Staff|Wand|Weapon|Wondrous item)\b/.test(nodes[index].text))
      headings.push(lines.join(" "));
  }
  return Object.freeze(headings);
}

export function extractApparatusLeverCellsFromPdfXml(xml) {
  nonEmpty(xml, "Apparatus-Lever-XML");
  const nodes = [...xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(match => ({
    top: Number(/\btop="(\d+)"/.exec(match[1])?.[1]),
    left: Number(/\bleft="(\d+)"/.exec(match[1])?.[1]),
    font: /\bfont="(\d+)"/.exec(match[1])?.[1],
    text: normalizePdfText(decodeXmlText(match[2])),
  })).filter(node => node.font === "8" && node.text.length > 0);
  const join = selected => normalizePdfText(selected.sort((left, right) => left.top - right.top || left.left - right.left)
    .map(node => node.text).join(" "));
  const joinOrdered = (...selections) => normalizePdfText(selections.map(selected => join(selected)).join(" "));
  const rows = [{
    lever: 1,
    up: joinOrdered(nodes.filter(node => node.left >= 125 && node.left < 280 && node.top >= 1026),
      nodes.filter(node => node.left >= 530 && node.left < 690 && node.top < 174)),
    down: joinOrdered(nodes.filter(node => node.left >= 280 && node.left < 480 && node.top >= 1026),
      nodes.filter(node => node.left >= 690 && node.top < 174)),
  }];
  const starts = nodes.filter(node => node.left >= 490 && node.left < 525
    && node.top >= 174 && node.top < 616 && /^(?:[2-9]|10)$/.test(node.text))
    .sort((left, right) => left.top - right.top);
  invariant(JSON.stringify(starts.map(node => Number(node.text))) === JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10]),
    "Apparatus-Levertabelle muss die physischen Zeilen 2 bis 10 exakt einmal enthalten.");
  for (const [index, start] of starts.entries()) {
    const end = starts[index + 1]?.top ?? 616;
    rows.push({ lever: Number(start.text),
      up: join(nodes.filter(node => node.left >= 530 && node.left < 690
        && node.top >= start.top && node.top < end)),
      down: join(nodes.filter(node => node.left >= 690 && node.top >= start.top && node.top < end)) });
  }
  invariant(rows.every(row => row.up.length > 0 && row.down.length > 0),
    "Apparatus-Levertabelle enthält eine leere Up-/Down-Zelle.");
  return Object.freeze(rows.map(row => Object.freeze(row)));
}

function normalizePdfPageText(value, page) {
  return normalizePdfText(value).replaceAll(`System Reference Document 5.1 ${page}`, "").trim();
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

function isStrictlyAscending(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validateStructuredConversions(record) {
  if (record.cost?.copperPieces !== undefined) {
    const match = /^(\d[\d,]*) (cp|sp|ep|gp|pp)$/.exec(record.cost.sourceText);
    invariant(match, `${record.id}.cost ist nicht eindeutig umrechenbar.`);
    const multipliers = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
    invariant(Number(match[1].replaceAll(",", "")) * multipliers[match[2]] === record.cost.copperPieces,
      `${record.id}.cost.copperPieces stimmt nicht mit dem Quelltext überein.`);
  }
  if (record.weight?.pounds !== undefined) {
    const match = /^(\d[\d,]*|1\/2|1\/4|1½) (?:lb\.|pounds)$/.exec(record.weight.sourceText);
    invariant(match, `${record.id}.weight ist nicht eindeutig in Pfund umrechenbar.`);
    const pounds = match[1] === "1/2" ? "0.5" : match[1] === "1/4" ? "0.25" : match[1] === "1½" ? "1.5"
      : match[1].replaceAll(",", "");
    invariant(pounds === record.weight.pounds, `${record.id}.weight.pounds stimmt nicht mit dem Quelltext überein.`);
  }
  if (record.speed !== undefined) {
    const match = /^(\d[\d,]*|1\/2|1\/4|1½|2½) (ft\.|mph)$/.exec(record.speed.sourceText);
    invariant(match, `${record.id}.speed ist nicht eindeutig umrechenbar.`);
    const values = { "1/2": "0.5", "1/4": "0.25", "1½": "1.5", "2½": "2.5" };
    const value = values[match[1]] ?? match[1].replaceAll(",", "");
    const unit = match[2] === "ft." ? "ft/round" : "mph";
    invariant(record.speed.value === value && record.speed.unit === unit,
      `${record.id}.speed stimmt nicht mit dem Quelltext überein.`);
  }
  if (record.carryingCapacity !== undefined) {
    const match = /^(\d[\d,]*) lb\.$/.exec(record.carryingCapacity.sourceText);
    invariant(match, `${record.id}.carryingCapacity ist nicht eindeutig in Pfund umrechenbar.`);
    invariant(Number(match[1].replaceAll(",", "")) === record.carryingCapacity.pounds,
      `${record.id}.carryingCapacity.pounds stimmt nicht mit dem Quelltext überein.`);
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
  invariant(Array.isArray(inventory.sections), "Inventar benötigt eine Abschnittsliste.");
  invariant(inventory.capturedPrimaryOccurrences === inventory.occurrences.length,
    "Erfasster Inventarcount stimmt nicht.");
  invariant(inventory.expectedPrimaryOccurrences >= inventory.capturedPrimaryOccurrences,
    "Erwarteter Inventarcount ist kleiner als der erfasste Count.");
  const sectionIds = new Set();
  for (const section of inventory.sections) {
    object(section, "Inventarabschnitt");
    nonEmpty(section.id, "Inventarabschnitt.id");
    invariant(!sectionIds.has(section.id), `Doppelter Inventarabschnitt ${section.id}.`);
    sectionIds.add(section.id);
    invariant(section.capturedOccurrences <= section.expectedOccurrences,
      `${section.id} überschreitet den erwarteten Count.`);
    if (section.complete) invariant(section.capturedOccurrences === section.expectedOccurrences,
      `${section.id} ist trotz Countlücke vollständig markiert.`);
  }
  const occurrences = new Map();
  const occurrenceOrder = new Map();
  for (const [occurrenceIndex, occurrence] of inventory.occurrences.entries()) {
    object(occurrence, "Occurrence");
    invariant(occurrencePattern.test(occurrence.id), `Ungültige Occurrence-ID ${occurrence.id}.`);
    invariant(!occurrences.has(occurrence.id), `Doppelte Occurrence-ID ${occurrence.id}.`);
    nonEmpty(occurrence.sourceLabel, `${occurrence.id}.sourceLabel`);
    nonEmpty(occurrence.sourceTable, `${occurrence.id}.sourceTable`);
    invariant(sectionIds.has(occurrence.sectionId), `${occurrence.id} verweist auf unbekannten Abschnitt.`);
    for (const field of ["firstPdfPage", "lastPdfPage", "firstPrintedPage", "lastPrintedPage", "ordinal"])
      invariant(Number.isSafeInteger(occurrence[field]) && occurrence[field] > 0, `${occurrence.id}.${field} ist ungültig.`);
    invariant(occurrence.firstPdfPage <= occurrence.lastPdfPage, `${occurrence.id} hat umgekehrte PDF-Seiten.`);
    invariant(occurrence.firstPrintedPage <= occurrence.lastPrintedPage, `${occurrence.id} hat umgekehrte Druckseiten.`);
    occurrences.set(occurrence.id, occurrence);
    occurrenceOrder.set(occurrence.id, occurrenceIndex);
  }
  for (const section of inventory.sections) {
    const sectionOccurrences = inventory.occurrences.filter(occurrence => occurrence.sectionId === section.id);
    invariant(sectionOccurrences.length === section.capturedOccurrences,
      `${section.id}.capturedOccurrences stimmt nicht mit den Inventarzeilen überein.`);
    if (section.inventoryComplete) {
      invariant(sectionOccurrences.length === section.expectedOccurrences,
        `${section.id} ist trotz Inventarlücke als inventarisiert markiert.`);
      for (const [index, occurrence] of sectionOccurrences.entries()) {
        const ordinal = index + 1;
        invariant(occurrence.ordinal === ordinal, `${section.id} hat keine lückenlose physische Reihenfolge.`);
        invariant(occurrence.id === `srd51:${section.feed}:${section.id}:${ordinal}`,
          `${occurrence.id} stimmt nicht mit Abschnitt und Ordinal überein.`);
      }
    }
  }
  invariant(Array.isArray(inventory.crossReferences), "Inventar benötigt eine Cross-reference-Liste.");
  const crossReferenceIds = new Set();
  for (const [index, reference] of inventory.crossReferences.entries()) {
    object(reference, `Cross-reference[${index}]`);
    nonEmpty(reference.id, `Cross-reference[${index}].id`);
    invariant(!crossReferenceIds.has(reference.id), `Doppelte Cross-reference-ID ${reference.id}.`);
    crossReferenceIds.add(reference.id);
    invariant(reference.sourceKind === "cross-reference", `${reference.id} hat einen ungültigen Quelltyp.`);
    nonEmpty(reference.sourceTable, `${reference.id}.sourceTable`);
    nonEmpty(reference.sourceLabel, `${reference.id}.sourceLabel`);
    nonEmpty(reference.sourceText, `${reference.id}.sourceText`);
    invariant(sectionIds.has(reference.sectionId), `${reference.id} verweist auf unbekannten Quellabschnitt.`);
    invariant(Array.isArray(reference.targetSectionIds) && reference.targetSectionIds.length > 0,
      `${reference.id} benötigt Zielabschnitte.`);
    for (const targetSectionId of reference.targetSectionIds)
      invariant(sectionIds.has(targetSectionId), `${reference.id} verweist auf unbekannten Zielabschnitt ${targetSectionId}.`);
    for (const field of ["firstPdfPage", "lastPdfPage", "firstPrintedPage", "lastPrintedPage"])
      invariant(Number.isSafeInteger(reference[field]) && reference[field] > 0,
        `${reference.id}.${field} ist ungültig.`);
    invariant(reference.firstPdfPage <= reference.lastPdfPage, `${reference.id} hat umgekehrte PDF-Seiten.`);
    invariant(reference.firstPrintedPage <= reference.lastPrintedPage,
      `${reference.id} hat umgekehrte Druckseiten.`);
  }
  invariant(Array.isArray(inventory.helperDispositions), "Inventar benötigt eine Helper-Dispositionliste.");
  const helperIndices = new Set();
  for (const [index, disposition] of inventory.helperDispositions.entries()) {
    object(disposition, `Helper-Disposition[${index}]`);
    nonEmpty(disposition.helperIndex, `Helper-Disposition[${index}].helperIndex`);
    nonEmpty(disposition.helperName, `Helper-Disposition[${index}].helperName`);
    nonEmpty(disposition.sourceText, `Helper-Disposition[${index}].sourceText`);
    invariant(!helperIndices.has(disposition.helperIndex),
      `Doppelte Helper-Disposition ${disposition.helperIndex}.`);
    helperIndices.add(disposition.helperIndex);
    invariant(Array.isArray(disposition.sourceOccurrenceIds) && disposition.sourceOccurrenceIds.length > 0,
      `${disposition.helperIndex} benötigt Quellenerscheinungen.`);
    for (const occurrenceId of disposition.sourceOccurrenceIds)
      invariant(occurrences.has(occurrenceId),
        `${disposition.helperIndex} verweist auf unbekannte Occurrence ${occurrenceId}.`);
    if (disposition.disposition === "pack-prose-only") {
      invariant(disposition.canonicalId === null,
        `${disposition.helperIndex} darf als pack-prose-only keine kanonische Primär-ID erfinden.`);
      invariant(disposition.sourceOccurrenceIds.every(id => occurrences.get(id).sectionId === "equipment-packs"),
        `${disposition.helperIndex} muss als pack-prose-only aus Equipment Packs belegt sein.`);
    } else if (disposition.disposition === "expanded-primary-occurrences") {
      invariant(disposition.canonicalId !== null,
        `${disposition.helperIndex} benötigt als expanded-primary-occurrences eine kanonische Primär-ID.`);
      invariant(disposition.sourceOccurrenceIds.includes(disposition.canonicalId),
        `${disposition.helperIndex} muss als expanded-primary-occurrences seine kanonische Primär-ID belegen.`);
    } else if (disposition.canonicalId !== null) {
      invariant(occurrences.has(disposition.canonicalId),
        `${disposition.helperIndex} verweist auf unbekannte kanonische Occurrence ${disposition.canonicalId}.`);
    }
  }
  const records = new Map();
  for (const record of transcript.records) {
    object(record, "Record");
    invariant(occurrencePattern.test(record.id), `Ungültige Record-ID ${record.id}.`);
    invariant(!records.has(record.id), `Doppelte Record-ID ${record.id}.`);
    records.set(record.id, record);
    nonEmpty(record.name, `${record.id}.name`);
    invariant(record.category === "equipment" || record.category === "magic-item", `${record.id}.category ist ungültig.`);
    invariant(typeof record.magic === "boolean", `${record.id}.magic ist ungültig.`);
    invariant(attunementValues.has(record.attunement), `${record.id}.attunement ist ungültig.`);
    if (record.category === "equipment") {
      invariant(record.magic === false, `${record.id} darf nicht magisch markiert sein.`);
      invariant(record.attunement === "unspecified", `${record.id} darf keine Einstimmungsbehauptung tragen.`);
    } else {
      invariant(record.magic === true, `${record.id} muss magisch markiert sein.`);
    }
    if (record.rarity !== undefined) validateRarity(record.rarity, `${record.id}.rarity`);
    invariant(Array.isArray(record.properties) && Array.isArray(record.description), `${record.id} benötigt Textlisten.`);
    object(record.source, `${record.id}.source`);
    invariant(Array.isArray(record.source.occurrenceIds) && record.source.occurrenceIds.length > 0,
      `${record.id} benötigt Quellenerscheinungen.`);
    invariant(isStrictlyAscending(record.source.pdfPages) && isStrictlyAscending(record.source.printedPages),
      `${record.id} benötigt streng aufsteigende Quellseiten.`);
    for (const occurrenceId of record.source.occurrenceIds)
      invariant(occurrences.has(occurrenceId), `${record.id} verweist auf unbekannte Occurrence ${occurrenceId}.`);
    for (const choice of record.rarity?.choices ?? []) {
      invariant(occurrences.has(choice.occurrenceId), `${record.id} hat eine unbelegte Raritätsvariante.`);
      invariant(record.source.occurrenceIds.includes(choice.occurrenceId),
        `${record.id} hat eine Raritätsvariante außerhalb seiner Quellenliste.`);
    }
    for (const sourced of [record.sourceHeader, ...record.properties, ...record.description].filter(Boolean)) {
      object(sourced, `${record.id}.Textfakt`);
      invariant(occurrences.has(sourced.occurrenceId), `${record.id} hat unbelegte Textfakten.`);
      invariant(record.source.occurrenceIds.includes(sourced.occurrenceId),
        `${record.id} hat einen Textfakt außerhalb seiner Quellenliste.`);
    }
    validateStructuredConversions(record);
  }
  for (const occurrence of inventory.occurrences.filter(candidate => candidate.mergeIntoId !== null)) {
    const target = occurrences.get(occurrence.mergeIntoId);
    invariant(target, `${occurrence.id} verweist auf ein unbekanntes Merge-Ziel ${occurrence.mergeIntoId}.`);
    invariant(occurrenceOrder.get(target.id) < occurrenceOrder.get(occurrence.id),
      `${occurrence.id} muss in die frühere physische Occurrence gemergt werden.`);
    invariant(target.mergeIntoId === null, `${occurrence.id} darf keine Merge-Kette erzeugen.`);
  }
  for (const occurrence of inventory.occurrences.filter(candidate => candidate.mergeIntoId !== null)) {
    const target = occurrences.get(occurrence.mergeIntoId);
    invariant(!records.has(occurrence.id), `${occurrence.id} darf keinen zweiten kanonischen Record erzeugen.`);
    const canonical = records.get(target.id);
    invariant(canonical, `${occurrence.id} benötigt den kanonischen Record ${target.id}.`);
    invariant(canonical.source.occurrenceIds[0] === target.id,
      `${target.id} muss seine erste physische Occurrence als erste Quelle behalten.`);
    invariant(canonical.source.occurrenceIds.includes(occurrence.id),
      `${target.id} muss die gemergte Occurrence ${occurrence.id} als Quelle belegen.`);
  }
  return Object.freeze({ occurrenceCount: occurrences.size, recordCount: records.size, complete: transcript.complete });
}

export function validatePotionHealingMerge(transcript, inventory) {
  const canonicalId = "srd51:equipment:adventuring-gear:76";
  const detailId = "srd51:magic-item:magic-items-a-z:142";
  const occurrences = new Map(inventory.occurrences.map(occurrence => [occurrence.id, occurrence]));
  const records = new Map(transcript.records.map(record => [record.id, record]));
  const canonicalOccurrence = occurrences.get(canonicalId);
  const detailOccurrence = occurrences.get(detailId);
  invariant(canonicalOccurrence?.sourceLabel === "Potion of healing",
    "Potion-of-Healing-Merge benötigt die kanonische Ausrüstungs-Occurrence.");
  invariant(detailOccurrence?.sourceLabel === "Potion of Healing" && detailOccurrence.sourceKind === "detail-heading"
    && detailOccurrence.sourceTable === "Magic Items A–Z" && detailOccurrence.ordinal === 142
    && detailOccurrence.firstPdfPage === 234 && detailOccurrence.lastPdfPage === 234,
  "Potion-of-Healing-Detail muss als A–Z-Heading 142 auf physischer Seite 234 belegt sein.");
  invariant(detailOccurrence.mergeIntoId === canonicalId,
    "Potion-of-Healing-Detail muss explizit in die erste Ausrüstungs-Occurrence mergen.");
  invariant(!records.has(detailId), "Potion-of-Healing-Detail darf keinen doppelten kanonischen Record erzeugen.");
  const record = records.get(canonicalId);
  invariant(record?.category === "magic-item" && record.subcategory === "potion" && record.magic === true,
    "Potion of healing muss ihre kanonische magische Potion-Identität behalten.");
  invariant(record.attunement === "not-required",
    "Der vollständige Potion-of-Healing-Header belegt keine erforderliche Einstimmung.");
  invariant(JSON.stringify(record.source.occurrenceIds) === JSON.stringify([canonicalId, detailId]),
    "Potion of healing muss exakt beide Occurrences in physischer Reihenfolge belegen.");
  invariant(JSON.stringify(record.source.pdfPages) === JSON.stringify([68, 69, 234])
    && JSON.stringify(record.source.printedPages) === JSON.stringify([68, 69, 234]),
  "Potion of healing muss die Ausrüstungs- und Detailseiten getrennt belegen.");
  const expectedChoices = [
    ["Healing", "common"],
    ["Greater healing", "uncommon"],
    ["Superior healing", "rare"],
    ["Supreme healing", "very-rare"],
  ];
  invariant(record.rarity?.kind === "varies" && record.rarity.sourceText === "rarity varies"
    && record.rarity.choices.length === expectedChoices.length,
  "Potion of healing benötigt die belegte variable Rarität mit vier Varianten.");
  for (const [index, [label, value]] of expectedChoices.entries()) {
    const choice = record.rarity.choices[index];
    invariant(choice.variantId === `${detailId}#variant:${index + 1}` && choice.label === label
      && choice.value === value && choice.occurrenceId === detailId,
    `Potion-of-Healing-Variante ${index + 1} widerspricht der Quelltabelle.`);
  }
  const expectedDetailFacts = [
    "You regain hit points when you drink this potion. The number of hit points depends on the potion’s rarity, as shown in the Potions of Healing table. Whatever its potency, the potion’s red liquid glimmers when agitated.",
    "Potions of Healing",
    "Potion of … Rarity HP Regained",
    "Healing Common 2d4 + 2",
    "Greater healing Uncommon 4d4 + 4",
    "Superior healing Rare 8d4 + 8",
    "Supreme healing Very rare 10d4 + 20",
  ];
  const detailFacts = record.description.filter(fact => fact.occurrenceId === detailId).map(fact => fact.text);
  invariant(JSON.stringify(detailFacts) === JSON.stringify(expectedDetailFacts),
    "Potion-of-Healing-Detailprosa oder Heilungszeilen sind unvollständig oder umgeordnet.");
  return Object.freeze({ canonicalId, detailId, mergedRecords: 1, rarityChoices: 4, healingRows: 4 });
}

export function validateMagicItemAzOpeningSlice(transcript, inventory) {
  const expected = [
    { name: "Adamantine Armor", header: "Armor (medium or heavy, but not hide), uncommon",
      subcategory: "armor", rarity: { kind: "fixed", value: "uncommon" },
      attunement: "not-required", description: "This suit of armor is reinforced with adamantine, one of the hardest substances in existence. While you’re wearing it, any critical hit against you becomes a normal hit." },
    { name: "Ammunition, +1, +2, or +3",
      header: "Weapon (any ammunition), uncommon (+1), rare (+2), or very rare (+3)", subcategory: "ammunition",
      rarity: { kind: "varies", sourceText: "uncommon (+1), rare (+2), or very rare (+3)",
        choices: [["+1", "uncommon"], ["+2", "rare"], ["+3", "very-rare"]] },
      attunement: "not-required", description: "You have a bonus to attack and damage rolls made with this piece of magic ammunition. The bonus is determined by the rarity of the ammunition. Once it hits a target, the ammunition is no longer magical." },
    { name: "Amulet of Health", header: "Wondrous item, rare (requires attunement)",
      subcategory: "wondrous-item", rarity: { kind: "fixed", value: "rare" },
      attunement: "required", description: "Your Constitution score is 19 while you wear this amulet. It has no effect on you if your Constitution is already 19 or higher." },
    { name: "Amulet of Proof against Detection and Location",
      header: "Wondrous item, uncommon (requires attunement)", subcategory: "wondrous-item",
      rarity: { kind: "fixed", value: "uncommon" }, attunement: "required",
      description: "While wearing this amulet, you are hidden from divination magic. You can’t be targeted by such magic or perceived through magical scrying sensors." },
    { name: "Amulet of the Planes", header: "Wondrous item, very rare (requires attunement)",
      subcategory: "wondrous-item", rarity: { kind: "fixed", value: "very-rare" },
      attunement: "required", description: "While wearing this amulet, you can use an action to name a location that you are familiar with on another plane of existence. Then make a DC 15 Intelligence check. On a successful check, you cast the plane shift spell. On a failure, you and each creature and object within 15 feet of you travel to a random destination. Roll a d100. On a 1–60, you travel to a random location on the plane you named. On a 61–100, you travel to a randomly determined plane of existence." },
  ];
  const occurrences = new Map(inventory.occurrences.map(item => [item.id, item]));
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const [index, item] of expected.entries()) {
    const ordinal = index + 1;
    const id = `srd51:magic-item:magic-items-a-z:${ordinal}`;
    const occurrence = occurrences.get(id);
    invariant(occurrence?.sourceLabel === item.name && occurrence.ordinal === ordinal
      && occurrence.sourceTable === "Magic Items A–Z" && occurrence.sourceKind === "detail-heading"
      && occurrence.firstPdfPage === 207 && occurrence.lastPdfPage === 207
      && occurrence.firstPrintedPage === 207 && occurrence.lastPrintedPage === 207
      && occurrence.mergeIntoId === null,
    `Magic-Items-A–Z-Occurrence ${ordinal} ist nicht exakt als Seite-207-Heading belegt.`);
    const record = records.get(id);
    invariant(record?.name === item.name && record.category === "magic-item" && record.magic === true
      && record.subcategory === item.subcategory && record.attunement === item.attunement
      && record.sourceHeader?.text === item.header && record.sourceHeader.occurrenceId === id
      && JSON.stringify(record.source.pdfPages) === "[207]"
      && JSON.stringify(record.source.printedPages) === "[207]"
      && JSON.stringify(record.source.occurrenceIds) === JSON.stringify([id])
      && record.description.length === 1 && record.description[0].occurrenceId === id
      && record.description[0].text === item.description,
    `Magic-Items-A–Z-Record ${ordinal} ist unvollständig oder nicht quellengetreu.`);
    if (item.rarity.kind === "fixed") {
      invariant(record.rarity?.kind === "fixed" && record.rarity.value === item.rarity.value,
        `Magic-Items-A–Z-Record ${ordinal} hat nicht die belegte feste Rarität.`);
    } else {
      invariant(record.rarity?.kind === "varies" && record.rarity.sourceText === item.rarity.sourceText
        && record.rarity.choices.length === item.rarity.choices.length,
      `Magic-Items-A–Z-Record ${ordinal} hat nicht die belegte variable Rarität.`);
      for (const [choiceIndex, [label, value]] of item.rarity.choices.entries()) {
        const choice = record.rarity.choices[choiceIndex];
        invariant(choice.variantId === `${id}#variant:${choiceIndex + 1}` && choice.label === label
          && choice.value === value && choice.occurrenceId === id,
        `Magic-Items-A–Z-Record ${ordinal}, Variante ${choiceIndex + 1}, widerspricht dem Header.`);
      }
    }
  }
  return Object.freeze({ capturedRecords: 5, physicalPdfPage: 207, fixedRarities: 4,
    variableRarityChoices: 3, attunementRequired: 3, attunementNotRequired: 2 });
}

export function validateMagicItemAzAnimatedShield(transcript, inventory) {
  const id = "srd51:magic-item:magic-items-a-z:6";
  const occurrence = inventory.occurrences.find(item => item.id === id);
  invariant(occurrence?.sourceLabel === "Animated Shield" && occurrence.ordinal === 6
    && occurrence.sourceTable === "Magic Items A–Z" && occurrence.sourceKind === "detail-heading"
    && occurrence.firstPdfPage === 208 && occurrence.lastPdfPage === 208
    && occurrence.firstPrintedPage === 208 && occurrence.lastPrintedPage === 208
    && occurrence.variantId === null && occurrence.mergeIntoId === null,
  "Animated-Shield-Occurrence 6 ist nicht exakt als Seite-208-Heading belegt.");
  const record = transcript.records.find(item => item.id === id);
  invariant(record?.name === "Animated Shield" && record.category === "magic-item"
    && record.subcategory === "shield" && record.magic === true
    && record.rarity?.kind === "fixed" && record.rarity.value === "very-rare"
    && record.attunement === "required"
    && record.sourceHeader?.text === "Armor (shield), very rare (requires attunement)"
    && record.sourceHeader.occurrenceId === id
    && record.properties.length === 0
    && record.description.length === 1 && record.description[0].occurrenceId === id
    && record.description[0].text === "While holding this shield, you can speak its command word as a bonus action to cause it to animate. The shield leaps into the air and hovers in your space to protect you as if you were wielding it, leaving your hands free. The shield remains animated for 1 minute, until you use a bonus action to end this effect, or until you are incapacitated or die, at which point the shield falls to the ground or into your hand if you have one free."
    && JSON.stringify(record.source.pdfPages) === "[208]"
    && JSON.stringify(record.source.printedPages) === "[208]"
    && JSON.stringify(record.source.occurrenceIds) === JSON.stringify([id]),
  "Animated-Shield-Record ist unvollständig oder nicht quellengetreu.");
  return Object.freeze({ id, ordinal: 6, physicalPdfPage: 208,
    rarity: "very-rare", attunement: "required" });
}

export function validateMagicItemAzApparatusOfTheCrab(transcript, inventory) {
  const id = "srd51:magic-item:magic-items-a-z:7";
  const occurrence = inventory.occurrences.find(item => item.id === id);
  invariant(occurrence?.sourceLabel === "Apparatus of the Crab" && occurrence.ordinal === 7
    && occurrence.sourceTable === "Magic Items A–Z" && occurrence.sourceKind === "detail-heading"
    && occurrence.firstPdfPage === 208 && occurrence.lastPdfPage === 208
    && occurrence.firstPrintedPage === 208 && occurrence.lastPrintedPage === 208
    && occurrence.variantId === null && occurrence.mergeIntoId === null,
  "Apparatus-of-the-Crab-Occurrence 7 ist nicht exakt als Seite-208-Heading belegt.");
  const description = [
    "This item first appears to be a Large sealed iron barrel weighing 500 pounds. The barrel has a hidden catch, which can be found with a successful DC 20 Intelligence (Investigation) check. Releasing the catch unlocks a hatch at one end of the barrel, allowing two Medium or smaller creatures to crawl inside. Ten levers are set in a row at the far end, each in a neutral position, able to move either up or down. When certain levers are used, the apparatus transforms to resemble a giant lobster.",
    "The apparatus of the Crab is a Large object with the following statistics:",
    "Armor Class: 20",
    "Hit Points: 200",
    "Speed: 30 ft., swim 30 ft. (or 0 ft. for both if the legs and tail aren’t extended)",
    "Damage Immunities: poison, psychic",
    "To be used as a vehicle, the apparatus requires one pilot. While the apparatus’s hatch is closed, the compartment is airtight and watertight. The compartment holds enough air for 10 hours of breathing, divided by the number of breathing creatures inside.",
    "The apparatus floats on water. It can also go underwater to a depth of 900 feet. Below that, the vehicle takes 2d6 bludgeoning damage per minute from pressure.",
    "A creature in the compartment can use an action to move as many as two of the apparatus’s levers up or down. After each use, a lever goes back to its neutral position. Each lever, from left to right, functions as shown in the Apparatus of the Crab Levers table.",
    "Apparatus of the Crab Levers",
    "Lever Up Down",
  ];
  const levers = [
    ["Legs and tail extend, allowing the apparatus to walk and swim.", "Legs and tail retract, reducing the apparatus’s speed to 0 and making it unable to benefit from bonuses to speed."],
    ["Forward window shutter opens.", "Forward window shutter closes."],
    ["Side window shutters open (two per side).", "Side window shutters close (two per side)."],
    ["Two claws extend from the front sides of the apparatus.", "The claws retract."],
    ["Each extended claw makes the following melee weapon attack: +8 to hit, reach 5 ft., one target. Hit: 7 (2d6) bludgeoning damage.", "Each extended claw makes the following melee weapon attack: +8 to hit, reach 5 ft., one target. Hit: The target is grappled (escape DC 15)."],
    ["The apparatus walks or swims forward.", "The apparatus walks or swims backward."],
    ["The apparatus turns 90 degrees left.", "The apparatus turns 90 degrees right."],
    ["Eyelike fixtures emit bright light in a 30-foot radius and dim light for an additional 30 feet.", "The light turns off."],
    ["The apparatus sinks as much as 20 feet in liquid.", "The apparatus rises up to 20 feet in liquid."],
    ["The rear hatch unseals and opens.", "The rear hatch closes and seals."],
  ];
  const record = transcript.records.find(item => item.id === id);
  invariant(record?.name === "Apparatus of the Crab" && record.category === "magic-item"
    && record.subcategory === "wondrous-item" && record.magic === true
    && record.rarity?.kind === "fixed" && record.rarity.value === "legendary"
    && record.attunement === "not-required"
    && record.sourceHeader?.text === "Wondrous item, legendary"
    && record.sourceHeader.occurrenceId === id
    && JSON.stringify(record.description.map(fact => fact.text)) === JSON.stringify(description)
    && record.description.every(fact => fact.occurrenceId === id)
    && JSON.stringify(record.source.pdfPages) === "[208]"
    && JSON.stringify(record.source.printedPages) === "[208]"
    && JSON.stringify(record.source.occurrenceIds) === JSON.stringify([id]),
  "Apparatus-of-the-Crab-Record ist unvollständig oder nicht quellengetreu.");
  const expectedProperties = levers.flatMap((cells, rowIndex) => cells.map((cell, cellIndex) => ({
    name: `Lever ${rowIndex + 1} — ${cellIndex === 0 ? "Up" : "Down"}`,
    description: cell,
    occurrenceId: id,
  })));
  invariant(JSON.stringify(record.properties) === JSON.stringify(expectedProperties),
    "Apparatus-of-the-Crab-Levertabelle ist unvollständig, umgeordnet oder nicht quellengetreu.");
  return Object.freeze({ id, ordinal: 7, physicalPdfPage: 208, rarity: "legendary",
    attunement: "not-required", descriptionFacts: description.length, leverRows: levers.length,
    leverCells: expectedProperties.length });
}

export function validateMagicItemAzArmorPlusOneTwoThree(transcript, inventory) {
  const id = "srd51:magic-item:magic-items-a-z:8";
  const occurrence = inventory.occurrences.find(item => item.id === id);
  invariant(occurrence?.sourceLabel === "Armor, +1, +2, or +3" && occurrence.ordinal === 8
    && occurrence.sourceTable === "Magic Items A–Z" && occurrence.sourceKind === "detail-heading"
    && occurrence.firstPdfPage === 208 && occurrence.lastPdfPage === 208
    && occurrence.firstPrintedPage === 208 && occurrence.lastPrintedPage === 208
    && occurrence.variantId === null && occurrence.mergeIntoId === null,
  "Armor-Plus-1-2-3-Occurrence 8 ist nicht exakt als Seite-208-Heading belegt.");
  const header = "Armor (light, medium, or heavy), rare (+1), very rare (+2), or legendary (+3)";
  const description = "You have a bonus to AC while wearing this armor. The bonus is determined by its rarity.";
  const choices = [["+1", "rare"], ["+2", "very-rare"], ["+3", "legendary"]];
  const record = transcript.records.find(item => item.id === id);
  invariant(record?.name === "Armor, +1, +2, or +3" && record.category === "magic-item"
    && record.subcategory === "armor" && record.magic === true
    && record.rarity?.kind === "varies"
    && record.rarity.sourceText === "rare (+1), very rare (+2), or legendary (+3)"
    && record.rarity.choices.length === choices.length
    && record.attunement === "not-required"
    && record.sourceHeader?.text === header && record.sourceHeader.occurrenceId === id
    && record.properties.length === 0
    && record.description.length === 1 && record.description[0].occurrenceId === id
    && record.description[0].text === description
    && JSON.stringify(record.source.pdfPages) === "[208]"
    && JSON.stringify(record.source.printedPages) === "[208]"
    && JSON.stringify(record.source.occurrenceIds) === JSON.stringify([id]),
  "Armor-Plus-1-2-3-Record ist unvollständig oder nicht quellengetreu.");
  for (const [index, [label, value]] of choices.entries()) {
    const choice = record.rarity.choices[index];
    invariant(choice.variantId === `${id}#variant:${index + 1}` && choice.label === label
      && choice.value === value && choice.occurrenceId === id,
    `Armor-Plus-1-2-3-Variante ${index + 1} widerspricht dem Quellenheader.`);
  }
  return Object.freeze({ id, ordinal: 8, physicalPdfPage: 208, attunement: "not-required",
    variableRarityChoices: choices.length, descriptionFacts: 1 });
}

export function validateMagicItemAzArmorOfInvulnerability(transcript, inventory) {
  const id = "srd51:magic-item:magic-items-a-z:9";
  const occurrence = inventory.occurrences.find(item => item.id === id);
  invariant(occurrence?.sourceLabel === "Armor of Invulnerability" && occurrence.ordinal === 9
    && occurrence.sourceTable === "Magic Items A–Z" && occurrence.sourceKind === "detail-heading"
    && occurrence.firstPdfPage === 208 && occurrence.lastPdfPage === 208
    && occurrence.firstPrintedPage === 208 && occurrence.lastPrintedPage === 208
    && occurrence.variantId === null && occurrence.mergeIntoId === null,
  "Armor-of-Invulnerability-Occurrence 9 ist nicht exakt als Seite-208-Heading belegt.");
  const header = "Armor (plate), legendary (requires attunement)";
  const description = "You have resistance to nonmagical damage while you wear this armor. Additionally, you can use an action to make yourself immune to nonmagical damage for 10 minutes or until you are no longer wearing the armor. Once this special action is used, it can’t be used again until the next dawn.";
  const record = transcript.records.find(item => item.id === id);
  invariant(record?.name === "Armor of Invulnerability" && record.category === "magic-item"
    && record.subcategory === "armor" && record.magic === true
    && record.rarity?.kind === "fixed" && record.rarity.value === "legendary"
    && record.attunement === "required"
    && record.sourceHeader?.text === header && record.sourceHeader.occurrenceId === id
    && record.properties.length === 0
    && record.description.length === 1 && record.description[0].occurrenceId === id
    && record.description[0].text === description
    && JSON.stringify(record.source.pdfPages) === "[208]"
    && JSON.stringify(record.source.printedPages) === "[208]"
    && JSON.stringify(record.source.occurrenceIds) === JSON.stringify([id]),
  "Armor-of-Invulnerability-Record ist unvollständig oder nicht quellengetreu.");
  return Object.freeze({ id, ordinal: 9, physicalPdfPage: 208, rarity: "legendary",
    attunement: "required", descriptionFacts: 1 });
}

function formatAjvErrors(errors) {
  return [...(errors ?? [])]
    .sort((left, right) => [left.instancePath, left.schemaPath, left.keyword, left.message]
      .join("\u0000").localeCompare([right.instancePath, right.schemaPath, right.keyword, right.message].join("\u0000")))
    .map(error => `${error.instancePath || "/"} ${error.message} (${error.schemaPath})`)
    .join("; ");
}

export function validateJsonSchemas(schema, transcript, inventory) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true, unicodeRegExp: true,
    allowUnionTypes: false });
  invariant(ajv.validateSchema(schema), `JSON Schema ist ungültig: ${formatAjvErrors(ajv.errors)}`);
  ajv.addSchema(schema);
  const validateTranscript = ajv.getSchema(schema.$id);
  invariant(validateTranscript(transcript), `Transkript verletzt JSON Schema: ${formatAjvErrors(validateTranscript.errors)}`);
  const validateInventory = ajv.compile({ $ref: `${schema.$id}#/$defs/inventory` });
  invariant(validateInventory(inventory), `Inventar verletzt JSON Schema: ${formatAjvErrors(validateInventory.errors)}`);
}

function extractPdfPage(pdfPath, page, layout = false) {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), layout ? "-layout" : "-raw",
    resolve(pdfPath), "-"],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
}

export function validateBoundedArmorTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Armor-Tabellenzeilen");
  const occurrences = inventory.occurrences.filter(occurrence => occurrence.sectionId === "armor");
  invariant(occurrences.length === 13, "Bounded Armor-Prüfung benötigt exakt 13 Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Armor-Prüfung fehlt.`);
    invariant(record.cost && record.armor && record.weight,
      `${occurrence.id}: strukturierte Armor-Tabellenzellen fehlen.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.armor.armorClassText,
      record.armor.strengthRequirementText ?? "—",
      record.armor.stealthRuleText ?? "—",
      record.weight.sourceText,
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = lines.map(normalizePdfText).filter(line => line === expected).length;
    invariant(matches === 1,
      `${occurrence.id}: erwartete Armor-Zellen stehen nicht exakt einmal in derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-with-source-missing-markers" });
}

function verifyPdfArmorTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "armor")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedArmorTableRows(pageLines, transcript, inventory);
}

function weaponPropertiesSourceText(properties) {
  if (properties.length === 0) return "—";
  return properties.map((property, index) => {
    const name = index === 0 ? property.name : `${property.name[0].toLowerCase()}${property.name.slice(1)}`;
    return property.description === undefined ? name : `${name} (${property.description})`;
  }).join(", ");
}

export function validateBoundedWeaponTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Weapons-Tabellenzeilen");
  const occurrences = inventory.occurrences.filter(occurrence => occurrence.sectionId === "weapons");
  invariant(occurrences.length === 37, "Bounded Weapons-Prüfung benötigt exakt 37 Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Weapons-Prüfung fehlt.`);
    invariant(record.cost && Array.isArray(record.properties),
      `${occurrence.id}: strukturierte Weapons-Tabellenzellen fehlen.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.damage ? `${record.damage.diceText} ${record.damage.typeText}` : "—",
      record.weight?.sourceText ?? "—",
      weaponPropertiesSourceText(record.properties),
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = lines.map(normalizePdfText).filter(line => line === expected).length;
    invariant(matches === 1,
      `${occurrence.id}: erwartete Weapons-Zellen stehen nicht exakt einmal in derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-with-source-missing-markers-and-ordered-properties" });
}

function verifyPdfWeaponTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "weapons")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedWeaponTableRows(pageLines, transcript, inventory);
}

function countExactNormalizedLineSegments(lines, expected) {
  const needle = ` ${expected} `;
  return lines.reduce((count, line) => {
    const haystack = ` ${normalizePdfText(line)} `;
    let matches = 0;
    let offset = 0;
    while (offset <= haystack.length - needle.length) {
      const match = haystack.indexOf(needle, offset);
      if (match < 0) break;
      matches += 1;
      offset = match + 1;
    }
    return count + matches;
  }, 0);
}

export function validateBoundedAdventuringGearTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Adventuring-Gear-Tabellenzeilen");
  const occurrences = inventory.occurrences.filter(occurrence => occurrence.sectionId === "adventuring-gear");
  invariant(occurrences.length === 99,
    "Bounded Adventuring-Gear-Prüfung benötigt exakt 99 Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Adventuring-Gear-Prüfung fehlt.`);
    invariant(record.cost, `${occurrence.id}: strukturierte Adventuring-Gear-Kostenzelle fehlt.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.weight?.sourceText ?? "—",
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = countExactNormalizedLineSegments(lines, expected);
    invariant(matches === 1,
      `${occurrence.id}: erwartete Adventuring-Gear-Zellen stehen nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-segment-for-two-column-table-with-source-missing-markers" });
}

function verifyPdfAdventuringGearTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "adventuring-gear")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedAdventuringGearTableRows(pageLines, transcript, inventory);
}

export function validateBoundedToolsTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Tools-Tabellenzeilen");
  const occurrences = inventory.occurrences.filter(occurrence => occurrence.sectionId === "tools");
  invariant(occurrences.length === 35, "Bounded Tools-Prüfung benötigt exakt 35 Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Tools-Prüfung fehlt.`);
    invariant(record.cost, `${occurrence.id}: strukturierte Tools-Kostenzelle fehlt.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.weight?.sourceText ?? "—",
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = countExactNormalizedLineSegments(lines, expected);
    invariant(matches === 1,
      `${occurrence.id}: erwartete Tools-Zellen stehen nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-segment-with-source-missing-markers" });
}

function verifyPdfToolsTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "tools")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedToolsTableRows(pageLines, transcript, inventory);
}

export function validateBoundedMountsTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Mounts-and-Other-Animals-Tabellenzeilen");
  const occurrences = inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "mounts-other-animals");
  invariant(occurrences.length === 8,
    "Bounded Mounts-and-Other-Animals-Prüfung benötigt exakt acht Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Mounts-and-Other-Animals-Prüfung fehlt.`);
    invariant(record.cost && record.speed && record.carryingCapacity,
      `${occurrence.id}: strukturierte Mounts-and-Other-Animals-Tabellenzellen fehlen.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.speed.sourceText,
      record.carryingCapacity.sourceText,
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = countExactNormalizedLineSegments(lines, expected);
    invariant(matches === 1,
      `${occurrence.id}: erwartete Mounts-and-Other-Animals-Zellen stehen nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-segment-across-split-table-pages" });
}

function verifyPdfMountsTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "mounts-other-animals")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedMountsTableRows(pageLines, transcript, inventory);
}

export function validateBoundedTackTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Tack-Harness-and-Drawn-Vehicles-Tabellenzeilen");
  const occurrences = inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "tack-harness-drawn-vehicles");
  invariant(occurrences.length === 14,
    "Bounded Tack-Harness-and-Drawn-Vehicles-Prüfung benötigt exakt 14 Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Tack-Harness-and-Drawn-Vehicles-Prüfung fehlt.`);
    invariant(record.cost && record.weight,
      `${occurrence.id}: strukturierte Tack-Harness-and-Drawn-Vehicles-Tabellenzellen fehlen.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.weight.sourceText,
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = countExactNormalizedLineSegments(lines, expected);
    invariant(matches === 1,
      `${occurrence.id}: erwartete Tack-Harness-and-Drawn-Vehicles-Zellen stehen nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-segment-with-formula-and-source-missing-marker" });
}

function verifyPdfTackTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "tack-harness-drawn-vehicles")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedTackTableRows(pageLines, transcript, inventory);
}

export function validateBoundedWaterborneTableRows(pageLines, transcript, inventory) {
  object(pageLines, "Waterborne-Vehicles-Tabellenzeilen");
  const occurrences = inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "waterborne-vehicles");
  invariant(occurrences.length === 6,
    "Bounded Waterborne-Vehicles-Prüfung benötigt exakt sechs Inventarzeilen.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (const occurrence of occurrences) {
    const record = records.get(occurrence.id);
    invariant(record, `${occurrence.id}: Record für bounded Waterborne-Vehicles-Prüfung fehlt.`);
    invariant(record.cost && record.speed,
      `${occurrence.id}: strukturierte Waterborne-Vehicles-Tabellenzellen fehlen.`);
    const expected = normalizePdfText([
      occurrence.sourceLabel,
      record.cost.sourceText,
      record.speed.sourceText,
    ].join(" "));
    const lines = pageLines[String(occurrence.firstPdfPage)];
    invariant(Array.isArray(lines), `${occurrence.id}: Layoutzeilen für PDF-Seite ${occurrence.firstPdfPage} fehlen.`);
    const matches = countExactNormalizedLineSegments(lines, expected);
    invariant(matches === 1,
      `${occurrence.id}: erwartete Waterborne-Vehicles-Zellen stehen nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile.`);
  }
  return Object.freeze({ checkedRows: occurrences.length,
    scope: "exact-normalized-pdftotext-layout-row-segment-with-fractional-source-speeds" });
}

function verifyPdfWaterborneTableRows(pdfPath, transcript, inventory) {
  const pages = [...new Set(inventory.occurrences
    .filter(occurrence => occurrence.sectionId === "waterborne-vehicles")
    .map(occurrence => occurrence.firstPdfPage))];
  const pageLines = Object.fromEntries(pages.map(page => [String(page),
    extractPdfPage(pdfPath, page, true).split(/\r?\n/).filter(line => line.trim().length > 0)]));
  return validateBoundedWaterborneTableRows(pageLines, transcript, inventory);
}

function verifyPdfOccurrences(pdfPath, inventory) {
  const pageText = new Map();
  for (const occurrence of inventory.occurrences) {
    const pages = [];
    for (let page = occurrence.firstPdfPage; page <= occurrence.lastPdfPage; page += 1) pages.push(page);
    const text = pages.map(page => {
      if (!pageText.has(page)) pageText.set(page, normalizePdfPageText(extractPdfPage(pdfPath, page), page));
      return pageText.get(page);
    }).join(" ");
    invariant(text.includes(normalizePdfText(occurrence.sourceLabel)),
      `${occurrence.id} (${occurrence.sourceLabel}) fehlt auf den belegten PDF-Seiten.`);
  }
  return Object.freeze({ checkedOccurrences: inventory.occurrences.length, extractor: "pdftotext -raw" });
}

function verifyPdfTranscriptFacts(pdfPath, transcript) {
  const pageText = new Map();
  let checkedFacts = 0;
  for (const record of transcript.records) {
    const text = record.source.pdfPages.map(page => {
      if (!pageText.has(page)) pageText.set(page, normalizePdfPageText(extractPdfPage(pdfPath, page), page));
      return pageText.get(page);
    }).join(" ");
    const facts = [record.sourceHeader?.text, record.cost?.sourceText, record.weight?.sourceText, record.speed?.sourceText,
      record.carryingCapacity?.sourceText, record.damage?.diceText,
      record.damage?.typeText, record.damage?.versatileDiceText, record.armor?.armorClassText,
      record.armor?.strengthRequirementText, record.armor?.stealthRuleText,
      ...(record.id === "srd51:magic-item:magic-items-a-z:7"
        ? [] : record.properties.map(property => property.description)),
      ...record.description.map(description => description.text)].filter(Boolean);
    for (const fact of facts) {
      invariant(text.includes(normalizePdfText(fact)), `${record.id}: PDF-Beleg für „${fact}“ fehlt.`);
      checkedFacts += 1;
    }
  }
  return Object.freeze({ checkedRecords: transcript.records.length, checkedFacts,
    scope: "structured-table-and-sourced-description-facts" });
}

function verifyPdfPotionHealingMerge(pdfPath, transcript, inventory) {
  const evidence = validatePotionHealingMerge(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  invariant(headings.length === 239, "Magic Items A–Z muss exakt 239 physische Item-Detailheadings enthalten.");
  invariant(headings[141] === "Potion of Healing"
    && headings[140] === "Potion of Growth" && headings[142] === "Potion of Heroism",
  "Potion of Healing muss aus der physischen A–Z-Headingfolge als Ordinal 142 abgeleitet werden.");
  const pageText = normalizePdfPageText(extractPdfPage(pdfPath, 234), 234);
  for (const fact of ["Potion of Healing", "Potion, rarity varies", "Potions of Healing",
    "Healing Common 2d4 + 2", "Greater healing Uncommon 4d4 + 4",
    "Superior healing Rare 8d4 + 8", "Supreme healing Very rare 10d4 + 20"]) {
    invariant(pageText.includes(normalizePdfText(fact)),
      `Potion-of-Healing-PDF-Beleg für „${fact}“ fehlt.`);
  }
  return Object.freeze({ ...evidence, physicalPdfPage: 234, derivedHeadingCount: 239, derivedHeadingOrdinal: 142,
    scope: "explicit-earliest-occurrence-merge-header-rarity-and-four-healing-rows" });
}

function verifyPdfMagicItemAzOpeningSlice(pdfPath, transcript, inventory) {
  const evidence = validateMagicItemAzOpeningSlice(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  const expectedHeadings = ["Adamantine Armor", "Ammunition, +1, +2, or +3", "Amulet of Health",
    "Amulet of Proof against Detection and Location", "Amulet of the Planes"];
  invariant(headings.length === 239 && JSON.stringify(headings.slice(0, 5)) === JSON.stringify(expectedHeadings),
    "Die ersten fünf Magic-Items-A–Z-Headings oder der Gesamtcount 239 widersprechen dem PDF.");
  const records = new Map(transcript.records.map(record => [record.id, record]));
  for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
    const id = `srd51:magic-item:magic-items-a-z:${ordinal}`;
    const record = records.get(id);
    invariant(record.sourceHeader.occurrenceId === id && record.source.pdfPages.length === 1,
      `${id}: Magic-Item-Header ist nicht eindeutig occurrence-/seitengebunden.`);
    const page = record.source.pdfPages[0];
    const pageText = normalizePdfPageText(extractPdfPage(pdfPath, page), page);
    invariant(pageText.includes(normalizePdfText(record.sourceHeader.text)),
      `${id}: PDF-Beleg für vollständigen Magic-Item-Header „${record.sourceHeader.text}“ fehlt.`);
  }
  return Object.freeze({ ...evidence, derivedHeadingCount: headings.length,
    scope: "first-five-a-z-headings-full-headers-rarity-attunement-and-descriptions" });
}

function verifyPdfMagicItemAzAnimatedShield(pdfPath, transcript, inventory) {
  const evidence = validateMagicItemAzAnimatedShield(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  invariant(headings.length === 239 && headings[4] === "Amulet of the Planes"
    && headings[5] === "Animated Shield" && headings[6] === "Apparatus of the Crab",
  "Animated Shield muss im PDF exakt Ordinal 6 zwischen Amulet of the Planes und Apparatus of the Crab sein.");
  const record = transcript.records.find(item => item.id === evidence.id);
  const pageText = normalizePdfPageText(extractPdfPage(pdfPath, 208), 208);
  for (const fact of [record.sourceHeader.text, record.description[0].text]) {
    invariant(pageText.includes(normalizePdfText(fact)),
      `Animated-Shield-PDF-Beleg für „${fact}“ fehlt.`);
  }
  return Object.freeze({ ...evidence, derivedHeadingCount: headings.length,
    previousHeading: headings[4], nextHeading: headings[6],
    scope: "ordinal-six-full-header-rarity-attunement-and-description" });
}

function verifyPdfMagicItemAzApparatusOfTheCrab(pdfPath, transcript, inventory) {
  const evidence = validateMagicItemAzApparatusOfTheCrab(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  invariant(headings.length === 239 && headings[5] === "Animated Shield"
    && headings[6] === "Apparatus of the Crab" && headings[7] === "Armor, +1, +2, or +3",
  "Apparatus of the Crab muss im PDF exakt Ordinal 7 zwischen Animated Shield und Armor, +1, +2, or +3 sein.");
  const record = transcript.records.find(item => item.id === evidence.id);
  const pageText = normalizePdfPageText(extractPdfPage(pdfPath, 208), 208);
  const facts = [record.sourceHeader.text, ...record.description.map(fact => fact.text)];
  for (const fact of facts) {
    invariant(pageText.includes(normalizePdfText(fact)),
      `Apparatus-of-the-Crab-PDF-Beleg für „${fact}“ fehlt.`);
  }
  const leverRows = extractApparatusLeverCellsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "208", "-l", "208", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));
  const expectedLeverRows = Array.from({ length: 10 }, (_, index) => ({ lever: index + 1,
    up: record.properties[index * 2].description, down: record.properties[index * 2 + 1].description }));
  invariant(JSON.stringify(leverRows) === JSON.stringify(expectedLeverRows),
    "Apparatus-of-the-Crab-PDF-Leverzellen widersprechen dem Transkript.");
  return Object.freeze({ ...evidence, checkedPdfFacts: facts.length + evidence.leverCells,
    derivedHeadingCount: headings.length,
    previousHeading: headings[5], nextHeading: headings[7],
    scope: "ordinal-seven-full-header-prose-statistics-and-ten-row-lever-table" });
}

function verifyPdfMagicItemAzArmorPlusOneTwoThree(pdfPath, transcript, inventory) {
  const evidence = validateMagicItemAzArmorPlusOneTwoThree(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  invariant(headings.length === 239 && headings[6] === "Apparatus of the Crab"
    && headings[7] === "Armor, +1, +2, or +3" && headings[8] === "Armor of Invulnerability",
  "Armor, +1, +2, or +3 muss im PDF exakt Ordinal 8 zwischen Apparatus of the Crab und Armor of Invulnerability sein.");
  const record = transcript.records.find(item => item.id === evidence.id);
  const pageText = normalizePdfPageText(extractPdfPage(pdfPath, 208), 208);
  const facts = [record.sourceHeader.text, record.description[0].text];
  for (const fact of facts) {
    invariant(pageText.includes(normalizePdfText(fact)),
      `Armor-Plus-1-2-3-PDF-Beleg für „${fact}“ fehlt.`);
  }
  return Object.freeze({ ...evidence, checkedPdfFacts: facts.length,
    derivedHeadingCount: headings.length, previousHeading: headings[6], nextHeading: headings[8],
    scope: "ordinal-eight-full-header-ordered-rarity-variants-attunement-and-description" });
}

function verifyPdfMagicItemAzArmorOfInvulnerability(pdfPath, transcript, inventory) {
  const evidence = validateMagicItemAzArmorOfInvulnerability(transcript, inventory);
  const headings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
    ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  invariant(headings.length === 239 && headings[7] === "Armor, +1, +2, or +3"
    && headings[8] === "Armor of Invulnerability" && headings[9] === "Armor of Resistance",
  "Armor of Invulnerability muss im PDF exakt Ordinal 9 zwischen Armor, +1, +2, or +3 und Armor of Resistance sein.");
  const record = transcript.records.find(item => item.id === evidence.id);
  const pageText = normalizePdfPageText(extractPdfPage(pdfPath, 208), 208);
  const facts = [record.sourceHeader.text, record.description[0].text];
  for (const fact of facts) {
    invariant(pageText.includes(normalizePdfText(fact)),
      `Armor-of-Invulnerability-PDF-Beleg für „${fact}“ fehlt.`);
  }
  return Object.freeze({ ...evidence, checkedPdfFacts: facts.length,
    derivedHeadingCount: headings.length, previousHeading: headings[7], nextHeading: headings[9],
    scope: "ordinal-nine-full-header-fixed-rarity-required-attunement-and-description" });
}

function verifyPdfHelperDispositions(pdfPath, inventory) {
  const occurrences = new Map(inventory.occurrences.map(occurrence => [occurrence.id, occurrence]));
  const pageText = new Map();
  for (const disposition of inventory.helperDispositions) {
    const pages = [...new Set(disposition.sourceOccurrenceIds.flatMap(id => {
      const occurrence = occurrences.get(id);
      return Array.from({ length: occurrence.lastPdfPage - occurrence.firstPdfPage + 1 },
        (_, index) => occurrence.firstPdfPage + index);
    }))].sort((left, right) => left - right);
    const text = pages.map(page => {
      if (!pageText.has(page)) pageText.set(page, normalizePdfPageText(extractPdfPage(pdfPath, page), page));
      return pageText.get(page);
    }).join(" ");
    invariant(text.includes(normalizePdfText(disposition.sourceText)),
      `${disposition.helperIndex}: PDF-Beleg für Helper-Disposition „${disposition.sourceText}“ fehlt.`);
  }
  return Object.freeze({ checkedDispositions: inventory.helperDispositions.length,
    scope: "helper-disposition-source-text" });
}

function verifyPdfCrossReferences(pdfPath, inventory) {
  const pageText = new Map();
  let checkedFacts = 0;
  for (const reference of inventory.crossReferences) {
    const pages = Array.from({ length: reference.lastPdfPage - reference.firstPdfPage + 1 },
      (_, index) => reference.firstPdfPage + index);
    const text = pages.map(page => {
      if (!pageText.has(page)) pageText.set(page, normalizePdfPageText(extractPdfPage(pdfPath, page), page));
      return pageText.get(page);
    }).join(" ");
    for (const fact of [reference.sourceLabel, reference.sourceText]) {
      invariant(text.includes(normalizePdfText(fact)),
        `${reference.id}: PDF-Beleg für Cross-reference „${fact}“ fehlt.`);
      checkedFacts += 1;
    }
  }
  return Object.freeze({ checkedCrossReferences: inventory.crossReferences.length, checkedFacts,
    scope: "cross-reference-label-and-source-text" });
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyItemsSourcePackage({ pdfPath, allowIncomplete = false } = {}) {
  const [manifest, inventory, schema, transcript, attribution, inventoryBytes, schemaBytes, transcriptBytes] = await Promise.all([
    json(paths.manifest), json(paths.inventory), json(paths.schema), json(paths.transcript), readFile(paths.attribution, "utf8"),
    readFile(paths.inventory), readFile(paths.schema), readFile(paths.transcript),
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
  invariant(manifest.artifactHashes?.attributionSha256 === sha256(Buffer.from(attribution)),
    "Attributionshash stimmt nicht mit dem Manifest überein.");
  invariant(manifest.artifactHashes?.inventorySha256 === sha256(inventoryBytes),
    "Inventarhash stimmt nicht mit dem Manifest überein.");
  invariant(manifest.artifactHashes?.schemaSha256 === sha256(schemaBytes),
    "Schemahash stimmt nicht mit dem Manifest überein.");
  invariant(manifest.artifactHashes?.transcriptSha256 === sha256(transcriptBytes),
    "Transkripthash stimmt nicht mit dem Manifest überein.");
  invariant(manifest.complete === inventory.complete && manifest.complete === transcript.complete,
    "Manifest, Inventar und Transkript widersprechen sich beim Vollständigkeitsstatus.");
  invariant(manifest.coverage.inventoryOccurrences === inventory.occurrences.length,
    "Manifest-Inventarcount stimmt nicht.");
  invariant(manifest.coverage.transcriptRecords === transcript.records.length,
    "Manifest-Transkriptcount stimmt nicht.");
  const magicItemAzSection = inventory.sections.find(section => section.id === "magic-items-a-z");
  invariant(manifest.coverage.capturedMagicItemAzHeadings === magicItemAzSection?.capturedOccurrences
    && manifest.coverage.capturedMagicItemAzStandaloneRecords === inventory.occurrences
      .filter(row => row.sectionId === "magic-items-a-z" && row.mergeIntoId === null).length
    && manifest.coverage.capturedMagicItemAzMergedDetails === 1
    && manifest.coverage.unresolvedMagicItemSourceHeadings
      === magicItemAzSection.expectedOccurrences - magicItemAzSection.capturedOccurrences,
  "Manifest-Magic-Items-A–Z-Coverage stimmt nicht mit Inventar und Merge-Stand überein.");
  invariant(manifest.coverage.capturedEquipmentCrossReferenceRows === inventory.crossReferences.length,
    "Manifest-Cross-reference-Count stimmt nicht.");
  validateJsonSchemas(schema, transcript, inventory);
  const validation = validateTranscriptData(transcript, inventory, { allowIncomplete });
  const potionHealingMerge = validatePotionHealingMerge(transcript, inventory);
  const magicItemAzOpeningSlice = validateMagicItemAzOpeningSlice(transcript, inventory);
  const magicItemAzAnimatedShield = validateMagicItemAzAnimatedShield(transcript, inventory);
  const magicItemAzApparatusOfTheCrab = validateMagicItemAzApparatusOfTheCrab(transcript, inventory);
  const magicItemAzArmorPlusOneTwoThree = validateMagicItemAzArmorPlusOneTwoThree(transcript, inventory);
  const magicItemAzArmorOfInvulnerability = validateMagicItemAzArmorOfInvulnerability(transcript, inventory);
  const magicItemAzArmorArrows = validateArmorArrowsSlice(transcript, inventory);
  const magicItemAzBags = validateBagsSlice(transcript, inventory);
  const magicItemAzBSection = validateBSectionSlice(transcript, inventory);
  const magicItemAzCSection = validateCSectionSlice(transcript, inventory);
  let pdf;
  if (pdfPath) {
    const bytes = await readFile(resolve(pdfPath));
    invariant(sha256(bytes) === OFFICIAL_PDF_SHA256, "Offizieller SRD-5.1-PDF-Hash stimmt nicht.");
    invariant(bytes.length === manifest.source.pdfBytes, "Offizielle SRD-5.1-PDF-Größe stimmt nicht.");
    const info = execFileSync("pdfinfo", [resolve(pdfPath)], { encoding: "utf8" });
    invariant(new RegExp(`^Pages:\\s+${manifest.source.pdfPages}$`, "m").test(info), "PDF-Seitenzahl stimmt nicht.");
    const bagsXml = execFileSync("pdftohtml",
      ["-xml", "-f", "209", "-l", "211", "-stdout", "-i", resolve(pdfPath)],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const bagsHeadings = extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
      ["-xml", "-f", "207", "-l", "251", "-stdout", "-i", resolve(pdfPath)],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
    pdf = Object.freeze({ sha256: OFFICIAL_PDF_SHA256, bytes: bytes.length, pages: manifest.source.pdfPages,
      magicItemAzBagsEvidence: validateBagsPdfXml(bagsXml, bagsHeadings, normalizePdfText),
      magicItemAzBSectionEvidence: validateBSectionPdfXml(execFileSync("pdftohtml",
        ["-xml", "-f", "211", "-l", "213", "-stdout", "-i", resolve(pdfPath)],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }), bagsHeadings, normalizePdfText),
      magicItemAzCSectionEvidence: validateCSectionPdfXml(execFileSync("pdftohtml",
        ["-xml", "-f", "213", "-l", "215", "-stdout", "-i", resolve(pdfPath)],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }), bagsHeadings, normalizePdfText),
      occurrenceEvidence: verifyPdfOccurrences(pdfPath, inventory),
      transcriptEvidence: verifyPdfTranscriptFacts(pdfPath, transcript),
      magicItemAzOpeningSliceEvidence: verifyPdfMagicItemAzOpeningSlice(pdfPath, transcript, inventory),
      magicItemAzAnimatedShieldEvidence: verifyPdfMagicItemAzAnimatedShield(pdfPath, transcript, inventory),
      magicItemAzApparatusOfTheCrabEvidence:
        verifyPdfMagicItemAzApparatusOfTheCrab(pdfPath, transcript, inventory),
      magicItemAzArmorPlusOneTwoThreeEvidence:
        verifyPdfMagicItemAzArmorPlusOneTwoThree(pdfPath, transcript, inventory),
      magicItemAzArmorOfInvulnerabilityEvidence:
        verifyPdfMagicItemAzArmorOfInvulnerability(pdfPath, transcript, inventory),
      magicItemAzArmorArrowsEvidence: validateArmorArrowsPdfXml(
        execFileSync("pdftohtml", ["-xml", "-f", "208", "-l", "209", "-stdout", resolve(pdfPath)],
          { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }),
        extractMagicItemAzHeadingsFromPdfXml(execFileSync("pdftohtml",
          ["-xml", "-f", "207", "-l", "251", "-stdout", resolve(pdfPath)],
          { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })), normalizePdfText),
      potionHealingMergeEvidence: verifyPdfPotionHealingMerge(pdfPath, transcript, inventory),
      boundedArmorTableEvidence: verifyPdfArmorTableRows(pdfPath, transcript, inventory),
      boundedWeaponTableEvidence: verifyPdfWeaponTableRows(pdfPath, transcript, inventory),
      boundedAdventuringGearTableEvidence: verifyPdfAdventuringGearTableRows(pdfPath, transcript, inventory),
      boundedToolsTableEvidence: verifyPdfToolsTableRows(pdfPath, transcript, inventory),
      boundedMountsTableEvidence: verifyPdfMountsTableRows(pdfPath, transcript, inventory),
      boundedTackTableEvidence: verifyPdfTackTableRows(pdfPath, transcript, inventory),
      boundedWaterborneTableEvidence: verifyPdfWaterborneTableRows(pdfPath, transcript, inventory),
      helperDispositionEvidence: verifyPdfHelperDispositions(pdfPath, inventory),
      crossReferenceEvidence: verifyPdfCrossReferences(pdfPath, inventory) });
  }
  return Object.freeze({
    complete: manifest.complete,
    validation,
    magicItemAzOpeningSlice,
    magicItemAzAnimatedShield,
    magicItemAzApparatusOfTheCrab,
    magicItemAzArmorPlusOneTwoThree,
    magicItemAzArmorOfInvulnerability,
    magicItemAzArmorArrows,
    magicItemAzBags,
    magicItemAzBSection,
    magicItemAzCSection,
    potionHealingMerge,
    pdf,
    hashes: Object.freeze({
      attribution: sha256(Buffer.from(attribution)),
      inventory: sha256(inventoryBytes),
      manifest: sha256(await readFile(paths.manifest)),
      schema: sha256(schemaBytes),
      transcript: sha256(transcriptBytes),
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
