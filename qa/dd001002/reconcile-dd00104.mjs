import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const plugin = "/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-editor";
const build = "a12f3fcfaa64b4c8fbb2e14c7441e5521f1a0edd552d17bb29e5bdb739f25635";
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (sha(path.join(plugin, "main.js")) !== build)
  throw new Error("Installierter Build weicht vom geprüften Build ab.");
const ledgerPath = path.join(root, "acceptance.json");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const required = ledger.strictParity.cases.filter((item) => item.scope === "required");
const before = required.filter((item) => item.hostCheck.state === "equal").length;
if (required.length !== 707 || before !== 37)
  throw new Error(`Unerwarteter Stand ${before}/${required.length}`);
const evidence = (phase, run) => path.join(qa, "dd00104-installed-host/evidence",
  `${run}-verwaltung-karte-datei-${phase}`);
const editDir = evidence("edit", "1791223562045");
const reopenDir = evidence("reopen", "1791223571925");
const read = (dir) => {
  const file = path.join(dir, "group-cases.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.build !== build || data.counts.fail || data.counts.deviation)
    throw new Error(`Hostlauf ungültig: ${file}`);
  const item = data.cases.find((entry) => entry.caseId === "DD-001.04");
  if (item?.state !== (dir === reopenDir ? "pass" : "open"))
    throw new Error(`DD-001.04 hat falschen Phasenstatus: ${file}`);
  const steps = JSON.parse(fs.readFileSync(path.join(dir,
    "dd00104-first-save-steps.json"), "utf8"));
  if (steps.error) throw new Error(`Hostfehler: ${steps.error}`);
  return { file, item };
};
const edit = read(editDir), reopen = read(reopenDir);
const item = required.find((entry) => entry.id === "DD-001.04");
if (!item || item.hostCheck.state === "equal" ||
    !item.original.version || !item.original.evidence.length)
  throw new Error("Originalbeleg oder offener Fall fehlt.");
const add = (values, ...more) => [...new Set([...(values ?? []), ...more])];
const report = path.join(root, "qa/dd001002/DD-001-04-RELEASE.md");
const manifest = path.join(qa, "releases/dd00104-20261005/installation-manifest.json");
for (const file of [report, manifest, edit.file, reopen.file])
  if (!fs.existsSync(file)) throw new Error(`Beleg fehlt: ${file}`);
item.implementation = {
  state: "installed_verified",
  changes: add(item.implementation.changes,
    "Ungespeicherte Pending-Kartenansicht mit erstem Save und Session-Übergabe installiert"),
  evidence: add(item.implementation.evidence, manifest, report),
};
item.hostCheck = {
  ...item.hostCheck,
  state: "equal", build,
  evidence: add(item.hostCheck.evidence, edit.file, ...edit.item.evidence,
    reopen.file, ...reopen.item.evidence, report),
  gap: null,
  phaseStates: { edit: "pass", reopen: "pass" },
};
item.verifiedScope = "Neue 8×8-Karte bis zum ersten Save ohne Kartendatei; Licht und derselbe Undo/Redo-Schritt vor und nach Save, bytegleich gespeicherte Datei bei History-Aktionen und korrektes frisches Öffnen.";
const after = required.filter((entry) => entry.hostCheck.state === "equal").length;
if (after !== 38) throw new Error(`Unerwarteter Endstand ${after}`);
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${before} -> ${after} / ${required.length}`);
