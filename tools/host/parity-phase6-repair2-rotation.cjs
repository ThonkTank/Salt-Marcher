const MAP = "Dungeons/Parity/Repair2-Rotation.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const tracePath = process.env.DUNGEON_NATIVE_ROTATION_TRACE;
  assert(tracePath, "DUNGEON_NATIVE_ROTATION_TRACE is required");
  const native = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  assert.equal(native.steps.length, 8);
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const visual = editor.renderer.visuals.get("cloth-1")?.container;
    const gesture = editor.gesture;
    const canvas = editor.renderer.canvas.getBoundingClientRect();
    return { object: editor.session.document().entities.find((entity) => entity.id === "cloth-1"),
      selected: [...editor.selection], history: editor.session.historySize,
      camera: { ...editor.renderer.camera },
      canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
      preview: visual && { rotation: visual.rotation, x: visual.position.x,
        y: visual.position.y },
      gesture: gesture && { moved: gesture.moved, start: gesture.start,
        last: gesture.last, processedPrevious: gesture.processedPrevious,
        action: gesture.transform?.action, groupAction: gesture.groupTransform?.action } };
  });
  const screen = (x, y) => page.evaluate(({ x, y }) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + y * renderer.camera.scale };
  }, { x, y });
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      renderer.zoom(64 / renderer.camera.scale);
    });
    assert.equal((await state()).camera.scale, 64);
  };
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (archive) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(archive), pck);
    const cloth = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.kind === "object" &&
          asset.files.image?.endsWith("/textures/objects/activities/administration/cloth_01.png")));
    assert(cloth?.objectSizeFields);
    await page.evaluate(async ({ name, cloth }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-repair2-rotation",
        settings: { name: "Repair2 Rotation", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [{ id: "cloth-1", kind: "object", floorId: "floor-1",
          x: 3.5, y: 3.5, rotation: 0, width: cloth.objectSizeFields.width * 4,
          height: cloth.objectSizeFields.height * 4, color: 0x61788d,
          label: "", layer: 100, flip: false, assetId: cloth.id }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, cloth });
    await open();
    const center = await screen(3.5, 3.5);
    await page.mouse.click(center.x, center.y);
    const before = await state();
    assert.deepEqual(before.selected, ["cloth-1"]);
    const start = { x: center.x + native.screen_start[0] - 768,
      y: center.y + native.screen_start[1] - 448 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const steps = [];
    for (const entry of native.steps) {
      const pointer = { x: center.x + entry.pointer[0] - 768,
        y: center.y + entry.pointer[1] - 448 };
      await page.mouse.move(pointer.x, pointer.y);
      await page.waitForTimeout(550);
      steps.push({ nativePointer: entry.pointer, hostPointer: pointer,
        nativeRotation: entry.state.selected[0].global_rotation,
        host: await state() });
    }
    const held = await state();
    await page.mouse.up();
    const after = await state();
    const record = { tracePath, nativeStart: native.screen_start,
      nativeEnd: native.screen_end, before, start, steps, held, after,
      nativeAfter: native.after };
    fs.writeFileSync(path.join(out, "rotation-pair.json"),
      JSON.stringify(record, null, 2));
    await page.screenshot({ path: path.join(out, "rotation-after.png") });
    for (const entry of steps)
      assert(Math.abs(entry.host.preview.rotation - entry.nativeRotation) < 0.02,
        `Preview differs at ${entry.nativePointer}: ${entry.host.preview.rotation} vs ${entry.nativeRotation}`);
    assert(Math.abs(after.object.rotation - native.after.selected[0].global_rotation) < 0.02);
    assert.equal(after.history, before.history + 1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).object, before.object);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).object, after.object);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    checks.push("DD-030.24 eight paced preview steps and release angle match native; Undo/Redo and save persist");
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.object, saved.entities.find((entity) => entity.id === "cloth-1"));
    assert(Math.abs(current.object.rotation - native.after.selected[0].global_rotation) < 0.02);
    checks.push("DD-030.24 fresh host opening retains native-paced Cloth rotation");
  }
  return { edit, reopen };
};
