const MAP = "Dungeons/Parity/Object-Review.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks, chooseTool }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const e = app.workspace.activeLeaf.view.editor;
    return { objects: e.session.document().entities.filter((v) => v.kind === "object"),
      order: [...e.session.entities.keys()], history: e.session.historySize,
      tool: e.tool, defaults: e.settings.object, sorting: e.settings.objectSorting };
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
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-independent-review",
        settings: { name: "Object Review", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const start = await state();
    assert.equal(start.objects.length, 0);
    await page.getByRole("button", { name: "Atlas Globe 02", exact: true }).click();
    await clickWorld(2, 2);
    let s = await state();
    assert.equal(s.objects.length, 1);
    assert.match(s.objects[0].assetId, /atlas_globe_02/i);
    const first = structuredClone(s.objects[0]);
    const firstHistory = s.history;
    checks.push("Different native asset tile creates one instance and one history step");

    await page.locator(".dn-object-sorting button").nth(1).click();
    await page.getByRole("combobox", { name: "Layer" }).selectOption("700");
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).fill("30");
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).press("Tab");
    await page.getByRole("spinbutton", { name: "Scale", exact: true }).fill("1.5");
    await page.getByRole("spinbutton", { name: "Scale", exact: true }).press("Tab");
    await clickWorld(4, 4);
    s = await state();
    assert.equal(s.objects.length, 2);
    assert.deepEqual(s.objects.find((v) => v.id === first.id), first);
    assert.equal(s.objects.find((v) => v.id !== first.id).layer, 700);
    assert.equal(s.objects.find((v) => v.id !== first.id).rotation, Math.PI / 6);
    assert.equal(s.history, firstHistory + 1);
    checks.push("Under plus layer, rotation and scale place separately; prior instance is unchanged");

    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).objects, [first]);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).objects.length, 0);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await state()).objects.length, 2);
    checks.push("Two placements undo and redo as two separate steps");

    const picker = page.getByRole("button", { name: "Objektfarbe RGBA öffnen" });
    await picker.click();
    const hex = page.getByRole("textbox", { name: "Hex ARGB" });
    await hex.fill("7f12ab34");
    await hex.press("Tab");
    assert.equal(await page.getByRole("spinbutton", { name: "A", exact: true }).inputValue(), "127");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    const paletteCount = await page.locator(".dn-object-palette button").count();
    await picker.click();
    await page.keyboard.press("Escape");
    assert.equal((await state()).tool, "object");
    fs.writeFileSync(path.join(out, "review-state.json"), JSON.stringify({
      objects: (await state()).objects, paletteCount,
      customPlusPresent: await page.getByRole("button", { name: /eigene.*farbe|farbe.*hinzufügen/i }).count(),
      color: (await state()).defaults.color, alpha: (await state()).defaults.alpha,
    }, null, 2));
    assert.equal(paletteCount, 31);
    assert.equal(await page.getByRole("button", {
      name: "Objektfarbe zur Palette hinzufügen",
    }).count(), 1);
    checks.push("ARGB picker accepts 127 alpha; 30 native swatches and the verified Plus action remain visible");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.screenshot({ path: path.join(out, "review-edit.png") });
  }
  async function reopen() {
    await open();
    const s = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    assert.deepEqual(s.objects, saved.entities.filter((v) => v.kind === "object"));
    assert.equal(s.objects.length, 2);
    await page.screenshot({ path: path.join(out, "review-reopen.png") });
    checks.push("Fresh process reloads two independent-review objects value-equal");
  }
  return { edit, reopen };
};
