const PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const PCK_SHA = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const MAP = "Dungeons/GM-UX-N-002/Karte.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, chooseTool }) => {
  const baseline = path.join(qa, "gm-ux-n002-baseline.json");
  const tiles = () => page.locator(".dn-object-library-tile");
  const search = () => page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view.editor;
    return { document: editor.session.document(), history: editor.session.historySize,
      dirty: editor.session.dirty, selectedAsset: editor.settings.object.assetId };
  });
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  async function open() {
    await page.evaluate(async (mapPath) => app.workspace.getLeaf("tab")
      .openFile(app.vault.getAbstractFileByPath(mapPath)), MAP);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function select(query) {
    await search().fill(query);
    assert.equal(await search().evaluate((element) => element === document.activeElement), true);
    const visible = await tiles().evaluateAll((items) =>
      items.map((item) => ({ id: item.dataset.assetId, name: item.getAttribute("aria-label") })));
    assert(visible.length > 0 && visible.length < 1792, `Search ${query}: ${visible.length}`);
    const first = visible[0];
    await tiles().first().click();
    assert.equal((await state()).selectedAsset, first.id);
    return { ...first, visible };
  }
  async function place(index) {
    const point = await world({ x: 2 + index * 1.5, y: 4 + index % 2 });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction((count) => app.workspace.getLeavesOfType("dungeon-native-map")
      .at(-1)?.view.editor.session.entities.size === count, index + 1);
  }
  async function edit() {
    const bytes = fs.readFileSync(PCK);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), PCK_SHA);
    await page.evaluate(async (pckPath) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pckPath), PCK);
    await page.evaluate(async (mapPath) => {
      await app.vault.createFolder("Dungeons").catch(() => {});
      await app.vault.createFolder("Dungeons/GM-UX-N-002");
      await app.vault.create(mapPath, JSON.stringify({
        format: "dungeon-map", version: 4, id: "gm-ux-n002",
        settings: { name: "GM-UX-N-002", width: 20, height: 12,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
    }, MAP);
    await open();
    const all = await tiles().count();
    assert.equal(all, 1792);
    await page.getByRole("slider", { name: "Fuzzy/Exact" }).evaluate((input) => {
      input.value = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const atlas = await select("atlas globe");
    assert(atlas.visible.every((item) => item.name.toLowerCase().includes("atlas globe")));
    await page.screenshot({ path: path.join(out, "01-live-atlas.png") });
    const book = await select("book");
    assert(book.visible.every((item) => item.name.toLowerCase().includes("book")));
    assert(!book.visible.some((item) => item.id === atlas.id));
    await page.screenshot({ path: path.join(out, "02-live-book.png") });
    await page.getByRole("button", { name: "Suchtext leeren" }).click();
    assert.equal(await search().inputValue(), "");
    assert.equal(await tiles().count(), all);
    await page.screenshot({ path: path.join(out, "03-clear-all.png") });
    const caseResult = await select("glass case");
    assert(![atlas.id, book.id].includes(caseResult.id));
    await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
    assert.equal(await search().inputValue(), "glass case");
    assert.equal(await tiles().count(), all);
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Tags" }).click();
    await page.locator(".dn-object-library-tags")
      .getByRole("button", { name: "Administration" }).click();
    assert((await tiles().count()) > 0);
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "All" }).click();
    checks.push("Three built-in assets switch on input without Enter; X restores All; trash and Tags remain usable");
    const selectedIds = [];
    for (const [query, count] of [["atlas globe", 4], ["book", 3], ["glass case", 3]]) {
      const selected = await select(query);
      selectedIds.push(selected.id);
      for (let j = 0; j < count; j++) await place((await state()).document.entities.length);
    }
    assert.equal(new Set(selectedIds).size, 3);
    const made = await state();
    assert.equal(made.document.entities.length, 10);
    assert.deepEqual(made.document.entities.map((entity) => entity.assetId),
      [selectedIds[0], selectedIds[0], selectedIds[0], selectedIds[0],
        selectedIds[1], selectedIds[1], selectedIds[1],
        selectedIds[2], selectedIds[2], selectedIds[2]]);
    await page.screenshot({ path: path.join(out, "04-ten-objects.png") });
    await page.getByRole("button", { name: "Rückgängig" }).click();
    assert.equal((await state()).document.entities.length, 9);
    await page.getByRole("button", { name: "Wiederholen" }).click();
    assert.deepEqual((await state()).document, made.document);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
      .at(-1)?.view.editor.session.dirty);
    const saved = await state();
    fs.writeFileSync(baseline, JSON.stringify({ document: saved.document,
      hash: crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, MAP)))
        .digest("hex"), selectedIds }, null, 2));
    checks.push("Ten GUI object placements from three assets survive Undo, Redo and Save");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await open();
    const reopened = await state();
    assert.deepEqual(reopened.document, saved.document);
    assert.equal(reopened.document.entities.length, 10);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, MAP)))
      .digest("hex"), saved.hash);
    assert.equal(await tiles().count(), 1792);
    await search().fill("book");
    assert((await tiles().count()) > 0 && (await tiles().count()) < 1792);
    await page.getByRole("button", { name: "Suchtext leeren" }).click();
    assert.equal(await tiles().count(), 1792);
    await page.screenshot({ path: path.join(out, "05-fresh-open.png") });
    checks.push("Fresh Obsidian process retains all ten objects and live search/X behavior");
  }
  return { edit, reopen };
};
