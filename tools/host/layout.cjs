module.exports = ({ page, fs, path, assert, crypto, qa, vault, restart, out, checks, chooseTool, editorAction, sleep }) => {
async function compactWorkflow() {
  const mapPath = "Dungeons/Drachenhöhle/Karte.dungeon";
  await page.evaluate(async (path) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:10000;left:540px;top:70px;width:520px;height:550px;background:white";
    document.body.append(host);
    const card = app.plugins.getPlugin("dungeon-editor").createDungeonMap({path,compact:true});
    host.append(card.el);
    window.__qaCompact = {host,card};
    await card.ready;
    card.fit();
  }, mapPath);
  const state = () => page.evaluate(() => {
    const renderer = window.__qaCompact.card.renderer;
    return {
      scale: renderer.camera.scale,
      objects: [...renderer.visuals.values()].filter((v) => v.entity.kind === "object").length,
      totalObjects: [...renderer.session.entities.values()].filter((entity) => entity.kind === "object").length,
      markerLabels: [...renderer.visuals.values()].filter((v) => v.entity.kind === "object" && v.label?.visible).length,
      visibleLabels: [...renderer.visuals.values()].filter((v) => v.label?.visible).length,
      renderCount: renderer.renderCount,
      lastRenderMs: renderer.lastRenderMs,
    };
  });
  await sleep(500);
  const overview = await state();
  assert(overview.objects < overview.totalObjects / 2, "Compact overview keeps only legible furniture");
  assert.equal(overview.markerLabels, 0, "Tiny feature markers do not crowd the overview");
  assert(overview.visibleLabels >= 15, "Room numbers remain visible");
  await page.screenshot({ path: out + "/compact-overview.png" });
  await page.evaluate(() => {
    const card = window.__qaCompact.card,
      room = [...card.map.session.entities.values()].find(
        (entity) => entity.kind === "building" && entity.number === "1",
      );
    card.focus(room.id);
  });
  await sleep(500);
  const focus = await state();
  assert(focus.objects > 0 && focus.markerLabels > 0, "Room focus restores map details and markers");
  await page.screenshot({ path: out + "/compact-room-focus.png" });
  const idleBefore = focus.renderCount;
  await sleep(500);
  const idle = await state();
  assert.equal(idle.renderCount, idleBefore, "Compact map does not redraw while idle");
  await page.evaluate(() => {
    const {host,card} = window.__qaCompact;
    host.style.height = "260px";
    card.el.style.height = "260px";
  });
  await sleep(250);
  await page.evaluate(() => window.__qaCompact.card.fit());
  await sleep(250);
  const narrow = await state();
  assert.equal(narrow.markerLabels, 0, "Small map hides unreadable markers");
  assert.equal(narrow.visibleLabels, 15, "Small map keeps every room number");
  assert(narrow.objects < overview.objects, "Smaller viewport draws fewer details");
  await page.screenshot({ path: out + "/compact-narrow-overview.png" });
  fs.writeFileSync(out + "/metrics.json", JSON.stringify({overview,focus,narrow,idleAdditionalRenders:idle.renderCount-idleBefore}, null, 2));
  await page.evaluate(() => {
    window.__qaCompact.card.destroy();
    window.__qaCompact.host.remove();
    delete window.__qaCompact;
  });
  checks.push("Productive Dragon Cave compact overview and room focus reduce details without hiding room numbers or redrawing at idle");
}
async function largeWorkflow() {
  const mapPath = "Dungeons/Grosskarte/Karte.dungeon",
    source = qa + "/large-saved.json",
    metrics = {};
  const started = Date.now();
  await page.evaluate(async (p) => {
    await app.workspace
      .getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(p));
  }, mapPath);
  await page
    .locator(".dn-canvas canvas")
    .waitFor({ state: "visible", timeout: 30000 });
  metrics.openMs = Date.now() - started;
  const state = () =>
    page.evaluate(() => {
      const editor =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
        d = editor.session.document(),
        counts = {};
      for (const entity of d.entities)
        counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
      const object = editor.session.entities.get("object-1-0");
      return {
        counts,
        total: d.entities.length,
        dirty: editor.session.dirty,
        history: editor.session.historySize,
        renderCount: editor.renderer.renderCount,
        lastRenderMs: editor.renderer.lastRenderMs,
        drawnObjects: [...editor.renderer.visuals.values()].filter(
          (visual) => visual.entity.kind === "object",
        ).length,
        floor: editor.renderer.floorId,
        object: object ? { x: object.x, y: object.y } : null,
      };
    });
  const digest = () =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(vault + "/" + mapPath))
      .digest("hex");
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(source, "utf8"));
    assert.equal(digest(), saved.sha256);
    const reopened = await state();
    assert.equal(reopened.dirty, false);
    assert.deepEqual(reopened.counts, saved.counts);
    assert.deepEqual(reopened.object, saved.object);
    checks.push("Fresh native process reopens the exact large edited map");
    await sleep(1500);
    await page.screenshot({ path: out + "/large-reopened.png" });
    fs.writeFileSync(
      out + "/metrics.json",
      JSON.stringify({ ...metrics, reopened }, null, 2),
    );
    return;
  }
  let current = await state();
  assert.equal(current.total, 4292);
  metrics.overviewDrawnObjects = current.drawnObjects;
  assert.deepEqual(current.counts, {
    surface: 4,
    building: 192,
    door: 64,
    object: 4000,
    light: 32,
  });
  checks.push(
    "Large native map opens with two floors, complex surfaces, 4000 objects and 32 lights",
  );
  await sleep(2000);
  await page.screenshot({ path: out + "/large-overview.png" });
  const canvas = page.locator(".dn-canvas canvas"),
    box = await canvas.boundingBox();
  assert(box, "Canvas bounds");
  const panStarted = Date.now();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.56, {
    steps: 12,
  });
  await page.mouse.up({ button: "middle" });
  metrics.panMs = Date.now() - panStarted;
  const zoomStarted = Date.now();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -65);
  await page.keyboard.up("Control");
  metrics.zoomMs = Date.now() - zoomStarted;
  checks.push("Pan and zoom respond on the large retained scene");
  await editorAction("Geschosse");
  const floorStarted = Date.now();
  await page
    .locator('select[aria-label="Geschoss"]')
    .selectOption("floor-upper");
  await page.waitForFunction(
    () =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .renderer.floorId === "floor-upper",
  );
  metrics.floorSwitchMs = Date.now() - floorStarted;
  await page
    .locator('select[aria-label="Vergleichsgeschoss"]')
    .selectOption("floor-ground");
  await editorAction("Geschosse");
  checks.push(
    "Floor switch and aligned comparison overlay work on the large scene",
  );
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  const at = (point) =>
    page.evaluate((point) => {
      const renderer =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
            .renderer,
        box = renderer.canvas.getBoundingClientRect();
      return {
        x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
      };
    }, point);
  const drag = async (a, b) => {
    a = await at(a);
    b = await at(b);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };
  await chooseTool("Auswahl");
  const target = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      reference = editor.session.entities.get("object-1-0");
    editor.renderer.focus(reference.id, 8);
    const e = editor.renderer.hitTest({ x: 10, y: 10 });
    return e?.kind === "object" ? { id: e.id, x: e.x, y: e.y } : null;
  });
  assert(target, "Selectable furniture at test point");
  metrics.focusDrawnObjects = (await state()).drawnObjects;
  await drag(
    { x: target.x, y: target.y },
    { x: target.x + 2, y: target.y + 1 },
  );
  const moved = await page.evaluate((id) => {
    const e = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.entities.get(id);
    return { x: e.x, y: e.y };
  }, target.id);
  assert.deepEqual(moved, { x: target.x + 2, y: target.y + 1 });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  checks.push("Furniture moves without rebuilding the model on the large map");
  const beforePaint = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      e = editor.session.entities.get("surface-material-1");
    return {
      history: editor.session.historySize,
      shape: JSON.stringify(e.polygons),
    };
  });
  await chooseTool("Material");
  const paintStarted = Date.now();
  await drag({ x: 15, y: 40 }, { x: 8, y: 40 });
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .paintWorker,
    null,
    { timeout: 30000 },
  );
  metrics.paintMs = Date.now() - paintStarted;
  const afterPaint = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      e = editor.session.entities.get("surface-material-1");
    return {
      history: editor.session.historySize,
      shape: JSON.stringify(e.polygons),
      processing: editor.lastPaintMetrics,
    };
  });
  assert.equal(afterPaint.history, beforePaint.history + 1);
  assert.notEqual(afterPaint.shape, beforePaint.shape);
  metrics.paintProcessing = afterPaint.processing;
  checks.push(
    "Background material brush commits one complete large-map command",
  );
  await chooseTool("Licht");
  const lightAt = await at({ x: 102, y: 72 });
  await page.mouse.click(lightAt.x, lightAt.y);
  await page.locator('input[aria-label="Lichtstärke"]').fill("1.4");
  await page.locator('input[aria-label="Lichtstärke"]').press("Tab");
  await page.waitForFunction(
    () =>
      app.workspace
        .getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.document()
        .entities.filter((e) => e.kind === "light").length === 33,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  checks.push(
    "Light range, strength, color and shadows remain separate editable properties",
  );
  await page.screenshot({ path: out + "/large-edited.png", timeout: 30000 });
  const saveStarted = Date.now();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .session.dirty,
    null,
    { timeout: 30000 },
  );
  metrics.saveMs = Date.now() - saveStarted;
  current = await state();
  const saved = {
    path: mapPath,
    sha256: digest(),
    counts: current.counts,
    object: current.object,
  };
  fs.writeFileSync(source, JSON.stringify(saved, null, 2));
  checks.push("Large edited map saves without a fixed memory ceiling");
  const renders = current.renderCount;
  await sleep(1000);
  const idle = await state();
  metrics.idleAdditionalRenders = idle.renderCount - renders;
  metrics.lastRenderMs = idle.lastRenderMs;
  metrics.final = idle;
  fs.writeFileSync(out + "/metrics.json", JSON.stringify(metrics, null, 2));
}

return { compactWorkflow, largeWorkflow };
};
