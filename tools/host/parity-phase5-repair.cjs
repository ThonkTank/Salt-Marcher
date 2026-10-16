const MAP = "Dungeons/Parity/Object-Palette-Repair.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks, chooseTool, sleep, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const s = app.workspace.activeLeaf.view.editor.session;
    const e = app.workspace.activeLeaf.view.editor;
    return { palette: s.settings.objectPalette, dirty: s.dirty,
      history: s.historySize, color: e.settings.object.color,
      alpha: e.settings.object.alpha, objects: s.document().entities
        .filter((v) => v.kind === "object"),
      order: [...s.entities.keys()],
      hit: e.renderer.hitTest({ x: 4, y: 4 }, (entity) => entity.kind === "object")?.id };
  });
  const clickWorld = async (x, y) => {
    const p = await page.evaluate(({ x, y }) => {
      const r = app.workspace.activeLeaf.view.editor.renderer;
      const b = r.canvas.getBoundingClientRect();
      return { x: b.x + r.camera.x + x * r.camera.scale,
        y: b.y + r.camera.y + y * r.camera.scale };
    }, { x, y });
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
  };
  const plus = () => page.getByRole("button", {
    name: "Objektfarbe zur Palette hinzufügen",
  });
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-repair-palette",
        settings: { name: "Object Palette Repair", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    assert.equal((await state()).palette, undefined);
    assert.equal(await page.locator(".dn-object-palette button").count(), 31);
    const initial = await state();
    assert.equal(initial.dirty, false);
    await plus().click();
    const hex = page.getByRole("textbox", { name: "Hex ARGB" });
    await hex.fill("8012ab34");
    await hex.press("Tab");
    await page.keyboard.press("Escape");
    let s = await state();
    assert.equal(s.palette.length, 31);
    assert.equal(s.palette[30], "8012ab34");
    assert.equal(s.history, initial.history);
    assert.equal(s.dirty, true);
    assert.equal(s.alpha, 128);
    assert.equal(await page.locator(".dn-object-palette button").count(), 32);
    checks.push("Plus and Escape add one native ARGB swatch without Undo");

    await plus().click();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    s = await state();
    assert.deepEqual(s.palette.slice(-2), ["8012ab34", "8012ab34"]);
    assert.equal(s.history, initial.history);
    checks.push("Accept without a color change adds a duplicate swatch");
    await page.getByRole("button", { name: "Objektfarbe #8012ab34" }).first().click();
    s = await state();
    assert.equal(s.color, 0x12ab34);
    assert.equal(s.alpha, 128);
    checks.push("Reclicking an ARGB swatch restores RGB and alpha");

    await page.getByRole("button", { name: "Atlas Globe 01", exact: true }).click();
    await clickWorld(4, 4);
    const first = (await state()).objects[0];
    await page.getByRole("button", { name: "Atlas Globe 02", exact: true }).click();
    await clickWorld(4, 4);
    s = await state();
    assert.equal(s.objects.length, 2);
    assert.equal(s.hit, s.objects[1].id);
    assert.deepEqual(s.order, s.objects.map((object) => object.id));
    await page.locator(".dn-object-sorting button").nth(1).click();
    await page.getByRole("button", { name: "Atlas Globe 01", exact: true }).click();
    await clickWorld(4, 4);
    s = await state();
    assert.equal(s.objects.length, 3);
    assert.equal(s.order[0], s.objects[0].id);
    assert.equal(s.hit, s.objects[2].id);
    assert.deepEqual(s.objects.find((object) => object.id === first.id), first);
    await page.getByRole("combobox", { name: "Layer" }).selectOption("400");
    await clickWorld(4, 4);
    s = await state();
    assert.equal(s.objects.length, 4);
    assert.equal(s.objects[0].layer, 400);
    assert.equal(s.hit, s.objects[0].id);
    checks.push("Over, Under and higher Layer share native visible/clickable order");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    let saved;
    for (let attempt = 0; attempt < 100; attempt++) {
      saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
      if (saved.settings.objectPalette?.length === 32) break;
      await sleep(50);
    }
    assert.deepEqual(saved.settings.objectPalette, s.palette);
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    await page.screenshot({ path: path.join(out, "palette-edit.png") });
    fs.writeFileSync(path.join(out, "palette-edit-state.json"),
      JSON.stringify(s, null, 2));
  }
  async function reopen() {
    await open();
    const s = await state();
    assert.equal(s.palette.length, 32);
    assert.deepEqual(s.palette.slice(-2), ["8012ab34", "8012ab34"]);
    assert.equal(s.dirty, false);
    assert.equal(s.objects.length, 4);
    assert.equal(s.hit, s.objects[0].id);
    await page.getByRole("button", { name: "Objektfarbe #8012ab34" }).last().click();
    const selected = await state();
    assert.equal(selected.color, 0x12ab34);
    assert.equal(selected.alpha, 128);
    assert.equal(selected.dirty, false);
    await page.screenshot({ path: path.join(out, "palette-reopen.png") });
    checks.push("Fresh process reopens map palette and selection without changing map");
  }
  return { edit, reopen };
};
