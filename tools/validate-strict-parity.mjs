import { readFile } from "node:fs/promises";

const acceptance = JSON.parse(await readFile("acceptance.json", "utf8"));
const parity = acceptance.strictParity;
if (!parity || !Array.isArray(parity.cases))
  throw new Error("Verbindliche Unterfälle fehlen.");
const ids = new Set();
let required = 0;
let excluded = 0;
for (const item of parity.cases) {
  if (ids.has(item.id)) throw new Error(`Doppelter Fall: ${item.id}`);
  ids.add(item.id);
  if (!item.original?.evidence?.length || !item.target)
    throw new Error(`Originalbeleg oder Ziel fehlt: ${item.id}`);
  if (item.scope === "excluded") {
    excluded++;
    if (item.parent !== "DD-037")
      throw new Error(`Nicht beschlossene Ausnahme: ${item.id}`);
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
if (required < 711 || excluded !== 12)
  throw new Error(`Umfang verändert: ${required} Pflicht, ${excluded} Ausnahme.`);
console.log(JSON.stringify({ cases: ids.size, required, excluded }));
