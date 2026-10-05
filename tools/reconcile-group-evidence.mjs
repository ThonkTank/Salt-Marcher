#!/usr/bin/env node
// Example: node tools/reconcile-group-evidence.mjs --group-id material-pfad
//   --edit /qa/edit/group-cases.json --reopen /qa/reopen/group-cases.json
//   --output /qa/acceptance-candidate.json [--acceptance acceptance.json]
//   [--manifest tools/groups/material.json] [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const states = new Set(["pass", "fail", "deviation", "open", "not_applicable"]);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function findGroup(groupId, groupsDir, manifestFile) {
  const files = manifestFile
    ? [manifestFile]
    : fs.readdirSync(groupsDir).filter((name) => name.endsWith(".json"))
      .sort().map((name) => path.join(groupsDir, name));
  const matches = files.flatMap((file) => {
    const manifest = readJson(file);
    requireValue(Array.isArray(manifest.groups), `${file}: groups fehlt`);
    return manifest.groups.filter((group) => group.id === groupId);
  });
  requireValue(matches.length === 1,
    `Gruppe ${groupId}: ${matches.length === 0 ? "nicht gefunden" : "mehrfach vorhanden"}`);
  return matches[0];
}

function checkGroup(group) {
  requireValue(Array.isArray(group.caseIds) && group.caseIds.length > 0,
    `${group.id}: caseIds fehlt`);
  requireValue(new Set(group.caseIds).size === group.caseIds.length,
    `${group.id}: doppelte caseIds`);
  for (const key of ["originalEvidence", "originalEffects", "originalGaps"])
    requireValue((key !== "originalEvidence" && group[key] === undefined) ||
      (group[key] && typeof group[key] === "object" && !Array.isArray(group[key])),
      `${group.id}: ${key} fehlt`);
  const allowed = new Set(group.caseIds);
  for (const key of ["originalEvidence", "originalEffects", "originalGaps"])
    for (const caseId of Object.keys(group[key] ?? {}))
      requireValue(allowed.has(caseId), `${group.id}: ${key} enthält fremden Fall ${caseId}`);
  for (const caseId of group.caseIds) {
    const evidence = group.originalEvidence[caseId];
    requireValue(Array.isArray(evidence) && evidence.length > 0 &&
      evidence.every((item) => typeof item === "string" && item.length > 0),
    `${group.id}: Originalbelege für ${caseId} fehlen`);
    for (const key of ["originalEffects", "originalGaps"])
      if (Object.hasOwn(group[key] ?? {}, caseId))
        requireValue(typeof group[key][caseId] === "string" && group[key][caseId].trim(),
          `${group.id}: ${key}.${caseId} ist leer`);
  }
}

function checkReport(report, phase, group) {
  requireValue(report?.schemaVersion === 1, `${phase}: schemaVersion 1 erwartet`);
  requireValue(report.groupId === group.id, `${phase}: falsche Gruppe ${report.groupId}`);
  requireValue(report.phase === phase, `${phase}: falsche Phase ${report.phase}`);
  requireValue(typeof report.build === "string" && report.build.trim(),
    `${phase}: Build-ID fehlt`);
  requireValue(Array.isArray(report.cases), `${phase}: cases fehlt`);
  const expected = new Set(group.caseIds);
  const found = new Set();
  for (const item of report.cases) {
    requireValue(expected.has(item?.caseId), `${phase}: fremder Fall ${item?.caseId}`);
    requireValue(!found.has(item.caseId), `${phase}: doppelter Fall ${item.caseId}`);
    found.add(item.caseId);
    requireValue(states.has(item.state), `${phase}/${item.caseId}: ungültiger Zustand`);
    requireValue(item.observation === null || typeof item.observation === "string",
      `${phase}/${item.caseId}: ungültige Beobachtung`);
    requireValue(Array.isArray(item.evidence) && item.evidence.every((entry) =>
      typeof entry === "string" && entry.length > 0),
    `${phase}/${item.caseId}: ungültige Belege`);
    requireValue(item.gap === null || typeof item.gap === "string",
      `${phase}/${item.caseId}: ungültige Lücke`);
    if (item.state === "open")
      requireValue(item.gap?.trim(), `${phase}/${item.caseId}: offener Fall ohne Lücke`);
    if (item.state === "pass" || item.state === "deviation")
      requireValue(item.observation?.trim() && item.evidence.length,
        `${phase}/${item.caseId}: Ergebnis ohne Beobachtung/Beleg`);
    if (item.state === "deviation")
      requireValue(item.gap?.trim(), `${phase}/${item.caseId}: Abweichung ohne Lücke`);
  }
  requireValue(found.size === expected.size,
    `${phase}: ${[...expected].filter((caseId) => !found.has(caseId)).join(", ")} fehlen`);
  return new Map(report.cases.map((item) => [item.caseId, item]));
}

