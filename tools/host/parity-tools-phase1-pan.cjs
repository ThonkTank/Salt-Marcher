const MAP = "Dungeons/Parity/Phase1-Pan.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool }) => {
  const baseline = path.join(qa, "phase1-pan-baseline.json");
  const mapFile = path.join(vault, MAP);
  const digest = () => crypto.createHash("sha256").update(fs.readFileSync(mapFile))
    .digest("hex");
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    const c = e?.renderer.camera;
    return e && { camera: { x: c.x, y: c.y, scale: c.scale },
      document: e.session.document(), notes: e.session.draft().notes,
      dirty: e.session.dirty, history: e.session.historySize,
      selection: [...e.selection], draft: e.pathDraft
        ? { tool: e.pathDraft.tool, points: e.pathDraft.points } : null };
  });
  const frame = async () => {
    const box = await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().boundingBox();
    assert(box && box.width > 350 && box.height > 250);
    return { start: { x: box.x + box.width / 2 + 80,
      y: box.y + box.height / 2 + 50 },
      marker: await page.evaluate(() => {
        const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          .view.editor.renderer;
        const box = r.canvas.getBoundingClientRect();
        return { x: box.x + r.camera.x + 8 * r.camera.scale,
          y: box.y + r.camera.y + 6 * r.camera.scale };
      }) };
  };
  const reset = async (scale) => page.evaluate((scale) => {
    const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      .view.editor.renderer;
    r.fit(); r.zoom(scale / r.camera.scale);
  }, scale);
  const delta = (after, before) => ({ x: after.camera.x - before.camera.x,
    y: after.camera.y - before.camera.y });
  const sameModel = (after, before) => {
    assert.deepEqual(after.document, before.document);
    assert.deepEqual(after.notes, before.notes);
    assert.equal(after.history, before.history);
    assert.equal(after.dirty, before.dirty);
  };
  const drag = async (button, space, x = 96, y = 64) => {
    const { start } = await frame();
    await page.mouse.move(start.x, start.y);
    if (space) await page.keyboard.down("Space");
    await page.mouse.down({ button });
    await page.mouse.move(start.x + x, start.y + y, { steps: 6 });
    await page.mouse.up({ button });
    if (space) await page.keyboard.up("Space");
  };
  async function open() {
    await page.evaluate(async (file) => app.workspace.getLeaf("tab")
      .openFile(app.vault.getAbstractFileByPath(file)), MAP);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await chooseTool("Auswahl");
  }
  async function edit() {
    await page.evaluate(async (file) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(file, JSON.stringify({
        format: "dungeon-map", version: 4, id: "phase1-pan",
        settings: { name: "Phase1 Pan", width: 16, height: 12,
          feetPerField: 5, assetPacks: [], builtInAssets: false,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [{ id: "pan-marker", kind: "object", floorId: "floor-1",
          x: 8, y: 6, rotation: 0, width: 1, height: 1,
          color: 0x6688aa, label: "", layer: 100, flip: false }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
    }, MAP);
    await open();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
      .at(-1)?.view.editor.session.dirty);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().focus();
    const fileHash = digest();
    const audit = [];
    for (const scale of [64, 80]) {
      for (const [name, button, space] of [["Space+Left", "left", true],
        ["Middle", "middle", false]]) {
        await reset(scale);
        const before = await state();
        assert.equal(before.camera.scale, scale);
        await drag(button, space);
        const after = await state();
        assert.equal(after.camera.scale, scale);
        assert.deepEqual(delta(after, before), { x: 96, y: 64 });
        sameModel(after, before);
        assert.equal(digest(), fileHash);
        audit.push({ name, scale, delta: delta(after, before),
          before: before.camera, after: after.camera });
      }
    }
    checks.push("DD-041.02/.03: Space+Left and Middle pan 96×64 at 100/125% without model/history changes");

    await reset(64);
    const marker = (await frame()).marker;
    await page.mouse.click(marker.x, marker.y);
    assert.deepEqual((await state()).selection, ["pan-marker"]);
    await drag("middle", false);
    assert.deepEqual((await state()).selection, ["pan-marker"]);
    await drag("left", true);
    assert.deepEqual((await state()).selection, []);
    checks.push("Middle preserves selection; Space+Left clears it");

    await chooseTool("Polygonraum");
    await reset(64);
    const point = async (x, y) => page.evaluate(({ x, y }) => {
      const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor.renderer;
      const box = r.canvas.getBoundingClientRect();
      return { x: box.x + r.camera.x + x * r.camera.scale,
        y: box.y + r.camera.y + y * r.camera.scale };
    }, { x, y });
    for (const p of [[6, 4], [8, 4], [9, 6]]) {
      const screen = await point(...p);
      await page.mouse.click(screen.x, screen.y);
    }
    const draft = (await state()).draft;
    assert.equal(draft?.tool, "polygon");
    assert.equal(draft.points.length, 3);
    await drag("middle", false);
    assert.deepEqual((await state()).draft, draft);
    await drag("left", true);
    assert.deepEqual((await state()).draft, draft);
    await page.keyboard.press("Escape");
    assert.equal((await state()).draft, null);
    checks.push("A three-point building polygon remains unchanged through both temporary pan gestures");

    await chooseTool("Auswahl");
    await reset(64);
    let before = await state();
    let start = (await frame()).start;
    await page.mouse.move(start.x, start.y);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(start.x + 48, start.y + 32, { steps: 4 });
    let middle = await state();
    assert.deepEqual(delta(middle, before), { x: 48, y: 32 });
    await page.keyboard.up("Space");
    await page.mouse.move(start.x + 96, start.y + 64, { steps: 4 });
    let after = await state();
    assert.deepEqual(delta(after, middle), { x: 0, y: 0 });
    await page.mouse.up();
    sameModel(after, before);
    audit.push({ name: "space-release-stops", first: delta(middle, before),
      second: delta(after, middle) });

    await reset(64);
    before = await state();
    start = (await frame()).start;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.keyboard.down("Space");
    await page.mouse.move(start.x + 96, start.y + 64, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    after = await state();
    assert.deepEqual(delta(after, before), { x: 96, y: 64 });
    sameModel(after, before);
    audit.push({ name: "space-after-pointer-down", delta: delta(after, before) });

    await reset(64);
    before = await state();
    start = (await frame()).start;
    await page.mouse.move(start.x, start.y);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(start.x + 48, start.y + 32, { steps: 4 });
    middle = await state();
    await page.keyboard.press("Escape");
    const escaped = await state();
    assert.deepEqual(escaped.camera, middle.camera);
    await page.mouse.move(start.x + 96, start.y + 64, { steps: 4 });
    after = await state();
    await page.mouse.up();
    await page.keyboard.up("Space");
    assert.deepEqual(delta(after, middle), { x: 48, y: 32 });
    sameModel(after, before);
    audit.push({ name: "escape-preserves-active-pan", beforeEscape: delta(middle, before),
      afterEscape: delta(after, middle) });
    checks.push("Space release stops pan; late Space starts pan; Escape preserves active pan");

    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
      .at(-1)?.view.editor.session.dirty);
    const saved = await state();
    assert.equal(saved.document.entities.length, 1);
    assert.equal(digest(), fileHash);
    fs.writeFileSync(baseline, JSON.stringify({ document: saved.document, hash: fileHash,
      audit }, null, 2));
    fs.writeFileSync(path.join(out, "pan-matrix.json"), JSON.stringify(audit, null, 2));
    await page.screenshot({ path: path.join(out, "pan-final.png") });
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await open();
    const reopened = await state();
    assert.deepEqual(reopened.document, saved.document);
    assert.equal(reopened.document.entities.length, 1);
    assert.equal(digest(), saved.hash);
    assert.equal(reopened.dirty, false);
    checks.push("Fresh Obsidian process retains the byte-identical V4 map after pan matrix");
  }
  return { edit, reopen };
};
