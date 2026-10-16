const MAP = "Dungeons/Grosskarte/Karte.dungeon";
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool, editorAction, selectOnlyObjects, sleep }) => {
  const savedPath = path.join(qa, "phase7-large-saved.json");
  const mapFile = path.join(vault, MAP);
  const digest = () => crypto.createHash("sha256").update(fs.readFileSync(mapFile)).digest("hex");
  const transfers = [];
  const state = async (fullDocument = false) => {
    const started = process.hrtime.bigint();
    const result = await page.evaluate((fullDocument) => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
      if (!e) return null;
      const started = performance.now(), document = e.session.document();
      const modelMs = performance.now() - started;
      const counts = {};
      for (const entity of document.entities)
        counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
      return { ...(fullDocument ? { document } : {
        version: document.version, entityCount: document.entities.length,
        occurrenceCount: document.content.occurrences.length }),
        counts, modelMs, dirty: e.session.dirty,
        history: e.session.historySize, selected: [...e.selection],
        renderCount: e.renderer.renderCount, lastRenderMs: e.renderer.lastRenderMs,
        drawnObjects: [...e.renderer.visuals.values()].filter((visual) =>
          visual.entity.kind === "object").length,
        floor: e.renderer.floorId,
        camera: { x: e.renderer.camera.x, y: e.renderer.camera.y,
          scale: e.renderer.camera.scale } };
    }, fullDocument);
    transfers.push({ bytes: Buffer.byteLength(JSON.stringify(result)),
      wallMs: Number(process.hrtime.bigint() - started) / 1e6 });
    return result;
  };
  const screen = (point) => page.evaluate((point) => {
    const r = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = r.canvas.getBoundingClientRect();
    return { x: box.x + r.camera.x + point.x * r.camera.scale,
      y: box.y + r.camera.y + point.y * r.camera.scale,
      canvas: { x: box.x, y: box.y, right: box.right, bottom: box.bottom } };
  }, point);
  const snapshot = async (name) => {
    const current = await state();
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(current, null, 2));
    await page.screenshot({ path: path.join(out, name + ".png"), timeout: 30000 });
    return current;
  };
  const open = async () => {
    const started = Date.now();
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(mapPath)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
    return Date.now() - started;
  };
  async function edit() {
    const metrics = { openMs: await open() };
    let current = await state();
    assert.equal(current.version, 4);
    assert.equal(current.entityCount, 4295);
    assert.deepEqual(current.counts, { surface: 4, building: 193,
      door: 64, object: 4001, light: 33 });
    assert.equal(current.occurrenceCount, 1);
    assert.equal(fs.existsSync(path.join(vault, "Dungeons/Grosskarte/Räume")), false);
    metrics.initial = { total: current.entityCount,
      counts: current.counts, modelMs: current.modelMs,
      renderCount: current.renderCount, lastRenderMs: current.lastRenderMs,
      drawnObjects: current.drawnObjects, camera: current.camera };
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await snapshot("p7-large-overview");
    checks.push("V4 large map opens with 193 rooms, 64 portals, 4001 objects, 4 surfaces, 33 lights and one linked key");

    const box = await page.locator(".dn-canvas canvas").boundingBox();
    assert(box);
    let started = Date.now();
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .56, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    metrics.panInputMs = Date.now() - started;
    started = Date.now();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -65);
    await page.keyboard.up("Control");
    metrics.zoomInputMs = Date.now() - started;
    checks.push("Large map accepts middle-button pan and modified wheel zoom");

    await editorAction("Geschosse");
    started = Date.now();
    await page.locator('select[aria-label="Geschoss"]').selectOption("floor-upper");
    await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor?.renderer.floorId === "floor-upper");
    metrics.floorSwitchMs = Date.now() - started;
    await page.locator('select[aria-label="Vergleichsgeschoss"]').selectOption("floor-ground");
    await page.locator('select[aria-label="Geschoss"]').selectOption("floor-ground");
    await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view?.editor?.renderer.floorId === "floor-ground");
    checks.push("Both floors and aligned comparison switch on the large map");

    await chooseTool("Auswahl");
    await selectOnlyObjects();
    await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer.focus("room-phase7", 4));
    const focused = await snapshot("p7-large-room-focus");
    assert(focused.camera.scale > metrics.initial.camera.scale);
    metrics.focus = { modelMs: focused.modelMs, renderCount: focused.renderCount,
      lastRenderMs: focused.lastRenderMs, drawnObjects: focused.drawnObjects,
      camera: focused.camera };
    const start = await screen({ x: 187, y: 122 }),
      end = await screen({ x: 187, y: 126 });
    for (const point of [start, end])
      assert(point.x > point.canvas.x && point.x < point.canvas.right &&
        point.y > point.canvas.y && point.y < point.canvas.bottom,
      "Fokussierter Objektzug liegt außerhalb der Zeichenfläche");
    await page.mouse.click(start.x, start.y);
    assert.deepEqual((await state()).selected, ["object-phase7"]);
    const beforeMove = await state(true);
    started = Date.now();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    metrics.dragInputMs = Date.now() - started;
    const moved = await state(true), object = moved.document.entities.find((e) => e.id === "object-phase7");
    assert.equal(object.x, 187);
    assert.equal(object.y, 126);
    assert.equal(object.roomId, "room-phase7");
    assert.equal(moved.document.content.occurrences[0].sectionId, "section-phase7");
    assert.equal(moved.history, beforeMove.history + 1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state(true)).document, beforeMove.document);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state(true)).document, moved.document);
    metrics.afterMove = { modelMs: moved.modelMs, renderCount: moved.renderCount,
      lastRenderMs: moved.lastRenderMs, drawnObjects: moved.drawnObjects };
    await snapshot("p7-large-object-moved");
    checks.push("Focused V4 feature object moves under load; Undo/Redo preserve linked occurrence and key exactly");

    started = Date.now();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
      return !!e && !e.saving && !e.session.dirty;
    }, null, { timeout: 30000 });
    metrics.saveMs = Date.now() - started;
    const persisted = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    assert.deepEqual(persisted, moved.document);
    const hash = digest();
    fs.writeFileSync(savedPath, JSON.stringify({ hash, document: persisted }, null, 2));
    const afterSave = await state();
    await sleep(1000);
    const idle = await state();
    metrics.idleAdditionalRenders = idle.renderCount - afterSave.renderCount;
    metrics.final = { modelMs: idle.modelMs, renderCount: idle.renderCount,
      lastRenderMs: idle.lastRenderMs, drawnObjects: idle.drawnObjects };
    fs.writeFileSync(path.join(out, "p7-large-metrics.json"), JSON.stringify(metrics, null, 2));
    fs.writeFileSync(path.join(out, "p7-large-host-transfers.json"), JSON.stringify(transfers, null, 2));
    checks.push("Large V4 map saves atomically; model, render, input, save, memory and idle telemetry are separated");

    await page.evaluate(async (mapPath) =>
      app.plugins.getPlugin("dungeon-editor").openRoomKey(mapPath, "room-phase7"), MAP);
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    await page.waitForFunction(() => {
      const card = app.workspace.getLeavesOfType("dungeon-native-room")[0]?.view?.card;
      if (!card?.loaded || !card.sized || !card.renderer) return false;
      const e = card.map.session.entities.get("object-phase7"), r = card.renderer;
      const canvas = r.canvas.getBoundingClientRect(), viewport = card.viewport.getBoundingClientRect();
      const x = canvas.x + r.camera.x + e.x * r.camera.scale,
        y = canvas.y + r.camera.y + e.y * r.camera.scale;
      return x > viewport.x && x < viewport.right && y > viewport.y && y < viewport.bottom;
    }, null, { timeout: 20000 });
    const marker = await page.evaluate(() => {
      const card = app.workspace.getLeavesOfType("dungeon-native-room")[0].view.card,
        e = card.map.session.entities.get("object-phase7"), r = card.renderer;
      const box = r.canvas.getBoundingClientRect();
      return { x: box.x + r.camera.x + e.x * r.camera.scale,
        y: box.y + r.camera.y + e.y * r.camera.scale,
        hit: r.hitTest({ x: e.x, y: e.y }, (candidate) => card.interactive(candidate))?.id,
        roomLabel: r.roomLabelAt({ x: r.camera.x + e.x * r.camera.scale,
          y: r.camera.y + e.y * r.camera.scale })?.id,
        scale: r.camera.scale };
    });
    await page.mouse.click(marker.x, marker.y);
    await page.waitForTimeout(750);
    const afterClick = await page.evaluate(({ x, y }) => ({
      top: document.elementFromPoint(x, y)?.outerHTML.slice(0, 200),
      leaves: app.workspace.getLeavesOfType("dungeon-native-room").map((leaf) =>
        ({ state: leaf.getViewState()?.state,
          connected: leaf.view.containerEl.isConnected,
          panel: !!leaf.view.panel })),
    }), marker);
    fs.writeFileSync(path.join(out, "p7-large-marker-click.json"),
      JSON.stringify({ marker, afterClick }, null, 2));
    assert(afterClick.leaves.some((leaf) => leaf.state?.sectionId === "section-phase7"),
      "Featuremarker öffnet Abschnitt nicht");
    assert.match(await page.locator(".dn-room-view .dn-key-content").innerText(),
      /Wortlaut der großen Phase-7-Karte/);
    await snapshot("p7-large-key-opened");
    checks.push("Large-map marker click opens its exact V4 key section in the right room view");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    const openMs = await open();
    const current = await state(true);
    assert.equal(current.document.version, 4);
    assert.deepEqual(current.document, prior.document);
    assert.equal(digest(), prior.hash);
    assert.equal(current.dirty, false);
    const object = current.document.entities.find((e) => e.id === "object-phase7");
    assert.deepEqual({ x: object.x, y: object.y, roomId: object.roomId },
      { x: 187, y: 126, roomId: "room-phase7" });
    await page.evaluate(async (mapPath) =>
      app.plugins.getPlugin("dungeon-editor").openRoomKey(mapPath, "room-phase7"), MAP);
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    assert.match(await page.locator(".dn-room-view .dn-key-content").innerText(),
      /Wortlaut der großen Phase-7-Karte/);
    fs.writeFileSync(path.join(out, "p7-large-reopen-metrics.json"), JSON.stringify({
      openMs, modelMs: current.modelMs, renderCount: current.renderCount,
      lastRenderMs: current.lastRenderMs, drawnObjects: current.drawnObjects,
    }, null, 2));
    await page.screenshot({ path: path.join(out, "p7-large-reopened.png"), timeout: 30000 });
    checks.push("Fresh process restores all 4295 V4 entities, linked key and moved object byte-identically");
  }
  return { edit, reopen };
};
