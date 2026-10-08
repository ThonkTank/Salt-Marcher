const MAP = "Dungeons/Parity/Repair2-Marquee.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const renderer = editor.renderer;
    const gesture = editor.gesture;
    const canvas = renderer.canvas.getBoundingClientRect();
    return { selected: [...editor.selection], document: editor.session.document(),
      history: editor.session.historySize,
      filters: { types: [...editor.selectionTypes], layers: [...editor.selectionLayers] },
      camera: { ...renderer.camera },
      canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
      gesture: gesture && { moved: gesture.moved, entity: gesture.entity?.id,
        start: gesture.start, last: gesture.last,
        marqueePrevious: gesture.marqueePrevious } };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point[0] * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point[1] * renderer.camera.scale };
  }, point);
  const clear = async () => {
    const pos = await screen([0.5, 0.5]);
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selected, []);
  };
  const drag = async (from, heldEnd, releaseEnd = heldEnd, steps = 24) => {
    const start = await screen(from), heldPoint = await screen(heldEnd),
      release = await screen(releaseEnd);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(heldPoint.x, heldPoint.y, { steps });
    const held = await state();
    assert(held.gesture?.moved && !held.gesture.entity,
      `Expected a marquee, got ${JSON.stringify(held.gesture)}`);
    await page.mouse.move(release.x, release.y);
    await page.mouse.up();
    return { from, heldEnd, releaseEnd, start, heldPoint, release,
      held, after: await state() };
  };
  const CASES = [
    { name: "forward", from: [1.640625, 1.640625],
      held: [3.359375, 3.4375], expected: ["cloth-a"] },
    { name: "reverse", from: [3.359375, 3.4375],
      held: [1.640625, 1.640625], expected: ["cloth-a"] },
    { name: "cloth-clipped-no-anchor", from: [2.109375, 2.109375],
      held: [2.40625, 2.890625], expected: [] },
    { name: "cloth-clipped-with-anchor", from: [2.34375, 1.796875],
      held: [2.65625, 3.203125], expected: ["cloth-a"] },
    { name: "edge-release-crosses-anchor", from: [1.640625, 1.796875],
      held: [2.4375, 3.203125], release: [2.515625, 3.203125],
      expected: [] },
    { name: "edge-previous-move-includes-anchor", from: [1.640625, 1.796875],
      held: [2.578125, 3.203125], release: [2.625, 3.203125],
      expected: ["cloth-a"] },
    { name: "light-glow-no-anchor", from: [3.046875, 3.203125],
      held: [4.609375, 5.46875], expected: [] },
    { name: "light-with-anchor", from: [3.046875, 3.203125],
      held: [5.546875, 5.703125], expected: ["light-a"] },
  ];
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
  const verify = async (phase) => {
    await open();
    const before = await state();
    assert.equal(before.history, 0);
    const records = [];
    for (const entry of CASES) {
      await clear();
      const result = await drag(entry.from, entry.held,
        entry.release || entry.held);
      assert.deepEqual(result.after.selected, entry.expected, entry.name);
      assert.deepEqual(result.after.document, before.document, entry.name);
      assert.equal(result.after.history, 0, entry.name);
      records.push({ name: entry.name, expected: entry.expected, ...result });
    }
    fs.writeFileSync(path.join(out, `marquee-${phase}.json`), JSON.stringify({
      phase, before, cases: records,
    }, null, 2));
    await page.screenshot({ path: path.join(out, `marquee-${phase}.png`) });
    checks.push(`DD-030.20 forward/reverse, clipped graphics, light anchors and movement-event edge match native (${phase})`);
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
      const object = (id, x, y, locked = false) => ({ id, kind: "object",
        floorId: "floor-1", x, y, rotation: 0,
        width: cloth.objectSizeFields.width, height: cloth.objectSizeFields.height,
        color: 0x61788d, label: "", layer: 100, flip: false,
        locked, assetId: cloth.id });
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-repair2-marquee",
        settings: { name: "Repair2 Marquee", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [object("cloth-a", 2.5, 2.5),
          object("cloth-b", 5, 2.5), object("cloth-locked", 2.5, 5, true),
          { id: "light-a", kind: "light", floorId: "floor-1", x: 5, y: 5,
            radius: 1, intensity: 1, color: 0xffffff, shadows: false }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, cloth });
    await verify("edit");
  }
  async function reopen() { await verify("reopen"); }
  return { edit, reopen };
};
