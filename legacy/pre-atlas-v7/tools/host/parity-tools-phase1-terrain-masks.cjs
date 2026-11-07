// Direct Dungeondraft 1.2.0.1 saved splats are compared as raw RGBA bytes.
const ORIGINAL = "/home/aaron/.cache/dungeon-native-qa";
const FIRST = ORIGINAL + "/implementation-20261005/qa/dd024-terrain-native/native-smooth-resize-20261006/evidence";
const SECOND = ORIGINAL + "/parity-tools-phase1-terrain-reexpand-20261009/native-same/runs/20261009-064736-3546676/evidence/maps";
const FRESH = ORIGINAL + "/parity-tools-phase1-terrain-reexpand-20261009/native-fresh/runs/20261009-064923-3548741/evidence/maps";
const ROOT = "Dungeons/Phase1-TerrainMasks";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const mapPath = (name) => `${ROOT}/${name}.dungeon`;
  const mapFile = (name) => path.join(vault, mapPath(name));
  const original = (file) => {
    const native = JSON.parse(fs.readFileSync(file, "utf8"));
    const terrain = Object.values(native.world.levels)[0].terrain;
    const bytes = (field) => Buffer.from(
      terrain[field].match(/\d+/g).map(Number));
    return { size: [native.world.width, native.world.height],
      splat: bytes("splat"), splat2: bytes("splat2") };
  };
  const compare = (name, doc, nativePath) => {
    const expected = original(nativePath);
    assert.deepEqual([doc.settings.width, doc.settings.height], expected.size, name);
    assert.equal(doc.terrainMasks.length, 1, name);
    for (const key of ["splat", "splat2"])
      assert.deepEqual(Buffer.from(doc.terrainMasks[0][key], "base64"),
        expected[key], `${name} ${key}`);
    checks.push(`DD-038 ${name}: size and two RGBA splats equal saved original`);
    return { name, size: expected.size,
      splatSha256: crypto.createHash("sha256").update(expected.splat).digest("hex"),
      splat2Sha256: crypto.createHash("sha256").update(expected.splat2).digest("hex") };
  };
  const editor = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), dirty: e.session.dirty,
      renderCount: e.renderer.renderCount };
  });
  async function open(name, source) {
    await page.evaluate(async ({ file, source }) => {
      for (const folder of ["Dungeons", "Dungeons/Phase1-TerrainMasks"])
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      let target = app.vault.getAbstractFileByPath(file);
      if (!target && source)
        target = await app.vault.create(file, JSON.stringify(source, null, 2) + "\n");
      if (!target) throw new Error("Terrainkarte fehlt: " + file);
      await app.workspace.getLeaf("tab").openFile(target);
    }, { file: mapPath(name), source });
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      !!app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.terrainMasks);
  }
  async function resize(label, value) {
    const menu = page.locator(".dungeon-native-editor:visible").last()
      .locator(".dn-popover-menu");
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: "Kartengröße ändern" }).click();
    const dialog = page.locator(".modal:visible")
      .filter({ hasText: "Kartengröße ändern" }).last();
    await dialog.waitFor({ state: "visible" });
    const input = dialog.locator(".setting-item")
      .filter({ has: page.locator(".setting-item-name", { hasText: label }) })
      .locator("input");
    await input.fill(String(value));
    await input.press("Tab");
    await dialog.getByRole("button", { name: "Übernehmen" }).click();
  }
  async function save(name) {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.dirty);
    return JSON.parse(fs.readFileSync(mapFile(name), "utf8"));
  }
  const source = (nativePath, id) => {
    const data = original(nativePath);
    return { format: "dungeon-map", version: 4, id,
      settings: { name: id, width: data.size[0], height: data.size[1],
        feetPerField: 5, wallShadows: true, objectShadows: true,
        buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
      entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      terrainMasks: [{ floorId: "floor-1", splat: data.splat.toString("base64"),
        splat2: data.splat2.toString("base64") }] };
  };
  async function edit() {
    const results = [];
    await open("left-top", source(`${FIRST}/08-before-resize.dungeondraft_map`, "terrain-left-top"));
    results.push(compare("source-8x8", (await editor()).document,
      `${FIRST}/08-before-resize.dungeondraft_map`));
    assert.ok((await editor()).renderCount > 0);
    await page.screenshot({ path: path.join(out, "terrain-source.png") });
    for (const step of [
      ["Links in Feldern", 1, "left-plus", `${FIRST}/12-expanded-saved.dungeondraft_map`],
      ["Oben in Feldern", 1, "top-plus", `${FIRST}/15-top-expanded-saved.dungeondraft_map`],
    ]) {
      await resize(step[0], step[1]);
      const state = await editor();
      assert.equal(state.dirty, true);
      results.push(compare(step[2], state.document, step[3]));
      compare(step[2] + "-saved", await save("left-top"), step[3]);
      fs.copyFileSync(mapFile("left-top"), path.join(out, `${step[2]}.dungeon`));
    }
    await open("right-bottom", source(`${FIRST}/15-top-expanded-saved.dungeondraft_map`, "terrain-right-bottom"));
    results.push(compare("source-9x9", (await editor()).document,
      `${FIRST}/15-top-expanded-saved.dungeondraft_map`));
    await page.screenshot({ path: path.join(out, "terrain-expanded-source.png") });
    const steps = [
      ["Rechts in Feldern", -1, "right-minus", `${SECOND}/01-right-minus-one.dungeondraft_map`],
      ["Unten in Feldern", -1, "bottom-minus", `${SECOND}/02-bottom-minus-one.dungeondraft_map`],
      ["Rechts in Feldern", 1, "right-plus", `${SECOND}/03-right-plus-one.dungeondraft_map`],
      ["Unten in Feldern", 1, "bottom-plus", `${SECOND}/04-bottom-plus-one.dungeondraft_map`],
    ];
    for (const step of steps) {
      await resize(step[0], step[1]);
      results.push(compare(step[2], (await editor()).document, step[3]));
      compare(step[2] + "-saved", await save("right-bottom"), step[3]);
      fs.copyFileSync(mapFile("right-bottom"), path.join(out, `${step[2]}.dungeon`));
      if (step[2] === "bottom-minus")
      {
        fs.copyFileSync(mapFile("right-bottom"), mapFile("crop-for-fresh"));
        fs.writeFileSync(path.join(qa, "terrain-crop-hash.txt"),
          crypto.createHash("sha256").update(fs.readFileSync(mapFile("crop-for-fresh")))
            .digest("hex"));
      }
    }
    fs.writeFileSync(path.join(out, "terrain-mask-result.json"),
      JSON.stringify({ mode: "edit", results }, null, 2));
  }
  async function reopen() {
    const cropHash = crypto.createHash("sha256")
      .update(fs.readFileSync(mapFile("crop-for-fresh"))).digest("hex");
    assert.equal(cropHash,
      fs.readFileSync(path.join(qa, "terrain-crop-hash.txt"), "utf8"));
    await open("crop-for-fresh");
    const results = [];
    results.push(compare("fresh-crop", (await editor()).document,
      `${SECOND}/02-bottom-minus-one.dungeondraft_map`));
    for (const step of [
      ["Rechts in Feldern", 1, "fresh-right-plus", `${FRESH}/01-right-plus-one.dungeondraft_map`],
      ["Unten in Feldern", 1, "fresh-bottom-plus", `${FRESH}/02-bottom-plus-one.dungeondraft_map`],
    ]) {
      await resize(step[0], step[1]);
      results.push(compare(step[2], (await editor()).document, step[3]));
      compare(step[2] + "-saved", await save("crop-for-fresh"), step[3]);
      fs.copyFileSync(mapFile("crop-for-fresh"), path.join(out, `${step[2]}.dungeon`));
    }
    fs.writeFileSync(path.join(out, "terrain-mask-result.json"),
      JSON.stringify({ mode: "reopen", cropHash, results }, null, 2));
  }
  return { edit, reopen };
};
