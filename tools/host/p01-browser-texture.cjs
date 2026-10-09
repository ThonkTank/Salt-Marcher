const MAP = "Dungeons/P01TextureQA/Karte.dungeon";
const PACK = "/home/aaron/Schreibtisch/dungeon-auswertung/tests/fixtures/" +
  "colorable-object-alpha-solid-probe/own-object-color.dungeondraft_pack";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, chooseTool }) => {
  const priorFile = path.join(qa, "p01-browser-texture-saved.json");
  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const state = () => page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0] ??
      app.workspace.getLeavesOfType("dungeon-native-pending")[0];
    const editor = leaf?.view?.editor;
    if (!editor) return null;
    const objects = editor.session.document().entities.filter((item) => item.kind === "object");
    return { objects, version: editor.session.version, dirty: editor.session.dirty,
      mapId: editor.session.id, selectedAsset: editor.settings.object.assetId,
      textured: objects.map((item) => editor.renderer.visuals.get(item.id)
        ?.container.children.some((child) => !!child.texture) ?? false) };
  });
  async function edit() {
    assert.equal(sha(PACK), "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088");
    await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").create("P01TextureQA", 12, 8));
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    const encoded = fs.readFileSync(PACK).toString("base64");
    const asset = await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
      const before = editor.session.settings;
      editor.session.execute({ label: "QA-Paket aktivieren", settings: {
        before, after: { ...before, assetPacks: ["QAObjASl"] },
      } });
      return plugin.listAssets().find((candidate) =>
        candidate.name === "QA Object Color" && candidate.tintable);
    }, encoded);
    assert(asset?.id);
    await chooseTool("Möbel");
    const target = page.locator(`.dn-object-library-tile[data-asset-id="${asset.id}"]`);
    await target.waitFor({ state: "visible" });
    await target.click();
    assert.equal(await target.getAttribute("aria-pressed"), "true");
    assert.equal((await state()).selectedAsset, asset.id);
    const point = await page.evaluate(() => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
      const renderer = editor.renderer, bounds = renderer.canvas.getBoundingClientRect();
      return { x: bounds.x + renderer.camera.x + 6 * renderer.camera.scale,
        y: bounds.y + renderer.camera.y + 4 * renderer.camera.scale };
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-pending")[0]?.view?.editor;
      const item = editor?.session.document().entities.find((entity) => entity.kind === "object");
      return item && editor.renderer.visuals.get(item.id)?.container.children
        .some((child) => !!child.texture);
    });
    const placed = await state();
    assert.equal(placed.objects.length, 1);
    assert.equal(placed.objects[0].assetId, asset.id);
    assert.deepEqual(placed.textured, [true]);
    await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "placed.png") });
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !!app.vault.getAbstractFileByPath("Dungeons/P01TextureQA/Karte.dungeon"));
    const disk = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.equal(disk.id, placed.mapId);
    assert.equal(disk.entities.filter((item) => item.kind === "object").length, 1);
    fs.writeFileSync(priorFile, JSON.stringify({ id: placed.objects[0].id,
      assetId: asset.id, mapId: placed.mapId, hash: sha(path.join(vault, MAP)) }));
    checks.push("Current object library places a colorable pack asset, renders a texture and saves the V4 map");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(priorFile, "utf8"));
    await page.evaluate(async (map) => {
      await app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(map));
    }, MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.waitForFunction((id) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
      return editor?.renderer.visuals.get(id)?.container.children
        .some((child) => !!child.texture);
    }, prior.id);
    const opened = await state();
    assert.equal(opened.mapId, prior.mapId);
    assert.equal(opened.objects.find((item) => item.id === prior.id)?.assetId, prior.assetId);
    assert.equal(sha(path.join(vault, MAP)), prior.hash);
    await page.locator(".dn-canvas canvas").screenshot({ path: path.join(out, "reopened.png") });
    checks.push("Fresh Obsidian process reopens the same object ID and renders its colorable texture without changing map bytes");
  }
  return { edit, reopen };
};
