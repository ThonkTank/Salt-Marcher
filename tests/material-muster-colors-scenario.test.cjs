const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const scenario = require("../tools/groups/scenarios/material-muster-colors.cjs");
const manifest = require("../tools/groups/material.json");

test("DD-020 color mode records each group case exactly once on an early host failure", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd020-color-record-"));
  try {
    const group = manifest.groups.find((item) => item.id === "material-muster");
    assert(group);
    const records = [];
    const page = { evaluate: () => { throw new Error("synthetic host unavailable"); } };
    await assert.rejects(scenario({ page, out: root, qa: root, vault: root,
      restart: false, group,
      record: { add: (...args) => records.push(args) } }),
    /synthetic host unavailable/);
    assert.equal(records.length, group.caseIds.length);
    assert.deepEqual(records.map(([id]) => id), group.caseIds);
    assert(records.every(([, state]) => state === "open"));
    const steps = JSON.parse(fs.readFileSync(
      path.join(root, "material-muster-colors-steps.json"), "utf8"));
    assert.match(steps.error, /synthetic host unavailable/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
