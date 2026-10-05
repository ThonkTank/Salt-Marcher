import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { loadGroups } = require("./group-catalog.cjs");

const root = resolve(import.meta.dirname, "..");
const acceptance = JSON.parse(await readFile(resolve(root, "acceptance.json"), "utf8"));
const cases = acceptance.strictParity.cases;
const byId = new Map(cases.map((item) => [item.id, item]));
const groups = loadGroups(root);

const groupIds = new Set();
const owner = new Map();
for (const group of groups) {
  if (!group.id || groupIds.has(group.id))
    throw new Error(`Duplicate or missing group id: ${group.id}`);
  groupIds.add(group.id);
  if (!group.title || !group.area || !group.sharedFlow || !Array.isArray(group.caseIds))
    throw new Error(`${group.id}: incomplete group metadata`);
  if (group.caseIds.length > 40)
    throw new Error(`${group.id}: more than 40 cases`);
  if (group.caseIds.length < 20 && !group.sizeReason)
    throw new Error(`${group.id}: fewer than 20 cases without reason`);
  for (const id of group.caseIds) {
    const item = byId.get(id);
    if (!item) throw new Error(`${group.id}: unknown case ${id}`);
    if (item.scope !== "required")
      throw new Error(`${group.id}: non-required case ${id}`);
    if (owner.has(id))
      throw new Error(`${id} appears in ${owner.get(id)} and ${group.id}`);
    owner.set(id, group.id);
    if (!Array.isArray(group.originalEvidence?.[id]) || !group.originalEvidence[id].length)
      throw new Error(`${group.id}: evidence mapping missing for ${id}`);
    for (const source of group.originalEvidence[id])
      if (!source.startsWith("https://") && (!source.startsWith("/") || !existsSync(source)))
        throw new Error(`${group.id}: unavailable evidence for ${id}: ${source}`);
    if (!item.original.effect?.trim() && !group.originalEffects?.[id] && !group.originalGaps?.[id])
      throw new Error(`${group.id}: original effect or explicit gap missing for ${id}`);
  }
}

const missing = cases.filter((item) => item.scope === "required" && !owner.has(item.id));
const result = {
  groups: groups.length,
  groupedCases: owner.size,
  requiredCases: cases.filter((item) => item.scope === "required").length,
  missing: missing.map((item) => item.id),
  groupSizes: Object.fromEntries(groups.map((group) => [group.id, group.caseIds.length])),
};
if (process.argv.includes("--complete") && missing.length)
  throw new Error(`Ungruppierte Pflichtfälle: ${missing.map((item) => item.id).join(", ")}`);
console.log(JSON.stringify(result, null, 2));
