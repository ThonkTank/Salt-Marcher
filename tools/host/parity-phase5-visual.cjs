const PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const ORIGINAL = "/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-auswertung/reference/own-colorable-object-alpha-solid.dungeondraft_map";
const PACK_SHA = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const MAP = "Dungeons/Parity/Object-Alpha-Visual.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks }) => {
  const objects = () => page.evaluate(() => app.workspace.activeLeaf.view.editor
    .session.document().entities.filter((v) => v.kind === "object"));
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      renderer.appearance.mapFill = 0x252525;
      renderer.appearance.grid = false;
      renderer.drawGrid();
      renderer.invalidate();
    });
    await page.waitForFunction(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      return editor.session.document().entities.filter((v) => v.kind === "object")
        .every((v) => editor.renderer.visuals.get(v.id)?.container.children
          .some((child) => !!child.texture));
    });
  };
  async function edit() {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PACK))
      .digest("hex"), PACK_SHA);
    const original = JSON.parse(fs.readFileSync(ORIGINAL));
    const native = original.world.levels["0"].objects;
    assert.deepEqual(native.map((item) => item.custom_color),
      ["ffffffff", "ff4080c0", "804080c0", "004080c0"]);
    await page.evaluate(async (encoded) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
    }, fs.readFileSync(PACK).toString("base64"));
    const asset = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .listAssets(["QAObjASl"], true)
      .find((item) => item.name === "QA Object Color"));
    assert.equal(asset.tintable, true);
    const entities = native.map((item, index) => {
      const pos = item.position.match(/^Vector2\( ([\d.-]+), ([\d.-]+) \)$/);
      const scale = item.scale.match(/^Vector2\( ([\d.-]+), ([\d.-]+) \)$/);
      assert(pos && scale);
      return { id: `alpha-visual-${index}`, kind: "object", floorId: "floor-1",
        x: Number(pos[1]) / 256, y: Number(pos[2]) / 256,
        rotation: item.rotation,
        width: asset.objectSizeFields.width * Number(scale[1]),
        height: asset.objectSizeFields.height * Number(scale[2]),
        color: Number.parseInt(item.custom_color.slice(2), 16),
        alpha: Number.parseInt(item.custom_color.slice(0, 2), 16),
        label: "", layer: item.layer, shadow: item.shadow,
        blocksLight: item.block_light, flip: false, assetId: asset.id };
    });
    await page.evaluate(async ({ name, entities }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-alpha-visual",
        settings: { name: "Object Alpha Visual", width: 8, height: 8,
          feetPerField: 5, assetPacks: ["QAObjASl"], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities, content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, entities });
    await open();
    assert.deepEqual(await objects(), entities);
    fs.writeFileSync(path.join(out, "alpha-visual-pair.json"), JSON.stringify({
      original: ORIGINAL,
      originalSha256: crypto.createHash("sha256").update(fs.readFileSync(ORIGINAL)).digest("hex"),
      packSha256: PACK_SHA, entities,
    }, null, 2));
    await page.screenshot({ path: path.join(out, "alpha-visual.png") });
    checks.push("Controlled four-object native alpha matrix renders white, RGB, A=128 and A=0");
  }
  async function reopen() {
    await open();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    assert.deepEqual(await objects(), saved.entities);
    await page.screenshot({ path: path.join(out, "alpha-visual-reopen.png") });
    checks.push("Fresh process renders the same four-object alpha matrix");
  }
  return { edit, reopen };
};
