import { readFile } from "node:fs/promises";

const acceptance = JSON.parse(await readFile("acceptance.json", "utf8"));
const parity = acceptance.strictParity;
if (!parity || !Array.isArray(parity.cases))
  throw new Error("Verbindliche Unterfälle fehlen.");
const ids = new Set();
let required = 0;
let excluded = 0;
let editorAdditions = 0;
for (const item of parity.cases) {
  if (ids.has(item.id)) throw new Error(`Doppelter Fall: ${item.id}`);
  ids.add(item.id);
  if (!item.original?.evidence?.length || !item.target)
    throw new Error(`Originalbeleg oder Ziel fehlt: ${item.id}`);
  if (item.scope === "excluded") {
    excluded++;
    if (item.parent !== "DD-037")
      throw new Error(`Nicht beschlossene Ausnahme: ${item.id}`);
  } else if (item.scope === "editor_addition") {
    editorAdditions++;
    if (!["not_native_command", "duplicate_inventory_case"].includes(
          item.classification?.decision) ||
        !item.classification.evidence?.length ||
        (item.classification.decision === "duplicate_inventory_case" &&
         !item.classification.canonicalCaseId))
      throw new Error(`Nicht belegte Inventurkorrektur: ${item.id}`);
  } else if (item.scope === "required") required++;
  else throw new Error(`Unbekannter Umfang: ${item.id}`);
  if (!item.implementation?.state || !Array.isArray(item.implementation.evidence))
    throw new Error(`Implementierungsstand fehlt: ${item.id}`);
  if (!item.hostCheck?.state || !Array.isArray(item.hostCheck.evidence))
    throw new Error(`Hoststand fehlt: ${item.id}`);
  if (item.hostCheck.state === "equal" &&
      (!item.original.version || !item.hostCheck.build ||
       !item.hostCheck.evidence.length || item.hostCheck.gap))
    throw new Error(`Nicht belegte Abnahme: ${item.id}`);
}
const corrections = parity.inventoryCorrections ?? [];
if (corrections.length !== editorAdditions ||
    corrections.some((entry) =>
      !ids.has(entry.caseId) ||
      !entry.evidence ||
      parity.cases.find((item) => item.id === entry.caseId)?.scope !== "editor_addition"))
  throw new Error("Inventurkorrektur ohne Fall oder Beleg.");
if (required !== 711 + (ids.size - 723) - editorAdditions || excluded !== 12)
  throw new Error(`Umfang verändert: ${required} Pflicht, ${excluded} Ausnahme, ${editorAdditions} Inventurfehler.`);
console.log(JSON.stringify({ cases: ids.size, required, excluded, editorAdditions }));
