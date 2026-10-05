import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const vault = "/home/aaron/Schreibtisch/Obsidian/DnD OT";
const build = "d9f6549d081a9d22fd93fb901a0c2eef66e2c6ee139d50b41c50bff5953d53cf";
const ledgerPath = path.join(root, "acceptance.json");
const installed = path.join(vault, ".obsidian/plugins/dungeon-editor/main.js");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (sha(installed) !== build) throw new Error("Installierter Build weicht vom Prüflauf ab.");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const cases = new Map(ledger.strictParity.cases.map((item) => [item.id, item]));
const required = [...cases.values()].filter((item) => item.scope === "required");
const previous = required.filter((item) => item.hostCheck.state === "equal").length;
if (previous !== 25 || required.length !== 707) throw new Error("Unerwarteter Abnahmestand.");
const report = path.join(root, "qa/dd020-rgb/RELEASE-ACCEPTANCE.md");
const manifest = path.join(qa, "releases/dd020-rgb-20261005/installation-manifest.json");
const file = (dir, run, name = "group-cases.json") =>
  path.join(qa, dir, "evidence", run, name);
const materialEdit = file("dd020-installed-host", "1791219256136-material-muster-edit");
const materialReopen = file("dd020-installed-host", "1791219291160-material-muster-reopen");
const mixedEdit = file("dd020-installed-mixed-regression", "1791219537469-objekte-07-edit");
const mixedReopen = file("dd020-installed-mixed-regression", "1791219586448-objekte-07-reopen");
const colorsEdit = file("dd020-colors-installed-host", "1791219718678-material-muster-edit", "material-muster-colors-steps.json");
const colorsReopen = file("dd020-colors-installed-host", "1791219750932-material-muster-reopen", "material-muster-colors-steps.json");
const add = (array, ...values) => [...new Set([...array, ...values])];
const get = (id) => {
  const item = cases.get(id);
  if (!item || item.scope !== "required") throw new Error(`Pflichtfall fehlt: ${id}`);
  return item;
};
const equal = (id, scope, evidence, changes) => {
  const item = get(id);
  if (item.hostCheck.state === "equal") throw new Error(`Schon abgenommen: ${id}`);
  item.implementation = {
    state: "installed_verified",
    changes: [changes],
    evidence: add(item.implementation.evidence, manifest, report),
  };
  item.hostCheck = {
    state: "equal", build,
    evidence: add(item.hostCheck.evidence, ...evidence, report),
    gap: null,
    phaseStates: { edit: "pass", reopen: "not_applicable" },
  };
  item.verifiedScope = scope;
};
const material = [
  ["DD-020.05", "Polygonlinie zwischen erstem Punkt und Zeiger sichtbar; weiterer Werkzeugumfang offen."],
  ["DD-020.06", "Escape entfernt einen begonnenen Polygonentwurf ohne neuen Karteneintrag oder Historyschritt."],
  ["DD-020.16", "Undo entfernt genau eine platzierte Musterfläche im Grundfall."],
  ["DD-020.26", "Hex ff00ff wird nach Accept als sichtbares Magenta übernommen."],
  ["DD-020.27", "Accept schließt den Picker und zeigt ff00ff als Magenta; die Karte bleibt bis zur Zeichnung unverändert."],
  ["DD-020.29", "Redo stellt dieselbe zuvor entfernte Musterfläche im Grundfall wieder her."],
];
for (const [id, scope] of material)
  equal(id, scope, [materialEdit], id.endsWith("26") || id.endsWith("27")
    ? "Musterfarbwähler im installierten Plugin"
    : "bestehendes Musterwerkzeug, direkt auf installiertem Build geprüft");

const prefab = get("DD-042.01");
prefab.original.evidence = add(prefab.original.evidence,
  "/home/aaron/.cache/dungeon-native-qa/evidence/native-mixed-prefab.json",
  "/home/aaron/.cache/dungeon-native-qa/evidence/native-mixed-prefab-dialog.png");
equal("DD-042.01",
  "Gemischte Objekt-Licht-Auswahl öffnet Make Prefab mit Set, Name und Bestätigung; X erfüllt die gemessene Abbruchwirkung.",
  [mixedEdit, mixedReopen], "bestehender Vorlagendialog, unabhängig und erneut auf installiertem Build geprüft");
prefab.hostCheck.phaseStates.reopen = "pass";

