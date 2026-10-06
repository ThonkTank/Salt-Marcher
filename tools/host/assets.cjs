module.exports = ({ page, fs, path, assert, crypto, root, qa, vault, restart, out, checks, chooseTool }) => {
async function prefabForgetWorkflow(view) {
  const mapPath = "Dungeons/PrefabQA/Karte.dungeon";
  const prefabId = "prefab-forget-qa";
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("PrefabQA", 12, 8),
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await page.evaluate(async (id) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.savePrefab({
        id, set: "QA", name: "Tisch mit Licht", center: { x: 3.5, y: 3 },
        entities: [
          { id: "source-object", kind: "object", floorId: "floor-1",
            x: 3, y: 3, rotation: 0, width: 1, height: 1,
            color: 0x886644, label: "", layer: 100, flip: false },
          { id: "source-light", kind: "light", floorId: "floor-1",
            x: 4, y: 3, radius: 2, intensity: 1, color: 0xeccd8b,
            shadows: false },
        ],
      });
      window.__qaPrefabForForget = plugin.prefabs()[0];
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.refreshPrefabs();
    }, prefabId);
    await chooseTool("Baustein");
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    const at = await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return { x: box.x + renderer.camera.x + 6 * renderer.camera.scale,
        y: box.y + renderer.camera.y + 4 * renderer.camera.scale };
    });
    await page.mouse.click(at.x, at.y);
    const placed = (await view()).document.entities.filter((entity) =>
      entity.prefabId === prefabId);
    assert.deepEqual(placed.map((entity) => entity.kind).sort(),
      ["light", "object"]);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
    const before = fs.readFileSync(vault + "/" + mapPath, "utf8");
    const forget = page.getByRole("button", { name: "Vorlage vergessen", exact: true });
    assert.equal(await forget.isEnabled(), true);
    await forget.click();
    const dialog = page.locator("dialog.dn-confirm-dialog");
    await dialog.getByText("Bereits platzierte Elemente bleiben", { exact: false }).waitFor();
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 1);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Cancel keeps the saved prefab and placed pair in this host build");
    await forget.click();
    await dialog.waitFor();
    await page.evaluate(async () => {
      const note = await app.vault.create("Dungeons/PrefabQA/Dialogwechsel.md", "# Dialogwechsel\n");
      await app.workspace.getLeavesOfType("dungeon-native-map")[0].openFile(note);
    });
    await dialog.waitFor({ state: "detached" });
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 1);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Closing the map while Forget warning is open cancels it and preserves the saved pair");
    await page.evaluate(async (path) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
    mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseTool("Baustein");
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    await forget.click();
    await dialog.getByRole("button", { name: "Vergessen", exact: true }).click();
    await page.waitForFunction(() =>
      app.plugins.getPlugin("dungeon-editor").prefabs().length === 0);
    assert.equal(await page.getByRole("combobox", { name: "Vorlage", exact: true }).inputValue(), "");
    assert.equal(await forget.isEnabled(), false);
    assert.equal((await view()).document.entities.filter((entity) =>
      entity.prefabId === prefabId).length, 2);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
    await page.screenshot({ path: out + "/prefab-forgotten.png" });
    checks.push("Confirmed Forget durably removes only the definition and leaves the saved object-light pair byte-exact");
    await page.evaluate(async () => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.savePrefab(window.__qaPrefabForForget);
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.refreshPrefabs();
      const original = plugin.saveData.bind(plugin);
      let release;
      const blocked = new Promise((resolve) => { release = resolve; });
      let entered;
      const started = new Promise((resolve) => { entered = resolve; });
      let held = false;
      plugin.saveData = async (data) => {
        if (!held && data.prefabs.length === 0) {
          held = true;
          entered();
          await blocked;
        }
        return original(data);
      };
      window.__qaForgetRace = { plugin, original, started, release };
    });
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    await forget.click();
    await dialog.getByRole("button", { name: "Vergessen", exact: true }).click();
    await page.evaluate(() => window.__qaForgetRace.started);
    await page.evaluate(async () => {
      const race = window.__qaForgetRace;
      race.plugin.persistToolDefaults();
      race.release();
      await race.plugin.pluginDataWrites;
      race.plugin.saveData = race.original;
      delete window.__qaForgetRace;
    });
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 0);
    assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Concurrent tool-default persistence cannot restore a confirmed forgotten prefab");
    return;
  }
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 0);
  const pair = (await view()).document.entities.filter((entity) => entity.prefabId === prefabId);
  assert.deepEqual(pair.map((entity) => entity.kind).sort(), ["light", "object"]);
  assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
  await page.screenshot({ path: out + "/prefab-reopened.png" });
  checks.push("Fresh Obsidian process keeps the definition forgotten while the object-light pair reopens intact");
}
function twoPathFixture(bytes) {
  const input = Buffer.from(bytes);
  const original = new DataView(input.buffer, input.byteOffset, input.byteLength);
  assert.equal(original.getUint32(0, true), 0x43504447);
  const files = [];
  let cursor = 88;
  for (let index = 0; index < original.getUint32(84, true); index++) {
    const length = original.getUint32(cursor, true);
    cursor += 4;
    const name = input.subarray(cursor, cursor + length).toString("utf8").replace(/\0+$/, "");
    cursor += length;
    const offset = Number(original.getBigUint64(cursor, true));
    const size = Number(original.getBigUint64(cursor + 8, true));
    cursor += 32;
    files.push({ name, bytes: input.subarray(offset, offset + size) });
  }
  const image = files.find((file) => file.name.endsWith("/QA Path.png"));
  assert(image);
  files.push({ name: "res://packs/QAPath01/textures/paths/Other Path.png", bytes: image.bytes });
  const header = Buffer.from(input.subarray(0, 88));
  header.writeUInt32LE(files.length, 84);
  const tableSize = files.reduce((sum, file) => sum + 4 + Buffer.byteLength(file.name) + 32, 0);
  let payloadOffset = 88 + tableSize;
  const table = files.map((file) => {
    const name = Buffer.from(file.name);
    const row = Buffer.alloc(4 + name.length + 32);
    row.writeUInt32LE(name.length, 0);
    name.copy(row, 4);
    row.writeBigUInt64LE(BigInt(payloadOffset), 4 + name.length);
    row.writeBigUInt64LE(BigInt(file.bytes.length), 12 + name.length);
    payloadOffset += file.bytes.length;
    return row;
  });
  return Buffer.concat([header, ...table, ...files.map((file) => file.bytes)]);
}
async function pathLibraryWorkflow(view) {
  const mapPath = "Dungeons/PathLibraryQA/Karte.dungeon";
  const packPath = root + "/../dungeon-auswertung/tests/fixtures/" +
    "path-texture-probe/own-path.dungeondraft_pack";
  const packDigest = crypto.createHash("sha256")
    .update(fs.readFileSync(packPath)).digest("hex");
  assert.equal(packDigest,
    "69aeb699a8008ac874b61ba988c9463aa6a569f32c851d8c638a6815936f7c41");
  const fixture = twoPathFixture(fs.readFileSync(packPath));
  fs.writeFileSync(out + "/two-path-fixture.dungeondraft_pack", fixture);
  fs.writeFileSync(out + "/two-path-fixture.sha256",
    crypto.createHash("sha256").update(fixture).digest("hex") + "\n");
  if (restart) {
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(mapPath)),
    mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const saved = await view();
    const path = saved.document.entities.find((entity) => entity.kind === "path");
    assert(path);
    const asset = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .find((asset) => asset.kind === "path" && asset.name === "QA Path"));
    assert(asset);
    assert.equal(path.material.assetId, asset.id);
    assert.equal(path.material.assetPart, "image");
    assert(saved.document.settings.assetPacks.includes("QAPath01"));
    await chooseTool("Pfad");
    assert.equal(await page.locator(".dn-path-library-tiles button").count(), 2);
    const rendered = await page.evaluate((id) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      const visual = editor.renderer.visuals.get(id);
      return { present: !!visual, assets: visual?.assets ?? [] };
    }, path.id);
    assert(rendered.present);
    assert(rendered.assets.includes(asset.id + "\0image"));
    checks.push("Saved path texture reference and rendered visual reopen with both library tiles");
    return;
  }
  await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").create("PathLibraryQA", 12, 8));
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  const encoded = fixture.toString("base64");
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([bytes])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: ["QAPath01"] } } });
  }, encoded);
  await chooseTool("Pfad");
  const tiles = page.locator(".dn-path-library-tiles button");
  await tiles.first().waitFor();
  assert.equal(await tiles.count(), 2);
  const input = page.getByRole("searchbox", { name: "Pfadbibliothek durchsuchen" });
  await input.fill("QA Path");
  await input.press("Enter");
  assert.equal(await tiles.count(), 1);
  assert.equal(await input.inputValue(), "QA Path");
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  assert.equal(await tiles.count(), 2);
  assert.equal(await input.inputValue(), "QA Path");
  checks.push("Clear Search restores every available path tile while retaining the visible query");
  const asset = await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").listAssets()
      .find((asset) => asset.kind === "path" && asset.name === "QA Path"));
  assert(asset);
  await page.locator('.dn-path-library-tiles button[aria-label="QA Path"]').click();
  assert.equal(await page.getByRole("combobox", { name: "Paketmaterial" }).inputValue(), asset.id);
  const beforePlace = await view();
  const at = async (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  for (const point of [{ x: 2, y: 2 }, { x: 6, y: 2 }]) {
    const screen = await at(point);
    await page.mouse.click(screen.x, screen.y);
  }
  await page.keyboard.press("Enter");
  const placed = await view();
  const path = placed.document.entities.find((entity) => entity.kind === "path");
  assert(path);
  assert.equal(path.material.assetId, asset.id);
  assert.equal(placed.history, beforePlace.history + 1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await view()).document.entities.filter((entity) => entity.kind === "path").length, 0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await view()).document.entities.find((entity) => entity.kind === "path").material.assetId, asset.id);
  checks.push("Library tile selects the package path; placement has one Undo step and Redo restores it");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() =>
    !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await page.screenshot({ path: out + "/path-library.png" });
  checks.push("Path Library selection and path save cleanly");
}

return { prefabForgetWorkflow, twoPathFixture, pathLibraryWorkflow };
};
