import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const qa = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa";
const vaultPlugin = "/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-editor";
const build = "84d19bbde22160e5d4cabe651cc7f873a60d5d9bb11e025af68d65a58d08b0d4";
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (sha(path.join(vaultPlugin, "main.js")) !== build)
  throw new Error("Installierter Build weicht vom geprüften Build ab.");
const ledgerPath = path.join(root, "acceptance.json");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const cases = new Map(ledger.strictParity.cases.map((item) => [item.id, item]));
const required = [...cases.values()].filter((item) => item.scope === "required");
const previous = required.filter((item) => item.hostCheck.state === "equal").length;
if (previous !== 32 || required.length !== 707)
  throw new Error(`Unerwarteter Ausgangsstand ${previous}/${required.length}.`);
const report = path.join(root, "qa/dd028-dd021/RELEASE-ACCEPTANCE.md");
const manifest = path.join(qa, "releases/dd028-dd021-20261005/installation-manifest.json");
const group = (dir, run) => path.join(qa, dir, "evidence", run, "group-cases.json");
const objectEdit = group("dd028-dd021-installed-object", "1791222555542-objekte-03-edit");
const objectReopen = group("dd028-dd021-installed-object", "1791222581701-objekte-03-reopen");
const pathEdit = group("dd028-dd021-installed-path", "1791222617432-material-pfad-edit");
const pathReopen = group("dd028-dd021-installed-path", "1791222662059-material-pfad-reopen");
const patternEdit = group("dd028-dd021-installed-dd020", "1791222851267-material-muster-edit");
const patternReopen = group("dd028-dd021-installed-dd020", "1791222872363-material-muster-reopen");
const dialogEdit = path.join(qa, "dd028-dd021-final-dialog84/evidence/1791222304206-native-path-dialog-edit/material-pfad-dialog-result.json");
const dialogReopen = path.join(qa, "dd028-dd021-final-dialog84/evidence/1791222345871-native-path-dialog-reopen/material-pfad-dialog-result.json");
const lifecycleEdit = path.join(qa, "dd028-picker-lifecycle84/evidence/1791222214601-objekte-03-edit/picker-lifecycle-edit.json");
const lifecycleReopen = path.join(qa, "dd028-picker-lifecycle84/evidence/1791222250508-objekte-03-reopen/picker-lifecycle-reopen.json");
const add = (array, ...values) => [...new Set([...(array ?? []), ...values])];
const readGroup = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.build !== build) throw new Error(`Falscher Hostbuild: ${file}`);
  if (data.counts.fail || data.counts.deviation)
    throw new Error(`Hostfehler: ${file}`);
  return new Map(data.cases.map((item) => [item.caseId, item]));
};
const objectsEdit = readGroup(objectEdit), objectsReopen = readGroup(objectReopen);
const pathsEdit = readGroup(pathEdit), pathsReopen = readGroup(pathReopen);
const patternsEdit = readGroup(patternEdit), patternsReopen = readGroup(patternReopen);
const get = (id) => {
  const item = cases.get(id);
  if (!item || item.scope !== "required") throw new Error(`Pflichtfall fehlt: ${id}`);
  return item;
};
const approve = (id, editFile, editMap, reopenFile, reopenMap, scope, changes, reopenState) => {
  const item = get(id), edit = editMap.get(id), reopened = reopenMap.get(id);
  if (item.hostCheck.state === "equal" || edit?.state !== "pass" ||
      reopened?.state !== reopenState)
    throw new Error(`Fall nicht fallgenau bestanden: ${id}`);
  if (!item.original.version || !item.original.evidence.length)
    throw new Error(`Originalbeleg fehlt: ${id}`);
  item.implementation = {
    state: "installed_verified",
    changes: add(item.implementation.changes, ...changes),
    evidence: add(item.implementation.evidence, manifest, report),
  };
  item.hostCheck = {
    ...item.hostCheck,
    state: "equal", build,
    evidence: add(item.hostCheck.evidence, editFile, ...edit.evidence,
      reopenFile, ...reopened.evidence, report),
    gap: null,
    phaseStates: { edit: "pass", reopen: reopenState },
  };
  item.verifiedScope = scope;
};

approve("DD-028.08", objectEdit, objectsEdit, objectReopen, objectsReopen,
  "Object Tool: Accept übernimmt RGB #4080c0/A128 als 804080c0 in die nächste Colorable-Instanz; Undo/Redo und Frischstart erhalten den Wert.",
  ["RGBA/Hex-Farbwähler und Objektplatzierung im installierten Plugin"], "pass");
approve("DD-028.09", objectEdit, objectsEdit, objectReopen, objectsReopen,
  "Object Tool: Farbknopf öffnet den RGBA/Hex-Wähler; Escape schließt ihn. Die Knopfform ist eine zulässige Oberflächenabweichung.",
  ["Öffner des RGBA/Hex-Farbwählers im installierten Plugin"], "pass");