function candidateState(edit, reopen) {
  const pair = [edit.state, reopen.state];
  for (const state of ["fail", "deviation", "open"])
    if (pair.includes(state)) return state;
  return pair.includes("pass") ? "pass" : "not_applicable";
}

function labelled(edit, reopen, key) {
  const parts = [["Edit", edit[key]], ["Frischstart", reopen[key]]]
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([phase, value]) => `${phase}: ${value}`);
  return parts.length ? parts.join("\n") : null;
}

export function reconcileGroupEvidence({ acceptance, group, edit, reopen,
  editFile, reopenFile }) {
  checkGroup(group);
  const originalEffects = group.originalEffects ?? {};
  const originalGaps = group.originalGaps ?? {};
  const editCases = checkReport(edit, "edit", group);
  const reopenCases = checkReport(reopen, "reopen", group);
  requireValue(edit.build === reopen.build,
    `Build-ID ungleich: edit=${edit.build}, reopen=${reopen.build}`);
  requireValue(Array.isArray(acceptance?.strictParity?.cases),
    "acceptance.json: strictParity.cases fehlt");
  const cases = new Map();
  for (const item of acceptance.strictParity.cases) {
    requireValue(!cases.has(item.id), `acceptance.json: doppelter Fall ${item.id}`);
    cases.set(item.id, item);
  }
  for (const caseId of group.caseIds) {
    const item = cases.get(caseId);
    requireValue(item?.original && item.hostCheck && item.baseline,
      `acceptance.json: Fall ${caseId} oder Original/Baseline/Host fehlt`);
    requireValue(originalEffects[caseId] || item.original.effect ||
      originalGaps[caseId], `${caseId}: weder Originalwirkung noch Originallücke`);
  }
  for (const caseId of group.caseIds) {
    const item = cases.get(caseId);
    const editCase = editCases.get(caseId);
    const reopenCase = reopenCases.get(caseId);
    if (Object.hasOwn(originalEffects, caseId))
      item.original.effect = originalEffects[caseId];
    item.original.evidence = unique([
      ...(item.original.evidence ?? []), ...group.originalEvidence[caseId],
    ]);
    if (Object.hasOwn(originalGaps, caseId))
      item.original.gap = originalGaps[caseId];
    else delete item.original.gap;
    item.hostCheck.candidate = {
      state: candidateState(editCase, reopenCase),
      observation: labelled(editCase, reopenCase, "observation"),
      evidence: unique([editFile, ...editCase.evidence, reopenFile, ...reopenCase.evidence]),
      gap: labelled(editCase, reopenCase, "gap"),
      build: edit.build,
      phaseStates: { edit: editCase.state, reopen: reopenCase.state },
    };
  }
  return acceptance;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") { options.dryRun = true; continue; }
    requireValue(arg.startsWith("--") && i + 1 < argv.length,
      `Unbekanntes oder unvollständiges Argument: ${arg}`);
    const key = arg === "--group-id" ? "group" : arg.slice(2);
    requireValue(["group", "edit", "reopen", "output", "acceptance",
      "manifest", "groups-dir"].includes(key) && !Object.hasOwn(options, key),
    `Unbekanntes oder doppeltes Argument: ${arg}`);
    requireValue(!argv[i + 1].startsWith("--"), `Wert für ${arg} fehlt`);
    options[key] = argv[++i];
  }
  for (const key of ["group", "edit", "reopen", "output"])
    requireValue(options[key], `--${key} fehlt`);
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  const acceptanceFile = path.resolve(options.acceptance ?? "acceptance.json");
  const editFile = path.resolve(options.edit);
  const reopenFile = path.resolve(options.reopen);
  const outputFile = path.resolve(options.output);
  requireValue(outputFile !== acceptanceFile && outputFile !== editFile &&
    outputFile !== reopenFile, "Ausgabepfad darf keine Eingabedatei überschreiben");
  if (options.manifest)
    requireValue(outputFile !== path.resolve(options.manifest),
      "Ausgabepfad darf das Gruppenmanifest nicht überschreiben");
  const group = findGroup(options.group, path.resolve(options["groups-dir"] ??
    "tools/groups"), options.manifest && path.resolve(options.manifest));
  const acceptance = readJson(acceptanceFile);
  reconcileGroupEvidence({ acceptance, group, edit: readJson(editFile),
    reopen: readJson(reopenFile), editFile, reopenFile });
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(acceptance, null, 2) + "\n");
  }
  process.stdout.write(`${options.dryRun ? "Dry-Run" : "Geschrieben"}: ${group.id}, ` +
    `${group.caseIds.length} Kandidaten, Build ${readJson(editFile).build}, ${outputFile}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
