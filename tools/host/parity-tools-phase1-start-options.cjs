const CASES = [
  { name: "Phase1-Start-A", wallShadows: false, objectShadows: true,
    nativeBuildingWear: false },
  { name: "Phase1-Start-B", wallShadows: true, objectShadows: false,
    nativeBuildingWear: true },
];

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-start-options-baseline.json");
  const mapPath = (name) => `Dungeons/${name}/Karte.dungeon`;
  const modal = () => page.locator(".modal:visible")
    .filter({ hasText: "Dungeon anlegen" }).last();
  const setting = (dialog, label) => dialog.locator(".setting-item")
    .filter({ has: page.locator(".setting-item-name", { hasText: label }) });
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, mapPath(name)))).digest("hex");
  const toggleValue = (control) => control.evaluate((node) =>
    node.parentElement?.classList.contains("is-enabled") ?? false);
  const settings = (doc) => ({
    wallShadows: doc.settings.wallShadows,
    objectShadows: doc.settings.objectShadows,
    nativeBuildingWear: doc.settings.nativeBuildingWear,
    buildingWear: doc.settings.buildingWear,
  });
  async function openNew() {
    assert.equal(await page.evaluate(() =>
      app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
    const dialog = modal();
    await setting(dialog, "Wandschatten deaktivieren")
      .waitFor({ state: "visible", timeout: 45000 });
    return dialog;
  }
  async function edit() {
    const saved = [];
    for (const candidate of CASES) {
      const dialog = await openNew();
      const toggles = [
        ["Wandschatten deaktivieren", !candidate.wallShadows],
        ["Objektschatten deaktivieren", !candidate.objectShadows],
        ["Gebäudeabnutzung deaktivieren", !candidate.nativeBuildingWear],
      ];
      for (const [label, disabled] of toggles) {
        const control = setting(dialog, label).getByRole("checkbox");
        if ((await toggleValue(control)) !== disabled) await control.click();
        assert.equal(await toggleValue(control), disabled);
      }
      await setting(dialog, "Name").locator("input").fill(candidate.name);
      await setting(dialog, "Breite in Feldern").locator("input").fill("8");
      await setting(dialog, "Höhe in Feldern").locator("input").fill("8");
      await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
      await page.waitForFunction((file) =>
        !!app.workspace.getLeavesOfType("dungeon-native-pending")
          .find((leaf) => leaf.view?.editor && leaf.view.getState().path === file),
        mapPath(candidate.name), { timeout: 30000 });
      const pending = await page.evaluate((file) =>
        app.workspace.getLeavesOfType("dungeon-native-pending")
          .find((leaf) => leaf.view.getState().path === file)
          .view.editor.session.document(), mapPath(candidate.name));
      assert.deepEqual(settings(pending), { wallShadows: candidate.wallShadows,
        objectShadows: candidate.objectShadows,
        nativeBuildingWear: candidate.nativeBuildingWear, buildingWear: 0 });
      assert.equal(fs.existsSync(path.join(vault, mapPath(candidate.name))), false);
      await page.locator(".dungeon-native-editor:visible").last()
        .getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction((file) => !!app.vault.getAbstractFileByPath(file),
        mapPath(candidate.name));
      await page.waitForFunction((file) =>
        !app.workspace.getLeavesOfType("dungeon-native-pending")
          .some((leaf) => leaf.view.getState().path === file),
      mapPath(candidate.name));
      const document = JSON.parse(fs.readFileSync(path.join(vault, mapPath(candidate.name)), "utf8"));
      assert.deepEqual(settings(document), settings(pending));
      saved.push({ name: candidate.name, document, hash: hash(candidate.name) });
    }
    fs.writeFileSync(baseline, JSON.stringify(saved, null, 2));
    fs.writeFileSync(path.join(out, "start-options.json"), JSON.stringify(
      saved.map(({ name, document, hash }) => ({ name, settings: settings(document), hash })), null, 2));
    await page.screenshot({ path: path.join(out, "start-options-saved.png") });
    checks.push("DD-006 wall and object shadow disable switches independently set the stored values");
    checks.push("DD-007 building wear disable switch stores the native wear flag");
    checks.push("DD-006/007 both maps stay pending until Save and retain their settings in V4");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    for (const { name, document, hash: originalHash } of saved) {
      await page.evaluate(async (file) =>
        app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(file)),
      mapPath(name));
      await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
      const current = await page.evaluate(() =>
        app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          .view.editor.session.document());
      assert.deepEqual(current, document);
      assert.equal(hash(name), originalHash);
    }
    checks.push("DD-006/007 both distinct start-option combinations reopen byte unchanged");
  }
  return { edit, reopen };
};
