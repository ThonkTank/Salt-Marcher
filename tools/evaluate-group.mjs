import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadGroups } = require("./group-catalog.cjs");
const [groupId, editFile, reopenFile, outputFlag, outputFile] = process.argv.slice(2);
if (!groupId || !editFile || !reopenFile)
  throw new Error("Usage: node tools/evaluate-group.mjs GROUP EDIT_RESULT REOPEN_RESULT [--output FILE]");
if (outputFlag && (outputFlag !== "--output" || !outputFile))
  throw new Error("Expected --output FILE");

const root = resolve(import.meta.dirname, "..");
const group = loadGroups(root).find((item) => item.id === groupId);
if (!group) throw new Error(`Unknown group: ${groupId}`);
const acceptance = JSON.parse(await readFile(resolve(root, "acceptance.json"), "utf8"));
const byId = new Map(acceptance.strictParity.cases.map((item) => [item.id, item]));
const [edit, reopen] = await Promise.all([editFile, reopenFile].map(async (file) =>
  JSON.parse(await readFile(file, "utf8"))));
for (const [phase, result] of [["edit", edit], ["reopen", reopen]]) {
  if (result.groupId !== groupId || result.phase !== phase)
    throw new Error(`${phase}: wrong group or phase`);
  if (result.cases.length !== group.caseIds.length ||
      new Set(result.cases.map((item) => item.caseId)).size !== group.caseIds.length)
    throw new Error(`${phase}: incomplete or duplicate case results`);
}
if (edit.build !== reopen.build) throw new Error("Build changed between edit and reopen");
const editById = new Map(edit.cases.map((item) => [item.caseId, item]));
const reopenById = new Map(reopen.cases.map((item) => [item.caseId, item]));
const results = group.caseIds.map((id) => {
  const item = byId.get(id);
  const editCase = editById.get(id), reopenCase = reopenById.get(id);
  if (!editCase || !reopenCase) throw new Error(`Result missing: ${id}`);
  const originalEffect = item.original.effect || group.originalEffects?.[id] || null;
  const originalGap = group.originalGaps?.[id] || null;
  const originalReady = !!originalEffect && !originalGap &&
    group.originalEvidence[id].some((source) => !source.startsWith("https://"));
  const hostReady = editCase.state === "pass" &&
    ["pass", "not_applicable"].includes(reopenCase.state);
  return {
    caseId: id,
    originalReady,
    originalGap,
    edit: editCase.state,
    reopen: reopenCase.state,
    readyForIndependentReview: originalReady && hostReady,
  };
});
const summary = {
  schemaVersion: 1,
  groupId,
  build: edit.build,
  caseCount: results.length,
  originalGaps: results.filter((item) => !item.originalReady).length,
  hostGaps: results.filter((item) => item.edit !== "pass" ||
    !["pass", "not_applicable"].includes(item.reopen)).length,
  readyForIndependentReview: results.filter((item) => item.readyForIndependentReview).length,
  acceptedAtInstalledBuild: 0,
  results,
};
if (outputFile) await writeFile(outputFile, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
