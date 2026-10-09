const OPTIONS = [
  { name: "both-on", wall: true, object: true },
  { name: "wall-off", wall: false, object: true },
  { name: "object-off", wall: true, object: false },
  { name: "both-off", wall: false, object: false },
];
const folder = "Dungeons/Phase1-Shadow-Matrix";
const file = (name) => `${folder}/${name}.dungeon`;

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-shadow-matrix-baseline.json");
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, file(name)))).digest("hex");
  const editor = () => page.locator(".dungeon-native-editor:visible").last();
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), history: e.session.historySize,
      dirty: e.session.dirty };
  });
  async function open(name) {
    await page.evaluate(async (target) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(target)), file(name));
    await editor().locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (!(await editor().evaluate((el) => el.classList.contains("dn-maximized"))))
      await editor().getByRole("button", { name: "Maximieren", exact: true }).click();
    await editor().getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.waitForTimeout(400);
  }
  async function capture(name, prefix) {
    await open(name);
    const current = await state();
    assert.equal(current.dirty, false);
    assert.equal(current.history, 0);
    assert.equal(current.document.entities.length, 3);
    await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
      `${prefix}-${name}.png`) });
    return { document: current.document, hash: hash(name) };
  }
  async function edit() {
    await page.evaluate(async ({ folder, options }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder(folder);
      for (const option of options) {
        const doc = {
          format: "dungeon-map", version: 4, id: `phase1-shadow-${option.name}`,
          settings: { name: `Phase1 Shadow ${option.name}`, width: 8, height: 8,
            feetPerField: 5, wallShadows: true, objectShadows: true,
            buildingWear: 0, nativeBuildingWear: false,
            buildingWearMode: "none", assetPacks: [] },
          floors: [{ id: "floor-1", name: "Ground", elevation: 0 }],
          entities: [
            { id: "floor", kind: "building", floorId: "floor-1", layer: 100,
              polygons: [{ outer: [{ x: 0, y: 0 }, { x: 6, y: 0 },
                { x: 6, y: 6 }, { x: 0, y: 6 }], holes: [] }],
              fill: 0xb2a28f, wall: 0xffffff, wallWidth: 0 },
            { id: "wall", kind: "wall", floorId: "floor-1", layer: 700,
              points: [{ x: 0, y: 0 }, { x: 6, y: 0 },
                { x: 6, y: 6 }, { x: 0, y: 6 }], closed: true,
              smooth: false, color: 0xffffff, width: 0.2,
              shadow: option.wall },
            { id: "object", kind: "object", floorId: "floor-1", layer: 200,
              x: 3, y: 3, rotation: 0, width: 0.7, height: 0.7,
              color: 0x61788d, label: "", flip: false,
              shadow: option.object },
          ],
          content: { definitions: [], occurrences: [], routes: [], archive: [] },
        };
        await app.vault.create(`${folder}/${option.name}.dungeon`,
          JSON.stringify(doc));
      }
    }, { folder, options: OPTIONS });
    const rows = [];
    for (const option of OPTIONS) rows.push({ name: option.name,
      ...await capture(option.name, "edit") });
    fs.writeFileSync(baseline, JSON.stringify(rows, null, 2));
    fs.writeFileSync(path.join(out, "shadow-matrix.json"), JSON.stringify(
      rows.map(({ name, hash }) => ({ name, hash })), null, 2));
    checks.push("DD-006 four per-entity shadow combinations render in isolated V4 maps");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    for (const expected of prior) {
      const actual = await capture(expected.name, "reopen");
      assert.deepEqual(actual.document, expected.document);
      assert.equal(actual.hash, expected.hash);
    }
    checks.push("DD-006 four shadow maps reopen with identical documents and file hashes");
  }
  return { edit, reopen };
};
