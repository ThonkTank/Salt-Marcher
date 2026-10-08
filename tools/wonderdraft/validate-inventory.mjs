import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const requiredFields = [
  'id', 'version', 'exactUiPath', 'context', 'commandOrControl',
  'controlType', 'default', 'rangeOrChoices', 'validation', 'gesture',
  'previewOrCommit', 'stateScope', 'caseIds', 'phase', 'directEvidence',
  'classification',
];

export function validateInventory(document, { allowOpen = false, exists = fs.existsSync } = {}) {
  const inventory = document.wonderdraftParity;
  const errors = [];
  if (!inventory) return { valid: false, errors: ['wonderdraftParity fehlt.'] };
  const cases = new Map(inventory.cases.map((item) => [item.id, item]));
  const seen = new Set();
  const checkEvidence = (evidence, owner) => {
    if (!Array.isArray(evidence) || !evidence.length) {
      errors.push(`${owner}: direkter Beleg fehlt.`);
      return;
    }
    for (const item of evidence) {
      if (!item || typeof item !== 'object' || !item.role?.startsWith('original_')) {
        errors.push(`${owner}: Quellenhinweis oder Dateiname ist kein Originalbeleg.`);
        continue;
      }
      if (item.version !== inventory.reference.version)
        errors.push(`${owner}: Belegversion fehlt oder weicht ab.`);
      if (!item.session || !exists(item.session))
        errors.push(`${owner}: Originalsitzung fehlt.`);
      else {
        const session = fs.readFileSync(item.session, 'utf8');
        if (!/app_pid=\d+/.test(session) || !/started_at=/.test(session))
          errors.push(`${owner}: Sitzung hat keinen Originalprozess/Startzeitpunkt.`);
      }
      if (!item.path || !exists(item.path)) errors.push(`${owner}: Belegdatei fehlt.`);
      if (item.sha256 && exists(item.path)) {
        const actual = crypto.createHash('sha256').update(fs.readFileSync(item.path)).digest('hex');
        if (actual !== item.sha256) errors.push(`${owner}: Beleghash weicht ab.`);
      }
    }
  };
  for (const item of inventory.uiInventory) {
    for (const field of requiredFields)
      if (!Object.hasOwn(item, field)) errors.push(`${item.id ?? '?'}: ${field} fehlt.`);
    if (!item.id || seen.has(item.id)) errors.push(`${item.id ?? '?'}: doppelte oder leere UI-ID.`);
    seen.add(item.id);
    if (item.version !== inventory.reference.version)
      errors.push(`${item.id}: Originalversion stimmt nicht.`);
    if (!item.exactUiPath || !item.commandOrControl || !item.controlType || !item.classification)
      errors.push(`${item.id}: UI-Pfad, Befehl, Typ oder Einordnung fehlt.`);
    if (!Array.isArray(item.caseIds) || !item.caseIds.length)
      errors.push(`${item.id}: WD-Unterfall fehlt.`);
    else for (const id of item.caseIds) {
      const testcase = cases.get(id);
      if (!testcase) errors.push(`${item.id}: unbekannter WD-Unterfall ${id}.`);
      else if (testcase.phase !== item.phase && !testcase.relatedPhases?.includes(item.phase))
        errors.push(`${item.id}: Phase ${item.phase} gehört nicht zu ${id}.`);
    }
    checkEvidence(item.directEvidence, item.id);
  }
  if (!allowOpen) {
    if (!inventory.inventoryComplete || inventory.inventoryGate?.state !== 'passed')
      errors.push('Inventartor noch offen.');
    if (inventory.coverageReview?.unclassifiedPackageHints?.length)
      errors.push(`${inventory.coverageReview.unclassifiedPackageHints.length} Pakethinweise unklassifiziert.`);
    if (inventory.inventoryGate?.steps?.some((step) => step.state !== 'passed'))
      errors.push('Nicht alle HEX-00-Prüfschritte bestanden.');
  }
  return { valid: errors.length === 0, errors, uiEntries: inventory.uiInventory.length,
    unclassifiedPackageHints: inventory.coverageReview?.unclassifiedPackageHints?.length ?? null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.resolve(process.argv.find((arg) => arg.endsWith('.json')) ?? 'acceptance.json');
  const result = validateInventory(JSON.parse(fs.readFileSync(file, 'utf8')),
    { allowOpen: process.argv.includes('--allow-open') });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.valid) process.exitCode = 1;
}
