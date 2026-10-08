const PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const PACK_SHA = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const MAP = "Dungeons/Parity/Object-Alpha-Review.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return { objects: editor.session.document().entities.filter((e) => e.kind === "object"),
      defaults: editor.settings.object, history: editor.session.historySize,
      dirty: editor.session.dirty };
  });
  const screen = (x, y) => page.evaluate(({ x, y }) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PACK))
      .digest("hex"), PACK_SHA);
    await page.evaluate(async (encoded) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
    }, fs.readFileSync(PACK).toString("base64"));
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-alpha-review",
        settings: { name: "Object Alpha Review", width: 12, height: 8,
          feetPerField: 5, assetPacks: ["QAObjASl"], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    await page.getByRole("button", { name: "QA Object Color", exact: true }).click();
    const asset = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .listAssets(["QAObjASl"], true).find((item) => item.name === "QA Object Color"));
    assert.equal(asset.tintable, true);
    const initial = await state();
    assert.equal(initial.objects.length, 0);
    for (const [index, alpha] of [255, 128, 0].entries()) {
      await page.getByRole("button", { name: "Objektfarbe RGBA öffnen" }).click();
      const hex = page.getByRole("textbox", { name: "Hex ARGB" });
      await hex.fill("ff4080c0");
      await hex.press("Tab");
      const a = page.getByRole("spinbutton", { name: "A", exact: true });
      await a.fill(String(alpha));
      await a.press("Tab");
      assert.equal(await hex.inputValue(), alpha === 255 ? "4080c0" :
        `${alpha.toString(16).padStart(2, "0")}4080c0`);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      const before = await state();
      assert.equal(before.defaults.alpha, alpha);
      assert.equal(before.defaults.color, 0x4080c0);
      assert.equal(before.history, initial.history + index);
      const point = await screen(2 + index * 4, 4);
      await page.mouse.move(point.x, point.y);
      await page.screenshot({ path: path.join(out, `alpha-${alpha}-preview.png`) });
      await page.mouse.click(point.x, point.y);
      const after = await state();
      assert.equal(after.objects.length, index + 1);
      assert.equal(after.history, initial.history + index + 1);
      assert.deepEqual(after.objects.slice(0, index), before.objects);
      const placed = after.objects[index];
      assert.equal(placed.assetId, asset.id);
      assert.equal(placed.color, 0x4080c0);
      assert.equal(placed.alpha, alpha);
      assert.deepEqual([placed.x, placed.y], [2 + index * 4, 4]);
      fs.writeFileSync(path.join(out, `alpha-${alpha}.json`), JSON.stringify(after, null, 2));
      await page.mouse.move(800, 45);
      await page.screenshot({ path: path.join(out, `alpha-${alpha}.png`) });
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    assert.deepEqual(saved.entities.filter((e) => e.kind === "object"), (await state()).objects);
    assert.deepEqual(saved.entities.map((e) => e.alpha), [255, 128, 0]);
    checks.push("Picker A=255/128/0 transfers to three new Colorable objects, one history step each, and saves exact bytes");
  }
  async function reopen() {
    await open();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    const current = await state();
    assert.deepEqual(current.objects, saved.entities.filter((e) => e.kind === "object"));
    assert.deepEqual(current.objects.map((e) => e.alpha), [255, 128, 0]);
    assert.equal(current.dirty, false);
    fs.writeFileSync(path.join(out, "alpha-reopen.json"), JSON.stringify(current, null, 2));
    await page.screenshot({ path: path.join(out, "alpha-reopen.png") });
    checks.push("Fresh process reopens all three UI-created alpha values unchanged");
  }
  return { edit, reopen };
};
