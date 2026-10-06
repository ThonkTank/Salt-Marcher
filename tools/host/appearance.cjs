module.exports = ({ page, fs, path, assert, crypto, PNG, root, qa, vault, sourceVault, restart, out, checks, chooseTool, sleep }) => {
async function objectAlphaWorkflow(view) {
  const mapPath = "Dungeons/ObjectAlphaQA/Karte.dungeon";
  const packPath = root + "/../dungeon-auswertung/tests/fixtures/" +
    "colorable-object-alpha-solid-probe/own-object-color.dungeondraft_pack";
  const packDigest = crypto.createHash("sha256")
    .update(fs.readFileSync(packPath)).digest("hex");
  assert.equal(packDigest,
    "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088");
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("ObjectAlphaQA", 12, 8));
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const encoded = fs.readFileSync(packPath).toString("base64");
    await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session;
      const before = session.settings;
      session.execute({ label: "QA-Paket für Karte aktivieren",
        settings: { before, after: { ...before, assetPacks: ["QAObjASl"] } } });
    }, encoded);
    await page.waitForFunction(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .some((asset) => asset.name === "QA Object Color" && asset.tintable));
    const asset = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .find((asset) => asset.name === "QA Object Color"));
    assert.equal(asset.kind, "object");
    assert.equal(asset.tintable, true);
    assert((await view()).document.settings.assetPacks.includes("QAObjASl"));
    checks.push("Hash-checked Colorable object pack loads with its native tag");
    await chooseTool("Möbel");
    await page.getByRole("combobox", { name: "Paketobjekt", exact: true })
      .selectOption(asset.id);
    const color = page.locator('input[aria-label="Objektfarbe"]');
    await color.fill("#4080c0");
    await color.press("Tab");
    for (const [name, value] of [["Breite in Feldern", "2.8"], ["Höhe in Feldern", "2.8"]]) {
      const input = page.locator(`input[aria-label="${name}"]`);
      await input.fill(value);
      await input.press("Tab");
    }
    await page.locator('input[aria-label="Schatten"]').uncheck();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.appearance.mapFill = 0x252525;
      renderer.appearance.grid = false;
      renderer.drawGrid();
      renderer.invalidate();
    });
    const at = (x, y) => page.evaluate(({ x, y }) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
        y: box.y + renderer.camera.y + y * renderer.camera.scale };
    }, { x, y });
    const ids = [];
    for (const [index, alpha] of [255, 128, 0].entries()) {
      await chooseTool("Möbel");
      const input = page.locator('input[aria-label="Objektfarbe Alpha (0–255)"]');
      await input.fill(String(alpha));
      await input.press("Tab");
      const before = (await view()).document.entities.length;
      const point = await at(2 + index * 3, 4);
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction((length) =>
        app.workspace.getLeavesOfType("dungeon-native-map")[0]
          .view.editor.session.document().entities.length === length + 1,
      before);
      const placed = (await view()).document.entities.at(-1);
      assert.equal(placed.kind, "object");
      assert.equal(placed.assetId, asset.id);
      assert.equal(placed.color, 0x4080c0);
      assert.equal(placed.alpha, alpha);
      assert.equal(placed.shadow, false);
      ids.push(placed.id);
    }
    await page.waitForFunction((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      return ids.every((id) => renderer.visuals.get(id)?.container.children
        .some((child) => !!child.texture));
    }, ids);
    const visualAlpha = await page.evaluate((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      return ids.map((id) => {
        const visual = renderer.visuals.get(id);
        const sprite = visual.container.children.find((child) =>
          !!child.texture);
        return { id, spriteAlpha: sprite.alpha,
          shadowAlpha: visual.container.children[0]?.alpha };
      });
    }, ids);
    assert.deepEqual(visualAlpha.map((item) => item.spriteAlpha), [1, 1, 1]);
    const screenshot = await page.locator(".dn-canvas canvas")
      .screenshot({ path: out + "/object-alpha-before-save.png" });
    const pixels = PNG.sync.read(screenshot),
      sample = (x, y) => [...pixels.data.subarray(
        (y * pixels.width + x) * 4, (y * pixels.width + x) * 4 + 3)];
    const colorablePixels = [60, 204, 348].map((x) => sample(x, 500));
    const fixedPixels = [100, 244, 388].map((x) => sample(x, 500));
    assert.deepEqual(colorablePixels[2], [37, 37, 37]);
    for (let channel = 0; channel < 3; channel++) {
      const expected = 37 + (colorablePixels[0][channel] - 37) * 128 / 255;
      assert(Math.abs(colorablePixels[1][channel] - expected) <= 2);
      assert(Math.abs(fixedPixels[1][channel] - fixedPixels[0][channel]) <= 1);
      assert(Math.abs(fixedPixels[2][channel] - fixedPixels[0][channel]) <= 1);
    }
    checks.push("Colorable object keeps fixed pixels while A=128 halves and A=0 hides only tinted pixels");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await view()).document.entities.some((e) => e.id === ids[2]), false);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await view()).document.entities.some((e) => e.id === ids[2]), true);
    checks.push("Object alpha remains attached to its creation through host undo and redo");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.dirty);
    const disk = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
    assert.equal(disk.version, 3);
    assert.deepEqual(ids.map((id) => disk.entities.find((e) => e.id === id).alpha),
      [255, 128, 0]);
    fs.writeFileSync(qa + "/object-alpha-saved.json",
      JSON.stringify({ mapPath, ids, assetId: asset.id }));
    checks.push("V3 save preserves all three 8-bit alpha bytes and object instances");
    return;
  }
  const { ids, assetId } = JSON.parse(
    fs.readFileSync(qa + "/object-alpha-saved.json", "utf8"));
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await page.evaluate(() => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    renderer.appearance.mapFill = 0x252525;
    renderer.appearance.grid = false;
    renderer.drawGrid();
    renderer.invalidate();
  });
  const saved = (await view()).document;
  assert.equal(saved.version, 3);
  assert.deepEqual(ids.map((id) => saved.entities.find((e) => e.id === id).alpha),
    [255, 128, 0]);
  assert(ids.every((id) => saved.entities.find((e) => e.id === id).assetId === assetId));
  await page.waitForFunction((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return ids.every((id) => renderer.visuals.get(id)?.container.children
      .some((child) => !!child.texture));
  }, ids);
  const alpha = await page.evaluate((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return ids.map((id) => renderer.visuals.get(id).container.children
      .find((child) => !!child.texture).alpha);
  }, ids);
  assert.deepEqual(alpha, [1, 1, 1]);
  const reopenedImage = await page.locator(".dn-canvas canvas")
    .screenshot({ path: out + "/object-alpha-reopened.png" });
  const reopenedPixels = PNG.sync.read(reopenedImage);
  const reopenedSample = (x, y) => [...reopenedPixels.data.subarray(
    (y * reopenedPixels.width + x) * 4,
    (y * reopenedPixels.width + x) * 4 + 3)];
  const reopenedColorable = [60, 204, 348]
    .map((x) => reopenedSample(x, 500));
  const reopenedFixed = [100, 244, 388]
    .map((x) => reopenedSample(x, 500));
  assert.deepEqual(reopenedColorable[2], [37, 37, 37]);
  for (let channel = 0; channel < 3; channel++) {
    const expected = 37 + (reopenedColorable[0][channel] - 37) * 128 / 255;
    assert(Math.abs(reopenedColorable[1][channel] - expected) <= 2);
    assert(Math.abs(reopenedFixed[1][channel] - reopenedFixed[0][channel]) <= 1);
    assert(Math.abs(reopenedFixed[2][channel] - reopenedFixed[0][channel]) <= 1);
  }
  checks.push("Fresh Obsidian process preserves alpha bytes, selective pixels and fixed pixels");
}
async function patternAlphaWorkflow(view) {
  const mapPath = "Dungeons/PatternQA/Karte.dungeon";
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("PatternQA", 12, 8),
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseTool("Muster");
    const patternDefaults = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.settings.surfaces.pattern,
    );
    assert.equal(patternDefaults.wallWidth, patternOutline ? 0 : 0.08);
    const alpha = page.locator('input[aria-label="Alpha (0–255)"]');
    assert.equal(await alpha.inputValue(), "255");
    await alpha.fill("160");
    await alpha.press("Tab");
    const canvas = page.locator(".dn-canvas canvas");
    const at = (point) => page.evaluate((point) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return {
        x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
      };
    }, point);
    const a = await at({ x: 2, y: 2 });
    const b = await at({ x: 6, y: 5 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        ?.view.editor.session.document().entities.some(
          (entity) => entity.kind === "surface" && entity.category === "pattern"),
    );
    const pattern = (await view()).document.entities.find(
      (entity) => entity.kind === "surface" && entity.category === "pattern",
    );
    assert.equal(pattern.opacity, 160 / 255);
    assert.equal(pattern.wallWidth, patternOutline ? 0 : 0.08);
    assert.equal(pattern.layer, 100);
    checks.push("Pattern stores exact 8-bit alpha 160/255 with the current outline setting");
    await canvas.screenshot({ path: out + "/pattern-alpha-160.png" });
    await page.keyboard.press("Control+z");
    assert.equal((await view()).document.entities.some((entity) => entity.id === pattern.id), false);
    await page.keyboard.press("Control+Shift+z");
    assert.equal((await view()).document.entities.some((entity) => entity.id === pattern.id), true);
    checks.push("Pattern alpha survives creation undo and redo");
    if (patternOutline) {
    await page.evaluate(async (id) =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.select(id),
    pattern.id);
    const outline = page.locator('input[aria-label="Konturbreite"]');
    await outline.fill("0.08");
    await outline.press("Tab");
    const wallWidth = async () => (await view()).document.entities.find(
      (entity) => entity.id === pattern.id,
    ).wallWidth;
    assert.equal(await wallWidth(), 0.08);
    await canvas.screenshot({ path: out + "/pattern-outline-on.png" });
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal(await wallWidth(), 0);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal(await wallWidth(), 0.08);
    await page.evaluate(async (id) =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.select(id),
    pattern.id);
    await outline.fill("0");
    await outline.press("Tab");
    assert.equal(await wallWidth(), 0);
    checks.push("Pattern outline enabled with undo and redo, then disabled and saved");
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.dirty,
    );
    const disk = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
    assert.equal(disk.version, 3);
    const saved = disk.entities.find((entity) => entity.id === pattern.id);
    assert.equal(saved.opacity, 160 / 255);
    assert.equal(saved.wallWidth, patternOutline ? 0 : 0.08);
    fs.writeFileSync(qa + "/pattern-alpha-saved.json", JSON.stringify({ mapPath, id: pattern.id }));
    checks.push("Pattern map saves as V3 with exact alpha and outline setting");
    return;
  }
  const { id } = JSON.parse(fs.readFileSync(qa + "/pattern-alpha-saved.json", "utf8"));
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  const opened = (await view()).document;
  const pattern = opened.entities.find((entity) => entity.id === id);
  assert.equal(opened.version, 3);
  assert.equal(pattern.opacity, 160 / 255);
  assert.equal(pattern.wallWidth, patternOutline ? 0 : 0.08);
  await page.locator(".dn-canvas canvas").screenshot({ path: out + "/pattern-alpha-reopened.png" });
  checks.push("Fresh Obsidian process reopens exact pattern alpha and outline setting");
}
async function v2OpenWorkflow(view) {
  for (const mapPath of ["Dungeons/Drachenhöhle/Karte.dungeon", "Dungeons/test/Karte.dungeon"]) {
    const expected = JSON.parse(fs.readFileSync(path.resolve(sourceVault, mapPath), "utf8"));
    assert.equal(expected.version, 2);
    await page.evaluate(async (path) => {
      const file = app.vault.getAbstractFileByPath(path);
      const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0] ?? app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
    const opened = (await view()).document;
    assert.deepEqual(opened, { ...expected, version: 3 });
    checks.push(`V2 map ${mapPath} opens as V3 in the real Obsidian editor with exact fields`);
    if (!restart) {
      assert.equal(JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8")).version, 2);
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      let saved;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8")); }
        catch { saved = undefined; }
        if (saved?.version === 3) break;
        await sleep(50);
      }
      assert.deepEqual(saved, { ...expected, version: 3 });
      checks.push(`Isolated copy of ${mapPath} saves without changing any map field except version`);
    } else {
      const saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
      assert.deepEqual(saved, { ...expected, version: 3 });
      checks.push(`Fresh Obsidian process reopens saved V3 copy of ${mapPath}`);
    }
  }
  await page.screenshot({ path: out + "/v2-maps-opened.png" });
}

return { objectAlphaWorkflow, patternAlphaWorkflow, v2OpenWorkflow };
};
