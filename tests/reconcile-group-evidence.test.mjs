import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { reconcileGroupEvidence } from "../tools/reconcile-group-evidence.mjs";

const script = fileURLToPath(new URL("../tools/reconcile-group-evidence.mjs", import.meta.url));
const copy = (value) => structuredClone(value);
const group = {
  id: "material-pfad", title: "Test", caseIds: ["DD-021.02", "DD-021.15"],
  originalEvidence: { "DD-021.02": ["native-point.png"],
    "DD-021.15": ["native-library.png"] },
  originalEffects: { "DD-021.02": "Gespeicherte Punktfolge", "DD-021.15": "Battlements gewählt" },
  originalGaps: { "DD-021.02": "Einmaliges Enter offen" },
};
const caseRecord = (caseId, state, phase) => ({ caseId, state,
  observation: state === "open" ? null : `${phase}: beobachtet`,
  evidence: [`${phase}-${caseId}.png`],
  gap: state === "open" ? `${phase}: offen` : null });
const report = (phase, states, build = "same-build") => ({
  schemaVersion: 1, groupId: group.id, phase, build,
  cases: group.caseIds.map((id, index) => caseRecord(id, states[index], phase)),
});
const acceptance = () => ({
  requirements: [{ id: "DD-021", status: "historisch" }],
  strictParity: { cases: [
    ...group.caseIds.map((id) => ({ id, baseline: { status: "old" },
      original: { effect: "alt", evidence: ["alt.png"], gap: "alte Lücke", version: "1.2.0.1" },
      hostCheck: { state: "installed_state", build: "installed-build",
        evidence: ["installed.png"], gap: "installiert offen" } })),
    { id: "DD-999.01", original: { effect: "fremd" },
      baseline: { status: "fremd" }, hostCheck: { state: "fremd" } },
  ] },
});

test("überträgt nur die Gruppe und belässt historische Abnahme sowie installierten Host", () => {
  const source = acceptance();
  const before = copy(source);
  const result = reconcileGroupEvidence({ acceptance: source, group,
    edit: report("edit", ["open", "pass"]),
    reopen: report("reopen", ["not_applicable", "pass"]),
    editFile: "/qa/edit/group-cases.json", reopenFile: "/qa/reopen/group-cases.json" });
  assert.deepEqual(result.requirements, before.requirements);
  assert.deepEqual(result.strictParity.cases[2], before.strictParity.cases[2]);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(result.strictParity.cases[i].baseline, before.strictParity.cases[i].baseline);
    const host = copy(result.strictParity.cases[i].hostCheck);
    delete host.candidate;
    assert.deepEqual(host, before.strictParity.cases[i].hostCheck);
  }
  const first = result.strictParity.cases[0];
  assert.equal(first.original.effect, "Gespeicherte Punktfolge");
  assert.deepEqual(first.original.evidence, ["alt.png", "native-point.png"]);
  assert.equal(first.original.gap, "Einmaliges Enter offen");
  assert.equal(first.hostCheck.candidate.state, "open");
  assert.deepEqual(first.hostCheck.candidate.phaseStates,
    { edit: "open", reopen: "not_applicable" });
  assert.equal(first.hostCheck.candidate.build, "same-build");
  assert.deepEqual(first.hostCheck.candidate.evidence,
    ["/qa/edit/group-cases.json", "edit-DD-021.02.png",
      "/qa/reopen/group-cases.json", "reopen-DD-021.02.png"]);
  const second = result.strictParity.cases[1];
  assert.equal(second.original.effect, "Battlements gewählt");
  assert.equal(Object.hasOwn(second.original, "gap"), false);
  assert.equal(second.hostCheck.candidate.state, "pass");
  assert.equal(second.hostCheck.state, "installed_state");
});

test("verweigert unterschiedliche Build-IDs und unvollständige Berichte vor jeder Änderung", () => {
  const source = acceptance();
  const before = copy(source);
  const options = { acceptance: source, group, edit: report("edit", ["pass", "pass"]),
    reopen: report("reopen", ["pass", "pass"], "other-build"),
    editFile: "edit.json", reopenFile: "reopen.json" };
  assert.throws(() => reconcileGroupEvidence(options), /Build-ID ungleich/);
  assert.deepEqual(source, before);
  options.reopen = report("reopen", ["pass", "pass"]);
  options.reopen.cases.pop();
  assert.throws(() => reconcileGroupEvidence(options), /fehlen/);
  assert.deepEqual(source, before);
});

test("Gruppe ohne originalEffects bewahrt vorhandene Wirkung und führt die Lücke", () => {
  const source = acceptance();
  const withoutEffects = copy(group);
  delete withoutEffects.originalEffects;
  withoutEffects.originalGaps["DD-021.15"] = "Wirkung der weiteren Kacheln offen";
  reconcileGroupEvidence({ acceptance: source, group: withoutEffects,
    edit: report("edit", ["open", "open"]),
    reopen: report("reopen", ["open", "open"]),
    editFile: "edit.json", reopenFile: "reopen.json" });
  assert.equal(source.strictParity.cases[1].original.effect, "alt");
  assert.equal(source.strictParity.cases[1].original.gap,
    "Wirkung der weiteren Kacheln offen");
});

test("CLI-Dry-Run schreibt nichts; normaler Lauf ist reproduzierbar", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-group-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tools/groups"), { recursive: true });
  const manifestFile = path.join(dir, "tools/groups/material.json");
  const acceptanceFile = path.join(dir, "acceptance.json");
  const editFile = path.join(dir, "edit.json");
  const reopenFile = path.join(dir, "reopen.json");
  const outputFile = path.join(dir, "candidate.json");
  const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  write(manifestFile, { groups: [group] });
  write(acceptanceFile, acceptance());
  write(editFile, report("edit", ["pass", "pass"]));
  write(reopenFile, report("reopen", ["not_applicable", "pass"]));
  const args = [script, "--group-id", group.id, "--edit", editFile,
    "--reopen", reopenFile, "--output", outputFile, "--acceptance", acceptanceFile];
  const run = (extra = []) => spawnSync(process.execPath, [...args, ...extra],
    { cwd: dir, encoding: "utf8" });
  assert.equal(run(["--dry-run"]).status, 0);
  assert.equal(fs.existsSync(outputFile), false);
  assert.equal(run().status, 0);
  const first = fs.readFileSync(outputFile, "utf8");
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(outputFile, "utf8"), first);
  assert.deepEqual(JSON.parse(fs.readFileSync(acceptanceFile)).strictParity.cases,
    acceptance().strictParity.cases);
  write(reopenFile, report("reopen", ["pass", "pass"], "other-build"));
  const failed = run();
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /Build-ID ungleich/);
  assert.equal(fs.readFileSync(outputFile, "utf8"), first);
});
