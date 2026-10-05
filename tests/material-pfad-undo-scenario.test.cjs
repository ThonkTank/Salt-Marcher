const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const scenario = require("../tools/groups/scenarios/material-pfad-undo.cjs");
const manifest = require("../tools/groups/material.json");

test("DD-021.20 isolated mode records every group ID once when source preflight fails", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd02120-record-"));
  try {
    const group = manifest.groups.find((item) => item.id === "material-pfad");
    assert(group);
    const records = [];
    await assert.rejects(scenario({ page: {}, out: root, restart: true, group,
      record: { add: (...args) => records.push(args) } }),
    /keine Reopenphase/);
    assert.equal(records.length, group.caseIds.length);
    assert.deepEqual(records.map(([id]) => id), group.caseIds);
    assert(records.every(([, state]) => state === "open"));
    const steps = JSON.parse(fs.readFileSync(path.join(root, "dd02120-steps.json"), "utf8"));
    assert.match(steps.error, /keine Reopenphase/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
