const ROOT = "Dungeons/Parity/Repair2-Overlap";
const CASES = [
  { name: "Blue-Red", order: ["blue", "red"], expected: "red" },
  { name: "Red-Blue", order: ["red", "blue"], expected: "blue" },
];

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const mapPath = (name) => `${ROOT}-${name}.dungeon`;
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return { selection: [...editor.selection], document: editor.session.document(),
      history: editor.session.historySize,
      camera: { x: editor.renderer.camera.x, y: editor.renderer.camera.y,
        scale: editor.renderer.camera.scale } };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const click = async (point) => {
    const pos = await screen(point);
    await page.mouse.move(pos.x, pos.y);
    await page.waitForTimeout(300);
    await page.mouse.click(pos.x, pos.y);
    return { screen: pos, state: await state() };
  };
  const open = async (name) => {
    await page.evaluate(async (filename) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(filename)),
    mapPath(name));
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      renderer.zoom(64 / renderer.camera.scale);
    });
    assert.equal((await state()).camera.scale, 64);
  };
  const verify = async (entry, phase) => {
    await open(entry.name);
    const before = await state();
    assert.equal(before.history, 0);
    const control = await click({ x: 5, y: 2.5 });
    assert.deepEqual(control.state.selection, ["control"]);
    const overlap = await click({ x: 2.46875, y: 2.578125 });
    assert.deepEqual(overlap.state.selection, [entry.expected]);
    assert.deepEqual(overlap.state.document, before.document);
    assert.equal(overlap.state.history, 0);
    const record = { phase, order: entry.order, expected: entry.expected,
      control, overlap };
    fs.writeFileSync(path.join(out, `${entry.name}-${phase}.json`),
      JSON.stringify(record, null, 2));
    await page.screenshot({ path: path.join(out, `${entry.name}-${phase}.png`) });
    checks.push(`DD-030.19 ${entry.name}: top overlap object selected after isolated control click (${phase})`);
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
    await page.evaluate(async ({ cases, root, cloth }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      for (const entry of cases) {
        const object = (id) => ({ id, kind: "object", floorId: "floor-1",
          x: id === "control" ? 5 : 2.5, y: 2.5,
          rotation: id === "red" ? Math.PI : 0,
          width: cloth.objectSizeFields.width,
          height: cloth.objectSizeFields.height,
          color: id === "red" ? 0xff4040 : 0x61788d,
          label: "", layer: id === "control" ? 200 : 100,
          flip: false, assetId: cloth.id });
        await app.vault.create(`${root}-${entry.name}.dungeon`, JSON.stringify({
          format: "dungeon-map", version: 3,
          id: `parity-phase6-repair2-overlap-${entry.name}`,
          settings: { name: `Overlap ${entry.name}`, width: 8, height: 8,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: false, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
          entities: [...entry.order.map(object), object("control")],
          content: { definitions: [], occurrences: [], routes: [], archive: [] },
        }, null, 2));
      }
    }, { cases: CASES, root: ROOT, cloth });
    for (const entry of CASES) await verify(entry, "edit");
  }
  async function reopen() {
    for (const entry of CASES) await verify(entry, "reopen");
  }
  return { edit, reopen };
};
