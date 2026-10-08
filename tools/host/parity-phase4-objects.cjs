const PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const PCK_SHA = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const PACK_SHA = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const MAP = "Dungeons/Parity/Object-Library.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool }) => {
  const tileCount = () => page.locator(".dn-object-library-tile").count();
  const modal = () => page.locator(".dn-object-tags-modal");
  const openMap = async () => {
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(mapPath)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  };
  const openTags = () => page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").openObjectTags(["QAObjASl"], true));
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return { document: editor.session.document(), history: editor.session.historySize,
      toolAsset: editor.settings.object.assetId };
  });

  async function edit() {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PCK)).digest("hex"), PCK_SHA);
    const packBytes = fs.readFileSync(PACK);
    assert.equal(crypto.createHash("sha256").update(packBytes).digest("hex"), PACK_SHA);
    await page.evaluate(async (pckPath) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pckPath), PCK);
    await page.evaluate(async (encoded) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
    }, packBytes.toString("base64"));
    await page.evaluate(async (mapPath) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(mapPath, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase4-objects",
        settings: { name: "Object Library", width: 20, height: 12,
          feetPerField: 5, assetPacks: ["QAObjASl"], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await openMap();
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    assert.equal(await tileCount(), 1793);
    assert.equal(await page.locator(".dn-object-library-tabs button[aria-pressed=true]").innerText(), "All");
    const image = page.locator(".dn-object-library-tile img").first();
    await page.waitForFunction(() => !!document.querySelector(".dn-object-library-tile img[src]"));
    assert((await image.getAttribute("src"))?.startsWith("blob:"));
    assert.equal(await page.locator('.dn-object-library-tile[aria-label="QA Object Color"]').count(), 1);
    checks.push("All exposes 1792 built-in and one enabled package tile with loadable images");
    const search = page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
    await search.fill("atlas");
    assert.equal(await tileCount(), 1793);
    await search.press("Enter");
    assert.equal(await tileCount(), 19);
    await page.getByRole("button", { name: "Suchtext leeren" }).click();
    assert.equal(await search.inputValue(), "");
    assert.equal(await tileCount(), 19);
    await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
    assert.equal(await tileCount(), 1793);
    const slider = page.getByRole("slider", { name: "Fuzzy/Exact" });
    await slider.evaluate((input) => {
      input.value = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await search.fill("atla");
    await search.press("Enter");
    assert.equal(await tileCount(), 0);
    await slider.evaluate((input) => {
      input.value = "0.5";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await tileCount(), 0, "slider change does not resubmit");
    await search.press("Enter");
    assert.equal(await tileCount(), 15);
    await page.screenshot({ path: path.join(out, "fuzzy-atla.png") });
    checks.push("Enter applies Fuzzy/Exact; X and trash retain different result states");

    await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
    await page.locator('.dn-object-library-tile[aria-label="QA Object Color"]').click();
    assert((await state()).toolAsset?.startsWith("pack:QAObjASl:object:"));
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Tags" }).click();
    await page.locator(".dn-object-library-tags").getByRole("button", { name: "Colorable" }).click();
    assert.equal(await page.locator('.dn-object-library-tile[aria-label="QA Object Color"]').count(), 1);
    const tagButton = (name) => page.locator(".dn-object-library-tags").getByRole("button", { name, exact: true });
    const checkedTags = () => page.locator('.dn-object-library-tags button[aria-pressed="true"]')
      .allInnerTexts();
    await tagButton("Administration").click();
    await tagButton("Administration").click();
    assert.deepEqual(await checkedTags(), ["Administration"]);
    await tagButton("Alchemy").click();
    assert.deepEqual(await checkedTags(), ["Alchemy"]);
    await tagButton("Administration").click({ modifiers: ["Control"] });
    assert.deepEqual(await checkedTags(), ["Administration", "Alchemy"]);
    await tagButton("Administration").click({ modifiers: ["Control"] });
    assert.deepEqual(await checkedTags(), ["Alchemy"]);
    const setPicker = page.getByRole("combobox", { name: "Custom Set" });
    await setPicker.selectOption("Crafts & Trades");
    const crafts = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .objectTags(["QAObjASl"], true).sets["Crafts & Trades"]);
    assert.deepEqual(await checkedTags(), [...crafts].sort((a,b) => a.localeCompare(b,"en")));
    assert.equal(await tagButton("Armor").count(), 1, "set keeps the complete tag list");
    await tagButton("Armor").click({ modifiers: ["Control"] });
    assert.equal(await setPicker.inputValue(), "", "manual tag action restores Custom Set");
    assert((await checkedTags()).includes("Armor"));
    await setPicker.selectOption("Combat");
    assert.equal(await setPicker.inputValue(), "Combat");
    await setPicker.selectOption("---");
    assert.deepEqual(await checkedTags(), []);
    assert.equal(await tileCount(), 0);
    checks.push("Plain/Ctrl tag choice, full-list set membership, Custom Set and --- match native transitions");
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "All" }).click();
    checks.push("Enabled package object and its Colorable package tag resolve to the same tile");
    await page.locator('.dn-object-library-tile[aria-label="Atlas Globe 01"]').click();
    const selected = await state();
    assert(selected.toolAsset?.includes("atlas_globe_01.png"));
    assert.equal(selected.document.entities.length, 0);
    const point = await world({ x: 4, y: 4 });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() =>
      app.workspace.activeLeaf.view.editor.session.entities.size === 1);
    assert.equal((await state()).document.entities[0].assetId, selected.toolAsset);
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Used" }).click();
    assert.equal(await tileCount(), 1);
    await page.getByRole("button", { name: "Rückgängig" }).click();
    assert.equal((await state()).document.entities.length, 0);
    assert.equal(await tileCount(), 1);
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "All" }).click();
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Used" }).click();
    assert.equal(await tileCount(), 0);
    await page.getByRole("button", { name: "Wiederholen" }).click();
    assert.equal(await tileCount(), 0);
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "All" }).click();
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Used" }).click();
    assert.equal(await tileCount(), 1);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    checks.push("Tile selection places exact asset; Used captures a snapshot on tab entry");

    await openTags();
    fs.writeFileSync(path.join(out, "modal-open-debug.json"), JSON.stringify(await page.evaluate(() => ({
      mode: app.plugins.getPlugin("dungeon-editor").objectTagsBrowserMode,
      modalCount: document.querySelectorAll(".modal").length,
      tagModalCount: document.querySelectorAll(".dn-object-tags-modal").length,
      modalText: [...document.querySelectorAll(".modal")].map((node) => node.textContent?.slice(0, 300)),
    })), null, 2));
    assert.equal(await modal().locator('input[type="radio"]').first().isChecked(), true);
    assert.equal(await modal().getByRole("button", { name: "Tag hinzufügen" }).isDisabled(), true);
    assert.equal(await modal().getByRole("combobox", { name: "Tag wählen" }).locator("option").count(), 81);
    await modal().getByRole("button", { name: "Edit Sets" }).click();
    assert.equal(await modal().getByRole("combobox", { name: "Set wählen" }).locator("option").count(), 15);
    await modal().getByRole("button", { name: "Edit Tags" }).click();
    await modal().locator('input[type="radio"]').nth(1).click();
    await modal().getByRole("button", { name: "Dialog schließen" }).click();
    assert.equal(await modal().locator('input[type="radio"]').nth(1).isChecked(), true);
    assert.equal(await modal().getByRole("button", { name: "Tag hinzufügen" }).isDisabled(), true);
    await modal().locator('input[type="radio"]').first().click();
    await modal().locator('input[type="radio"]').nth(1).click();
    assert.match(await modal().innerText(), /Create Tag Overrides/);
    await modal().getByRole("button", { name: "Cancel" }).click();
    assert.equal(await modal().locator('input[type="radio"]').first().isChecked(), true);
    await modal().locator('input[type="radio"]').nth(1).click();
    await modal().getByRole("button", { name: "OK" }).click();
    await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Tagname" }).fill("ZZ QA Delete Tag");
    await modal().getByRole("button", { name: "Accept" }).click();
    await modal().getByRole("button", { name: "Tag entfernen" }).click();
    assert.equal(await modal().getByRole("combobox", { name: "Tag wählen" }).inputValue(), "Wood");
    assert.equal(await modal().locator('option[value="ZZ QA Delete Tag"]').count(), 0);
    await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Tagname" }).fill("QA Phase4 Tag");
    await modal().getByRole("button", { name: "Accept" }).click();
    await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Tagname" }).fill("QA Phase4 Tag");
    await modal().getByRole("button", { name: "Accept" }).click();
    assert.match(await modal().locator(".dn-object-tag-error").innerText(), /bereits vorhanden/);
    await modal().getByRole("button", { name: "Cancel" }).click();
    await modal().getByRole("combobox", { name: "Tag wählen" }).selectOption("Administration");
    await modal().getByRole("combobox", { name: "Tag wählen" }).selectOption("QA Phase4 Tag");
    await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]').click();
    assert.equal(await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]').getAttribute("aria-pressed"), "true");
    await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]').click();
    assert.equal(await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]').getAttribute("aria-pressed"), "false");
    await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]').click();
    await modal().getByRole("button", { name: "Edit Sets" }).click();
    await modal().getByRole("button", { name: "Set hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Setname" }).fill("ZZ QA Delete Set");
    await modal().getByRole("button", { name: "Accept" }).click();
    await modal().getByRole("button", { name: "Set entfernen" }).click();
    assert.equal(await modal().getByRole("combobox", { name: "Set wählen" }).inputValue(), "Water");
    assert.equal(await modal().locator('option[value="ZZ QA Delete Set"]').count(), 0);
    await modal().getByRole("button", { name: "Set hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Setname" }).fill("QA Phase4 Set");
    await modal().getByRole("button", { name: "Accept" }).click();
    await modal().getByRole("combobox", { name: "Set wählen" }).selectOption("Combat");
    await modal().getByRole("combobox", { name: "Set wählen" }).selectOption("QA Phase4 Set");
    await modal().getByRole("checkbox", { name: "QA Phase4 Tag" }).check();
    await modal().getByRole("checkbox", { name: "QA Phase4 Tag" }).uncheck();
    await modal().getByRole("checkbox", { name: "QA Phase4 Tag" }).check();
    await modal().getByRole("button", { name: "Save" }).click();
    await page.waitForFunction(() => !!app.plugins.getPlugin("dungeon-editor")
      .objectTagStore.current()?.sets["QA Phase4 Set"]);
    const savedTags = path.join(vault, ".obsidian/dungeon-editor-assets/object-tags.json");
    assert(fs.existsSync(savedTags));
    const saved = JSON.parse(fs.readFileSync(savedTags, "utf8"));
    assert.deepEqual(saved.sets["QA Phase4 Set"], ["QA Phase4 Tag"]);
    assert(saved.tags["QA Phase4 Tag"].some((name) => name.endsWith("atlas_globe_01.png")));
    await modal().getByRole("button", { name: "Save" }).click();
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    await openTags();
    assert.equal(await modal().locator('input[type="radio"]').nth(1).isChecked(), true,
      "same process retains explicit Override selection");
    await modal().getByRole("button", { name: "Edit Tags" }).click();
    await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Tagname" }).fill("QA Unsaved");
    await modal().getByRole("button", { name: "Accept" }).click();
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    const savedHash = crypto.createHash("sha256").update(fs.readFileSync(savedTags)).digest("hex");
    await openTags();
    await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
    await modal().getByRole("textbox", { name: "Tagname" }).fill("QA Unsaved X");
    await modal().getByRole("button", { name: "Accept" }).click();
    await page.keyboard.press("Escape");
    await modal().waitFor({ state: "detached" });
    await openTags();
    assert.equal(await modal().locator('option[value="QA Unsaved"]').count(), 0);
    assert.equal(await modal().locator('option[value="QA Unsaved X"]').count(), 0);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(savedTags)).digest("hex"), savedHash);
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    checks.push("Override Cancel, create, object/tag assignments, Save and unsaved Close work in the host");

    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Tags" }).click();
    await page.getByRole("combobox", { name: "Custom Set" }).selectOption("QA Phase4 Set");
    await page.locator(".dn-object-library-tags").getByRole("button", { name: "QA Phase4 Tag" }).click();
    assert.equal(await tileCount(), 1);
    await page.screenshot({ path: path.join(out, "tag-set-filter.png") });
    fs.writeFileSync(path.join(out, "state.json"), JSON.stringify({
      selected, savedTags: saved, final: await state(), tagFile: savedTags,
    }, null, 2));
    checks.push("Saved set and tag show the assigned Globe tile");
  }

  async function reopen() {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PCK)).digest("hex"), PCK_SHA);
    await openMap();
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    const plugin = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      return { objects: plugin.listAssets(["QAObjASl"], true).filter((asset) => asset.kind === "object").length,
        override: plugin.objectTagStore.current(),
        entities: app.workspace.activeLeaf.view.editor.session.document().entities };
    });
    assert.equal(plugin.objects, 1793);
    assert.equal(plugin.entities.length, 1);
    assert.deepEqual(plugin.override.sets["QA Phase4 Set"], ["QA Phase4 Tag"]);
    await openTags();
    assert.equal(await modal().locator('input[type="radio"]').first().isChecked(), true,
      "fresh process starts browser in Default despite saved override");
    await modal().locator('input[type="radio"]').nth(1).click();
    assert.doesNotMatch(await modal().innerText(), /Create Tag Overrides/);
    assert.equal(await modal().locator('option[value="QA Phase4 Tag"]').count(), 1);
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Tags" }).click();
    await page.getByRole("combobox", { name: "Custom Set" }).selectOption("QA Phase4 Set");
    await page.locator(".dn-object-library-tags").getByRole("button", { name: "QA Phase4 Tag" }).click();
    assert.equal(await tileCount(), 1);
    await page.screenshot({ path: path.join(out, "reopen-tag-set.png") });
    checks.push("Fresh Obsidian process loads map object, native catalog and saved tag/set override");

    await page.locator(".dn-object-library-tabs").getByRole("button", { name: "All" }).click();
    const search = page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
    await search.fill("book");
    await search.press("Enter");
    const bookOrder = await page.locator(".dn-object-library-tile").evaluateAll((tiles) =>
      tiles.map((tile) => ({ name: tile.getAttribute("aria-label"), id: tile.dataset.assetId })));
    fs.writeFileSync(path.join(out, "search-book-order.json"), JSON.stringify(bookOrder, null, 2));
    assert.equal(bookOrder.length, 16);
    await page.screenshot({ path: path.join(out, "search-book.png") });
    await search.fill("zzzzqa");
    assert.equal(await tileCount(), 16, "text alone does not submit");
    await search.press("Enter");
    assert.equal(await tileCount(), 0);
    await search.fill("atlas globe");
    await search.press("Enter");
    const twoWordOrder = await page.locator(".dn-object-library-tile").evaluateAll((tiles) =>
      tiles.map((tile) => tile.dataset.assetId));
    fs.writeFileSync(path.join(out, "search-two-word-order.json"), JSON.stringify(twoWordOrder, null, 2));
    checks.push("Ordered book and two-word results, empty query and Enter boundary captured");

    const fixtures = await page.evaluate(async (baseMapPath) => {
      const editor = app.workspace.activeLeaf.view.editor;
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const assets = plugin.listAssets(["QAObjASl"], true);
      const book = assets.find((asset) => asset.kind === "object" &&
        asset.files.image?.endsWith("/book_02.png"));
      const globe = editor.session.document().entities[0];
      if (!book || !globe) throw new Error("Book or Globe fixture missing");
      const ground = { id: "floor-1", name: "Ground", elevation: 0, ambient: 1 };
      const upper = { id: "floor-2", name: "Upper", elevation: 10, ambient: 1 };
      const base = editor.session.document();
      const bookObject = { ...globe, id: "qa-book", floorId: upper.id, x: 7,
        assetId: book.id };
      const a = { ...base, id: "qa-used-two-floor", floors: [ground, upper],
        entities: [{ ...globe, id: "qa-globe", floorId: ground.id }, bookObject] };
      const b = { ...base, id: "qa-used-other-map", floors: [ground],
        entities: [{ ...bookObject, floorId: ground.id }] };
      const pathA = baseMapPath.replace("Object-Library", "Used-Two-Floor");
      const pathB = baseMapPath.replace("Object-Library", "Used-Other-Map");
      for (const [target, value] of [[pathA, a], [pathB, b]]) {
        const file = app.vault.getAbstractFileByPath(target);
        if (file) await app.vault.modify(file, JSON.stringify(value, null, 2));
        else await app.vault.create(target, JSON.stringify(value, null, 2));
      }
      return { pathA, pathB, globeId: globe.assetId, bookId: book.id };
    }, MAP);
    const openFixture = async (mapPath) => {
      await page.evaluate(async (target) => app.workspace.getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(target)), mapPath);
      await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
      await chooseTool("Möbel");
      await page.locator(".dn-object-library-tabs").getByRole("button", { name: "Used" }).click();
      return page.locator(".dn-object-library-tile").evaluateAll((tiles) =>
        tiles.map((tile) => tile.dataset.assetId));
    };
    assert.deepEqual(await openFixture(fixtures.pathA), [fixtures.globeId, fixtures.bookId]);
    await page.evaluate(() => app.workspace.activeLeaf.view.editor.renderer.setFloor("floor-2"));
    assert.deepEqual(await page.locator(".dn-object-library-tile").evaluateAll((tiles) =>
      tiles.map((tile) => tile.dataset.assetId)), [fixtures.globeId, fixtures.bookId]);
    await page.screenshot({ path: path.join(out, "used-upper-two-assets.png") });
    assert.deepEqual(await openFixture(fixtures.pathB), [fixtures.bookId]);
    await page.screenshot({ path: path.join(out, "used-other-map-book.png") });
    assert.deepEqual(await openFixture(fixtures.pathA), [fixtures.globeId, fixtures.bookId]);
    checks.push("Used covers both floors of the current map and switches to the other map's assets");
  }

  async function ownMinimal(restart) {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PCK)).digest("hex"), PCK_SHA);
    await page.evaluate(async (pckPath) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pckPath), PCK);
    if (!restart) await page.evaluate(async (mapPath) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(mapPath, JSON.stringify({
        format: "dungeon-map", version: 3, id: "qa-own-minimal",
        settings: { name: "Own Tags", width: 8, height: 8, feetPerField: 5,
          assetPacks: [], builtInAssets: true, wallShadows: true,
          objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
    }, MAP);
    await openMap();
    await chooseTool("Möbel");
    const tagFile = path.join(vault, ".obsidian/dungeon-editor-assets/object-tags.json");
    const before = fs.readFileSync(tagFile, "utf8");
    assert.deepEqual(Object.keys(JSON.parse(before).tags), ["QA Own Tag"]);
    await openTags();
    assert.equal(await modal().locator('input[type="radio"]').first().isChecked(), true);
    assert.equal(await modal().getByRole("combobox", { name: "Tag wählen" }).locator("option").count(), 81);
    await modal().locator('input[type="radio"]').nth(1).click();
    assert.doesNotMatch(await modal().innerText(), /Create Tag Overrides/);
    assert.equal(await modal().getByRole("combobox", { name: "Tag wählen" }).locator("option").count(), 1);
    assert.equal(await modal().getByRole("combobox", { name: "Tag wählen" }).inputValue(), "QA Own Tag");
    assert.equal(await modal().locator('.dn-object-tag-tile[aria-label="Atlas Globe 01"]')
      .getAttribute("aria-pressed"), "true");
    await modal().getByRole("button", { name: "Edit Sets" }).click();
    assert.equal(await modal().getByRole("combobox", { name: "Set wählen" }).inputValue(), "QA Own Set");
    assert.equal(await modal().getByRole("checkbox", { name: "QA Own Tag" }).isChecked(), true);
    if (!restart) {
      await modal().getByRole("button", { name: "Save" }).click();
      const savedHash = crypto.createHash("sha256").update(fs.readFileSync(tagFile)).digest("hex");
      await modal().getByRole("button", { name: "Edit Tags" }).click();
      await modal().getByRole("button", { name: "Tag hinzufügen" }).click();
      await modal().getByRole("textbox", { name: "Tagname" }).fill("QA Unsaved Window X");
      await modal().getByRole("button", { name: "Accept" }).click();
      const frame = await page.locator(".dn-object-tags-dialog").boundingBox();
      assert(frame, "tag browser frame missing");
      await page.mouse.click(frame.x + frame.width - 25, frame.y + 18);
      await modal().waitFor({ state: "detached" });
      assert.equal(crypto.createHash("sha256").update(fs.readFileSync(tagFile)).digest("hex"), savedHash);
      await openTags();
      assert.equal(await modal().locator('option[value="QA Unsaved Window X"]').count(), 0);
    }
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    const after = JSON.parse(fs.readFileSync(tagFile, "utf8"));
    assert.deepEqual(after.tags["QA Own Tag"], [
      "res://textures/objects/activities/administration/atlas_globe_01.png"]);
    assert.deepEqual(after.sets["QA Own Set"], ["QA Own Tag"]);
    fs.writeFileSync(path.join(out, "own-minimal.json"), JSON.stringify({
      beforeHash: crypto.createHash("sha256").update(before).digest("hex"),
      afterHash: crypto.createHash("sha256").update(fs.readFileSync(tagFile)).digest("hex"),
      document: after,
    }, null, 2));
    checks.push(restart ? "Fresh process loads one own tag and set without copy prompt" :
      "Existing own tag and set load without copy prompt and persist after Save");
  }

  return { edit, reopen, ownMinimal };
};
