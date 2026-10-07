module.exports = ({ page, fs, path, assert, out, vault, sourceVault,
  checks, chooseTool }) => {
  const cases = [
    { name: "Wear On", disabled: false },
    { name: "Wear Off", disabled: true },
  ];
  const mapPath = (name) => `Dungeons/${name}/Karte.dungeon`;
  const visibleToggleValue = (input) => input.evaluate((node) =>
    node.parentElement?.classList.contains("is-enabled") ?? false);
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && {
      document: editor.session.document(),
      entities: editor.session.entities.size,
      history: editor.session.historySize,
      floorShaders: [...editor.renderer.visuals.values()]
        .filter((v) => v.entity.kind === "building" && !!v.floorShader).length,
    };
  });
  const point = ({ x, y }) => page.evaluate(({ x, y }) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
  async function rectangle(x, y, expected) {
    const a = await point({ x, y }), b = await point({ x: x + 2, y: y + 2 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction((count) =>
      app.workspace.activeLeaf?.view?.editor?.session?.entities?.size === count,
    expected);
  }
  async function create({ name, disabled }) {
    assert.equal(await page.evaluate(() =>
      app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
    const modal = page.locator(".modal:visible").last();
    await modal.getByText("Dungeon anlegen", { exact: true }).waitFor();
    const wear = modal.locator(".setting-item")
      .filter({ hasText: "Gebäudeabnutzung deaktivieren" })
      .locator('input[type="checkbox"]');
    if (await visibleToggleValue(wear) !== disabled) await wear.click();
    assert.equal(await visibleToggleValue(wear), disabled);
    await modal.locator('.setting-item input[type="text"]').first().fill(name);
    await modal.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
    await page.evaluate(() => {
      for (const leaf of app.workspace.getLeavesOfType("dungeon-native-map"))
        if (leaf !== app.workspace.activeLeaf) leaf.detach();
    });
    assert.equal((await state()).document.settings.nativeBuildingWear, !disabled);
    await chooseTool("Raum");
    await page.getByRole("button", { name: "Battlements", exact: true }).click();
    await rectangle(6, 5, 1);
    const beforeUndo = await state();
    assert.equal(beforeUndo.history, 1);
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() =>
      app.workspace.activeLeaf?.view?.editor?.session?.entities?.size === 0);
    await page.keyboard.press("Control+Shift+z");
    await page.waitForFunction(() =>
      app.workspace.activeLeaf?.view?.editor?.session?.entities?.size === 1);
    await page.waitForFunction(() => [...app.workspace.activeLeaf.view.editor.renderer.visuals.values()]
      .some((v) => v.entity.kind === "building" && !!v.floorShader));
    const drawn = await state();
    assert.equal(drawn.document.entities[0].kind, "building");
    assert(drawn.document.entities[0].material.assetId
      ?.startsWith("pack:dungeondraft-builtin-1.2.0.1:tileset:"),
      "A native floor asset must be used for the wear comparison");
    assert(drawn.document.entities[0].wallAssetId
      ?.startsWith("pack:dungeondraft-builtin-1.2.0.1:wall:"));
    await page.getByRole("button", { name: "QA Wall", exact: true }).click();
    await rectangle(10, 5, 2);
    const two = await state();
    assert(two.document.entities[0].wallAssetId
      ?.startsWith("pack:dungeondraft-builtin-1.2.0.1:wall:"));
    assert(two.document.entities.some((entity) => entity.kind === "building" &&
      entity.wallAssetId?.startsWith("pack:QAWall01:wall:")));
    await chooseTool("Tür");
    const doorPoint = await point({ x: 11, y: 5 });
    await page.mouse.click(doorPoint.x, doorPoint.y);
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session
      ?.entities?.size === 3);
    assert((await state()).document.entities.some((entity) => entity.kind === "door" &&
      !!entity.anchor));
    await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out,
      disabled ? "wear-off-drawn.png" : "wear-on-drawn.png") });
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction((name) => !!app.vault.getAbstractFileByPath(
      `Dungeons/${name}/Karte.dungeon`), name);
    const stored = JSON.parse(fs.readFileSync(path.join(vault, mapPath(name)), "utf8"));
    assert.equal(stored.settings.nativeBuildingWear, !disabled);
    assert.equal(stored.entities.length, 3);
    checks.push(`${name}: toggle, native floor, builtin and QA wall, anchored door, undo/redo and saved mode`);
  }
  return {
    async edit() {
      const pck = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
      await page.evaluate(async (pck) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pck);
      }, pck);
      const packPath = "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd015-pair-native/runs/20261006-150801-600270/assets/qa-wall-pack.dungeondraft_pack";
      const pack = fs.readFileSync(packPath);
      await page.evaluate(async (base64) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        await plugin.assets.add([new Blob([bytes])]);
        await plugin.reloadAssets();
      }, pack.toString("base64"));
      await create(cases[0]);
      await create(cases[1]);
      const before = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
        .disableBuildingWearForNewMap);
      assert.equal(await page.evaluate(() =>
        app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
      const modal = page.locator(".modal:visible").last();
      await modal.getByText("Dungeon anlegen", { exact: true }).waitFor();
      const wear = modal.locator(".setting-item")
        .filter({ hasText: "Gebäudeabnutzung deaktivieren" })
        .locator('input[type="checkbox"]');
      const remembered = await visibleToggleValue(wear);
      await page.screenshot({ path: path.join(out, "wear-dialog-memory.png") });
      fs.writeFileSync(path.join(out, "wear-dialog-memory.json"), JSON.stringify({
        before, remembered,
        pluginValue: await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
          .disableBuildingWearForNewMap),
        input: await wear.evaluate((input) => input.outerHTML),
        control: await wear.evaluate((input) => input.parentElement?.outerHTML),
      }, null, 2));
      await page.keyboard.press("Escape");
      assert.equal(remembered, true);
      checks.push("New-map dialog memory inspected after an off-mode card");
    },
    async reopen() {
      assert.equal(await page.evaluate(() =>
        app.commands.executeCommandById("dungeon-editor:create-dungeon")), true);
      const modal = page.locator(".modal:visible").last();
      await modal.getByText("Dungeon anlegen", { exact: true }).waitFor();
      assert.equal(await visibleToggleValue(modal.locator(".setting-item")
        .filter({ hasText: "Gebäudeabnutzung deaktivieren" })
        .locator('input[type="checkbox"]')), false);
      await page.keyboard.press("Escape");
      checks.push("New-map checkbox resets after process restart");
      for (const { name, disabled } of cases) {
        await page.evaluate(async (target) =>
          app.workspace.getLeaf(false).openFile(
            app.vault.getAbstractFileByPath(target)), mapPath(name));
        await page.evaluate(() => {
          for (const leaf of app.workspace.getLeavesOfType("dungeon-native-map"))
            if (leaf !== app.workspace.activeLeaf) leaf.detach();
        });
        await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
        await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session
          ?.entities?.size === 3);
        assert.equal((await state()).document.settings.nativeBuildingWear, !disabled);
        await page.waitForFunction(() => [...app.workspace.activeLeaf.view.editor.renderer.visuals.values()]
          .filter((v) => v.entity.kind === "building" && !!v.floorShader).length === 2);
        await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out,
          disabled ? "wear-off-reopen.png" : "wear-on-reopen.png") });
        checks.push(`${name}: fresh process restores native wear mode, two buildings and door`);
      }
      const older = fs.readFileSync(path.join(sourceVault,
        "Dungeons/test/Karte.dungeon"), "utf8");
      await page.evaluate(async (raw) => {
        await app.vault.createFolder("Dungeons/Wear Existing").catch(() => {});
        if (!app.vault.getAbstractFileByPath("Dungeons/Wear Existing/Karte.dungeon"))
          await app.vault.create("Dungeons/Wear Existing/Karte.dungeon", raw);
        await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(
          "Dungeons/Wear Existing/Karte.dungeon"));
      }, older);
      await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session
        ?.entities?.size === 4);
      const existing = await state();
      assert.equal(existing.document.version, 3);
      assert.equal(existing.document.settings.nativeBuildingWear, undefined);
      assert.equal(existing.document.settings.buildingWear, 0);
      checks.push("Existing V2 map opens without changing its numeric wear value");
    },
  };
};
