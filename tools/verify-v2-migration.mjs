import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const { parseDocument, serializeDocument } = require("../.build/model.cjs");
const { Session } = require("../.build/session.cjs");
const [reportPath, ...paths] = process.argv.slice(2);
if (!reportPath || !paths.length)
  throw new Error("Aufruf: node tools/verify-v2-migration.mjs REPORT.json KARTE.dungeon ...");

const report = [];
for (const path of paths) {
  const bytes = await readFile(path);
  const before = JSON.parse(bytes.toString("utf8"));
  const migrated = parseDocument(bytes.toString("utf8"));
  const expected = { ...before, version: 3 };
  const exactFields = JSON.stringify(migrated) === JSON.stringify(expected);
  const sessionFields = JSON.stringify(new Session(migrated).document()) === JSON.stringify(expected);
  const reopened = parseDocument(serializeDocument(migrated));
  const freshOpen = JSON.stringify(reopened) === JSON.stringify(expected);
  const item = {
    path,
    sourceVersion: before.version,
    targetVersion: migrated.version,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    floorCount: migrated.floors.length,
    entityCount: migrated.entities.length,
    exactFields,
    sessionFields,
    freshOpen,
  };
  report.push(item);
  if (!exactFields || !sessionFields || !freshOpen)
    throw new Error(`Verlust bei ${path}; Quelle wurde nicht verändert.`);
}
await writeFile(reportPath, JSON.stringify({ verifiedAt: new Date().toISOString(), maps: report }, null, 2) + "\n");
console.log(JSON.stringify({ maps: report.length, pass: true }));
