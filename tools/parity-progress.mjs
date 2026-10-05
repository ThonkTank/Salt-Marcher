#!/usr/bin/env node
import fs from "node:fs";

const path = process.argv[2] ?? "acceptance.json";
const ledger = JSON.parse(fs.readFileSync(path, "utf8"));
const cases = ledger.strictParity?.cases;
if (!Array.isArray(cases)) throw new Error("strictParity.cases fehlt");
const ids = new Set();
for (const item of cases) {
  if (ids.has(item.id)) throw new Error(`Doppelter Fall: ${item.id}`);
  ids.add(item.id);
}
const required = cases.filter((item) => item.scope === "required");
const equal = required.filter((item) => item.hostCheck?.state === "equal");
const candidates = required.filter((item) =>
  item.hostCheck?.state !== "equal" && item.hostCheck?.candidate?.state === "pass");
const byArea = Object.fromEntries([...new Set(required.map((item) => item.area))]
  .sort().map((area) => {
    const list = required.filter((item) => item.area === area);
    return [area, {
      equal: list.filter((item) => item.hostCheck?.state === "equal").length,
      required: list.length,
      candidatePass: list.filter((item) => item.hostCheck?.state !== "equal" &&
        item.hostCheck?.candidate?.state === "pass").length,
    }];
  }));
const result = {
  installed: `${equal.length} / ${required.length}`,
  equal: equal.map((item) => item.id),
  candidatePass: candidates.map((item) => item.id),
  excluded: cases.filter((item) => item.scope === "excluded").length,
  byArea,
};
console.log(JSON.stringify(result, null, 2));
