import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const vault = "/home/aaron/Schreibtisch/Obsidian/DnD OT";
const build = "e3fc2028eb756a35a43a6b16b6441b23a65516803957c0d83ce2656f1b9db2ce";
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const plugin = path.join(vault, ".obsidian/plugins/dungeon-editor");
if (sha(path.join(plugin, "main.js")) !== build)
  throw new Error("Installierter Build weicht vom DD-028.17-Hostlauf ab.");
const backup = JSON.parse(fs.readFileSync(path.join(qa,
  "releases/dd02817-20261005/backup-manifest.json"), "utf8"));
for (const map of backup.maps) if (sha(path.join(vault, map.path)) !== map.sha256)
  throw new Error(`Produktive Karte verändert: ${map.path}`);
const original = path.join(qa, "../objekte/qa/DD-028.16-17-ORIGINAL.md");
if (!fs.readFileSync(original, "utf8").includes("Jede der fünf Kacheln wurde einzeln angeklickt"))
  throw new Error("Direkte Originalmessung aller fünf Kacheln fehlt.");

const evidenceDir = path.join(qa, "dd02817-installed/evidence");
const editFile = path.join(evidenceDir, "1791226922542-objekte-03-edit/group-cases.json");
const reopenFile = path.join(evidenceDir, "1791226942162-objekte-03-reopen/group-cases.json");
const readGroup = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.build !== build || data.counts.fail || data.counts.deviation)
    throw new Error(`Hostlauf unpassend oder fehlgeschlagen: ${file}`);
  return new Map(data.cases.map((item) => [item.caseId, item]));
};
const edit = readGroup(editFile), reopen = readGroup(reopenFile);
const id = "DD-028.17";
if (edit.get(id)?.state !== "pass" || reopen.get(id)?.state !== "pass")
  throw new Error("DD-028.17 ist nicht in beiden Phasen bestanden.");
const measurementFile = path.join(evidenceDir,
  "1791226922542-objekte-03-edit/dd02817-light-palette-edit.json");
const measurement = JSON.parse(fs.readFileSync(measurementFile, "utf8"));
const measured = [
  ["Warm", 0xeccd8b], ["Blass", 0xeaefca],
  ["Orange", 0xffad58], ["Grün", 0x4dd569], ["Blau", 0x80beff],
];
if (JSON.stringify(measurement.measuredPresets) !== JSON.stringify(measured) ||
    measurement.pluginLightColor !== 0x80beff ||
    measurement.before.historySize !== measurement.after.historySize ||
    measurement.before.dirty !== measurement.after.dirty ||
    JSON.stringify(measurement.before.document) !==
      JSON.stringify(measurement.after.document))
  throw new Error("Fünf Farben oder Kartenschutz nicht belegt.");

const ledgerFile = path.join(root, "acceptance.json");
const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
const cases = new Map(ledger.strictParity.cases.map((item) => [item.id, item]));
const required = [...cases.values()].filter((item) => item.scope === "required");
const previous = required.filter((item) => item.hostCheck.state === "equal").length;
if (required.length !== 707 || previous !== 39)
  throw new Error(`Unerwarteter Ausgangsstand ${previous}/${required.length}.`);
const item = cases.get(id);
if (item.scope !== "required" || item.hostCheck.state === "equal" ||
    !item.original.version || !item.original.evidence.length)
  throw new Error("Pflichtfall oder direkter Originalbeleg fehlt.");
const add = (list, ...values) => [...new Set([...(list ?? []), ...values])];
const report = path.join(root, "qa/dd028-dd021/DD-028-17-RELEASE.md");
const manifest = path.join(qa, "releases/dd02817-20261005/installation-manifest.json");
item.original.effect = "Fünf Light-Vorgaben schließen nach jeweiligem Klick die Palette und setzen das Werkzeugfeld auf ECCD8B, EAEFCA, 80BEFF, FFAD58 oder 4DD569; der erneut geöffnete Picker zeigt denselben RGB/Hex-Wert bei A255.";
item.original.evidence = add(item.original.evidence, original);
item.implementation = {
  state: "installed_verified",
  changes: add(item.implementation.changes,
    "Fünf native Light-Farbvorgaben und persistente Werkzeugfarbe"),
  evidence: add(item.implementation.evidence, manifest, report),
};
item.hostCheck = {
  ...item.hostCheck,
  state: "equal", build,
  evidence: add(item.hostCheck.evidence,
    editFile, ...edit.get(id).evidence, measurementFile,
    reopenFile, ...reopen.get(id).evidence, report),
  gap: null,
  phaseStates: { edit: "pass", reopen: "pass" },
};
item.verifiedScope = "Light Tool ohne ausgewählte Instanz: Palette mit fünf Werten; jede Wahl übernimmt RGB ins Werkzeugfeld und schließt, Blau bleibt als Werkzeugvorgabe nach frischem Start; Karte und History unverändert.";
const current = required.filter((entry) => entry.hostCheck.state === "equal").length;
if (current !== 40) throw new Error(`Unerwarteter Endstand: ${current}`);
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${previous} -> ${current} / ${required.length}`);
