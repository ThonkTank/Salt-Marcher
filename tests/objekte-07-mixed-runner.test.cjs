const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createGroupRecord } = require("../tools/group-record.cjs");
const mixed = require("../tools/groups/scenarios/objekte-07-mixed.cjs");
const scenario = require("../tools/groups/scenarios/objekte-07.cjs");
const group = require("../tools/groups/objekte.json").groups
  .find((item) => item.id === "objekte-07");

test("isolated mixed prefab mode records each DD case once", async () => {
  assert(group);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "dd042-mixed-record-"));
  const edit = mixed.edit, reopen = mixed.reopen;
  process.argv.push("--mixed-prefab");
  try {
    mixed.edit = async () => [
      { caseId: "DD-042.01", state: "pass", observation: "mixed dialog",
        evidence: ["selection.png"] },
      { caseId: "DD-042.08", state: "pass", observation: "mixed cancel",
        evidence: ["cancel.json"] },
      { caseId: "DD-042.07", state: "pass", observation: "mixed prefab",
        evidence: ["prefab.json"] },
    ];
    mixed.reopen = async () => [
      { caseId: "DD-042.07", state: "pass", observation: "reopened prefab",
        evidence: ["reopen.json"] },
    ];
    const editRecord = createGroupRecord(group, out, "test-build", "edit");
    await scenario({ restart: false, record: editRecord });
    const first = editRecord.finish();
    assert.equal(first.counts.pass, 3);
    assert.equal(first.counts.open, group.caseIds.length - 3);
    assert.equal(new Set(first.cases.map((item) => item.caseId)).size,
      group.caseIds.length);

    const reopenRecord = createGroupRecord(group, out, "test-build", "reopen");
    await scenario({ restart: true, record: reopenRecord });
    const second = reopenRecord.finish();
    assert.equal(second.counts.pass, 1);
    assert.equal(second.counts.open, group.caseIds.length - 1);
    assert.equal(second.cases.find((item) => item.caseId === "DD-042.01")?.state,
      "open");
  } finally {
    mixed.edit = edit;
    mixed.reopen = reopen;
    process.argv.splice(process.argv.indexOf("--mixed-prefab"), 1);
    fs.rmSync(out, { recursive: true, force: true });
  }
});
