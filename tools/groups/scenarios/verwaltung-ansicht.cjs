const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dd041 = require("../../dd041-host-navigation.cjs");

const mapPath = "Dungeons/NavigationQA/Karte.dungeon";

module.exports = async function navigationGroup({ page, out, qa, restart, record }) {
  const savedPath = path.join(qa, "group-saved.json");
  const snap = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    return editor && { document: editor.session.document(), dirty: editor.session.dirty };
  });
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    assert.equal(saved.mapPath, mapPath);
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const reopened = await snap();
    const persisted = !reopened.dirty &&
      JSON.stringify(reopened.document) === JSON.stringify(saved.document);
    const evidencePath = path.join(out, "reopened.json");
    fs.writeFileSync(evidencePath, JSON.stringify({ saved, reopened, persisted }, null, 2) + "\n");
    for (const id of ["DD-041.02", "DD-041.03", "DD-041.04"])
      record.add(id, persisted ? "pass" : "fail",
        "Die nach Navigation gespeicherte Karte wurde im frischen Hostprozess ohne Kartenänderung geöffnet.",
        [evidencePath]);
    return;
  }

  const result = await dd041({ page, out });
  const evidencePath = path.join(out, "dd041-navigation-result.json");
  for (const id of ["DD-041.02", "DD-041.03", "DD-041.04"]) {
    const observations = result.records.filter((item) => item.caseId === id);
    const passed = observations.length > 0 && observations.every((item) => item.passed);
    record.add(id, passed ? "pass" : "fail",
      `${observations.length} Navigationsteilprüfungen; Kamera, Weltpunkt, Karte und Verlauf gemessen.`,
      [evidencePath]);
  }
  const saved = await snap();
  assert(saved && !saved.dirty, "Navigation changed the map or left unsaved changes");
  fs.writeFileSync(savedPath, JSON.stringify({ mapPath, ...saved }, null, 2) + "\n");
};
