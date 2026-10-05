import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const vault = "/home/aaron/Schreibtisch/Obsidian/DnD OT";
const build = "e6cccc0cd4c1a22e1db29307437631b20a269324b8444632adb920d2293e30f8";
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const plugin = path.join(vault, ".obsidian/plugins/dungeon-editor");
if (sha(path.join(plugin, "main.js")) !== build)
  throw new Error("Installierter Build weicht vom DD-028.16-Hostlauf ab.");
const backup = JSON.parse(fs.readFileSync(path.join(qa,
  "releases/dd02816-final-20261005/backup-manifest.json"), "utf8"));
for (const map of backup.maps) if (sha(path.join(vault, map.path)) !== map.sha256)
  throw new Error(`Produktive Karte verändert: ${map.path}`);
const original = path.join(root, "qa/dd028-dd021/DD-028-16-17-ORIGINAL.md");
if (!fs.readFileSync(original, "utf8").includes("7292b2"))
  throw new Error("Direkte Originalmessung des geänderten Scatter-Werts fehlt.");

const evidenceDir = path.join(qa, "dd02816-final-installed/evidence");
const editFile = path.join(evidenceDir, "1791227422428-objekte-03-edit/group-cases.json");
const reopenFile = path.join(evidenceDir, "1791227440795-objekte-03-reopen/group-cases.json");
const regressionDir = path.join(qa, "dd02816-final-dd02817-regression/evidence");
const regressionEdit = path.join(regressionDir, "1791227458167-objekte-03-edit/group-cases.json");
const regressionReopen = path.join(regressionDir, "1791227481101-objekte-03-reopen/group-cases.json");
const readGroup = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.build !== build || data.counts.fail || data.counts.deviation)
    throw new Error(`Hostlauf unpassend oder fehlgeschlagen: ${file}`);
  return new Map(data.cases.map((item) => [item.caseId, item]));
};
const edit = readGroup(editFile), reopen = readGroup(reopenFile);
const priorEdit = readGroup(regressionEdit), priorReopen = readGroup(regressionReopen);
const id = "DD-028.16";
if (edit.get(id)?.state !== "pass" || reopen.get(id)?.state !== "pass" ||
    priorEdit.get("DD-028.17")?.state !== "pass" ||
    priorReopen.get("DD-028.17")?.state !== "pass")
  throw new Error("DD-028.16 oder DD-028.17-Regression nicht bestanden.");
const editResult = path.join(evidenceDir,
  "1791227422428-objekte-03-edit/dd02816-scatter-edit.json");
const reopenResult = path.join(evidenceDir,
  "1791227440795-objekte-03-reopen/dd02816-scatter-reopen.json");
const first = JSON.parse(fs.readFileSync(editResult, "utf8"));
const second = JSON.parse(fs.readFileSync(reopenResult, "utf8"));
if (first.changed.targetHex !== "4080c0" ||
    first.changed.reopenedHex !== "4080c0" ||
    first.changed.afterOutside.toolColor !== 0x4080c0 ||
    second.changed.targetHex !== "7292b2" ||
    second.changed.reopenedHex !== "7292b2" ||
    second.changed.afterOutside.toolColor !== 0x7292b2 ||
    first.diskSha256 !== second.diskSha256)
  throw new Error("Geänderte Farbe, Wiederöffnung oder Kartenschutz nicht belegt.");

const ledgerFile = path.join(root, "acceptance.json");
const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
const cases = new Map(ledger.strictParity.cases.map((item) => [item.id, item]));
const required = [...cases.values()].filter((item) => item.scope === "required");
const previous = required.filter((item) => item.hostCheck.state === "equal").length;
if (required.length !== 707 || previous !== 40)
  throw new Error(`Unerwarteter Ausgangsstand ${previous}/${required.length}.`);
const item = cases.get(id);
if (item.scope !== "required" || item.hostCheck.state === "equal" ||
    !item.original.version || !item.original.evidence.length)
  throw new Error("Pflichtfall oder direkter Originalbeleg fehlt.");
const add = (list, ...values) => [...new Set([...(list ?? []), ...values])];
const report = path.join(root, "qa/dd028-dd021/DD-028-16-RELEASE.md");
const manifest = path.join(qa, "releases/dd02816-final-20261005/installation-manifest.json");
item.original.effect = "Die kreisförmige Scatter-Farbtaste öffnet den RGBA/Hex-Picker. Außenklick schließt ihn auch nach Farbänderung; der gültige Wert bleibt im Werkzeugfeld und beim erneuten Öffnen erhalten.";
item.original.evidence = add(item.original.evidence, original);
item.implementation = {
  state: "installed_verified",
  changes: add(item.implementation.changes,
    "Scatter-RGBA-Außenklick mit Wertübernahme im jeweiligen Editorfenster"),
  evidence: add(item.implementation.evidence, manifest, report),
};
item.hostCheck = {
  ...item.hostCheck,
  state: "equal", build,
  evidence: add(item.hostCheck.evidence,
    editFile, ...edit.get(id).evidence, editResult,
    reopenFile, ...reopen.get(id).evidence, reopenResult, report),
  gap: null,
  phaseStates: { edit: "pass", reopen: "pass" },
};
item.verifiedScope = "Scatter Tool: Picker öffnen; Innenklick erhält ihn, Außenklick schließt ihn unverändert oder nach gültiger RGB-Änderung und behält den Wert; Werkzeugvorgabe übersteht Neustart, Kartendokument/History/Disk bleiben gleich.";
const prior = cases.get("DD-028.17");
if (prior.hostCheck.state !== "equal") throw new Error("DD-028.17-Abnahme fehlt.");
prior.original.evidence = add(prior.original.evidence.filter((file) =>
  !file.endsWith("/objekte/qa/DD-028.16-17-ORIGINAL.md")), original);
prior.hostCheck.build = build;
prior.hostCheck.evidence = add(prior.hostCheck.evidence,
  regressionEdit, ...priorEdit.get("DD-028.17").evidence,
  regressionReopen, ...priorReopen.get("DD-028.17").evidence);
const current = required.filter((entry) => entry.hostCheck.state === "equal").length;
if (current !== 41) throw new Error(`Unerwarteter Endstand: ${current}`);
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${previous} -> ${current} / ${required.length}`);
