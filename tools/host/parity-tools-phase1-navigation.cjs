const MAP = "Dungeons/Parity/Phase1-Navigation.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const file = path.join(vault, MAP);
  const saved = path.join(qa, "phase1-navigation-baseline.json");
  const digest = () => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const snapshot = (screen) => page.evaluate((screen) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    const renderer = editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const point = screen ?? { x: box.x + box.width / 2 + 60,
      y: box.y + box.height / 2 + 40 };
    const local = { x: point.x - box.x, y: point.y - box.y };
    return { point, local,
      world: { x: (local.x - renderer.camera.x) / renderer.camera.scale,
        y: (local.y - renderer.camera.y) / renderer.camera.scale },
      camera: { x: renderer.camera.x, y: renderer.camera.y,
        scale: renderer.camera.scale },
      document: editor.session.document(),
      history: editor.session.historySize,
      dirty: editor.session.dirty };
  }, screen);
  const open = async () => {
    await page.evaluate(async (map) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(map)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  };
  async function edit() {
    await page.evaluate(async (map) => {
      await app.vault.createFolder("Dungeons/Parity");
      await app.vault.create(map, JSON.stringify({
        format: "dungeon-map", version: 4, id: "phase1-navigation",
        settings: { name: "Phase1 Navigation", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [{ id: "object-1", kind: "object", floorId: "floor-1",
          x: 4, y: 4, rotation: 0, width: 1, height: 1,
          color: 0x6688aa, label: "", layer: 100, flip: false }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.zoom(64 / renderer.camera.scale);
    });
    const before = await snapshot();
    assert.equal(before.camera.scale, 64);
    assert.equal(before.dirty, false);
    const originalHash = digest();
    await page.mouse.move(before.point.x, before.point.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    const zoomed = await snapshot(before.point);
    await page.mouse.wheel(0, 100);
    await page.keyboard.up("Control");
    const restored = await snapshot(before.point);
    assert.equal(zoomed.camera.scale, 80);
    assert.equal(restored.camera.scale, 64);
    for (const state of [zoomed, restored]) {
      assert(Math.abs(state.world.x - before.world.x) < 1e-8);
      assert(Math.abs(state.world.y - before.world.y) < 1e-8);
      assert.deepEqual(state.document, before.document);
      assert.equal(state.history, before.history);
      assert.equal(state.dirty, false);
    }
    assert.equal(digest(), originalHash);
    const result = { original: "Dungeondraft 1.2.0.1 Opulent Kirin",
        native: "/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd041-navigation/REPORT.md",
        before, zoomed, restored, mapSha256: originalHash };
    fs.writeFileSync(path.join(out, "navigation-pair.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(saved, JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(out, "navigation-restored.png") });
    checks.push("DD-041.04 Ctrl+wheel changes 100→125→100%, anchors the pointer, preserves V4 map and history");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(saved, "utf8"));
    await open();
    const current = await snapshot();
    assert.deepEqual(current.document, prior.before.document);
    assert.equal(current.history, prior.before.history);
    assert.equal(current.dirty, false);
    assert.equal(digest(), prior.mapSha256);
    checks.push("DD-041.04 fresh process retains the unchanged V4 map after navigation");
  }
  return { edit, reopen };
};
