const MAP = "Dungeons/Phase1-Vorlage/Karte.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const saved = path.join(qa, "phase1-new-map-baseline.json");
  const mapFile = path.join(vault, MAP);
  const modal = (title) => page.locator(".modal:visible")
    .filter({ hasText: title }).last();
  const field = (dialog, label) => dialog.locator(".setting-item")
    .filter({ has: page.locator(".setting-item-name", { hasText: label }) })
    .locator("input").first();
  const preset = (dialog) => dialog.locator(".setting-item")
    .filter({ has: page.locator(".setting-item-name", { hasText: "Größenvorlage" }) })
    .locator('select:not([aria-hidden="true"])');
  const openNew = async () => {
    assert.equal(await page.evaluate(() =>
      app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
    await modal("Dungeon anlegen").waitFor({ state: "visible", timeout: 45000 });
    await preset(modal("Dungeon anlegen")).waitFor({ state: "visible", timeout: 45000 });
    return modal("Dungeon anlegen");
  };
  const dimensions = async (dialog) => ({
    width: Number(await field(dialog, "Breite in Feldern").inputValue()),
    height: Number(await field(dialog, "Höhe in Feldern").inputValue()),
  });
  const pluginPresets = () => page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").sizePresets());
  const hash = () => crypto.createHash("sha256")
    .update(fs.readFileSync(mapFile)).digest("hex");
  async function edit() {
    const evidence = {};
    let parent = await openNew();
    const options = await preset(parent).locator("option").allTextContents();
    assert.deepEqual(options, ['40" TV', '55" TV', "A4 Paper", "A3 Paper"]);
    assert.deepEqual(await dimensions(parent), { width: 35, height: 20 });
    for (const [name, width, height] of [
      ['55" TV', 48, 27], ["A4 Paper", 11, 8],
      ["A3 Paper", 16, 11], ['40" TV', 35, 20],
    ]) {
      await preset(parent).selectOption(name);
      assert.deepEqual(await dimensions(parent), { width, height });
    }
    evidence.builtIns = options;
    checks.push("DD-002 four native built-in size templates select the measured dimensions");

    await field(parent, "Name").fill("Phase1-Vorlage");
    await parent.locator('[aria-label="Größenvorlage hinzufügen"]').click();
    let child = modal("Neue Größenvorlage");
    await child.waitFor({ state: "visible" });
    assert.deepEqual(await dimensions(child), { width: 8, height: 8 });
    await child.getByRole("button", { name: "Abbrechen", exact: true }).click();
    assert.equal(await field(parent, "Name").inputValue(), "Phase1-Vorlage");
    assert.deepEqual(await dimensions(parent), { width: 35, height: 20 });
    assert.deepEqual(await pluginPresets(), []);
    checks.push("DD-002 plus opens an 8×8 template dialog; Cancel preserves New Map state");

    await parent.locator('[aria-label="Größenvorlage hinzufügen"]').click();
    child = modal("Neue Größenvorlage");
    await child.waitFor({ state: "visible" });
    await field(child, "Name").fill("QA-Phase1");
    await field(child, "Breite in Feldern").fill("12");
    await field(child, "Höhe in Feldern").fill("9");
    await child.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await child.waitFor({ state: "hidden" });
    assert.equal(await preset(parent).inputValue(), "QA-Phase1");
    assert.deepEqual(await dimensions(parent), { width: 12, height: 9 });
    assert.deepEqual(await pluginPresets(), [{ name: "QA-Phase1", width: 12, height: 9 }]);
    assert.equal(await field(parent, "Name").inputValue(), "Phase1-Vorlage");
    await preset(parent).selectOption('40" TV');
    assert.deepEqual(await dimensions(parent), { width: 35, height: 20 });
    await preset(parent).selectOption("QA-Phase1");
    assert.deepEqual(await dimensions(parent), { width: 12, height: 9 });
    evidence.reselected = { name: "QA-Phase1", ...(await dimensions(parent)) };
    checks.push("DD-002 Accept stores a named 12×9 template and reselecting it restores both dimensions");

    await parent.locator('[aria-label="Gewählte Vorlage löschen"]').click();
    assert.equal(await preset(parent).inputValue(), '40" TV');
    assert.deepEqual(await dimensions(parent), { width: 12, height: 9 });
    assert.deepEqual(await pluginPresets(), []);
    evidence.afterDelete = { selected: await preset(parent).inputValue(),
      ...(await dimensions(parent)) };
    checks.push("DD-002 minus removes only the custom template and leaves entered dimensions unchanged");

    await parent.locator('[aria-label="Größenvorlage hinzufügen"]').click();
    child = modal("Neue Größenvorlage");
    await child.waitFor({ state: "visible" });
    await field(child, "Name").fill("Discarded");
    await child.locator(".modal-header-button").click();
    await child.waitFor({ state: "hidden" });
    assert.deepEqual(await pluginPresets(), []);
    await parent.locator(".modal-header-button").click();
    await parent.waitFor({ state: "hidden" });
    assert.equal(fs.existsSync(mapFile), false);
    checks.push("DD-001/002 X closes template and New Map without creating a card");

    parent = await openNew();
    await field(parent, "Name").fill("Phase1-Vorlage");
    await preset(parent).selectOption('55" TV');
    await parent.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await parent.waitFor({ state: "hidden" });
    assert.equal(fs.existsSync(mapFile), false);
    checks.push("DD-001 Cancel closes New Map without creating a card");

    parent = await openNew();
    assert.deepEqual(await dimensions(parent), { width: 35, height: 20 });
    await field(parent, "Name").fill("Phase1-Vorlage");
    await parent.locator('[aria-label="Größenvorlage hinzufügen"]').click();
    child = modal("Neue Größenvorlage");
    await child.waitFor({ state: "visible" });
    await field(child, "Name").fill("QA-Persist");
    await field(child, "Breite in Feldern").fill("12");
    await field(child, "Höhe in Feldern").fill("9");
    await child.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await child.waitFor({ state: "hidden" });
    await parent.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.waitForTimeout(1000);
    fs.writeFileSync(path.join(out, "after-create.json"), JSON.stringify(
      await page.evaluate(() => ({
        body: document.body.innerText.slice(-3000),
        views: app.workspace.getLeavesOfType("dungeon-native-pending").map((leaf) => ({
          type: leaf.view.getViewType(), path: leaf.view.getState?.().path,
          editor: !!leaf.view.editor,
        })),
        modals: [...document.querySelectorAll(".modal")].map((item) => item.innerText.slice(0, 500)),
      })), null, 2));
    await page.screenshot({ path: path.join(out, "after-create.png") });
    await page.locator(".dn-canvas canvas")
      .waitFor({ state: "visible", timeout: 30000 });
    const pending = await page.evaluate(() => {
      const leaf = app.workspace.getLeavesOfType("dungeon-native-pending")[0];
      const editor = leaf?.view?.editor;
      return editor && { document: editor.session.document(),
        history: editor.session.historySize, dirty: editor.session.dirty };
    });
    assert.deepEqual({ width: pending.document.settings.width,
      height: pending.document.settings.height }, { width: 12, height: 9 });
    assert.equal(fs.existsSync(mapFile), false);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction((map) => !!app.vault.getAbstractFileByPath(map), MAP);
    const document = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    assert.deepEqual({ width: document.settings.width,
      height: document.settings.height }, { width: 12, height: 9 });
    evidence.pending = { width: pending.document.settings.width,
      height: pending.document.settings.height, history: pending.history };
    evidence.savedSha256 = hash();
    fs.writeFileSync(saved, JSON.stringify({ document, hash: evidence.savedSha256 }, null, 2));
    fs.writeFileSync(path.join(out, "new-map-pair.json"), JSON.stringify(evidence, null, 2));
    await page.screenshot({ path: path.join(out, "new-map-saved.png") });
    checks.push("DD-001/002 New Map remains pending until Save; 12×9 template dimensions persist in V4");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(saved, "utf8"));
    await page.evaluate(async (map) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(map)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    const current = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.document());
    assert.deepEqual(current, prior.document);
    assert.equal(hash(), prior.hash);
    assert.deepEqual(await pluginPresets(), [{ name: "QA-Persist", width: 12, height: 9 }]);
    const parent = await openNew();
    await preset(parent).selectOption("QA-Persist");
    assert.deepEqual(await dimensions(parent), { width: 12, height: 9 });
    await parent.locator(".modal-header-button").click();
    checks.push("DD-001/002 fresh process reopens the exact V4 map and persisted custom size template");
  }
  return { edit, reopen };
};
