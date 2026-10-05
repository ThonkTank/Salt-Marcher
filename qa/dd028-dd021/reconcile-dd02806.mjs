import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const vault = "/home/aaron/Schreibtisch/Obsidian/DnD OT";
const build = "fb0bac92ff808fbf6f86185b22e9a5ba2dee6ccca7ea43e7e7b12dcda17a8c80";
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const plugin = path.join(vault, ".obsidian/plugins/dungeon-editor");
if (sha(path.join(plugin, "main.js")) !== build)
  throw new Error("Installierter Build weicht vom DD-028.06-Hostlauf ab.");
const backup = JSON.parse(fs.readFileSync(path.join(qa,
  "releases/dd02806-20261005-final/backup-manifest.json"), "utf8"));
for (const map of backup.maps) if (sha(path.join(vault, map.path)) !== map.sha256)
  throw new Error(`Produktive Karte verändert: ${map.path}`);

const evidenceDir = path.join(qa, "dd02806-installed/evidence");
const editFile = path.join(evidenceDir, "1791225604342-objekte-03-edit/group-cases.json");
const reopenFile = path.join(evidenceDir, "1791225635844-objekte-03-reopen/group-cases.json");
const readGroup = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.build !== build || data.counts.fail || data.counts.deviation)
    throw new Error(`Hostlauf unpassend oder fehlgeschlagen: ${file}`);
  return new Map(data.cases.map((item) => [item.caseId, item]));
};
const edit = readGroup(editFile), reopen = readGroup(reopenFile);
const id = "DD-028.06";
if (edit.get(id)?.state !== "pass" || reopen.get(id)?.state !== "pass")
  throw new Error("DD-028.06 ist nicht in beiden Phasen bestanden.");
const tileResult = path.join(evidenceDir,
  "1791225604342-objekte-03-edit/object-library-tile-result.json");
const tile = JSON.parse(fs.readFileSync(tileResult, "utf8"));
if (tile.caseId !== id || tile.a128BeforeAccept.hash !== tile.a128AfterRefresh ||
    tile.a0BeforeEscape.hash !== tile.a0AfterRefresh ||
    tile.pixels.transparentColorable <= 0 || tile.pixels.fixedVisible <= 0)
  throw new Error("Kachel-Vorschau und Neuaufbau nicht stabil belegt.");

const ledgerFile = path.join(root, "acceptance.json");
const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
const cases = new Map(ledger.strictParity.cases.map((item) => [item.id, item]));
const required = [...cases.values()].filter((item) => item.scope === "required");
const previous = required.filter((item) => item.hostCheck.state === "equal").length;
if (required.length !== 707 || previous !== 38)
  throw new Error(`Unerwarteter Ausgangsstand ${previous}/${required.length}.`);
const item = cases.get(id);
if (item.scope !== "required" || item.hostCheck.state === "equal" ||
    !item.original.version || !item.original.evidence.length)
  throw new Error("Pflichtfall oder direkter Originalbeleg fehlt.");
const add = (list, ...values) => [...new Set([...(list ?? []), ...values])];
const report = path.join(root, "qa/dd028-dd021/DD-028-06-RELEASE.md");
const manifest = path.join(qa, "releases/dd02806-20261005-final/installation-manifest.json");
item.implementation = {
  state: "installed_verified",
  changes: add(item.implementation.changes,
    "Colorable-Bibliothekskachel zeigt RGBA live und nach Panel-Neuaufbau"),
  evidence: add(item.implementation.evidence, manifest, report),
};
item.hostCheck = {
  ...item.hostCheck,
  state: "equal",
  build,
  evidence: add(item.hostCheck.evidence,
    editFile, ...edit.get(id).evidence, tileResult,
    reopenFile, ...reopen.get(id).evidence, report),
  gap: null,
  phaseStates: { edit: "pass", reopen: "pass" },
  candidate: {
    state: "installed_verified", build,
    observation: "RGBA-Livevorschau der Bibliothekskachel vor Accept und Escape, stabil nach Panel-Neuaufbau; platzierte und ausgewählte Objekte mit History und Frischöffnung geprüft.",
    evidence: [editFile, tileResult, reopenFile],
    phaseStates: { edit: "pass", reopen: "pass" },
  },
};
item.verifiedScope = "Object Tool, Colorable-QA-Objekt: A128/A0-Livekachel, feste Pixel, Accept/Escape, Platzierung, ausgewählte Instanz, Undo/Redo, Save und frischer Start.";

for (const caseId of ["DD-028.08", "DD-028.09", "DD-028.11", "DD-028.12"]) {
  const accepted = cases.get(caseId);
  if (accepted?.hostCheck.state !== "equal" ||
      edit.get(caseId)?.state !== "pass" || reopen.get(caseId)?.state !== "pass")
    throw new Error(`Bereits abgenommener Regressionsfall fehlgeschlagen: ${caseId}`);
  accepted.hostCheck.build = build;
  accepted.hostCheck.evidence = add(accepted.hostCheck.evidence,
    editFile, ...edit.get(caseId).evidence,
    reopenFile, ...reopen.get(caseId).evidence);
}
const current = required.filter((entry) => entry.hostCheck.state === "equal").length;
if (current !== 39) throw new Error(`Unerwarteter Endstand: ${current}`);
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${previous} -> ${current} / ${required.length}`);
