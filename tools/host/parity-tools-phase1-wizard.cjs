const NAME = "Phase1-Wizard";
const MAP = `Dungeons/${NAME}/Karte.dungeon`;

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-wizard-baseline.json");
  const modal = () => page.locator(".modal:visible")
    .filter({ hasText: "Dungeon anlegen" }).last();
  const setting = (dialog, label) => dialog.locator(".setting-item")
    .filter({ has: page.locator(".setting-item-name", { hasText: label }) });
  const hash = () => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, MAP))).digest("hex");
  const pending = () => page.evaluate((file) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-pending")
      .find((leaf) => leaf.view.getState().path === file)?.view.editor;
    return editor && { document: editor.session.document(),
      history: editor.session.historySize, dirty: editor.session.dirty };
  }, MAP);
  async function openNew() {
    assert.equal(await page.evaluate(() =>
      app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
    await page.waitForTimeout(500);
    fs.writeFileSync(path.join(out, "new-dialog-state.json"), JSON.stringify(
      await page.evaluate(() => ({ modals: [...document.querySelectorAll(".modal")]
        .map((element) => ({ text: element.textContent?.slice(0, 600),
          visible: element.getBoundingClientRect().width > 0 })),
        body: document.body.innerText.slice(-1200) })), null, 2));
    const dialog = modal();
    await setting(dialog, "Mit Kartenassistent starten").waitFor({
      state: "visible", timeout: 45000 });
    return dialog;
  }
  async function edit() {
    let dialog = await openNew();
    const wizardToggle = setting(dialog, "Mit Kartenassistent starten")
      .getByRole("checkbox");
    assert.equal(await wizardToggle.evaluate((input) =>
      input.parentElement?.classList.contains("is-enabled")), false);
    await setting(dialog, "Name").locator("input").fill(NAME);
    await setting(dialog, "Breite in Feldern").locator("input").fill("12");
    await setting(dialog, "Höhe in Feldern").locator("input").fill("12");
    await wizardToggle.click();
    await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.waitForFunction((file) =>
      !!app.workspace.getLeavesOfType("dungeon-native-pending")
        .find((leaf) => leaf.view.getState().path === file)?.view.editor,
      MAP, { timeout: 30000 });
    const panel = page.locator(".dungeon-native-editor:visible")
      .last().locator(".dn-generator-panel");
    await panel.waitFor({ state: "visible" });
    assert.equal(await panel.locator('input[value="dungeon"]').isChecked(), true);
    const empty = await pending();
    assert.deepEqual({ width: empty.document.settings.width,
      height: empty.document.settings.height,
      entities: empty.document.entities.length },
    { width: 12, height: 12, entities: 0 });
    assert.equal(fs.existsSync(path.join(vault, MAP)), false);
    checks.push("DD-003 New Map opens a blank 12×12 pending map with side wizard in DUNGEON mode");

    await panel.locator('input[value="cave"]').check();
    assert.equal(await panel.locator('input[value="cave"]').isChecked(), true);
    await panel.getByRole("button", { name: "Generieren", exact: true }).click();
    const first = await pending();
    assert.equal(first.document.entities.length, 1);
    assert.equal(first.document.entities[0].kind, "surface");
    assert.equal(first.document.entities[0].category, "cave");
    await page.screenshot({ path: path.join(out, "wizard-cave-first.png") });
    await panel.getByRole("button", { name: "Neu generieren", exact: true }).click();
    const second = await pending();
    assert.equal(second.document.entities.length, 1);
    assert.notEqual(second.document.entities[0].id, first.document.entities[0].id);
    assert.notDeepEqual(second.document.entities[0].polygons,
      first.document.entities[0].polygons);
    await page.screenshot({ path: path.join(out, "wizard-cave-second.png") });
    checks.push("DD-003 CAVE selection and repeated Generate replace the editable cave proposal");

    await panel.getByRole("button", { name: "Fertigstellen", exact: true }).click();
    await panel.waitFor({ state: "hidden" });
    assert.deepEqual((await pending()).document, second.document);
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction((file) => !!app.vault.getAbstractFileByPath(file), MAP);
    await page.waitForFunction((file) =>
      !app.workspace.getLeavesOfType("dungeon-native-pending")
        .some((leaf) => leaf.view.getState().path === file), MAP);
    const stored = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(stored, second.document);
    fs.writeFileSync(baseline, JSON.stringify({ document: stored, hash: hash() }, null, 2));
    checks.push("DD-003 Finish keeps the generated result; first Save writes the exact V4 map");

    dialog = await openNew();
    assert.equal(await setting(dialog, "Mit Kartenassistent starten")
      .getByRole("checkbox").evaluate((input) =>
        input.parentElement?.classList.contains("is-enabled")), true);
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    checks.push("DD-003 New Map retains the selected wizard start option within the process");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await page.evaluate(async (file) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(file)), MAP);
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
    const current = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor.session.document());
    assert.deepEqual(current, prior.document);
    assert.equal(hash(), prior.hash);
    checks.push("DD-003 fresh process reopens the exact finished cave map");
  }
  return { edit, reopen };
};