approve("DD-021.20", pathEdit, pathsEdit, pathReopen, pathsReopen,
  "Ein Undo entfernt einen fertig platzierten Battlements-Pfad einschließlich Dokument- und Historyrückkehr.",
  ["eingebaute Battlements-Quelle und Pfad-History im installierten Plugin"], "not_applicable");
approve("DD-021.22", pathEdit, pathsEdit, pathReopen, pathsReopen,
  "Suchbegriff Battlements mit Return reduziert die native Pfadbibliothek auf genau eine Kachel, auch nach Neustart.",
  ["eingebaute Pfadbibliothek und Return-Suche im installierten Plugin"], "pass");
approve("DD-021.26", pathEdit, pathsEdit, pathReopen, pathsReopen,
  "Ein Redo stellt dieselbe zuvor entfernte Battlements-Pfad-ID und Assetreferenz wieder her.",
  ["eingebaute Battlements-Quelle und Pfad-History im installierten Plugin"], "not_applicable");

// Preserve measured but incomplete contexts as open/partial cases.
const alpha = get("DD-028.06");
alpha.implementation = {
  state: "installed_partial",
  changes: add(alpha.implementation.changes, "RGBA/Hex-Wähler und ausgewählte Livevorschau installiert"),
  evidence: add(alpha.implementation.evidence, manifest, report),
};
alpha.hostCheck = {
  ...alpha.hostCheck, state: "partial", build,
  evidence: add(alpha.hostCheck.evidence, objectEdit, objectReopen,
    lifecycleEdit, lifecycleReopen, report),
  gap: "Die im Original beobachtete Liveänderung der Bibliothekskachel vor Accept ist im installierten Host nicht belegt; Escape am ausgewählten Objekt, sechsstellige Hex-Eingabe bei A<255 und Außenklick bleiben im Original offen.",
  observedScope: "A0/A128, färbbare Pixel, ausgewählte Vorschau, History und frisches Öffnen funktionieren im Host.",
};
const preview = get("DD-021.02");
preview.implementation = {
  state: "installed_partial",
  changes: add(preview.implementation.changes, "Pfadplatzierung und native Textur erst nach Abschluss"),
  evidence: add(preview.implementation.evidence, manifest, report),
};
preview.hostCheck = {
  ...preview.hostCheck, state: "deviation", build,
  evidence: add(preview.hostCheck.evidence, pathEdit,
    path.join(qa, "dd028-dd021-installed-path/evidence/1791222617432-material-pfad-edit/horizontal-preview.png"),
    path.join(qa, "dd021-band-native/native-run1/evidence/04-horizontal-preview.png"), report),
  gap: "Das Original zeigt bereits im Entwurf das Battlements-Motiv; der installierte Editor zeigt nur eine einfarbige Pfadlinie. Die allgemeine Enter-Abschlussregel bleibt originalseitig offen.",
};
for (const id of ["DD-021.15", "DD-021.21"]) {
  const item = get(id);
  item.implementation = {
    state: "installed_partial",
    changes: add(item.implementation.changes,
      "verifizierte Original-PCK, native Pfadbibliothek und gerichteter Texturstreifen installiert"),
    evidence: add(item.implementation.evidence, manifest, report),
  };
  item.hostCheck = {
    ...item.hostCheck, state: "open", build,
    evidence: add(item.hostCheck.evidence, pathEdit, pathReopen,
      dialogEdit, dialogReopen, report),
    gap: id === "DD-021.15"
      ? "Original-/Host-Bildwirkung für alle drei Geometrien, UV-Umschlag, Knickradius und weitere Texturen/Optionen nicht vollständig gepaart; Livevorschau weicht ab."
      : "Original hat drei Battlements-Geometrien frisch geöffnet; der Host hat nur Gerade und Knick gepaart. Diagonale, exakte Texturwirkung und weitere Parameter fehlen.",
  };
}

// Refresh older equal cases only when directly exercised on this exact build.
for (const [file, results] of [
  [objectEdit, objectsEdit], [objectReopen, objectsReopen],
  [pathEdit, pathsEdit], [pathReopen, pathsReopen],
  [patternEdit, patternsEdit], [patternReopen, patternsReopen],
]) for (const result of results.values()) {
  if (result.state !== "pass") continue;
  const item = get(result.caseId);
  if (item.hostCheck.state !== "equal") continue;
  item.hostCheck.build = build;
  item.hostCheck.evidence = add(item.hostCheck.evidence, file, ...result.evidence);
}
const current = required.filter((item) => item.hostCheck.state === "equal").length;
if (current !== 37) throw new Error(`Unerwarteter Endstand: ${current} statt 37`);
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(`${previous} -> ${current} / ${required.length}`);