// The measured controls are present and persistent in the host, but their
// original pixel effect could not be isolated after two failed native drags.
const colorValues = [
  ["DD-020.21", "Farbfeld", "424958"],
  ["DD-020.22", "Hue-Leiste", "7ccc33"],
  ["DD-020.23", "R=100", "6466cc"],
  ["DD-020.24", "G=150", "3396cc"],
  ["DD-020.25", "B=50", "336632"],
];
for (const [id, action, rgb] of colorValues) {
  const item = get(id);
  item.original.effect = `${action} ergab RGB #${rgb}, A255; im Original als ff${rgb} gespeichert.`;
  item.original.evidence = add(item.original.evidence,
    path.join(qa, "dd020-color-native/RESULT.md"));
  item.implementation = {
    state: "installed_unverified",
    changes: ["Farbsteuerung im installierten Musterfarbwähler vorhanden"],
    evidence: add(item.implementation.evidence, manifest, report),
  };
  item.hostCheck = {
    state: "open", build,
    evidence: add(item.hostCheck.evidence, colorsEdit, colorsReopen, report),
    gap: id === "DD-020.22"
      ? "Original: überlappende Flächen verhinderten den Pixelvergleich und Original-Frischstart; Pointerzuordnung der Hue-Leiste offen."
      : "Original: überlappende Flächen verhinderten den Pixelvergleich und Original-Frischstart.",
    observedScope: `Host: #${rgb}/A255, Vorschau, Undo/Redo und Frischstart belegt.`,
  };
}

const nativeFirstSave = path.join(root, "qa/dd001002/DD-001-04-NATIVE-RESULT.md");
const firstSave = get("DD-001.04");
firstSave.original.effect = "Neue 8×8-Karte bleibt bis zum ersten Save ohne Kartendatei bearbeitbar. Undo/Redo vor und nach dem ersten Save erhalten denselben History-Schritt; Undo/Redo ändern die gespeicherte Datei nicht automatisch.";
firstSave.original.evidence = add(firstSave.original.evidence, nativeFirstSave);
firstSave.target = "Neue Karte ohne Kartendatei bearbeiten; Datei erst bei manuellem Save erzeugen und History beim Übergang erhalten.";
firstSave.hostCheck = {
  state: "deviation", build,
  evidence: add(firstSave.hostCheck.evidence,
    file("dd020-installed-dd001002-regression", "1791219665084-verwaltung-karte-datei-edit"),
    nativeFirstSave),
  gap: "Der installierte Editor erzeugt die .dungeon-Datei bereits vor dem ersten Save; Pending-View und Session-Handoff fehlen.",
};

const objectPicker = get("DD-028.08");
objectPicker.original.effect = "Accept schließt den Object-Tool-Picker; die folgende Colorable-Instanz übernimmt RGB #4080c0 und A128 als 804080c0.";
objectPicker.original.evidence = add(objectPicker.original.evidence,
  "/home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/native-dd028-rgba-20261005/DD-028.06-ORIGINAL.md");
objectPicker.hostCheck = {
  state: "deviation", build,
  evidence: add(objectPicker.hostCheck.evidence,
    file("dd02808-installed-probe", "1791219912923-objekte-03-edit", "failure.png"),
    file("dd02808-installed-probe", "1791219912923-objekte-03-edit", "result.json")),
  gap: "Der RGBA-Picker-Öffner fehlt im installierten Object Tool; der Hostlauf stoppte vor Accept.",
};

const pathUndo = get("DD-021.20");
pathUndo.hostCheck = {
  state: "deviation", build,
  evidence: add(pathUndo.hostCheck.evidence,
    file("dd02120-installed-regression", "1791220006150-material-pfad-edit", "result.json")),
  gap: "Die Anbindung des eingebauten Assetarchivs fehlt im installierten Plugin; der Battlements-Pfad ist für diese Undo-Folge nicht erreichbar.",
};

// Refresh only previously equal cases that passed a direct regression on this
// exact installed build. Do not promote other technical group passes.
const regressions = [
  materialReopen,
  file("dd020-installed-dd042-regression", "1791219318246-objekte-07-edit"),
  file("dd020-installed-dd042-regression", "1791219356752-objekte-07-reopen"),
  mixedEdit, mixedReopen,
  file("dd020-installed-dd039-regression", "1791219616184-verwaltung-karte-datei-edit"),
  file("dd020-installed-dd039-regression", "1791219641896-verwaltung-karte-datei-reopen"),
  file("dd020-installed-dd001002-regression", "1791219665084-verwaltung-karte-datei-edit"),
  file("dd020-installed-dd001002-regression", "1791219690674-verwaltung-karte-datei-reopen"),
];
for (const source of regressions) {
  const data = JSON.parse(fs.readFileSync(source, "utf8"));
  for (const result of data.cases) {
    if (result.state !== "pass") continue;
    const item = get(result.caseId);
    if (item.hostCheck.state !== "equal") continue;
    item.hostCheck.build = build;
    item.hostCheck.evidence = add(item.hostCheck.evidence, source);
  }
}

const current = required.filter((item) => item.hostCheck.state === "equal").length;
if (current !== 32) throw new Error(`Unerwarteter Endstand: ${current} statt 32`);
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${previous} -> ${current} / ${required.length}`);
